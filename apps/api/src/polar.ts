import { Polar } from '@polar-sh/sdk'
import { env } from './env.ts'

let client: Polar | null = null

export function polar(): Polar {
  client ??= new Polar({
    accessToken: env().POLAR_ACCESS_TOKEN,
    /* `sandbox` a sa propre base d'API, ses propres produits et ses propres
       clés : le même jeton n'ouvre pas les deux. Le défaut est donc le bac à
       sable, pour qu'une variable oubliée ne facture personne. */
    server: env().POLAR_SERVER,
  })
  return client
}

export type SellableProduct = 'licence' | 'cloud'

export function productId(product: SellableProduct): string {
  return product === 'licence' ? env().POLAR_LICENCE_PRODUCT_ID : env().POLAR_CLOUD_PRODUCT_ID
}
