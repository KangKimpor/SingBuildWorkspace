import { writeFileSync, mkdirSync } from 'node:fs'
import { test, expect } from '../workspace-test'
import type { Page } from '../workspace-test'
import { bp02Activities, bp02Project } from './bp02-fixture'

/**
 * Interaction timings for BP02 at iPad size: each value is the time from the input to the next
 * frame after React commits, measured inside the page so Chromium and WebKit report the same thing.
 * Run with `corepack pnpm perf:bp02`; results land in perf-results/bp02-<browser>[-PERF_TAG].json
 * (outside test-results, which Playwright empties on every run).
 */
test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })
test.setTimeout(600_000)

const RUNS = 5

async function seed(page: Page) {
  await page.route('https://**.supabase.co/**', (route) => route.abort())
  await page.goto('/')
  const content = { pages: [], tasks: [], events: [], projects: [bp02Project], nbc_activities: bp02Activities(), nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [] }
  await page.evaluate((content) => new Promise<void>((resolve, reject) => {
    localStorage.removeItem('kw-workspace-v1')
    const open = indexedDB.open('kimpor-workspace')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const tx = open.result.transaction('snapshots', 'readwrite')
      tx.objectStore('snapshots').put({ scope: 'guest', content })
      tx.oncomplete = () => { open.result.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  }), content)
}

type Action = { click: string; floor?: boolean } | { type: string; value: string }

/**
 * Runs `action` in the page and returns two times: `first`, to the first frame (what a tap or a key
 * press feels like), and `settled`, to the end of the last frame that still changed the DOM (when the
 * deferred matrix has caught up). `until` waits for a selector first, for route changes.
 */
async function time(page: Page, action: Action, until?: string) {
  return page.evaluate(async ({ action, until }) => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
    let changed = false
    const observer = new MutationObserver(() => { changed = true })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    const start = performance.now()
    let caption = ''
    if ('click' in action) {
      const el = document.querySelector<HTMLElement>(action.click)!
      // A floor button's label is the floor name, which the matrix caption repeats once it shows that floor.
      if (action.floor) caption = el.getAttribute('aria-label') ?? ''
      el.click()
    }
    else {
      const el = document.querySelector<HTMLInputElement>(action.type)!
      el.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, action.value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await frame()
    const first = performance.now() - start
    if (until) for (let i = 0; i < 600 && !document.querySelector(until); i++) await frame()
    if (caption) {
      for (let i = 0; i < 600 && !document.querySelector('.nbc-rooms caption')?.textContent?.includes(caption); i++) await frame()
      await frame()
      observer.disconnect()
      // For a floor, done means the new floor's matrix is on screen.
      return { first: Math.round(first), settled: Math.round(performance.now() - start) }
    }
    let settled = performance.now() - start
    for (let quiet = 0, i = 0; quiet < 3 && i < 600; i++) {
      changed = false
      await frame()
      if (changed) { quiet = 0; settled = performance.now() - start } else quiet++
    }
    observer.disconnect()
    return { first: Math.round(first), settled: Math.round(settled) }
  }, { action, until })
}

const click = (selector: string): Action => ({ click: selector })
const floor = (selector: string): Action => ({ click: selector, floor: true })
const type = (selector: string, value: string): Action => ({ type: selector, value })
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

test('BP02 interaction timings', async ({ page, browserName }) => {
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page)
    // Roughly an iPad's single-thread speed against a desktop CPU.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.PERF_CPU ?? 4) })
  }
  await seed(page)
  // Experiments: PERF_CSS adds a style sheet to every page load, to price a CSS rule before changing it.
  if (process.env.PERF_CSS) await page.addInitScript((css) => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s) }), process.env.PERF_CSS)
  const results: Record<string, number[]> = {}
  const record = (name: string, value: number | { first: number; settled: number }) => {
    if (typeof value === 'number') { (results[name] ??= []).push(value); return }
    ;(results[name] ??= []).push(value.settled)
    ;(results[`${name} · first frame`] ??= []).push(value.first)
  }

  const load = Date.now()
  await page.goto('/projects-progress/nbc-bp02/overview')
  await expect(page.locator('.nbc-project')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('.nbc-kpi').first()).toBeVisible({ timeout: 120_000 })
  record('open overview (wall)', Date.now() - load)

  for (let i = 0; i < RUNS; i++) {
    record('tab: Overview → Project Progress', await time(page, click('.nbc-tabs a[href$="/activities"]'), '.nbc-rooms'))
    record('progress: switch floor', await time(page, floor(`.nbc-activities .nbc-seg button:nth-child(${2 + (i % 3)})`)))
    record('progress: search keystroke', await time(page, type('.nbc-activities input[aria-label="Search activities"]', 'install'.slice(0, 1 + i))))
    await time(page, type('.nbc-activities input[aria-label="Search activities"]', ''))
    record('progress: collapse group', await time(page, click('.nbc-rooms tr[data-group=true] .nbc-toggle')))
    record('tab: Project Progress → Overview', await time(page, click('.nbc-tabs a[href$="/overview"]'), '.nbc-kpi'))
  }

  await page.goto('/projects-progress/nbc-bp02/update?handler=Tola')
  await expect(page.locator('.nbc-rooms input').first()).toBeVisible({ timeout: 120_000 })
  await time(page, click('.nbc-update .nbc-seg[aria-label="Show activities"] button:nth-child(3)'))
  for (let i = 0; i < RUNS; i++) {
    await page.evaluate((i) => {
      document.querySelector('[data-perf-target]')?.removeAttribute('data-perf-target')
      document.querySelectorAll('.nbc-rooms tbody tr[data-group="false"] input')[i * 7]!.setAttribute('data-perf-target', '')
    }, i)
    const cell = '[data-perf-target]'
    for (const value of ['4', '45', '45.5']) record('update: keystroke in a cell', await time(page, type(cell, value)))
    await page.waitForTimeout(600) // the 400 ms autosave would otherwise land inside the next measurement
    record('update: switch floor', await time(page, floor(`.nbc-update .nbc-seg[aria-label="Floor"] button:nth-child(${2 + (i % 3)})`)))
    record('update: collapse group', await time(page, click('.nbc-rooms tr[data-group=true] .nbc-toggle')))
    await page.waitForTimeout(600) // let the 400 ms autosave run between rounds
  }
  record('tab: Update → Project Progress', await time(page, click('.nbc-tabs a[href$="/activities"]'), '.nbc-activities .nbc-rooms'))

  const summary = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { median: median(v), max: Math.max(...v), runs: v }]))
  mkdirSync('perf-results', { recursive: true })
  writeFileSync(`perf-results/bp02-${browserName}${process.env.PERF_TAG ? `-${process.env.PERF_TAG}` : ''}.json`, JSON.stringify(summary, null, 2))
  console.log(browserName, Object.entries(summary).map(([k, v]) => `${k}: ${v.median} ms (max ${v.max})`).join('\n'))
})
