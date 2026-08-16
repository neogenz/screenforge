/**
 * Où la session vit dans le navigateur — la seule chose que l'application et sa
 * suite e2e doivent nommer pareil.
 *
 * Par défaut Convex Auth dérive ses clés de `localStorage` de l'URL du
 * déploiement, ce qui donne un emplacement différent en local, en préproduction
 * et en production. Une valeur explicite le fixe quel que soit l'hôte, ce qui la
 * rend adressable : c'est ce que `e2e/sync.spec.ts` sème pour ouvrir deux
 * navigateurs sur le même compte, faute de pouvoir automatiser un lien magique
 * reçu par courrier.
 *
 * Ces trois constantes ont leur propre fichier au lieu de suivre le client dans
 * `lib/convex.ts` parce que ce dernier lit `import.meta.env` dès son évaluation :
 * hors de Vite, l'importer lève, et une spec Playwright s'exécute dans Node. Le
 * chemin d'avant recopiait la clé dans le test, où elle pouvait dériver en
 * silence — ici, un changement de l'espace de nommage arrive des deux côtés à la
 * fois.
 */
export const SESSION_NAMESPACE = 'screenforge'

/** Les clés réellement écrites, telles que `@convex-dev/auth` les compose. */
export const JWT_STORAGE_KEY = `__convexAuthJWT_${SESSION_NAMESPACE}`
export const REFRESH_TOKEN_STORAGE_KEY = `__convexAuthRefreshToken_${SESSION_NAMESPACE}`
