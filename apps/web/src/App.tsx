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
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip'
import { toast } from '@/stores/toast.store'
import { useKeyboard } from '@/hooks/use-keyboard'
import { belowWidth, useMediaQuery } from '@/hooks/use-media-query'
import { DUAL_DRAWER_MIN_WIDTH, FILMSTRIP_CENTERED_MIN_WIDTH } from '@/lib/stage'
import { loadLatestProject, initAutoSave } from '@/lib/storage'
import { initSync } from '@/lib/sync'
import { clearAssets } from '@/lib/assets'
import { cn } from '@/lib/utils'
import { createImageLayerFromFile } from '@/lib/layer-factories'
import { IMAGE_ACCEPT } from '@/lib/image'
import { commercialLaunch } from '@/lib/commercial-launch'
import { cloudConfigured } from '@/lib/convex'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { consumeCheckoutReturn, initAuth } from '@/stores/auth.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'

const ExportDialog = lazy(() =>
  import('@/components/export-dialog/ExportDialog').then((module) => ({
    default: module.ExportDialog,
  })),
)
const TemplatePicker = lazy(() =>
  import('@/components/template-picker/TemplatePicker').then((module) => ({
    default: module.TemplatePicker,
  })),
)
const GlobalsEditor = lazy(() =>
  import('@/components/globals-editor/GlobalsEditor').then((module) => ({
    default: module.GlobalsEditor,
  })),
)
const AuthDialog = lazy(() =>
  import('@/components/auth-dialog/AuthDialog').then((module) => ({
    default: module.AuthDialog,
  })),
)
const PricingDialog = lazy(() =>
  import('@/components/pricing-dialog/PricingDialog').then((module) => ({
    default: module.PricingDialog,
  })),
)
const AccountDialog = lazy(() =>
  import('@/components/account-dialog/AccountDialog').then((module) => ({
    default: module.AccountDialog,
  })),
)
const RefreshDialog = lazy(() =>
  import('@/components/refresh-dialog/RefreshDialog').then((module) => ({
    default: module.RefreshDialog,
  })),
)
const ReleaseDialog = lazy(() =>
  import('@/components/release-dialog/ReleaseDialog').then((module) => ({
    default: module.ReleaseDialog,
  })),
)
const CampaignDialog = lazy(() =>
  import('@/components/campaign-dialog/CampaignDialog').then((module) => ({
    default: module.CampaignDialog,
  })),
)
const LocaleDialog = lazy(() =>
  import('@/components/locale-dialog/LocaleDialog').then((module) => ({
    default: module.LocaleDialog,
  })),
)
const CloudBridge = lazy(() => import('@/lib/cloud-bridge'))
const PublishDialog = lazy(() =>
  import('@/components/publish-dialog/PublishDialog').then((module) => ({
    default: module.PublishDialog,
  })),
)
const MigrateProjectsDialog = lazy(() =>
  import('@/components/migrate-dialog/MigrateProjectsDialog').then((module) => ({
    default: module.MigrateProjectsDialog,
  })),
)

export default function App() {
  useKeyboard()

  const theme = useUIStore((s) => s.theme)
  const exclusiveDrawers = useMediaQuery(belowWidth(DUAL_DRAWER_MIN_WIDTH))
  const filmstripCentered = !useMediaQuery(belowWidth(FILMSTRIP_CENTERED_MIN_WIDTH))

  useEffect(() => {
    if (!commercialLaunch) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('offers') !== 'open') return
    useUIStore.getState().setShowPricingDialog(true)
    url.searchParams.delete('offers')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  useEffect(() => {
    useUIStore.getState().setExclusiveDrawers(exclusiveDrawers)
  }, [exclusiveDrawers])

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
    let stopSync: (() => void) | undefined

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
        /* La sync démarre une fois le projet local en place, et seulement sur
           ce chemin. Elle compare des `updatedAt` : lancée avant, elle
           comparerait la version distante à rien et adopterait le cloud alors
           qu'un projet local était en train d'arriver. Sur le chemin d'échec
           elle ne démarre pas du tout — sans stockage local, il n'y a pas de
           version de référence à confronter, et pousser une mémoire volatile
           vers le cloud écraserait la seule copie durable qui reste. */
        stopSync = initSync()
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
      stopSync?.()
      stopAutoSave?.()
    }
  }, [])

  /**
   * La session se branche au montage, pas au premier clic sur « Se connecter ».
   *
   * Deux choses en dépendent et arrivent avant ce clic : la session déjà
   * enregistrée, qu'il faut restaurer pour ne pas proposer de se connecter à qui
   * l'est, et le fragment `#access_token=…` que le retour d'un lien magique ou
   * d'un fournisseur OAuth dépose dans l'URL — c'est la création du client qui
   * le consomme, et personne d'autre ne le fera.
   *
   * Le coût est un module chargé à la volée sur une instance qui a un compte, et
   * zéro sur une instance qui n'en a pas : `initAuth` sort immédiatement sans
   * rien importer quand les variables manquent.
   */
  useEffect(() => {
    const stopAuth = initAuth()
    // Après la session, pas avant : l'attente relit les droits, qui demandent
    // un jeton.
    consumeCheckoutReturn()
    return stopAuth
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
    <TooltipProvider>
      <div className="relative h-full w-full overflow-hidden bg-stage">
        {/* Le document a un nom. Sans lui, la hiérarchie de titres démarrait au
          niveau 2 et le saut de titre ne renvoyait rien depuis la racine. Le
          nom du projet vit dans son champ, qui se nomme déjà. */}
        <h1 className="sr-only">ScreenForge</h1>

        {/* Stage: full-bleed canvas */}
        <main className="absolute inset-0">
          <CanvasEditor />
        </main>
        <div
          aria-hidden
          className="stage-vignette pointer-events-none absolute inset-0 z-(--z-stage-veil)"
        />

        {/* Floating chrome */}
        <header className="absolute left-3 right-3 top-3 z-(--z-chrome)">
          <TopBar />
        </header>
        <LayersDrawer />
        <PropertiesDrawer />
        {/* Centrée tant qu'elle peut encore rétrécir ; ancrée à gauche une fois au
          plancher, pour ne pas venir chercher le HUD sous la fenêtre étroite. */}
        <div
          className={cn(
            'absolute bottom-3 z-(--z-chrome)',
            filmstripCentered ? 'left-1/2 -translate-x-1/2' : 'left-3',
          )}
        >
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
          closeButton
          style={
            {
              zIndex: 'var(--z-toast)',
              fontFamily: 'var(--font-sans)',
              '--normal-bg': 'var(--color-secondary)',
              '--normal-border': 'var(--color-border)',
              '--normal-text': 'var(--color-foreground)',
              '--border-radius': 'var(--radius-md)',
            } as CSSProperties
          }
          toastOptions={{
            classNames: {
              title: '!leading-5',
              description: '!leading-5',
              /* 20px chez Sonner : une troisième hauteur de contrôle, hors
                 échelle fermée (32/36) — c'est l'audit de scale qui l'a vue. */
              closeButton: '!size-8',
            },
            style: {
              boxShadow: 'var(--shadow-lg), var(--hairline-top)',
              fontSize: 'var(--text-sm)',
            },
          }}
        />
      </div>
    </TooltipProvider>
  )
}

function Overlays() {
  const showCommandPalette = useUIStore((s) => s.showCommandPalette)
  const showShortcuts = useUIStore((s) => s.showShortcuts)
  const showExportDialog = useUIStore((s) => s.showExportDialog)
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const showAuthDialog = useUIStore((s) => s.showAuthDialog)
  const showPricingDialog = useUIStore((s) => s.showPricingDialog)
  const showAccountDialog = useUIStore((s) => s.showAccountDialog)
  const showMigrateDialog = useUIStore((s) => s.showMigrateDialog)
  const showRefreshDialog = useUIStore((s) => s.showRefreshDialog)
  const showReleaseDialog = useUIStore((s) => s.showReleaseDialog)
  const showCampaignDialog = useUIStore((s) => s.showCampaignDialog)
  const showLocaleDialog = useUIStore((s) => s.showLocaleDialog)
  const showPublishDialog = useUIStore((s) => s.showPublishDialog)

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
        {showAuthDialog && <AuthDialog />}
        {showPricingDialog && <PricingDialog />}
        {showAccountDialog && <AccountDialog />}
        {showMigrateDialog && <MigrateProjectsDialog />}
        {showRefreshDialog && <RefreshDialog />}
        {showReleaseDialog && <ReleaseDialog />}
        {showCampaignDialog && <CampaignDialog />}
        {showLocaleDialog && <LocaleDialog />}
        {showPublishDialog && <PublishDialog />}
      </Suspense>

      {/* Le pont vers Convex : il ne rend rien, il tient la session. Monté ici
          plutôt qu'autour de l'arbre parce qu'un fournisseur qui enveloppe `App`
          remonterait le canvas au moment où le client arrive. `cloudConfigured`
          est une constante de compilation : sans instance, la branche entière
          disparaît à l'élagage.

          Sa propre frontière d'attente, et vide : partagée avec les dialogs,
          elle poserait le voile de chargement sur l'éditeur pendant que la
          session se restaure, pour un composant qui ne dessine rien. */}
      {cloudConfigured && (
        <Suspense fallback={null}>
          <CloudBridge />
        </Suspense>
      )}
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
