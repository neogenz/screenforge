import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Trash2,
  Unlock,
} from 'lucide-react'
import type { ContextMenuEntry } from '@/components/ui/ContextMenu'
import type { LayerActions } from '@/hooks/use-layer-actions'
import type { Layer } from '@/types'

const ICON_SIZE = 12
const ICON_STROKE = 1.5

/**
 * Builds the context menu entries for a layer, shared by the layers panel
 * and the on-canvas right-click menu. `onRename` is only available from the
 * panel (inline editing); the canvas menu omits it.
 */
export function buildLayerMenuItems(
  layer: Layer,
  actions: LayerActions,
  options: { onRename?: () => void } = {},
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = []

  if (options.onRename) {
    items.push({
      label: 'Renommer',
      icon: <Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />,
      onSelect: options.onRename,
    })
  }

  items.push({
    label: 'Dupliquer',
    icon: <Copy size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />,
    shortcut: '⌘D',
    onSelect: () => actions.duplicate(layer),
  })

  items.push({
    label: layer.visible ? 'Masquer' : 'Afficher',
    icon: layer.visible
      ? <EyeOff size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
      : <Eye size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />,
    onSelect: () => actions.setVisibility(layer, !layer.visible),
  })

  items.push({
    label: layer.locked ? 'Déverrouiller' : 'Verrouiller',
    icon: layer.locked
      ? <Unlock size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
      : <Lock size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />,
    onSelect: () => actions.setLocked(layer, !layer.locked),
  })

  items.push('separator')

  items.push({
    label: 'Avancer d’un plan',
    icon: <ArrowUp size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />,
    disabled: !actions.canMoveForward(layer),
    onSelect: () => actions.moveForward(layer),
  })

  items.push({
    label: 'Reculer d’un plan',
    icon: <ArrowDown size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />,
    disabled: !actions.canMoveBackward(layer),
    onSelect: () => actions.moveBackward(layer),
  })

  items.push('separator')

  items.push({
    label: 'Supprimer',
    icon: <Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />,
    shortcut: '⌫',
    danger: true,
    onSelect: () => actions.remove(layer),
  })

  return items
}
