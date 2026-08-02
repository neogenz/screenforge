import { create } from 'zustand'

type ActiveTool = 'select' | 'text' | 'shape' | 'image'
type Theme = 'light' | 'dark'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UIState {
  zoom: number
  viewportResetKey: number
  layersOpen: boolean
  propsOpen: boolean
  activeTool: ActiveTool
  showExportDialog: boolean
  showTemplatesPicker: boolean
  showGlobalsEditor: boolean
  showCommandPalette: boolean
  showShortcuts: boolean
  theme: Theme
  saveStatus: SaveStatus

  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  toggleLayers: () => void
  toggleProps: () => void
  closeDrawers: () => void
  setActiveTool: (tool: ActiveTool) => void
  setShowExportDialog: (show: boolean) => void
  setShowTemplatesPicker: (show: boolean) => void
  setShowGlobalsEditor: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setShowShortcuts: (show: boolean) => void
  toggleTheme: () => void
  setSaveStatus: (status: SaveStatus) => void
}

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

function clampZoom(zoom: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('screenforge-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
  } catch (error) {
    console.warn('Could not read the saved theme.', error)
  }
  return 'dark'
}

export const useUIStore = create<UIState>()((set) => ({
  zoom: 1,
  viewportResetKey: 0,
  layersOpen: true,
  propsOpen: true,
  activeTool: 'select',
  showExportDialog: false,
  showTemplatesPicker: false,
  showGlobalsEditor: false,
  showCommandPalette: false,
  showShortcuts: false,
  theme: getInitialTheme(),
  saveStatus: 'idle',

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom + ZOOM_STEP) })),

  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom - ZOOM_STEP) })),

  resetZoom: () =>
    set((s) => ({ zoom: 1, viewportResetKey: s.viewportResetKey + 1 })),

  toggleLayers: () =>
    set((state) => ({ layersOpen: !state.layersOpen })),

  toggleProps: () =>
    set((state) => ({ propsOpen: !state.propsOpen })),

  closeDrawers: () => set({ layersOpen: false, propsOpen: false }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setShowExportDialog: (show) => set({
    showExportDialog: show,
    ...(show ? { showTemplatesPicker: false, showGlobalsEditor: false, showShortcuts: false } : {}),
  }),

  setShowTemplatesPicker: (show) => set({
    showTemplatesPicker: show,
    ...(show ? { showExportDialog: false, showGlobalsEditor: false, showShortcuts: false } : {}),
  }),

  setShowGlobalsEditor: (show) => set({
    showGlobalsEditor: show,
    ...(show ? { showExportDialog: false, showTemplatesPicker: false, showShortcuts: false } : {}),
  }),

  setShowCommandPalette: (show) => set({ showCommandPalette: show }),

  setShowShortcuts: (show) => set({
    showShortcuts: show,
    ...(show ? { showExportDialog: false, showTemplatesPicker: false, showGlobalsEditor: false } : {}),
  }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('screenforge-theme', next)
      } catch (error) {
        console.warn('Could not persist the theme.', error)
      }
      return { theme: next }
    }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),
}))
