import type { Background, ColorStop } from '@/types'

/**
 * Un fond de projet, dit en CSS.
 *
 * Deux surfaces en ont besoin et doivent peindre le même fond : l'éditeur de
 * fonds, qui montre ce qu'on est en train de régler, et l'aperçu de campagne,
 * qui montre ce que la pose produira. La fonction vivait dans le composant de
 * l'éditeur ; l'aperçu, qui ne peignait qu'un aplat, ne pouvait pas la lire —
 * et le jour où le générateur s'est mis à composer des dégradés, la revue aurait
 * montré un aplat pour une planche dégradée. Une revue qui ne montre pas ce qui
 * sera posé ne vaut pas d'être relue.
 *
 * Ce n'est pas le rendu final : Fabric peint la planche exportée, depuis
 * `canvas-utils`. C'est la même déclaration lue par le navigateur, ce qui suffit
 * à une image de cent trente pixels de large et ne coûte aucun canevas.
 */
export function backgroundToCss(background: Background): string {
  if (background.type === 'solid') return background.color

  const stops = background.stops
    .slice()
    .sort((left: ColorStop, right: ColorStop) => left.offset - right.offset)
    .map((stop: ColorStop) => `${stop.color} ${Math.round(stop.offset * 100)}%`)
    .join(', ')

  if (background.type === 'radial-gradient') {
    return `radial-gradient(circle at ${background.centerX ?? 50}% ${background.centerY ?? 50}%, ${stops})`
  }
  /* CSS mesure ses angles depuis le haut dans le sens horaire, comme le champ
     de l'éditeur : la valeur passe telle quelle, sans conversion à retenir. */
  return `linear-gradient(${background.angle}deg, ${stops})`
}
