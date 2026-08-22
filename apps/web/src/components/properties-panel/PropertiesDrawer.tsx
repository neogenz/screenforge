import { PropertiesPanel } from '@/components/properties-panel/PropertiesPanel'
import { DRAWER_EXIT_MS, useDeferredUnmount } from '@/hooks/use-deferred-unmount'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import {
  DRAWER_WIDTH_PROPS,
  drawerWidth,
  ISLAND_MARGIN,
  STAGE_BOTTOM_INSET_MAX,
  STAGE_TOP_INSET,
} from '@/lib/stage'

/** Right drawer: properties panel sliding over the stage. */
export function PropertiesDrawer() {
  const open = useUIStore((s) => s.propsOpen)
  const mounted = useDeferredUnmount(open, DRAWER_EXIT_MS)

  return (
    <div
      aria-hidden={!open}
      data-open={open || undefined}
      inert={!open}
      className={cn(
        // Voir `LayersDrawer` : la colonne flex est ce qui fait tenir le plafond.
        'fixed flex flex-col z-(--z-chrome) transition-ui duration-(--duration-slow)',
        open ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0',
        !open && 'pointer-events-none',
      )}
      // Voir `LayersDrawer` : le plafond remplace l'étirement.
      style={{
        right: ISLAND_MARGIN,
        top: STAGE_TOP_INSET,
        maxHeight: `calc(100dvh - ${STAGE_TOP_INSET + STAGE_BOTTOM_INSET_MAX}px)`,
        width: drawerWidth(DRAWER_WIDTH_PROPS),
      }}
    >
      {mounted && <PropertiesPanel />}
    </div>
  )
}
