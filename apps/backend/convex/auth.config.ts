/**
 * Le déploiement se fait confiance à lui-même, et à personne d'autre.
 *
 * Convex Auth signe ses jetons avec la clé du déploiement et les vérifie par le
 * JWKS que `http.ts` expose sur ce même domaine. Ajouter un émetteur ici
 * reviendrait à accepter des jetons fabriqués ailleurs.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}
