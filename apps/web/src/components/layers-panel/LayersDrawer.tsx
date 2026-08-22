import { LayersPanel } from '@/components/layers-panel/LayersPanel'
import { DRAWER_EXIT_MS, useDeferredUnmount } from '@/hooks/use-deferred-unmount'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import {
  DRAWER_WIDTH_LAYERS,
  drawerWidth,
  ISLAND_MARGIN,
  STAGE_BOTTOM_INSET_MAX,
  STAGE_TOP_INSET,
} from '@/lib/stage'

/** Left drawer: layers panel sliding over the stage. */
export function LayersDrawer() {
  const open = useUIStore((s) => s.layersOpen)
  const mounted = useDeferredUnmount(open, DRAWER_EXIT_MS)

  return (
    <div
      aria-hidden={!open}
      data-open={open || undefined}
      inert={!open}
      className={cn(
        // Colonne flex, et non simple bloc : `max-h-full` sur l'îlot se résout à
        // `none` sous un parent de hauteur automatique. C'est le rétrécissement
        // du flex qui le ramène sous le plafond, puis le fait défiler.
        'fixed flex flex-col z-(--z-chrome) transition-ui duration-(--duration-slow)',
        open ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0',
        !open && 'pointer-events-none',
      )}
      // L'îlot épouse son contenu : `maxHeight` plafonne, `bottom` étirerait.
      // Deux panneaux pleine hauteur remplis à 15%, c'est le défaut le plus visible.
      style={{
        left: ISLAND_MARGIN,
        top: STAGE_TOP_INSET,
        maxHeight: `calc(100dvh - ${STAGE_TOP_INSET + STAGE_BOTTOM_INSET_MAX}px)`,
        width: drawerWidth(DRAWER_WIDTH_LAYERS),
      }}
    >
      {mounted && <LayersPanel />}
    </div>
  )
}
