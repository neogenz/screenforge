import { exportJWK, exportPKCS8, generateKeyPair } from 'jose'

/**
 * Les clés de signature de session, fabriquées pour la suite et jetées avec elle.
 *
 * Convex Auth signe ses jetons avec `JWT_PRIVATE_KEY` et refuse de démarrer sans
 * elle. Sur un déploiement, `npx @convex-dev/auth` la pose une fois ; ici il
 * faut bien qu'une paire existe, et une paire écrite en dur dans le dépôt serait
 * une clé privée versionnée — même de test, c'est le genre de fichier qu'on
 * finit par copier ailleurs. Elle est donc engendrée à chaque exécution.
 */
const keys = await generateKeyPair('RS256', { extractable: true })

process.env.JWT_PRIVATE_KEY = await exportPKCS8(keys.privateKey)
process.env.JWKS = JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] })
process.env.CONVEX_SITE_URL ??= 'http://127.0.0.1:3211'
