export interface PrivacyCopy {
  bannerTitle: string
  bannerBody: string
  policy: string
  rejectAll: string
  choose: string
  acceptAll: string
  title: string
  analyticsTitle: string
  analyticsBody: string
  diagnosticTitle: string
  diagnosticBody: string
  save: string
  close: string
  storageError: string
}

export const PRIVACY_COPY = {
  en: {
    bannerTitle: 'Your privacy, your choice',
    bannerBody:
      'ScreenForge stays fully usable without tracking. With your consent, product analytics and diagnostics help improve it.',
    policy: 'Read the privacy policy',
    rejectAll: 'Reject all',
    choose: 'Choose',
    acceptAll: 'Accept all',
    title: 'Privacy settings',
    analyticsTitle: 'Product analytics',
    analyticsBody:
      'Explicit usage events, without project names, images or canvas content. 13 months.',
    diagnosticTitle: 'Diagnostics',
    diagnosticBody:
      'Masked session replay, errors and structured logs. No canvas, input, text, console or network body. 30 days.',
    save: 'Save choices',
    close: 'Close',
    storageError: 'These choices could not be saved. Tracking remains disabled.',
  },
  fr: {
    bannerTitle: 'Votre vie privée, votre choix',
    bannerBody:
      'ScreenForge reste entièrement utilisable sans suivi. Avec votre accord, les statistiques produit et le diagnostic aident à l’améliorer.',
    policy: 'Lire la politique de confidentialité',
    rejectAll: 'Tout refuser',
    choose: 'Choisir',
    acceptAll: 'Tout accepter',
    title: 'Préférences de confidentialité',
    analyticsTitle: 'Analytics produit',
    analyticsBody:
      'Événements d’usage explicites, sans nom de projet, image ni contenu du canvas. 13 mois.',
    diagnosticTitle: 'Diagnostic',
    diagnosticBody:
      'Replay masqué, erreurs et logs structurés. Aucun canvas, champ, texte, console ni corps réseau. 30 jours.',
    save: 'Enregistrer les choix',
    close: 'Fermer',
    storageError: 'Ces choix n’ont pas pu être enregistrés. Le suivi reste désactivé.',
  },
} satisfies Record<'en' | 'fr', PrivacyCopy>
