import { useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Command,
  Download,
  FileDown,
  FolderOpen,
  ImageIcon,
  LayoutTemplate,
  LoaderCircle,
  MoreHorizontal,
  Moon,
  PenLine,
  PanelLeft,
  PanelRight,
  Redo2,
  Settings,
  Smartphone,
  Square,
  Sun,
  TriangleAlert,
  Type,
  Undo2,
  UserRound,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useHistoryStore } from '@/stores/history.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { useUIStore, type SaveStatus, type SyncStatus } from '@/stores/ui.store'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { Kbd } from '@/components/ui/kbd'
import { belowWidth, useMediaQuery } from '@/hooks/use-media-query'
import { TOP_BAR_COMPACT_WIDTH, TOP_BAR_TOOLS_WIDTH } from '@/lib/stage'
import { cn } from '@/lib/utils'
import {
  createProjectFile,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME,
  projectFileErrorMessage,
} from '@/lib/project-file'
import { billingConfigured } from '@/lib/api'
import { planName } from '@/lib/plans'
import { importPortableProject, saveCurrentProject } from '@/lib/storage'
import { cloudConfigured } from '@/lib/supabase'
import { downloadBlob, slugify } from '@/lib/zip'
import { toast } from '@/stores/toast.store'
import { createDeviceLayer, createShapeLayer, createTextLayer } from '@/lib/layer-factories'
import { CURRENT_DEVICE_FRAMES } from '@/assets/device-frames'
import type { DeviceModel, Layer } from '@/types'

/** Le menu Projet renomme sans posséder le champ : il le vise par son id. */
const PROJECT_NAME_INPUT_ID = 'sf-project-name-input'

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: 'Modifications non enregistrées',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Échec de l’enregistrement',
}

const SYNC_LABELS: Record<Exclude<SyncStatus, 'off'>, string> = {
  syncing: 'Synchronisation…',
  synced: 'Synchronisé',
  offline: 'Hors ligne — reprendra au retour du réseau',
  error: 'Échec de la synchronisation',
}

/**
 * Filet séparateur : plus court que les boutons, pour séparer sans découper.
 * L'écart de part et d'autre porte davantage que le trait lui-même — c'est lui
 * qui fait lire un groupe, d'où `mx-1.5` contre `gap-0.5` en intra-groupe.
 */
function Divider() {
  return <div aria-hidden className="mx-1.5 h-3.5 w-px shrink-0 bg-input" />
}

/**
 * Unique top bar: project identity, layer tools, workspace toggles, export.
 *
 * Une grille, et non un groupe centré en absolu. Hors flux, le groupe d'outils
 * ne réservait aucune largeur et ne pouvait donc pas être repoussé ; positionné,
 * il passait aussi devant les bascules de panneaux au test de clic. Mesuré : le
 * recouvrement commençait à 1023px, et à 900px la bascule Calques ne recevait
 * plus aucun de ses 36px — cliquer dessus insérait un calque.
 *
 * `minmax(0,1fr)` à gauche, `1fr` à droite : les deux colonnes prennent la même
 * part tant que l'espace le permet, donc le groupe central est exactement au
 * milieu ; à l'étroit, la droite se cale sur son contenu minimal et c'est le
 * nom du projet qui cède. Le centre glisse, il ne chevauche jamais.
 */
export function TopBar() {
  // Deux paliers, parce que replier une fois ne suffit pas : sous le premier ce
  // sont les actions secondaires qui passent au menu, sous le second les outils
  // de création les y rejoignent. Le second est ce qui rend la fenêtre étroite
  // habitable — voir `TOP_BAR_TOOLS_WIDTH`.
  const compactActions = useMediaQuery(belowWidth(TOP_BAR_COMPACT_WIDTH))
  const compactTools = useMediaQuery(belowWidth(TOP_BAR_TOOLS_WIDTH))

  return (
    // La colonne du projet plancher à `0` et non à `min-content` : un champ en
    // `field-sizing-content` déclare son contenu comme min-content, donc
    // `minmax(min-content,1fr)` la figeait à 315px et faisait déborder l'îlot
    // entier de 93px — mesuré, « Exporter » repartait hors de la fenêtre. C'est
    // le champ qui absorbe, pas la grille.
    <div className="island grid grid-cols-[minmax(0,1fr)_auto_1fr] items-center gap-2">
      <ProjectSegment />
      {/* La colonne reste, vide : la grille en compte trois, et c'est elle qui
          garde le groupe central au milieu quand il revient. */}
      {compactTools ? <span /> : <ToolsSegment />}
      <ActionsSegment compactActions={compactActions} compactTools={compactTools} />
    </div>
  )
}

function ProjectSegment() {
  const saveStatus = useUIStore((s) => s.saveStatus)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ProjectName />
      <ProjectFileMenu />
      {/*
        L'état informe, il n'alerte pas : casse normale, teinte faible.

        Il ne se masque plus sous 1280px. Une application sans serveur qui
        n'offre aucune preuve d'enregistrement n'est pas discrète, elle est
        muette — et l'état qui disparaissait le premier était l'échec. Le libellé
        seul se replie en `sr-only` : il reste dans l'arbre d'accessibilité, donc
        la région live l'annonce toujours, ce qu'un `display:none` empêchait à
        toute largeur. La pastille décorative qui occupait la place du témoin de
        document modifié a disparu ; c'est ce témoin-ci qui la tient désormais.
      */}
      <span
        role="status"
        aria-live="polite"
        title={SAVE_LABELS[saveStatus]}
        className={cn(
          'flex shrink-0 items-center gap-1.5 text-2xs',
          saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {saveStatus === 'idle' && (
          <span aria-hidden className="size-2 shrink-0 rounded-xs bg-muted-foreground" />
        )}
        {saveStatus === 'saving' && <LoaderCircle size={11} className="animate-spin" aria-hidden />}
        {saveStatus === 'saved' && <Check size={11} className="text-success" aria-hidden />}
        {saveStatus === 'error' && <TriangleAlert size={11} aria-hidden />}
        <span className="sr-only xl:not-sr-only">{SAVE_LABELS[saveStatus]}</span>
      </span>
      <SyncIndicator />
    </div>
  )
}

/**
 * L'état du cloud, à côté de celui du disque.
 *
 * Il vit ici et non près du bouton de compte : ce n'est pas une action, c'est
 * le même fait que « Enregistré » dit une seconde fois, un cran plus loin.
 * Les deux se lisent d'affilée — « Enregistré · Synchronisé » — et un
 * utilisateur qui cherche où est son travail regarde un seul endroit.
 *
 * Absent tant qu'il n'y a rien à dire : sans instance configurée ou sans
 * session, la synchronisation n'existe pas, et un témoin barré permanent
 * annoncerait une panne là où il n'y a qu'un produit local.
 */
function SyncIndicator() {
  const syncStatus = useUIStore((s) => s.syncStatus)
  if (syncStatus === 'off') return null

  const label = SYNC_LABELS[syncStatus]
  return (
    <span
      role="status"
      aria-live="polite"
      title={label}
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-2xs',
        syncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {syncStatus === 'syncing' && <LoaderCircle size={11} className="animate-spin" aria-hidden />}
      {syncStatus === 'synced' && <Cloud size={11} className="text-success" aria-hidden />}
      {syncStatus === 'offline' && <CloudOff size={11} aria-hidden />}
      {syncStatus === 'error' && <TriangleAlert size={11} aria-hidden />}
      <span className="sr-only xl:not-sr-only">{label}</span>
    </span>
  )
}

function ProjectFileMenu() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function downloadProject() {
    const project = useProjectStore.getState().project
    if (!project) return
    setBusy(true)
    try {
      await saveCurrentProject()
      const blob = await createProjectFile(useProjectStore.getState().project ?? project)
      downloadBlob(blob, `${slugify(project.name)}${PROJECT_FILE_EXTENSION}`)
      toast('Copie du projet téléchargée.', 'success')
    } catch (error) {
      toast(projectFileErrorMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function openProject(file: File) {
    setBusy(true)
    try {
      await importPortableProject(file)
      toast('Projet importé.', 'success')
    } catch (error) {
      toast(projectFileErrorMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        trigger={
          <IconButton
            size="sm"
            // La colonne de gauche est celle qui cède : sans cela le chevron
            // s'écrasait à 17px avant que le nom n'ait commencé à se tronquer.
            className="shrink-0"
            aria-label="Ouvrir le menu Projet"
            aria-busy={busy}
            active={open}
            aria-expanded={open}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={13} className="animate-spin" aria-hidden />
            ) : (
              <ChevronDown size={13} strokeWidth={2} aria-hidden />
            )}
          </IconButton>
        }
        ariaLabel="Fichier du projet"
        items={[
          {
            id: 'rename-project',
            label: 'Renommer le projet',
            icon: <PenLine size={14} strokeWidth={1.75} />,
            onSelect: () => {
              const input = document.getElementById(PROJECT_NAME_INPUT_ID)
              if (input instanceof HTMLInputElement) {
                input.focus()
                input.select()
              }
            },
          },
          {
            id: 'download-project',
            label: 'Télécharger une copie',
            icon: <FileDown size={14} strokeWidth={1.75} />,
            disabled: busy,
            onSelect: () => void downloadProject(),
          },
          {
            id: 'open-project',
            label: 'Ouvrir un projet…',
            icon: <FolderOpen size={14} strokeWidth={1.75} />,
            disabled: busy,
            onSelect: () => inputRef.current?.click(),
          },
        ]}
      />
      <input
        ref={inputRef}
        type="file"
        accept={`${PROJECT_FILE_EXTENSION},${PROJECT_FILE_MIME}`}
        aria-label="Ouvrir un projet ScreenForge"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void openProject(file)
        }}
      />
    </>
  )
}

function ProjectName() {
  const name = useProjectStore((s) => s.project?.name ?? '')
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const [draft, setDraft] = useState(name)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [prevName, setPrevName] = useState(name)
  if (name !== prevName) {
    setPrevName(name)
    if (!editing) setDraft(name)
  }

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) updateProjectName(trimmed)
    setEditing(false)
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
          inputRef.current?.blur()
        }
        if (event.key === 'Escape') {
          setDraft(name)
          setEditing(false)
          inputRef.current?.blur()
        }
      }}
      id={PROJECT_NAME_INPUT_ID}
      aria-label="Nom du projet"
      // Un champ fixe de 160px coupait « Captures App Store — Onboarding v3 »
      // au tiers, sans rien pour lire la suite. Il se dimensionne maintenant sur
      // son contenu entre deux bornes, et le titre natif donne le nom complet.
      title={name}
      spellCheck={false}
      className={cn(
        // `field-sizing-content` fixe la largeur : pas de `w-*` en plus, qui la
        // reprendrait. Les deux bornes suffisent.
        //
        // Le plancher est nul, et c'est ce qui tient la barre : le nom est la
        // seule chose ici qui puisse rétrécir sans se perdre, il tronque déjà et
        // son infobulle donne le titre entier. Avec un plancher de 96px, la
        // colonne cédait avant lui — le menu Projet et l'état d'enregistrement
        // débordaient sur « Annuler », mesuré jusqu'à 24px de recouvrement à
        // 768px de large.
        'field-sizing-content h-9 min-w-0 max-w-[28ch] truncate',
        'rounded-md border border-transparent bg-transparent px-2',
        'text-sm font-semibold tracking-[-0.012em] text-foreground transition-colors',
        'hover:border-border focus:border-input focus:bg-secondary focus:outline-none',
      )}
    />
  )
}

function ToolsSegment() {
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.past.length > 0)
  const canRedo = useHistoryStore((s) => s.future.length > 0)

  function addLayer(layer: Layer) {
    useCanvasStore.getState().addLayer(layer)
  }

  function layerCount() {
    return getProjectLayers(useProjectStore.getState().project).length
  }

  return (
    <div className="flex items-center gap-1 justify-self-center">
      <IconButton
        aria-label="Annuler"
        title="Annuler (⌘Z)"
        disabled={!canUndo}
        onClick={() => undo()}
      >
        <Undo2 size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Rétablir"
        title="Rétablir (⌘⇧Z)"
        disabled={!canRedo}
        onClick={() => redo()}
      >
        <Redo2 size={16} strokeWidth={1.75} />
      </IconButton>

      <Divider />

      {/*
        Les quatre outils d'ajout forment un groupe, et c'est le filet qui le
        dit — comme partout ailleurs dans cette barre.

        Le rail en creux qui les portait reproduisait mot pour mot le conteneur
        de `ToggleGroup`, lequel veut dire « choisis-en un, un est allumé » dans
        le contrôle Uni/Dégradé/Préréglages du même écran. Quatre actions sans
        état n'ont pas cet habit. Il rendait par ailleurs à 1,10:1 sur la carte
        en sombre, donc le groupement qu'il justifiait était invisible, et ses
        40px de haut débordaient du retrait d'îlot.
      */}
      <IconButton
        aria-label="Ajouter Texte"
        title="Ajouter : texte"
        onClick={() => addLayer(createTextLayer(layerCount()))}
      >
        <Type size={16} strokeWidth={1.75} />
      </IconButton>
      <DeviceAddTool onSelect={(model) => addLayer(createDeviceLayer(model, layerCount()))} />
      <IconButton
        aria-label="Ajouter Image"
        title="Ajouter : image…"
        onClick={() => document.getElementById('sf-image-import-input')?.click()}
      >
        <ImageIcon size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Ajouter Forme"
        title="Ajouter : forme"
        onClick={() => addLayer(createShapeLayer(layerCount()))}
      >
        <Square size={16} strokeWidth={1.75} />
      </IconButton>
    </div>
  )
}

/**
 * Les actions secondaires, décrites une fois.
 *
 * Elles se rendent en rangée quand la barre a la place, et dans un menu quand
 * elle ne l'a plus. Deux écritures parallèles auraient dérivé : c'est ce qui
 * fait qu'une action finit par exister large et pas étroit.
 */
interface SecondaryAction {
  id: string
  /** Nom accessible et libellé de menu : le même mot dans les deux formes. */
  label: string
  hint: string
  icon: React.ReactNode
  /**
   * Appliqué au bouton de la rangée, jamais à l'entrée de menu : replié, le
   * même contenu retombe dans une fente d'icône que le menu dimensionne.
   */
  className?: string
  /** Renseigné pour ce qui ouvre un dialogue, absent pour ce qui agit. */
  expanded?: boolean
  disabled?: boolean
  onSelect: () => void
}

/**
 * Les outils de création, sous leur forme repliée.
 *
 * La rangée reste écrite à part, en face : elle porte un filet de groupe et un
 * menu de modèles d'iPhone, que six entrées à plat ne rendraient pas. La seule
 * chose que la forme repliée abandonne est justement ce choix de modèle — elle
 * pose celui du projet, qui est déjà ce que la rangée propose en tête de liste.
 */
function useToolActions(): SecondaryAction[] {
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.past.length > 0)
  const canRedo = useHistoryStore((s) => s.future.length > 0)
  const deviceModel = useProjectStore((s) => s.project?.globals.deviceModel)

  function addLayer(create: (index: number) => Layer) {
    useCanvasStore
      .getState()
      .addLayer(create(getProjectLayers(useProjectStore.getState().project).length))
  }

  return [
    {
      id: 'undo',
      label: 'Annuler',
      hint: 'Annuler (⌘Z)',
      icon: <Undo2 size={16} strokeWidth={1.75} />,
      disabled: !canUndo,
      onSelect: () => undo(),
    },
    {
      id: 'redo',
      label: 'Rétablir',
      hint: 'Rétablir (⌘⇧Z)',
      icon: <Redo2 size={16} strokeWidth={1.75} />,
      disabled: !canRedo,
      onSelect: () => redo(),
    },
    {
      id: 'add-text',
      label: 'Ajouter Texte',
      hint: 'Ajouter : texte',
      icon: <Type size={16} strokeWidth={1.75} />,
      onSelect: () => addLayer(createTextLayer),
    },
    {
      id: 'add-device',
      label: 'Ajouter un cadre iPhone',
      hint: 'Ajouter : cadre iPhone',
      icon: <Smartphone size={16} strokeWidth={1.75} />,
      onSelect: () =>
        addLayer((index) =>
          createDeviceLayer(deviceModel ?? CURRENT_DEVICE_FRAMES[0].model, index),
        ),
    },
    {
      id: 'add-image',
      label: 'Ajouter Image',
      hint: 'Ajouter : image…',
      icon: <ImageIcon size={16} strokeWidth={1.75} />,
      onSelect: () => document.getElementById('sf-image-import-input')?.click(),
    },
    {
      id: 'add-shape',
      label: 'Ajouter Forme',
      hint: 'Ajouter : forme',
      icon: <Square size={16} strokeWidth={1.75} />,
      onSelect: () => addLayer(createShapeLayer),
    },
  ]
}

/**
 * L'entrée de compte, ou rien.
 *
 * Rien est le cas normal : sans instance Supabase configurée, ScreenForge est
 * l'éditeur local-first qu'il a toujours été, et un bouton « Se connecter » qui
 * ouvrirait une boîte incapable de connecter quiconque serait pire qu'absent.
 * `cloudConfigured` étant une constante de compilation, la branche entière
 * disparaît à l'élagage dans une build sans compte.
 *
 * Pendant `unknown` l'entrée est désactivée plutôt que masquée : la session se
 * restaure de façon asynchrone, et faire apparaître un bouton après coup
 * déplacerait la rangée sous le curseur. Désactivée, elle tient sa place sans
 * accepter un clic dont on ne sait pas encore ce qu'il devrait faire.
 */
function useAccountAction(): SecondaryAction | null {
  const showAuthDialog = useUIStore((s) => s.showAuthDialog)
  const showAccountDialog = useUIStore((s) => s.showAccountDialog)
  const status = useAuthStore((s) => s.status)
  const email = useAuthStore((s) => s.user?.email)

  if (!cloudConfigured) return null

  if (status === 'signed-in') {
    return {
      id: 'account',
      label: 'Mon compte',
      // Le seul endroit qui dit *quel* compte, et il le dit avant d'ouvrir :
      // c'est ce qu'on vérifie quand on se demande si on s'est trompé de
      // session. La déconnexion vit dans la boîte, avec le reste du compte.
      hint: email ? `Connecté : ${email}` : 'Mon compte',
      icon: <UserRound size={16} strokeWidth={1.75} />,
      expanded: showAccountDialog,
      onSelect: () => useUIStore.getState().setShowAccountDialog(!showAccountDialog),
    }
  }

  return {
    id: 'account',
    label: 'Se connecter',
    hint: 'Se connecter à ScreenForge',
    icon: <UserRound size={16} strokeWidth={1.75} />,
    expanded: showAuthDialog,
    disabled: status === 'unknown',
    onSelect: () => useUIStore.getState().setShowAuthDialog(!showAuthDialog),
  }
}

/**
 * Le palier détenu, et l'entrée qui ouvre les offres.
 *
 * Une seule entrée pour les deux : le badge dit ce qu'on a, le clic montre ce
 * qu'on peut avoir, et c'est le même geste. Absente sans API de vente
 * configurée — `billingConfigured` étant une constante de compilation, la
 * branche disparaît à l'élagage dans une build sans checkout.
 *
 * Elle reste visible hors session : c'est là que quelqu'un découvre qu'il y a
 * quelque chose à acheter, et la boîte dit elle-même qu'il faut un compte.
 */
function usePlanAction(): SecondaryAction | null {
  const showPricingDialog = useUIStore((s) => s.showPricingDialog)
  const entitlements = useAuthStore((s) => s.entitlements)

  if (!billingConfigured) return null

  const plan = planName(entitlements)
  return {
    id: 'plan',
    label: 'Voir les offres',
    hint: `Palier ${plan} — voir les offres`,
    icon: <BadgeIcon>{plan}</BadgeIcon>,
    /* Le seul de la rangée qui porte un mot. Une case de 36 est taillée pour un
       glyphe de 16 : « Gratuit » y mesurait 39,6 px de large, donc l'aplat de
       survol passait *sous* son propre texte et le débordait des deux côtés. La
       largeur suit le mot, la hauteur reste celle de la rangée. */
    className: 'w-auto px-2',
    expanded: showPricingDialog,
    onSelect: () => useUIStore.getState().setShowPricingDialog(!showPricingDialog),
  }
}

/**
 * Le palier s'écrit, il ne se pictographie pas.
 *
 * « Licence » et « Cloud » n'ont pas de glyphe que l'œil lise sans légende, et
 * la rangée voisine est entièrement en icônes : un mot y devient le seul repère
 * textuel, ce qui est exactement ce qu'on veut d'un état de compte. Le point
 * citron marque le palier payant — même vocabulaire que « vous êtes ici »
 * ailleurs dans l'application, jamais sur une action.
 */
function BadgeIcon({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1.5 text-2xs font-medium">
      {children !== 'Gratuit' && (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-marker" />
      )}
      {children}
    </span>
  )
}

function useSecondaryActions(): SecondaryAction[] {
  const account = useAccountAction()
  const plan = usePlanAction()
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const theme = useUIStore((s) => s.theme)

  return [
    ...(plan ? [plan] : []),
    ...(account ? [account] : []),
    {
      id: 'templates',
      label: 'Ouvrir les modèles',
      hint: 'Modèles de mise en page',
      icon: <LayoutTemplate size={16} strokeWidth={1.75} />,
      expanded: showTemplatesPicker,
      onSelect: () => useUIStore.getState().setShowTemplatesPicker(!showTemplatesPicker),
    },
    {
      id: 'globals',
      label: 'Ouvrir les réglages globaux',
      hint: 'Réglages globaux du projet',
      icon: <Settings size={16} strokeWidth={1.75} />,
      expanded: showGlobalsEditor,
      onSelect: () => useUIStore.getState().setShowGlobalsEditor(!showGlobalsEditor),
    },
    {
      id: 'theme',
      label: 'Changer de thème',
      hint: theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre',
      icon:
        theme === 'dark' ? (
          <Sun size={16} strokeWidth={1.75} />
        ) : (
          <Moon size={16} strokeWidth={1.75} />
        ),
      onSelect: () => useUIStore.getState().toggleTheme(),
    },
    {
      id: 'palette',
      label: 'Ouvrir la palette de commandes',
      hint: 'Palette de commandes (⌘K)',
      icon: <Command size={16} strokeWidth={1.75} />,
      onSelect: () => useUIStore.getState().setShowCommandPalette(true),
    },
  ]
}

function SecondaryActionsMenu({ actions }: { actions: SecondaryAction[] }) {
  const [open, setOpen] = useState(false)

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={
        <IconButton
          aria-label="Ouvrir les autres actions"
          title="Autres actions"
          active={open}
          aria-expanded={open}
        >
          <MoreHorizontal size={16} strokeWidth={1.75} />
        </IconButton>
      }
      ariaLabel="Autres actions"
      items={actions.map((action) => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled: action.disabled,
        onSelect: action.onSelect,
      }))}
    />
  )
}

function ActionsSegment({
  compactActions,
  compactTools,
}: {
  compactActions: boolean
  compactTools: boolean
}) {
  const layersOpen = useUIStore((s) => s.layersOpen)
  const propsOpen = useUIStore((s) => s.propsOpen)
  const secondary = useSecondaryActions()
  const tools = useToolActions()
  // Le CTA principal reste, ce sont ses voisins qui cèdent — et les outils
  // repliés arrivent en tête du menu, dans l'ordre de la rangée qu'ils quittent.
  const compact = compactActions || compactTools
  const actions = compactTools ? [...tools, ...secondary] : secondary

  return (
    <div className="flex items-center gap-1 justify-self-end">
      {/* `aria-pressed` sur ce qui bascule, `aria-expanded` sur ce qui ouvre :
          `data-active` ne peint que pour l'œil, il ne dit rien à un lecteur
          d'écran, qui annonçait donc le même bouton dans les deux états. */}
      <IconButton
        aria-label="Basculer le panneau Calques"
        title="Panneau Calques (⌘⇧L)"
        active={layersOpen}
        aria-pressed={layersOpen}
        onClick={() => useUIStore.getState().toggleLayers()}
      >
        <PanelLeft size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Basculer le panneau Propriétés"
        title="Panneau Propriétés (⌘⇧P)"
        active={propsOpen}
        aria-pressed={propsOpen}
        onClick={() => useUIStore.getState().toggleProps()}
      >
        <PanelRight size={16} strokeWidth={1.75} />
      </IconButton>

      <Divider />

      {compact ? (
        <SecondaryActionsMenu actions={actions} />
      ) : (
        actions.map((action) =>
          action.id === 'palette' ? (
            <button
              key={action.id}
              type="button"
              aria-label={action.label}
              title={action.hint}
              onClick={action.onSelect}
              className={cn(
                'flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground',
                'transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground',
              )}
            >
              <Kbd>⌘K</Kbd>
            </button>
          ) : (
            <IconButton
              key={action.id}
              aria-label={action.label}
              title={action.hint}
              active={action.expanded}
              aria-expanded={action.expanded}
              aria-haspopup={action.expanded === undefined ? undefined : 'dialog'}
              onClick={action.onSelect}
              className={action.className}
            >
              {action.icon}
            </IconButton>
          ),
        )
      )}

      <Button
        variant="primary"
        size="md"
        aria-label="Ouvrir l’export"
        title="Exporter les captures App Store"
        onClick={() => useUIStore.getState().setShowExportDialog(true)}
        className="ml-2.5"
      >
        <Download size={13} strokeWidth={2} aria-hidden />
        Exporter
      </Button>
    </div>
  )
}

function DeviceAddTool({ onSelect }: { onSelect: (model: DeviceModel) => void }) {
  const [open, setOpen] = useState(false)
  const preferredModel = useProjectStore((s) => s.project?.globals.deviceModel)

  const models = [...CURRENT_DEVICE_FRAMES].sort(
    (a, b) => Number(b.model === preferredModel) - Number(a.model === preferredModel),
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={
        <IconButton
          aria-label="Ajouter un cadre iPhone"
          title="Ajouter : cadre iPhone"
          active={open}
          aria-expanded={open}
        >
          <Smartphone size={16} strokeWidth={1.75} />
          <ChevronDown size={9} strokeWidth={2} aria-hidden className="-ml-0.5" />
        </IconButton>
      }
      ariaLabel="Modèle d’iPhone"
      items={models.map((frame) => ({
        id: frame.model,
        label: frame.modelName,
        meta: frame.screenSize,
        onSelect: () => onSelect(frame.model),
      }))}
    />
  )
}
