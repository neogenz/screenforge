import { CLOUD_OFFER, cloudOfferSummary } from '@screenforge/project-format'
import { PRIVACY_COPY } from '@/components/privacy/privacy-copy'

const CLOUD_PRICE = `$${CLOUD_OFFER.price.amount}`
const CLOUD_LIMITS_EN = cloudOfferSummary('en')
const CLOUD_LIMITS_FR = cloudOfferSummary('fr')

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
      'Compose your iPhone App Store screenshot set once, export pixel-exact PNGs at 1320×2868, refresh in one click. Free, local, no account. Cloud sync optional, $39/year.',
  },
  nav: {
    features: 'The editor',
    agent: 'AI',
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
    sub: 'For people who ship iPhone apps: compose the set once in your browser, export at Apple’s exact sizes, re-shoot in one click at every release. Or tell Claude Code or Codex what the app does and let it compose all ten. Free, no account, local by default.',
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
    /* Le nom du projet ouvert, à gauche de la barre — c'est ce que l'éditeur
       y écrit, et ce qui fait lire la maquette comme un fichier ouvert. */
    projectName: 'Sleep tracker',
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
    body: 'The set drifts while you tweak screen four. The export gets scaled and goes soft. One file misses one of Apple’s rules and the build sits in review. ScreenForge closes all three, by construction.',
    label: 'Three breaks, closed',
    items: [
      { value: '10 screens', label: 'One change lands on all ten. The set cannot drift.' },
      {
        value: '1320×2868',
        label: 'Rendered at native size, never scaled. Apple gets the pixels you drew.',
      },
      {
        value: 'PNG-24',
        label: 'Opaque, sRGB, under the size cap. Nothing left for review to reject.',
      },
    ],
  },
  showcase: {
    /* Titre hors écran : la section n'a plus d'en-tête visible, la démo
       arrive collée au hero, mais le plan du document garde sa rubrique. */
    title: 'One editor that ships all ten.',
  },
  features: {
    heading: 'Compose once. Refresh at every release. Export to the pixel.',
    editor: {
      tab: 'Compose',
      title: 'A real editor, not a form',
      body: 'Layers, accurate iPhone frames, gradients, Google Fonts on demand. Design one screen, then push it to the other nine. Background, type, frame and position travel together.',
      points: [
        'Every current iPhone frame, in Apple’s own colours',
        'Change one screen, the other nine follow',
        'Any Google Font, loaded the moment you pick it',
        'Undo everything, keyboard first, ⌘K for the rest',
      ],
      diagramLabel: 'One screen, applied to ten',
      diagramSource: 'Source',
      diagramTargets: 'Nine more, updated',
      diagramCarries: 'background · type · frame · position',
    },
    refresh: {
      tab: 'Refresh',
      title: 'New build, new screenshots, same set',
      body: 'Ship a version, re-shoot the app, drop the folder on ScreenForge. Each capture lands on its device, and the layout, headlines, backgrounds and frames stay exactly where you put them. Ten screens updated in one step, one undo if you change your mind.',
      points: [
        'Files matched to devices by name, corrected by hand where needed',
        'Layout, type and frames untouched',
        'Preview first, then written all at once, or not at all',
        'Also from an agent: one MCP call for the whole folder',
      ],
      figureFolder: 'screenshots/',
      figureFiles: ['home.png', 'tracking.png', 'stats.png', 'settings.png'],
      figureTarget: 'device',
      figureMore: 'six more',
      figureResult: '10 devices refilled, one write, one undo',
      figureLabel: 'One folder in, the layout stays where you left it',
    },
    export: {
      tab: 'Export',
      title: 'Exports that pass review',
      body: 'Rendered at native 1320×2868 on your machine, never upscaled. App Store Connect derives every smaller iPhone size from this one set.',
      points: [
        'Native 6.9″ resolution, portrait or landscape',
        'PNG-24, sRGB, within the size limits',
        'One ZIP, grouped by dimension',
        'Dimensions checked before download',
      ],
      zipLabel: 'What lands in your Downloads folder',
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
  agent: {
    heading: 'Let Claude Code or Codex compose it.',
    sub: 'Give your agent the app’s URL and a folder of screenshots: it writes the headlines, lays out the ten screens in the editor you have open, and checks its own render. Everything it does is a layer, one ⌘Z away.',
    ways: [
      {
        title: 'From your terminal, over MCP',
        body: 'Claude Code, Codex, opencode or Claude Desktop, on the login you already have. A closed vocabulary: it can compose and refresh, not corrupt your project.',
      },
      {
        title: 'From the editor, with a brief',
        body: 'Name, one sentence, your URL, your screenshots. Headlines by Claude Code on your machine, or by an Anthropic or OpenRouter key, encrypted at rest on this computer.',
      },
      {
        title: 'Without any AI',
        body: 'The default: a local builder lays out the ten screens from your screenshots, you write the words. No request, no account.',
      },
    ],
    setupTitle: 'Connect an agent',
    setupSteps: [
      'Clone the repo, run pnpm --filter mcp run start',
      'Add it as a stdio server to your agent (Claude Code reads the repo’s .mcp.json)',
      'Turn on “Connexion MCP” in the editor’s top bar',
    ],
    setupNote: 'Ships in the repository for now, not on npm.',
    /* Une session dessinée, pas enregistrée : les noms d’outils sont ceux
       que `apps/mcp` expose réellement, les notes sont ce que chacun rend. */
    sessionPrompt: 'Compose the App Store set for https://sleeptracker.app, screenshots in ~/shots',
    sessionSteps: [
      ['screenforge_get_project_state', '1 empty screen'],
      ['screenforge_declare_plan', '10 screens, 10 headlines'],
      ['screenforge_apply', '49 calls, one write, one undo'],
      ['screenforge_get_thumbnail', 'screen 1, rendered'],
    ],
    sessionDone: '10 screens composed. Everything is a layer: ⌘Z undoes it.',
    sessionLabel: 'Tool names as the server exposes them, in the editor you have open',
  },
  pricing: {
    title: 'Free on your machine. Cloud if you work on two.',
    sub: 'Screenshot tools usually charge by the month. Here the complete editor is free on this machine, for good. Cloud is for people who work from more than one: account, sync, managed storage and backups, $39 a year, about $3 a month.',
    currencyNote: 'Cloud price in USD. Applicable taxes are shown at checkout.',
    availability: 'Local works right now, no account. Cloud is turned on from inside the editor.',
    availabilityShort: 'Available',
    storageLabel: 'Where your projects live',
    storageLocal: 'On your machine',
    storageCloud: 'On your machine, mirrored to the cloud',
    plans: {
      local: {
        name: 'Local',
        price: '$0',
        period: 'forever',
        tagline: 'The complete editor, on your machine, no account',
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
        price: CLOUD_PRICE,
        period: '/year',
        tagline: 'Your projects on every machine you work from',
        points: [
          'Everything in Local',
          'Projects, images and settings synced',
          'Managed storage and backups',
          CLOUD_LIMITS_EN,
        ],
        note: 'Needs an account. If you stop, your local copies stay yours.',
        cta: 'Choose Cloud',
        available: true,
      },
    },
    compareLabel: 'Detailed comparison',
    compareHint: 'scroll sideways',
    compareNote: 'Cloud never holds the only copy: the local one is always the one you edit.',
    rows: [
      { label: 'Exports', values: ['Unlimited, clean', 'Unlimited, clean'] },
      { label: 'Projects stored', values: ['On your machine', 'Machine + cloud'] },
      { label: 'Pick up on another machine', values: ['No', 'Included'] },
      { label: 'Backups outside the browser', values: ['No', 'Included'] },
      { label: 'Account', values: ['Not required', 'Required'] },
    ],
    localNote: 'Local has no export cap, no watermark and no paywall. It is not a trial.',
  },
  marquee: [
    '1320×2868 px',
    'PNG-24 · sRGB',
    '10 screens per set',
    'Batch refresh',
    'MCP · Claude Code · Codex',
    'Local · free',
    'Open source',
  ],
  faq: {
    /* Ordonnée par objection d'achat, pas par thème : gratuit ? ça passe la
       revue ? ça sort de ma machine ? quels iPhone ? mes captures ? pourquoi
       pas Figma ? — puis le reste. La langue de l'éditeur ferme la liste :
       vraie, à dire, mais pas en deuxième position sur la page anglaise. */
    title: 'Questions',
    items: [
      {
        q: 'Is Local really free?',
        a: 'Yes. Local is the complete editor: unlimited clean exports, grouped ZIPs, every iPhone frame, no account, no trial clock, no watermark. Cloud is optional and only adds sync, storage and backups.',
      },
      {
        q: 'Will the exports pass App Store Connect?',
        a: 'Yes, on everything a file can be rejected for: 1320×2868, opaque PNG, sRGB, under the size limit, all checked before download. Apple derives every smaller iPhone size from that one set. Your content is Apple’s review, not the file’s.',
      },
      {
        q: 'What are the Cloud storage limits?',
        a: `${CLOUD_LIMITS_EN}. When a limit is reached, new Cloud writes pause until you clear space. Local editing and unlimited exports keep working.`,
      },
      {
        q: 'Do my screenshots leave my machine?',
        a: 'Not unless you ask. Local keeps projects and images in your browser and renders in the tab; there is no upload step. Cloud mirrors a project only once you turn it on, the assistant only ever receives text, and the MCP server runs on your own machine.',
      },
      {
        q: 'Can an AI agent compose the set? Which ones?',
        a: 'Yes. The MCP server in the repo runs on your machine and lets Claude Code, Codex, opencode or Claude Desktop compose in the editor you have open, screenshots included, with a rendered PNG of each screen to check its work. Its vocabulary is closed: it can compose, not corrupt your project.',
      },
      {
        q: 'How do I connect Claude Code or Codex?',
        a: 'Clone the repo, run pnpm --filter mcp run start, add it as a stdio server to your agent (Claude Code reads the repo’s .mcp.json), then turn on “Connexion MCP” in the editor’s top bar. Not on npm yet.',
      },
      {
        q: 'Do I need an API key? Can I use OpenRouter?',
        a: 'No key is needed: the default generator is a local builder, and an agent over MCP uses your existing login. To have a model write the headlines from inside the editor, use Claude Code on your machine, an Anthropic key, or an OpenRouter key with the model you pick. Keys are encrypted at rest on this computer.',
      },
      {
        q: 'Which iPhones can I frame?',
        a: 'Every current model, from iPhone 16e to iPhone 17 Pro Max, iPhone Air included, in Apple’s own colours. Frames are vector, so they stay sharp at 1320×2868.',
      },
      {
        q: 'Can I use my own screenshots?',
        a: 'That is the point. Drop a capture on a device frame, or drop a whole folder to refresh all ten at once: files are matched to devices by name, and the layout, headlines and backgrounds stay exactly where they were.',
      },
      {
        q: 'Why not Figma or a template?',
        a: 'Figma will draw one beautiful screenshot. It will not keep ten of them at Apple’s exact size, re-render them at every release, or check the file rules before you upload. A template gives you one style and no refresh. ScreenForge is the editor and the export pipeline in one place, and the editor is free.',
      },
      {
        q: 'Is it open source? What if the project stops?',
        a: 'Yes, the whole editor is AGPL-3.0 on GitHub. Your projects live on your machine and export to plain PNG, so if ScreenForge stopped tomorrow you would keep the code, the files and the ZIPs. Nothing here depends on a server staying up.',
      },
      {
        q: 'Which dimensions does it export?',
        a: 'Native 6.9″ (1320×2868), portrait or landscape, the largest size App Store Connect accepts. Apple derives every smaller iPhone size from it, so one set covers every iPhone.',
      },
      {
        q: 'Where are my projects stored?',
        a: 'With Local, projects stay in IndexedDB on the machine you are using. Cloud also stores the project, its source images and your theme in Convex so another machine can pick it up. The local copy always stays the one you work on.',
      },
      {
        q: 'What does Cloud add, and what if I stop paying?',
        a: 'Cloud adds an account, sync between machines, managed storage and backups, for $39 a year. If you stop, the copies already on your machines stay local and editable; your cloud data remains readable and deletable, but new sync stops. Local exports stay free.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Cloud refund conditions are shown before checkout and in the billing portal.',
      },
      {
        q: 'Is the editor in English?',
        a: 'Not yet. The marketing pages are bilingual and the editor interface is currently French only. English is planned; exported PNGs do not depend on the interface language.',
      },
    ],
  },
  finalCta: {
    headline: 'Your next screenshot set, ten minutes from now.',
    body: 'No account, no upload, no card. The editor opens on an empty artboard.',
    cta: 'Open the editor for free',
    ctaCloud: 'Choose Cloud',
    /* La ligne du fondateur, remontée du pied de page : sur une page sans
       témoignage, « construit pour sortir une app » et le lien vers la source
       sont la preuve. Personne ne lit un pied de page. */
    founder:
      'I built ScreenForge to ship my own app, then opened it under AGPL for everyone shipping theirs.',
    source: 'Read the source on GitHub',
  },
  footer: {
    source: 'Source',
    privacy: 'Privacy',
    terms: 'Terms',
    preferences: 'Privacy settings',
    copyright: '© 2026 ScreenForge',
  },
  privacy: PRIVACY_COPY.en,
}

export type Copy = typeof en

const fr: Copy = {
  meta: {
    title: 'ScreenForge — des captures App Store au pixel près',
    description:
      'Composez vos captures App Store iPhone une fois, exportez des PNG exacts en 1320×2868, mettez-les à jour en un clic. Gratuit, local, sans compte. Cloud en option, 39 $/an.',
  },
  nav: {
    features: 'L’éditeur',
    agent: 'IA',
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
    sub: 'Pour ceux qui sortent des apps iPhone : composez vos dix captures une fois dans le navigateur, exportez-les aux tailles exactes d’Apple, remplacez-les en un clic à chaque version. Ou dites à Claude Code ou Codex ce que fait l’app, et laissez-le composer les dix. Gratuit, sans compte, tout reste sur votre machine.',
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
    exporting: 'Rendu en cours…',
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
    typedSub: 'Sept nuits en un coup d’œil',
    neighbours: [
      { title: 'Voyez chaque nuit', sub: 'Profond, léger, éveillé' },
      { title: 'Réveil à l’heure', sub: 'Une fenêtre, pas une sonnerie' },
    ],
    appLabel: 'Cette nuit',
    projectName: 'Suivi du sommeil',
    caption:
      'ScreenForge en direct. La démo compose dix captures toute seule et vous passe la main dès que vous y touchez.',
    captionStill:
      'ScreenForge, sur une série de dix écrans terminée. Touchez-y et l’éditeur est à vous.',
    layers: 'Calques',
    properties: 'Propriétés',
    background: 'Arrière-plan',
    bgLayer: 'Arrière-plan',
  },
  proof: {
    title: 'Les captures App Store, ça casse à trois endroits.',
    body: 'La série se décale pendant que vous retouchez le quatrième écran. L’export est redimensionné et devient flou. Un fichier enfreint une règle d’Apple et le build reste bloqué en validation. ScreenForge règle les trois, par construction.',
    label: 'Trois problèmes, réglés',
    items: [
      {
        value: '10 écrans',
        label: 'Un changement s’applique aux dix. La série ne peut plus se décaler.',
      },
      {
        value: '1320×2868',
        label:
          'Rendu à la taille native, jamais redimensionné. Apple reçoit les pixels que vous avez dessinés.',
      },
      {
        value: 'PNG-24',
        label:
          'Opaque, sRGB, sous la limite de poids. Plus rien qu’App Store Connect puisse refuser.',
      },
    ],
  },
  showcase: {
    title: 'Un seul éditeur pour les dix écrans.',
  },
  features: {
    heading: 'Composez une fois. Actualisez à chaque version. Exportez au pixel près.',
    editor: {
      tab: 'Composer',
      title: 'Un vrai éditeur, pas un formulaire',
      body: 'Calques, cadres iPhone fidèles, dégradés, Google Fonts à la demande. Dessinez un écran, appliquez-le aux neuf autres : le fond, la typo, le cadre et la position passent d’un coup.',
      points: [
        'Tous les cadres iPhone courants, dans les coloris d’Apple',
        'Changez un écran, les neuf autres suivent',
        'N’importe quelle Google Font, chargée dès que vous la choisissez',
        'Tout s’annule, raccourcis clavier partout, ⌘K pour le reste',
      ],
      diagramLabel: 'Un écran, appliqué aux dix',
      diagramSource: 'Source',
      diagramTargets: 'Les neuf autres, mis à jour',
      diagramCarries: 'fond · typographie · cadre · position',
    },
    refresh: {
      tab: 'Actualiser',
      title: 'Nouvelle version, nouvelles captures, rien à recomposer',
      body: 'Vous sortez une version, vous refaites vos captures, vous glissez le dossier dans ScreenForge. Chaque capture retrouve son appareil ; la mise en page, les accroches, les fonds et les cadres ne bougent pas. Les dix écrans se mettent à jour d’un coup, et un ⌘Z suffit si vous changez d’avis.',
      points: [
        'Chaque fichier va sur l’appareil qui porte son nom, à corriger à la main au besoin',
        'Mise en page, typographie et cadres intacts',
        'Vous voyez le résultat avant, puis tout s’écrit d’un coup, ou rien',
        'Marche aussi depuis un agent : un appel MCP pour tout le dossier',
      ],
      figureFolder: 'captures/',
      figureFiles: ['accueil.png', 'suivi.png', 'statistiques.png', 'reglages.png'],
      figureTarget: 'appareil',
      figureMore: 'six de plus',
      figureResult: '10 appareils mis à jour d’un coup, un seul ⌘Z pour tout défaire',
      figureLabel: 'Vous donnez un dossier, la mise en page ne bouge pas',
    },
    export: {
      tab: 'Exporter',
      title: 'Des exports qui passent la validation',
      body: 'Rendus en 1320×2868 natif sur votre machine, jamais redimensionnés. App Store Connect en dérive lui-même toutes les tailles iPhone plus petites.',
      points: [
        'Résolution native 6,9″, portrait ou paysage',
        'PNG-24, sRGB, dans les limites de poids',
        'Un seul ZIP, groupé par dimension',
        'Dimensions contrôlées avant téléchargement',
      ],
      zipLabel: 'Ce qui arrive dans votre dossier Téléchargements',
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
  agent: {
    heading: 'Laissez Claude Code ou Codex composer.',
    sub: 'Donnez à votre agent l’adresse de l’app et un dossier de captures : il écrit les accroches, met en page les dix écrans dans l’éditeur que vous avez ouvert, et vérifie son propre rendu. Tout ce qu’il pose est un calque, à un ⌘Z près.',
    ways: [
      {
        title: 'Depuis votre terminal, par MCP',
        body: 'Claude Code, Codex, opencode ou Claude Desktop, avec le compte que vous avez déjà. Un jeu d’outils fermé : il compose et actualise, il ne peut pas casser votre projet.',
      },
      {
        title: 'Depuis l’éditeur, avec un brief',
        body: 'Le nom, une phrase, votre adresse, vos captures. Les accroches par Claude Code sur votre machine, ou par une clé Anthropic ou OpenRouter, chiffrée sur cet ordinateur.',
      },
      {
        title: 'Sans aucune IA',
        body: 'Le défaut : un générateur local met en page les dix écrans à partir de vos captures, vous écrivez les mots. Aucune requête, aucun compte.',
      },
    ],
    setupTitle: 'Brancher un agent',
    setupSteps: [
      'Clonez le dépôt, lancez pnpm --filter mcp run start',
      'Ajoutez-le comme serveur stdio à votre agent (Claude Code lit le .mcp.json du dépôt)',
      'Activez « Connexion MCP » dans la barre du haut de l’éditeur',
    ],
    setupNote: 'Livré dans le dépôt pour l’instant, pas sur npm.',
    sessionPrompt:
      'Compose mes captures App Store pour https://sleeptracker.app, les captures sont dans ~/captures',
    sessionSteps: [
      ['screenforge_get_project_state', '1 écran vide'],
      ['screenforge_declare_plan', '10 écrans, 10 accroches'],
      ['screenforge_apply', '49 appels, écrits d’un coup, un seul ⌘Z'],
      ['screenforge_get_thumbnail', 'écran 1, rendu'],
    ],
    sessionDone: '10 écrans composés. Ce ne sont que des calques : ⌘Z défait tout.',
    sessionLabel: 'Les vrais noms des outils, dans l’éditeur que vous avez ouvert',
  },
  pricing: {
    title: 'Gratuit sur votre machine. Cloud si vous en avez deux.',
    sub: 'Ce genre d’outil se paie d’habitude à l’abonnement mensuel. Ici, l’éditeur complet est gratuit sur votre machine, pour de bon. Cloud sert à ceux qui travaillent sur plusieurs machines : compte, synchronisation, stockage et sauvegardes hébergés, 39 $ par an, soit à peu près 3 $ par mois.',
    currencyNote:
      'Prix Cloud en dollars américains. Les taxes applicables sont affichées au paiement.',
    availability: 'Local fonctionne tout de suite, sans compte. Cloud s’active depuis l’éditeur.',
    availabilityShort: 'Disponible',
    storageLabel: 'Où vivent vos projets',
    storageLocal: 'Sur votre machine',
    storageCloud: 'Sur votre machine, recopiés dans le cloud',
    plans: {
      local: {
        name: 'Local',
        price: '0 $',
        period: 'pour toujours',
        tagline: 'L’éditeur complet, sur votre machine, sans compte',
        points: [
          'Exports illimités, sans filigrane',
          'Un seul ZIP par export',
          'Projets et images conservés en local',
        ],
        badge: 'Gratuit',
        cta: 'Ouvrir l’éditeur',
        available: true,
      },
      cloud: {
        name: 'Cloud',
        price: `${CLOUD_OFFER.price.amount} $`,
        period: '/an',
        tagline: 'Vos projets sur toutes vos machines',
        points: [
          'Tout ce qui est inclus dans Local',
          'Projets, images et réglages synchronisés',
          'Stockage et sauvegardes hébergés',
          CLOUD_LIMITS_FR,
        ],
        note: 'Compte requis. Si vous arrêtez, vos copies locales restent à vous.',
        cta: 'Choisir Cloud',
        available: true,
      },
    },
    compareLabel: 'Comparatif détaillé',
    compareHint: 'faites défiler',
    compareNote:
      'Cloud n’a jamais la seule copie : celle de votre machine reste celle que vous éditez.',
    rows: [
      { label: 'Exports', values: ['Illimités, sans filigrane', 'Illimités, sans filigrane'] },
      { label: 'Projets stockés', values: ['Sur votre machine', 'Machine + cloud'] },
      { label: 'Reprendre sur une autre machine', values: ['Non', 'Inclus'] },
      { label: 'Sauvegardes hors navigateur', values: ['Non', 'Incluses'] },
      { label: 'Compte', values: ['Non requis', 'Requis'] },
    ],
    localNote:
      'Local n’a ni limite d’export, ni filigrane, ni paywall. Ce n’est pas une version d’essai.',
  },
  marquee: [
    '1320×2868 px',
    'PNG-24 · sRGB',
    '10 écrans par projet',
    'Mise à jour groupée',
    'MCP · Claude Code · Codex',
    'Local · gratuit',
    'Open source',
  ],
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Local est-il vraiment gratuit ?',
        a: 'Oui. Local, c’est l’éditeur complet : exports illimités, ZIP, tous les cadres iPhone, sans compte, sans période d’essai, sans filigrane. Cloud est en option et n’ajoute que la synchronisation, le stockage et les sauvegardes.',
      },
      {
        q: 'Les exports passent-ils App Store Connect ?',
        a: 'Oui, sur tout ce qui peut faire rejeter un fichier : 1320×2868, PNG opaque, sRGB, sous la limite de poids, le tout vérifié avant le téléchargement. Apple en dérive lui-même toutes les tailles iPhone plus petites. Reste le contenu, et là c’est la revue d’Apple qui juge, pas le fichier.',
      },
      {
        q: 'Quelles sont les limites de stockage Cloud ?',
        a: `${CLOUD_LIMITS_FR}. Quand une limite est atteinte, les nouvelles écritures Cloud s’arrêtent jusqu’à ce que vous libériez de la place. L’édition locale et les exports illimités continuent.`,
      },
      {
        q: 'Mes captures quittent-elles ma machine ?',
        a: 'Non, sauf si vous le demandez. En Local, projets et images restent dans votre navigateur et le rendu se fait dans l’onglet : rien n’est envoyé nulle part. Cloud ne copie un projet qu’une fois activé, l’assistant ne reçoit que du texte, et le serveur MCP tourne sur votre machine.',
      },
      {
        q: 'Une IA peut-elle composer mes captures ? Laquelle ?',
        a: 'Oui. Le serveur MCP du dépôt tourne sur votre machine et laisse Claude Code, Codex, opencode ou Claude Desktop composer dans l’éditeur que vous avez ouvert, captures comprises, avec un rendu PNG de chaque écran pour vérifier son travail. Son vocabulaire est fermé : il compose, il ne peut pas casser votre projet.',
      },
      {
        q: 'Comment brancher Claude Code ou Codex ?',
        a: 'Clonez le dépôt, lancez pnpm --filter mcp run start, ajoutez-le comme serveur stdio à votre agent (Claude Code lit le .mcp.json du dépôt), puis activez « Connexion MCP » dans la barre du haut de l’éditeur. Pas encore sur npm.',
      },
      {
        q: 'Faut-il une clé d’API ? Puis-je utiliser OpenRouter ?',
        a: 'Aucune clé n’est nécessaire : le générateur par défaut est local, et un agent par MCP utilise le compte que vous avez déjà. Pour qu’un modèle écrive les accroches depuis l’éditeur, utilisez Claude Code sur votre machine, une clé Anthropic, ou une clé OpenRouter avec le modèle de votre choix. Les clés sont chiffrées sur cet ordinateur.',
      },
      {
        q: 'Quels cadres iPhone sont proposés ?',
        a: 'Tous les modèles courants, de l’iPhone 16e à l’iPhone 17 Pro Max, iPhone Air compris, dans les coloris d’Apple. Les cadres sont vectoriels : ils restent nets en 1320×2868.',
      },
      {
        q: 'Puis-je utiliser mes propres captures ?',
        a: 'C’est le principe. Glissez une capture sur un cadre, ou tout un dossier pour mettre à jour les dix d’un coup : chaque fichier va sur l’appareil qui porte son nom, et la mise en page, les accroches et les fonds ne bougent pas.',
      },
      {
        q: 'Pourquoi pas Figma ou un template ?',
        a: 'Figma fait une belle capture. Il ne tient pas dix captures à la taille exacte d’Apple, ne les regénère pas à chaque version et ne vérifie pas les règles du fichier avant l’envoi. Un template donne un style, pas de mise à jour. ScreenForge réunit l’éditeur et l’export au même endroit, et l’éditeur est gratuit.',
      },
      {
        q: 'Est-ce open source ? Et si le projet s’arrête ?',
        a: 'Oui, tout l’éditeur est sous AGPL-3.0 sur GitHub. Vos projets restent sur votre machine et sortent en PNG tout à fait ordinaires : si ScreenForge s’arrêtait demain, vous garderiez le code, les fichiers et les ZIP. Rien ne dépend d’un serveur qu’il faudrait garder allumé.',
      },
      {
        q: 'Quelles dimensions sont exportées ?',
        a: 'Le 6,9″ natif (1320×2868), portrait ou paysage, la plus grande taille acceptée par App Store Connect. Apple en dérive toutes les tailles iPhone plus petites : un seul export couvre tous les iPhone.',
      },
      {
        q: 'Où sont stockés mes projets ?',
        a: 'En Local, les projets restent dans l’IndexedDB du navigateur, sur la machine où vous travaillez. Cloud en garde aussi une copie (projet, images sources, thème) sur Convex, pour qu’une autre machine puisse reprendre. C’est toujours la copie locale que vous éditez.',
      },
      {
        q: 'Qu’ajoute Cloud, et si j’arrête de payer ?',
        a: 'Cloud ajoute un compte, la synchronisation entre machines, le stockage et les sauvegardes hébergés, pour 39 $ par an. Si vous arrêtez, les copies déjà présentes sur vos machines y restent, modifiables ; vos données cloud restent lisibles et supprimables, mais la synchronisation s’arrête. Les exports Local restent gratuits.',
      },
      {
        q: 'Puis-je être remboursé ?',
        a: 'Les conditions de remboursement de Cloud sont affichées avant le paiement et dans le portail de facturation.',
      },
      {
        q: 'L’éditeur est-il en français ?',
        a: 'Oui, entièrement. Les pages de présentation existent en français et en anglais ; l’interface de l’éditeur est en français, l’anglais est prévu. Les PNG exportés ne dépendent pas de la langue de l’interface.',
      },
    ],
  },
  finalCta: {
    headline: 'Vos prochaines captures App Store, dans dix minutes.',
    body: 'Sans compte, sans carte, sans rien envoyer. L’éditeur s’ouvre sur un écran vide.',
    cta: 'Ouvrir l’éditeur gratuitement',
    ctaCloud: 'Choisir Cloud',
    founder:
      'J’ai fait ScreenForge pour sortir ma propre app, puis je l’ai mis en open source, sous AGPL, pour tous ceux qui sortent la leur.',
    source: 'Lire le code source sur GitHub',
  },
  footer: {
    source: 'Code source',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    preferences: 'Préférences de confidentialité',
    copyright: '© 2026 ScreenForge',
  },
  privacy: PRIVACY_COPY.fr,
}

export const copy = { en, fr } as const
