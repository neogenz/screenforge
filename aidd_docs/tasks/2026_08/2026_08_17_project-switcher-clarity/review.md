# Review: Clarifier la navigation et la disponibilité des projets

- **Verdict**: approve
- **Diff**: `0c3a9cc6b2522234976bd38d1489027b2b5fda13...WORKTREE@19c6af53bd4e6f143bac1c05205078ad4e49b2cf`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_17
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Vocabulaire et états de disponibilité

- [x] Les termes visibles décrivent sans ambiguïté la disponibilité de la copie et ne redéfinissent pas les offres Local/Cloud. — `apps/web/src/lib/sync.ts:438`, `aidd_docs/memory/design.md:27`
- [x] Un catalogue mixte est classé sans appel réseau ni écriture locale ou distante. — `apps/web/src/lib/sync.ts:460`, `apps/web/src/lib/sync.ts:480`
- [x] Une modification locale postérieure au dernier accusé affiche `À synchroniser`. — `apps/web/src/lib/sync.ts:469`, `apps/web/src/lib/__tests__/sync.test.ts:142`
- [x] Les tests échouent si un projet sans accusé est annoncé dans le Cloud ou si la lecture crée un état de synchronisation. — `apps/web/src/lib/__tests__/sync.test.ts:142`, `apps/web/src/lib/__tests__/sync.test.ts:161`

### Phase 2 — Sélecteur de projets structuré

- [x] À l'ouverture, le projet courant, ses actions et les autres projets se distinguent en moins d'un balayage visuel. — `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:192`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:223`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:313`
- [x] Chaque autre projet annonce son nom complet aux technologies d'assistance, sa disponibilité et sa date. — `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:263`, `apps/web/e2e/project-file.spec.ts:589`
- [x] Le nom courant reste éditable et les opérations importer/télécharger/ouvrir conservent leurs garanties actuelles. — `apps/web/src/components/toolbar/TopBar.tsx:167`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:102`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:113`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:131`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:145`
- [x] À largeur compacte et avec un nom long, aucun témoin ni action ne se chevauche. — `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:189`, `apps/web/e2e/project-file.spec.ts:573`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:29`
- [x] Le panneau est entièrement utilisable au clavier et rend le focus au déclencheur après Échap ou sélection. — `apps/web/e2e/project-file.spec.ts:552`, `apps/web/e2e/project-file.spec.ts:603`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:12`
- [x] Une erreur de catalogue laisse le projet courant utilisable et propose une reprise explicite. — `apps/web/src/lib/storage.ts:302`, `apps/web/src/lib/__tests__/storage.test.ts:425`, `apps/web/e2e/project-file.spec.ts:622`

### Phase 3 — Dialogue de rattachement et quality gate UX

- [x] Sans connaissance du terme rattachement, la personne comprend quels projets sont concernés, où ils iront et ce qui restera local. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:114`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:140`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:145`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:187`
- [x] Les boutons annoncent leur résultat et la destination Cloud ; aucun libellé générique `OK`, `Oui` ou `Tout` ne subsiste. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:102`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:117`
- [x] Aucun élément statique de la liste ne ressemble à un input, un bouton ou une sélection modifiable. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:145`, `apps/web/e2e/sync.spec.ts:1448`
- [x] Les noms longs, le pluriel, le chargement et l'erreur restent compréhensibles à 200 % de zoom. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:102`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:149`, `apps/web/e2e/sync.spec.ts:1457`, `apps/web/e2e/sync.spec.ts:1530`
- [x] Les tests prouvent que l'action différée ne rattache rien depuis ce dialogue et que l'action primaire traite exactement les fixtures listées. — `apps/web/e2e/sync.spec.ts:1479`, `apps/web/e2e/sync.spec.ts:1490`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:11`
- [x] Les deux passes visuelles, les audits de contraste/échelle, le détecteur Impeccable et la gate de release sont verts. — `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:14`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:29`
- [x] Aucune donnée utilisateur réelle n'est mutée ou supprimée pendant la vérification. — `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:3`, `apps/web/e2e/sync.spec.ts:1405`, `apps/web/e2e/sync.spec.ts:1525`, `apps/web/e2e/sync.spec.ts:1598`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (17/17) |
| Files checked | `aidd_docs/memory/design.md`, `aidd_docs/memory/navigation.md`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/plan.md`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/phase-1.md`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/phase-2.md`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/phase-3.md`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/assert.md`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md`, `apps/web/src/lib/storage.ts`, `apps/web/src/lib/__tests__/storage.test.ts`, `apps/web/src/lib/sync.ts`, `apps/web/src/lib/__tests__/sync.test.ts`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx`, `apps/web/src/components/toolbar/TopBar.tsx`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/e2e/project-file.spec.ts`, `apps/web/e2e/semantics.spec.ts`, `apps/web/e2e/sync.spec.ts` |
| Unchecked     | none |
| Unplanned     | none |
