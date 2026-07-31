import { lazy, Suspense, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { ProjectIsland } from '@/components/toolbar/ProjectIsland'
import { ZoomHud } from '@/components/toolbar/ZoomHud'
import { LayersPanel } from '@/components/layers-panel/LayersPanel'
import CanvasEditor from '@/components/canvas/CanvasEditor'
import { PropertiesPanel } from '@/components/properties-panel/PropertiesPanel'
import { ScreensBar } from '@/components/screens-bar/ScreensBar'
import { CommandPalette } from '@/components/ui/command-palette'
import { ShortcutsOverlay } from '@/components/ui/shortcuts-overlay'
import { ToastViewport } from '@/components/ui/toast'
import { toast } from '@/stores/toast.store'
import { useKeyboard } from '@/hooks/use-keyboard'
import { loadLatestProject, initAutoSave } from '@/lib/storage'
import { clearAssets } from '@/lib/assets'
import { createImageLayerFromFile } from '@/lib/layer-factories'
import { IMAGE_ACCEPT } from '@/lib/image'
import { LAYERS_PANEL_WIDTH, PROPERTIES_PANEL_WIDTH } from '@/lib/stage'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'

const ExportDialog = lazy(() =>
  import('@/components/export-dialog/ExportDialog').then((module) => ({ default: module.ExportDialog })),
)
const TemplatePicker = lazy(() =>
  import('@/components/template-picker/TemplatePicker').then((module) => ({ default: module.TemplatePicker })),
)
const GlobalsEditor = lazy(() =>
  import('@/components/globals-editor/GlobalsEditor').then((module) => ({ default: module.GlobalsEditor })),
)

export default function App() {
  useKeyboard()

  const {
    showLayersPanel,
    showPropertiesPanel,
    showExportDialog,
    showTemplatesPicker,
    showGlobalsEditor,
    showCommandPalette,
    showShortcuts,
    theme,
  } = useUIStore(
    useShallow((s) => ({
      showLayersPanel: s.showLayersPanel,
      showPropertiesPanel: s.showPropertiesPanel,
      showExportDialog: s.showExportDialog,
      showTemplatesPicker: s.showTemplatesPicker,
      showGlobalsEditor: s.showGlobalsEditor,
      showCommandPalette: s.showCommandPalette,
      showShortcuts: s.showShortcuts,
      theme: s.theme,
    })),
  )

  useEffect(() => {
    async function init() {
      const stored = await loadLatestProject()

      if (stored) {
        useProjectStore.getState().loadProject(stored)
        useUIStore.getState().setSaveStatus('saved')
        const activeScreen = stored.screens.find((screen) => screen.id === stored.activeScreenId)
          ?? stored.screens[0]
        if (activeScreen) {
          useCanvasStore.getState().setActiveScreenId(activeScreen.id)
        }
      } else {
        clearAssets()
        useProjectStore.getState().createProject('Projet sans titre')
        const project = useProjectStore.getState().project
        const activeScreen = project?.screens.find((screen) => screen.id === project.activeScreenId)
          ?? project?.screens[0]
        if (activeScreen) {
          useCanvasStore.getState().setActiveScreenId(activeScreen.id)
        }
      }
    }

    void init().catch((error) => {
      console.error('Could not initialize ScreenForge.', error)
    })

    const unsubscribe = initAutoSave()
    return unsubscribe
  }, [])

  async function handleImageImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { layers, addLayer } = useCanvasStore.getState()
    const result = await createImageLayerFromFile(file, layers.length)
    if (result.ok) addLayer(result.layer)
    else toast(result.error, 'error')
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-stage ${theme}`}>
      {/* Stage: full-bleed canvas */}
      <main className="absolute inset-0">
        <CanvasEditor />
      </main>
      <div aria-hidden className="stage-vignette pointer-events-none absolute inset-0 z-10" />

      {/* Floating chrome */}
      <div className="absolute left-3 top-3 z-20">
        <ProjectIsland />
      </div>
      <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
        <Toolbar />
      </div>

      {showLayersPanel && (
        <div
          className="absolute bottom-[168px] left-3 top-[60px] z-20"
          style={{ width: LAYERS_PANEL_WIDTH }}
        >
          <LayersPanel />
        </div>
      )}
      {showPropertiesPanel && (
        <div
          className="absolute bottom-[168px] right-3 top-[60px] z-20"
          style={{ width: PROPERTIES_PANEL_WIDTH }}
        >
          <PropertiesPanel />
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <ScreensBar />
      </div>
      <div className="absolute bottom-3 right-3 z-20">
        <ZoomHud />
      </div>

      <input
        id="sf-image-import-input"
        type="file"
        accept={IMAGE_ACCEPT}
        aria-label="Importer une image"
        className="sr-only"
        onChange={(event) => void handleImageImport(event)}
      />

      <CommandPalette
        open={showCommandPalette}
        onClose={() => useUIStore.getState().setShowCommandPalette(false)}
      />
      <ShortcutsOverlay
        open={showShortcuts}
        onClose={() => useUIStore.getState().setShowShortcuts(false)}
      />
      <ToastViewport />

      <Suspense fallback={null}>
        {showExportDialog && <ExportDialog />}
        {showTemplatesPicker && <TemplatePicker />}
        {showGlobalsEditor && <GlobalsEditor />}
      </Suspense>
    </div>
  )
}
