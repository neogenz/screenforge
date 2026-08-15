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
  showAccountDialog: boolean
  showPricingDialog: boolean
  showMigrateDialog: boolean
  showRefreshDialog: boolean
  showReleaseDialog: boolean
  showCampaignDialog: boolean
  showLocaleDialog: boolean
  showPublishDialog: boolean
  showMcpDialog: boolean
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
  setShowAccountDialog: (show: boolean) => void
  setShowPricingDialog: (show: boolean) => void
  setShowMigrateDialog: (show: boolean) => void
  setShowRefreshDialog: (show: boolean) => void
  setShowReleaseDialog: (show: boolean) => void
  setShowCampaignDialog: (show: boolean) => void
  setShowLocaleDialog: (show: boolean) => void
  setShowPublishDialog: (show: boolean) => void
  setShowMcpDialog: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setShowShortcuts: (show: boolean) => void
  toggleTheme: () => void
  setSaveStatus: (status: SaveStatus) => void
  setSyncStatus: (status: SyncStatus) => void
}

/**
 * Les surfaces modales, qui s'excluent l'une l'autre.
 *
 * Une seule liste, parce que chaque setter énumérait auparavant tous ses
 * voisins : à cinq boîtes, cela faisait vingt lignes à tenir d'accord, et la
 * sixième en aurait demandé cinq de plus dans cinq fonctions différentes. Une
 * seule oubliée et deux dialogues s'empilent.
 *
 * La palette de commandes n'en est pas : elle s'ouvre par-dessus n'importe quoi
 * et c'est ce qui en fait une palette.
 */
const MODALS = [
  'showExportDialog',
  'showTemplatesPicker',
  'showGlobalsEditor',
  'showAuthDialog',
  'showAccountDialog',
  'showPricingDialog',
  'showMigrateDialog',
  'showRefreshDialog',
  'showReleaseDialog',
  'showCampaignDialog',
  'showLocaleDialog',
  'showPublishDialog',
  'showMcpDialog',
  'showShortcuts',
] as const

type ModalFlag = (typeof MODALS)[number]

/** Fermer ne ferme que soi ; ouvrir ferme tout le reste. */
function onlyModal(flag: ModalFlag, show: boolean): Partial<Record<ModalFlag, boolean>> {
  if (!show) return { [flag]: false }
  return Object.fromEntries(MODALS.map((modal) => [modal, modal === flag]))
}

const ZOOM_STEP = 0.25
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4

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
  showAccountDialog: false,
  showPricingDialog: false,
  showMigrateDialog: false,
  showRefreshDialog: false,
  showReleaseDialog: false,
  showCampaignDialog: false,
  showLocaleDialog: false,
  showPublishDialog: false,
  showMcpDialog: false,
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

  setShowExportDialog: (show) => set(onlyModal('showExportDialog', show)),

  setShowTemplatesPicker: (show) => set(onlyModal('showTemplatesPicker', show)),

  setShowGlobalsEditor: (show) => set(onlyModal('showGlobalsEditor', show)),

  setShowAuthDialog: (show) => set(onlyModal('showAuthDialog', show)),
  setShowAccountDialog: (show) => set(onlyModal('showAccountDialog', show)),

  setShowPricingDialog: (show) => set(onlyModal('showPricingDialog', show)),
  setShowMigrateDialog: (show) => set(onlyModal('showMigrateDialog', show)),

  setShowRefreshDialog: (show) => set(onlyModal('showRefreshDialog', show)),

  setShowReleaseDialog: (show) => set(onlyModal('showReleaseDialog', show)),

  setShowCampaignDialog: (show) => set(onlyModal('showCampaignDialog', show)),

  setShowLocaleDialog: (show) => set(onlyModal('showLocaleDialog', show)),

  setShowPublishDialog: (show) => set(onlyModal('showPublishDialog', show)),

  setShowMcpDialog: (show) => set(onlyModal('showMcpDialog', show)),

  setShowCommandPalette: (show) => set({ showCommandPalette: show }),

  setShowShortcuts: (show) => set(onlyModal('showShortcuts', show)),

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
