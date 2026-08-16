/**
 * Le rôle d'un écran dans la campagne, sous une forme stable.
 *
 * Un slot est ce qui relie une capture à l'endroit où elle va, d'une release à
 * la suivante. Il doit donc survivre à un renommage d'écran, à une réécriture
 * du texte, à un changement d'appareil — et se retrouver dans un nom de fichier
 * que l'utilisateur choisit lui-même, souvent depuis un simulateur qui exporte
 * `budget.png`. D'où la forme : minuscules, chiffres et traits d'union, ce que
 * tout système de fichiers accepte et ce qu'aucune casse ne perturbe.
 *
 * Il n'est pas dérivé du nom de l'écran. « Écran 3 » renommé en « Budget »
 * changerait alors de slot, et le lot de la release suivante n'apparierait
 * plus rien — le rôle est une décision, le nom est une étiquette.
 */

export const MAX_SLOT_LENGTH = 48

/** Ce que la validation du projet accepte dans `DeviceFrameLayer.slot`. */
export const SAFE_SLOT = new RegExp(`^[a-z0-9][a-z0-9-]{0,${MAX_SLOT_LENGTH - 1}}$`)

/**
 * Réduit une saisie libre à un slot, ou à `undefined` s'il n'en reste rien.
 *
 * Accepte donc ce qu'un utilisateur tape (« Mon Budget »), ce qu'un simulateur
 * nomme (`01_Budget_Screen.png` une fois l'extension retirée) et les accents,
 * qui se décomposent avant d'être coupés — sans quoi « réglages » et
 * « reglages » seraient deux rôles différents pour le même écran.
 */
export function normalizeSlot(value: string): string | undefined {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLOT_LENGTH)
    .replace(/-+$/, '')
  return SAFE_SLOT.test(slug) ? slug : undefined
}
