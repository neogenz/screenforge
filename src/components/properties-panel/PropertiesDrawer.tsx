import { PropertiesPanel } from '@/components/properties-panel/PropertiesPanel'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import {
  DRAWER_WIDTH_PROPS,
  ISLAND_MARGIN,
  STAGE_BOTTOM_INSET_MAX,
  STAGE_TOP_INSET,
} from '@/lib/stage'

/** Right drawer: properties panel sliding over the stage. */
export function PropertiesDrawer() {
  const open = useUIStore((s) => s.propsOpen)

  return (
    <div
      aria-hidden={!open}
      className={cn(
        // Voir `LayersDrawer` : la colonne flex est ce qui fait tenir le plafond.
        'fixed flex flex-col z-(--z-chrome) transition-transform duration-200 ease-out-expo',
        open ? 'translate-x-0' : 'translate-x-[calc(100%+24px)]',
        !open && 'pointer-events-none',
      )}
      // Voir `LayersDrawer` : le plafond remplace l'étirement.
      style={{
        right: ISLAND_MARGIN,
        top: STAGE_TOP_INSET,
        maxHeight: `calc(100dvh - ${STAGE_TOP_INSET + STAGE_BOTTOM_INSET_MAX}px)`,
        width: DRAWER_WIDTH_PROPS,
      }}
    >
      <PropertiesPanel />
    </div>
  )
}
