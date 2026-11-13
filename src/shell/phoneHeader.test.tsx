import { act, render, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { usePhoneHeader, usePhoneHeaderState } from './phoneHeader'
import type { PhoneHeader } from './phoneHeader'

function Screen(props: PhoneHeader) {
  usePhoneHeader(props)
  return null
}

test('registers and clears', () => {
  const state = renderHook(() => usePhoneHeaderState())
  const screen = render(<Screen title="A" back="/x" />)
  expect(state.result.current).toEqual({ title: 'A', back: '/x' })
  screen.unmount()
  expect(state.result.current).toBeNull()
})

test('latest wins', () => {
  const state = renderHook(() => usePhoneHeaderState())
  const first = render(<Screen title="First" />)
  const second = render(<Screen title="Second" />)
  expect(state.result.current?.title).toBe('Second')
  second.unmount()
  expect(state.result.current?.title).toBe('First')
  first.unmount()
  expect(state.result.current).toBeNull()
})

test('a nested screen wins over its layout', () => {
  const state = renderHook(() => usePhoneHeaderState())
  const Child = () => <Screen title="Child" />
  function Layout() {
    usePhoneHeader({ title: 'Layout' })
    return <Child />
  }
  const view = render(<Layout />)
  expect(state.result.current?.title).toBe('Child')
  view.unmount()
})

test('a fresh object and new actions each render update without looping', () => {
  const state = renderHook(() => usePhoneHeaderState())
  const renders = vi.fn()
  function Counter() {
    const [n, setN] = useState(0)
    renders()
    usePhoneHeader({ title: 'Count', actions: <button onClick={() => setN(n + 1)}>{n}</button> })
    return null
  }
  type Action = { props: { onClick: () => void; children: number } }
  const action = () => state.result.current!.actions as Action
  const view = render(<Counter />)
  act(() => action().props.onClick())
  expect(renders).toHaveBeenCalledTimes(2)
  expect(action().props.children).toBe(1)
  view.unmount()
})
