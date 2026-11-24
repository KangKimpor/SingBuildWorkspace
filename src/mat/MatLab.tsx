/**
 * Dev-only stress route for the material list: /__lab/mat?data=worst. App.tsx mounts it only
 * when `import.meta.env.DEV`, outside the sign-in gate; fetches and saves go to fixtures.ts.
 */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import MaterialTracker from './MaterialTracker'
import { DEV_DATASETS, devDataset } from './devData'
import type { DevDataset } from './devData'

const LABELS: Record<DevDataset, string> = { demo: 'Demo data', worst: 'Worst case', empty: 'Empty', one: 'One', huge: '1,000 rows' }

export default function MatLab() {
  const [params, setParams] = useSearchParams()
  const dataset = devDataset()
  useEffect(() => {
    if (!dataset) setParams((prev) => { prev.set('data', 'worst'); return prev }, { replace: true })
  }, [dataset, setParams])
  if (!dataset) return null
  return <>
    <MaterialTracker key={`${dataset}:${params.get('p') ?? ''}`}/>
    <div role="group" aria-label="Fixture data" style={{
      position: 'fixed', left: '50%', bottom: 16, translate: '-50% 0', zIndex: 100, display: 'flex', gap: 2, padding: 2,
      borderRadius: 8, background: '#e5e5ea', font: '12px system-ui, sans-serif', boxShadow: '0 1px 4px rgb(0 0 0 / 0.12)',
    }}>
      {DEV_DATASETS.map((d) => <button key={d} type="button" aria-pressed={d === dataset}
        onClick={() => setParams((prev) => { prev.set('data', d); return prev })}
        style={{ border: 0, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', font: 'inherit',
          background: d === dataset ? '#fff' : 'transparent', color: '#1d1d1f', boxShadow: d === dataset ? '0 1px 2px rgb(0 0 0 / 0.12)' : 'none' }}>
        {LABELS[d]}
      </button>)}
    </div>
  </>
}
