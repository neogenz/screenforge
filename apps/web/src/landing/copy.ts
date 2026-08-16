/*
 * Source unique de tout le texte de la landing. `fr` est typé sur `en` :
 * une clé manquante est une erreur de compilation, pas une chaîne anglaise
 * oubliée dans la page française.
 *
 * Un prix ne se change pas ici seul : il vit aussi dans le JSON-LD de
 * landing.html et dans la carte sociale (`pnpm exec node scripts/og-card.mjs`).
 */
const en = {
  meta: {
    title: 'ScreenForge — App Store screenshots, pixel-exact',
    description:
      'Free local editor for pixel-exact iPhone App Store screenshots. Cloud is $39/year for account, sync, projects, images, settings and managed backups.',
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
    sub: 'Compose up to ten iPhone screens and export unlimited clean PNGs or one ZIP on your machine. Local is free; Cloud adds account, sync and managed storage.',
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
  pricing: {
    title: 'Local or Cloud.',
    sub: 'Use the complete editor free on this machine, or add Cloud yearly for an account, sync, managed storage and backups.',
    currencyNote: 'Cloud price in USD, tax included.',
    availability:
      'Local works immediately without an account. Cloud starts from the editor and requires an active server-side entitlement.',
    availabilityShort: 'Available',
    storageLabel: 'Where your projects live',
    storageLocal: 'On your machine',
    storageCloud: 'On your machine, mirrored to the cloud',
    plans: {
      local: {
        name: 'Local',
        price: '$0',
        period: 'forever',
        tagline: 'The complete editor on your machine, without an account',
        points: [
          'Unlimited exports, no watermark',
          'Grouped ZIP, one file per set',
          'Projects and images stay local',
        ],
        badge: 'Free',
        cta: 'Open the editor',
        available: true,
      },
      cloud: {
        name: 'Cloud',
        price: '$39',
        period: '/year',
        tagline: 'The complete editor and your work on every machine',
        points: [
          'Everything in Local',
          'Projects, images and settings synced',
          'Managed storage and backups',
        ],
        note: 'Account and active Cloud entitlement required.',
        cta: 'Choose Cloud',
        available: true,
      },
    },
    compareLabel: 'Detailed comparison',
    compareHint: 'scroll sideways',
    compareNote:
      'Client changes cannot grant Cloud access: every cloud write is checked by the server.',
    rows: [
      {
        label: 'Exports',
        values: ['Unlimited, clean', 'Unlimited, clean'],
      },
      {
        label: 'Grouped ZIP export',
        values: ['Included', 'Included'],
      },
      {
        label: 'Projects stored',
        values: ['On your machine', 'Machine + cloud'],
      },
      { label: 'Pick up on another machine', values: ['No', 'Included'] },
      { label: 'Backup outside the browser', values: ['No', 'Included'] },
      { label: 'Account', values: ['Not required', 'Required'] },
      { label: 'Managed backups', values: ['No', 'Included'] },
    ],
    localNote: 'Local has no export cap, watermark, paywall or entitlement check.',
  },
  marquee: [
    '1320×2868 px',
    'PNG-24 · sRGB',
    '10 screens per set',
    'Grouped ZIP export',
    'Local · free',
  ],
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Is Local really free?',
        a: 'Yes. Local includes the complete editor, unlimited clean exports and grouped ZIPs. It works without an account, a connection to Convex or an entitlement.',
      },
      {
        q: 'Is the editor in English?',
        a: 'Not yet. The marketing pages are bilingual and the editor interface is currently French only. English is planned; exported PNGs do not depend on the interface language.',
      },
      {
        q: 'Why is only Cloud billed yearly?',
        a: 'Local rendering and exports run on your machine. Cloud continuously operates accounts, synchronization, storage and backups, so only that managed service is billed yearly.',
      },
      {
        q: 'Where are my projects stored?',
        a: 'With Local, projects stay in IndexedDB on the machine you are using. Cloud also stores the project, its source images and your theme in Convex so another machine can pick it up. The local copy always stays the one you work on.',
      },
      {
        q: 'What happens if I stop paying for Cloud?',
        a: 'Copies already present on your machines stay local and editable. Your cloud data remains readable and deletable, but new sync stops. Local clean exports and ZIPs remain free.',
      },
      {
        q: 'Which dimensions does it export?',
        a: 'Native 6.9″ (1320×2868), portrait or landscape, the largest size App Store Connect accepts. Apple derives every smaller iPhone size from it, so one set covers every iPhone.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Cloud refund conditions are shown before checkout and in the billing portal. Contact us if you need help with a purchase.',
      },
    ],
  },
  finalCta: {
    headline: 'Your next screenshot set, ten minutes from now.',
    body: 'No account, no upload, no card. The editor opens on an empty artboard.',
    cta: 'Open the editor for free',
    ctaCloud: 'Choose Cloud',
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
      'Éditeur local gratuit de captures App Store iPhone. Cloud coûte 39 $/an pour le compte, la synchronisation, les projets, images, réglages et sauvegardes managées.',
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
    sub: 'Composez jusqu’à dix écrans iPhone et exportez des PNG propres illimités ou un ZIP sur votre machine. Local est gratuit ; Cloud ajoute compte, synchronisation et stockage managé.',
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
  pricing: {
    title: 'Local ou Cloud.',
    sub: 'Utilisez gratuitement l’éditeur complet sur cette machine, ou ajoutez Cloud chaque année pour le compte, la synchronisation, le stockage et les sauvegardes managés.',
    currencyNote: 'Prix Cloud en dollars américains, taxes comprises.',
    availability:
      'Local fonctionne immédiatement sans compte. Cloud démarre dans l’éditeur et exige un droit serveur actif.',
    availabilityShort: 'Disponible',
    storageLabel: 'Où vivent vos projets',
    storageLocal: 'Sur votre machine',
    storageCloud: 'Sur votre machine, recopiés dans le cloud',
    plans: {
      local: {
        name: 'Local',
        price: '0 $',
        period: 'pour toujours',
        tagline: 'Tout l’éditeur sur votre machine, sans compte',
        points: [
          'Exports illimités, sans filigrane',
          'ZIP groupé, un fichier par planche',
          'Projets et images conservés localement',
        ],
        badge: 'Gratuit',
        cta: 'Ouvrir l’éditeur',
        available: true,
      },
      cloud: {
        name: 'Cloud',
        price: '39 $',
        period: '/an',
        tagline: 'L’éditeur complet et votre travail sur chaque machine',
        points: [
          'Tout ce qui est inclus dans Local',
          'Projets, images et réglages synchronisés',
          'Stockage et sauvegardes managés',
        ],
        note: 'Compte et droit Cloud actif requis.',
        cta: 'Choisir Cloud',
        available: true,
      },
    },
    compareLabel: 'Comparatif détaillé',
    compareHint: 'faites défiler',
    compareNote:
      'Une modification du client ne donne aucun accès Cloud : chaque write est vérifié par le serveur.',
    rows: [
      {
        label: 'Exports',
        values: ['Illimités, sans filigrane', 'Illimités, sans filigrane'],
      },
      {
        label: 'Export ZIP groupé',
        values: ['Inclus', 'Inclus'],
      },
      {
        label: 'Projets stockés',
        values: ['Sur votre machine', 'Machine + cloud'],
      },
      { label: 'Reprise sur une autre machine', values: ['Non', 'Incluse'] },
      { label: 'Sauvegarde hors navigateur', values: ['Non', 'Incluse'] },
      { label: 'Compte', values: ['Non requis', 'Requis'] },
      { label: 'Sauvegardes managées', values: ['Non', 'Incluses'] },
    ],
    localNote: 'Local n’a ni plafond d’export, ni filigrane, ni paywall, ni contrôle de droit.',
  },
  marquee: [
    '1320×2868 px',
    'PNG-24 · sRGB',
    '10 écrans par planche',
    'Export ZIP groupé',
    'Local · gratuit',
  ],
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Local est-il vraiment gratuit ?',
        a: 'Oui. Local inclut l’éditeur complet, les exports propres illimités et les ZIP groupés. Il fonctionne sans compte, connexion Convex ou droit commercial.',
      },
      {
        q: 'L’éditeur est-il en anglais ?',
        a: 'Pas encore. Les pages de présentation sont bilingues et l’interface de l’éditeur est uniquement en français. L’anglais est prévu ; les PNG exportés ne dépendent pas de la langue de l’interface.',
      },
      {
        q: 'Pourquoi seul Cloud est-il facturé chaque année ?',
        a: 'Le rendu et les exports Local tournent sur votre machine. Cloud exploite en continu les comptes, la synchronisation, le stockage et les sauvegardes ; seul ce service managé est donc facturé chaque année.',
      },
      {
        q: 'Où sont stockés mes projets ?',
        a: 'Avec Local, les projets restent dans IndexedDB sur la machine utilisée. Cloud stocke aussi le projet, ses images sources et votre thème dans Convex afin qu’une autre machine puisse le reprendre. La copie locale reste toujours celle sur laquelle vous travaillez.',
      },
      {
        q: 'Que se passe-t-il si j’arrête de payer le Cloud ?',
        a: 'Les copies déjà présentes sur vos machines y restent, modifiables. Vos données cloud restent lisibles et supprimables, mais la nouvelle synchronisation s’arrête. Les exports propres et ZIP Local restent gratuits.',
      },
      {
        q: 'Quelles dimensions sont exportées ?',
        a: 'Le 6,9″ natif (1320×2868), portrait ou paysage, la plus grande taille acceptée par App Store Connect. Apple en dérive toutes les tailles iPhone inférieures : une planche couvre tous les iPhone.',
      },
      {
        q: 'Puis-je être remboursé ?',
        a: 'Les conditions de remboursement Cloud sont affichées avant le checkout et dans le portail de facturation. Contactez-nous si vous avez besoin d’aide pour un achat.',
      },
    ],
  },
  finalCta: {
    headline: 'Votre prochaine planche, dans dix minutes.',
    body: 'Sans compte, sans téléversement, sans carte. L’éditeur s’ouvre sur une planche vide.',
    cta: 'Ouvrir l’éditeur gratuitement',
    ctaCloud: 'Choisir Cloud',
  },
  footer: {
    contact: 'Contact',
    copyright: '© 2026 ScreenForge',
    builtBy: 'Un outil construit pour sortir une app, ouvert à tous ceux qui sortent la leur.',
  },
}

export const copy = { en, fr } as const
