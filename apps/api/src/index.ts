import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.ts'
import { account } from './routes/account.ts'
import { health } from './routes/health.ts'

/**
 * L'application, sans le serveur.
 *
 * Ce fichier n'écoute sur aucun port : `server.ts` s'en charge. C'est ce qui
 * permet aux tests d'appeler `app.request(...)` sans ouvrir de socket, et à un
 * autre runtime que Node de monter la même application.
 *
 * Il ne reste que la suppression de compte, et pour une phase encore : la vente
 * est passée sur Convex, `GET /me` avec elle — cette route existait parce que ce
 * service avait sa vue à lui, celle qui gardait le checkout, et le checkout lit
 * désormais le même module que l'éditeur, dans le même déploiement.
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
export const app = base.route('/', health).route('/', account)

export type AppType = typeof app
