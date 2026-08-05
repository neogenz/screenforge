/**
 * Ce qu'est le nom d'un écran, et quand il en porte vraiment un.
 *
 * Le nom d'usine et le test qui le reconnaît vivent au même endroit : ce sont
 * deux formules qui doivent rester d'accord, et une seule les écrit.
 */
import type { Screen } from '@/types'

/** Nom d'usine d'un écran, avant que l'utilisateur ne le renomme. */
export function defaultScreenName(index: number): string {
  return `Écran ${index + 1}`
}

/**
 * L'écran porte-t-il un nom choisi, ou seulement son rang écrit en toutes lettres ?
 *
 * « Écran 3 » sous un « 3 » ne dit rien de plus que le badge, et c'est toute la
 * raison pour laquelle la pellicule ne réserve pas de rangée de libellés tant
 * qu'aucun écran n'a été renommé. Renommer un écran *vers* son nom d'usine le
 * fait donc redevenir anonyme, et c'est voulu : c'est le texte qui décide, pas
 * l'historique de qui l'a tapé.
 */
export function screenHasCustomName(screen: Screen, index: number): boolean {
  return screen.name !== defaultScreenName(index)
}
