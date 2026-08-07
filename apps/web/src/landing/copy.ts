/*
 * Source unique de tout le texte de la landing. `fr` est typé sur `en` :
 * une clé manquante est une erreur de compilation, pas une chaîne anglaise
 * oubliée dans la page française.
 *
 * L'offre décrite ici suit aidd_docs/tasks/2026_08/2026_08_06_offre-commerciale.
 * Un prix ne se change pas ici seul : il vit aussi dans le JSON-LD de
 * landing.html, dans le calcul de `CostCompare` et dans la carte sociale
 * (`pnpm exec node scripts/og-card.mjs`).
 */
const en = {
  meta: {
    title: 'ScreenForge — App Store screenshots, pixel-exact',
    description:
      'Editor for iPhone App Store screenshot sets. Pixel-exact exports rendered on your own machine, one ZIP ready for App Store Connect. $49 once, not a subscription.',
  },
  nav: {
    features: 'The editor',
    pricing: 'Pricing',
    faq: 'FAQ',
    cta: 'Open the editor',
    langSwitchLabel: 'Language',
    navLabel: 'Main',
    menuLabel: 'Menu',
    skipToContent: 'Skip to content',
  },
  hero: {
    headline: 'App Store screenshots, down to the pixel.',
    sub: 'Compose up to ten iPhone screens, export pixel-exact PNGs rendered on your own machine, and upload one ZIP that App Store Connect accepts. One purchase, $49, and the licence is yours.',
    ctaPrimary: 'Open the editor for free',
    ctaSecondary: 'See pricing',
  },
  demo: {
    frame: 'iPhone frame',
    text: 'Text',
    export: 'Export',
    apply: 'All screens',
    hint: 'Take over',
    replay: 'Replay the demo',
    toastFile: 'screenshots.zip',
    exporting: 'Rendering the set…',
    exportSize: 'Export size',
    typography: 'Type',
    position: 'Position',
    frameColor: 'Frame',
    hideLayer: 'hide',
    showLayer: 'show',
    /* Les trois couleurs de l'iPhone 17 Pro et les trois pas de corps, dans
       l'ordre de `demo-script.ts`. Un tableau plutôt que trois clés : c'est
       une liste dont l'ordre porte le sens, et le nom d'une couleur Apple est
       du contenu, pas une étiquette d'interface. */
    frameColors: ['Silver', 'Deep Blue', 'Cosmic Orange'],
    textSizes: ['Small', 'Medium', 'Large'],
    textColors: ['White', 'Ink', 'Sand'],
    typed: 'Track your sleep',
    /* La sous-ligne : aucune planche App Store publiée ne porte un titre seul.
       Elle apparaît quand la frappe se termine, elle ne se tape pas — deux
       curseurs qui écrivent en même temps ne se voient nulle part. */
    typedSub: 'Seven nights at a glance',
    /* Les deux planches voisines. Le plan de travail du produit les montre
       toutes : n'en poser qu'une laissait 88 % de la scène vide et faisait
       lire « dix écrans » comme une promesse sans preuve. Elles portent un
       autre titre et un autre écran d'app, parce que dix planches identiques
       diraient l'inverse de ce que le produit fait. */
    neighbours: [
      { title: 'See every night', sub: 'Deep, light and awake' },
      { title: 'Wake up on time', sub: 'A window, not an alarm' },
    ],
    /* Le libellé de la fausse app dans le cadre. Une app fictive a sa propre
       langue, mais celle-ci vit sous un titre traduit : laisser « Last night »
       sous « Suivez votre sommeil » est exactement le détail qui trahit un
       gabarit. */
    appLabel: 'Last night',
    /* Ni « cliquez » ni « touchez » seuls : la même légende est lue au doigt
       et à la souris. Elle ne répète plus non plus le libellé de la pastille,
       qui disait déjà mot pour mot « cliquez pour prendre la main ». */
    caption:
      'ScreenForge, live. The demo composes a set on its own, and hands over the moment you touch it.',
    /* Servie quand l'utilisateur a demandé moins d'animation : la scène est
       la composition finale, figée. La légende disait qu'une démo se jouait
       devant un plan de travail immobile. */
    captionStill:
      'ScreenForge, on a finished set of ten screens. Touch it and the editor is yours.',
    layers: 'Layers',
    properties: 'Properties',
    background: 'Background',
    bgLayer: 'Background',
  },
  proof: {
    title: 'App Store screenshots break in three places.',
    body: 'A set drifts, an export scales, a file misses Apple’s rules. ScreenForge keeps the whole path under one exact system.',
    label: 'Export specification',
    items: [
      {
        value: '1320×2868',
        label: 'Pixel-exact at 6.9″, and Apple scales it to every smaller size',
      },
      { value: 'PNG-24', label: 'Opaque, sRGB, within App Store size limits' },
      { value: '10 screens', label: 'One set: every change applies to all ten at once' },
    ],
  },
  showcase: {
    title: 'One editor that ships all ten.',
    body: 'Compose the set once. ScreenForge keeps every screen aligned, renders at native size, and hands you the ZIP.',
  },
  features: {
    heading: 'Everything your screenshot set needs to ship.',
    editor: {
      tab: 'Compose',
      title: 'A real editor, not a form',
      body: 'Layers, accurate iPhone frames, gradients, Google Fonts on demand. Design one screen, then push it to the other nine. Background, type, frame and position travel together.',
      points: [
        'Accurate iPhone frames, every current model',
        'Apply a change to all ten screens at once',
        'Google Fonts loaded on demand',
        'Undo, keyboard shortcuts, a command palette',
      ],
      diagramLabel: 'One screen, applied to ten',
      artAlt: 'Ten colorful App Store screens form one coordinated set around the selected screen.',
      diagramSource: 'Source',
      diagramTargets: 'Nine more, updated',
      diagramCarries: 'background · type · frame · position',
    },
    precision: {
      tab: 'Precision',
      title: 'Pixel-exact by construction',
      body: 'The canvas, preview and export share one coordinate system. ScreenForge renders directly at Apple’s target size instead of stretching a smaller image after the fact.',
      points: [
        '1320×2868 rendered natively',
        'One coordinate system from canvas to PNG',
        'Opaque PNG-24 in sRGB',
        'Dimensions checked before download',
      ],
      artAlt: 'Ten screens orbit a lime pixel forge representing one exact coordinate system.',
    },
    export: {
      tab: 'Export',
      title: 'Exports that pass review',
      body: 'Rendered at native 1320×2868 on your machine, never upscaled. App Store Connect derives every smaller iPhone size from this one set.',
      points: [
        'Native 6.9″ resolution, portrait or landscape',
        'PNG-24, sRGB, within the size limits',
        'One ZIP, grouped by dimension',
      ],
      zipLabel: 'What lands in your Downloads folder',
      artAlt: 'Ten screen panels pass through a pixel forge and become one exact export archive.',
      zipName: 'screenshots.zip',
      /* Les noms suivent `lib/zip.ts` : {dimension}/{NN}_{nom}.png. Ils sont
         traduits parce qu'un nom de fichier est du contenu utilisateur — une
         arborescence en français sur la page anglaise redirait exactement le
         défaut que ce bloc a remplacé. */
      zipFiles: ['01_home.png', '02_tracking.png', '03_stats.png', '04_settings.png'],
      zipMore: 'up to six more screens',
      specRows: [
        { key: 'Dimensions', value: '1320 × 2868 px' },
        { key: 'Format', value: 'PNG-24, 8-bit RGBA' },
        { key: 'Color space', value: 'sRGB' },
        { key: 'Scaling', value: 'None, rendered at target size' },
        { key: 'Rendered by', value: 'Your browser' },
      ],
    },
  },
  /* Plus de titre ni de chapô : ce bloc n'est plus une section mais une
     démonstration à l'intérieur des tarifs, dont le titre porte déjà
     l'argument. */
  ownership: {
    tableLabel: 'Total paid after',
    rentLabel: 'A $99/year subscription',
    ownLabel: 'ScreenForge licence',
    rows: [
      { year: 'Year 1', rent: '$99', own: '$49' },
      { year: 'Year 2', rent: '$198', own: '$49' },
      { year: 'Year 3', rent: '$297', own: '$49' },
    ],
    footnote: 'AppScreens Pro list price, checked on 6 August 2026: $99/year.',
  },
  pricing: {
    title: 'Pay once. That’s the whole model.',
    sub: 'The editor runs on your machine. It costs nothing to serve, so you buy it once. Only the cloud, which does cost something every month, is billed yearly.',
    currencyNote: 'Prices in USD, tax included.',
    availability:
      'The paid plans open together with accounts. Until then their buttons add you to the list. Nothing is charged.',
    availabilityShort: 'Not open yet',
    storageLabel: 'Where your projects live',
    storageLocal: 'On your machine',
    storageCloud: 'On your machine, mirrored to the cloud',
    plans: {
      free: {
        name: 'Free',
        price: '$0',
        period: '',
        tagline: 'Judge the editor before paying anything',
        points: [
          'The complete editor, every frame and font',
          '3 exports per project, watermarked',
          'No account, nothing to install',
        ],
        cta: 'Open the editor',
        available: true,
      },
      licence: {
        name: 'Licence',
        price: '$49',
        period: 'once',
        tagline: 'The whole editor, yours, updates included',
        points: [
          'Unlimited exports, no watermark',
          'Grouped ZIP, one file per set',
          'Updates forever, nothing to renew',
        ],
        badge: 'Recommended',
        cta: 'Get notified at launch',
        available: false,
      },
      cloud: {
        name: 'Cloud',
        price: '+$39',
        period: '/year',
        tagline: 'Add-on to the Licence: your projects on every machine',
        points: [
          'Everything the Licence gives you',
          'Pick a project up on another machine',
          '30-day history, outside your browser',
        ],
        /* Le « + » et la ligne « complément » ne suffisaient pas : lu en
           colonne, le Cloud avait plus de cases « inclus » que la Licence à
           dix dollars de moins, et se lisait comme une alternative. Le total
           réel de la première année règle la question sur la carte même. */
        note: '$88 the first year with the Licence, then $39 a year.',
        cta: 'Get notified at launch',
        available: false,
      },
    },
    compareLabel: 'Detailed comparison',
    compareHint: 'scroll sideways',
    compareNote:
      'The Free column is shown as it will be once accounts open. Today the editor has no cap, no watermark, and the grouped ZIP export.',
    rows: [
      {
        label: 'Exports',
        values: ['3 per project, watermarked', 'Unlimited, clean', 'Unlimited, clean'],
      },
      { label: 'Grouped ZIP export', values: ['No', 'Included', 'Included'] },
      {
        label: 'Projects stored',
        values: ['On your machine', 'On your machine', 'Machine + cloud'],
      },
      { label: 'Pick up on another machine', values: ['No', 'No', 'Included'] },
      { label: 'Backup outside the browser', values: ['No', 'No', '30-day history'] },
      { label: 'Account', values: ['Not needed', 'Required', 'Required'] },
      { label: 'Updates', values: ['Included', 'Included, forever', 'Included, forever'] },
    ],
  },
  marquee: [
    '1320×2868 px',
    'PNG-24 · sRGB',
    '10 screens per set',
    'Grouped ZIP export',
    '$49 once',
  ],
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'What does the free tier include?',
        a: 'Today, everything: the complete editor, every frame, every font, every background, unlimited clean exports, and no account. The three-export cap and the watermark arrive with accounts, at the same time as the paid plans. Until then the free tier is the whole product.',
      },
      {
        q: 'Is the editor in English?',
        a: 'Not yet. The marketing pages are bilingual, the editor interface is currently French only. English is coming before the paid plans open. Nothing about the exported PNGs depends on it.',
      },
      {
        q: 'Why one price instead of a subscription?',
        a: 'Because the editor runs entirely in your browser: rendering a set costs us nothing, whether you export once a year or forty times a week. Charging rent for that would be charging for nothing. Only the cloud consumes a server every month, so only the cloud is billed every year.',
      },
      {
        q: 'Where are my projects stored?',
        a: 'In your browser, in IndexedDB, on the machine you are using. Nothing is uploaded and nothing needs an account. The Cloud add-on mirrors them to a server so a second machine can pick a project up. The local copy always stays the one you work on.',
      },
      {
        q: 'What happens if I stop paying for Cloud?',
        a: 'Your projects come back down to local storage and stay editable and exportable, because the Licence you bought does not expire. You only lose the mirror and the multi-machine pickup.',
      },
      {
        q: 'Which dimensions does it export?',
        a: 'Native 6.9″ (1320×2868), portrait or landscape, the largest size App Store Connect accepts. Apple derives every smaller iPhone size from it, so one set covers every iPhone.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Yes, once the Licence opens: email us within 14 days of purchase for a full refund, no questions. The free tier exists so you can decide before spending anything.',
      },
    ],
  },
  finalCta: {
    headline: 'Your next screenshot set, ten minutes from now.',
    body: 'No account, no upload, no card. The editor opens on an empty artboard.',
    cta: 'Open the editor for free',
    ctaLicence: 'Tell me when the Licence opens',
  },
  footer: {
    contact: 'Contact',
    copyright: '© 2026 ScreenForge',
    builtBy: 'A tool built for shipping one app, opened up for everyone shipping theirs.',
  },
}

export type Copy = typeof en

const fr: Copy = {
  meta: {
    title: 'ScreenForge — des captures App Store au pixel près',
    description:
      'Éditeur de planches de captures App Store iPhone. Exports au pixel près rendus sur votre machine, un ZIP prêt pour App Store Connect. 49 $ une fois, pas un abonnement.',
  },
  nav: {
    features: 'L’éditeur',
    pricing: 'Tarifs',
    faq: 'FAQ',
    cta: 'Ouvrir l’éditeur',
    langSwitchLabel: 'Langue',
    navLabel: 'Principal',
    menuLabel: 'Menu',
    skipToContent: 'Aller au contenu',
  },
  hero: {
    headline: 'Des captures App Store, au pixel près.',
    sub: 'Composez jusqu’à dix écrans iPhone, exportez des PNG au pixel près rendus sur votre machine, déposez un ZIP qu’App Store Connect accepte. Un achat, 49 $, et la licence est à vous.',
    ctaPrimary: 'Ouvrir l’éditeur gratuitement',
    ctaSecondary: 'Voir les tarifs',
  },
  demo: {
    frame: 'Cadre iPhone',
    text: 'Texte',
    export: 'Exporter',
    apply: 'Tous les écrans',
    hint: 'Prendre la main',
    replay: 'Rejouer la démo',
    toastFile: 'screenshots.zip',
    exporting: 'Rendu de la planche…',
    exportSize: 'Taille d’export',
    typography: 'Typographie',
    position: 'Position',
    frameColor: 'Châssis',
    hideLayer: 'masquer',
    showLayer: 'afficher',
    frameColors: ['Argent', 'Bleu profond', 'Orange cosmique'],
    textSizes: ['Petit', 'Moyen', 'Grand'],
    textColors: ['Blanc', 'Encre', 'Sable'],
    typed: 'Suivez votre sommeil',
    typedSub: 'Sept nuits d’un coup d’œil',
    neighbours: [
      { title: 'Voyez chaque nuit', sub: 'Profond, léger, éveillé' },
      { title: 'Réveil à l’heure', sub: 'Une fenêtre, pas une sonnerie' },
    ],
    appLabel: 'Nuit dernière',
    caption:
      'ScreenForge en direct. La démo compose une planche toute seule, et vous passe la main dès que vous y touchez.',
    captionStill:
      'ScreenForge, sur une planche finie de dix écrans. Touchez-y et l’éditeur est à vous.',
    layers: 'Calques',
    properties: 'Propriétés',
    background: 'Arrière-plan',
    bgLayer: 'Arrière-plan',
  },
  proof: {
    title: 'Les captures App Store cassent à trois endroits.',
    body: 'Une planche dérive, un export change d’échelle, un fichier rate les règles Apple. ScreenForge garde tout le parcours dans un seul système exact.',
    label: 'Spécification d’export',
    items: [
      {
        value: '1320×2868',
        label: 'Au pixel près en 6,9″, et Apple le décline sur toutes les tailles inférieures',
      },
      { value: 'PNG-24', label: 'Opaque, sRGB, dans les limites App Store' },
      {
        value: '10 écrans',
        label: 'Une planche : chaque changement s’applique aux dix d’un coup',
      },
    ],
  },
  showcase: {
    title: 'Un seul éditeur pour livrer les dix.',
    body: 'Composez la planche une fois. ScreenForge garde chaque écran aligné, rend à la taille native et vous remet le ZIP.',
  },
  features: {
    heading: 'Tout ce qu’il faut à votre planche pour sortir.',
    editor: {
      tab: 'Composer',
      title: 'Un vrai éditeur, pas un formulaire',
      body: 'Calques, cadres iPhone fidèles, dégradés, Google Fonts à la demande. Dessinez un écran, poussez-le sur les neuf autres. Fond, typographie, cadre et position voyagent ensemble.',
      points: [
        'Cadres iPhone fidèles, tous les modèles courants',
        'Appliquez un changement aux dix écrans d’un coup',
        'Google Fonts chargées à la demande',
        'Annulation, raccourcis clavier, palette de commandes',
      ],
      diagramLabel: 'Un écran, appliqué aux dix',
      artAlt:
        'Dix écrans App Store colorés forment une planche cohérente autour de l’écran sélectionné.',
      diagramSource: 'Source',
      diagramTargets: 'Les neuf autres, mis à jour',
      diagramCarries: 'fond · typographie · cadre · position',
    },
    precision: {
      tab: 'Précision',
      title: 'Exact au pixel, par construction',
      body: 'Le canevas, l’aperçu et l’export partagent un seul repère. ScreenForge rend directement à la taille cible d’Apple au lieu d’étirer une image plus petite après coup.',
      points: [
        '1320×2868 rendus nativement',
        'Un seul repère du canevas au PNG',
        'PNG-24 opaque en sRGB',
        'Dimensions contrôlées avant téléchargement',
      ],
      artAlt:
        'Dix écrans gravitent autour d’une forge de pixels citron représentant un repère exact.',
    },
    export: {
      tab: 'Exporter',
      title: 'Des exports qui passent la validation',
      body: 'Rendus en 1320×2868 natif sur votre machine, jamais mis à l’échelle. App Store Connect dérive toutes les tailles iPhone inférieures de cette seule planche.',
      points: [
        'Résolution native 6,9″, portrait ou paysage',
        'PNG-24, sRGB, dans les limites de poids',
        'Un seul ZIP, groupé par dimension',
      ],
      zipLabel: 'Ce qui arrive dans votre dossier Téléchargements',
      artAlt:
        'Dix écrans traversent une forge de pixels et deviennent une archive d’export exacte.',
      zipName: 'screenshots.zip',
      zipFiles: ['01_accueil.png', '02_suivi.png', '03_statistiques.png', '04_reglages.png'],
      zipMore: 'jusqu’à six écrans de plus',
      specRows: [
        { key: 'Dimensions', value: '1320 × 2868 px' },
        { key: 'Format', value: 'PNG-24, 8 bits RGBA' },
        { key: 'Colorimétrie', value: 'sRGB' },
        { key: 'Échelle', value: 'Aucune, taille cible' },
        { key: 'Rendu par', value: 'Votre navigateur' },
      ],
    },
  },
  ownership: {
    tableLabel: 'Total payé au bout de',
    rentLabel: 'Un abonnement à 99 $/an',
    ownLabel: 'La licence ScreenForge',
    rows: [
      { year: '1 an', rent: '99 $', own: '49 $' },
      { year: '2 ans', rent: '198 $', own: '49 $' },
      { year: '3 ans', rent: '297 $', own: '49 $' },
    ],
    footnote: 'Tarif public AppScreens Pro, relevé le 6 août 2026 : 99 $/an.',
  },
  pricing: {
    title: 'On paie une fois. C’est tout le modèle.',
    sub: 'L’éditeur tourne sur votre machine : il ne coûte rien à servir, vous l’achetez une fois. Seul le cloud, qui coûte quelque chose tous les mois, se paie tous les ans.',
    currencyNote: 'Prix en dollars américains, taxes comprises.',
    availability:
      'Les offres payantes ouvriront en même temps que les comptes. D’ici là leurs boutons vous ajoutent à la liste. Rien n’est débité.',
    availabilityShort: 'Pas encore ouvert',
    storageLabel: 'Où vivent vos projets',
    storageLocal: 'Sur votre machine',
    storageCloud: 'Sur votre machine, recopiés dans le cloud',
    plans: {
      free: {
        name: 'Gratuit',
        price: '0 $',
        period: '',
        tagline: 'Pour juger l’éditeur avant de dépenser un centime',
        points: [
          'L’éditeur complet, tous les cadres et polices',
          '3 exports par projet, filigranés',
          'Sans compte, rien à installer',
        ],
        cta: 'Ouvrir l’éditeur',
        available: true,
      },
      licence: {
        name: 'Licence',
        price: '49 $',
        period: 'une fois',
        tagline: 'Tout l’éditeur, à vous, mises à jour incluses',
        points: [
          'Exports illimités, sans filigrane',
          'ZIP groupé, un fichier par planche',
          'Mises à jour à vie, rien à renouveler',
        ],
        badge: 'Recommandé',
        cta: 'Être prévenu à l’ouverture',
        available: false,
      },
      cloud: {
        name: 'Cloud',
        price: '+39 $',
        period: '/an',
        tagline: 'Complément à la Licence : vos projets sur chaque machine',
        points: [
          'Tout ce que donne la Licence',
          'Reprendre un projet sur une autre machine',
          'Historique 30 jours, hors du navigateur',
        ],
        note: '88 $ la première année avec la Licence, puis 39 $ par an.',
        cta: 'Être prévenu à l’ouverture',
        available: false,
      },
    },
    compareLabel: 'Comparatif détaillé',
    compareHint: 'faites défiler',
    compareNote:
      'La colonne Gratuit est présentée telle qu’elle sera à l’ouverture des comptes. Aujourd’hui l’éditeur n’a ni plafond ni filigrane, et le ZIP groupé y est.',
    rows: [
      {
        label: 'Exports',
        values: [
          '3 par projet, filigranés',
          'Illimités, sans filigrane',
          'Illimités, sans filigrane',
        ],
      },
      { label: 'Export ZIP groupé', values: ['Non', 'Inclus', 'Inclus'] },
      {
        label: 'Projets stockés',
        values: ['Sur votre machine', 'Sur votre machine', 'Machine + cloud'],
      },
      { label: 'Reprise sur une autre machine', values: ['Non', 'Non', 'Incluse'] },
      { label: 'Sauvegarde hors navigateur', values: ['Non', 'Non', 'Historique 30 jours'] },
      { label: 'Compte', values: ['Inutile', 'Requis', 'Requis'] },
      { label: 'Mises à jour', values: ['Incluses', 'Incluses, à vie', 'Incluses, à vie'] },
    ],
  },
  marquee: [
    '1320×2868 px',
    'PNG-24 · sRGB',
    '10 écrans par planche',
    'Export ZIP groupé',
    '49 $ une fois',
  ],
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Que comprend l’offre gratuite ?',
        a: 'Aujourd’hui, tout : l’éditeur complet, tous les cadres, toutes les polices, tous les fonds, les exports illimités et sans filigrane, et aucun compte. Le plafond de trois exports et le filigrane arriveront avec les comptes, en même temps que les offres payantes. D’ici là le gratuit, c’est le produit entier.',
      },
      {
        q: 'L’éditeur est-il en anglais ?',
        a: 'Pas encore. Les pages de présentation sont bilingues, l’interface de l’éditeur est pour l’instant uniquement en français. L’anglais arrivera avant l’ouverture des offres payantes. Les PNG exportés n’en dépendent pas.',
      },
      {
        q: 'Pourquoi un prix unique plutôt qu’un abonnement ?',
        a: 'Parce que l’éditeur tourne entièrement dans votre navigateur : rendre une planche ne nous coûte rien, que vous exportiez une fois par an ou quarante fois par semaine. Louer cela reviendrait à louer du vide. Seul le cloud consomme un serveur tous les mois, donc seul le cloud se facture tous les ans.',
      },
      {
        q: 'Où sont stockés mes projets ?',
        a: 'Dans votre navigateur, en IndexedDB, sur la machine que vous utilisez. Rien n’est téléversé et aucun compte n’est nécessaire. Le complément Cloud les recopie sur un serveur pour qu’une seconde machine puisse reprendre un projet. La copie locale reste toujours celle sur laquelle vous travaillez.',
      },
      {
        q: 'Que se passe-t-il si j’arrête de payer le Cloud ?',
        a: 'Vos projets redescendent en local, restent modifiables et exportables : la Licence que vous avez achetée n’expire pas. Vous perdez seulement la recopie et la reprise multi-machine.',
      },
      {
        q: 'Quelles dimensions sont exportées ?',
        a: 'Le 6,9″ natif (1320×2868), portrait ou paysage, la plus grande taille acceptée par App Store Connect. Apple en dérive toutes les tailles iPhone inférieures : une planche couvre tous les iPhone.',
      },
      {
        q: 'Puis-je être remboursé ?',
        a: 'Oui, dès l’ouverture de la Licence : écrivez-nous dans les 14 jours suivant l’achat pour un remboursement intégral, sans justification. L’offre gratuite existe pour que vous décidiez avant de dépenser.',
      },
    ],
  },
  finalCta: {
    headline: 'Votre prochaine planche, dans dix minutes.',
    body: 'Sans compte, sans téléversement, sans carte. L’éditeur s’ouvre sur une planche vide.',
    cta: 'Ouvrir l’éditeur gratuitement',
    ctaLicence: 'Prévenez-moi à l’ouverture de la Licence',
  },
  footer: {
    contact: 'Contact',
    copyright: '© 2026 ScreenForge',
    builtBy: 'Un outil construit pour sortir une app, ouvert à tous ceux qui sortent la leur.',
  },
}

export const copy = { en, fr } as const
