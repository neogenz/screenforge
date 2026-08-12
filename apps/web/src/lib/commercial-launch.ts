/**
 * L'ouverture commerciale, et pourquoi elle a sa propre variable.
 *
 * Le déploiement sert aussi bien un compte gratuit qu'un compte payant :
 * déduire l'ouverture de la vente de la présence de `VITE_CONVEX_URL`
 * l'ouvrirait à la première synchronisation. Les deux faits sont distincts,
 * donc ils sont deux variables.
 *
 * `Boolean(…)` d'une variable substituée à la compilation : dans une build
 * d'avant-lancement, la constante vaut `false` et tout ce qu'elle garde
 * disparaît à l'élagage — c'est ce que `build:profiles` mesure.
 */
export const commercialLaunch = Boolean(import.meta.env.VITE_COMMERCIAL_LAUNCH)
