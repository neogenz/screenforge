/**
 * L'accès en base au miroir de droits. Le calcul, lui, est dans
 * `entitlements.ts` et n'a besoin ni du réseau ni de Postgres pour se tester.
 */
import { serviceClient } from './supabase.ts'
import {
  projectCustomerState,
  toEntitlements,
  type CustomerStateInput,
  type Entitlements,
  type EntitlementsRow,
  type ProjectionConfig,
} from './entitlements.ts'

const COLUMNS = 'user_id, polar_customer_id, licence_granted_at, cloud_status, cloud_period_end'

export async function readRow(userId: string): Promise<EntitlementsRow | null> {
  const { data, error } = await serviceClient()
    .from('entitlements')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Could not read entitlements: ${error.message}`)
  return (data as EntitlementsRow | null) ?? null
}

export async function readEntitlements(userId: string, now = new Date()): Promise<Entitlements> {
  return toEntitlements(await readRow(userId), userId, now)
}

export type ApplyOutcome = 'unchanged' | 'written' | 'ignored'

/**
 * Écrit le miroir si le message signé par Polar est plus récent.
 *
 * La comparaison est atomique dans Postgres. Lire puis écrire ici laisserait
 * deux requêtes concurrentes passer le même contrôle avant de s'écraser dans
 * l'ordre réseau. `sourceUpdatedAt` vient du corps vérifié par Standard Webhooks,
 * jamais de l'heure de réception de ce serveur.
 */
export async function applyCustomerState(
  state: CustomerStateInput,
  config: ProjectionConfig,
  sourceUpdatedAt: Date,
): Promise<{ outcome: ApplyOutcome; cloudRefusedWithoutLicence: boolean }> {
  const userId = state.externalId
  /* Sans `external_customer_id`, le client Polar n'est rattaché à aucun compte.
     Cela n'arrive que pour un achat créé hors de notre checkout ; il n'y a rien
     à écrire et rien à deviner. */
  if (!userId) return { outcome: 'ignored', cloudRefusedWithoutLicence: false }

  const { row, cloudRefusedWithoutLicence } = projectCustomerState(userId, state, config)
  const { data, error } = await serviceClient().rpc('apply_entitlements_if_newer', {
    p_user_id: row.user_id,
    p_polar_customer_id: row.polar_customer_id,
    p_licence_granted_at: row.licence_granted_at,
    p_cloud_status: row.cloud_status,
    p_cloud_period_end: row.cloud_period_end,
    p_source_updated_at: sourceUpdatedAt.toISOString(),
  })
  if (error) throw new Error(`Could not write entitlements: ${error.message}`)
  if (data !== 'written' && data !== 'unchanged' && data !== 'ignored') {
    throw new Error('Could not write entitlements: invalid database outcome')
  }
  return {
    outcome: data,
    cloudRefusedWithoutLicence: data === 'written' && cloudRefusedWithoutLicence,
  }
}
