import { memo, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { cn } from '@/lib/utils'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/lib/stage'
import type { Screen } from '@/types'

interface ScreenThumbnailProps {
  screen: Screen
  isActive: boolean
  index: number
  canDelete: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  canPasteSettings: boolean
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onCopySettings: (id: string) => void
  onPasteSettings: (id: string) => void
  onDelete: (id: string) => void
  onMove: (index: number, direction: -1 | 1) => void
}

export const ScreenThumbnail = memo(function ScreenThumbnail({
  screen,
  isActive,
  index,
  canDelete,
  canMoveLeft,
  canMoveRight,
  canPasteSettings,
  onSelect,
  onRename,
  onDuplicate,
  onCopySettings,
  onPasteSettings,
  onDelete,
  onMove,
}: ScreenThumbnailProps) {
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(screen.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const actionsRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [editing])

  function startRename() {
    setDraftName(screen.name)
    setEditing(true)
  }

  function commitRename() {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== screen.name) onRename(screen.id, trimmed)
    setEditing(false)
  }

  return (
    <div
      // Largeur imposée par la vignette, et non par le libellé : c'est en
      // laissant l'étiquette étirer la colonne que la tuile perdait son cadrage.
      style={{ width: THUMBNAIL_WIDTH }}
      className="group/thumb relative flex shrink-0 flex-col gap-2"
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuPosition({ left: event.clientX, top: event.clientY })
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(screen.id)}
        onDoubleClick={startRename}
        aria-label={`Activer ${screen.name}`}
        aria-pressed={isActive}
        style={{ height: THUMBNAIL_HEIGHT }}
        className={cn(
          'w-full cursor-pointer overflow-hidden rounded-md bg-muted',
          'border transition-[border-color,box-shadow,transform] duration-150 ease-out',
          'active:scale-[0.97]',
          // L'écran courant est un état : l'anneau d'accent le dit à distance,
          // là où deux gris voisins demandaient de comparer les vignettes.
          isActive
            ? 'border-transparent shadow-[0_0_0_2px_var(--color-marker)]'
            : 'border-border hover:border-input',
        )}
      >
        {screen.thumbnail ? (
          <img
            src={screen.thumbnail}
            alt={screen.name}
            className="img-outline h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-secondary" />
        )}
      </button>

      {/* Le numéro vit sous la vignette, pas dessus : à cette largeur une pastille
          posée sur l'image en masquait le quart. Et le numéro seul : la tuile
          fait la largeur de l'artboard, où un nom ne tient qu'amputé — « 03 O… »
          ne dit rien de plus que « 03 ». Le nom complet reste sur l'infobulle,
          dans le menu contextuel, et au-dessus de la planche sur le canevas. */}
      {editing ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename()
            if (event.key === 'Escape') setEditing(false)
          }}
          aria-label="Nom de l’écran"
          spellCheck={false}
          className="field-surface h-5 w-full px-1 text-center text-2xs text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(screen.id)}
          onDoubleClick={startRename}
          title={`${screen.name} — double-clic pour renommer`}
          // Doublon de la vignette au pointeur, et rien de plus : deux boutons
          // « Activer Écran 1 » à la suite dans l'arbre d'accessibilité font
          // deux arrêts de tabulation pour une seule action.
          aria-hidden
          tabIndex={-1}
          className={cn(
            // `hit-44` : le libellé fait 20px de haut mais se clique comme le
            // reste. Le recouvrement avec la vignette est sans effet — même action.
            //
            // La zone monte au lieu de se centrer. Centrée, elle dépassait de
            // 6px sous le bord de la bande ; or `overflow-x: auto` force l'autre
            // axe à `auto` lui aussi, et cette bande a une hauteur fixe : les
            // 6px suffisaient à y faire apparaître une barre de défilement
            // verticale. Ancrée en bas, elle ne déborde plus que sur la vignette,
            // qui déclenche la même action.
            'hit-44 after:top-auto after:bottom-0 after:[translate:-50%_0]',
            'flex h-5 w-full items-center justify-center rounded-xs px-0.5',
            'text-2xs transition-colors',
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-muted-foreground',
          )}
        >
          <span className="tabular">{String(index + 1).padStart(2, '0')}</span>
        </button>
      )}

      <button
        ref={actionsRef}
        type="button"
        onClick={() => {
          if (menuPosition) setMenuPosition(null)
          else {
            const bounds = actionsRef.current?.getBoundingClientRect()
            if (bounds) setMenuPosition({ left: bounds.right - 180, top: bounds.top - 150 })
          }
        }}
        className={cn(
          // Zone ancrée au coin plutôt que centrée : centrée, elle dépassait de
          // 12px à droite de la tuile et volait le clic à la vignette voisine.
          // Elle ne recouvre plus que sa propre tuile, et reste inerte tant que
          // le bouton n'est pas survolé.
          'hit-44 after:inset-auto after:right-0 after:top-0 after:translate-none',
          'absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-xs',
          'border border-border bg-card/95 text-muted-foreground transition-opacity hover:text-foreground',
          !menuPosition &&
            'pointer-events-none opacity-0 focus:pointer-events-auto focus:opacity-100 group-hover/thumb:pointer-events-auto group-hover/thumb:opacity-100',
        )}
        aria-label={`Actions de ${screen.name}`}
        aria-expanded={menuPosition !== null}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={12} strokeWidth={1.75} aria-hidden />
      </button>

      {menuPosition && (
        <ContextMenu
          position={menuPosition}
          label={`Actions de ${screen.name}`}
          onClose={() => setMenuPosition(null)}
          items={[
            { label: 'Renommer', icon: <Pencil size={11} strokeWidth={1.5} aria-hidden />, onSelect: startRename },
            { label: 'Dupliquer', icon: <Copy size={11} strokeWidth={1.5} aria-hidden />, onSelect: () => onDuplicate(screen.id) },
            'separator',
            { label: 'Copier les réglages', icon: <ClipboardCopy size={11} strokeWidth={1.5} aria-hidden />, onSelect: () => onCopySettings(screen.id) },
            { label: 'Coller les réglages', icon: <ClipboardPaste size={11} strokeWidth={1.5} aria-hidden />, disabled: !canPasteSettings, onSelect: () => onPasteSettings(screen.id) },
            'separator',
            { label: 'Déplacer à gauche', icon: <ChevronLeft size={11} strokeWidth={1.5} aria-hidden />, disabled: !canMoveLeft, onSelect: () => onMove(index, -1) },
            { label: 'Déplacer à droite', icon: <ChevronRight size={11} strokeWidth={1.5} aria-hidden />, disabled: !canMoveRight, onSelect: () => onMove(index, 1) },
            { label: 'Supprimer', icon: <Trash2 size={11} strokeWidth={1.5} aria-hidden />, danger: true, disabled: !canDelete, onSelect: () => onDelete(screen.id) },
          ]}
        />
      )}
    </div>
  )
})
