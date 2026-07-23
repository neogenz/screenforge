import { lazy, Suspense, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { LayersPanel } from '@/components/layers-panel/LayersPanel'
import CanvasEditor from '@/components/canvas/CanvasEditor'
import { PropertiesPanel } from '@/components/properties-panel/PropertiesPanel'
import { ScreensBar } from '@/components/screens-bar/ScreensBar'
import { useKeyboard } from '@/hooks/use-keyboard'
import { loadGoogleFont } from '@/hooks/use-fonts'
import { loadLatestProject, initAutoSave } from '@/lib/storage'
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
    theme,
  } = useUIStore(
    useShallow((s) => ({
      showLayersPanel: s.showLayersPanel,
      showPropertiesPanel: s.showPropertiesPanel,
      showExportDialog: s.showExportDialog,
      showTemplatesPicker: s.showTemplatesPicker,
      showGlobalsEditor: s.showGlobalsEditor,
      theme: s.theme,
    })),
  )

  useEffect(() => {
    async function init() {
      const editorFonts = Promise.all([
        loadGoogleFont('Space Grotesk', ['400', '500', '600', '700']),
        loadGoogleFont('Space Mono', ['400', '700']),
      ])
      void editorFonts.then((results) => {
        for (const result of results) {
          if (result.status === 'fallback') {
            console.warn(`Could not preload ${result.family}. ${result.message ?? ''}`.trim())
          }
        }
      })

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

  return (
    <div className={`flex h-full min-h-0 w-full flex-col overflow-hidden bg-background ${theme}`}>
      <header className="shrink-0">
        <Toolbar />
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        {showLayersPanel && (
          <div className="box-border flex max-h-full min-h-0 w-60 shrink-0 flex-col overflow-hidden">
            <LayersPanel />
          </div>
        )}

        <main className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden">
          <CanvasEditor />
        </main>

        {showPropertiesPanel && (
          <div className="box-border flex max-h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden">
            <PropertiesPanel />
          </div>
        )}
      </div>

      <footer className="relative z-20 box-border h-36 shrink-0 overflow-x-auto overflow-y-visible">
        <ScreensBar />
      </footer>

      <Suspense fallback={null}>
        {showExportDialog && <ExportDialog />}
        {showTemplatesPicker && <TemplatePicker />}
        {showGlobalsEditor && <GlobalsEditor />}
      </Suspense>
    </div>
  )
}
