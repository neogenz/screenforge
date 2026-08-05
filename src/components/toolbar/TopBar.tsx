import { useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Download,
  FileDown,
  FolderOpen,
  ImageIcon,
  LayoutTemplate,
  LoaderCircle,
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
} from 'lucide-react'
import { useHistoryStore } from '@/stores/history.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { useUIStore, type SaveStatus } from '@/stores/ui.store'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import {
  createProjectFile,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME,
  projectFileErrorMessage,
} from '@/lib/project-file'
import { importPortableProject, saveCurrentProject } from '@/lib/storage'
import { downloadBlob, slugify } from '@/lib/zip'
import { toast } from '@/stores/toast.store'
import {
  createDeviceLayer,
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
  return (
    <div className="island grid grid-cols-[minmax(0,1fr)_auto_1fr] items-center gap-2">
      <ProjectSegment />
      <ToolsSegment />
      <ActionsSegment />
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
    </div>
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
        trigger={(
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
            {busy
              ? <LoaderCircle size={13} className="animate-spin" aria-hidden />
              : <ChevronDown size={13} strokeWidth={2} aria-hidden />}
          </IconButton>
        )}
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
        'field-sizing-content h-9 min-w-24 max-w-[28ch] truncate',
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
      <DeviceAddTool
        onSelect={(model) => addLayer(createDeviceLayer(model, layerCount()))}
      />
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

function ActionsSegment() {
  const layersOpen = useUIStore((s) => s.layersOpen)
  const propsOpen = useUIStore((s) => s.propsOpen)
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const theme = useUIStore((s) => s.theme)

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

      <IconButton
        aria-label="Ouvrir les modèles"
        title="Modèles de mise en page"
        active={showTemplatesPicker}
        aria-expanded={showTemplatesPicker}
        aria-haspopup="dialog"
        onClick={() => useUIStore.getState().setShowTemplatesPicker(!showTemplatesPicker)}
      >
        <LayoutTemplate size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Ouvrir les réglages globaux"
        title="Réglages globaux du projet"
        active={showGlobalsEditor}
        aria-expanded={showGlobalsEditor}
        aria-haspopup="dialog"
        onClick={() => useUIStore.getState().setShowGlobalsEditor(!showGlobalsEditor)}
      >
        <Settings size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Changer de thème"
        title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        onClick={() => useUIStore.getState().toggleTheme()}
      >
        {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </IconButton>
      <button
        type="button"
        aria-label="Ouvrir la palette de commandes"
        title="Palette de commandes (⌘K)"
        onClick={() => useUIStore.getState().setShowCommandPalette(true)}
        className={cn(
          'flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground',
          'transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground',
        )}
      >
        <Kbd>⌘K</Kbd>
      </button>

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

  const models = [...CURRENT_DEVICE_FRAMES].sort((a, b) =>
    Number(b.model === preferredModel) - Number(a.model === preferredModel),
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={(
        <IconButton
          aria-label="Ajouter un cadre iPhone"
          title="Ajouter : cadre iPhone"
          active={open}
          aria-expanded={open}
        >
          <Smartphone size={16} strokeWidth={1.75} />
          <ChevronDown size={9} strokeWidth={2} aria-hidden className="-ml-0.5" />
        </IconButton>
      )}
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
