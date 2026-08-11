import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

/**
 * Ce qui reprend tout seul.
 *
 * `startAccountDeletionWorker` était un `setInterval` dans le processus Railway,
 * avec son drapeau `running` pour ne pas se chevaucher et son `unref` pour ne
 * pas retenir le processus. Un cron de déploiement supprime les trois : il
 * n'appartient à aucun processus, Convex garantit qu'au plus une exécution
 * tourne à un instant donné, et il survit à un redémarrage — ce qu'un
 * `setInterval` ne fait pas.
 *
 * La minute est celle d'origine, et elle est peu coûteuse : le tour ne lit
 * qu'un index vide tant que personne ne supprime son compte.
 */
const crons = cronJobs()

crons.interval('account-deletion', { minutes: 1 }, internal.accountDeletion.resumeAll, {})

export default crons
