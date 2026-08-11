import { httpRouter } from 'convex/server'
import { auth } from './auth'

/**
 * Les routes HTTP du déploiement, servies sur `<deployment>.convex.site`.
 *
 * `auth.addHttpRoutes` pose `/.well-known/openid-configuration`,
 * `/.well-known/jwks.json`, `/api/auth/signin/*` et `/api/auth/callback/*` —
 * c'est cette dernière que les applications OAuth de Google et de GitHub doivent
 * pointer.
 */
const http = httpRouter()

auth.addHttpRoutes(http)

export default http
