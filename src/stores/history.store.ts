import { create } from 'zustand'

interface HistoryState {
  past: string[]
  future: string[]
  maxHistory: number

  record: (snapshot: string) => void
  undo: (currentSnapshot: string) => string | null
  redo: (currentSnapshot: string) => string | null
  clear: () => void
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,

  record: (snapshot) =>
    set((state) => {
      if (state.past[state.past.length - 1] === snapshot) return { future: [] }
      return {
        past: [...state.past, snapshot].slice(-state.maxHistory),
        future: [],
      }
    }),

  undo: (currentSnapshot) => {
    const { past, future } = get()
    const previous = past[past.length - 1]
    if (!previous) return null
    set({
      past: past.slice(0, -1),
      future: [...future, currentSnapshot],
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
    })
    return next
  },

  clear: () => set({ past: [], future: [] }),
}))
