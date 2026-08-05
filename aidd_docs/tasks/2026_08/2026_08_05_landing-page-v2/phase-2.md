---
status: pending
---

# Instruction: Copy v2 — des piliers qui resteront vrais quand le SaaS arrive

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
src/landing/
├── copy.ts                  ✏️ réécriture complète des sections concernées
├── components/Features.tsx  ✏️ le bandeau local-first devient le bandeau lifetime
└── components/ProofStrip.tsx ✏️ troisième métrique remplacée
```

## Tasks to do

### `1)` Supprimer les promesses intenables

> « Sans compte », « sans upload », « 0 upload », « local-first » : tout disparaît.

1. Hero `sub` : remplacer « local-first » par la vitesse — le rendu se fait sur la machine de l'utilisateur (vrai même connecté, l'export Fabric reste client).
2. ProofStrip : « 0 uploads » → « 10 écrans » (l'unité de travail : la planche entière).
3. Features : le bandeau « vos captures restent sur votre machine » est supprimé.
4. FAQ : la question « Où vont mes images ? » est retirée ou reformulée sans promesse d'absence de compte.

### `2)` Poser les vrais piliers

> Pixel-exact, vitesse, prix — c'est ça la différenciation face à AppScreens.

1. Nouveau bandeau à la place du local-first : « Les autres outils louent l'éditeur au mois. ScreenForge le vend une fois. » (sans nommer de concurrent).
2. FAQ : remplacer par « Abonnement obligatoire ? » → non, le Mensuel existe pour ceux qui préfèrent, le Lifetime débloque tout pour toujours.
3. Ton : précis, confiant, aucun superlatif creux ; chiffres en tabulaire partout où ils vendent (9,99 $, 39,99 $, 1320×2868).
4. Les deux langues relues à voix haute : le FR ne doit pas sentir la traduction.

## Test acceptance criteria

| Task | Acceptance criteria                                                                              |
| ---- | ------------------------------------------------------------------------------------------------ |
| 1    | `grep -i "local-first\|no account\|no upload\|sans compte\|sans upload" src/landing/` ne trouve rien |
| 2    | Le bandeau lifetime est présent dans les deux langues, sans nom de concurrent                     |
| 3    | La FAQ ne promet ni absence de compte ni absence d'upload                                         |
