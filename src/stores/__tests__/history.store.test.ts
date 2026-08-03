import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useHistoryStore,
  type ScreenHistorySnapshot,
} from '@/stores/history.store'
import type { Background, Layer } from '@/types'

const background: Background = { type: 'solid', color: '#000000' }
const layers: Layer[] = []

function snapshot(
  screenId: string,
  nextLayers: Layer[] = [],
  nextBackground: Background = background,
): ScreenHistorySnapshot {
  return { kind: 'screen', screenId, layers: nextLayers, background: nextBackground }
}

describe('history store', () => {
  beforeEach(() => {
    vi.useRealTimers()
    useHistoryStore.setState({
      past: [],
      future: [],
      maxHistory: 50,
      lastCoalesceKey: null,
      lastRecordedAt: 0,
    })
  })

  it('keeps the first pre-state in a coalesced burst', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const first = snapshot('screen-1', layers)
    useHistoryStore.getState().record(first, 'layer:1:x')
    vi.advanceTimersByTime(500)
    useHistoryStore.getState().record(snapshot('screen-1'), 'layer:1:x')

    expect(useHistoryStore.getState().past).toEqual([first])
    expect(useHistoryStore.getState().undo(snapshot('screen-1'))).toBe(first)
  })

  it('starts a new step for a different key or an expired window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    useHistoryStore.getState().record(snapshot('a'), 'layer:1:x')
    vi.advanceTimersByTime(100)
    useHistoryStore.getState().record(snapshot('b'), 'layer:1:y')
    vi.advanceTimersByTime(1200)
    useHistoryStore.getState().record(snapshot('c'), 'layer:1:y')

    expect(useHistoryStore.getState().past).toHaveLength(3)
  })

  it('supports empty travel, redo invalidation and max history', () => {
    const history = useHistoryStore.getState()
    expect(history.undo(snapshot('current'))).toBeNull()
    expect(history.redo(snapshot('current'))).toBeNull()

    useHistoryStore.setState({ maxHistory: 2 })
    history.record(snapshot('a'))
    history.record(snapshot('b'))
    history.record(snapshot('c'))
    expect(useHistoryStore.getState().past.map((entry) => (
      entry.kind === 'screen' ? entry.screenId : 'project'
    ))).toEqual(['b', 'c'])

    expect(useHistoryStore.getState().undo(snapshot('current'))).not.toBeNull()
    useHistoryStore.getState().record(snapshot('new'))
    expect(useHistoryStore.getState().future).toEqual([])
  })

  it('deduplicates snapshots that share their data references', () => {
    useHistoryStore.getState().record(snapshot('screen-1', layers, background))
    useHistoryStore.getState().record(snapshot('screen-1', layers, background))
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })

  it('does not serialize while recording', () => {
    const stringify = vi.spyOn(JSON, 'stringify')
    for (let index = 0; index < 1000; index += 1) {
      useHistoryStore.getState().record(snapshot(`screen-${index}`))
    }
    expect(stringify).not.toHaveBeenCalled()
  })
})
