import { create } from 'zustand'

type ActiveTool = 'select' | 'text' | 'shape' | 'image'
type Theme = 'light' | 'dark'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UIState {
  zoom: number
  viewportResetKey: number
  showLayersPanel: boolean
  showPropertiesPanel: boolean
  activeTool: ActiveTool
  showExportDialog: boolean
  showTemplatesPicker: boolean
  showGlobalsEditor: boolean
  theme: Theme
  saveStatus: SaveStatus

  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  toggleLayersPanel: () => void
  togglePropertiesPanel: () => void
  setActiveTool: (tool: ActiveTool) => void
  setShowExportDialog: (show: boolean) => void
  setShowTemplatesPicker: (show: boolean) => void
  setShowGlobalsEditor: (show: boolean) => void
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
  return 'light'
}

export const useUIStore = create<UIState>()((set) => ({
  zoom: 1,
  viewportResetKey: 0,
  showLayersPanel: true,
  showPropertiesPanel: true,
  activeTool: 'select',
  showExportDialog: false,
  showTemplatesPicker: false,
  showGlobalsEditor: false,
  theme: getInitialTheme(),
  saveStatus: 'idle',

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom + ZOOM_STEP) })),

  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom - ZOOM_STEP) })),

  resetZoom: () =>
    set((s) => ({ zoom: 1, viewportResetKey: s.viewportResetKey + 1 })),

  toggleLayersPanel: () =>
    set((state) => ({ showLayersPanel: !state.showLayersPanel })),

  togglePropertiesPanel: () =>
    set((state) => ({ showPropertiesPanel: !state.showPropertiesPanel })),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setShowExportDialog: (show) => set({
    showExportDialog: show,
    ...(show ? { showTemplatesPicker: false, showGlobalsEditor: false } : {}),
  }),

  setShowTemplatesPicker: (show) => set({
    showTemplatesPicker: show,
    ...(show ? { showExportDialog: false, showGlobalsEditor: false } : {}),
  }),

  setShowGlobalsEditor: (show) => set({
    showGlobalsEditor: show,
    ...(show ? { showExportDialog: false, showTemplatesPicker: false } : {}),
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
