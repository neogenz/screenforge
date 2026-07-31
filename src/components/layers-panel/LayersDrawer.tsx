import { LayersPanel } from '@/components/layers-panel/LayersPanel'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import {
  DRAWER_WIDTH_LAYERS,
  ISLAND_MARGIN,
  STAGE_BOTTOM_INSET,
  STAGE_TOP_INSET,
} from '@/lib/stage'

/** Left drawer: layers panel sliding over the stage. */
export function LayersDrawer() {
  const open = useUIStore((s) => s.layersOpen)

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'fixed z-(--z-chrome) transition-transform duration-200 ease-out-expo',
        open ? 'translate-x-0' : '-translate-x-[calc(100%+24px)]',
        !open && 'pointer-events-none',
      )}
      style={{
        left: ISLAND_MARGIN,
        top: STAGE_TOP_INSET,
        bottom: STAGE_BOTTOM_INSET,
        width: DRAWER_WIDTH_LAYERS,
      }}
    >
      <LayersPanel />
    </div>
  )
}
