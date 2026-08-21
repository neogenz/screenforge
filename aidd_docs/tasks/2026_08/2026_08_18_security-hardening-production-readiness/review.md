# Review: Durcissement sécurité et préparation production

- **Verdict**: changes-requested
- **Diff**: `bd09787...c170267`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_18
- **Findings**: 0 critical, 8 warning, 0 minor

## Phases

### Phase 1 — Stabiliser la branche et les preuves existantes

- [x] Chaque fichier préexistant est conservé ou attribué — `verification.md:7-14`, PR #12.
- [x] Achat, replay, dérogation et reste à faire sont expurgés — `verification.md:1-60`.
- [x] Le socle forme des commits testés et sans secret — `verification.md:16-36`.
- [x] La branche contient le `main` courant et une seule PR cible `main` — `verification.md:7-14`, PR #12.

### Phase 2 — Fermer les abus Auth, email et webhook

- [x] La source réseau est pseudonymisée et séparée par usage — `apps/backend/convex/limits.ts:72-96`.
- [x] Les quotas email et source ferment les contournements et expirent à une heure — `apps/backend/convex/limits.ts:35-84`.
- [x] Le webhook est admis avant lecture du corps avec une capacité de burst — `apps/backend/convex/limits.ts:83-84`.
- [x] Les tests attaquants et légitimes passent ensemble — `verification.md:22-33`.

### Phase 3 — Unifier validation média, quotas et propriété Cloud

- [x] Une inspection partagée valide octets, type, dimensions et SVG — `packages/project-format/src/media-validation.ts:1`.
- [x] Les médias invalides ne créent aucune donnée Cloud — `apps/backend/convex/assets.test.ts:1`.
- [x] Les lectures restent authentifiées, propriétaires et bornées après expiration — `apps/backend/convex/download.ts:1`, `apps/backend/convex/limits.ts:37-43`.
- [x] Les contre-tests, build et parcours Cloud sont verts — `verification.md:22-33`.

### Phase 4 — Remplacer l’appairage MCP implicite

- [x] Le code unique expire, résiste au rejeu et borne les essais — `apps/mcp/src/relay/pairing.ts:3-85`.
- [x] Révocation et changement de session invalident l’autorité précédente — `apps/mcp/src/relay/session.ts:52-89`.
- [x] Le coffre est borné, sérialisé et vidé à la révocation — `apps/mcp/src/relay/assets.ts:27-128`.
- [x] Le parcours clavier, les probes et les tests MCP sont verts — `verification.md:22-33`.

### Phase 5 — Durcir CI et configuration production

- [x] Les secrets sont limités aux étapes fournisseur — `.github/workflows/deploy-production.yml:91-183`.
- [x] Le preflight refuse fixture, HTTP, Preview, Sandbox et domaine Resend de test — `apps/backend/convex/preflight.ts:72-105`.
- [x] Le preflight encadre déploiement et promotion — `.github/workflows/deploy-production.yml:91-183`.
- [x] L’audit refuse les dérives de trigger, ordre, provenance et portée — `scripts/deployment-config-audit.mjs:1-113`.

### Phase 6 — Terminer Preview et preuves préproduction

- [ ] La Preview protégée finale, le fork et les auteurs bot sont prouvés — la Preview du SHA final est encore en cours et le browser QA reste ouvert.
- [ ] Le cycle Polar Sandbox complet est prouvé — annulation puis échéance effective non observées.
- [ ] Une sauvegarde incluant les fichiers est restaurée dans une cible jetable — aucune copie de données utilisateur n’a été autorisée.
- [ ] Local et Cloud préproduction sont verts sur un SHA commun — les preuves fournisseur ciblent un candidat antérieur.

### Phase 7 — Asserter, reviewer, rescanner et itérer

- [ ] Gate, scans, export et audits sont verts sur le même SHA — le gate local est vert mais les checks GitHub du HEAD final sont encore en cours.
- [ ] Clone neuf Local et Cloud réel sont prouvés sur le candidat final — les preuves réelles disponibles précèdent le rebase final.
- [ ] Les findings sont fermés et la review AIDD est approuvée — les scans sont sans finding, mais les critères externes ci-dessus empêchent l’approbation.
- [ ] La PR ready-for-review est entièrement verte — PR #12 ready, Quality et Vercel encore en cours.

### Phase 8 — Formaliser le handoff production

- [x] Une checklist unique couvre fournisseurs, release, smoke, surveillance et rollback — `production-todo.md:5-43`.
- [x] La checklist publique exclut secrets et portes de test production — `production-todo.md:1-3`, `production-todo.md:21-25`.
- [x] Les statuts distinguent préproduction et production non exécutée — `verification.md:49-60`.
- [x] La reprise commence par des items et gates explicites — `production-todo.md:7-13`.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | 6 | `verification.md:40-43` | La Preview prouvée n’est pas celle du HEAD final; fork et auteurs bot ne sont pas couverts. | Attendre Vercel sur PR #12, exécuter le browser QA protégé puis les contrôles fork/bot et consigner une preuve expurgée. |
| 🟡 warning | functional | 6 | `verification.md:46-51` | Le cycle Polar Sandbox s’arrête avant l’échéance effective après annulation. | Observer l’état à échéance, le refus de write et la conservation des reads, puis restaurer le droit propriétaire. |
| 🟡 warning | functional | 6 | `verification.md:52-54` | Aucune sauvegarde base + fichiers n’a été restaurée. | Après autorisation dédiée au payload, exporter, restaurer dans une cible jetable, comparer et supprimer uniquement cette cible. |
| 🟡 warning | functional | 6 | `verification.md:11-13` | Les preuves Cloud hébergées ciblent un candidat antérieur. | Redéployer la préproduction depuis le HEAD retenu et rejouer les smokes Local/Cloud sur ce SHA. |
| 🟡 warning | functional | 7 | `verification.md:18-36` | La gate locale est verte, mais pas encore les checks distants du même HEAD. | Attendre Quality et Vercel, puis relancer uniquement ce qui échoue et actualiser la preuve. |
| 🟡 warning | functional | 7 | `production-todo.md:31-32` | Le clone neuf Local et le Cloud réel ne sont pas prouvés sur le candidat final. | Rejouer les deux parcours sur le SHA candidat après la Preview finale. |
| 🟡 warning | functional | 7 | `verification.md:34-36` | Les scans ferment les findings code, mais la review ne peut être approuvée avec les critères fonctionnels ouverts. | Fermer les critères de phase 6 et refaire la review AIDD sans modifier le code. |
| 🟡 warning | functional | 7 | `production-todo.md:7` | La PR est ready-for-review mais ses checks sont encore en cours. | Attendre tous les checks requis et conserver la PR non fusionnée. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 75% (24/32) |
| Files checked | `.github/workflows/deploy-production.yml`, `apps/backend/convex`, `apps/mcp/src`, `apps/web/src`, `apps/web/e2e`, `packages/project-format/src`, `scripts`, `RELEASING.md`, `verification.md`, `production-todo.md` |
| Unchecked | Phase 6.1 Preview/fork/bot — fix; Phase 6.2 Polar échéance — fix; Phase 6.3 backup/restore — fix; Phase 6.4 SHA commun — fix; Phase 7.1 checks même SHA — fix; Phase 7.2 parcours candidat final — fix; Phase 7.3 review approuvée — fix; Phase 7.4 PR entièrement verte — fix |
| Unplanned | Project switcher et documents prélaunch présents dans le diff mais tracés par leurs plans AIDD séparés; aucun changement orphelin. |
