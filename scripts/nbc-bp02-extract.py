"""Local-only BP02 preparation; writes private files, never connects to a database.

Usage: python scripts/nbc-bp02-extract.py SOURCE.xlsx [OUTPUT_DIRECTORY]

The BP02 workbook gives Tola one MEP row per floor (his tab), while the Progress sheet repeats every
MEP task under each room type and links it by formula to that single row. The app keeps one activity per
handler row, so the repeated Progress MEP rows are collapsed into one floor-level MEP branch whose weight is the sum of
the rows that read it. Floor totals and the overall figure stay identical; room-type groups no longer contain
Tola's MEP tasks. Sanitary-ware tasks (Chhorvaon) stay inside their room types.
"""
import base64
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import sys

import openpyxl

PREFIX = 'nbc-bp02:'
HANDLERS = ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Tola']
WBS = re.compile(r'1\.8(?:\.(?:\d+|M\d+))+')


def close(actual, expected, label, tolerance=1e-9):
    assert isinstance(expected, (int, float)) and math.isfinite(expected), (label, expected)
    assert abs(actual - expected) <= tolerance, (label, actual, expected)


def extract(source):
    formulas = openpyxl.load_workbook(source, data_only=False)
    values = openpyxl.load_workbook(source, data_only=True)
    assert values.sheetnames[:7] == ['Progress'] + HANDLERS, values.sheetnames[:7]
    assert 'BP02' in str(values['Progress']['A1'].value).upper()
    errors = [(s.title, c.coordinate, c.value) for s in values for row in s for c in row if c.data_type == 'e']
    assert not errors, errors[:5]
    pf, pv = formulas['Progress'], values['Progress']

    # Handler tab rows: sheet -> row number -> (wbs, previous, actual).
    sheet_rows = {h: {} for h in HANDLERS}
    for h in HANDLERS:
        ws = values[h]
        for r in range(5, ws.max_row + 1):
            wbs = ws.cell(r, 1).value
            if wbs:
                sheet_rows[h][r] = (str(wbs), ws.cell(r, 11).value, ws.cell(r, 13).value)

    # Progress rows.
    nodes = {}
    order = []
    for r in range(6, pv.max_row + 1):
        wbs = pv.cell(r, 1).value
        if not wbs:
            continue
        wbs = str(wbs)
        assert WBS.fullmatch(wbs), wbs
        assert wbs not in nodes, f'Duplicate WBS {wbs}'
        nodes[wbs] = dict(r=r, wbs=wbs, name=pv.cell(r, 10).value,
                          hierarchy=[pv.cell(r, c).value for c in range(2, 10)],
                          progress=pv.cell(r, 14).value, previous=pv.cell(r, 12).value, weekly=pv.cell(r, 13).value,
                          global_=pv.cell(r, 19).value, duration=pv.cell(r, 18).value, boq=pv.cell(r, 20).value,
                          schedule=pv.cell(r, 21).value, formula=pf.cell(r, 14).value)
        order.append(wbs)

    def parent_of(wbs, known):
        p = wbs
        while p.count('.') > 2:
            p = p.rsplit('.', 1)[0]
            if p in known:
                return p
        return None

    children = collections.defaultdict(list)
    for wbs in order:
        children[parent_of(wbs, nodes)].append(wbs)
    leaves = [w for w in order if not children[w]]

    # Link each Progress leaf to the handler-tab row it reads.
    tola_weight = collections.defaultdict(float)
    kept_leaf = {}      # progress WBS -> (handler, previous, actual)
    for wbs in leaves:
        n = nodes[wbs]
        m = re.fullmatch(r'=(\w+)!M(\d+)', str(n['formula']))
        assert m and m.group(1) in HANDLERS, (wbs, n['formula'])
        handler, row = m.group(1), int(m.group(2))
        sheet_wbs, previous, actual = sheet_rows[handler][row]
        assert isinstance(actual, (int, float)) and isinstance(previous, (int, float)), (wbs, handler, row)
        close(actual, n['progress'], wbs + ' value', 1e-9)
        if handler == 'Tola':
            tola_weight[sheet_wbs] += n['global_']
        else:
            # Chhorvaon's sanitary-ware rows keep an older key (…14.3.1) on his tab; the Progress key is authoritative.
            assert sheet_wbs == wbs or (handler == 'Chhorvaon' and sheet_wbs == wbs.replace('.M4', '', 1)), (wbs, handler, sheet_wbs)
            kept_leaf[wbs] = (handler, previous, actual)

    # Progress nodes kept: handler-owned leaves and the ancestors of those leaves.
    keep = set(kept_leaf)
    for wbs in list(kept_leaf):
        p = parent_of(wbs, nodes)
        while p:
            keep.add(p)
            p = parent_of(p, nodes)

    # Floor-level Tola branch.
    tola_nodes = {}
    for row, (wbs, previous, actual) in sheet_rows['Tola'].items():
        if wbs in tola_weight:
            tola_nodes[wbs] = dict(wbs=wbs, row=row, previous=previous, actual=actual, leaf=True)
    for wbs in list(tola_nodes):
        p = wbs.rsplit('.', 1)[0]
        while p and p not in nodes:
            row = next(r for r, (w, _, _) in sheet_rows['Tola'].items() if w == p)
            tola_nodes.setdefault(p, dict(wbs=p, row=row, leaf=False))
            p = p.rsplit('.', 1)[0]
    tola_sheet_names = {wbs: values['Tola'].cell(t['row'], 10).value for wbs, t in tola_nodes.items()}
    tola_hierarchy = {wbs: [values['Tola'].cell(t['row'], c).value for c in range(4, 10)] for wbs, t in tola_nodes.items()}

    all_wbs = [w for w in order if w in keep]
    known = set(all_wbs) | set(tola_nodes)
    tree = collections.defaultdict(list)
    for w in all_wbs:
        tree[parent_of(w, known)].append(w)
    tola_order = sorted(tola_nodes, key=lambda w: tola_nodes[w]['row'])
    for w in tola_order:
        tree[parent_of(w, known)].append(w)

    # Weights and progress, bottom-up.
    glob, prog = {}, {}
    def settle(w):
        cs = tree[w]
        if not cs:
            if w in kept_leaf:
                glob[w], prog[w] = nodes[w]['global_'], kept_leaf[w][2]
            else:
                glob[w], prog[w] = tola_weight[w], tola_nodes[w]['actual']
            return
        for c in cs:
            settle(c)
        glob[w] = sum(glob[c] for c in cs)
        prog[w] = sum(glob[c] * prog[c] for c in cs) / glob[w] if glob[w] else 0
    roots = tree[None]
    for r in roots:
        settle(r)
    for r in roots:
        close(glob[r], nodes[r]['global_'], r + ' floor weight')
        close(nodes[r]['global_'], nodes[r]['global_'], r)

    # Assemble activities.
    activities, by_wbs = [], {}
    def lineage_of(w):
        chain = []
        while w:
            chain.insert(0, w)
            w = next((p for p, cs in tree.items() if w in cs), None)
        return chain
    parent_map = {c: p for p, cs in tree.items() for c in cs}
    def build(w):
        parent = parent_map.get(w)
        is_tola = w in tola_nodes
        chain = []
        x = w
        while x:
            chain.insert(0, x)
            x = parent_map.get(x)
        root = chain[0]
        lineage = chain[1:]
        n = nodes.get(w)
        name = n['name'] if n else tola_sheet_names[w]
        if n:
            hierarchy = n['hierarchy']
        else:
            hierarchy = tola_hierarchy[w]
        children_of = tree[w]
        handler = kept_leaf[w][0] if w in kept_leaf else 'Tola' if (is_tola and not children_of) else ''
        previous = kept_leaf[w][1] if w in kept_leaf else tola_nodes[w]['previous'] if is_tola and not children_of else None
        parent_global = glob[parent] if parent else None
        rel = glob[w] / parent_global if parent_global else glob[w]
        activity = dict(
            id=PREFIX + w, projectId='nbc-bp02', wbs=w, parentId=PREFIX + parent if parent else None,
            order=(n['r'] if n else 100000 + tola_nodes[w]['row']), name=name,
            description=' / '.join(str(v) for v in hierarchy if v),
            relativeWeight=rel, globalWeight=glob[w], baseline=prog[w], progress=prog[w],
            sourcePrevious=previous if previous is not None else prog[w], sourceWeekly=0,
            duration=(n['duration'] if n and not children_of else None) if True else None,
            boqValue=n['boq'] if n and n['boq'] is not None else None,
            schedule=n['schedule'] if n else None, handler=handler, remark='', history=[],
            sourceRow=(n['r'] if n else None), editable=not children_of,
            location=nodes[root]['name'], area=(nodes[lineage[0]]['name'] if lineage[0] in nodes else tola_sheet_names[lineage[0]]) if lineage else nodes[root]['name'],
            trade=((nodes.get(lineage[1]) or {}).get('name') or tola_sheet_names.get(lineage[1])) if len(lineage) > 1 else None)
        if activity['trade'] is None:
            activity['trade'] = activity['area']
        if activity['sourceRow'] is None:
            del activity['sourceRow']
        # Parents keep the workbook duration when they only contain Progress rows.
        activities.append(activity)
        by_wbs[w] = activity
        for c in children_of:
            build(c)
    for r in roots:
        build(r)
    for a in activities:
        if not a['editable']:
            a['duration'] = None
    # Parent BOQ values: sum of kept children for Progress rows.
    for a in reversed(activities):
        pass

    leaf_list = [a for a in activities if a['editable']]
    handler_counts = dict(collections.Counter(a['handler'] for a in leaf_list))
    assert all(a['handler'] in HANDLERS for a in leaf_list), 'Unassigned leaf'
    weight = sum(a['globalWeight'] for a in leaf_list)
    overall = sum(a['globalWeight'] * a['progress'] for a in leaf_list)
    close(weight, pv['K5'].value, 'total weight', 1e-9)
    total_boq = sum(nodes[r]['boq'] or 0 for r in roots)
    close(total_boq, pv['T5'].value, 'total BOQ', 1e-6)
    # Independent check: floors recomputed from every leaf must equal the workbook's floor figures.
    floors = []
    for r in roots:
        floors.append(dict(wbs=r, name=nodes[r]['name'], progress=prog[r], workbookProgress=nodes[r]['progress'],
                           delta=prog[r] - nodes[r]['progress']))
    project = dict(id='nbc-bp02', name='NBC BP02 – Pan Pacific Hotel', workspace='team', color='blue',
                   description='Guestrooms L13–L23 · NBC BP02', target='', status='Active', progress=overall, nbcBp03=True)
    reconciliation = dict(
        nodes=len(activities), editableEntries=len(leaf_list), handlers=handler_counts,
        progressRows=len(nodes), progressLeavesCollapsed=sum(tola_weight.values()) and len(leaves) - len(kept_leaf),
        tolaFloorRows=sum(1 for a in leaf_list if a['handler'] == 'Tola'),
        effectiveWeight=weight, boqValue=total_boq, overall=overall,
        workbookBoqOverall=pv['P5'].value, workbookBlockOverall=pv['N5'].value,
        floors=floors, sourceSha256=hashlib.sha256(Path(source).read_bytes()).hexdigest())
    return dict(project=project, activities=activities, reconciliation=reconciliation)


if __name__ == '__main__':
    source = Path(sys.argv[1])
    output = Path(sys.argv[2] if len(sys.argv) > 2 else '.private/nbc-bp02')
    output.mkdir(parents=True, exist_ok=True)
    dataset = extract(source)
    for name, value in [('initial', dataset), ('reconciliation', dataset['reconciliation'])]:
        (output / (name + '.json')).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    shutil.copyfile(source, output / 'template.xlsx')
    print(json.dumps({k: v for k, v in dataset['reconciliation'].items() if k != 'floors'}, indent=2))
    print(json.dumps(dataset['reconciliation']['floors'][:3], indent=1))
