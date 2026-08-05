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
      { value: '1320×2868', label: 'Pixel-exact at 6.9″ — Apple scales it to every smaller size' },
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
      body: 'Rendered at native 1320×2868, never upscaled. App Store Connect derives every smaller iPhone size from your set — one export covers them all.',
      points: [
        'Native 6.9″ resolution, portrait or landscape',
        'PNG-24, sRGB, within the size limits',
        'One ZIP, ready for App Store Connect',
      ],
      visualCaption: 'One click: a validated ZIP, grouped by dimension.',
    },
    local: {
      title: 'Your screenshots stay on your machine',
      body: 'ScreenForge runs entirely in your browser. No account, no upload, no server between you and your export.',
    },
  },
  pricing: {
    title: 'No subscription required.',
    sub: 'Start free. Go unlimited monthly, or pay once and keep it forever.',
    currencyNote: 'USD, taxes included.',
    waitlistNote: 'Secure checkout is on its way — these buttons join the waitlist for now.',
    free: {
      name: 'Free',
      price: '$0',
      period: '',
      features: [
        'The full editor, all ten screens',
        '3 exports per set',
        'A small watermark on exports',
      ],
      cta: 'Open the app',
    },
    monthly: {
      name: 'Monthly',
      price: '$9.99',
      period: '/month',
      features: ['Unlimited exports, no watermark', 'Batch ZIP export', 'Cancel anytime'],
      cta: 'Get Monthly',
    },
    lifetime: {
      name: 'Lifetime',
      price: '$39.99',
      period: 'once',
      badge: 'Best value',
      features: [
        'Everything in Monthly',
        'Pay once, keep it forever',
        'Every future update included',
      ],
      cta: 'Get Lifetime',
    },
  },
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'What does the free tier include?',
        a: 'The full editor — every frame, font and background. Exports are limited to three per set and carry a small watermark. A paid plan removes both limits.',
      },
      {
        q: 'Monthly or Lifetime?',
        a: 'Monthly is $9.99 and cancels anytime. Lifetime is $39.99 once, with every future update included. Past four months of use, Lifetime is the better deal.',
      },
      {
        q: 'Which dimensions does it export?',
        a: 'Native 6.9″ (1320×2868), portrait or landscape — the largest size App Store Connect accepts. Apple derives every smaller iPhone size from it, so one set covers all iPhones.',
      },
      {
        q: 'Where do my images go?',
        a: 'Nowhere. ScreenForge runs entirely in your browser and stores projects locally on your machine. Nothing is uploaded, no account is needed.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Yes. If ScreenForge is not for you, email us within 14 days of purchase for a full refund.',
      },
    ],
  },
  finalCta: {
    headline: 'Your next screenshot set, ten minutes from now.',
    cta: 'Open the app — free',
  },
  footer: {
    contact: 'Contact',
    legal: 'Legal',
    privacy: 'Privacy',
    terms: 'Terms',
    copyright: '© 2026 ScreenForge',
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
      {
        value: '1320×2868',
        label: 'Au pixel près en 6,9″ — Apple le décline sur toutes les tailles',
      },
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
      body: "Rendus en 1320×2868 natif, jamais mis à l'échelle. App Store Connect dérive toutes les tailles iPhone inférieures de votre planche — un seul export les couvre toutes.",
      points: [
        'Résolution native 6,9″, portrait ou paysage',
        'PNG-24, sRGB, dans les limites de poids',
        'Un seul ZIP, prêt pour App Store Connect',
      ],
      visualCaption: 'Un clic : un ZIP validé, groupé par dimension.',
    },
    local: {
      title: 'Vos captures restent sur votre machine',
      body: 'ScreenForge tourne entièrement dans votre navigateur. Pas de compte, pas d\u2019upload, pas de serveur entre vous et votre export.',
    },
  },
  pricing: {
    title: 'Pas d\u2019abonnement imposé.',
    sub: 'Commencez gratuitement. Passez à l\u2019illimité au mois, ou payez une fois pour toujours.',
    currencyNote: 'USD, taxes incluses.',
    waitlistNote:
      'Le paiement sécurisé arrive — ces boutons rejoignent la liste d\u2019attente pour l\u2019instant.',
    free: {
      name: 'Gratuit',
      price: '0 $',
      period: '',
      features: [
        'L\u2019éditeur complet, les dix écrans',
        '3 exports par planche',
        'Un discret watermark sur les exports',
      ],
      cta: 'Ouvrir l\u2019app',
    },
    monthly: {
      name: 'Mensuel',
      price: '9,99 $',
      period: '/mois',
      features: [
        'Exports illimités, sans watermark',
        'Export ZIP groupé',
        'Résiliable à tout moment',
      ],
      cta: 'Choisir le Mensuel',
    },
    lifetime: {
      name: 'Lifetime',
      price: '39,99 $',
      period: 'une fois',
      badge: 'Meilleure valeur',
      features: [
        'Tout le Mensuel',
        'Payez une fois, gardez pour toujours',
        'Toutes les mises à jour incluses',
      ],
      cta: 'Choisir le Lifetime',
    },
  },
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Que comprend l\u2019offre gratuite ?',
        a: 'L\u2019éditeur complet — tous les cadres, polices et fonds. Les exports sont limités à trois par planche et portent un discret watermark. Une offre payante lève les deux limites.',
      },
      {
        q: 'Mensuel ou Lifetime ?',
        a: 'Le Mensuel est à 9,99 $, résiliable à tout moment. Le Lifetime est à 39,99 $ une fois, toutes les mises à jour incluses. Au-delà de quatre mois d\u2019usage, le Lifetime est plus avantageux.',
      },
      {
        q: 'Quelles dimensions sont exportées ?',
        a: 'Le 6,9″ natif (1320×2868), portrait ou paysage — la plus grande taille acceptée par App Store Connect. Apple en dérive toutes les tailles iPhone inférieures : une planche couvre tous les iPhone.',
      },
      {
        q: 'Où vont mes images ?',
        a: 'Nulle part. ScreenForge tourne entièrement dans votre navigateur et stocke les projets localement sur votre machine. Rien n\u2019est envoyé, aucun compte n\u2019est requis.',
      },
      {
        q: 'Puis-je être remboursé ?',
        a: 'Oui. Si ScreenForge ne vous convient pas, écrivez-nous dans les 14 jours suivant l\u2019achat pour un remboursement intégral.',
      },
    ],
  },
  finalCta: {
    headline: 'Votre prochaine planche, dans dix minutes.',
    cta: 'Ouvrir l\u2019app — gratuit',
  },
  footer: {
    contact: 'Contact',
    legal: 'Légal',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    copyright: '© 2026 ScreenForge',
  },
}

export const copy = { en, fr } as const
