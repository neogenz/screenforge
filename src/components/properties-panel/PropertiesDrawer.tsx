import { PropertiesPanel } from '@/components/properties-panel/PropertiesPanel'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import {
  DRAWER_WIDTH_PROPS,
  ISLAND_MARGIN,
  STAGE_BOTTOM_INSET,
  STAGE_TOP_INSET,
} from '@/lib/stage'

/** Right drawer: properties panel sliding over the stage. */
export function PropertiesDrawer() {
  const open = useUIStore((s) => s.propsOpen)

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'fixed z-(--z-chrome) transition-transform duration-200 ease-out-expo',
        open ? 'translate-x-0' : 'translate-x-[calc(100%+24px)]',
        !open && 'pointer-events-none',
      )}
      style={{
        right: ISLAND_MARGIN,
        top: STAGE_TOP_INSET,
        bottom: STAGE_BOTTOM_INSET,
        width: DRAWER_WIDTH_PROPS,
      }}
    >
      <PropertiesPanel />
    </div>
  )
}
