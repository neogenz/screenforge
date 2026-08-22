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
  rightsBody: string
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
      'Explicit usage events, without project names, images or canvas content. The current PostHog plan retains events for up to 7 years.',
    diagnosticTitle: 'Diagnostics',
    diagnosticBody:
      'Masked replay and structured logs: 30 days. Errors follow event retention. No canvas, input, text, console or network body.',
    rightsBody:
      'Changing these settings stops future capture on this device. Deleting your Cloud account also requests deletion of its identified PostHog history. For access or manual deletion, email bonjour@screenforge.app.',
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
      'Événements d’usage explicites, sans nom de projet, image ni contenu du canvas. Le plan PostHog actuel conserve les événements jusqu’à 7 ans.',
    diagnosticTitle: 'Diagnostic',
    diagnosticBody:
      'Replay masqué et logs structurés : 30 jours. Les erreurs suivent la durée des événements. Aucun canvas, champ, texte, console ni corps réseau.',
    rightsBody:
      'Modifier ces choix arrête les futures captures sur cet appareil. Supprimer votre compte Cloud demande aussi l’effacement de son historique PostHog identifié. Pour un accès ou un effacement manuel : bonjour@screenforge.app.',
    save: 'Enregistrer les choix',
    close: 'Fermer',
    storageError: 'Ces choix n’ont pas pu être enregistrés. Le suivi reste désactivé.',
  },
} satisfies Record<'en' | 'fr', PrivacyCopy>
