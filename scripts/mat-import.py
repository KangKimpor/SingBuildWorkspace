"""Local-only: turns the BP03 and BP04 material and procurement workbooks into a SQL seed for public.kw_mat_items and small WebP
thumbnails for public/mat/. Never connects to a database.

Usage: python scripts/mat-import.py --bp03 BP03.xlsx --bp04 BP04.xlsx --sql .private/mat-seed.sql --images public/mat [--no-images]
Requires openpyxl and Pillow (nothing else outside the standard library).

Each workbook is read twice (formulas and Excel's cached values); pictures are read straight from the zip. The sheets used:

    ID Material, MEP Material -> one row per section header and per material (rows 9 and down; row 8 is the sheet total and is
                                 left to the app). Columns are found by their header text in rows 6 and 7, not by letter.
    Review, Change Log         -> one 'note' row per non-empty row, with the row's cells as text.

Quantity and percentage cells become { "f": <formula key> } when their formula has one of the shapes in SHAPES (row numbers and
column letters replaced by the role of the referenced column), or { "v": <value> } for a typed value. Arithmetic on constants
(=296+8) is stored as its result, with the expression kept in `notes`. Any other formula in those cells stops the run. Every other
formula cell is stored as its cached value.

Self-check: every formula-backed quantity and percentage cell is recalculated with a copy of the app's rules (src/mat/formulas.ts)
and compared with Excel's cached value (an Excel error counts as blank); every SUBTOTAL on a section row is compared with the
average of the materials the section covers (data.end, as src/mat/formulas.ts sectionItems reads it), and row 8 with the average
of the materials in its range. The run exits 1, and writes nothing, on any mismatch or unknown formula.

Section rows carry `end` (the last row they cover: the SUBTOTAL range end, else the row before the next section) and `level`
(0 at the top, +1 per enclosing section), because sections nest.

The seed is one transaction of upserts that set package, sheet, pos, kind and data only, and bump updated_at only when one of them
changed, so a corrected workbook can be imported again without touching what people typed in the app. It never deletes.
"""
import argparse
import ast
from datetime import date, datetime, time, timedelta
import hashlib
import io
import json
import math
from pathlib import Path
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

import openpyxl
from openpyxl.utils import column_index_from_string, get_column_letter
from PIL import Image

MATERIAL_SHEETS = {'ID Material': 'id', 'MEP Material': 'mep'}
NOTE_SHEETS = {'Review': 'review', 'Change Log': 'changelog'}
GROUP_ROW, SUB_ROW, TOTAL_ROW, FIRST_ROW = 6, 7, 8, 9
QTY_CELLS = ('total', 'po', 'shd', 'onsite', 'remaining')
PCT_CELLS = ('notYetPo', 'placed', 'production', 'waiting', 'shipping', 'arrived')
CELLS = QTY_CELLS + PCT_CELLS
COL_KEYS = ('no', 'pic', 'bp02', 'code', 'description', 'location', 'spec', 'brand', 'source', 'msPlan', 'msActual', 'msApproved',
            'msStatus', 'ssPlan', 'ssActual', 'ssApproved', 'poPlan', 'poActual', 'arrPlan', 'arrActual', 'procRemarks', 'unit',
            'lastUpdated')
PICTURE_COLS = ('image', 'sample')
# Columns a material row fills and a numbered heading leaves blank (see label_only).
LABEL_ONLY_EMPTY = ('location', 'spec', 'brand', 'source', 'msPlan', 'msActual', 'msApproved', 'msStatus', 'ssPlan', 'ssActual',
                    'ssApproved', 'poPlan', 'poActual', 'arrPlan', 'arrActual', 'unit')
# Percentage cells of a sheet whose whole percentage group is empty (BP04 MEP Material) get the formulas of the other sheets.
DEFAULT_PCT = {'notYetPo': 'notYetPo', 'placed': 'placedPoOverTotal', 'waiting': 'waiting', 'arrived': 'arrived'}
EXCLUDED_SECTIONS = {'COMMONLY MATERIALS USES'}
MARKS = ('done', 'tracking', 'omit')  # legend rows 1, 2, 3
THUMB_SIDE, THUMB_QUALITY = 480, 70
MAX_STATEMENT = 500_000  # bytes
TOLERANCE = 1e-9

# Formula cells checked by hand whose shape no formula key covers: stored as Excel's cached value. Listed in the run output.
KEEP_CACHED = {
    ('bp04', 'MEP Material', 'AA22'): 'Approved SHD = On site (=AB22); no formula key copies another cell',
}

# ---- headers ---------------------------------------------------------------------------------------------------------------------
# Row-6 headers that stand alone (merged over rows 6 and 7). None = a known column the tracker does not keep.
TOP = [
    (r'no', 'no'), (r'person in charge', 'pic'), (r'bp02 mat approval', 'bp02'), (r'material code', 'code'),
    (r'description', 'description'), (r'location', 'location'), (r'image', 'image'), (r'approved sample', 'sample'),
    (r'specification', 'spec'), (r'brand', 'brand'), (r'source location', 'source'), (r'last updated', 'lastUpdated'),
    (r'pm team remarks', None), (r'updated on .*', None), (r'clarification .*', None),
]
# Row-6 group headers (merged across their columns) and the row-7 headers under them. The spellings are the workbooks' own.
GROUPS = [
    (r'material submi?ss?ion.*', [(r'plan submit date', 'msPlan'), (r'actual submit date', 'msActual'),
                                  (r'approved date', 'msApproved'), (r'status', 'msStatus')]),
    (r'sample submi?ss?ion', [(r'plan submit date', 'ssPlan'), (r'actual submit date', 'ssActual'), (r'approved date', 'ssApproved')]),
    (r'procu?re?ment', [(r'plan place order', 'poPlan'), (r'actual place order( date)?', 'poActual'), (r'plan arrived site', 'arrPlan'),
                        (r'act(ua|au)l arrived site', 'arrActual'), (r'remarks', 'procRemarks')]),
    (r'total quantity', [(r'unit', 'unit'), (r'total quantity ?\(by qs\)', 'total'), (r'po quantity ?\(by purchase\)', 'po'),
                         (r'approved shd quantity', 'shd'), (r'on site quantity', 'onsite'), (r'remaining quantity', 'remaining')]),
    (r'percentage \(%\)', [(r'not yet po', 'notYetPo'), (r'placed order', 'placed'), (r'production in progress?', 'production'),
                           (r'waiting for shipment', 'waiting'), (r'shipping on the way', 'shipping'),
                           (r'arrived? (wh|wharehourse|warehouse) ?(&|and) site', 'arrived')]),
]
REQUIRED = set(COL_KEYS) | set(CELLS) | set(PICTURE_COLS)

# ---- formula shapes --------------------------------------------------------------------------------------------------------------
# A formula's shape: '=' and spaces removed, upper case, every same-row reference replaced by {role}. These are the shapes seen in
# both workbooks, mapped to the app's formula keys (src/mat/types.ts FormulaKey).
SHAPES = {
    'IF(N({total})=0,"",1-{placed})': 'notYetPo',
    'IF(N({total})=0,"",IF(N({po})=0,0,MIN(1,{po}/{total})))': 'placedPoOverTotal',
    'IF(N({po})=0,"",IF(N({shd})=0,0,MIN(1,{shd}/{po})))': 'shdOverPo',
    'IF(N({total})=0,"",MAX(0,N({production})-N({shipping})-N({arrived})))': 'waiting',
    'IF(N({total})=0,"",MIN(1,N({onsite})/{total}))': 'arrived',
    '{total}-{onsite}': 'totalMinusOnsite',
    '{total}-N({onsite})': 'totalMinusOnsite',
    '{shd}-{onsite}': 'shdMinusOnsite',
    '{total}-{shd}': 'totalMinusShd',
}
REF = re.compile(r'(?<![A-Z0-9_.])\$?([A-Z]{1,3})\$?(\d+)(?![\d(!])')
SUBTOTAL = re.compile(r'^SUBTOTAL\(1,\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)\)$')
CONSTANT = re.compile(r'^[\d.+\-*/() ]+$')


class Failure(Exception):
    pass


# ---- the app's formula rules, copied from src/mat/formulas.ts --------------------------------------------------------------------
def n(value):
    """Excel N(): numbers pass, everything else is 0."""
    return value if is_number(value) and math.isfinite(value) else 0


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_text(value):
    return isinstance(value, str) and value != ''


def difference(left, right):
    return lambda get: None if is_text(get(left)) or is_text(get(right)) else n(get(left)) - n(get(right))


def total_minus_onsite(get):
    """Excel's =Y-N(AB): blank only when Total is text; text in On site counts as 0."""
    return None if is_text(get('total')) else n(get('total')) - n(get('onsite'))


def placed_po_over_total(get):
    total, po = n(get('total')), n(get('po'))
    return None if total == 0 else 0 if po == 0 else min(1, po / total)


def shd_over_po(get):
    po, shd = n(get('po')), n(get('shd'))
    return None if po == 0 else 0 if shd == 0 else min(1, shd / po)


def not_yet_po(get):
    placed = get('placed')
    return None if n(get('total')) == 0 or not is_number(placed) else 1 - placed


def waiting(get):
    return None if n(get('total')) == 0 else max(0, n(get('production')) - n(get('shipping')) - n(get('arrived')))


def arrived(get):
    total = n(get('total'))
    return None if total == 0 else min(1, n(get('onsite')) / total)


FORMULAS = {
    'placedPoOverTotal': placed_po_over_total,
    'shdOverPo': shd_over_po,
    'notYetPo': not_yet_po,
    'waiting': waiting,
    'arrived': arrived,
    'totalMinusOnsite': total_minus_onsite,
    'shdMinusOnsite': difference('shd', 'onsite'),
    'totalMinusShd': difference('total', 'shd'),
}


def effective(cells):
    """Every cell's value: the source value or its formula over the other effective values (no edits at import time)."""
    values, resolving = {}, set()

    def get(cell):
        if cell in values:
            return values[cell]
        if cell in resolving:
            return None  # a formula that depends on itself
        resolving.add(cell)
        source = cells.get(cell)
        if not source:
            value = None
        elif 'v' in source:
            value = source['v']
        else:
            result = FORMULAS[source['f']](get)
            value = result if result is not None and math.isfinite(result) else None
        resolving.discard(cell)
        values[cell] = value
        return value

    return {cell: get(cell) for cell in CELLS}


def section_items(rows, section):
    """The material rows a section covers: same sheet, pos in (section pos, data.end], else up to the next section."""
    end = section['data'].get('end')
    if end is None:
        later = [r['pos'] for r in rows if r['sheet'] == section['sheet'] and r['kind'] == 'section' and r['pos'] > section['pos']]
        end = min(later) - 1 if later else math.inf
    return [r for r in rows if r['kind'] == 'item' and r['sheet'] == section['sheet'] and section['pos'] < r['pos'] <= end]


def average(cells_list, cell):
    """Mean of the numeric effective values, as Excel's SUBTOTAL(1, ...); None when there are none."""
    numbers = [v for v in (effective(c)[cell] for c in cells_list) if is_number(v)]
    return sum(numbers) / len(numbers) if numbers else None


# ---- cell values -----------------------------------------------------------------------------------------------------------------
def clean(value, data_type=None):
    """A cell value as stored: dates as YYYY-MM-DD, text without trailing spaces, Excel errors and empty text as None."""
    if data_type == 'e':
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, timedelta):
        return str(value)
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, str):
        value = value.rstrip()
        return value or None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def as_text(value):
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def constant(body):
    """The value of arithmetic on number constants (=296+8), else None."""
    if not CONSTANT.match(body):
        return None
    try:
        tree = ast.parse(body, mode='eval')
    except SyntaxError:
        return None

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and is_number(node.value):
            return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = walk(node.operand)
            return value if isinstance(node.op, ast.UAdd) else -value
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
            left, right = walk(node.left), walk(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            return left / right
        raise ValueError(ast.dump(node))

    try:
        value = walk(tree)
    except (ValueError, ZeroDivisionError):
        return None
    return int(value) if isinstance(value, float) and value.is_integer() else value


def same(computed, cached):
    if computed is None or cached is None:
        return computed is None and cached is None
    if is_number(computed) and is_number(cached):
        return abs(computed - cached) <= TOLERANCE
    return computed == cached


def show(value):
    return 'blank' if value is None else repr(value)


# ---- sheets ----------------------------------------------------------------------------------------------------------------------
def norm(text):
    return re.sub(r'\s+', ' ', str(text)).strip().lower() if text is not None else ''


def hidden_columns(ws):
    """Column indexes hidden in the sheet. A grouped <col> entry hides every column in its range."""
    out = set()
    for key, dim in ws.column_dimensions.items():
        if not dim.hidden:
            continue
        first = dim.min or column_index_from_string(key)
        last = dim.max or first
        out.update(range(first, last + 1))
    return out


def hidden_rows(ws):
    """Row numbers hidden in the sheet."""
    return {int(getattr(dim, 'index', None) or key) for key, dim in ws.row_dimensions.items() if dim.hidden}


def find_columns(ws, where, hidden_cols=frozenset()):
    """{role: column index} from the header text in rows 6 and 7. Hidden columns are left out."""
    group_of = {}  # column -> (group text, is first column of the merge)
    for c in range(1, ws.max_column + 1):
        group_of[c] = (ws.cell(GROUP_ROW, c).value, True)
    for rng in ws.merged_cells.ranges:
        if rng.min_row <= GROUP_ROW <= rng.max_row and rng.max_col > rng.min_col:
            text = ws.cell(rng.min_row, rng.min_col).value
            for c in range(rng.min_col, rng.max_col + 1):
                group_of[c] = (text, c == rng.min_col)
    roles, ignored, hidden_roles = {}, [], set()
    for c in range(1, ws.max_column + 1):
        top, first = group_of[c]
        top, sub = norm(top), norm(ws.cell(SUB_ROW, c).value)
        letter = get_column_letter(c)
        if sub:
            subs = next((s for g, s in GROUPS if re.fullmatch(g, top)), None)
            if subs is None and not top:  # a group header left blank (BP04 MEP 'Total Quantity'): the row-7 text must be unambiguous
                subs = [(p, r) for _, s in GROUPS for p, r in s if re.fullmatch(p, sub)]
                subs = subs if len(subs) == 1 else None
            role = next((r for pattern, r in subs or [] if re.fullmatch(pattern, sub)), False)
            if role is False:
                raise Failure(f'{where}!{letter}{SUB_ROW}: unrecognised header {sub!r} under {top!r}')
        elif top and first:
            role = next((r for pattern, r in TOP if re.fullmatch(pattern, top)), False)
            if role is False:
                raise Failure(f'{where}!{letter}{GROUP_ROW}: unrecognised header {top!r}')
        else:
            role = None
        if c in hidden_cols:
            if role is not None:
                hidden_roles.add(role)
            continue
        if role is None:
            ignored.append(c)
            continue
        if role in roles:
            raise Failure(f'{where}!{letter}{GROUP_ROW}: second column for {role!r}')
        roles[role] = c
    missing = REQUIRED - set(roles) - hidden_roles
    if missing:
        raise Failure(f'{where}: no column found for {sorted(missing)}')
    return roles, ignored


def fill_key(cell):
    fill = cell.fill
    if getattr(fill, 'fill_type', None) != 'solid':
        return None
    color = fill.fgColor
    if color.type == 'rgb':
        return ('rgb', str(color.rgb).upper())
    if color.type == 'theme':
        return ('theme', color.theme, round(color.tint or 0, 4))
    if color.type == 'indexed':
        return ('indexed', color.indexed)
    return None


def legend(ws):
    """{fill: mark} from the legend in W1:W3 (the colour sits in W, or in V beside the text)."""
    marks = {}
    for row, mark in zip((1, 2, 3), MARKS):
        for col in ('W', 'V'):
            key = fill_key(ws[f'{col}{row}'])
            if key:
                marks[key] = mark
                break
    return marks if len(marks) == len(MARKS) else {}


def subtotal_range(formula, letter):
    """(first row, last row) of =IFERROR(SUBTOTAL(1,X9:X30),"") or =SUBTOTAL(1,X9:X30) over the cell's own column, else None."""
    body = formula[1:].replace(' ', '').upper()
    wrapped = re.fullmatch(r'IFERROR\((.*),""\)', body)
    m = SUBTOTAL.match(wrapped.group(1) if wrapped else body)
    if not m or not m.group(1) == m.group(3) == letter:
        return None
    return int(m.group(2)), int(m.group(4))


def shape(body, row, role_of):
    """The formula with its same-row references replaced by {role}; None when it refers elsewhere."""
    foreign = []

    def swap(m):
        col, r = m.group(1), int(m.group(2))
        role = role_of.get(col)
        if r != row or role is None:
            foreign.append(m.group(0))
            return m.group(0)
        return '{%s}' % role

    text = REF.sub(swap, body)
    return None if foreign else text


class Sheet:
    def __init__(self, pkg, title, key):
        self.pkg, self.title, self.key = pkg, title, key
        self.rows = []         # dicts: id, pos, kind, data
        self.checked = 0       # formula cells compared with Excel
        self.mismatches = []
        self.unknown = []
        self.kept = []         # KEEP_CACHED cells
        self.defaulted = 0     # empty percentage cells given the standard keys
        self.dropped = []      # stray quantity / percentage values on section rows
        self.warnings = []
        self.nested = 0        # sections that cover further sections
        self.nested_in = 0     # sections inside another section (level > 0)
        self.pictures = dict(written=0, reused=0, skipped=[], ignored=0, moved=[])
        self.item_rows = {}    # source row -> row dict, items only
        self.role_col = {}

    def where(self, coord):
        return f"{self.pkg} '{self.title}'!{coord}"

    def count(self, kind):
        return sum(1 for r in self.rows if r['kind'] == kind)


def read_material(pkg, wf, wv, title, legend_fallback):
    sheet = Sheet(pkg, title, MATERIAL_SHEETS[title])
    ws, vs = wf[title], wv[title]
    hidden_cols = hidden_columns(ws)
    hidden = hidden_rows(ws)
    roles, ignored = find_columns(ws, f"{pkg} '{title}'", hidden_cols)
    if hidden_cols:
        sheet.warnings.append(f"hidden columns skipped: {', '.join(get_column_letter(c) for c in sorted(hidden_cols))}")
    if hidden:
        sheet.warnings.append(f'{len(hidden)} hidden rows skipped')
    sheet.role_col = roles
    role_of = {get_column_letter(c): r for r, c in roles.items()}
    marks = legend(ws) or legend_fallback
    if not legend(ws):
        sheet.warnings.append('no legend colours in W1:W3 or V1:V3; used the other material sheet\'s legend' if marks else
                              'no legend colours found; no marks')
    max_row, max_col = ws.max_row, ws.max_column
    grid = {}
    for row in ws.iter_rows(min_row=FIRST_ROW, max_row=max_row, max_col=max_col):
        for c in row:
            grid[(c.row, c.column)] = c
    values = {}
    for row in vs.iter_rows(min_row=TOTAL_ROW, max_row=max_row, max_col=max_col):
        for c in row:
            values[(c.row, c.column)] = (c.value, c.data_type)
    for c in ignored:
        used = sum(1 for r in range(FIRST_ROW, max_row + 1) if clean(grid[(r, c)].value) is not None)
        if used:
            sheet.warnings.append(f'column {get_column_letter(c)} has no tracker header but {used} filled cells (left out)')

    pct_cols = [roles[k] for k in PCT_CELLS]
    empty_pct = all(grid[(r, c)].value in (None, '') for r in range(FIRST_ROW, max_row + 1) for c in pct_cols)
    if empty_pct:
        sheet.warnings.append('percentage group is empty: materials get the standard percentage formulas')

    def is_subtotal(value):
        return isinstance(value, str) and 'SUBTOTAL(' in value.upper()

    def numbered_section(value):
        """BP04 MEP Material has no SUBTOTAL rows, so its section rows are the ones numbered 1, 2, 3 (items are 1.1, 2.3)."""
        return empty_pct and re.fullmatch(r'\d+', str(clean(value) if clean(value) is not None else '')) is not None

    def label_only(at):
        """A numbered heading the workbook left without SUBTOTALs (BP03 ID '1.1.1 Miscellaneous', its name in the code column):
        a dotted number and a name, and nothing a material would carry (no description, quantity, percentage, date or detail)."""
        if not re.fullmatch(r'\d+(\.\d+)+', str(clean(at('no')) or '')) or clean(at('description')) is not None:
            return False
        return all(clean(at(k)) is None for k in LABEL_ONLY_EMPTY + CELLS)

    subtotals = []  # (coord, cell key, first row, last row, cached, section row or None for row 8)
    checks = []     # (coord, cell key, row data or None for a constant, cached, constant's value)
    for r in range(FIRST_ROW, max_row + 1):
        raw = {c: grid[(r, c)].value for c in range(1, max_col + 1)}
        if all(clean(v) is None for v in raw.values()):
            continue
        at = lambda role: raw[roles[role]] if role in roles else None
        pct_raw = [at(k) for k in PCT_CELLS]
        has_label = any(clean(at(k)) is not None for k in ('no', 'pic', 'bp02', 'code'))
        pct_sections = all(v in (None, '') or is_subtotal(v) for v in pct_raw)
        is_section = (clean(at('total')) is None and pct_sections and has_label and
                      (any(is_subtotal(v) for v in pct_raw)
                       or (clean(at('code')) is None and clean(at('description')) is None)
                       or (numbered_section(at('no')) and clean(at('description')) is None)
                       or label_only(at)))
        kind = 'section' if is_section else 'item'
        data = dict(cols={}, cells={})
        for key in COL_KEYS:
            if key not in roles:
                continue
            if key == 'pic' and sheet.key == 'mep':  # MEP sheets keep no Person In Charge
                continue
            c = roles[key]
            value = raw[c]
            if isinstance(value, str) and value.startswith('='):
                value = clean(*values[(r, c)])
            else:
                value = clean(value)
            if value is not None:
                data['cols'][key] = value
        notes = {}
        for key in CELLS:
            c = roles[key]
            coord = f'{get_column_letter(c)}{r}'
            value = raw[c]
            cached = clean(*values[(r, c)])
            if kind == 'section':
                if is_subtotal(value):
                    span = subtotal_range(value, get_column_letter(c))
                    if span:
                        subtotals.append((coord, key, *span, cached, r))
                    else:
                        sheet.unknown.append((coord, value))
                elif clean(value) is not None:
                    sheet.dropped.append(coord)
                continue
            if isinstance(value, str) and value.startswith('='):
                body = value[1:].replace(' ', '').upper()
                result = constant(body)
                if result is not None:
                    data['cells'][key] = {'v': result}
                    notes[key] = value
                    checks.append((coord, key, None, cached, result))
                    continue
                form = shape(body, r, role_of)
                formula = SHAPES.get(form) if form else None
                if formula:
                    data['cells'][key] = {'f': formula}
                    checks.append((coord, key, data, cached, None))
                elif (pkg, title, coord) in KEEP_CACHED:
                    data['cells'][key] = {'v': cached}
                    sheet.kept.append((coord, value, KEEP_CACHED[(pkg, title, coord)]))
                else:
                    sheet.unknown.append((coord, value))
            else:
                value = clean(value)
                if value is not None:
                    data['cells'][key] = {'v': value}
                elif empty_pct and key in DEFAULT_PCT:
                    data['cells'][key] = {'f': DEFAULT_PCT[key]}
                    sheet.defaulted += 1
        mark = marks.get(fill_key(grid[(r, roles['code'])]))
        if mark and kind == 'item':
            data['mark'] = mark
        if notes:
            data['notes'] = notes
        item = dict(id=f'{pkg}-{sheet.key}-{r:04d}', sheet=sheet.key, pos=r, kind=kind, data=data)
        if r in hidden:
            item['hidden'] = True
        sheet.rows.append(item)
        if kind == 'item':
            sheet.item_rows[r] = item

    # Row 8, the sheet total: checked like a section, not stored.
    for key in PCT_CELLS:
        c = roles[key]
        value = ws.cell(TOTAL_ROW, c).value
        if is_subtotal(value):
            coord = f'{get_column_letter(c)}{TOTAL_ROW}'
            span = subtotal_range(value, get_column_letter(c))
            if span:
                subtotals.append((coord, key, *span, clean(*values[(TOTAL_ROW, c)]), None))
            else:
                sheet.unknown.append((coord, value))

    # Self-check.
    for coord, key, data, cached, result in checks:
        computed = result if data is None else effective(data['cells'])[key]
        sheet.checked += 1
        if not same(computed, cached):
            label = 'constant' if data is None else data['cells'][key]['f']
            sheet.mismatches.append(f'{sheet.where(coord)}: {label} gives {show(computed)}, Excel has {show(cached)}')
    # Section extents: `end` from the SUBTOTAL ranges (clamped to the last data row), else the row before the next section;
    # `level` = how many other sections enclose this one.
    sections = [row for row in sheet.rows if row['kind'] == 'section']
    last_row = sheet.rows[-1]['pos'] if sheet.rows else FIRST_ROW
    for i, section in enumerate(sections):
        ends = {last for _, _, _, last, _, at in subtotals if at == section['pos']}
        if len(ends) > 1:
            sheet.unknown.append((f"row {section['pos']}", f'SUBTOTAL ranges end on different rows {sorted(ends)}'))
        if ends:
            end = min(max(ends), last_row)
        else:
            end = sections[i + 1]['pos'] - 1 if i + 1 < len(sections) else last_row
        section['data']['end'] = end
    for section in sections:
        level = sum(1 for other in sections if other is not section and other['pos'] < section['pos'] <= other['data']['end'])
        section['data']['level'] = level
        if level:
            sheet.nested_in += 1
        if any(section['pos'] < other['pos'] <= section['data']['end'] for other in sections):
            sheet.nested += 1
    # Section SUBTOTALs: the average of the material rows the section covers, as the app computes it (sectionItems).
    # Row 8, the sheet total: the average of the material rows in its own range.
    by_pos = {section['pos']: section for section in sections}
    for coord, key, first, last, cached, at in subtotals:
        if at is None:
            items = [row['data']['cells'] for r, row in sheet.item_rows.items() if first <= r <= last]
        else:
            items = [row['data']['cells'] for row in section_items(sheet.rows, by_pos[at])]
        computed = average(items, key)
        sheet.checked += 1
        if not same(computed, cached):
            sheet.mismatches.append(f'{sheet.where(coord)}: average of {len(items)} materials gives {show(computed)}, Excel has {show(cached)}')
    excluded = [
        (s['pos'], s['data']['end'])
        for s in sections
        if str(s['data']['cols'].get('code') or '').strip().upper() in EXCLUDED_SECTIONS
    ]

    def is_excluded(pos):
        return any(start <= pos <= end for start, end in excluded)

    # Hidden rows took part in the formula checks above (Excel's SUBTOTAL counts them) but stay out of the seed and the app.
    sheet.rows = [row for row in sheet.rows if not row.pop('hidden', False) and not is_excluded(row['pos'])]
    kept = {row['pos'] for row in sheet.rows}
    sheet.item_rows = {r: row for r, row in sheet.item_rows.items() if r in kept}
    # Levels over the rows that remain, so a dropped hidden section does not leave its children one level too deep.
    sections = [row for row in sheet.rows if row['kind'] == 'section']
    sheet.nested = sheet.nested_in = 0
    for section in sections:
        level = sum(1 for other in sections if other is not section and other['pos'] < section['pos'] <= other['data']['end'])
        section['data']['level'] = level
        if level:
            sheet.nested_in += 1
        if any(section['pos'] < other['pos'] <= section['data']['end'] for other in sections):
            sheet.nested += 1
    return sheet


def read_notes(pkg, wv, title):
    sheet = Sheet(pkg, title, NOTE_SHEETS[title])
    ws = wv[title]
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=ws.max_column):
        cells = [as_text(clean(c.value, c.data_type)) for c in row]
        while cells and cells[-1] == '':
            cells.pop()
        if not cells:
            continue
        r = row[0].row
        sheet.rows.append(dict(id=f'{pkg}-{sheet.key}-{r:04d}', sheet=sheet.key, pos=r, kind='note', data=dict(cols={}, cells={}, note=cells)))
    return sheet


def read_workbook(pkg, path):
    wf = openpyxl.load_workbook(path, data_only=False)
    wv = openpyxl.load_workbook(path, data_only=True)
    sheets = []
    visible = [t for t in wf.sheetnames if wf[t].sheet_state == 'visible']
    material = [t for t in visible if t in MATERIAL_SHEETS]
    if not material:
        raise Failure(f'{pkg}: no visible material sheet in {wf.sheetnames}')
    legends = [legend(wf[t]) for t in material]
    fallback = next((m for m in legends if m), {})
    for title in visible:
        if title in MATERIAL_SHEETS:
            sheets.append(read_material(pkg, wf, wv, title, fallback))
        elif title in NOTE_SHEETS:
            sheets.append(read_notes(pkg, wv, title))
    return sheets


# ---- pictures --------------------------------------------------------------------------------------------------------------------
NS = {
    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
}


def parse_xml(z, part):
    """A package part as XML. Untrusted input: a DOCTYPE (entity definitions) is refused rather than expanded."""
    data = z.read(part)
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise Failure(f'{part}: DOCTYPE in a drawing part; refusing to parse it')
    return ET.fromstring(data)


def rels(z, part):
    """{rId: (type, resolved part path)} for a part of the package."""
    folder, name = posixpath.split(part)
    path = posixpath.join(folder, '_rels', name + '.rels')
    if path not in z.namelist():
        return {}
    out = {}
    for rel in parse_xml(z, path).findall('rel:Relationship', NS):
        target = rel.get('Target')
        if rel.get('TargetMode') == 'External':
            continue
        target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(folder, target))
        out[rel.get('Id')] = (rel.get('Type', ''), target)
    return out


def anchored_pictures(z):
    """{sheet title: [(top row, bottom row, column, media part)]}, rows and columns 1-based, in drawing order."""
    workbook = 'xl/workbook.xml'
    book_rels = rels(z, workbook)
    out = {}
    for sheet in parse_xml(z, workbook).find('main:sheets', NS):
        title, rid = sheet.get('name'), sheet.get('{%s}id' % NS['r'])
        part = book_rels.get(rid, ('', ''))[1]
        pictures = []
        for kind, drawing in rels(z, part).values():
            if not kind.endswith('/drawing'):
                continue
            media = rels(z, drawing)
            for anchor in parse_xml(z, drawing):
                start = anchor.find('xdr:from', NS)
                if start is None:
                    continue  # absolute anchors belong to no cell
                row, col = int(start.findtext('xdr:row', namespaces=NS)) + 1, int(start.findtext('xdr:col', namespaces=NS)) + 1
                end = anchor.find('xdr:to', NS)
                last = max(row, int(end.findtext('xdr:row', namespaces=NS)) + 1) if end is not None else row
                for blip in anchor.iter('{%s}blip' % NS['a']):
                    target = media.get(blip.get('{%s}embed' % NS['r']), ('', None))[1]
                    if target:
                        pictures.append((row, last, col, target))
        out[title] = pictures
    return out


def thumbnail(data):
    """WebP bytes, at most THUMB_SIDE px on the long side."""
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        has_alpha = 'A' in image.getbands() or 'transparency' in image.info
        image = image.convert('RGBA' if has_alpha else 'RGB')
    long_side = max(image.size)
    if long_side > THUMB_SIDE:
        scale = THUMB_SIDE / long_side
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, 'WEBP', quality=THUMB_QUALITY, method=6)
    return buffer.getvalue()


def attach_pictures(pkg, path, sheets, folder):
    by_title = {s.title: s for s in sheets if s.title in MATERIAL_SHEETS}
    done = {}  # media part -> file name, or the reason it was skipped
    folder.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for title, pictures in anchored_pictures(z).items():
            sheet = by_title.get(title)
            if not sheet:
                continue
            column_role = {sheet.role_col[k]: k for k in PICTURE_COLS}
            for row, last, col, media in pictures:
                role = column_role.get(col)
                coord = f'{get_column_letter(col)}{row}'
                if not role:
                    sheet.pictures['ignored'] += 1
                    continue
                # The anchor row; when that is a section header the picture has slipped up from the material below it, so the
                # first material row the picture reaches.
                at = next((r for r in range(row, last + 1) if r in sheet.item_rows), None)
                if at is None:
                    sheet.pictures['skipped'].append(f'{coord} {posixpath.basename(media)}: not on a material row')
                    continue
                if at != row:
                    sheet.pictures['moved'].append(f'{coord} -> row {at}')
                item = sheet.item_rows[at]
                if media not in done:
                    try:
                        webp = thumbnail(z.read(media))
                    except Exception as error:  # untrusted input: any decoder failure skips the picture
                        done[media] = (None, f'{type(error).__name__}: {error}'[:120])
                    else:
                        name = hashlib.sha256(webp).hexdigest()[:16] + '.webp'
                        target = folder / name
                        if not target.exists() or target.read_bytes() != webp:
                            target.write_bytes(webp)
                            sheet.pictures['written'] += 1
                        else:
                            sheet.pictures['reused'] += 1
                        done[media] = (name, None)
                name, reason = done[media]
                if not name:
                    sheet.pictures['skipped'].append(f'{coord} {posixpath.basename(media)}: {reason}')
                    continue
                names = item['data'].setdefault('images', {}).setdefault(role, [])
                if name not in names:
                    names.append(name)
    for sheet in by_title.values():  # image before sample, whatever order the drawing had
        for item in sheet.item_rows.values():
            images = item['data'].pop('images', None)
            if images:
                item['data']['images'] = {k: images[k] for k in PICTURE_COLS if k in images}
                if 'notes' in item['data']:
                    item['data']['notes'] = item['data'].pop('notes')


# ---- SQL -------------------------------------------------------------------------------------------------------------------------
SAFE = re.compile(r'^[a-z0-9-]+$')
HEAD = 'insert into public.kw_mat_items (id, package, sheet, pos, kind, data) values\n'
TAIL = ('\non conflict (id) do update set package = excluded.package, sheet = excluded.sheet, pos = excluded.pos, '
        'kind = excluded.kind, data = excluded.data, hidden = false,\n'
        '  updated_at = case when (kw_mat_items.package, kw_mat_items.sheet, kw_mat_items.pos, kw_mat_items.kind, kw_mat_items.data)\n'
        '    is distinct from (excluded.package, excluded.sheet, excluded.pos, excluded.kind, excluded.data) then now()\n'
        '    else kw_mat_items.updated_at end\n'
        'where kw_mat_items.hidden\n'
        '  or (kw_mat_items.package, kw_mat_items.sheet, kw_mat_items.pos, kw_mat_items.kind, kw_mat_items.data)\n'
        '  is distinct from (excluded.package, excluded.sheet, excluded.pos, excluded.kind, excluded.data);\n')


def seed(sheets):
    rows = [(s.pkg, s.key, row) for s in sheets for row in s.rows]
    payloads = []
    for pkg, key, row in rows:
        text = json.dumps(row['data'], ensure_ascii=False)
        if '\\u0000' in text:
            raise Failure(f"{row['id']}: a NUL character, which jsonb cannot hold")
        payloads.append(text)
    digest = hashlib.sha256('\n'.join(payloads).encode('utf-8')).hexdigest()
    tag = next(t for t in (f'mat{digest[:10]}{i or ""}' for i in range(1000)) if not any(f'${t}$' in p for p in payloads))
    values = []
    for (pkg, key, row), payload in zip(rows, payloads):
        for text in (row['id'], pkg, key, row['kind']):
            assert SAFE.match(text), text
        values.append(f"('{row['id']}', '{pkg}', '{key}', {int(row['pos'])}, '{row['kind']}', ${tag}${payload}${tag}$::jsonb)")
    statements, chunk, size = [], [], len(HEAD) + len(TAIL)
    for value in values:
        length = len(value.encode('utf-8')) + 2
        if len(HEAD) + len(TAIL) + length > MAX_STATEMENT:
            raise Failure(f'one row is larger than {MAX_STATEMENT} bytes: {value[:40]}')
        if chunk and size + length > MAX_STATEMENT:
            statements.append(HEAD + ',\n'.join(chunk) + TAIL)
            chunk, size = [], len(HEAD) + len(TAIL)
        chunk.append(value)
        size += length
    if chunk:
        statements.append(HEAD + ',\n'.join(chunk) + TAIL)
    # A row that is hidden in the workbook, or inside a dropped section, is absent from this seed.
    # Keep the row for history but take it out of the app, matching the workbook.
    packages = sorted({pkg for pkg, _, _ in rows})
    package_sql = ', '.join("'" + p + "'" for p in packages)
    ids = ', '.join(f"'{row['id']}'" for _, _, row in rows)
    hide = (f'-- Rows the workbooks no longer show stay in the table but leave the app.\n'
            f'update public.kw_mat_items set hidden = true, updated_at = now()\n'
            f'where package in ({package_sql}) and not hidden\n'
            f'  and id not in ({ids});\n')
    if len(hide.encode('utf-8')) > MAX_STATEMENT:
        raise Failure(f'the hide statement is larger than {MAX_STATEMENT} bytes')
    header = ('-- Material tracker seed, generated by scripts/mat-import.py. Local only: never commit this file.\n'
              f'-- {len(values)} rows in {len(statements) + 1} statements. Upserts only; rows missing from the workbooks are hidden.\n')
    return header + 'begin;\n' + '\n'.join(statements) + hide + 'commit;\n', len(statements) + 1


# ---- main ------------------------------------------------------------------------------------------------------------------------
def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--bp03', type=Path)
    parser.add_argument('--bp04', type=Path)
    parser.add_argument('--sql', type=Path, required=True)
    parser.add_argument('--images', type=Path, default=Path('public/mat'))
    parser.add_argument('--no-images', action='store_true', help='skip pictures (the seed then has no picture names)')
    args = parser.parse_args(argv)
    sources = [(pkg, path) for pkg, path in (('bp03', args.bp03), ('bp04', args.bp04)) if path]
    if not sources:
        parser.error('give --bp03 and/or --bp04')

    sheets = []
    try:
        for pkg, path in sources:
            sheets.extend(read_workbook(pkg, path))
    except Failure as error:
        print('STOP', error)
        return 1

    failed = False
    for sheet in sheets:
        for coord, formula in sheet.unknown:
            print(f'UNKNOWN FORMULA {sheet.where(coord)}: {formula}')
            failed = True
        for line in sheet.mismatches:
            print('MISMATCH', line)
            failed = True
    if failed:
        print('Self-check failed: nothing written.')
        return 1

    if not args.no_images:
        try:
            for pkg, path in sources:
                attach_pictures(pkg, path, [s for s in sheets if s.pkg == pkg], args.images)
        except Failure as error:
            print('STOP', error)
            return 1

    total_bytes = 0
    for sheet in sheets:
        pictures = sheet.pictures
        line = (f"{sheet.pkg} {sheet.title}: rows {len(sheet.rows)}, sections {sheet.count('section')}, items {sheet.count('item')}, "
                f"notes {sheet.count('note')}, formula cells checked {sheet.checked}, mismatches {len(sheet.mismatches)}")
        if sheet.title in MATERIAL_SHEETS:
            line += (f", percentage cells defaulted {sheet.defaulted}, sections covering sub-sections {sheet.nested}, nested sections {sheet.nested_in}"
                     f", pictures written {pictures['written']} (already there {pictures['reused']}), skipped {len(pictures['skipped'])}"
                     f", outside the picture columns {pictures['ignored']}")
        print(line)
        for coord, formula, why in sheet.kept:
            print(f'  kept cached value {coord} {formula}: {why}')
        for coord in sheet.dropped:
            print(f'  left out a value on section row {coord}')
        for text in sheet.warnings:
            print('  note:', text)
        for text in pictures['skipped']:
            print('  picture skipped', text)
        for text in pictures['moved']:
            print('  picture anchored on a section row, given to the material below:', text)
    if not args.no_images:
        files = sorted(args.images.glob('*.webp'))
        total_bytes = sum(f.stat().st_size for f in files)
        print(f'{args.images}: {len(files)} files, {total_bytes} bytes')
    else:
        print('--no-images: the seed has no picture names; do not apply it over a seed that has them.')

    try:
        text, statements = seed(sheets)
    except Failure as error:
        print('STOP', error)
        return 1
    args.sql.parent.mkdir(parents=True, exist_ok=True)
    args.sql.write_bytes(text.encode('utf-8'))
    print(f'{args.sql}: {sum(len(s.rows) for s in sheets)} rows, {statements} statements, {len(text.encode("utf-8"))} bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
