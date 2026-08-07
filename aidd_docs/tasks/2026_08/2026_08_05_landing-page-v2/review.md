# Review: feat/landing-v2 × LARGO-193

- **Verdict**: blocked
- **Diff**: `main...feat/landing-v2+worktree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_06
- **Findings**: 1 critical, 13 warning, 2 minor

## Phases

### Phase 1 — Prerender au build : HTML complet, documents EN + FR, hreflang

- [x] Le hero est rendu dans le HTML statique — `scripts/prerender-landing.mjs:44`
- [x] Le document français reçoit son contenu, son `lang` et son titre — `scripts/prerender-landing.mjs:44`
- [x] Les canonical/hreflang sont injectés et le sélecteur navigue entre documents — `scripts/prerender-landing.mjs:67`, `src/landing/components/LangLink.tsx:28`
- [x] Le contenu est rendu côté serveur puis hydraté, avec garde-fou contre le contenu masqué sans JavaScript — `src/landing/main.tsx:16`, `scripts/landing-audit.mjs:104`

### Phase 2 — Copy v2 : piliers durables

- [ ] Les promesses « no account / no upload / sans compte / sans upload » sont absentes — critère remplacé par l’offre commerciale actuelle, qui distingue explicitement l’état gratuit présent et l’offre future
- [ ] Le bandeau Lifetime existe dans les deux langues sans nommer de concurrent — critère remplacé par le modèle Licence + Cloud de `aidd_docs/tasks/2026_08/2026_08_06_offre-commerciale/pricing.md`
- [ ] La FAQ ne promet ni absence de compte ni absence d’upload — critère remplacé par la description explicite du fonctionnement local actuel

### Phase 3 — Design specimen/blueprint

- [ ] Le hero porte deux cotes sur un visuel réel — critère remplacé : les cotes et la démo sont déplacées dans `src/landing/components/ProductShowcase.tsx:40`
- [ ] Chaque section est introduite par un en-tête numéroté — critère remplacé par la nouvelle direction visuelle arcade
- [ ] Le pricing est uniquement un tableau hairline avec Lifetime distingué — critère remplacé par trois cartes Licence/Cloud et un comparatif détaillé
- [ ] `audit:landing` reste vert sans couleur chromatique hors visuels produit — la nouvelle direction emploie volontairement le citron de marque hors visuels

### Jira LARGO-193 — Onglet audits sur un collaborateur

- [ ] Un onglet dédié liste uniquement les évaluations, sans filtres, avec création et tri statut puis récence — aucun module Largo ou profil collaborateur dans le diff
- [ ] Les évaluations apparaissent aussi dans la page événements avec le titre véhicule/ligne et la chip d’aptitude — aucune page événements Largo dans le diff
- [ ] Les statuts suivent les règles des événements sans autoriser `new` ni `ignored` — aucun modèle de statut Largo dans le diff
- [ ] Le bouton ouvre un tiroir avec collaborateur et manager en lecture seule, date, statut, véhicule, ligne, numéro et aptitude — aucun formulaire d’évaluation dans le diff
- [ ] Le type de véhicule charge les questions correspondantes du formulaire LargoV1 — aucune question Autobus/Trolley/Tramway dans le diff
- [ ] La date vaut aujourd’hui et le statut vaut « clôturé » par défaut — aucun défaut métier d’évaluation dans le diff
- [ ] Une évaluation peut être validée avec des champs incomplets — aucune règle de validation Largo dans le diff
- [ ] L’occurrence et les réponses sont persistées dans une table métier spécifique — ScreenForge est local-first et sans backend
- [ ] L’historique indique création et modifications avec auteur et date — aucun historique métier Largo dans le diff
- [ ] Une évaluation non clôturée peut être modifiée puis clôturée, avec libellés d’édition adaptés — aucun écran d’édition Largo dans le diff
- [ ] Le type `AUDIT` disparaît de la création manuelle d’événements — aucune création d’événement Largo dans le diff
- [ ] Le code et la base emploient `evaluation` ou `assessment`, jamais `audit` comme terme métier — aucun domaine Largo ou schéma de base dans le diff

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 critical | fit | LARGO-193 | `AGENTS.md:5`, `src/landing/Landing.tsx:12` | Le diff appartient à ScreenForge et implémente une landing ; LARGO-193 demande une fonctionnalité d’évaluation collaborateur avec UI, règles métier et persistance dans le produit Largo. | Relancer la revue dans le dépôt et sur la branche qui portent l’implémentation de LARGO-193. |
| 🟡 warning | code | Phase 3 | `src/landing/demo/DemoEditor.tsx:267` | La reprise manuelle annule l’effet, mais `moveTo()` et `click()` terminent leurs attentes puis certaines étapes écrivent encore dans la scène avant de tester `cancelled`; l’autoplay peut donc écraser une action utilisateur. | Faire retourner immédiatement les helpers après annulation et tester `cancelled` après chaque attente, avant toute mutation de scène. |
| 🟢 minor | rot | Phase 3 | `src/landing/components/ExportSpec.tsx:52`, `src/landing/components/SpreadDiagram.tsx:44` | Deux composants complets ne sont importés nulle part dans la landing finale. | Les supprimer du changement, ou les câbler si la direction retenue les utilise réellement. |
| 🟢 minor | rot | Phase 3 | `design-previews/screenforge-arcade-texture-hero.png`, `public/landing/texture-hero.webp` | Les PNG de travail non référencés dupliquent les WebP livrés et ajoutent plusieurs mégaoctets au dépôt. | Exclure `design-previews/` du changement et ne conserver que les assets optimisés servis. |
| 🟡 warning | functional | LARGO-193 | `-` | L’onglet dédié, sa liste filtrée, son bouton de création et son tri ne sont pas implémentés. | Implémenter l’onglet évaluations sur le profil collaborateur et son ordre statut puis récence. |
| 🟡 warning | functional | LARGO-193 | `-` | Les évaluations ne sont pas intégrées à la page événements avec le rendu véhicule/ligne et aptitude. | Ajouter la projection des évaluations dans la liste d’événements et son format d’affichage. |
| 🟡 warning | functional | LARGO-193 | `-` | Les règles de statut des évaluations, dont l’exclusion de `new` et `ignored`, sont absentes. | Réutiliser les transitions d’événement autorisées en retirant ces deux statuts. |
| 🟡 warning | functional | LARGO-193 | `-` | Le tiroir de création et ses champs d’en-tête sont absents. | Ajouter le formulaire avec les champs et états lecture seule décrits par le ticket. |
| 🟡 warning | functional | LARGO-193 | `-` | Le chargement des questions selon Autobus, Trolley ou Tramway est absent. | Porter les questions LargoV1 et sélectionner le questionnaire selon le véhicule. |
| 🟡 warning | functional | LARGO-193 | `-` | Les valeurs par défaut date du jour et statut clôturé sont absentes. | Initialiser ces valeurs à l’ouverture du formulaire. |
| 🟡 warning | functional | LARGO-193 | `-` | La validation partielle d’une évaluation n’est pas définie. | Autoriser l’enregistrement sans rendre tous les champs obligatoires. |
| 🟡 warning | functional | LARGO-193 | `-` | La persistance de l’occurrence et des réponses dans une table spécifique est absente. | Ajouter le modèle, la migration et l’écriture transactionnelle correspondants dans Largo. |
| 🟡 warning | functional | LARGO-193 | `-` | L’historique de création et de modification avec auteur et date est absent. | Brancher les actions d’évaluation sur le mécanisme d’historique existant. |
| 🟡 warning | functional | LARGO-193 | `-` | L’édition puis la clôture d’une évaluation ouverte et les libellés associés sont absents. | Ajouter le mode édition, la transition de clôture et les libellés contextuels. |
| 🟡 warning | functional | LARGO-193 | `-` | Le retrait du type AUDIT de la création manuelle d’événements n’est pas réalisé. | Supprimer cette option du type d’événement Largo et de ses validations. |
| 🟡 warning | functional | LARGO-193 | `-` | Aucun modèle métier Largo n’emploie `evaluation` ou `assessment` pour couvrir le besoin. | Nommer le domaine et le schéma `evaluation` ou `assessment`, en réservant `audit` à l’historisation technique. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 17% (4/23) |
| Files checked | `landing.html`, `package.json`, `vite.config.ts`, `scripts/landing-*.mjs`, `scripts/prerender-landing.mjs`, `scripts/og-card.mjs`, `src/landing/**`, `AGENTS.md`, plan Landing v2, offre commerciale, Jira `LARGO-193` |
| Unchecked     | Phase 2 promesses compte/upload — not-applicable; Phase 2 bandeau Lifetime — not-applicable; Phase 2 FAQ compte/upload — not-applicable; Phase 3 cotes dans le hero — not-applicable; Phase 3 titres numérotés — not-applicable; Phase 3 pricing sans cartes — not-applicable; Phase 3 monochrome — not-applicable; onglet/listage/tri LARGO — fix; rendu page événements — fix; statuts — fix; tiroir et champs — fix; questionnaires véhicule — fix; valeurs par défaut — fix; validation partielle — fix; persistance — fix; historique — fix; édition/clôture — fix; retrait du type AUDIT — fix; terminologie métier — fix |
| Unplanned     | Offre Licence + Cloud, direction arcade, textures, showcase interactif et visuels générés; aucune modification du diff ne trace vers LARGO-193 |
