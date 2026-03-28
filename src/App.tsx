import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { LayersPanel } from '@/components/layers-panel/LayersPanel'
import CanvasEditor from '@/components/canvas/CanvasEditor'
import { PropertiesPanel } from '@/components/properties-panel/PropertiesPanel'
import { ScreensBar } from '@/components/screens-bar/ScreensBar'
import { ExportDialog } from '@/components/export-dialog/ExportDialog'
import { TemplatePicker } from '@/components/template-picker/TemplatePicker'
import { GlobalsEditor } from '@/components/globals-editor/GlobalsEditor'
import { useKeyboard } from '@/hooks/use-keyboard'
import { loadGoogleFont } from '@/hooks/use-fonts'
import { loadLatestProject, initAutoSave } from '@/lib/storage'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'

export default function App() {
  useKeyboard()

  const { showLayersPanel, showPropertiesPanel, theme } = useUIStore(
    useShallow((s) => ({
      showLayersPanel: s.showLayersPanel,
      showPropertiesPanel: s.showPropertiesPanel,
      theme: s.theme,
    })),
  )

  useEffect(() => {
    async function init() {
      Promise.all([
        loadGoogleFont('Inter', ['400', '500', '600', '700']),
        loadGoogleFont('DM Sans', ['400', '500', '600', '700']),
      ]).catch(() => {})

      const stored = await loadLatestProject()

      if (stored) {
        // Migrate orphaned layoutLayers back into the first screen
        if (stored.layoutLayers?.length) {
          const first = stored.screens[0]
          if (first) {
            const migrated = stored.layoutLayers.map((l) => {
              const { scope: _, ...rest } = l as typeof l & { scope?: string }
              return rest
            })
            first.layers = [...migrated, ...first.layers]
          }
          stored.layoutLayers = []
        }
        useProjectStore.getState().loadProject(stored)
        const firstScreen = stored.screens[0]
        if (firstScreen) {
          useCanvasStore.getState().setActiveScreenId(firstScreen.id)
        }
      } else {
        useProjectStore.getState().createProject('Untitled Project')
        const project = useProjectStore.getState().project
        const firstScreen = project?.screens[0]
        if (firstScreen) {
          useCanvasStore.getState().setActiveScreenId(firstScreen.id)
        }
      }
    }

    init().catch(console.error)

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

      <footer className="relative z-20 box-border h-32 shrink-0 overflow-x-auto overflow-y-visible border-t border-border">
        <ScreensBar />
      </footer>

      <ExportDialog />
      <TemplatePicker />
      <GlobalsEditor />
    </div>
  )
}
