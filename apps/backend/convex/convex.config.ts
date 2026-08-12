import { defineApp } from 'convex/server'
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
const app = defineApp()
app.use(rateLimiter)

export default app
