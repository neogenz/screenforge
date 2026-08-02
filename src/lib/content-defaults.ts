/**
 * Default content values for layers and fills.
 *
 * These are canvas-content colors (what the user designs with), not chrome
 * colors — they intentionally live outside the token system. Single source
 * for every default previously hardcoded across the feature editors.
 */

/**
 * Fonds d'écran. Neutres clairs : ils restent lisibles sous le texte sombre
 * par défaut, quel que soit le moment où l'utilisateur bascule uni/dégradé.
 * Les anciennes valeurs (`#6366f1` / `#8b5cf6`) étaient les couleurs par
 * défaut de Tailwind : elles signaient le gabarit au premier coup d'œil.
 */
export const DEFAULT_SOLID_COLOR = '#f2f3f5'
export const DEFAULT_BACKGROUND_FROM = '#f2f3f5'
export const DEFAULT_BACKGROUND_TO = '#d9dee5'

/**
 * Encre de contenu : texte et formes neufs. Les réglages globaux du projet et
 * les fabriques de calques doivent lire la même valeur, sans quoi un même
 * « ajouter un texte » donne deux noirs différents selon le chemin emprunté.
 */
export const DEFAULT_INK_COLOR = '#141413'

/** Remplissages de contenu (texte, formes), posés au-dessus d'un fond clair. */
export const DEFAULT_GRADIENT_FROM = '#2b2f36'
export const DEFAULT_GRADIENT_TO = '#5a6270'
export const DEFAULT_STOP_COLOR = '#ffffff'
export const DEFAULT_STROKE_COLOR = '#000000'
export const DEFAULT_FILL_COLOR = '#000000'
export const DEFAULT_SHADOW_COLOR = 'rgba(0,0,0,0.4)'
export const DEFAULT_DEVICE_SHADOW_COLOR = 'rgba(0,0,0,0.3)'
export const DEFAULT_CANVAS_SHADOW_COLOR = 'rgba(0,0,0,0.35)'
