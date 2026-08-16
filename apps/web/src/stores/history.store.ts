import { create } from 'zustand'
import type { Background, Layer, Project } from '@/types'

/**
 * Coalescing rule: snapshots are PRE-state. When a burst of edits shares a
 * coalesce key (e.g. `layer:abc:opacity` during a slider drag), the FIRST
 * pre-state is kept and only the timestamp refreshes — the whole burst then
 * collapses into a single undo step restoring the state from before the drag.
 */
const COALESCE_WINDOW_MS = 1200

export interface ScreenHistorySnapshot {
  kind: 'screen'
  screenId: string
  layers: Layer[]
  background: Background
}

export interface ProjectHistorySnapshot {
  kind: 'project'
  project: Project
}

export type HistorySnapshot = ScreenHistorySnapshot | ProjectHistorySnapshot

interface HistoryState {
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  maxHistory: number
  lastCoalesceKey: string | null
  lastRecordedAt: number

  record: (snapshot: HistorySnapshot, coalesceKey?: string) => void
  undo: (currentSnapshot: HistorySnapshot) => HistorySnapshot | null
  redo: (currentSnapshot: HistorySnapshot) => HistorySnapshot | null
  clear: () => void
}

function sameProject(left: Project, right: Project): boolean {
  /* Les horodatages ne sont pas du contenu : deux captures du même projet à
     deux instants doivent se dédupliquer, comme le fait déjà le chemin écrans
     qui ne compare que les références de calques et de fond. */
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.activeScreenId === right.activeScreenId &&
    left.globals === right.globals &&
    left.layoutLayers === right.layoutLayers &&
    left.locales === right.locales &&
    left.releases === right.releases &&
    left.screens.length === right.screens.length &&
    left.screens.every((screen, index) => {
      const other = right.screens[index]
      return (
        screen.id === other.id &&
        screen.name === other.name &&
        screen.layers === other.layers &&
        screen.background === other.background
      )
    })
  )
}

function sameSnapshot(left: HistorySnapshot | undefined, right: HistorySnapshot): boolean {
  if (!left || left.kind !== right.kind) return false
  if (left.kind === 'project' && right.kind === 'project') {
    return sameProject(left.project, right.project)
  }
  return (
    left.kind === 'screen' &&
    right.kind === 'screen' &&
    left.screenId === right.screenId &&
    left.layers === right.layers &&
    left.background === right.background
  )
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
        coalesceKey &&
        coalesceKey === state.lastCoalesceKey &&
        now - state.lastRecordedAt < COALESCE_WINDOW_MS
      ) {
        return { lastRecordedAt: now, future: [] }
      }
      if (sameSnapshot(state.past[state.past.length - 1], snapshot)) {
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
