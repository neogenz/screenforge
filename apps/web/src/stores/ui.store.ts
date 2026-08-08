import { create } from 'zustand'

type ActiveTool = 'select' | 'text' | 'shape' | 'image'
type Theme = 'light' | 'dark'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * `off` n'est pas un état d'erreur : c'est le mode par défaut du produit — pas
 * d'instance configurée, ou pas de session. Le témoin ne se rend pas du tout.
 */
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error'

interface UIState {
  zoom: number
  viewportResetKey: number
  layersOpen: boolean
  propsOpen: boolean
  /**
   * Un seul tiroir à la fois. Posé par la fenêtre, pas lu par le store : la
   * largeur est une donnée du navigateur, pas un état du produit.
   */
  exclusiveDrawers: boolean
  activeTool: ActiveTool
  showExportDialog: boolean
  showTemplatesPicker: boolean
  showGlobalsEditor: boolean
  showAuthDialog: boolean
  showCommandPalette: boolean
  showShortcuts: boolean
  theme: Theme
  saveStatus: SaveStatus
  syncStatus: SyncStatus

  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  toggleLayers: () => void
  toggleProps: () => void
  closeDrawers: () => void
  setExclusiveDrawers: (exclusive: boolean) => void
  setActiveTool: (tool: ActiveTool) => void
  setShowExportDialog: (show: boolean) => void
  setShowTemplatesPicker: (show: boolean) => void
  setShowGlobalsEditor: (show: boolean) => void
  setShowAuthDialog: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setShowShortcuts: (show: boolean) => void
  toggleTheme: () => void
  setSaveStatus: (status: SaveStatus) => void
  setSyncStatus: (status: SyncStatus) => void
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
  exclusiveDrawers: false,
  activeTool: 'select',
  showExportDialog: false,
  showTemplatesPicker: false,
  showGlobalsEditor: false,
  showAuthDialog: false,
  showCommandPalette: false,
  showShortcuts: false,
  theme: getInitialTheme(),
  saveStatus: 'idle',
  syncStatus: 'off',

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom + ZOOM_STEP) })),

  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom - ZOOM_STEP) })),

  resetZoom: () => set((s) => ({ zoom: 1, viewportResetKey: s.viewportResetKey + 1 })),

  // Ouvrir chasse l'autre quand la fenêtre ne peut plus en porter deux ;
  // fermer ne rouvre jamais rien.
  toggleLayers: () =>
    set((state) => {
      const layersOpen = !state.layersOpen
      return {
        layersOpen,
        propsOpen: layersOpen && state.exclusiveDrawers ? false : state.propsOpen,
      }
    }),

  toggleProps: () =>
    set((state) => {
      const propsOpen = !state.propsOpen
      return {
        propsOpen,
        layersOpen: propsOpen && state.exclusiveDrawers ? false : state.layersOpen,
      }
    }),

  closeDrawers: () => set({ layersOpen: false, propsOpen: false }),

  // En passant sous le seuil avec les deux ouverts, Calques cède : Propriétés
  // est la surface d'édition, Calques la navigation, et on garde ce qui édite.
  setExclusiveDrawers: (exclusive) =>
    set((state) => ({
      exclusiveDrawers: exclusive,
      layersOpen: exclusive && state.propsOpen ? false : state.layersOpen,
    })),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setShowExportDialog: (show) =>
    set({
      showExportDialog: show,
      ...(show
        ? {
            showTemplatesPicker: false,
            showGlobalsEditor: false,
            showAuthDialog: false,
            showShortcuts: false,
          }
        : {}),
    }),

  setShowTemplatesPicker: (show) =>
    set({
      showTemplatesPicker: show,
      ...(show
        ? {
            showExportDialog: false,
            showGlobalsEditor: false,
            showAuthDialog: false,
            showShortcuts: false,
          }
        : {}),
    }),

  setShowGlobalsEditor: (show) =>
    set({
      showGlobalsEditor: show,
      ...(show
        ? {
            showExportDialog: false,
            showTemplatesPicker: false,
            showAuthDialog: false,
            showShortcuts: false,
          }
        : {}),
    }),

  setShowAuthDialog: (show) =>
    set({
      showAuthDialog: show,
      ...(show
        ? {
            showExportDialog: false,
            showTemplatesPicker: false,
            showGlobalsEditor: false,
            showShortcuts: false,
          }
        : {}),
    }),

  setShowCommandPalette: (show) => set({ showCommandPalette: show }),

  setShowShortcuts: (show) =>
    set({
      showShortcuts: show,
      ...(show
        ? {
            showExportDialog: false,
            showTemplatesPicker: false,
            showGlobalsEditor: false,
            showAuthDialog: false,
          }
        : {}),
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

  setSyncStatus: (syncStatus) => set({ syncStatus }),
}))
