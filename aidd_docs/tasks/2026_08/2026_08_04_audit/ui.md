# Codebase Audit: UI
Le design system Tailwind/Radix est cohérent, accessible et stable en clair/sombre ; le seul défaut fonctionnel notable est l’absence de repli visible si le démarrage asynchrone échoue.

- **Date**: 2026-08-04
- **Scope**: design system, états UI, accessibilité statique, responsive desktop et probes visuels
- **Health**: good
- **Findings**: 0 critical, 1 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | ui | `src/App.tsx:44` | Une panne IndexedDB pendant `loadLatestProject` est seulement journalisée. Les Error Boundaries React ne capturent pas cette promesse d’effet et l’application peut rester ouverte sans projet ni explication. | Dans le `catch`, créer un projet mémoire par défaut, marquer la sauvegarde en erreur et afficher un toast persistant indiquant que la persistance locale est indisponible. | S |
| 🟢 | ui | `src/App.tsx:161` | Les trois dialogues lazy partagent `Suspense fallback={null}`. Sur un chargement lent, l’action semble ne rien faire jusqu’à l’arrivée du chunk. | Utiliser un fallback discret commun (scrim + indicateur annoncé) ou précharger le chunk au focus/hover du déclencheur. | S |

## Top actions

1. Résoudre le finding ui #1 avec `aidd-dev:02-implement` : fournir un mode mémoire explicite lorsque l’initialisation IndexedDB échoue.
2. Résoudre le finding ui #2 avec `impeccable` : donner un feedback minimal au chargement des dialogues lazy.
3. Garder `index.css` centralisé : à 459 lignes, il sépare déjà thème, base et utilities ; CSS Modules ou CSS-in-JS ajouteraient de la fragmentation sans bénéfice.

## Coverage

- **Scanned**: ui — probes dark/light × vide/peuplé, viewport 1024×768, contraste automatisé (pire cas 4,62:1 sombre, 4,85:1 clair), états vides/erreur/loading, primitives Radix/CVA, tokens OKLCH, focus et densité desktop.
- **Skipped**: audit axe automatisé et lecteurs d’écran réels ; mobile volontairement hors cible d’un éditeur desktop.
