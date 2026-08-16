/**
 * Ce qu'est le nom d'un écran.
 *
 * Un écran en porte toujours un : son rang écrit en toutes lettres tant que
 * l'utilisateur n'en a pas choisi d'autre. C'est ce que la pellicule affiche,
 * ce que le champ de renommage pré-remplit, et ce sur quoi un champ vidé
 * retombe — une seule formule pour les trois.
 */

/** Nom d'usine d'un écran, avant que l'utilisateur ne le renomme. */
export function defaultScreenName(index: number): string {
  return `Écran ${index + 1}`
}
