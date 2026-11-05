"""Local-only: compares an exported area report with the client's workbook cell by cell.

Usage: python scripts/nbc-area-export-compare.py SOURCE.xlsx EXPORT.xlsx
Checks, for every sheet: sheet order and names, merged ranges, every cell's cached value (numbers to 1e-9) and every
cell's formula text. Exits non-zero on any difference. Cached values need an export written by the app (it stores them).
"""
import sys

import openpyxl


def main(source, exported):
    sf, ef = openpyxl.load_workbook(source), openpyxl.load_workbook(exported)
    sv, ev = openpyxl.load_workbook(source, data_only=True), openpyxl.load_workbook(exported, data_only=True)
    problems = []
    if sf.sheetnames != ef.sheetnames:
        problems.append(f'sheet names differ: {sf.sheetnames} vs {ef.sheetnames}')
    checked = 0
    for name in sf.sheetnames:
        if name not in ef.sheetnames:
            continue
        a, b, av, bv = sf[name], ef[name], sv[name], ev[name]
        if sorted(map(str, a.merged_cells.ranges)) != sorted(map(str, b.merged_cells.ranges)):
            problems.append(f'{name}: merges {sorted(map(str, a.merged_cells.ranges))} vs {sorted(map(str, b.merged_cells.ranges))}')
        if a.freeze_panes != b.freeze_panes:
            problems.append(f'{name}: freeze {a.freeze_panes} vs {b.freeze_panes}')
        rows, cols = max(a.max_row, b.max_row), max(a.max_column, b.max_column)
        for r in range(1, rows + 1):
            for c in range(1, cols + 1):
                x, y = av.cell(r, c).value, bv.cell(r, c).value
                fx, fy = a.cell(r, c).value, b.cell(r, c).value
                x = None if x == '' else x
                y = None if y == '' else y
                checked += 1
                ref = f'{name}!{a.cell(r, c).coordinate}'
                if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                    if abs(x - y) > 1e-9:
                        problems.append(f'{ref}: value {x} vs {y}')
                elif x != y:
                    problems.append(f'{ref}: value {x!r} vs {y!r}')
                nx = None if fx in (None, '') else fx
                ny = None if fy in (None, '') else fy
                if isinstance(nx, str) and nx.startswith('=') or isinstance(ny, str) and str(ny).startswith('='):
                    if str(nx).replace(' ', '') != str(ny).replace(' ', ''):
                        problems.append(f'{ref}: formula {nx!r} vs {ny!r}')
                elif isinstance(nx, (int, float)) and isinstance(ny, (int, float)):
                    pass
                elif nx != ny:
                    pass  # plain text/value already compared above
    print(f'{checked} cells compared across {len(sf.sheetnames)} sheets; {len(problems)} differences')
    for p in problems[:80]:
        print('  ', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
