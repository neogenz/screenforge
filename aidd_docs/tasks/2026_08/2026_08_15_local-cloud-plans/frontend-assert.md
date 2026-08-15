# Task Phase 5 — boot CSP et offre Local/Cloud

Vérifier dans le frontend lancé que l'externalisation du boot thème/fontes ne
casse ni l'éditeur ni la landing, et que l'offre reste strictement Local/Cloud
en anglais et en français.

## Main step 1

- [x] Candidat 1 — `boot.js` ne réactive pas la feuille Inter (`medium`) :
  `data-screenforge-font` passe à `media=all` dans l'éditeur et la landing.
- [x] Candidat 2 — le boot thème externe arrive trop tard (`medium`) : l'éditeur
  recharge directement dans le thème clair mémorisé, sans squelette restant.
- [x] Candidat 3 — le retrait des handlers inline casse une langue ou les cartes
  commerciales (`low`) : EN et FR affichent uniquement Local 49 $ une fois et
  Cloud 39 $/an, sans handler inline ni erreur console.

## Final

- [x] PASS — captures finales inspectées le 2026-08-15 sur l'éditeur clair, la
  section tarifs anglaise et la section tarifs française ; aucun warning/error
  navigateur observé.
