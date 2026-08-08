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
 * Écrit le miroir, et seulement s'il change.
 *
 * C'est ce qui rend un rejeu inoffensif sans table d'événements à tenir : la
 * projection porte l'état complet, donc deux livraisons du même webhook
 * calculent la même ligne, et la seconde ne produit aucune écriture — pas même
 * un `updated_at` qui bougerait. Une table de déduplication dirait la même
 * chose en ajoutant une ligne par événement reçu, à vie.
 *
 * Ce que cette forme n'attrape pas : deux états livrés dans le désordre, où
 * l'ancien écraserait le récent. Polar sert l'état complet à chaque fois, donc
 * l'événement suivant corrige — le risque est une fenêtre, pas une dérive.
 */
export async function applyCustomerState(
  state: CustomerStateInput,
  config: ProjectionConfig,
): Promise<{ outcome: ApplyOutcome; cloudRefusedWithoutLicence: boolean }> {
  const userId = state.externalId
  /* Sans `external_customer_id`, le client Polar n'est rattaché à aucun compte.
     Cela n'arrive que pour un achat créé hors de notre checkout ; il n'y a rien
     à écrire et rien à deviner. */
  if (!userId) return { outcome: 'ignored', cloudRefusedWithoutLicence: false }

  const { row, cloudRefusedWithoutLicence } = projectCustomerState(userId, state, config)
  const current = await readRow(userId)
  if (current && sameRow(current, row)) {
    return { outcome: 'unchanged', cloudRefusedWithoutLicence }
  }

  const { error } = await serviceClient()
    .from('entitlements')
    .upsert({ ...row, updated_at: new Date().toISOString() })
  if (error) throw new Error(`Could not write entitlements: ${error.message}`)
  return { outcome: 'written', cloudRefusedWithoutLicence }
}

function sameRow(a: EntitlementsRow, b: EntitlementsRow): boolean {
  return (
    a.polar_customer_id === b.polar_customer_id &&
    sameInstant(a.licence_granted_at, b.licence_granted_at) &&
    a.cloud_status === b.cloud_status &&
    sameInstant(a.cloud_period_end, b.cloud_period_end)
  )
}

/* Postgres rend `2026-03-12T09:00:00+00:00` là où la projection a écrit
   `2026-03-12T09:00:00.000Z` : comparer les chaînes ferait voir un changement
   à chaque livraison, et le « ne rien écrire si rien ne change » ne tiendrait
   plus jamais. */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return Date.parse(a) === Date.parse(b)
}
