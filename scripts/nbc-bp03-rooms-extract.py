"""Local-only: converts a BP03 or BP04 "WS Format" area workbook into the per-area activity dataset. Never connects to a database.

Usage: python scripts/nbc-bp03-rooms-extract.py SOURCE.xlsx [OUTPUT_DIRECTORY]
The project (nbc-bp03 / nbc-bp04) is read from the sheet names ("BP-03 (ID)" ...), so the same script covers both workbooks.

Two panels, like the BP02 floors, each with its own area columns:

    ID  panel -> section (I Setting Out ...)      -> task -> one editable leaf per area the task applies to
    MEP panel -> system (I Electrical ...) -> sub-system (1 Lighting ...) -> task -> one editable leaf per area

A cell the workbook marks N/A is a task that does not apply to that area: it gets no leaf at all.

The workbook's own overall figure is not a plain weighted sum of leaves (N/A cells drop out of every average, MEP areas feed
the ID areas through the Overall sheet, an AV zone has its own weight). It is however linear in the leaf values for a given
N/A pattern, so each leaf's `globalWeight` is the partial derivative of the workbook's Overall figure with respect to that
leaf. Every formula cell of the ID, MEP and Overall sheets is re-evaluated with the workbook's rules and compared with its
cached value; the residuals are written to reconciliation.json.
"""
import json
import math
from pathlib import Path
import re
import shutil
import sys

import openpyxl
from openpyxl.utils import get_column_letter

HANDLERS = ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Vuth', 'Tola']
ROMAN = re.compile(r'^[IVX]+$')
LINK = re.compile(r"^=\s*'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)$")
DEFAULTS = dict(description='', area='', location='', trade='', remark='', history=[], sourceWeekly=0, duration=None, boqValue=None, schedule=None, handler='')


class Lin:
    """A value that is linear in the leaf values: {leaf key: coefficient}."""
    __slots__ = ('c',)

    def __init__(self, c=None):
        self.c = dict(c or {})

    def __add__(self, other):
        out = dict(self.c)
        for k, v in other.c.items():
            out[k] = out.get(k, 0.0) + v
        return Lin(out)

    def __mul__(self, scalar):
        return Lin({k: v * scalar for k, v in self.c.items()})

    __rmul__ = __mul__

    def value(self, leaf):
        return sum(v * leaf[k] for k, v in self.c.items())


def lsum(parts):
    out = Lin()
    for p in parts:
        out = out + p
    return out


def wavg(pairs):
    """SUMPRODUCT(--ISNUMBER(x), w, x) / SUMPRODUCT(--ISNUMBER(x), w): None (= N/A) when nothing numeric carries weight."""
    pairs = [(w, v) for w, v in pairs if v is not None]
    total = sum(w for w, _ in pairs)
    if not pairs or total == 0:
        return None
    return lsum(v * (w / total) for w, v in pairs)


def mean(values):
    """AVERAGE over the numeric cells only; None (= N/A) when there are none."""
    values = [v for v in values if v is not None]
    if not values:
        return None
    return lsum(v * (1 / len(values)) for v in values)


def num(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def extract(source):
    formulas = openpyxl.load_workbook(source, data_only=False)
    values = openpyxl.load_workbook(source, data_only=True)
    names = formulas.sheetnames
    match = re.search(r'BP-0(\d) \(ID\)', ' '.join(names))
    assert match, names
    number = match.group(1)
    project_id = f'nbc-bp0{number}'
    prefix = project_id + ':'
    id_name, mep_name = f'BP-0{number} (ID)', f'BP-0{number} (MEP)'
    assert names[:3] == ['Overall Progress', id_name, mep_name] and names[3:] == HANDLERS, names
    errors = [(s.title, c.coordinate, c.value) for s in values for row in s for c in row if c.data_type == 'e']
    assert not errors, errors

    cached = {}  # (sheet, coordinate) -> cached value, for the reconciliation
    calc = {}    # (sheet, coordinate) -> Lin | None

    def cached_at(sheet, ref):
        return values[sheet][ref].value

    # ---- area columns --------------------------------------------------------------------------------------------------
    wid, wmep, wall = formulas[id_name], formulas[mep_name], formulas['Overall Progress']
    id_cols = [c for c in range(6, wid.max_column + 1) if wid.cell(4, c).value]
    mep_cols = [c for c in range(4, wmep.max_column + 1) if wmep.cell(4, c).value]
    id_labels = [str(wid.cell(4, c).value) for c in id_cols]
    mep_labels = [str(wmep.cell(4, c).value) for c in mep_cols]
    code = lambda label: label.split('\n')[0].strip()
    id_codes, mep_codes = [code(l) for l in id_labels], [code(l) for l in mep_labels]
    assert len(set(id_codes)) == len(id_codes) and len(set(mep_codes)) == len(mep_codes)
    zone = [float(wid.cell(5, c).value) for c in id_cols]
    av_codes = [c for c in id_codes if c == 'AV System']

    # ---- ID panel ------------------------------------------------------------------------------------------------------
    sections = []  # dict(item, name, weight, row, tasks=[...])
    for r in range(7, wid.max_row + 1):
        name = wid.cell(r, 2).value
        if name is None:
            continue
        item = wid.cell(r, 1).value
        if num(wid.cell(r, 4).value) is not None and wid.cell(r, 5).value is None:
            sections.append(dict(item=str(item).strip(), name=str(name).strip(), weight=num(wid.cell(r, 4).value), row=r, tasks=[]))
        else:
            weight = num(wid.cell(r, 5).value)
            assert weight is not None and sections, (r, name)
            cells = {}
            for i, c in enumerate(id_cols):
                v = wid.cell(r, c).value
                if v == 'N/A':
                    continue
                m = LINK.match(str(v)) if isinstance(v, str) else None
                assert m, (id_name, r, c, v)
                cells[id_codes[i]] = (m.group(1), m.group(2), int(m.group(3)))
            sections[-1]['tasks'].append(dict(name=str(name).strip(), weight=weight, row=r, cells=cells))

    # ---- MEP panel -----------------------------------------------------------------------------------------------------
    systems = []
    for r in range(5, wmep.max_row + 1):
        name = wmep.cell(r, 2).value
        if name is None:
            continue
        item = str(wmep.cell(r, 1).value).strip()
        weight = num(wmep.cell(r, 3).value)
        if ROMAN.match(item):
            systems.append(dict(item=item, name=str(name).strip(), row=r, subs=[], formula=str(wmep.cell(r, 4).value)))
        elif '.' not in item:
            systems[-1]['subs'].append(dict(item=item, name=str(name).strip(), weight=weight, row=r, tasks=[], formula=str(wmep.cell(r, 4).value)))
        else:
            cells = {}
            for i, c in enumerate(mep_cols):
                v = wmep.cell(r, c).value
                if v == 'N/A':
                    continue
                m = LINK.match(str(v)) if isinstance(v, str) else None
                assert m, (mep_name, r, c, v)
                cells[mep_codes[i]] = (m.group(1), m.group(2), int(m.group(3)))
            systems[-1]['subs'][-1]['tasks'].append(dict(item=item, name=str(name).strip(), weight=weight, row=r, cells=cells))

    # Which sub-systems each system averages (the BP03 AV sub-system is "not counted in ELV"), and which empty systems read 0.
    for system in systems:
        refs = re.findall(r'(?<![A-Z])D(\d+)', system['formula'])
        counted = {int(x) for x in refs}
        for sub in system['subs']:
            sub['counted'] = sub['row'] in counted
        zero_from = [mep_codes[i] for i, c in enumerate(mep_cols) if re.search(r',\s*0\)\s*$', str(wmep.cell(system['row'], c).value or ''))]
        system['zero'] = zero_from
        assert all(len(re.findall(r'\d+', str(wmep.cell(system['row'], c).value or ''))) for c in mep_cols[:1])

    # ---- Overall sheet: links, weights ----------------------------------------------------------------------------------
    def find_row(text, column=2):
        for r in range(1, wall.max_row + 1):
            if wall.cell(r, column).value and str(wall.cell(r, column).value).strip() == text:
                return r
        raise KeyError(text)
    mep_row = find_row('MEP System')
    first_system_row = mep_row + 1
    id_weight_row = mep_row - 1
    for r in range(1, wall.max_row + 1):
        pass
    # Weights of the two blocks: the numbers in column C on the block rows.
    block_rows = [r for r in range(7, wall.max_row + 1) if num(wall.cell(r, 3).value) is not None]
    assert len(block_rows) == 2, block_rows
    id_block_row, mep_block_row = block_rows
    assert mep_block_row == mep_row
    id_weight, mep_weight = num(wall.cell(id_block_row, 3).value), num(wall.cell(mep_block_row, 3).value)
    overall_cols = [c for c in range(5, wall.max_column + 1) if wall.cell(4, c).value]
    overall_ids = []
    for c in overall_cols:
        m = LINK.match(str(wall.cell(5, c).value))
        overall_ids.append(id_codes[id_cols.index(openpyxl.utils.column_index_from_string(m.group(2)))])
    links = {}
    for k, c in enumerate(overall_cols):
        spans = []
        for r in range(first_system_row, first_system_row + len(systems)):
            f = str(wall.cell(r, c).value)
            m = re.search(r"\(MEP\)'!\$?([A-Z]+)\$?\d+(?::\$?([A-Z]+)\$?\d+)?", f)
            assert m, (r, c, f)
            a = openpyxl.utils.column_index_from_string(m.group(1))
            b = openpyxl.utils.column_index_from_string(m.group(2) or m.group(1))
            spans.append(tuple(mep_codes[mep_cols.index(x)] for x in range(a, b + 1)))
        assert len(set(spans)) == 1, spans
        links[overall_ids[k]] = list(spans[0])
    av_row = None
    av_weight = None
    if av_codes:
        av_weight = zone[id_codes.index('AV System')]
        assert 'AV System' in str(wall.cell(find_row('AV System weight (BOQ R06)'), 2).value) or True
    # BP03 evaluates D7 with the AV zone outside the ID/MEP areas; BP04 simply adds the two blocks.
    simple_overall = re.match(r'^=D\d+\*\$C\$\d+\+D\d+\*\$C\$\d+$', str(wall['D7'].value)) is not None

    # ---- leaves ---------------------------------------------------------------------------------------------------------
    def read_handler(link, sheet_title, task_label):
        handler, col, row = link
        assert handler in HANDLERS, (task_label, link)
        cell = f'{col}{row}'
        raw = values[handler][cell].value
        assert raw is None or isinstance(raw, (int, float)), (task_label, link, raw)
        return handler, 0.0 if raw is None else float(raw)

    leaves = {}  # key -> dict(value, handler)
    for si, sec in enumerate(sections):
        for ti, task in enumerate(sec['tasks']):
            task['leaf'] = {}
            for area, link in task['cells'].items():
                key = ('ID', si, ti, area)
                handler, value = read_handler(link, id_name, task['name'])
                cell_cached = cached_at(id_name, f'{get_column_letter(id_cols[id_codes.index(area)])}{task["row"]}')
                assert abs(cell_cached - value) < 1e-12, (task['name'], area, cell_cached, value)
                leaves[key] = dict(value=value, handler=handler)
                task['leaf'][area] = key
    for yi, system in enumerate(systems):
        for bi, sub in enumerate(system['subs']):
            for ti, task in enumerate(sub['tasks']):
                task['leaf'] = {}
                for area, link in task['cells'].items():
                    key = ('MEP', yi, bi, ti, area)
                    handler, value = read_handler(link, mep_name, task['name'])
                    cell_cached = cached_at(mep_name, f'{get_column_letter(mep_cols[mep_codes.index(area)])}{task["row"]}')
                    assert abs(cell_cached - value) < 1e-12, (task['name'], area, cell_cached, value)
                    leaves[key] = dict(value=value, handler=handler)
                    task['leaf'][area] = key
        # one handler per task row
    for sec in sections:
        for task in sec['tasks']:
            hs = {leaves[k]['handler'] for k in task['leaf'].values()}
            assert len(hs) <= 1, (task['name'], hs)
    for system in systems:
        for sub in system['subs']:
            for task in sub['tasks']:
                hs = {leaves[k]['handler'] for k in task['leaf'].values()}
                assert len(hs) <= 1, (task['name'], hs)
    leaf_value = {k: v['value'] for k, v in leaves.items()}

    # ---- evaluation with the workbook's rules ---------------------------------------------------------------------------
    def reg(sheet, ref, lin):
        calc[(sheet, ref)] = lin

    id_letter = {code_: get_column_letter(c) for code_, c in zip(id_codes, id_cols)}
    mep_letter = {code_: get_column_letter(c) for code_, c in zip(mep_codes, mep_cols)}
    area_total, section_value = {}, {}
    for si, sec in enumerate(sections):
        for area in id_codes:
            cells = [(t['weight'], Lin({t['leaf'][area]: 1.0}) if area in t['leaf'] else None) for t in sec['tasks']]
            for t in sec['tasks']:
                reg(id_name, f'{id_letter[area]}{t["row"]}', Lin({t['leaf'][area]: 1.0}) if area in t['leaf'] else None)
            section_value[(si, area)] = wavg(cells)
            reg(id_name, f'{id_letter[area]}{sec["row"]}', section_value[(si, area)])
    for area in id_codes:
        v = wavg([(sec['weight'], section_value[(si, area)]) for si, sec in enumerate(sections)])
        area_total[area] = v if v is not None else Lin()
        reg(id_name, f'{id_letter[area]}6', area_total[area])
    for si, sec in enumerate(sections):
        for t in sec['tasks']:
            reg(id_name, f'C{t["row"]}', wavg([(zone[i], Lin({t['leaf'][a]: 1.0}) if a in t['leaf'] else None) for i, a in enumerate(id_codes)]))
        reg(id_name, f'C{sec["row"]}', wavg([(zone[i], section_value[(si, a)]) for i, a in enumerate(id_codes)]))
    id_total = lsum(area_total[a] * (zone[i] / sum(zone)) for i, a in enumerate(id_codes))
    reg(id_name, 'C6', id_total)

    sub_value, system_value = {}, {}
    for yi, system in enumerate(systems):
        for bi, sub in enumerate(system['subs']):
            for area in mep_codes:
                for t in sub['tasks']:
                    reg(mep_name, f'{mep_letter[area]}{t["row"]}', Lin({t['leaf'][area]: 1.0}) if area in t['leaf'] else None)
                v = wavg([(t['weight'] or 0.0, Lin({t['leaf'][area]: 1.0}) if area in t['leaf'] else None) for t in sub['tasks']])
                sub_value[(yi, bi, area)] = v
                reg(mep_name, f'{mep_letter[area]}{sub["row"]}', v)
        for area in mep_codes:
            v = mean([sub_value[(yi, bi, area)] for bi, sub in enumerate(system['subs']) if sub['counted']])
            if v is None and area in system['zero']:
                v = Lin()
            system_value[(yi, area)] = v
            reg(mep_name, f'{mep_letter[area]}{system["row"]}', v)

    # Overall sheet
    overall_letter = {a: get_column_letter(c) for a, c in zip(overall_ids, overall_cols)}
    zone_of = {a: zone[id_codes.index(a)] for a in overall_ids}
    guest, mep_sys = {}, {}
    for a in overall_ids:
        guest[a] = area_total[a]
        reg('Overall Progress', f'{overall_letter[a]}{id_block_row}', guest[a])
        per_system = []
        for yi, system in enumerate(systems):
            v = mean([system_value[(yi, m)] for m in links[a]])
            per_system.append(v)
            reg('Overall Progress', f'{overall_letter[a]}{first_system_row + yi}', v)
        mep_sys[a] = mean(per_system)
        reg('Overall Progress', f'{overall_letter[a]}{mep_block_row}', mep_sys[a])
    for si, sec in enumerate(sections):
        pass
    d_id = wavg([(zone_of[a], guest[a]) for a in overall_ids])
    d_mep = wavg([(zone_of[a], mep_sys[a]) for a in overall_ids])
    reg('Overall Progress', f'D{id_block_row}', d_id)
    reg('Overall Progress', f'D{mep_block_row}', d_mep)
    for yi, system in enumerate(systems):
        reg('Overall Progress', f'D{first_system_row + yi}', wavg([(zone_of[a], mean([system_value[(yi, m)] for m in links[a]])) for a in overall_ids]))
    if simple_overall:
        overall = d_id * id_weight + d_mep * mep_weight
        for a in overall_ids:
            reg('Overall Progress', f'{overall_letter[a]}7', guest[a] * id_weight + mep_sys[a] * mep_weight)
    else:
        z_sum = sum(zone_of.values())
        av_section = next(si for si, s in enumerate(sections) if all(set(t['cells']) <= {'AV System'} for t in s['tasks']) and s['tasks'])
        av_value = section_value[(av_section, 'AV System')]
        mep_term = d_mep if d_mep is not None else d_id
        overall = (((d_id * id_weight) + (mep_term * mep_weight)) * z_sum + av_value * av_weight) * (1 / (z_sum + av_weight))
        for a in overall_ids:
            reg('Overall Progress', f'{overall_letter[a]}7', guest[a] * id_weight + mep_sys[a] * mep_weight if mep_sys[a] is not None else guest[a])
        reg('Overall Progress', 'D24', av_value)
    reg('Overall Progress', 'D7', overall)
    for si, sec in enumerate(sections):
        row = next((r for r in range(8, mep_block_row) if str(wall.cell(r, 2).value or '').strip() == sec['name']), None)
        if row is None:  # the BP03 AV section lives outside the area grid (Overall!D24)
            continue
        for a in overall_ids:
            reg('Overall Progress', f'{overall_letter[a]}{row}', section_value[(si, a)])
        reg('Overall Progress', f'D{row}', wavg([(zone_of[a], section_value[(si, a)]) for a in overall_ids]))

    # ---- reconciliation: every evaluated cell against the workbook's cached value ---------------------------------------
    worst, checked, mismatches = 0.0, 0, []
    for (sheet, ref), lin in calc.items():
        cv = values[sheet][ref].value
        if lin is None:
            ok = cv == 'N/A'
            diff = 0.0 if ok else math.inf
        else:
            diff = abs(lin.value(leaf_value) - cv) if isinstance(cv, (int, float)) else math.inf
        checked += 1
        worst = max(worst, diff if diff != math.inf else 1e9)
        if diff > 1e-9:
            mismatches.append(dict(sheet=sheet, cell=ref, cached=cv, app=None if lin is None else lin.value(leaf_value)))
    workbook_overall = values['Overall Progress']['D7'].value
    app_overall = overall.value(leaf_value)

    # ---- activities -----------------------------------------------------------------------------------------------------
    activities, order = [], [0]

    def add(wbs, parent, name, **fields):
        order[0] += 1
        node = dict(id=prefix + wbs, wbs=wbs, parentId=prefix + parent if parent else None, order=order[0], name=name, editable=False)
        node.update(fields)
        activities.append(node)
        return node

    panels = [
        ('1', 'ID', id_codes, id_labels, id_weight, zone),
        ('2', 'MEP', mep_codes, mep_labels, mep_weight, None),
    ]
    gw = {}
    for key in leaves:
        gw[key] = overall.c.get(key, 0.0)
    leaf_nodes = []

    def leaf(parent_node, key, area, area_index, rel, section_name, panel):
        parent_node['_n'] = parent_node.get('_n', 0) + 1
        wbs = f"{parent_node['wbs']}.{parent_node['_n']}"
        node = add(wbs, parent_node['wbs'], area, room=area, editable=True, relativeWeight=rel, globalWeight=gw[key], progress=leaves[key]['value'],
                   handler=leaves[key]['handler'], area=panel, location=area, trade=section_name)
        leaf_nodes.append(node)
        return node

    children_of = {}
    id_root = add('1', None, 'ID', panel='ID', area='ID', roomList=id_codes, relativeWeight=id_weight, globalWeight=0, progress=0,
                  zone=zone, links=links, **({'roomLabels': id_labels}))
    mep_root = add('2', None, 'MEP', panel='MEP', area='MEP', roomList=mep_codes, relativeWeight=mep_weight, globalWeight=0, progress=0,
                   roomLabels=mep_labels)
    id_root['_n'] = 0
    mep_root['_n'] = 0
    for si, sec in enumerate(sections):
        id_root['_n'] += 1
        snode = add(f"1.{id_root['_n']}", '1', sec['name'], item=sec['item'], area='ID', relativeWeight=sec['weight'], globalWeight=0, progress=0, trade=sec['name'])
        snode['_n'] = 0
        na = []
        for ti, task in enumerate(sec['tasks']):
            if not task['cells']:
                na.append(dict(name=task['name'], weight=task['weight'], at=ti))
                continue
            snode['_n'] += 1
            tnode = add(f"{snode['wbs']}.{snode['_n']}", snode['wbs'], task['name'], area='ID', relativeWeight=task['weight'], globalWeight=0, progress=0, trade=sec['name'])
            tnode['_n'] = 0
            for area in id_codes:
                if area in task['leaf']:
                    leaf(tnode, task['leaf'][area], area, id_codes.index(area), zone[id_codes.index(area)], sec['name'], 'ID')
        if na:
            snode['naTasks'] = na
    for yi, system in enumerate(systems):
        mep_root['_n'] += 1
        ynode = add(f"2.{mep_root['_n']}", '2', system['name'], item=system['item'], area='MEP', relativeWeight=1, globalWeight=0, progress=0, trade=system['name'])
        ynode['_n'] = 0
        if system['zero']:
            ynode['emptyZero'] = system['zero']
        for bi, sub in enumerate(system['subs']):
            ynode['_n'] += 1
            bnode = add(f"{ynode['wbs']}.{ynode['_n']}", ynode['wbs'], sub['name'], item=sub['item'], area='MEP', relativeWeight=(sub['weight'] if sub['weight'] is not None else 1) if sub['counted'] else 0,
                        globalWeight=0, progress=0, trade=system['name'])
            if not sub['counted']:
                bnode['uncounted'] = True
            bnode['_n'] = 0
            for ti, task in enumerate(sub['tasks']):
                if not task['cells']:
                    raise SystemExit(f'MEP task without any area: {task["name"]}')
                bnode['_n'] += 1
                tnode = add(f"{bnode['wbs']}.{bnode['_n']}", bnode['wbs'], task['name'], item=task['item'], area='MEP', relativeWeight=task['weight'], globalWeight=0, progress=0, trade=system['name'])
                tnode['_n'] = 0
                for area in mep_codes:
                    if area in task['leaf']:
                        leaf(tnode, task['leaf'][area], area, mep_codes.index(area), 1, system['name'], 'MEP')

    # Roll the tree up with the app's own rule (relative-weight average of the children; leaves keep their value) so stored
    # group progress agrees with what the app recomputes.
    by_id = {a['id']: a for a in activities}
    kids = {}
    for a in activities:
        kids.setdefault(a['parentId'], []).append(a)

    def settle(a):
        cs = kids.get(a['id'], [])
        if not cs:
            return a['progress']
        weight = sum(c['relativeWeight'] for c in cs)
        a['progress'] = sum(c['relativeWeight'] * settle(c) for c in cs) / weight if weight else 0.0
        a['globalWeight'] = sum(c['globalWeight'] for c in cs)
        return a['progress']

    for root in kids[None]:
        settle(root)
    # Drop groups left without leaves (cannot be edited, would break the editable rule).
    for a in list(activities):
        if not a['editable'] and not kids.get(a['id']):
            raise SystemExit(f'Group without leaves: {a["wbs"]} {a["name"]}')
    leaves_out = [a for a in activities if a['editable']]
    total_weight = sum(a['globalWeight'] for a in leaves_out)
    app_sum = sum(a['globalWeight'] * a['progress'] for a in leaves_out)
    assert abs(app_sum - app_overall) < 1e-12, (app_sum, app_overall)
    handler_counts = {h: sum(1 for a in leaves_out if a['handler'] == h) for h in HANDLERS}
    assert all(handler_counts.values()), handler_counts
    for a in activities:
        for k in [k for k in a if k.startswith('_')]:
            del a[k]
        a.pop('kind', None)

    def tidy(x):
        if isinstance(x, float):
            return float(f'{x:.12g}')
        if isinstance(x, list):
            return [tidy(i) for i in x]
        if isinstance(x, dict):
            return {k: tidy(v) for k, v in x.items()}
        return x

    # Stored compactly (Supabase egress): defaults, `baseline` and `sourcePrevious` (both equal `progress` here) and the group
    # labels the matrix does not use are left out; the app restores them when it reads a row (src/nbc/normalize.ts).
    compact = []
    for a in activities:
        a = tidy(a)
        for key, default in DEFAULTS.items():
            if key in a and a[key] == default:
                del a[key]
        if not a['editable']:
            a.pop('trade', None)
        a.pop('baseline', None)
        a.pop('sourcePrevious', None)
        compact.append(a)
    project = dict(id=project_id, name=f'NBC BP0{number} – Pan Pacific Hotel', workspace='team', color='blue', description=f'NBC BP0{number} · ID and MEP areas',
                   target='', status='Active', progress=app_overall, nbcBp03=True)
    reconciliation = dict(project=project_id, nodes=len(activities), leaves=len(leaves_out), handlers=handler_counts, totalLeafWeight=total_weight,
                          overall=app_sum, workbookOverall=workbook_overall, overallDelta=app_sum - workbook_overall,
                          idBlock=d_id.value(leaf_value) if d_id else None, mepBlock=d_mep.value(leaf_value) if d_mep else None,
                          cellsChecked=checked, worstCellDelta=worst, mismatches=mismatches,
                          naOnlyTasks=[dict(section=a['name'], tasks=a['naTasks']) for a in activities if a.get('naTasks')],
                          emptyZero=[dict(system=a['name'], areas=a['emptyZero']) for a in activities if a.get('emptyZero')],
                          uncounted=[a['name'] for a in activities if a.get('uncounted')],
                          note='globalWeight = d(Overall)/d(leaf); the leaf weights do not sum to 1 because N/A cells and zero-filled systems remove weight, as in the workbook.')
    return dict(project=project, activities=compact, reconciliation=reconciliation, projectId=project_id)


if __name__ == '__main__':
    source = Path(sys.argv[1])
    dataset = extract(source)
    pid = dataset.pop('projectId')
    output = Path(sys.argv[2] if len(sys.argv) > 2 else f'.private/{pid}-rooms')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'initial.json').write_text(json.dumps(dataset, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    shutil.copyfile(source, output / 'template.xlsx')  # the staging SQL stores it; the area report itself needs no template
    rec = dataset['reconciliation']
    (output / 'reconciliation.json').write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in rec.items() if k not in ('mismatches',)}, indent=2, ensure_ascii=False))
    print(len(rec['mismatches']), 'mismatching cells')
    for m in rec['mismatches'][:20]:
        print('  ', m)
    print('initial.json', (output / 'initial.json').stat().st_size, 'bytes')
