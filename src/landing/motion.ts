/*
 * Grammaire motion de la landing : la même que l'app (ease-out expo court,
 * transform/opacité uniquement), plus un stagger pour le reveal initial.
 * Un reveal se joue une fois par section — jamais de parallaxe ni d'effet
 * continu au scroll.
 */
export const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'

export const REVEAL_DURATION_MS = 220
export const REVEAL_STAGGER_MS = 80
