import type { useRender } from '@base-ui/react/use-render'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type IslandProps = useRender.ComponentProps<'div'> & {
  /** En-tête à bord perdu : le contenu porte lui-même son retrait. */
  flush?: boolean
}

/**
 * La surface flottante du chrome : la barre haute, les tiroirs, le HUD et la
 * barre de sélection sont le même objet posé sur la scène.
 *
 * C'est un `Card` coss habillé, pas un jumeau : le cadre, le bord et le liseré
 * intérieur `before:` viennent de `Card`, et avec eux le `bg-clip-padding` qui
 * retient le fond sous le bord en thème clair. Recopier ces classes — ce que ce
 * fichier faisait — en figeait la version : le liseré n'a jamais atteint le
 * chrome, et aucun `shadcn add` ne l'y aurait porté.
 *
 * L'île n'écrit que ce qui lui est propre : le squircle là où le navigateur le
 * sait, le fond de popover (une surface flottante prend le jeton des popups de
 * coss), l'élévation d'île, et le `p-1` entre cadre et contrôle comme
 * `CardPanel`.
 *
 * `Card` pose `flex flex-col` : une île qui veut une rangée écrit `flex-row`,
 * `display` et `flex-direction` étant deux groupes de conflit distincts.
 */
export function Island({ className, flush = false, ...props }: IslandProps) {
  return (
    <Card
      data-slot="island"
      className={cn(
        'squircle bg-popover text-popover-foreground shadow-lg/5',
        flush ? 'p-0' : 'p-1',
        className,
      )}
      {...props}
    />
  )
}
