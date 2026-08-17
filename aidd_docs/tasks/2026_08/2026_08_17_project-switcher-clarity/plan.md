---
objective: "Le sélecteur de projets et la fenêtre de rattachement rendent immédiatement identifiables le projet courant, la disponibilité de chaque projet et la conséquence de chaque action, sans modifier les règles de synchronisation."
status: implemented
---

# Plan: Clarifier la navigation et la disponibilité des projets

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Remplacer le menu Projet plat par une navigation structurée et rendre la liste de rattachement manifestement informative. |
| **Source** | Demande utilisateur et captures du 17 août 2026, analysées avec `impeccable clarify`. |

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Vocabulaire et états de disponibilité      | [`phase-1.md`](./phase-1.md) |
| 2   | Sélecteur de projets structuré             | [`phase-2.md`](./phase-2.md) |
| 3   | Dialogue de rattachement et quality gate UX | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Un `ProjectSwitcher` dédié remplace la liste plate dans le `Dropdown` générique. | Le panneau mélange navigation, état, filtre et actions du document courant ; étendre tous les menus pour ce seul cas augmenterait inutilement leur API. |
| Les états décrivent la disponibilité de la copie : `Cet appareil`, `Cloud`, `À synchroniser`. | `Local` et `Cloud` sont déjà des offres commerciales ; les réutiliser seuls sur un projet ferait croire qu'un projet Cloud n'existe plus localement. |
| Le nom courant reste éditable dans la barre et l'action Renommer continue de le cibler. | Cette amélioration est un raffinement : elle préserve l'édition rapide existante et concentre le changement sur la navigation entre projets. |
| Le plan ne change ni le moment de l'upload ni les données déjà présentes dans Convex. | Le consentement initial appartient au plan Cloud en cours ; ce plan doit afficher fidèlement l'état retenu sans supprimer, rattacher ou migrer de données. |
| Le contrôle visuel se fait en deux passes bornées au maximum. | Une passe desktop + fenêtre compacte identifie les défauts en lot ; une seconde confirme les corrections sans boucle de polissage ouverte. |
