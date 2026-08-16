import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'

/**
 * Le seul composant installé, et il n'est pas optionnel.
 *
 * Convex Auth borne les échecs de vérification et rien d'autre : ni les envois
 * de courriel, ni les gestes payants, ni la suppression de compte. Sans ce
 * composant ces trois-là sont illimités, et chacun coûte quelque chose de réel
 * — un balayage d'adresses use la réputation du domaine expéditeur, une rafale
 * de checkouts crée autant d'objets chez Polar.
 */
const app = defineApp({
  env: {
    AUTH_EMAIL_FROM: v.optional(v.string()),
    AUTH_RESEND_KEY: v.optional(v.string()),
    AUTH_TEST_PASSWORD: v.optional(v.string()),
    CHECKOUT_SUCCESS_URL: v.optional(v.string()),
    CORS_ALLOWED_ORIGINS: v.optional(v.string()),
    POLAR_ACCESS_TOKEN: v.optional(v.string()),
    POLAR_CLOUD_PRODUCT_ID: v.optional(v.string()),
    POLAR_SERVER: v.optional(v.string()),
    POLAR_WEBHOOK_SECRET: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
  },
})
app.use(rateLimiter)

export default app
