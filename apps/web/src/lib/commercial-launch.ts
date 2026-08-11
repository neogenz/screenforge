/**
 * L'ouverture commerciale, et pourquoi elle a désormais sa propre variable.
 *
 * Elle se lisait dans `VITE_API_URL` : tant que la vente vivait dans
 * `apps/api`, « il y a une API » et « la vente est ouverte » désignaient le même
 * fait, et une seule variable les portait toutes les deux. `apps/api` n'existe
 * plus, et le déploiement qui la remplace sert aussi bien un compte gratuit
 * qu'un compte payant : déduire l'ouverture de la présence de `VITE_CONVEX_URL`
 * ouvrirait la vente à la première synchronisation.
 *
 * `Boolean(…)` d'une variable substituée à la compilation : dans une build
 * d'avant-lancement, la constante vaut `false` et tout ce qu'elle garde
 * disparaît à l'élagage — c'est ce que `build:profiles` mesure.
 */
export const commercialLaunch = Boolean(import.meta.env.VITE_COMMERCIAL_LAUNCH)
