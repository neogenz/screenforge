/*
 * Source unique de tout le texte de la landing. `fr` est typé sur `en` :
 * une clé manquante est une erreur de compilation, pas une chaîne anglaise
 * oubliée dans la page française.
 */
const en = {
  meta: {
    title: 'ScreenForge — App Store screenshots, pixel-exact',
    description:
      'Local-first editor for iPhone App Store screenshot sets. Pixel-exact exports, every accepted dimension, one ZIP ready for App Store Connect. No account, no upload.',
  },
  nav: {
    features: 'Features',
    pricing: 'Pricing',
    faq: 'FAQ',
    cta: 'Open the app',
    langSwitchLabel: 'Language',
  },
}

export type Copy = typeof en

const fr: Copy = {
  meta: {
    title: 'ScreenForge — des captures App Store au pixel près',
    description:
      'Éditeur local-first pour planches de captures App Store iPhone. Exports au pixel près, toutes les dimensions acceptées, un ZIP prêt pour App Store Connect. Sans compte, sans upload.',
  },
  nav: {
    features: 'Fonctionnalités',
    pricing: 'Tarifs',
    faq: 'FAQ',
    cta: "Ouvrir l'app",
    langSwitchLabel: 'Langue',
  },
}

export const copy = { en, fr } as const
