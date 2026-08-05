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
    menuLabel: 'Menu',
  },
  hero: {
    headline: 'App Store screenshots, down to the pixel.',
    sub: 'ScreenForge is a local-first editor for iPhone screenshot sets. Compose up to ten screens, export pixel-exact PNGs, and upload a ZIP that passes App Store Connect validation the first time.',
    ctaPrimary: 'Start designing — free',
    ctaSecondary: 'See pricing',
    visualCaption: 'A ten-screen set designed and exported in ScreenForge.',
  },
  proof: {
    items: [
      { value: '1320×2868', label: 'Pixel-exact at 6.9″, and every size Apple accepts' },
      { value: 'PNG-24', label: 'Opaque, sRGB, within App Store size limits' },
      { value: '0 uploads', label: 'Your images never leave your machine' },
    ],
  },
  features: {
    editor: {
      title: 'A real editor, not a form',
      body: 'Layers, official iPhone frames, gradients, Google Fonts on demand. Design one screen, apply it to all ten. The canvas is the preview — what you see is what App Store Connect gets.',
      points: [
        'Official iPhone frames, every current model',
        'Apply a change to all ten screens at once',
        'Google Fonts loaded on demand',
      ],
      visualCaption: 'The editor: layers on the left, ten screens below.',
    },
    export: {
      title: 'Exports that pass review',
      body: 'Every dimension Apple accepts, rendered at native resolution — never upscaled. One click builds a ZIP organized by device size, ready to drop into App Store Connect.',
      points: [
        'Every accepted dimension, portrait and landscape',
        'PNG-24, sRGB, within the size limits',
        'One ZIP, grouped by device size',
      ],
      visualCaption: 'One click: a validated ZIP, grouped by dimension.',
    },
    local: {
      title: 'Your screenshots stay on your machine',
      body: 'ScreenForge runs entirely in your browser. No account, no upload, no server between you and your export.',
    },
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
    menuLabel: 'Menu',
  },
  hero: {
    headline: 'Des captures App Store, au pixel près.',
    sub: "ScreenForge est un éditeur local-first pour planches de captures iPhone. Composez jusqu'à dix écrans, exportez des PNG au pixel près et déposez un ZIP validé par App Store Connect du premier coup.",
    ctaPrimary: "Commencer — c'est gratuit",
    ctaSecondary: 'Voir les tarifs',
    visualCaption: 'Une planche de dix écrans dessinée et exportée dans ScreenForge.',
  },
  proof: {
    items: [
      { value: '1320×2868', label: 'Au pixel près en 6,9″, et chaque format accepté par Apple' },
      { value: 'PNG-24', label: 'Opaque, sRGB, dans les limites App Store' },
      { value: '0 upload', label: 'Vos images ne quittent jamais votre machine' },
    ],
  },
  features: {
    editor: {
      title: 'Un vrai éditeur, pas un formulaire',
      body: "Calques, cadres iPhone officiels, dégradés, Google Fonts à la demande. Dessinez un écran, appliquez-le aux dix. Le canvas est l'aperçu : ce que vous voyez est ce que reçoit App Store Connect.",
      points: [
        'Cadres iPhone officiels, tous les modèles courants',
        'Appliquez un changement aux dix écrans d\u2019un coup',
        'Google Fonts chargées à la demande',
      ],
      visualCaption: "L'éditeur : les calques à gauche, les dix écrans en dessous.",
    },
    export: {
      title: 'Des exports qui passent la validation',
      body: "Toutes les dimensions acceptées par Apple, rendues en résolution native — jamais mises à l'échelle. Un clic produit un ZIP organisé par format, prêt à déposer dans App Store Connect.",
      points: [
        'Tous les formats acceptés, portrait et paysage',
        'PNG-24, sRGB, dans les limites de poids',
        'Un seul ZIP, groupé par dimension',
      ],
      visualCaption: 'Un clic : un ZIP validé, groupé par dimension.',
    },
    local: {
      title: 'Vos captures restent sur votre machine',
      body: 'ScreenForge tourne entièrement dans votre navigateur. Pas de compte, pas d\u2019upload, pas de serveur entre vous et votre export.',
    },
  },
}

export const copy = { en, fr } as const
