import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { toast } from '@/stores/toast.store'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/patterns/hint'
import { ConfirmAction } from '@/components/patterns/confirm-action'
import { ScreenThumbnail, type PickMode } from './ScreenThumbnail'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { clampNumber } from '@/lib/number'
import {
  FILMSTRIP_GAP,
  FILMSTRIP_MAX_WIDTH,
  FILMSTRIP_PADDING,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_LABEL_ROW,
  THUMBNAIL_LIFT,
  THUMBNAIL_SLOT,
  THUMBNAIL_WIDTH,
  filmstripHeight,
} from '@/lib/stage'
import { cn } from '@/lib/utils'
import type { Background } from '@/types'

/**
 * De combien un rang se décale pendant un glissement.
 *
 * Les rangs compris entre l'origine et la cible reculent d'un pas, ou avancent
 * si le geste remonte la bande ; le rang déplacé ne bouge pas, c'est le curseur
 * qui le porte. Le décalage libère toujours l'emplacement sous le curseur, donc
 * `dragover` ne peut pas rebondir entre deux tuiles.
 */
function slotShift(index: number, drag: { from: number; over: number } | null): number {
  if (!drag || drag.from === drag.over || index === drag.from) return 0
  if (drag.from < drag.over && index > drag.from && index <= drag.over) return -THUMBNAIL_SLOT
  if (drag.from > drag.over && index < drag.from && index >= drag.over) return THUMBNAIL_SLOT
  return 0
}

/** Floating bottom-center screens strip. */
export function ScreensBar() {
  const { screens, activeScreenId } = useProjectStore(
    useShallow((state) => ({
      screens: state.project?.screens,
      activeScreenId: state.project?.activeScreenId ?? '',
    })),
  )
  const list = screens ?? []
  const atCapacity = list.length >= MAX_PROJECT_SCREENS
  const dragSourceIndex = useRef<number | null>(null)
  const dragOverIndex = useRef<number | null>(null)
  const [copiedSettings, setCopiedSettings] = useState<Background | null>(null)
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)

  /**
   * Les écrans retenus, quand il y en a plus d'un.
   *
   * L'écran courant reste `project.activeScreenId` et n'a pas bougé de là :
   * c'est lui que la scène montre, et une pellicule ne décide pas de ce qu'on
   * édite. `picked` ne dit que ceci — sur quels écrans la prochaine action va
   * porter. Vide ou réduit à un, tout se comporte comme avant.
   *
   * Aucun effet ne le nettoie : il est relu à chaque action contre le projet du
   * moment, et `multiple` retombe à faux dès qu'il ne contient plus l'écran
   * courant — ce qui arrive dès qu'on change d'écran depuis le canevas ou
   * ailleurs. Une sélection périmée s'annule donc d'elle-même.
   */
  const [picked, setPicked] = useState<string[]>([])
  const multiple = picked.length > 1 && picked.includes(activeScreenId)

  /** Sur quoi une action lancée depuis `id` porte réellement. */
  const targetIds = useCallback(
    (id: string): string[] => {
      if (!multiple || !picked.includes(id)) return [id]
      const live = new Set(useProjectStore.getState().project?.screens.map((s) => s.id) ?? [])
      return picked.filter((candidate) => live.has(candidate))
    },
    [multiple, picked],
  )

  const activate = useCallback((id: string) => {
    if (id === useProjectStore.getState().project?.activeScreenId) return
    useProjectStore.getState().setActiveScreenId(id)
    useCanvasStore.getState().clearSelection()
  }, [])

  /**
   * Clic simple, ⌘/Ctrl pour ajouter ou retirer, ⇧ pour étendre.
   *
   * L'ancre de l'étendue est l'écran courant, et ⇧ ne le déplace pas : deux ⇧
   * clics de suite grandissent ou rétrécissent la même plage au lieu d'en
   * ouvrir une nouvelle à chaque fois. C'est aussi ce qui laisse la scène sur
   * l'écran qu'on était en train de composer pendant qu'on en désigne d'autres.
   */
  const handleSelect = useCallback(
    (id: string, mode: PickMode) => {
      const project = useProjectStore.getState().project
      if (!project) return
      const ids = project.screens.map((screen) => screen.id)

      if (mode === 'range') {
        const anchor = ids.indexOf(project.activeScreenId)
        const reached = ids.indexOf(id)
        if (anchor === -1 || reached === -1) return
        const [from, to] = anchor <= reached ? [anchor, reached] : [reached, anchor]
        setPicked(ids.slice(from, to + 1))
        return
      }

      const group = (multiple ? picked : [project.activeScreenId]).filter((candidate) =>
        ids.includes(candidate),
      )
      if (mode === 'toggle') {
        if (!group.includes(id)) {
          setPicked([...group, id])
          activate(id)
          return
        }
        // On ne se retire pas d'une sélection dont on est le seul membre : il
        // faut toujours un écran courant, et le retirer n'en désignerait aucun.
        if (group.length === 1) return
        const rest = group.filter((candidate) => candidate !== id)
        setPicked(rest)
        if (id === project.activeScreenId) activate(rest[0])
        return
      }

      setPicked([id])
      activate(id)
    },
    [activate, multiple, picked],
  )

  const handleAdd = useCallback(() => {
    const project = useProjectStore.getState().project
    if (!project || project.screens.length >= MAX_PROJECT_SCREENS) return
    useCanvasStore.getState().recordProjectHistory()
    if (useProjectStore.getState().addScreen()) {
      setPicked([])
      useCanvasStore.getState().clearSelection()
    }
  }, [])

  const handleRename = useCallback((id: string, name: string) => {
    useProjectStore.getState().renameScreen(id, name)
  }, [])

  const handleDuplicate = useCallback(
    (id: string) => {
      const project = useProjectStore.getState().project
      if (!project) return
      const room = MAX_PROJECT_SCREENS - project.screens.length
      if (room <= 0) return
      const ids = targetIds(id)
      useCanvasStore.getState().recordProjectHistory()
      const copies = ids
        .slice(0, room)
        .flatMap((target) => useProjectStore.getState().duplicateScreen(target) ?? [])
      if (copies.length === 0) return
      // Ce qui n'a pas tenu est dit : un plafond silencieux se lit comme « tout
      // a été fait », et c'est faux d'exactement ce qui manque.
      if (copies.length < ids.length) {
        toast(`${copies.length} copies sur ${ids.length} : maximum ${MAX_PROJECT_SCREENS} écrans.`)
      }
      setPicked(copies)
      useCanvasStore.getState().clearSelection()
    },
    [targetIds],
  )

  /* La suppression se confirme : elle s'annule, mais un écran est une
     composition, et un clic de trop dans un menu ne doit pas en coûter trois.
     Le bouton nomme la quantité, le menu l'a déjà annoncée. */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const pendingCount = pendingDelete ? targetIds(pendingDelete).length : 0

  const handleDelete = useCallback(
    (id: string) => {
      const project = useProjectStore.getState().project
      if (!project || project.screens.length <= 1) return
      const ids = targetIds(id)
      useCanvasStore.getState().recordProjectHistory()
      // `removeScreen` refuse de descendre sous un écran, donc une sélection
      // complète en laisse un plutôt que de vider le projet.
      const removed = ids.filter((target) => useProjectStore.getState().removeScreen(target))
      if (removed.length === 0) return
      if (removed.length < ids.length) toast('Un écran au moins doit rester.')
      setPicked([])
      useCanvasStore.getState().clearSelection()
    },
    [targetIds],
  )

  const handleCopySettings = useCallback((id: string) => {
    const screen = useProjectStore
      .getState()
      .project?.screens.find((candidate) => candidate.id === id)
    if (!screen) return
    setCopiedSettings(structuredClone(screen.background))
    toast(`Réglages de ${screen.name} copiés.`, 'success')
  }, [])

  const handlePasteSettings = useCallback(
    (id: string) => {
      if (!copiedSettings) return
      const project = useProjectStore.getState().project
      if (!project) return
      const wanted = JSON.stringify(copiedSettings)
      const screens = targetIds(id).flatMap(
        (target) => project.screens.find((candidate) => candidate.id === target) ?? [],
      )
      const changing = screens.filter((screen) => JSON.stringify(screen.background) !== wanted)
      if (changing.length === 0) {
        toast(
          screens.length === 1
            ? `${screens[0]?.name} utilise déjà ces réglages.`
            : 'Ces écrans utilisent déjà ces réglages.',
        )
        return
      }
      useCanvasStore.getState().recordProjectHistory()
      for (const screen of changing) {
        useProjectStore.getState().updateScreenBackground(screen.id, copiedSettings)
      }
      toast(
        changing.length === 1
          ? `Réglages appliqués à ${changing[0].name}.`
          : `Réglages appliqués à ${changing.length} écrans.`,
        'success',
      )
    },
    [copiedSettings, targetIds],
  )

  const handleMove = useCallback((index: number, direction: -1 | 1) => {
    const project = useProjectStore.getState().project
    if (!project) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= project.screens.length) return
    const reordered = [...project.screens]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    useCanvasStore.getState().recordProjectHistory()
    useProjectStore.getState().reorderScreens(reordered.map((screen) => screen.id))
  }, [])

  const handleDragStart = useCallback((index: number, event: React.DragEvent) => {
    // Un glissement déplace la tuile qu'on tient, jamais un bloc : la rangée ne
    // sait s'écarter que d'un emplacement, et voir trois tuiles retenues pendant
    // qu'une seule se déplace promettrait le contraire. La sélection retombe
    // donc sur ce qu'on a attrapé.
    // ponytail: réordonner un groupe entier viendra si le besoin se présente.
    setPicked([])
    dragSourceIndex.current = index
    dragOverIndex.current = index
    event.dataTransfer.effectAllowed = 'move'
    // L'image traînée est l'aperçu seul, pas la colonne : par défaut le
    // navigateur photographie l'élément déplaçable, dont la boîte englobe le
    // numéro et n'a aucun rayon — la vignette arrivait sous le curseur à angles
    // vifs, et plus large que ce qu'on avait attrapé.
    const preview = event.currentTarget.querySelector<HTMLElement>('[data-thumbnail-preview]')
    if (preview) {
      const bounds = preview.getBoundingClientRect()
      event.dataTransfer.setDragImage(
        preview,
        event.clientX - bounds.left,
        clampNumber(event.clientY - bounds.top, 0, bounds.height),
      )
    }
    setDrag({ from: index, over: index })
  }, [])

  /**
   * La cible pendant le geste, lue sur la position du curseur.
   *
   * Et non sur la tuile survolée, comme auparavant : le voisin qui se décale
   * vient couvrir exactement l'emplacement que la tuile déplacée occupe encore
   * dans le flux, et c'est lui que `dragover` désigne. L'emplacement d'origine
   * était donc injoignable — pour une tuile prise en première position, le
   * rang 0 restait bloqué pour tout le geste, et le lâcher la ramenait où elle
   * était. C'est le blocage signalé, photo à l'appui.
   *
   * La grille des emplacements est régulière et connue de `lib/stage.ts` : la
   * lire directement supprime aussi les zones mortes des gouttières, et rend
   * les deux extrémités atteignables en débordant la bande, où plus aucune
   * tuile ne se trouve. Un seul gestionnaire suffit, `dragover` remontant
   * depuis les tuiles — c'est aussi lui qui accepte le lâcher, le curseur
   * survolant le vide au moment du relâchement et non une tuile.
   */
  const handleStripDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (dragSourceIndex.current === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const count = useProjectStore.getState().project?.screens.length ?? 0
    if (count === 0) return
    const strip = event.currentTarget
    const x =
      event.clientX - strip.getBoundingClientRect().left + strip.scrollLeft - FILMSTRIP_PADDING
    const index = clampNumber(Math.floor(x / THUMBNAIL_SLOT), 0, count - 1)
    if (dragOverIndex.current === index) return
    dragOverIndex.current = index
    setDrag((current) => (current ? { ...current, over: index } : current))
  }, [])

  const handleDragEnd = useCallback(() => {
    dragSourceIndex.current = null
    dragOverIndex.current = null
    setDrag(null)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const sourceIndex = dragSourceIndex.current
    const targetIndex = dragOverIndex.current
    dragSourceIndex.current = null
    dragOverIndex.current = null
    setDrag(null)
    if (sourceIndex === null || targetIndex === null || sourceIndex === targetIndex) return
    const project = useProjectStore.getState().project
    if (!project) return
    const reordered = [...project.screens]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    useCanvasStore.getState().recordProjectHistory()
    useProjectStore.getState().reorderScreens(reordered.map((screen) => screen.id))
  }, [])

  return (
    <div
      // `group` et non `listbox` : une liste de sélection doit contenir des
      // `option`, ce que la bande n'a jamais eu — un lecteur d'écran annonçait
      // donc une liste vide. Ce sont les vignettes qui portent la sélection,
      // avec `aria-pressed`, et c'est exact pour des boutons.
      role="group"
      aria-label="Écrans"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        /* La garde globale laisse les flèches à tout ce qui vit dans un
           `role="group"` : c'est ici qu'elles deviennent la navigation de la
           pellicule, de vignette en vignette. Entrée active, comme avant. */
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('[data-thumbnail-preview]'),
        )
        const index = buttons.indexOf(document.activeElement as HTMLElement)
        if (index === -1) return
        event.preventDefault()
        const next =
          event.key === 'ArrowRight'
            ? Math.min(buttons.length - 1, index + 1)
            : Math.max(0, index - 1)
        buttons[next]?.focus()
      }}
      // La largeur maximale réserve la gouttière du HUD de zoom : centrée sur la
      // fenêtre, la bande passait sinon sous lui en fenêtre étroite.
      // Le haut porte le dégagement *et* la place du soulèvement : la tuile
      // courante sort de la boîte défilante par là, et `overflow-x: auto`
      // forçant l'autre axe, elle s'y ferait rogner.
      style={{
        height: filmstripHeight(),
        paddingTop: FILMSTRIP_PADDING + THUMBNAIL_LIFT,
        paddingRight: FILMSTRIP_PADDING,
        paddingBottom: FILMSTRIP_PADDING,
        paddingLeft: FILMSTRIP_PADDING,
        maxWidth: FILMSTRIP_MAX_WIDTH,
        gap: FILMSTRIP_GAP,
      }}
      // Aucune surface ici, contrairement à la barre et aux tiroirs : la bande
      // ne porte pas de contrôles, elle porte des aperçus, qui sont eux-mêmes
      // des surfaces. Une carte autour d'eux empilait plateau, tuile et aperçu à
      // trois clartés voisines, et prenait 26px de hauteur au canevas pour
      // encadrer du vide. Ce sont les vignettes qui flottent.
      className="filmstrip-scroll relative flex animate-slide-up items-start"
      onDragOver={handleStripDragOver}
      onDrop={handleDrop}
    >
      {/* Le décalage montre l'arrangement final, la barre nomme le point
          d'insertion — deux choses différentes, et la seconde manque dès que la
          place ouverte est en bord de bande ou hors du champ de vision.

          Un seul élément, positionné depuis `drag.over` : dix barres
          conditionnelles diraient la même chose en dix fois plus de DOM.
          `pointer-events-none` n'est pas une précaution mais une condition —
          posée dans le vide que la rangée vient d'ouvrir, elle est exactement là
          où le curseur se trouve, et elle volerait le `dragover` qui décide de
          la cible. */}
      {drag && (
        <span
          aria-hidden
          style={{
            left: FILMSTRIP_PADDING + drag.over * THUMBNAIL_SLOT + THUMBNAIL_WIDTH / 2 - 1.5,
            // La rangée du rang s'intercale entre le haut de la bande et
            // l'aperçu : la barre se pose sur les aperçus, pas sur la colonne.
            top: FILMSTRIP_PADDING + THUMBNAIL_LIFT + THUMBNAIL_LABEL_ROW,
            height: THUMBNAIL_HEIGHT,
          }}
          className="pointer-events-none absolute w-[3px] rounded-full bg-marker"
        />
      )}

      {list.map((screen, index) => (
        <div
          key={screen.id}
          draggable
          onDragStart={(event) => handleDragStart(index, event)}
          onDragEnd={handleDragEnd}
          // La rangée montre la place plutôt que de la promettre : les tuiles
          // s'écartent d'un pas pendant le geste et la rangée prend déjà la
          // forme qu'elle aura au lâcher. Sans cela le déplacement ne se voyait
          // qu'après coup.
          //
          // La tuile déplacée disparaît au lieu de pâlir : elle garde son
          // emplacement dans le flux, donc une voisine décalée vient se poser
          // dessus — à 40% d'opacité, deux aperçus se superposaient en bouillie
          // dès qu'on remontait la bande. C'est le navigateur qui la montre,
          // sous le curseur, pendant tout le geste.
          style={{ translate: `${slotShift(index, drag)}px` }}
          className={cn(
            'transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none',
            drag?.from === index && 'opacity-0',
          )}
        >
          <ScreenThumbnail
            screen={screen}
            isActive={screen.id === activeScreenId}
            isSelected={multiple ? picked.includes(screen.id) : screen.id === activeScreenId}
            groupSize={multiple && picked.includes(screen.id) ? picked.length : 1}
            index={index}
            canDelete={list.length > 1}
            canMoveLeft={index > 0}
            canMoveRight={index < list.length - 1}
            onSelect={handleSelect}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            canPasteSettings={copiedSettings !== null}
            onCopySettings={handleCopySettings}
            onPasteSettings={handlePasteSettings}
            onDelete={setPendingDelete}
            onMove={handleMove}
          />
        </div>
      ))}

      {/* Un bouton, et non une tuile. À la taille des vignettes il en portait le
          cadre et se lisait comme un écran de plus, vide ; ajouter un écran est
          une action, pas un emplacement. Centré sur l'aperçu, comme le
          compteur : c'est la rangée d'aperçus que l'œil suit. */}
      <div
        // Centré sur la rangée d'aperçus, que le rang décale vers le bas : la
        // bande aligne ses enfants en haut, donc l'écart se déclare ici.
        style={{ height: THUMBNAIL_HEIGHT, marginTop: THUMBNAIL_LABEL_ROW }}
        className="flex shrink-0 items-center"
      >
        <Hint content={atCapacity ? `Maximum ${MAX_PROJECT_SCREENS} écrans` : 'Ajouter un écran'}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Ajouter un écran"
            onClick={handleAdd}
            disabled={atCapacity}
          >
            <Plus size={16} strokeWidth={1.75} />
          </Button>
        </Hint>
      </div>

      {/* Le compteur n'apparaît qu'à l'approche de la limite : ailleurs il
          n'informe de rien que la rangée ne montre déjà. */}
      {list.length >= MAX_PROJECT_SCREENS - 1 && (
        <span
          style={{ height: THUMBNAIL_HEIGHT, marginTop: THUMBNAIL_LABEL_ROW }}
          className="tabular flex shrink-0 items-center px-1 text-2xs text-muted-foreground"
        >
          {list.length}/{MAX_PROJECT_SCREENS}
        </span>
      )}
      <ConfirmAction
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={pendingCount > 1 ? `Supprimer ${pendingCount} écrans ?` : 'Supprimer cet écran ?'}
        description="Les calques de l’écran partent avec lui. ⌘Z le ramène."
        confirmLabel={pendingCount > 1 ? `Supprimer ${pendingCount} écrans` : 'Supprimer l’écran'}
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
