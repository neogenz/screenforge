# Assertion : durcissement sécurité et préparation production

- **Verdict** : pass
- **Candidat** : `5689b62`
- **Date** : 2026-08-18

## Assertions applicables

| Assertion | Résultat | Preuve |
| --- | --- | --- |
| Aucun secret public | Pass | Gitleaks sur 195 commits et le répertoire courant; audit publication vert. |
| Qualité et contrats | Pass | 59 Bridge, 176 backend, 38 MCP, 399 web et 4 tests publication; types et lint verts. |
| Build et sécurité navigateur | Pass | Build Vite, pré-rendu et audit CSP verts. |
| Local gratuit complet | Pass | Export illimité sans compte et ZIP PNG opaque exact 1320×2868 dans la gate E2E. |
| Cloud protégé serveur | Pass | Auth, propriété, entitlement, expiration, refus et deux profils couverts par la suite Cloud stricte. |
| Entrées non fiables bornées | Pass | Médias/archives inspectés, graphe borné, cache authentifié `no-store` et tests attaquants verts. |
| MCP révocable et borné | Pass | 38 tests unitaires et E2E de révocation pendant un asset retardé. |
| Release canonique | Pass | Audit CI exige le tag sur le HEAD exact de `origin/main`; provenance externe `v*` laissée dans la TODO. |
| Sweep final | Pass | `pnpm run test:release`: 187 E2E passés, 1 fixture externe ignorée, contraste, scale et landing verts. |

## Boucle corrective

1. Le sweep initial a exposé une attente trop spécifique sur la classe d'erreur
   du refus transport à 16 Mio + 1 octet.
2. L'assertion a été alignée sur le contrat portable `Error`, puis le scénario
   ciblé est repassé à 1/1.
3. Le sweep complet a été rejoué depuis zéro et a terminé vert.

## Facets

- Coding : pass après boucle corrective et sweep propre.
- Frontend : non exécuté manuellement; aucune instance utilisateur ne répondait
  sur `127.0.0.1:5173`. Les chemins modifiés ont été exercés par Playwright dans
  la gate release, sans démarrer un serveur supplémentaire pour ce facet.
- Architecture : non demandé; facet non applicable.
