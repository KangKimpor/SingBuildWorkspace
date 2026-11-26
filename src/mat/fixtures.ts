/**
 * Dev-only stress fixtures for the material list, shaped exactly like `kw_mat_load` output.
 * Loaded only through `devDataset()` (see devData.ts) and never in a production build.
 * Keep the worst case: it is the regression test for the next change to the table.
 */
import { reportingDate, weekStart, addDays } from '@/nbc/submissions'
import type { MatPackage, MatRemark } from './api'
import type { DevDataset } from './devData'
import type { MatData, MatEdits, MatItem, Pkg, Sheet, Source } from './types'

const PCT_FORMULAS: MatData['cells'] = {
  placed: { f: 'placedPoOverTotal' }, production: { f: 'shdOverPo' }, notYetPo: { f: 'notYetPo' },
  waiting: { f: 'waiting' }, arrived: { f: 'arrived' }, remaining: { f: 'totalMinusOnsite' },
}
const v = (value: number | string | null): Source => ({ v: value })

let seq = 0
function row(pkg: Pkg, sheet: Sheet, kind: MatItem['kind'], data: MatData, extra: Partial<MatItem> = {}): MatItem {
  seq++
  return {
    id: `${pkg}-${sheet}-${seq}`, package: pkg, sheet, pos: seq, kind, data,
    edits: {}, updatedAt: '2026-11-20T08:00:00Z', changedWeek: null, weekEdits: null, ...extra,
  }
}
const section = (pkg: Pkg, sheet: Sheet, no: string, description: string, level = 0) =>
  row(pkg, sheet, 'section', { cols: { no, description }, cells: {}, level })

function item(pkg: Pkg, sheet: Sheet, cols: MatData['cols'], qty: [number | string | null, number | string | null, number | string | null, number | string | null], extra: Partial<MatData> = {}, meta: Partial<MatItem> = {}) {
  const [total, po, shd, onsite] = qty
  return row(pkg, sheet, 'item', {
    cols, cells: { total: v(total), po: v(po), shd: v(shd), onsite: v(onsite), shipping: v(0), ...PCT_FORMULAS }, ...extra,
  }, meta)
}

function demo(pkg: Pkg, week: string): MatPackage {
  const items: MatItem[] = []
  for (const sheet of ['id', 'mep'] as const) {
    const pre = sheet === 'id' ? 'ID' : 'ME'
    items.push(section(pkg, sheet, 'A', sheet === 'id' ? 'Flooring' : 'Electrical'))
    items.push(item(pkg, sheet, { no: 1, code: `${pre}-FL-01`, description: 'Porcelain tile 600×600', pic: 'Dara', brand: 'Kohler', location: 'Lobby', msStatus: 'Approved', msPlan: '2026-10-02', msActual: '2026-10-04', unit: 'm²' }, [420, 420, 400, 380], { mark: 'done' }))
    items.push(item(pkg, sheet, { no: 2, code: `${pre}-FL-02`, description: 'Carpet tile', pic: 'Sokha', brand: 'Interface', location: 'Level 3', msStatus: 'Under Review', msPlan: '2026-11-10', unit: 'm²' }, [860, 300, 0, 0], { mark: 'tracking' }))
    items.push(section(pkg, sheet, 'B', sheet === 'id' ? 'Ceiling' : 'Lighting'))
    items.push(item(pkg, sheet, { no: 3, code: `${pre}-CL-01`, description: 'Gypsum board ceiling', pic: 'Dara', brand: 'Gyproc', location: 'Corridor', msStatus: 'Not Yet Submit', unit: 'm²' }, [1200, 0, 0, 0]))
    items.push(item(pkg, sheet, { no: 4, code: `${pre}-CL-02`, description: 'Acoustic panel', pic: 'Vanna', brand: 'Armstrong', location: 'Meeting rooms', msStatus: 'Approved', unit: 'pcs' }, [96, 96, 96, 96], { mark: 'done' }))
  }
  return { week, now: new Date().toISOString(), items, remarks: [], log: [], people: {} }
}

const LONG_DESC = 'Supply and install 12 mm thick tempered laminated safety glass partition with 1.52 mm PVB interlayer, polished edges, frameless system with concealed top track, floor channel and stainless steel patch fittings (SUS 316, satin finish) including all sealant, gaskets and fixing accessories as per drawing ID-GL-201 Rev. C and specification Section 08 81 00'
const KHMER = 'ក្រឡាក្បឿងសេរ៉ាមិច ៦០០×៦០០ សម្រាប់ជាន់ផ្ទះល្វែង (ទិញក្នុងស្រុក)'
const LONG_REMARK = 'Supplier confirmed revised ETA after customs hold at Sihanoukville port.\nContainer MSKU 7781234 released 18 Nov; trucking booked for 21 Nov.\nPending: consultant sign-off on colour variance (batch B vs. approved sample) — see RFI-ID-0142. If not approved by 28 Nov, fall back to local stock from Phnom Penh warehouse (approx. 60% of qty).'

function worst(pkg: Pkg, week: string): MatPackage {
  const last = addDays(week, -7), before = addDays(week, -14)
  const items: MatItem[] = []
  const remarks: MatRemark[] = []
  const changed = (edits: MatEdits, weekEdits: MatEdits = {}): Partial<MatItem> => ({ edits, changedWeek: week, weekEdits })
  for (const sheet of ['id', 'mep'] as const) {
    const pre = sheet === 'id' ? 'ID' : 'MEP'
    items.push(section(pkg, sheet, 'A', 'ARCHITECTURAL INTERIOR FINISHES — LEVEL 1 TO LEVEL 12 PUBLIC AREAS, LIFT LOBBIES, CORRIDORS AND PREFUNCTION (EXCLUDING TENANT FIT-OUT ZONES)'))
    items.push(section(pkg, sheet, 'A.1', 'Glazed partitions & doors', 1))
    // 1. Longest description, long brand, every optional field filled.
    items.push(item(pkg, sheet, {
      no: 1, code: `${pre}-GL-0012A-REV3`, description: LONG_DESC, pic: 'Aleksandra Wiśniewska-Kowalczyk', bp02: 'Approved with comments',
      location: 'Level 1 Main Lobby, Level 2 Prefunction, Level 7 Sky Lounge & Level 12 Executive Floor',
      spec: '12 mm tempered laminated, PVB 1.52 mm, U-value 5.6 W/m²K, SHGC 0.62, EN 12150-1 / EN 14449, fire rating EI 30 where shown',
      brand: 'Saint-Gobain Glass Solutions (Thailand) Co., Ltd. via Northwind Industries Holdings', source: 'Imported — Rayong, Thailand',
      msPlan: '2026-09-14', msActual: '2026-09-30', msApproved: '2026-10-21', msStatus: 'Approved with comments',
      ssPlan: '2026-09-14', ssActual: 'TBC — awaiting consultant', poPlan: '2026-10-25', unit: 'm²', lastUpdated: '2026-11-19',
    }, [1284500.75, 1284500.75, 642250, 98], { mark: 'tracking', images: { image: Array.from({ length: 10 }, () => 'missing-image-ref.webp'), sample: [] } },
    changed({ onsite: 98, msStatus: 'Approved with comments' }, { onsite: 12 })))
    // 2. No code, one-letter PIC, emoji in brand, text in quantity cells.
    items.push(item(pkg, sheet, {
      no: 2, code: null, description: 'Door', pic: 'Jo', brand: '🇰🇭 Local', location: '—',
      msStatus: 'Revise & Resubmit', msPlan: '2026-08-01', unit: 'set',
    }, ['As per BOQ', 'TBC', null, null], { notes: { total: '=296+8' } }))
    // 3. Khmer description, all-empty optional fields.
    items.push(item(pkg, sheet, { no: 3, code: `${pre}-FL-003`, description: KHMER, pic: 'សុខា', unit: 'm²' }, [0, 0, 0, 0], {}))
    // 4. Completed 100%, override values, long remarks this week.
    const r4 = item(pkg, sheet, {
      no: 4, code: `${pre}-CL-ACOUSTIC-PANEL-FABRIC-WRAPPED-25MM`, description: 'Fabric-wrapped acoustic wall panel 25 mm', pic: 'Bartholomew Fitzgerald-Montgomery III',
      brand: 'Armstrong', location: 'Auditorium', msStatus: 'Information only', unit: 'pcs',
    }, [96, 96, 96, 96], { mark: 'done' }, changed({ placed: 1, arrived: 1 }, {}))
    items.push(r4)
    remarks.push({ itemId: r4.id, team: 'purchase', weekStart: week, body: LONG_REMARK })
    remarks.push({ itemId: r4.id, team: 'purchase', weekStart: last, body: 'Waiting on PI.' })
    remarks.push({ itemId: r4.id, team: 'purchase', weekStart: before, body: LONG_REMARK })
    remarks.push({ itemId: r4.id, team: 'pm', weekStart: week, body: 'Escalate to client PM on Thursday site meeting; ask for written approval of batch B.' })
    // 5. Omitted, negative remaining, date-ish free text.
    items.push(item(pkg, sheet, {
      no: '5a', code: `${pre}-WP-005`, description: 'Wallpaper (vinyl, Type 2)', pic: 'Dara', brand: '-/-', location: 'Level 4 – 11 guest corridors',
      msStatus: 'Rejected', msPlan: '31/11/2026', poActual: 'n/a', unit: 'roll',
    }, [40, 52, 52, 60], { mark: 'omit' }))
    items.push(section(pkg, sheet, 'A.1.1', 'Sub-section with a very long nested name that keeps going past the frozen columns', 2))
    for (let i = 6; i <= 14; i++) {
      items.push(item(pkg, sheet, {
        no: i, code: `${pre}-GEN-${String(i).padStart(3, '0')}`, description: `Generic item ${i}`, pic: i % 2 ? 'Vanna' : 'Sokha',
        brand: 'Generic', location: 'Back of house', msStatus: 'Under Review', unit: 'lot',
      }, [i * 10, i * 3, 0, 0]))
    }
    // Empty section: covers no items.
    items.push(section(pkg, sheet, 'B', 'Empty section (no items yet)'))
  }
  return { week, now: new Date().toISOString(), items, remarks, log: [], people: {} }
}

function one(pkg: Pkg, week: string): MatPackage {
  const items: MatItem[] = []
  for (const sheet of ['id', 'mep'] as const) {
    items.push(section(pkg, sheet, 'A', 'Flooring'))
    items.push(item(pkg, sheet, { no: 1, code: 'FL-01', description: 'Porcelain tile', pic: 'Dara', msStatus: 'Approved', unit: 'm²' }, [1, 1, 1, 1], {}, { edits: { onsite: 1 }, changedWeek: week, weekEdits: {} }))
  }
  return { week, now: new Date().toISOString(), items, remarks: [], log: [], people: {} }
}

function huge(pkg: Pkg, week: string): MatPackage {
  const items: MatItem[] = []
  const statuses = ['Not Yet Submit', 'Under Review', 'Approved', 'Approved with comments', 'Revise & Resubmit']
  for (const sheet of ['id', 'mep'] as const) {
    for (let s = 0; s < 40; s++) {
      items.push(section(pkg, sheet, String(s + 1), `Section ${s + 1}`))
      for (let i = 0; i < 25; i++) {
        const n = s * 25 + i + 1
        items.push(item(pkg, sheet, {
          no: n, code: `${sheet.toUpperCase()}-${String(n).padStart(4, '0')}`, description: `Material ${n}`, pic: ['Dara', 'Sokha', 'Vanna'][n % 3],
          brand: 'Generic', location: `Level ${(n % 12) + 1}`, msStatus: statuses[n % statuses.length], unit: 'pcs',
        }, [n, n % 7 ? n : 0, 0, n % 5 ? 0 : n], n % 11 ? {} : { mark: 'done' }))
      }
    }
  }
  return { week, now: new Date().toISOString(), items, remarks: [], log: [], people: {} }
}

export function fixturePackage(dataset: DevDataset, pkg: Pkg): MatPackage {
  seq = 0
  const week = weekStart(reportingDate())
  if (dataset === 'empty') return { week, now: new Date().toISOString(), items: [], remarks: [], log: [], people: {} }
  return { demo, worst, one, huge }[dataset](pkg, week)
}
