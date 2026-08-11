import { defineApp } from 'convex/server'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'

/**
 * Le seul composant installé, et il n'est pas optionnel.
 *
 * Supabase Auth bornait les envois par configuration (`[auth.rate_limit]`).
 * Convex Auth borne les échecs de vérification et rien d'autre : ni les envois,
 * ni les gestes payants, ni la suppression de compte. Migrer sans ce composant
 * publierait une régression et se promettrait d'y revenir.
 */
const app = defineApp()
app.use(rateLimiter)

export default app
