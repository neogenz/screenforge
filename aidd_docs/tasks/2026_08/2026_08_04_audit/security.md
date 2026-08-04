# Codebase Audit: security
Le périmètre local sans backend réduit fortement l’exposition et l’import d’archives est bien défendu ; les imports d’images ordinaires restent la frontière non bornée.

- **Date**: 2026-08-04
- **Scope**: entrées fichiers, archives, assets, SVG, secrets et surfaces navigateur
- **Health**: good
- **Findings**: 0 critical, 1 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | security | `src/lib/image.ts:3` | Les imports PNG/JPEG/SVG généraux lisent tout le fichier en data URL puis le décodent sans limite d’octets ni de pixels. Le contrôle strict 32 Mio/40 MP du bezel Apple ne couvre pas les quatre autres chemins d’import ; un fichier énorme ou un SVG coûteux peut bloquer ou épuiser l’onglet. | Ajouter dans ce helper partagé une limite d’octets puis une limite de pixels après décodage, réutilisée par tous les appelants. Garder SVG seulement si nécessaire ; sinon le retirer des images de contenu, ou le rasteriser avant enregistrement. | M |

## Top actions

1. Résoudre le finding security #1 avec `aidd-dev:02-implement` : borner une seule fois les imports d’images dans `lib/image.ts` et faire converger tous les appelants.
2. Conserver les protections actuelles de l’archive : taille, nombre d’entrées, chemins sûrs, MIME et SHA-256.
3. Continuer à garder les handles de debug derrière `import.meta.env.DEV`.

## Coverage

- **Scanned**: security — secrets et fichiers d’environnement, `dangerouslySetInnerHTML`/`eval`, liens externes, génération SVG, data URLs, archive `.screenforge`, IndexedDB, limites de fichiers et exposition dev-only.
- **Skipped**: auth, API, base serveur, CORS et contrôle d’accès — le produit n’a aucun backend ni compte utilisateur ; pentest navigateur actif non exécuté.
