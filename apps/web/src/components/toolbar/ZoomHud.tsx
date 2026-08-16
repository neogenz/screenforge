import { Minus, Plus } from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * Îlot de zoom, bas-droite. Îlot permanent au même titre que la barre et la
 * filmstrip : à ne s'afficher qu'au survol il était le seul élément du shell
 * à ne pas exister au repos.
 */
export function ZoomHud() {
  const zoom = useUIStore((s) => s.zoom)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const resetZoom = useUIStore((s) => s.resetZoom)

  return (
    <div className="island flex items-center gap-0.5">
      <IconButton size="sm" aria-label="Zoom arrière" tooltip="Zoom arrière (⌘−)" onClick={zoomOut}>
        <Minus size={14} strokeWidth={1.75} />
      </IconButton>
      <Tooltip content="Ajuster aux écrans (⌘0)">
        <button
          type="button"
          aria-label="Ajuster le zoom aux écrans"
          onClick={resetZoom}
          className="tabular h-8 min-w-13 rounded-md px-2 text-center text-2xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tooltip>
      <IconButton size="sm" aria-label="Zoom avant" tooltip="Zoom avant (⌘+)" onClick={zoomIn}>
        <Plus size={14} strokeWidth={1.75} />
      </IconButton>
    </div>
  )
}
