import { Minus, Plus } from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { IconButton } from '@/components/patterns/icon-button'
import { Toggle } from '@/components/ui/toggle'
import { Hint } from '@/components/patterns/hint'
import { Island } from '@/components/patterns/island'

/**
 * Îlot de zoom, bas-droite. Îlot permanent au même titre que la barre et la
 * filmstrip : à ne s'afficher qu'au survol il était le seul élément du shell
 * à ne pas exister au repos.
 *
 * Seule la valeur centrale est un état à deux faces — « à l'ajustement » ou
 * non — donc seule elle prend `Toggle` ; − et + restent des actions
 * momentanées, jamais un état qui reste enfoncé.
 */
export function ZoomHud() {
  const zoom = useUIStore((s) => s.zoom)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const resetZoom = useUIStore((s) => s.resetZoom)

  return (
    <Island className="flex items-center gap-0.5">
      <IconButton size="sm" aria-label="Zoom arrière" tooltip="Zoom arrière (⌘−)" onClick={zoomOut}>
        <Minus size={14} strokeWidth={1.75} />
      </IconButton>
      <Hint content="Ajuster aux écrans (⌘0)">
        <Toggle
          size="sm"
          pressed={zoom === 1}
          onPressedChange={() => resetZoom()}
          aria-label="Ajuster le zoom aux écrans"
          className="tabular-nums min-w-13 border-transparent text-xs text-muted-foreground hover:text-foreground data-pressed:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </Toggle>
      </Hint>
      <IconButton size="sm" aria-label="Zoom avant" tooltip="Zoom avant (⌘+)" onClick={zoomIn}>
        <Plus size={14} strokeWidth={1.75} />
      </IconButton>
    </Island>
  )
}
