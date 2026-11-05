"""Local-only: converts the BP02 room-column workbook into the per-room activity dataset. Never connects to a database.

Usage: python scripts/nbc-bp02-rooms-extract.py SOURCE.xlsx [OUTPUT_DIRECTORY]

Every room of every floor owns its own editable activity, so rooms of the same type can sit at different percentages:

    Floor -> section (A guestroom / B corridor / C MEP) -> group -> task -> one editable leaf per room

Weights follow the workbook: section 50/5/45 %, the group/task weights printed on each Floor sheet, equal weights where the
sheet averages, and equal weight per room under a task (the "Floor avg" column). Floors weigh 1/11 each. The extract
recomputes every floor and the overall figure and must match the workbook's own cached values.
"""
import json
import math
from pathlib import Path
import re
import shutil
import sys

import openpyxl

PREFIX = 'nbc-bp02:'
HANDLERS = ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Tola']
ROMAN = re.compile(r'^[IVX]+$')
LINK = re.compile(r"^=\s*'?(\w+)'?!\$?([A-Z]+)\$?(\d+)$")


def number(value):
    """Weight cell -> float, or None when it is text such as '33% / 25%'."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and re.fullmatch(r'=\s*\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?', value):
        a, b = re.findall(r'\d+(?:\.\d+)?', value)
        return float(a) / float(b)
    return None


def extract(source):
    formulas = openpyxl.load_workbook(source, data_only=False)
    values = openpyxl.load_workbook(source, data_only=True)
    floors = [s for s in formulas.sheetnames if s.startswith('Floor ')]
    assert floors and all(h in formulas.sheetnames for h in HANDLERS), formulas.sheetnames
    overall = formulas['Overall Progress']
    section_weight = {'A': overall['C7'].value, 'B': overall['C19'].value, 'C': overall['C26'].value}
    assert abs(sum(section_weight.values()) - 1) < 1e-9, section_weight

    activities, order = [], [0]
    reconciliation = []

    def add(**fields):
        order[0] += 1
        activity = dict(order=order[0], duration=None, boqValue=None, schedule=None, remark='', history=[],
                        sourcePrevious=0, sourceWeekly=0, handler='', description='', item='')
        activity.update(fields)
        activities.append(activity)
        return activity

    for floor_index, sheet in enumerate(floors, start=1):
        ws, wv = formulas[sheet], values[sheet]
        rooms = {}
        for c in range(4, ws.max_column + 1):
            code = ws.cell(4, c).value
            if code:
                rooms[c] = str(code)
        floor_wbs = f'1.8.1.{floor_index}'
        floor = add(id=PREFIX + floor_wbs, projectId='nbc-bp02', wbs=floor_wbs, parentId=None, name=sheet, area=sheet, trade=sheet,
                    location=sheet, editable=False, relativeWeight=1 / len(floors), globalWeight=1 / len(floors),
                    progress=0, baseline=0, roomList=list(rooms.values()))
        stack = {}  # level -> activity
        section = None
        counters = {}

        def child(parent, name, item, rel, kind):
            counters[parent['wbs']] = counters.get(parent['wbs'], 0) + 1
            wbs = f"{parent['wbs']}.{counters[parent['wbs']]}"
            node = add(id=PREFIX + wbs, projectId='nbc-bp02', wbs=wbs, parentId=parent['id'], name=name, item=item,
                       area=section['name'] if section else name, trade=name, location=sheet, editable=False,
                       relativeWeight=rel, globalWeight=0, progress=0, baseline=0, kind=kind)
            return node

        for r in range(5, ws.max_row + 1):
            a, b, c = ws.cell(r, 1).value, ws.cell(r, 2).value, ws.cell(r, 3).value
            if b is None:
                continue
            item = '' if a is None else str(a).strip()
            name = str(b).strip()
            links = {col: LINK.match(str(ws.cell(r, col).value or '')) for col in rooms}
            links = {col: m for col, m in links.items() if m}
            if item in ('A', 'B', 'C') and not links:
                section = child(floor, name, item, section_weight[item], 'section')
                section['area'] = name
                section['_rooms'] = [col for col in rooms if str(ws.cell(r, col).value or '').startswith('=')]
                stack = {1: section}
                continue
            if section is None:
                continue
            letter = section['item']
            if links:  # task row
                parent = stack[max(stack)]
                rel = number(c)
                task = child(parent, name, item, rel if rel is not None else 1, 'task')
                task['_raw'] = rel
                handlers = {m.group(1) for m in links.values()}
                assert len(handlers) == 1 and next(iter(handlers)) in HANDLERS, (sheet, r, handlers)
                handler = next(iter(handlers))
                cells = {}
                if letter == 'C':
                    # MEP reads the handler tab's "Floor avg", which averages only the cells that hold a number.
                    rows_used = {m.group(3) for m in links.values()}
                    assert len(rows_used) == 1, (sheet, r, rows_used)
                    for col in rooms:
                        v = formulas[handler].cell(int(next(iter(rows_used))), col).value
                        if isinstance(v, (int, float)):
                            cells[col] = (float(v), int(next(iter(rows_used))))
                else:
                    for col, m in links.items():
                        v = formulas[handler][f'{m.group(2)}{m.group(3)}'].value
                        assert v is None or isinstance(v, (int, float)), (sheet, r, col, v)
                        cells[col] = (0.0 if v is None else float(v), int(m.group(3)))
                for col, (value, src_row) in cells.items():
                    assert 0 <= value <= 1, (sheet, r, col, value)
                    counters[task['wbs']] = counters.get(task['wbs'], 0) + 1
                    wbs = f"{task['wbs']}.{counters[task['wbs']]}"
                    add(id=PREFIX + wbs, projectId='nbc-bp02', wbs=wbs, parentId=task['id'], name=rooms[col], room=rooms[col], area=section['name'], trade='',
                        location='', editable=True, relativeWeight=1, globalWeight=0, progress=value, baseline=value,
                        sourcePrevious=value, handler=handler, _col=col)
                task['handler'] = ''
                continue
            # Grouping row: depth inside the section.
            if letter == 'C':
                depth = 2 if ROMAN.match(item) else 3 if '.' not in item else 4
            else:
                depth = 2
            parent = stack[depth - 1]
            rel = number(c) if letter != 'C' and depth == 2 else None
            group = child(parent, name, item, rel if rel is not None else 1, 'group')
            group['_raw'] = rel
            group['_mode'] = 'AVERAGE' if str(ws.cell(r, 4).value or '').upper().startswith('=AVERAGE') else 'SUMPRODUCT'
            if letter != 'C':
                group['trade'] = name
            elif depth == 2:
                group['trade'] = name
            stack = {k: v for k, v in stack.items() if k < depth}
            stack[depth] = group

    # Drop groups that ended up without room leaves (e.g. rows the workbook leaves unlinked), then settle weights.
    by_id = {a['id']: a for a in activities}
    kids = {}
    for a in activities:
        kids.setdefault(a['parentId'], []).append(a)
    changed = True
    while changed:
        changed = False
        for a in list(activities):
            if not a['editable'] and a['parentId'] and not kids.get(a['id']):
                activities.remove(a)
                kids[a['parentId']].remove(a)
                changed = True
    for a in activities:
        siblings = kids.get(a['id'])
        if siblings:
            total = sum(c['relativeWeight'] for c in siblings)
            for c in siblings:
                c['relativeWeight'] = c['relativeWeight'] / total if total else 1 / len(siblings)

    def settle(a, weight):
        a['globalWeight'] = weight
        cs = kids.get(a['id'], [])
        if not cs:
            return a['progress']
        a['progress'] = a['baseline'] = sum(c['relativeWeight'] * settle(c, weight * c['relativeWeight']) for c in cs)
        a['sourcePrevious'] = a['progress']
        return a['progress']

    for root in kids[None]:
        settle(root, root['relativeWeight'])
    # The workbook scores guestrooms room by room (a task a room lacks counts as 0, averaged groups skip it), so leaf weights follow that.
    for root in kids[None]:
        for sec in kids[root['id']]:
            if sec.get('item') != 'A':
                continue
            n_rooms = len(sec['_rooms'])
            for group in kids[sec['id']]:
                tasks = kids[group['id']]
                raw = group['_raw'] or 0
                if group['_mode'] == 'AVERAGE':
                    present = {}
                    for t in tasks:
                        for leaf in kids[t['id']]:
                            present[leaf['_col']] = present.get(leaf['_col'], 0) + 1
                for t in tasks:
                    for leaf in kids[t['id']]:
                        coefficient = raw / n_rooms * ((t['_raw'] or 0) if group['_mode'] == 'SUMPRODUCT' else 1 / present[leaf['_col']])
                        leaf['globalWeight'] = root['relativeWeight'] * sec['relativeWeight'] * coefficient
    for a in activities:
        if not a['item']:
            del a['item']
        if a.get('_mode') == 'AVERAGE':
            a['average'] = True
        for key in [k for k in a if k.startswith('_')]:
            del a[key]
    leaves = [a for a in activities if a['editable']]
    total_weight = sum(a['globalWeight'] for a in leaves)
    print('total leaf weight', total_weight)
    overall_progress = sum(a['globalWeight'] * a['progress'] for a in leaves)

    # Reconcile with the workbook's own cached figures.
    deltas = []
    for root in kids[None]:
        cached = values[root['name']]['C4'].value
        deltas.append(dict(floor=root['name'], app=root['progress'], workbook=cached, delta=root['progress'] - cached))
    workbook_overall = values['Overall Progress']['D6'].value
    for a in activities:
        for k in ('kind',):
            a.pop(k, None)
    handler_counts = {h: sum(1 for a in leaves if a['handler'] == h) for h in HANDLERS}
    project = dict(id='nbc-bp02', name='NBC BP02 – Pan Pacific Hotel', workspace='team', color='blue',
                   description='Guestrooms L13–L23 · NBC BP02', target='', status='Active', progress=overall_progress, nbcBp03=True)
    reconciliation = dict(nodes=len(activities), leaves=len(leaves), handlers=handler_counts, overall=overall_progress,
                          workbookOverall=workbook_overall, overallDelta=overall_progress - workbook_overall, floors=deltas)
    return dict(project=project, activities=activities, reconciliation=reconciliation)


if __name__ == '__main__':
    source = Path(sys.argv[1])
    output = Path(sys.argv[2] if len(sys.argv) > 2 else '.private/nbc-bp02')
    output.mkdir(parents=True, exist_ok=True)
    dataset = extract(source)
    (output / 'initial.json').write_text(json.dumps(dataset, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    shutil.copyfile(source, output / 'template.xlsx')  # the staging SQL stores it; the room report itself needs no template
    rec = dataset['reconciliation']
    (output / 'reconciliation.json').write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in rec.items() if k != 'floors'}, indent=2))
    for f in rec['floors']:
        print(f"{f['floor']}: app {f['app']:.6f} workbook {f['workbook']:.6f} delta {f['delta']:+.2e}")
