import { create } from 'zustand'

interface HistoryState {
  undoStack: string[]
  redoStack: string[]
  maxHistory: number

  pushSnapshot: (snapshot: string) => void
  undo: () => string | null
  redo: () => string | null
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxHistory: 50,

  pushSnapshot: (snapshot) =>
    set((state) => {
      const stack = [...state.undoStack, snapshot]
      // Cap at maxHistory
      if (stack.length > state.maxHistory) {
        stack.shift()
      }
      return { undoStack: stack, redoStack: [] }
    }),

  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return null
    const snapshot = undoStack[undoStack.length - 1]
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, snapshot],
    })
    return snapshot
  },

  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return null
    const snapshot = redoStack[redoStack.length - 1]
    set({
      undoStack: [...undoStack, snapshot],
      redoStack: redoStack.slice(0, -1),
    })
    return snapshot
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clear: () => set({ undoStack: [], redoStack: [] }),
}))
