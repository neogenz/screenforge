import { useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  CloudUpload,
  Command,
  Download,
  ImageIcon,
  Languages,
  LayoutTemplate,
  LoaderCircle,
  Megaphone,
  MoreHorizontal,
  Moon,
  Package,
  Plug2,
  PanelLeft,
  PanelRight,
  Redo2,
  RefreshCw,
  Settings,
  Smartphone,
  Square,
  Star,
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
import { MCP_LABELS, useMcpStore } from '@/stores/mcp.store'
import { McpStatusDot } from '@/components/mcp/McpStatusDot'
import { ProjectSwitcher } from '@/components/project-switcher/ProjectSwitcher'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { belowWidth, useMediaQuery } from '@/hooks/use-media-query'
import { TOP_BAR_COMPACT_WIDTH, TOP_BAR_LABELS_MIN_WIDTH, TOP_BAR_TOOLS_WIDTH } from '@/lib/stage'
import { cn } from '@/lib/utils'
import { billingConfigured } from '@/lib/account'
import { planName } from '@/lib/plans'
import { cloudConfigured } from '@/lib/convex'
import {
  createDeviceLayer,
  createIconLayer,
  createShapeLayer,
  createTextLayer,
} from '@/lib/layer-factories'
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
      <ProjectSegment compactTools={compactTools} />
      {/* La colonne reste, vide : la grille en compte trois, et c'est elle qui
          garde le groupe central au milieu quand il revient. */}
      {compactTools ? <span /> : <ToolsSegment />}
      <ActionsSegment compactActions={compactActions} compactTools={compactTools} />
    </div>
  )
}

/**
 * Le libellé d'un témoin s'écrit là où la rangée a la place de le porter.
 *
 * Un seul endroit le décide, pour les deux témoins : ils se lisent d'affilée,
 * donc l'un écrit pendant que l'autre est en pictogramme n'a aucun sens. Le
 * seuil vient de `lib/stage.ts` et non d'un `xl:` — écrit en dur, il était
 * tombé pile sur le seuil de repli, et deux libellés `shrink-0` apparaissaient
 * exactement à la largeur où la rangée n'avait plus rien à leur donner.
 */
function useStatusLabelsWritten(): boolean {
  return !useMediaQuery(belowWidth(TOP_BAR_LABELS_MIN_WIDTH))
}

/** `sr-only` garde le libellé dans l'arbre d'accessibilité : la région live
 *  l'annonce à toute largeur, ce qu'un `display:none` empêchait. */
function statusLabelClass(written: boolean): string {
  return written ? '' : 'sr-only'
}

/**
 * L'identité du projet, son état, et de quoi revenir en arrière.
 *
 * Annuler et Rétablir sont ici et non au centre avec les outils de création :
 * ce ne sont pas des outils, ce sont les deux gestes qui répondent à ce que
 * l'état d'enregistrement vient d'annoncer. On les lit d'affilée — « Enregistré,
 * et je peux défaire » — là où, posés en tête du groupe central, ils se lisaient
 * comme la première chose qu'on ajoute à une planche.
 *
 * Ils se replient avec les outils et non avec les actions secondaires, parce que
 * c'est la liste `useToolActions` qui les porte déjà en tête du menu débordant :
 * les faire suivre un autre seuil les aurait rendus présents deux fois.
 */
function ProjectSegment({ compactTools }: { compactTools: boolean }) {
  const saveStatus = useUIStore((s) => s.saveStatus)
  const written = useStatusLabelsWritten()

  return (
    // `gap-1` au dehors, `gap-2` au dedans : le filet veut la même grammaire
    // qu'ailleurs dans la barre (4px de gouttière + 6px de `mx-1.5` de chaque
    // côté). Posé directement dans un parent en `gap-2`, il aurait rendu 14px
    // d'un côté et 10 de l'autre.
    <div className="flex min-w-0 items-center gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <ProjectName />
        <ProjectSwitcher projectNameInputId={PROJECT_NAME_INPUT_ID} />
        {/*
        L'état informe, il n'alerte pas : casse normale, teinte faible.

        Le témoin lui-même ne se masque à aucune largeur. Une application sans
        serveur qui n'offre aucune preuve d'enregistrement n'est pas discrète,
        elle est muette — et l'état qui disparaissait le premier était l'échec.
        Seul le libellé se replie en `sr-only`, sous `TOP_BAR_LABELS_MIN_WIDTH` :
        il reste dans l'arbre d'accessibilité, donc la région live l'annonce
        toujours, ce qu'un `display:none` empêchait à toute largeur. La pastille
        décorative qui occupait la place du témoin de document modifié a
        disparu ; c'est ce témoin-ci qui la tient désormais.
      */}
        <span
          role="status"
          aria-live="polite"
          /* Replié, le témoin n'est plus qu'une pastille de couleur : le
             lecteur d'écran garde le libellé `sr-only`, et le `title` le rend
             à la souris. Un état qui ne tient qu'à une couleur n'est pas un
             état, c'est une décoration. */
          title={written ? undefined : SAVE_LABELS[saveStatus]}
          className={cn(
            'flex shrink-0 items-center gap-1.5 text-2xs',
            saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {saveStatus === 'idle' && (
            <span aria-hidden className="size-2 shrink-0 rounded-xs bg-muted-foreground" />
          )}
          {saveStatus === 'saving' && (
            <LoaderCircle size={11} className="animate-spin" aria-hidden />
          )}
          {saveStatus === 'saved' && <Check size={11} className="text-success" aria-hidden />}
          {saveStatus === 'error' && <TriangleAlert size={11} aria-hidden />}
          <span className={statusLabelClass(written)}>{SAVE_LABELS[saveStatus]}</span>
        </span>
        <SyncIndicator written={written} />
      </div>
      {!compactTools && <HistoryControls />}
    </div>
  )
}

/** Annuler et Rétablir, à la droite de l'état d'enregistrement. */
function HistoryControls() {
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.past.length > 0)
  const canRedo = useHistoryStore((s) => s.future.length > 0)

  return (
    <>
      <Divider />
      {/* Ces deux-là ne cèdent pas : c'est le nom du projet, à leur gauche, qui
          se tronque quand la colonne se resserre. */}
      <IconButton
        className="shrink-0"
        aria-label="Annuler"
        tooltip="Annuler (⌘Z)"
        disabled={!canUndo}
        onClick={() => undo()}
      >
        <Undo2 size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        className="shrink-0"
        aria-label="Rétablir"
        tooltip="Rétablir (⌘⇧Z)"
        disabled={!canRedo}
        onClick={() => redo()}
      >
        <Redo2 size={16} strokeWidth={1.75} />
      </IconButton>
    </>
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
function SyncIndicator({ written }: { written: boolean }) {
  const syncStatus = useUIStore((s) => s.syncStatus)
  if (syncStatus === 'off') return null

  const label = SYNC_LABELS[syncStatus]
  return (
    <span
      role="status"
      aria-live="polite"
      title={written ? undefined : label}
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-2xs',
        syncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {syncStatus === 'syncing' && <LoaderCircle size={11} className="animate-spin" aria-hidden />}
      {syncStatus === 'synced' && <Cloud size={11} className="text-success" aria-hidden />}
      {syncStatus === 'offline' && <CloudOff size={11} aria-hidden />}
      {syncStatus === 'error' && <TriangleAlert size={11} aria-hidden />}
      <span className={statusLabelClass(written)}>{label}</span>
    </span>
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
      // `title=` et non Tooltip ici, à dessein : une infobulle au focus
      // surgirait à chaque clic d'édition, exactement quand on n'a pas besoin
      // d'elle — le survol seul la veut, et c'est le seul geste du natif.
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

/**
 * Les cinq outils d'ajout, et rien d'autre.
 *
 * Rien d'autre depuis qu'Annuler et Rétablir sont passés à gauche : le groupe
 * n'a plus de voisin à séparer, donc plus de filet non plus. Ce qui est au
 * centre est ce qu'on pose sur la planche, entièrement.
 */
function ToolsSegment() {
  function addLayer(layer: Layer) {
    useCanvasStore.getState().addLayer(layer)
  }

  function layerCount() {
    return getProjectLayers(useProjectStore.getState().project).length
  }

  return (
    <div className="flex items-center gap-1 justify-self-center">
      {/*
        Le rail en creux qui les portait reproduisait mot pour mot le conteneur
        de `ToggleGroup`, lequel veut dire « choisis-en un, un est allumé » dans
        le contrôle Uni/Dégradé/Préréglages du même écran. Quatre actions sans
        état n'ont pas cet habit. Il rendait par ailleurs à 1,10:1 sur la carte
        en sombre, donc le groupement qu'il justifiait était invisible, et ses
        40px de haut débordaient du retrait d'îlot.
      */}
      <IconButton
        aria-label="Ajouter Texte"
        tooltip="Ajouter : texte"
        onClick={() => addLayer(createTextLayer(layerCount()))}
      >
        <Type size={16} strokeWidth={1.75} />
      </IconButton>
      <DeviceAddTool onSelect={(model) => addLayer(createDeviceLayer(model, layerCount()))} />
      <IconButton
        aria-label="Ajouter Image"
        tooltip="Ajouter : image…"
        onClick={() => document.getElementById('sf-image-import-input')?.click()}
      >
        <ImageIcon size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Ajouter Forme"
        tooltip="Ajouter : forme"
        onClick={() => addLayer(createShapeLayer(layerCount()))}
      >
        <Square size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Ajouter Icône"
        tooltip="Ajouter : icône"
        onClick={() => addLayer(createIconLayer(layerCount()))}
      >
        <Star size={16} strokeWidth={1.75} />
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
    {
      id: 'add-icon',
      label: 'Ajouter Icône',
      hint: 'Ajouter : icône',
      icon: <Star size={16} strokeWidth={1.75} />,
      onSelect: () => addLayer(createIconLayer),
    },
  ]
}

/**
 * L'entrée de compte, ou rien.
 *
 * Rien est le cas normal : sans déploiement configuré, ScreenForge est
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
 * « Local » et « Cloud » n'ont pas de glyphe que l'œil lise sans légende, et
 * la rangée voisine est entièrement en icônes : un mot y devient le seul repère
 * textuel, ce qui est exactement ce qu'on veut d'un état de compte. Le point
 * citron marque le palier payant — même vocabulaire que « vous êtes ici »
 * ailleurs dans l'application, jamais sur une action.
 */
function BadgeIcon({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1.5 text-2xs font-medium">
      {children !== 'Essai' && (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-marker" />
      )}
      {children}
    </span>
  )
}

/**
 * Trois rangs, et non une liste.
 *
 * Onze pictogrammes alignés sans respiration se lisaient comme un tiroir : rien
 * ne disait que « Publier chez Apple » et « Changer de thème » n'ont pas le même
 * poids. Les libellés ne réglaient pas ça — neuf mots ne tiennent pas sous
 * 1280px et doubleraient les infobulles — mais l'ordre et les filets, si.
 *
 * Composer : ce qui pose des calques sur la planche.
 */
function useComposeActions(): SecondaryAction[] {
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const showCampaignDialog = useUIStore((s) => s.showCampaignDialog)

  return [
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
      id: 'campaign',
      label: 'Générer les visuels App Store',
      hint: 'Captures, brief et style vers des calques éditables',
      /* Un mégaphone, pas une baguette magique. Les visuels de la fiche sont
         du marketing, et la génération n'est intelligente que si l'utilisateur
         a branché un modèle — une baguette la promettait dans tous les cas et
         se lisait par ailleurs comme une retouche par IA du calque courant. */
      icon: <Megaphone size={16} strokeWidth={1.75} />,
      expanded: showCampaignDialog,
      onSelect: () => useUIStore.getState().setShowCampaignDialog(!showCampaignDialog),
    },
  ]
}

/** Livrer : ce qui mène un projet relu jusqu'à la fiche du magasin. */
function useDeliverActions(): SecondaryAction[] {
  const showRefreshDialog = useUIStore((s) => s.showRefreshDialog)
  const showLocaleDialog = useUIStore((s) => s.showLocaleDialog)
  const showReleaseDialog = useUIStore((s) => s.showReleaseDialog)
  const showPublishDialog = useUIStore((s) => s.showPublishDialog)

  return [
    {
      id: 'refresh',
      label: 'Actualiser les captures',
      hint: 'Remplacer le lot de captures',
      icon: <RefreshCw size={16} strokeWidth={1.75} />,
      expanded: showRefreshDialog,
      onSelect: () => useUIStore.getState().setShowRefreshDialog(!showRefreshDialog),
    },
    {
      id: 'locales',
      label: 'Ouvrir les langues',
      hint: 'Variantes de langue et débordements',
      icon: <Languages size={16} strokeWidth={1.75} />,
      expanded: showLocaleDialog,
      onSelect: () => useUIStore.getState().setShowLocaleDialog(!showLocaleDialog),
    },
    {
      id: 'releases',
      label: 'Ouvrir les releases',
      hint: 'Releases figées et comparaison',
      icon: <Package size={16} strokeWidth={1.75} />,
      expanded: showReleaseDialog,
      onSelect: () => useUIStore.getState().setShowReleaseDialog(!showReleaseDialog),
    },
    {
      id: 'publish',
      label: 'Publier chez Apple',
      hint: 'Preflight, manifeste et commande asc',
      icon: <CloudUpload size={16} strokeWidth={1.75} />,
      expanded: showPublishDialog,
      onSelect: () => useUIStore.getState().setShowPublishDialog(!showPublishDialog),
    },
  ]
}

/**
 * Utilitaires : ce qu'on ouvre une fois, ou une fois par mois.
 *
 * Ils vivent dans le menu « … » à toute largeur. Un thème qu'on choisit une
 * fois n'a pas à occuper en permanence la place d'une action de livraison.
 */
function useUtilityActions(): SecondaryAction[] {
  const account = useAccountAction()
  const plan = usePlanAction()
  const showMcpDialog = useUIStore((s) => s.showMcpDialog)
  const mcpStatus = useMcpStore((s) => s.status)
  const theme = useUIStore((s) => s.theme)

  return [
    ...(plan ? [plan] : []),
    ...(account ? [account] : []),
    {
      id: 'mcp',
      label: 'Connexion MCP',
      hint: `Piloter le projet ouvert — ${MCP_LABELS[mcpStatus].toLowerCase()}`,
      /* La pastille à côté de la prise, jamais posée dessus : repliée dans le
         menu, l'icône retombe dans une fente que le menu dimensionne, et une
         pastille en absolu y déborderait sur le libellé. */
      icon: (
        <span className="inline-flex items-center gap-1">
          <Plug2 size={16} strokeWidth={1.75} />
          <McpStatusDot status={mcpStatus} />
        </span>
      ),
      expanded: showMcpDialog,
      onSelect: () => useUIStore.getState().setShowMcpDialog(!showMcpDialog),
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

/**
 * Le menu « … », et les rangs qu'il porte encore repliés.
 *
 * Il reçoit des groupes, pas une liste : les filets qui séparent composer de
 * livrer sur la rangée doivent survivre au repli, sinon le repli défait
 * précisément la hiérarchie qu'il est censé préserver.
 */
function SecondaryActionsMenu({ groups }: { groups: SecondaryAction[][] }) {
  const [open, setOpen] = useState(false)
  const filled = groups.filter((group) => group.length > 0)

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={
        <IconButton
          aria-label="Ouvrir les autres actions"
          tooltip="Autres actions"
          active={open}
          aria-expanded={open}
        >
          <MoreHorizontal size={16} strokeWidth={1.75} />
        </IconButton>
      }
      ariaLabel="Autres actions"
      items={filled.flatMap((group, index) => [
        ...(index > 0 ? (['separator'] as const) : []),
        ...group.map((action) => ({
          id: action.id,
          label: action.label,
          icon: action.icon,
          disabled: action.disabled,
          onSelect: action.onSelect,
        })),
      ])}
    />
  )
}

function RowAction({ action }: { action: SecondaryAction }) {
  return (
    <IconButton
      aria-label={action.label}
      tooltip={action.hint}
      active={action.expanded}
      aria-expanded={action.expanded}
      aria-haspopup={action.expanded === undefined ? undefined : 'dialog'}
      onClick={action.onSelect}
      className={action.className}
    >
      {action.icon}
    </IconButton>
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
  const compose = useComposeActions()
  const deliver = useDeliverActions()
  const utilities = useUtilityActions()
  const tools = useToolActions()
  // Le CTA principal reste, ce sont ses voisins qui cèdent — et les outils
  // repliés arrivent en tête du menu, dans l'ordre de la rangée qu'ils quittent.
  const compact = compactActions || compactTools
  const folded = compact
    ? [...(compactTools ? [tools] : []), compose, deliver, utilities]
    : [utilities]

  return (
    <div className="flex items-center gap-1 justify-self-end">
      {/* `aria-pressed` sur ce qui bascule, `aria-expanded` sur ce qui ouvre :
          `data-active` ne peint que pour l'œil, il ne dit rien à un lecteur
          d'écran, qui annonçait donc le même bouton dans les deux états. */}
      <IconButton
        aria-label="Basculer le panneau Calques"
        tooltip="Panneau Calques (⌘⇧L)"
        active={layersOpen}
        aria-pressed={layersOpen}
        onClick={() => useUIStore.getState().toggleLayers()}
      >
        <PanelLeft size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Basculer le panneau Propriétés"
        tooltip="Panneau Propriétés (⌘⇧P)"
        active={propsOpen}
        aria-pressed={propsOpen}
        onClick={() => useUIStore.getState().toggleProps()}
      >
        <PanelRight size={16} strokeWidth={1.75} />
      </IconButton>

      <Divider />

      {!compact && (
        <>
          {compose.map((action) => (
            <RowAction key={action.id} action={action} />
          ))}
          <Divider />
          {deliver.map((action) => (
            <RowAction key={action.id} action={action} />
          ))}
          <Divider />
        </>
      )}

      <SecondaryActionsMenu groups={folded} />

      <Button
        variant="primary"
        size="md"
        aria-label="Ouvrir l’export"
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
          tooltip="Ajouter : cadre iPhone"
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
