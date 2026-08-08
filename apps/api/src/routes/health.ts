import { Hono } from 'hono'

/**
 * Ce que Railway interroge pour savoir si le service est en vie.
 *
 * Sans authentification et sans dépendance : une sonde qui tape la base
 * déclarerait le service mort à la première latence de Postgres, et le
 * redémarrerait pendant que la base se rétablit toute seule.
 */
export const health = new Hono().get('/health', (c) => c.json({ ok: true as const }))
