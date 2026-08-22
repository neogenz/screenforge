import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cn } from '@/lib/utils'

export type IslandProps = useRender.ComponentProps<'div'> & {
  /** En-tête à bord perdu : le contenu porte lui-même son retrait. */
  flush?: boolean
}

/**
 * La surface flottante du chrome : la barre haute, les tiroirs, le HUD et la
 * barre de sélection sont le même objet posé sur la scène. Coque `Card` coss,
 * `p-1` entre cadre et contrôle comme `CardPanel`, squircle là où le
 * navigateur le sait. Une seule définition : `.island` en CSS en avait deux.
 */
export function Island({ className, flush = false, render, ...props }: IslandProps) {
  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(
      {
        className: cn(
          'squircle rounded-2xl border bg-popover text-popover-foreground shadow-lg/5',
          flush ? 'p-0' : 'p-1',
          className,
        ),
      },
      { 'data-slot': 'island' } as Record<string, string>,
      props,
    ),
  })
}
