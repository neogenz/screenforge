# Review: Projet ScreenForge portable

- **Verdict**: approve
- **Diff**: `origin/codex/screenforge-functional-rebuild...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_03
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Contrat d’archive versionné et sûr

- [x] Une archive v1 expose uniquement `project.json` et les chemins `assets/` déclarés ; les versions et chemins inconnus sont refusés par une erreur stable — `src/lib/project-file.ts:349-426`, `e2e/project-file.spec.ts:179-239`.
- [x] Un projet avec image, capture et bezel produit une archive dont chaque asset référencé existe une seule fois, possède le bon MIME/hash et n’apparaît jamais comme data URL dans le JSON — `src/lib/project-file.ts:152-196`, `e2e/project-file.spec.ts:157-177`.
- [x] Tout fichier incomplet, corrompu, trop grand ou d’une version non prise en charge est rejeté avant mutation observable du projet ou du registre courant — `src/lib/project-file.ts:199-482`, `e2e/project-file.spec.ts:179-265`.
- [x] Les tests utilisent seulement des blobs/PNG synthétiques en mémoire, sans réseau, snapshot ni attente temporelle — `e2e/project-file.spec.ts:22-265`.

### Phase 2 — Menu Projet et round-trip navigateur

- [x] L’ouverture valide crée une copie indépendante, remappe toutes les références d’assets, vide l’historique et survit à un reload ; un échec laisse la session courante strictement intacte — `src/lib/storage.ts:279-339`, `e2e/project-file.spec.ts:278-424`.
- [x] Le menu Projet est navigable au clavier, restaure le focus, annonce l’état occupé et télécharge un fichier `.screenforge.zip` sans détourner l’export App Store — `src/components/toolbar/TopBar.tsx:102-194`, `e2e/project-file.spec.ts:268-275`, `e2e/project-file.spec.ts:426-434`.
- [x] Le test E2E télécharge puis réimporte le même projet synthétique, retrouve chaque écran et asset après reload, puis obtient encore un ZIP App Store 1320×2868 RGB opaque aux pixels attendus, sans `waitForTimeout` — `e2e/project-file.spec.ts:278-395`.
- [x] Le PRD décrit sans ambiguïté les trois niveaux : autosave IndexedDB, fichier projet portable et ZIP de captures App Store — `PRD.md:304-338`.

## Findings

None.

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (8/8) |
| Files checked | `PRD.md`, `phase-1.md`, `phase-2.md`, `plan.md`, `e2e/helpers.ts`, `e2e/project-file.spec.ts`, `src/components/toolbar/TopBar.tsx`, `src/lib/project-file.ts`, `src/lib/storage.ts` |
| Unchecked     | none |
| Unplanned     | none |
