"""Local-only: checks the weights BP04 uses against a BP04 weekly report (the client's "3. & 6. BP-04 - Weekly NN" workbook).
Never connects to a database. Used to derive and verify the migration 20261119140000_nbc_bp04_weekly28_structure.

Usage: python scripts/nbc-bp04-report-extract.py REPORT.xlsx [OUTPUT_DIRECTORY]   (default .private/nbc-bp04-weekly)

The report's formulas become leaf weights, exactly as the app stores them:

    zone weights   'BP-04 (ID)'!F8:H8 (ID-69, ID-62, ID-70); the figures divide by their sum
    ID             section D (ID sheet), task E, the zone weight on every leaf. A task that is N/A in a zone has no leaf there.
                   leaf globalWeight = 0.7 * D * E / (E of the section's tasks that are numeric in the zone) * zone / sum(zone)
    MEP            task D (the 40/40/10/5/5 written into column C), sub-systems and systems equal, the zone weight on every leaf
                   (column C = SUMPRODUCT(ISNUMBER, zone weights, cells) / SUMPRODUCT(ISNUMBER, zone weights) * D)
                   leaf globalWeight = 0.3 * zone / sum(zone) / systems numeric in the zone / sub-systems of the system * D

The extract recomputes the ID total (ID!C9), the MEP total (MEP!C10) and the report's Overall (P.sum!E7) from the report's cached cell values
and must match them. It writes the weights the migration embeds.
"""
import json
from pathlib import Path
import re
import sys

import openpyxl

ZONES = ['ID-69', 'ID-62', 'ID-70']
ROMAN = re.compile(r'^[IVX]+$')
INT = re.compile(r'^\d+$')
DOTTED = re.compile(r'^\d+\.\d+$')


def num(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def parse(path):
    book = openpyxl.load_workbook(path, data_only=True)
    idv, mep, psum = book['BP-04 (ID)'], book['BP-04(MEP)'], book['P.sum']
    zone = [num(idv.cell(8, c).value) for c in (6, 7, 8)]
    assert all(z is not None for z in zone), zone
    labels = [str(idv.cell(7, c).value).split('\n')[0] for c in (6, 7, 8)]
    assert labels == ZONES, labels
    assert idv.cell(7, 9).value in (None, ''), 'the ID sheet still has a fourth zone'

    sections, section = [], None
    for r in range(10, idv.max_row + 1):
        a, b = str(idv.cell(r, 1).value or '').strip(), str(idv.cell(r, 2).value or '').strip()
        if not b:
            continue
        if ROMAN.match(a):
            section = dict(item=a, name=b, D=num(idv.cell(r, 4).value), tasks=[])
            sections.append(section)
        elif section is not None:
            section['tasks'].append(dict(name=b, E=num(idv.cell(r, 5).value), cells=[num(idv.cell(r, c).value) for c in (6, 7, 8)]))

    systems, system, sub = [], None, None
    for r in range(12, mep.max_row + 1):
        a, b = str(mep.cell(r, 1).value or '').strip(), str(mep.cell(r, 2).value or '').strip()
        if not b:
            continue
        if ROMAN.match(a):
            system = dict(item=a, name=b, subs=[])
            systems.append(system)
        elif INT.match(a):
            sub = dict(item=a, name=b, tasks=[])
            system['subs'].append(sub)
        elif DOTTED.match(a):
            sub['tasks'].append(dict(item=a, name=b, D=num(mep.cell(r, 4).value), cells=[num(mep.cell(r, c).value) for c in (6, 7, 8)]))
    expected = dict(id_total=num(idv['C9'].value), mep_total=num(mep['C10'].value), overall=num(psum['E7'].value))
    return zone, sections, systems, expected


def main(source, output):
    zone, sections, systems, expected = parse(source)
    total = sum(zone)
    leaves = {}

    # ID: progress rolls up with the weights the app stores as relativeWeight; globalWeight is the report's own project weighting.
    id_progress = 0.0
    d_sum = sum(s['D'] for s in sections)
    for si, s in enumerate(sections, start=1):
        e_sum = sum(t['E'] for t in s['tasks'] if any(v is not None for v in t['cells']))
        sec_progress = 0.0
        for ti, t in enumerate(s['tasks'], start=1):
            live = [(z, v) for z, v in zip(zone, t['cells']) if v is not None]
            if not live:
                continue
            task_progress = sum(z * v for z, v in live) / sum(z for z, _ in live)
            sec_progress += t['E'] * task_progress / e_sum
            for zi, v in enumerate(t['cells']):
                if v is None:
                    continue
                e_zone = sum(x['E'] for x in s['tasks'] if x['cells'][zi] is not None)
                leaves[f'ID|{si}|{ti}|{ZONES[zi]}'] = dict(value=v, rel=zone[zi], gw=0.7 * s['D'] * t['E'] / e_zone * zone[zi] / total)
        id_progress += s['D'] * sec_progress / d_sum

    # MEP: a zone's systems are the ones with a number there; a system averages its sub-systems that have one.
    mep_progress = 0.0
    for yi, y in enumerate(systems, start=1):
        sys_progress = 0.0
        for bi, b in enumerate(y['subs'], start=1):
            d_sum_sub = sum(t['D'] for t in b['tasks'])
            sub_progress = 0.0
            for ti, t in enumerate(b['tasks'], start=1):
                live = [(z, v) for z, v in zip(zone, t['cells']) if v is not None]
                if not live:
                    continue
                sub_progress += t['D'] * sum(z * v for z, v in live) / sum(z for z, _ in live) / d_sum_sub
                for zi, v in enumerate(t['cells']):
                    if v is None:
                        continue
                    systems_here = sum(1 for x in systems if any(c is not None for sb in x['subs'] for tk in sb['tasks'] for c in [tk['cells'][zi]]))
                    subs_here = sum(1 for sb in y['subs'] if any(tk['cells'][zi] is not None for tk in sb['tasks']))
                    leaves[f'MEP|{yi}|{bi}|{ti}|{ZONES[zi]}'] = dict(value=v, rel=zone[zi], gw=0.3 * zone[zi] / total / systems_here / subs_here * t['D'] / d_sum_sub)
            sys_progress += sub_progress / len(y['subs'])
        mep_progress += sys_progress / len(systems)

    overall = sum(v['gw'] * v['value'] for v in leaves.values())
    weight = sum(v['gw'] for v in leaves.values())
    result = dict(zone=zone, leaves=len(leaves), weight=weight,
                  id_total=dict(app=id_progress, report=expected['id_total']),
                  mep_total=dict(app=mep_progress, report=expected['mep_total']),
                  overall=dict(app=overall, report=expected['overall']))
    print(json.dumps(result, indent=2))
    assert abs(id_progress - expected['id_total']) < 1e-9, ('ID total', id_progress, expected['id_total'])
    assert abs(mep_progress - expected['mep_total']) < 1e-9, ('MEP total', mep_progress, expected['mep_total'])
    assert abs(overall - expected['overall']) < 1e-4, ('Overall', overall, expected['overall'])
    output.mkdir(parents=True, exist_ok=True)
    (output / 'weights.json').write_text(json.dumps(dict(zone=zone, leaves=leaves, reconciliation=result), ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else '.private/nbc-bp04-weekly'))
