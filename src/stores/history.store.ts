import { create } from 'zustand'

/**
 * Coalescing rule: snapshots are PRE-state. When a burst of edits shares a
 * coalesce key (e.g. `layer:abc:opacity` during a slider drag), the FIRST
 * pre-state is kept and only the timestamp refreshes — the whole burst then
 * collapses into a single undo step restoring the state from before the drag.
 */
const COALESCE_WINDOW_MS = 1200

interface HistoryState {
  past: string[]
  future: string[]
  maxHistory: number
  lastCoalesceKey: string | null
  lastRecordedAt: number

  record: (snapshot: string, coalesceKey?: string) => void
  undo: (currentSnapshot: string) => string | null
  redo: (currentSnapshot: string) => string | null
  clear: () => void
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,
  lastCoalesceKey: null,
  lastRecordedAt: 0,

  record: (snapshot, coalesceKey) =>
    set((state) => {
      const now = Date.now()
      if (
        coalesceKey
        && coalesceKey === state.lastCoalesceKey
        && now - state.lastRecordedAt < COALESCE_WINDOW_MS
      ) {
        // Same burst: keep the first pre-state, just refresh the timer.
        return { lastRecordedAt: now, future: [] }
      }
      if (state.past[state.past.length - 1] === snapshot) {
        return { future: [], lastCoalesceKey: coalesceKey ?? null, lastRecordedAt: now }
      }
      return {
        past: [...state.past, snapshot].slice(-state.maxHistory),
        future: [],
        lastCoalesceKey: coalesceKey ?? null,
        lastRecordedAt: now,
      }
    }),

  undo: (currentSnapshot) => {
    const { past, future } = get()
    const previous = past[past.length - 1]
    if (!previous) return null
    set({
      past: past.slice(0, -1),
      future: [...future, currentSnapshot],
      lastCoalesceKey: null,
    })
    return previous
  },

  redo: (currentSnapshot) => {
    const { past, future, maxHistory } = get()
    const next = future[future.length - 1]
    if (!next) return null
    set({
      past: [...past, currentSnapshot].slice(-maxHistory),
      future: future.slice(0, -1),
      lastCoalesceKey: null,
    })
    return next
  },

  clear: () => set({ past: [], future: [], lastCoalesceKey: null, lastRecordedAt: 0 }),
}))
