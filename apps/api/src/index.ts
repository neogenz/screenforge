import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.ts'
import { billing } from './routes/billing.ts'
import { health } from './routes/health.ts'
import { me } from './routes/me.ts'

/**
 * L'application, sans le serveur.
 *
 * Ce fichier n'écoute sur aucun port : `server.ts` s'en charge. C'est ce qui
 * permet aux tests d'appeler `app.request(...)` sans ouvrir de socket, et à un
 * autre runtime que Node de monter la même application.
 */
const base = new Hono()

base.use(
  '*',
  cors({
    /* Liste blanche explicite plutôt que `*` : les requêtes portent un jeton
       d'accès Supabase dans l'en-tête `Authorization`, et une origine ouverte
       laisserait n'importe quelle page en faire usage depuis un navigateur. */
    origin: (origin) => {
      const allowed = env()
        .ALLOWED_ORIGINS.split(',')
        .map((value) => value.trim())
      return allowed.includes(origin) ? origin : null
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }),
)

/* Le chaînage porte le type : `AppType` ne décrit que ce qui est enregistré
   ici, donc une route retirée casse le client web à la compilation. C'est aussi
   pourquoi l'application exportée est la version chaînée et non `base` — le
   type d'un `app.route()` appelé pour son effet de bord se perd. */
export const app = base.route('/', health).route('/', me).route('/', billing)

export type AppType = typeof app

/* Le seul type de données qui traverse la frontière : le client web le lit tel
   quel, plutôt que d'en tenir une copie qui dériverait. */
export type { Entitlements } from './entitlements.ts'
