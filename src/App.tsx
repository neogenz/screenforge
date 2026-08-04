import { lazy, Suspense, useEffect, type CSSProperties } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Toaster } from 'sonner'
import { TopBar } from '@/components/toolbar/TopBar'
import { ZoomHud } from '@/components/toolbar/ZoomHud'
import { LayersDrawer } from '@/components/layers-panel/LayersDrawer'
import CanvasEditor from '@/components/canvas/CanvasEditor'
import { PropertiesDrawer } from '@/components/properties-panel/PropertiesDrawer'
import { ScreensBar } from '@/components/screens-bar/ScreensBar'
import { CommandPalette } from '@/components/ui/command-palette'
import { ShortcutsOverlay } from '@/components/ui/shortcuts-overlay'
import { toast } from '@/stores/toast.store'
import { useKeyboard } from '@/hooks/use-keyboard'
import { loadLatestProject, initAutoSave } from '@/lib/storage'
import { clearAssets } from '@/lib/assets'
import { createImageLayerFromFile } from '@/lib/layer-factories'
import { IMAGE_ACCEPT } from '@/lib/image'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
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

  const theme = useUIStore((s) => s.theme)

  // Le thème vit sur <html> : les portails (menus, dialogues, infobulles) montent
  // sur document.body et n'hériteraient pas d'une classe posée plus bas dans l'arbre.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    let disposed = false
    let stopAutoSave: (() => void) | undefined

    async function init() {
      try {
        const stored = await loadLatestProject()
        if (disposed) return
        stopAutoSave = initAutoSave()
        if (stored) {
          useProjectStore.getState().loadProject(stored)
          useUIStore.getState().setSaveStatus('saved')
        } else {
          clearAssets()
          useProjectStore.getState().createProject('Projet sans titre')
        }
      } catch (error) {
        if (disposed) return
        stopAutoSave?.()
        stopAutoSave = undefined
        console.error('Could not initialize ScreenForge.', error)
        clearAssets()
        useProjectStore.getState().createProject('Projet sans titre')
        useUIStore.getState().setSaveStatus('error')
        toast(
          'Stockage local indisponible. Ce projet restera en mémoire et sera perdu à la fermeture.',
          'error',
          { duration: Infinity },
        )
      }
    }

    void init()
    return () => {
      disposed = true
      stopAutoSave?.()
    }
  }, [])

  async function handleImageImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { addLayer } = useCanvasStore.getState()
    const result = await createImageLayerFromFile(
      file,
      getProjectLayers(useProjectStore.getState().project).length,
    )
    if (result.ok) addLayer(result.layer)
    else toast(result.error, 'error')
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-stage">
      {/* Stage: full-bleed canvas */}
      <main className="absolute inset-0">
        <CanvasEditor />
      </main>
      <div aria-hidden className="stage-vignette pointer-events-none absolute inset-0 z-(--z-stage-veil)" />

      {/* Floating chrome */}
      <div className="absolute left-3 right-3 top-3 z-(--z-chrome)">
        <TopBar />
      </div>
      <LayersDrawer />
      <PropertiesDrawer />
      <div className="absolute bottom-3 left-1/2 z-(--z-chrome) -translate-x-1/2">
        <ScreensBar />
      </div>
      <div className="absolute bottom-3 right-3 z-(--z-chrome)">
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

      <Overlays />
      <Toaster
        theme={theme}
        position="bottom-left"
        duration={3500}
        visibleToasts={4}
        offset={16}
        gap={8}
        style={{
          zIndex: 'var(--z-toast)',
          fontFamily: 'var(--font-sans)',
          '--normal-bg': 'var(--color-secondary)',
          '--normal-border': 'var(--color-border)',
          '--normal-text': 'var(--color-foreground)',
          '--border-radius': 'var(--radius-md)',
        } as CSSProperties}
        toastOptions={{
          style: {
            boxShadow: 'var(--shadow-lg), var(--hairline-top)',
            fontSize: '12.5px',
          },
        }}
      />
    </div>
  )
}

function Overlays() {
  const showCommandPalette = useUIStore((s) => s.showCommandPalette)
  const showShortcuts = useUIStore((s) => s.showShortcuts)
  const showExportDialog = useUIStore((s) => s.showExportDialog)
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)

  return (
    <>
      <CommandPalette
        open={showCommandPalette}
        onClose={() => useUIStore.getState().setShowCommandPalette(false)}
      />
      <ShortcutsOverlay
        open={showShortcuts}
        onClose={() => useUIStore.getState().setShowShortcuts(false)}
      />

      <Suspense fallback={<LazyDialogFallback />}>
        {showExportDialog && <ExportDialog />}
        {showTemplatesPicker && <TemplatePicker />}
        {showGlobalsEditor && <GlobalsEditor />}
      </Suspense>
    </>
  )
}

function LazyDialogFallback() {
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-(--z-modal) animate-fade-in bg-black/50" />
      <div
        role="status"
        aria-live="polite"
        aria-label="Chargement de la fenêtre"
        className="surface-modal fixed left-1/2 top-1/2 z-(--z-modal) flex -translate-x-1/2 -translate-y-1/2 animate-slide-up items-center gap-2.5 px-5 py-4 text-sm text-foreground motion-reduce:animate-none"
      >
        <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
        Chargement…
      </div>
    </>
  )
}
