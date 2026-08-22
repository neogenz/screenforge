/**
 * Les phrases d'état et d'erreur de l'éditeur, en un seul module.
 *
 * Forme : « cause. issue. » — pas d'excuse, pas de point d'exclamation, pas
 * de « Oups ». Les boutons sont au présent (« Exporter 3 écrans »), les
 * toasts au participe (« Exporté »). Les dialogues, toasts, Empty et
 * AsyncPanel lisent ici ; une phrase écrite ailleurs est une phrase que
 * personne ne relit.
 */
export const copy = {
  empty: {
    stageTitle: 'Commencez par vos captures',
    stageDescription: 'Déposez des PNG du simulateur, un écran par capture.',
    stageImport: 'Importer des captures',
    stageTemplate: 'Partir d’un modèle',
    layersTitle: 'Aucun calque ne correspond',
    selectionTitle: 'Sélectionnez un calque',
    selectionDescription: 'Cliquez sur la planche ou dans la liste des calques',
    templatesTitle: 'Aucun gabarit enregistré',
  },
  save: {
    idle: 'Modifications non enregistrées',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    error: 'Échec de l’enregistrement',
  },
  notice: {
    storageTitle: 'Le stockage local est indisponible.',
    storageDescription: 'Vos modifications restent en mémoire jusqu’à la fermeture de l’onglet.',
    storageAction: 'Réessayer',
    quotaTitle: 'Le quota Cloud est atteint.',
    quotaDescription: 'Les projets restent sur cet appareil tant qu’il n’est pas libéré.',
    bridgeTitle: 'Le pont assistant ne répond plus.',
    bridgeDescription: 'Relancez-le pour reprendre la génération là où elle s’est arrêtée.',
  },
  async: {
    failedTitle: 'L’aperçu n’a pas pu se calculer.',
    retry: 'Réessayer',
  },
  toast: {
    exported: 'Exporté',
    saved: 'Enregistré',
    exportFailed: 'Le rendu a échoué.',
  },
} as const
