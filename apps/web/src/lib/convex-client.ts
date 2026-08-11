import { ConvexReactClient } from 'convex/react'

/**
 * L'instance unique, et le seul module qui la fabrique.
 *
 * Ce fichier n'est jamais importé statiquement depuis le paquet critique : c'est
 * `lib/convex.ts` qui l'appelle par `import()`, et `lib/cloud-bridge.tsx` — lui
 * aussi chargé à la demande — le partage. La séparation en deux fichiers n'est
 * pas cosmétique : `lib/convex.ts` porte la constante de compilation et doit
 * rester dépourvu de tout import statique de `convex/react`, sans quoi l'élagage
 * n'aurait plus rien à élaguer.
 */
export const client = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)
