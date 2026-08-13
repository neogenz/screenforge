import { memo, useEffect, useRef, useState } from 'react'
import {
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  Lock,
  Smartphone,
  Square,
  Star,
  Type,
  Unlock,
} from 'lucide-react'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { IconButton } from '@/components/ui/icon-button'
import { buildLayerMenuItems } from './layer-menu'
import { useLayerActions } from '@/hooks/use-layer-actions'
import { layerDisplayName } from '@/lib/layer-factories'
import { cn } from '@/lib/utils'
import type { Layer } from '@/types'

interface LayerItemProps {
  layer: Layer
  isSelected: boolean
  tabIndex: number
  onSelect: (layer: Layer, event: React.MouseEvent) => void
  onSelectExclusive: (layer: Layer) => void
  onNavigate: (layer: Layer, key: string, extend: boolean) => void
  onFocusRow: (layer: Layer) => void
  onDragStart: (layer: Layer, event: React.DragEvent) => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: (layer: Layer, event: React.DragEvent) => void
}

function LayerTypeIcon({ type }: { type: Layer['type'] }) {
  const className = 'shrink-0'
  switch (type) {
    case 'text':
      return <Type size={13} strokeWidth={1.5} className={className} aria-hidden />
    case 'device-frame':
      return <Smartphone size={13} strokeWidth={1.5} className={className} aria-hidden />
    case 'image':
      return <ImageIcon size={13} strokeWidth={1.5} className={className} aria-hidden />
    case 'icon':
      return <Star size={13} strokeWidth={1.5} className={className} aria-hidden />
    default:
      return <Square size={13} strokeWidth={1.5} className={className} aria-hidden />
  }
}

/**
 * A single layer row. Memoized: the parent passes stable callbacks (the layer
 * is handed back as an argument), so rows skip re-renders unless their own
 * layer or selection state changes.
 */
export const LayerItem = memo(function LayerItem({
  layer,
  isSelected,
  tabIndex,
  onSelect,
  onSelectExclusive,
  onNavigate,
  onFocusRow,
  onDragStart,
  onDragOver,
  onDrop,
}: LayerItemProps) {
  const actions = useLayerActions()
  const displayName = layerDisplayName(layer)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(layer.name)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const [entered, setEntered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [editing])

  function startRename() {
    // Le champ part de ce que la ligne affiche, pas du nom stocké : sur un
    // calque de texte jamais renommé les deux diffèrent, et voir « Texte »
    // apparaître à la place du titre qu'on vient de lire est incompréhensible.
    setEditName(displayName)
    setEditing(true)
  }

  function commitRename(returnFocus = false) {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== displayName) actions.rename(layer, trimmed)
    setEditing(false)
    // Entrée et Échap retirent le champ sous le focus : la ligne le reprend.
    // Un clic dehors (blur), lui, a déjà placé le focus où il a cliqué.
    if (returnFocus) requestAnimationFrame(() => rowRef.current?.focus())
  }

  function handleRenameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commitRename(true)
    if (event.key === 'Escape') {
      setEditing(false)
      requestAnimationFrame(() => rowRef.current?.focus())
    }
  }

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (!isSelected) onSelectExclusive(layer)
    setMenuPosition({ left: event.clientX, top: event.clientY })
  }

  function handleItemKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectExclusive(layer)
    } else if (event.key === 'F2') {
      event.preventDefault()
      startRename()
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
      actions.remove(layer)
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      event.stopPropagation()
      actions.duplicate(layer)
    } else if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault()
      actions.moveForward(layer)
      refocusRow()
    } else if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      actions.moveBackward(layer)
      refocusRow()
    } else if (
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      (event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'Home' ||
        event.key === 'End')
    ) {
      // La garde globale laisse déjà les flèches aux `role="option"` ; c'est
      // ici qu'elles deviennent la navigation de la listbox.
      event.preventDefault()
      onNavigate(layer, event.key, event.shiftKey)
    }
  }

  /* Réordonner re-trie la liste : React déplace le nœud (`insertBefore`) et le
     navigateur lâche le focus sur `body` — la flèche suivante nudgerait le
     canvas au lieu de naviguer. On rend le focus à la ligne une fois le DOM
     recomposé. */
  function refocusRow() {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(layer.id)}"]`)?.focus()
    })
  }

  function handleDoubleClick(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest('button, input')) return
    event.stopPropagation()
    startRename()
  }

  return (
    <div
      ref={rowRef}
      role="option"
      tabIndex={tabIndex}
      aria-selected={isSelected}
      aria-label={`${displayName}, ${layer.type}`}
      data-layer-id={layer.id}
      draggable
      onFocus={() => onFocusRow(layer)}
      onDragStart={(event) => onDragStart(layer, event)}
      onDragOver={onDragOver}
      onDrop={(event) => onDrop(layer, event)}
      onClick={(event) => onSelect(layer, event)}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleItemKeyDown}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setEntered(true)
      }}
      className={cn(
        // L'entrée se joue à la création du nœud, puis la classe tombe :
        // déplacer un nœud (`insertBefore` d'un réordonnancement DnD ou ⌥↑↓)
        // redémarre ses animations CSS, et la ligne rejouait son entrée à
        // chaque déplacement.
        !entered && 'animate-enter',
        'group flex h-9 cursor-pointer select-none items-center gap-2 rounded-md px-2',
        'transition-colors duration-100 ease-out',
        // Sélection : voile et liseré d'accent plutôt qu'un aplat gris clair.
        // L'aplat pesait autant que le contenu du panneau et ne disait pas
        // « sélectionné », seulement « survolé un peu plus fort ».
        isSelected
          ? 'marker-soft text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <GripVertical
        size={11}
        strokeWidth={1.5}
        aria-hidden
        className="shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
      />

      <LayerTypeIcon type={layer.type} />

      {editing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          onBlur={() => commitRename()}
          onKeyDown={handleRenameKeyDown}
          onClick={(event) => event.stopPropagation()}
          aria-label="Nom du calque"
          className="min-w-0 flex-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-sm focus:border-muted-foreground"
        />
      ) : (
        <span className="flex-1 truncate text-sm">{displayName}</span>
      )}

      {/* Deux actions, pas quatre. À 32px pièce, quatre boutons couvraient le
          milieu de la ligne : viser le nom d'un calque basculait sa visibilité.
          Dupliquer et supprimer restent au menu contextuel et au clavier.
          `tabIndex={-1}` : une `option` de listbox n'expose pas d'interactif —
          la liste promet un seul arrêt de Tab, et ces deux boutons en ajoutaient
          deux par ligne. À la souris rien ne change ; au clavier, Masquer et
          Verrouiller restent au menu contextuel (⇧F10 / touche Menu). */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          size="sm"
          tabIndex={-1}
          aria-label={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
          tooltip={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
          onClick={(event) => {
            event.stopPropagation()
            actions.setVisibility(layer, !layer.visible)
          }}
        >
          {layer.visible ? (
            <Eye size={11} strokeWidth={1.5} aria-hidden />
          ) : (
            <EyeOff size={11} strokeWidth={1.5} aria-hidden />
          )}
        </IconButton>
        <IconButton
          size="sm"
          tabIndex={-1}
          aria-label={layer.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'}
          tooltip={layer.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'}
          onClick={(event) => {
            event.stopPropagation()
            actions.setLocked(layer, !layer.locked)
          }}
        >
          {layer.locked ? (
            <Lock size={11} strokeWidth={1.5} aria-hidden />
          ) : (
            <Unlock size={11} strokeWidth={1.5} aria-hidden />
          )}
        </IconButton>
      </div>

      {(!layer.visible || layer.locked) && (
        <div
          className="flex shrink-0 items-center gap-0.5 group-focus-within:hidden group-hover:hidden"
          aria-hidden
        >
          {!layer.visible && (
            <EyeOff size={10} strokeWidth={1.5} className="text-muted-foreground" />
          )}
          {layer.locked && <Lock size={10} strokeWidth={1.5} className="text-muted-foreground" />}
        </div>
      )}

      {menuPosition && (
        <ContextMenu
          position={menuPosition}
          label={`Actions de ${displayName}`}
          onClose={() => setMenuPosition(null)}
          returnFocus={rowRef}
          items={buildLayerMenuItems(layer, actions, { onRename: startRename })}
        />
      )}
    </div>
  )
})
