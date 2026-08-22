# Runbook — préproduction Cloud

Ce runbook décrit la réaction opérateur sans publier de seuil, coût, identité,
URL signée ou état fournisseur vivant. Les valeurs actives restent dans les
dashboards de l'environnement concerné.

## Diagnostic

1. Confirmer le SHA frontend/backend déployé et l'environnement visé.
2. Dans Convex, consulter Usage, Logs et History pour `Function calls`,
   `Database I/O` et `Data egress`; comparer la fenêtre courante au baseline.
3. Vérifier les erreurs applicatives nommées (auth, quota, débit, webhook) avant
   de conclure à une attaque.
4. Dans Vercel, contrôler Deployment Protection, les accès du projet, les liens
   partageables, les exceptions et les bypass d'automation.

Les commandes de lecture des variables, du preflight et des tables sont dans le
[runbook des environnements](../2026_08_11_migration-convex/environnements.md).
Ne jamais copier leur sortie brute dans un ticket ou un artifact.

## Baseline et limites Convex

- Mesurer trois parcours Cloud complets sur la préproduction avec des fixtures
  synthétiques, puis relever le pic d'une journée normale.
- Pour chaque métrique, définir le warning au maximum de trois fois le coût du
  gate le plus cher et deux fois le pic journalier normal.
- Utiliser une fenêtre quotidienne. Le warning alerte et alimente History sans
  couper le service.
- Si le type de déploiement ou le plan fournisseur ne permet pas d'activer un
  warning, ne pas le remplacer silencieusement par un disable actif : consigner
  le blocage, conserver la surveillance manuelle et demander une décision sur
  le budget d'indisponibilité.
- Préparer la valeur d'un éventuel disable dans le dashboard, mais la laisser
  inactive jusqu'à validation explicite du budget maximal et de
  l'indisponibilité acceptable. Aucun test ne déclenche volontairement ce
  coupe-circuit.

## Réaction et réactivation

1. Si le warning vient d'une release connue, arrêter le déploiement fautif ou
   revenir au dernier SHA vert; ne pas relâcher auth, quotas ou rate limits.
2. Si un accès Vercel est compromis, révoquer d'abord le lien, l'invitation,
   l'exception ou le bypass précis, puis vérifier les logs.
3. Si un disable est un jour activé, corriger ou révoquer la source, ajuster ou
   retirer temporairement la limite dans Convex, vérifier le retour des
   fonctions, puis rétablir une valeur approuvée. La fenêtre quotidienne borne
   aussi la coupure à minuit UTC.
4. Nettoyer les fixtures et consigner uniquement SHA, dates, verdicts et liens
   publics génériques.

## Escalade

- Escalader immédiatement une fuite de données, un contournement d'autorisation,
  un secret exposé ou une dépense non bornée.
- Ajouter un WAF seulement après mesure d'un trafic applicatif abusif qui passe
  réellement Vercel Authentication et les rate limits. Pour couvrir aussi le
  WebSocket Convex, l'edge doit alors protéger le domaine Convex personnalisé;
  une simple réécriture Vercel des HTTP actions ne suffit pas.
- Refaire un scan approfondi avant chaque release majeure ou nouvelle surface
  publique, au moins chaque trimestre en exploitation active, et plus tôt après
  incident fournisseur, abus observé ou saut documenté des capacités cyber.
- Examiner mensuellement limites Convex, accès Vercel, Dependabot et volumes
  d'erreur. Ajouter Sentry, log streaming ou scanner périodique seulement si
  cette revue révèle un manque de visibilité concret.
