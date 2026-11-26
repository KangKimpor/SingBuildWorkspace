"""Tests for scripts/mat-import.py. Builds small made-up BP03 and BP04 workbooks in a temp folder and runs the importer on them.

Usage: python scripts/mat-import.test.py
Requires openpyxl and Pillow, like the importer. openpyxl writes formulas without cached values, so the fixture writes Excel's
cached results into the sheet XML afterwards, the way Excel would have saved them.
"""
from datetime import datetime
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
import zipfile

import openpyxl
from openpyxl.drawing.image import Image as XlImage
from openpyxl.drawing.spreadsheet_drawing import AnchorMarker, TwoCellAnchor
from openpyxl.styles import PatternFill
from PIL import Image

SCRIPT = Path(__file__).with_name('mat-import.py')
GREEN, BEIGE, YELLOW = 'FFC6EFCE', 'FFFCE4D6', 'FFFFFF00'
ROW_RE = re.compile(r"\('(bp0\d-[a-z]+-\d{4})', '(\w+)', '(\w+)', (\d+), '(\w+)', \$(\w*)\$(.*?)\$\6\$::jsonb\)", re.S)

PLACED = '=IF(N(Y{r})=0,"",IF(N(Z{r})=0,0,MIN(1,Z{r}/Y{r})))'
NOT_YET = '=IF(N(Y{r})=0,"",1-{placed}{r})'
WAITING = '=IF(N(Y{r})=0,"",MAX(0,N({prod}{r})-N({ship}{r})-N({arr}{r})))'
ARRIVED = '=IF(N(Y{r})=0,"",MIN(1,N(AB{r})/Y{r}))'
SHD_OVER_PO = '=IF(N(Z{r})=0,"",IF(N(AA{r})=0,0,MIN(1,AA{r}/Z{r})))'
SUBTOTAL = '=IFERROR(SUBTOTAL(1,{c}{a}:{c}{b}),"")'
ERROR = object()  # a cached #VALUE!


def headers(ws, pct, extra=()):
    """Rows 6 and 7 as in the real workbooks; `pct` are the six percentage columns, `extra` the columns in front of them."""
    ws['W1'], ws['W2'], ws['W3'] = 'Highlight - Green --> Completed', 'Highlight - Beige --> On Tracking', 'Highlight - Yellow --> Omit'
    for cell, color in (('W1', GREEN), ('W2', BEIGE), ('W3', YELLOW)):
        ws[cell].fill = PatternFill('solid', fgColor=color)
    top = dict(A='No', B='Person In Charge', C='BP02 MAT APPROVAL', D='Material Code ', E='Description ', F='Location ', G='Image ',
               H='Approved Sample  ', I='Specification ', J='Brand ', K='Source Location ', L='Material Submision\n(Technical Submission)',
               P='Sample Submision ', S='Procurment ', X='Total Quantity ', AE='PM TEAM REMARKS')
    for col, text in top.items():
        ws[f'{col}6'] = text
    sub = dict(L='Plan Submit Date', M='Actual Submit Date ', N='Approved Date ', O='Status', P='Plan Submit Date', Q='Actual Submit Date ',
               R='Approved Date ', S='Plan Place Order', T='Actual Place Order', U='Plan Arrived site ', V='Actaul Arrived site ', W='Remarks',
               X='Unit ', Y='Total Quantity\n(By QS)', Z='PO Quantity\n(By Purchase)', AA='Approved SHD Quantity', AB='On site Quantity ',
               AC='Remaining Quantity ')
    for col, text in sub.items():
        ws[f'{col}7'] = text
    for col, text in extra:
        ws[f'{col}6'] = text
    ws[f'{pct[0]}6'] = 'PERCENTAGE (%)'
    for col, text in zip(pct, ('NOT YET PO', 'PLACED ORDER', 'PRODUCTION IN PROGRES', 'WAITING FOR SHIPMENT', 'SHIPPING ON THE WAY', 'ARRIVED WH & SITE')):
        ws[f'{col}7'] = text
    last = openpyxl.utils.get_column_letter(openpyxl.utils.column_index_from_string(pct[-1]) + 1)
    ws[f'{last}6'] = 'LAST UPDATED'
    for rng in ('L6:O6', 'P6:R6', 'S6:W6', 'X6:AC6', f'{pct[0]}6:{pct[-1]}6'):
        ws.merge_cells(rng)


def id_sheet(ws, cached):
    """A section and three materials: a standard one, one with text in Total, one with a typed percentage."""
    pct = ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK']
    headers(ws, pct)
    f, prod, ship, arr = dict(placed='AG'), 'AH', 'AJ', 'AK'
    rows = {
        10: dict(A=2, B='Alice', D='WF-01', E='Test panel', L=datetime(2026, 1, 5), O='Approved   ', X='m2', Y=100, Z=50, AA=40, AB=20,
                 AC=('=Y10-AB10', 80), AF=(NOT_YET, 0.5), AG=(PLACED, 0.5), AH=0.3, AI=(WAITING, max(0, 0.3 - 0 - 0.2)), AJ=0, AK=(ARRIVED, 0.2)),
        11: dict(A=3, D='WF-02', Y='Not in the BOQ', AC=('=Y11-AB11', ERROR), AF=(NOT_YET, ''), AG=(PLACED, ''), AI=(WAITING, ''),
                 AK=(ARRIVED, '')),
        12: dict(A=4, D='WF-03', Y=('=296+8', 304), Z=304, AA=0, AC=('=Y12-N(AB12)', 304), AF=(NOT_YET, 0.75), AG=0.25,
                 AH=(SHD_OVER_PO, 0), AI=(WAITING, 0), AK=(ARRIVED, 0)),
    }
    ws['A8'], ws['A9'], ws['D9'] = 'ID Material ', 1, 'Wall Finishing'
    for r, cells in rows.items():
        for col, value in cells.items():
            formula, value = value if isinstance(value, tuple) else (None, value)
            if formula:
                ws[f'{col}{r}'] = formula.format(r=r, prod=prod, ship=ship, arr=arr, **f)
                cached[f'{col}{r}'] = value
            else:
                ws[f'{col}{r}'] = value
    ws['D10'].fill = PatternFill('solid', fgColor=GREEN)
    ws['D12'].fill = PatternFill('solid', fgColor=YELLOW)
    averages = dict(AF=(0.5 + 0.75) / 2, AG=(0.5 + 0.25) / 2, AH=(0.3 + 0) / 2, AI=(max(0, 0.3 - 0 - 0.2) + 0) / 2, AJ=0, AK=(0.2 + 0) / 2)
    for col in pct:
        for r, (a, b) in ((8, (9, 12)), (9, (10, 12))):
            ws[f'{col}{r}'] = SUBTOTAL.format(c=col, a=a, b=b)
            cached[f'{col}{r}'] = averages[col]


def mep_sheet(ws, cached, pct, extra=(), with_pct=True):
    headers(ws, pct, extra)
    ws['A8'], ws['A9'] = 'MEPMaterial ', 'ACMV SYSTEM'
    ws['A10'], ws['B10'], ws['D10'], ws['E10'], ws['Y10'], ws['Z10'], ws['AB10'] = '=A9', 'Bob', 'AC-01', 'Test duct', 10, 5, 2
    ws['AC10'] = '=Y10-AB10'
    cached.update(A10='ACMV SYSTEM', AC10=8)
    if with_pct:
        p = dict(zip(('notYet', 'placed', 'prod', 'wait', 'ship', 'arr'), pct))
        ws[f'{p["notYet"]}10'] = NOT_YET.format(r=10, placed=p['placed'])
        ws[f'{p["placed"]}10'] = PLACED.format(r=10)
        ws[f'{p["wait"]}10'] = WAITING.format(r=10, prod=p['prod'], ship=p['ship'], arr=p['arr'])
        ws[f'{p["arr"]}10'] = ARRIVED.format(r=10)
        cached.update({f'{p["notYet"]}10': 0.5, f'{p["placed"]}10': 0.5, f'{p["wait"]}10': 0, f'{p["arr"]}10': 0.2})
        for col in pct:
            ws[f'{col}9'] = SUBTOTAL.format(c=col, a=10, b=10)
            cached[f'{col}9'] = {p['notYet']: 0.5, p['placed']: 0.5, p['wait']: 0, p['arr']: 0.2}.get(col, '')


def note_sheet(ws, title):
    ws['A1'] = title
    ws['A4'], ws['B4'], ws['C4'], ws['D4'], ws['E4'] = 'Row', 'Material', 'Column', 'Old value', 'New value'
    ws['A5'], ws['B5'], ws['C5'], ws['E5'] = 104, 'WF-01', 'O', 'Approved  '


def inject_cached(path, cached_by_sheet):
    """Write Excel's cached formula results into the saved workbook (openpyxl leaves them empty)."""
    src = zipfile.ZipFile(path)
    files = {n: src.read(n) for n in src.namelist()}
    src.close()
    for sheet_file, cached in cached_by_sheet.items():
        xml = files[sheet_file].decode('utf-8')
        for coord, value in cached.items():
            if value is ERROR:
                t, v = 'e', '#VALUE!'
            elif isinstance(value, str):
                t, v = 'str', value
            else:
                t, v = 'n', repr(float(value))
            pattern = re.compile(r'<c r="%s"([^>]*)><f>(.*?)</f><v(?:\s*/>|></v>)' % coord)
            xml, count = pattern.subn(lambda m: '<c r="%s"%s t="%s"><f>%s</f><v>%s</v>' % (coord, re.sub(r' t="\w+"', '', m.group(1)), t, m.group(2), v), xml)
            assert count == 1, (sheet_file, coord)
        files[sheet_file] = xml.encode('utf-8')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as out:
        for name, data in files.items():
            out.writestr(name, data)


def png(color, size=(800, 400)):
    buffer = io.BytesIO()
    Image.new('RGB', size, color).save(buffer, 'PNG')
    buffer.seek(0)
    return buffer


def build(folder, pkg, change=None, pictures=False):
    """A made-up workbook for `pkg`; `change(ws_by_title, cached_by_title)` edits it before it is saved."""
    wb = openpyxl.Workbook()
    ids, meps = wb.active, wb.create_sheet('MEP Material')
    ids.title = 'ID Material'
    wb.create_sheet('Summary')['A1'] = 'Summary'
    notes = wb.create_sheet('Change Log' if pkg == 'bp03' else 'Review')
    cached = {'ID Material': {}, 'MEP Material': {}}
    id_sheet(ids, cached['ID Material'])
    if pkg == 'bp03':
        mep_sheet(meps, cached['MEP Material'], ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK'])
    else:
        extra = (('AE', 'UPDATED ON 1-5 June 2026'), ('AF', 'UPDATED ON 8-12 June 2026'), ('AG', 'UPDATED ON 13-18 Jul 2026'),
                 ('AH', 'CLARIFICATION RESPOND FROM CONCERNED DEPARTMENTS'))
        mep_sheet(meps, cached['MEP Material'], ['AI', 'AJ', 'AK', 'AL', 'AM', 'AN'], extra, with_pct=False)
    note_sheet(notes, f'{pkg.upper()} notes')
    if pictures:
        for anchor, color in (('G10', 'red'), ('H10', 'blue'), ('H11', 'blue'), ('AE10', 'green')):
            image = XlImage(png(color))
            ids.add_image(image, anchor)
        # Starts a little way into the section row 9 and mostly covers material row 10, as some real pictures do.
        slipped = XlImage(png('yellow'))
        slipped.anchor = TwoCellAnchor(_from=AnchorMarker(col=6, row=8, rowOff=400000), to=AnchorMarker(col=6, row=9, rowOff=1400000))
        ids.add_image(slipped)
    if change:
        change(wb, cached)
    path = Path(folder) / f'{pkg}.xlsx'
    wb.save(path)
    inject_cached(path, {f'xl/worksheets/sheet{i}.xml': cached[t] for i, t in ((1, 'ID Material'), (2, 'MEP Material'))})
    return path


def run(folder, *extra, change03=None, change04=None, pictures=False, images=True):
    folder = Path(folder)
    bp03 = build(folder, 'bp03', change03, pictures)
    bp04 = build(folder, 'bp04', change04)
    sql = folder / 'seed.sql'
    args = [sys.executable, '-I', str(SCRIPT), '--bp03', str(bp03), '--bp04', str(bp04), '--sql', str(sql), '--images', str(folder / 'mat')]
    if not images:
        args.append('--no-images')
    done = subprocess.run(args + list(extra), capture_output=True, text=True, encoding='utf-8')
    return done, sql


def rows(sql_text):
    return {m.group(1): dict(package=m.group(2), sheet=m.group(3), pos=int(m.group(4)), kind=m.group(5), data=json.loads(m.group(7)))
            for m in ROW_RE.finditer(sql_text)}


class ImporterTest(unittest.TestCase):
    def test_seed_holds_sections_items_and_notes(self):
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            text = sql.read_text(encoding='utf-8')
            for item_id in ('bp03-id-0010', 'bp03-id-0011', 'bp03-id-0012'):
                self.assertIn(f"'{item_id}'", text)
            self.assertIn('"f": "placedPoOverTotal"', text)
            self.assertIn('"v": "Not in the BOQ"', text)
            self.assertNotIn('edits', text)
            self.assertIn('on conflict (id) do update set', text)
            self.assertIn('is distinct from', text)
            self.assertIn('update public.kw_mat_items set hidden = true', text)
            self.assertNotIn('delete', text.lower())
            got = rows(text)
            self.assertEqual(got['bp03-id-0009']['kind'], 'section')
            self.assertEqual((got['bp03-id-0009']['data']['end'], got['bp03-id-0009']['data']['level']), (12, 0))  # SUBTOTAL(1,AF10:AF12)
            self.assertNotIn('end', got['bp03-id-0010']['data'])
            self.assertNotIn('bp03-id-0008', got)  # the sheet total row
            standard = got['bp03-id-0010']['data']
            self.assertEqual(standard['cols']['code'], 'WF-01')
            self.assertEqual(standard['cols']['msPlan'], '2026-01-05')
            self.assertEqual(standard['cols']['msStatus'], 'Approved')
            self.assertEqual(standard['mark'], 'done')
            self.assertEqual(standard['cells']['total'], {'v': 100})
            self.assertEqual(standard['cells']['remaining'], {'f': 'totalMinusOnsite'})
            self.assertEqual(standard['cells']['production'], {'v': 0.3})
            self.assertEqual(standard['cells']['waiting'], {'f': 'waiting'})
            typed = got['bp03-id-0012']['data']
            self.assertEqual(typed['cells']['placed'], {'v': 0.25})
            self.assertEqual(typed['cells']['production'], {'f': 'shdOverPo'})
            self.assertEqual(typed['cells']['total'], {'v': 304})
            self.assertEqual(typed['notes']['total'], '=296+8')
            self.assertEqual(typed['mark'], 'omit')
            self.assertNotIn('mark', got['bp03-id-0011']['data'])
            mep = got['bp04-mep-0010']['data']['cells']
            self.assertEqual((mep['notYetPo'], mep['placed'], mep['waiting'], mep['arrived']),
                             ({'f': 'notYetPo'}, {'f': 'placedPoOverTotal'}, {'f': 'waiting'}, {'f': 'arrived'}))
            self.assertNotIn('production', mep)
            self.assertEqual(got['bp04-mep-0009']['kind'], 'section')
            self.assertEqual((got['bp04-mep-0009']['data']['end'], got['bp04-mep-0009']['data']['level']), (10, 0))  # no SUBTOTAL: last data row
            self.assertEqual(got['bp03-mep-0010']['data']['cols']['no'], 'ACMV SYSTEM')  # other formulas keep their cached value
            note = got['bp03-changelog-0005']
            self.assertEqual((note['kind'], note['sheet'], note['data']['note']), ('note', 'changelog', ['104', 'WF-01', 'O', '', 'Approved']))
            self.assertEqual(got['bp04-review-0001']['data']['note'], ['BP04 notes'])

    def test_nested_sections_carry_their_extent(self):
        """Row 9 becomes a parent covering rows 10 to 14; row 13 is a sub-section over row 14."""
        def change(wb, cached):
            ws, c = wb['ID Material'], cached['ID Material']
            ws['D13'] = 'Sub section'
            typed = dict(AF=0, AG=1, AH=1, AI=0, AJ=0, AK=0.5)
            ws['D14'], ws['Y14'], ws['Z14'] = 'WF-04', 10, 10
            for col, value in typed.items():
                ws[f'{col}14'] = value
            parent = dict(AF=(0.5 + 0.75 + 0) / 3, AG=(0.5 + 0.25 + 1) / 3, AH=(0.3 + 0 + 1) / 3,
                          AI=(max(0, 0.3 - 0 - 0.2) + 0 + 0) / 3, AJ=0, AK=(0.2 + 0 + 0.5) / 3)
            for col in typed:
                ws[f'{col}13'] = SUBTOTAL.format(c=col, a=14, b=14)
                c[f'{col}13'] = typed[col]
                for r in (8, 9):
                    ws[f'{col}{r}'] = SUBTOTAL.format(c=col, a=r + 1, b=14)
                    c[f'{col}{r}'] = parent[col]
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            got = rows(sql.read_text(encoding='utf-8'))
            self.assertEqual((got['bp03-id-0009']['data']['end'], got['bp03-id-0009']['data']['level']), (14, 0))
            self.assertEqual((got['bp03-id-0013']['data']['end'], got['bp03-id-0013']['data']['level']), (14, 1))
            self.assertEqual(got['bp03-id-0014']['kind'], 'item')

    def test_section_average_follows_its_extent(self):
        """A SUBTOTAL that disagrees with the average of the rows its section covers is a mismatch."""
        def change(wb, cached):
            cached['ID Material']['AG9'] = 0.5  # the average of AG10:AG12 is 0.375
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 1, done.stdout + done.stderr)
            self.assertIn('AG9', done.stdout)

    def test_text_on_site_counts_as_zero_in_remaining(self):
        """=Y12-N(AB12) with text in On site: Excel gives Total, and so must totalMinusOnsite."""
        def change(wb, cached):
            wb['ID Material']['AB12'] = 'Pending'
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            data = rows(sql.read_text(encoding='utf-8'))['bp03-id-0012']['data']
            self.assertEqual((data['cells']['onsite'], data['cells']['remaining']), ({'v': 'Pending'}, {'f': 'totalMinusOnsite'}))

    def test_unknown_formula_stops_the_run(self):
        def change(wb, cached):
            wb['ID Material']['AG10'] = '=Y10*2'
            cached['ID Material']['AG10'] = 200
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 1, done.stdout + done.stderr)
            self.assertIn('AG10', done.stdout + done.stderr)
            self.assertFalse(sql.exists())

    def test_mismatch_with_cached_value_stops_the_run(self):
        def change(wb, cached):
            cached['ID Material']['AG10'] = 0.4  # PO / Total is 0.5
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 1, done.stdout + done.stderr)
            self.assertIn('AG10', done.stdout)
            self.assertFalse(sql.exists())

    def test_runs_are_identical(self):
        with tempfile.TemporaryDirectory() as folder:
            first, sql = run(folder, pictures=True)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            one = sql.read_bytes()
            second, _ = run(folder, pictures=True)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            self.assertEqual(one, sql.read_bytes())

    def test_pictures_become_webp_thumbnails(self):
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, pictures=True)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            files = sorted((Path(folder) / 'mat').iterdir())
            self.assertEqual(len(files), 3, files)  # red, blue, yellow; the picture in column AE is ignored
            for file in files:
                self.assertRegex(file.name, r'^[0-9a-f]{16}\.webp$')
                with Image.open(file) as image:
                    self.assertEqual((image.format, max(image.size)), ('WEBP', 480))
            got = rows(sql.read_text(encoding='utf-8'))
            images = got['bp03-id-0010']['data']['images']
            self.assertEqual(len(images['image']), 2)  # its own and the one that slipped up into the section row
            self.assertNotIn('images', got['bp03-id-0009']['data'])
            self.assertIn('given to the material below: G9 -> row 10', done.stdout)
            self.assertEqual(len(images['sample']), 1)
            self.assertEqual(got['bp03-id-0011']['data']['images'], {'sample': images['sample']})  # same picture, same file


    def test_hidden_rows_and_columns_are_skipped(self):
        def change(wb, cached):
            sheet = wb['ID Material']
            sheet.row_dimensions[11].hidden = True  # WF-02
            sheet.column_dimensions['B'].hidden = True  # Person In Charge
            sheet.column_dimensions['W'].hidden = True  # Procurement Remarks
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            self.assertIn('hidden columns skipped: B, W', done.stdout)
            self.assertIn('1 hidden rows skipped', done.stdout)
            got = rows(sql.read_text(encoding='utf-8'))
            self.assertIn('bp03-id-0010', got)
            self.assertIn('bp03-id-0012', got)
            self.assertNotIn('bp03-id-0011', got)
            self.assertNotIn('pic', got['bp03-id-0010']['data']['cols'])
            self.assertNotIn('procRemarks', got['bp03-id-0010']['data']['cols'])
            self.assertEqual(got['bp03-id-0009']['data']['end'], 12)

    def test_hidden_sheet_is_not_imported(self):
        def change(wb, cached):
            wb['MEP Material'].sheet_state = 'hidden'
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            got = rows(sql.read_text(encoding='utf-8'))
            self.assertFalse(any(row['package'] == 'bp03' and row['sheet'] == 'mep' for row in got.values()))
            self.assertTrue(any(row['package'] == 'bp04' and row['sheet'] == 'mep' for row in got.values()))

    def test_numbered_sections_on_a_sheet_without_percentage_subtotals(self):
        """BP04 MEP Material numbers sections 1, 2, 3 and items 1.1, 1.2; with no SUBTOTAL rows that numbering is the only cue."""
        def change(wb, cached):
            ws = wb['MEP Material']
            ws['A9'], ws['D9'] = '1', 'ACMV SYSTEM'
            ws['A10'] = '1.1'
            cached['MEP Material'].pop('A10')
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change04=change)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            got = rows(sql.read_text(encoding='utf-8'))
            self.assertEqual(got['bp04-mep-0009']['kind'], 'section')
            self.assertEqual(got['bp04-mep-0009']['data']['cols']['no'], '1')
            self.assertEqual(got['bp04-mep-0009']['data']['cols']['code'], 'ACMV SYSTEM')
            self.assertEqual((got['bp04-mep-0009']['data']['end'], got['bp04-mep-0009']['data']['level']), (10, 0))
            self.assertEqual(got['bp04-mep-0010']['kind'], 'item')

    def test_numbered_heading_without_subtotals_is_a_section(self):
        """BP03 ID '1.1.1 Miscellaneous': a dotted number and a name in the code column, nothing else, no SUBTOTALs."""
        def change(wb, cached):
            ws = wb['ID Material']
            last = ws.max_row
            ws[f'A{last + 1}'], ws[f'D{last + 1}'] = '9.9.1', 'Miscellaneous'
            # The same shape with a location is a material that has not been filled in yet, so it stays an item.
            ws[f'A{last + 2}'], ws[f'D{last + 2}'], ws[f'F{last + 2}'] = '9.9.2', 'XX-99', 'GF Lobby'
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            got = rows(sql.read_text(encoding='utf-8'))
            heading = next(r for r in got.values() if r['data']['cols'].get('no') == '9.9.1')
            material = next(r for r in got.values() if r['data']['cols'].get('no') == '9.9.2')
            self.assertEqual(heading['kind'], 'section')
            self.assertEqual(material['kind'], 'item')

    def test_mep_items_keep_no_person_in_charge(self):
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            got = rows(sql.read_text(encoding='utf-8'))
            self.assertNotIn('pic', got['bp03-mep-0010']['data']['cols'])
            self.assertIn('pic', got['bp03-id-0010']['data']['cols'])

    def test_section_marks_stay_on_materials_only(self):
        def change(wb, cached):
            wb['ID Material']['D9'].fill = PatternFill('solid', fgColor=GREEN)  # the section row
        with tempfile.TemporaryDirectory() as folder:
            done, sql = run(folder, images=False, change03=change)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            got = rows(sql.read_text(encoding='utf-8'))
            self.assertNotIn('mark', got['bp03-id-0009']['data'])
            self.assertEqual(got['bp03-id-0010']['data']['mark'], 'done')


if __name__ == '__main__':
    unittest.main()
