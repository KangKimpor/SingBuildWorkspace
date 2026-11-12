"""Local-only: converts a BP02 weekly report (the client's "2. & 5. BP-02 Weekly NN" workbook) into the per-room activity dataset.
Never connects to a database. Used by the full-size export checks (src/nbc/export/roomWorkbook.test.ts) and to re-derive the
weights that migration 20261112052435_nbc_bp02_weekly63_structure applied.

Usage: python scripts/nbc-bp02-report-extract.py REPORT.xlsx [OUTPUT_DIRECTORY]   (default .private/nbc-bp02-weekly)

The report's formulas (P.sum!E7 and the floor sheets) become leaf weights:

    overall = 50% Guestroom + 5% Corridor + 45% MEP
    Guestroom, MEP  floors weigh by their room count ('F<n> (ID)'!D6); the corridor weighs floors equally
    Guestroom       groups by D; rooms equally within a group; a room's tasks by E re-weighted over the tasks it has (N/A drops out)
    Corridor        groups by D, tasks by E
    MEP             systems and subsystems equally, tasks by D, rooms equally over the cells that hold a number;
                    "Installation Water Closet, Lavatory and Shower" is two half-weight leaves (Chhorvaon and Tola)

The extract recomputes every floor and the overall figure and must match the report's cached values (P.sum!E7, P.sum!G7:Q7).
Handlers are taken from the earlier room extract when it is present; otherwise they are placeholders (Sitha / Tola).
"""
import json
from pathlib import Path
import re
import sys

import openpyxl

PREFIX = 'nbc-bp02:'
ROMAN = re.compile(r'^[IVX]+$')
DOTTED = re.compile(r'^\d+\.\d+$')
INT = re.compile(r'^\d+$')
ROOM = re.compile(r'^[A-Za-z0-9()]+(?:-[A-Za-z0-9()]+)*-\d+$|^CRD$')
SECTIONS = {'A': 'GUESTROOM - INTERIOR DESIGN (ID)', 'B': 'CORRIDOR AND LOBBY - INTERIOR DESIGN (ID)', 'C': 'MEP WORKS'}
SECTION_WEIGHT = {'A': 0.5, 'B': 0.05, 'C': 0.45}


def number(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        m = re.fullmatch(r'=\s*(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)', value)
        if m:
            return float(m.group(1)) / float(m.group(2))
    return None


def parse(path):
    formulas = openpyxl.load_workbook(path)
    values = openpyxl.load_workbook(path, data_only=True)
    floors = []
    for n in range(23, 12, -1):
        idf, idv = formulas[f'F{n} (ID)'], values[f'F{n} (ID)']
        rooms = {c: str(idf.cell(6, c).value).strip() for c in range(6, idf.max_column + 1) if idf.cell(6, c).value}
        sections, section, group = [], None, None
        for r in range(8, idf.max_row + 1):
            a = str(idf.cell(r, 1).value or '').strip()
            b = str(idf.cell(r, 2).value or '').strip()
            if not b:
                continue
            if not a and (group is None or b.lower().startswith(('guestroom', 'corridor'))):
                section = dict(name=b, groups=[])
                sections.append(section)
                group = None
            elif ROMAN.match(a):
                group = dict(item=a, name=b, D=number(idf.cell(r, 4).value), tasks=[])
                section['groups'].append(group)
            elif not a:
                cols = rooms if len(sections) == 1 else {6: 'CRD'}
                cells = {}
                for c, room in cols.items():
                    v = idf.cell(r, c).value
                    if isinstance(v, (int, float)):
                        cells[room] = float(v)
                group['tasks'].append(dict(name=b, E=number(idf.cell(r, 5).value), cells=cells))
        mepf, mepv = formulas[f'{n}F(MEP)'], values[f'{n}F(MEP)']
        mrooms = {c: str(mepf.cell(9, c).value).strip() for c in range(5, mepf.max_column + 1) if mepf.cell(9, c).value and ROOM.match(str(mepf.cell(9, c).value).strip())}
        # A room the report renamed on one sheet only (F21: ID "PS-ST3-2119", MEP "PS-2119") is one room: match it by unit number.
        unit = lambda room: re.search(r'-(\d+)$', room).group(1) if re.search(r'-(\d+)$', room) else None
        by_unit = {unit(r): r for r in rooms.values() if unit(r)}
        mrooms = {c: (room if room in rooms.values() or room == 'CRD' else by_unit.get(unit(room), room)) for c, room in mrooms.items()}
        systems, system, sub = [], None, None
        for r in range(10, mepf.max_row + 1):
            a = str(mepf.cell(r, 1).value or '').strip()
            b = str(mepf.cell(r, 2).value or '').strip()
            if not b:
                continue
            if ROMAN.match(a):
                system = dict(item=a, name=b, subs=[])
                systems.append(system)
            elif INT.match(a):
                sub = dict(item=a, name=b, tasks=[])
                system['subs'].append(sub)
            elif DOTTED.match(a):
                cells = {room: float(mepf.cell(r, c).value) for c, room in mrooms.items() if isinstance(mepf.cell(r, c).value, (int, float))}
                sub['tasks'].append(dict(item=a, name=b, D=number(mepf.cell(r, 4).value), cells=cells))
        floors.append(dict(floor=n, count=idv['D6'].value, rooms=list(rooms.values()), A=sections[0], B=sections[1], C=systems,
                           figure=values['P.sum'].cell(7, 7 + (23 - n)).value))
    return floors, values['P.sum']['E7'].value


def main(source, output):
    floors, report_overall = parse(source)
    earlier = Path('.private/nbc-bp02-rooms/initial.json')
    by_task = {}
    if earlier.exists():
        dump = json.loads(earlier.read_text(encoding='utf-8'))['activities']
        ids = {a['id']: a for a in dump}
        for a in dump:
            if a.get('room') and a.get('handler') and a.get('parentId') in ids:
                by_task.setdefault(ids[a['parentId']]['name'][:14].lower(), a['handler'])
    default = {'A': 'Sitha', 'B': 'Sitha', 'C': 'Tola'}
    total_rooms = sum(f['count'] for f in floors)
    activities, order = [], [0]

    def add(**fields):
        order[0] += 1
        row = dict(order=order[0], duration=None, boqValue=None, schedule=None, remark='', history=[], sourcePrevious=0, sourceWeekly=0, handler='',
                   description='', projectId='nbc-bp02', trade='', location='', editable=False, relativeWeight=1, globalWeight=0, progress=0, baseline=0)
        row.update(fields)
        activities.append(row)
        return row

    for fi, f in enumerate(floors, start=1):
        n = f['count']
        floor_wbs = f'1.8.1.{fi}'
        root = add(id=PREFIX + floor_wbs, wbs=floor_wbs, parentId=None, name=f"Floor {f['floor']}", area=f"Floor {f['floor']}", roomList=[*[r for r in f['rooms']], 'CRD'])
        sections = {}
        for si, key in enumerate('ABC', start=1):
            wbs = f'{floor_wbs}.{si}'
            sections[key] = (wbs, add(id=PREFIX + wbs, wbs=wbs, parentId=root['id'], name=SECTIONS[key], area=SECTIONS[key], item=key, relativeWeight=SECTION_WEIGHT[key]))

        def leaf(parent_wbs, parent, k, room, value, weight_share, gw, area, handler, **extra):
            wbs = f'{parent_wbs}.{k}'
            return add(id=PREFIX + wbs, wbs=wbs, parentId=parent['id'], name=room, room=room, area=area, editable=True, relativeWeight=weight_share, globalWeight=gw,
                       progress=value, baseline=value, sourcePrevious=value, handler=handler, **extra)

        # Guestroom and corridor.
        for key, section in (('A', f['A']), ('B', f['B'])):
            sec_wbs, sec = sections[key]
            d_sum = sum(g['D'] for g in section['groups'])
            for gi, g in enumerate(section['groups'], start=1):
                g_wbs = f'{sec_wbs}.{gi}'
                grp = add(id=PREFIX + g_wbs, wbs=g_wbs, parentId=sec['id'], name=g['name'], area=SECTIONS[key], item=g['item'], relativeWeight=g['D'] / d_sum)
                rooms = sorted({r for t in g['tasks'] for r in t['cells']}, key=lambda r: f['rooms'].index(r) if r in f['rooms'] else 99)
                s_room = {r: sum(t['E'] for t in g['tasks'] if r in t['cells']) for r in rooms}
                e_sum = sum(t['E'] for t in g['tasks'] if t['cells'])
                for ti, t in enumerate(g['tasks'], start=1):
                    t_wbs = f'{g_wbs}.{ti}'
                    if not t['cells']:
                        continue
                    task = add(id=PREFIX + t_wbs, wbs=t_wbs, parentId=grp['id'], name=t['name'], area=SECTIONS[key])
                    for k, room in enumerate(rooms, start=1):
                        if room not in t['cells']:
                            continue
                        if key == 'A':
                            share = t['E'] / (len(rooms) * s_room[room])
                            gw = 0.5 * n / total_rooms * g['D'] / d_sum * share
                        else:
                            share = 1
                            gw = 0.05 / len(floors) * g['D'] / d_sum * t['E'] / e_sum
                        handler = by_task.get(t['name'][:14].lower(), default[key])
                        leaf(t_wbs, task, k, room, t['cells'][room], share, gw, SECTIONS[key], handler)
                    task['relativeWeight'] = sum(a['relativeWeight'] for a in activities if a.get('parentId') == task['id']) if key == 'A' else t['E'] / e_sum

        # MEP.
        sec_wbs, sec = sections['C']
        for xi, system in enumerate(f['C'], start=1):
            x_wbs = f'{sec_wbs}.{xi}'
            sys_row = add(id=PREFIX + x_wbs, wbs=x_wbs, parentId=sec['id'], name=system['name'].upper(), area='MEP WORKS', item=system['item'])
            for ui, sub in enumerate(system['subs'], start=1):
                u_wbs = f'{x_wbs}.{ui}'
                sub_row = add(id=PREFIX + u_wbs, wbs=u_wbs, parentId=sys_row['id'], name=sub['name'], area='MEP WORKS', item=sub['item'])
                for ti, t in enumerate(sub['tasks'], start=1):
                    t_wbs = f'{u_wbs}.{ti}'
                    task = add(id=PREFIX + t_wbs, wbs=t_wbs, parentId=sub_row['id'], name=t['name'], area='MEP WORKS', item=t['item'], relativeWeight=t['D'])
                    shared = t['name'].startswith('Installation Water Closet')
                    for k, (room, value) in enumerate(t['cells'].items(), start=1):
                        gw = 0.45 * n / total_rooms / len(f['C']) / len(system['subs']) * t['D'] / len(t['cells'])
                        if shared:
                            first = leaf(t_wbs, task, k, room, value, 0.5, gw / 2, 'MEP WORKS', 'Chhorvaon')
                            leaf(t_wbs, task, f'{k}.2', room, value, 0.5, gw / 2, 'MEP WORKS', 'Tola', coOf=first['id'])
                        else:
                            leaf(t_wbs, task, k, room, value, 1, gw, 'MEP WORKS', by_task.get(t['name'][:14].lower(), 'Tola'))

    # Parents carry the weight of their leaves; progress rolls up exactly as calculate() does.
    kids = {}
    for a in activities:
        kids.setdefault(a['parentId'], []).append(a)

    def settle(a):
        cs = kids.get(a['id'], [])
        if not cs:
            return a['progress'], a['globalWeight']
        results = [settle(c) for c in cs]
        total = sum(c['relativeWeight'] for c in cs)
        a['progress'] = a['baseline'] = a['sourcePrevious'] = sum(c['relativeWeight'] * r[0] for c, r in zip(cs, results)) / total
        a['globalWeight'] = sum(r[1] for r in results)
        return a['progress'], a['globalWeight']

    for root in kids[None]:
        settle(root)
        root['relativeWeight'] = root['globalWeight']
    leaves = [a for a in activities if a['editable']]
    overall = sum(a['globalWeight'] * a['progress'] for a in leaves)
    weight = sum(a['globalWeight'] for a in leaves)
    floor_deltas = []
    for root, f in zip(kids[None], floors):
        parts = {s['item']: s for s in kids[root['id']]}
        figure = sum(SECTION_WEIGHT[k] * (lambda p: sum(c['globalWeight'] * c['progress'] for c in leaves if c['id'].startswith(p['id'] + '.')) / p['globalWeight'])(parts[k]) for k in 'ABC')
        floor_deltas.append(dict(floor=root['name'], app=figure, workbook=f['figure'], delta=figure - f['figure']))
    assert abs(weight - 1) < 1e-9, weight
    assert abs(overall - report_overall) < 1e-9, (overall, report_overall)
    assert all(abs(d['delta']) < 1e-9 for d in floor_deltas), floor_deltas
    output.mkdir(parents=True, exist_ok=True)
    reconciliation = dict(nodes=len(activities), leaves=len(leaves), overall=overall, workbookOverall=report_overall, overallDelta=overall - report_overall, floors=floor_deltas)
    (output / 'initial.json').write_text(json.dumps(dict(activities=activities, reconciliation=reconciliation), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({k: v for k, v in reconciliation.items() if k != 'floors'}, indent=2))


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else '.private/nbc-bp02-weekly'))
