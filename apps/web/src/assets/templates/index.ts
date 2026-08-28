import { APP_STORE_PROFILE, GOOGLE_PLAY_PROFILE } from '@/lib/dimensions'
import { CATALOG_TEMPLATES } from './catalog'
import { deviceLayer, textLayer } from './layers'
import type { ShapeLayer, TemplateDefinition } from '@/types'

const { width: W, height: H } = APP_STORE_PROFILE.board

const overlay: ShapeLayer = {
  id: 'full-bleed-overlay',
  type: 'shape',
  name: 'Text contrast',
  x: 0,
  y: 580,
  width: W,
  height: H - 580,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: 1,
  shapeType: 'rectangle',
  fill: {
    type: 'linear',
    angle: 180,
    stops: [
      { offset: 0, color: 'rgba(12,12,11,0)' },
      { offset: 1, color: 'rgba(12,12,11,0.92)' },
    ],
  },
}

const APP_STORE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'hero',
    target: 'app-store-iphone',
    name: 'Plein cadre',
    description: 'Grand titre et appareil incliné, utile comme ouverture panoramique.',
    background: { type: 'solid', color: '#f2f3f5' },
    layers: [
      textLayer(
        'hero-title',
        'Title',
        'Titre de la capture',
        {
          x: 30,
          y: 76,
          width: W - 60,
          height: 110,
          zIndex: 0,
        },
        { fontSize: 56 },
      ),
      textLayer(
        'hero-subtitle',
        'Subtitle',
        'Description facultative',
        {
          x: 52,
          y: 218,
          width: W - 104,
          height: 44,
          zIndex: 1,
        },
        { fontSize: 20, fontWeight: 500, color: '#5a5a57', letterSpacing: 0 },
      ),
      deviceLayer('hero-device', 'iPhone', {
        x: 88,
        y: 340,
        width: 264,
        height: 557,
        rotation: -10,
        zIndex: 2,
      }),
    ],
  },
  {
    id: 'feature',
    target: 'app-store-iphone',
    name: 'Fonctionnalité',
    description: 'Hiérarchie verticale pour expliquer une fonctionnalité.',
    background: { type: 'solid', color: '#f7f8f3' },
    layers: [
      textLayer(
        'feature-title',
        'Title',
        'Titre de la fonctionnalité',
        {
          x: 32,
          y: 64,
          width: W - 64,
          height: 120,
          zIndex: 0,
        },
        { fontSize: 52, color: '#141413' },
      ),
      textLayer(
        'feature-subtitle',
        'Subtitle',
        'Une phrase courte pour donner le contexte.',
        {
          x: 48,
          y: 190,
          width: W - 96,
          height: 52,
          zIndex: 1,
        },
        { fontSize: 18, fontWeight: 400, color: '#5a5a57', letterSpacing: 0 },
      ),
      deviceLayer('feature-device', 'iPhone', {
        x: 80,
        y: 318,
        width: 280,
        height: 591,
        rotation: 0,
        zIndex: 2,
      }),
    ],
  },
  {
    id: 'side-by-side',
    target: 'app-store-iphone',
    name: 'Côte à côte',
    description: 'Deux états d’interface comparés sur une même capture.',
    background: {
      type: 'linear-gradient',
      angle: 155,
      stops: [
        { offset: 0, color: '#fbfbfc' },
        { offset: 1, color: '#e4e6ec' },
      ],
    },
    layers: [
      textLayer(
        'side-title',
        'Title',
        'Deux vues. Un seul message.',
        {
          x: 28,
          y: 72,
          width: W - 56,
          height: 100,
          zIndex: 0,
        },
        { fontSize: 46 },
      ),
      deviceLayer('side-device-left', 'iPhone Left', {
        x: 8,
        y: 360,
        width: 196,
        height: 414,
        rotation: -7,
        zIndex: 1,
      }),
      deviceLayer('side-device-right', 'iPhone Right', {
        x: 236,
        y: 332,
        width: 196,
        height: 414,
        rotation: 7,
        zIndex: 2,
      }),
    ],
  },
  {
    id: 'full-bleed',
    target: 'app-store-iphone',
    name: 'Image pleine',
    description: 'Appareil plein cadre avec zone de texte contrastée.',
    background: { type: 'solid', color: '#e4e6ec' },
    layers: [
      deviceLayer('full-bleed-device', 'iPhone', {
        x: 20,
        y: 54,
        width: 400,
        height: 844,
        rotation: 0,
        zIndex: 0,
      }),
      overlay,
      textLayer(
        'full-bleed-title',
        'Title',
        'Titre sur l’image',
        {
          x: 32,
          y: 690,
          width: W - 64,
          height: 116,
          zIndex: 2,
        },
        { fontSize: 48, color: '#ffffff', textAlign: 'left' },
      ),
      textLayer(
        'full-bleed-subtitle',
        'Subtitle',
        'Description facultative',
        {
          x: 32,
          y: 820,
          width: W - 64,
          height: 42,
          zIndex: 3,
        },
        { fontSize: 18, fontWeight: 400, color: '#ffffff', textAlign: 'left', letterSpacing: 0 },
      ),
    ],
  },
  {
    id: 'minimal',
    target: 'app-store-iphone',
    name: 'Minimal',
    description: 'Composition éditoriale simple, texte à gauche et appareil à droite.',
    background: { type: 'solid', color: '#ffffff' },
    layers: [
      textLayer(
        'minimal-label',
        'Label',
        'CATÉGORIE',
        {
          x: 28,
          y: 166,
          width: 220,
          height: 30,
          zIndex: 0,
        },
        {
          fontSize: 13,
          color: '#5a5a57',
          textAlign: 'left',
          letterSpacing: 2,
          textTransform: 'uppercase',
        },
      ),
      // Colonne de texte de 180 px : au-delà le titre passe sous l'appareil,
      // posé en x=220. À cette largeur, 46 px ne tiennent qu'un mot par ligne —
      // la maquette éditoriale suppose une accroche courte, pas une phrase.
      textLayer(
        'minimal-title',
        'Title',
        'Titre\ncourt',
        {
          x: 28,
          y: 210,
          width: 180,
          height: 180,
          zIndex: 1,
        },
        { fontSize: 46, color: '#141413', textAlign: 'left' },
      ),
      deviceLayer('minimal-device', 'iPhone', {
        x: 220,
        y: 118,
        width: 210,
        height: 443,
        rotation: 4,
        zIndex: 2,
      }),
    ],
  },
  {
    id: 'ipad-editorial',
    target: 'app-store-ipad-13',
    name: 'Éditorial iPad',
    description: 'Titre compact et grande tablette, entièrement contenus dans la planche iPad.',
    background: {
      type: 'linear-gradient',
      angle: 155,
      stops: [
        { offset: 0, color: '#f7f7f3' },
        { offset: 1, color: '#dfe3dc' },
      ],
    },
    layers: [
      textLayer(
        'ipad-editorial-title',
        'Title',
        'Votre app, en grand.',
        { x: 28, y: 34, width: 384, height: 82, zIndex: 0 },
        { fontSize: 40, color: '#171816', textAlign: 'left' },
      ),
      textLayer(
        'ipad-editorial-subtitle',
        'Subtitle',
        'Une interface lisible au premier regard.',
        { x: 30, y: 122, width: 360, height: 42, zIndex: 1 },
        { fontSize: 17, fontWeight: 500, color: '#5a5d57', textAlign: 'left' },
      ),
      deviceLayer(
        'ipad-editorial-device',
        'Tablette',
        { x: 78, y: 190, width: 284, height: 378, rotation: 0, zIndex: 2 },
        'white',
        'tablet-slate',
      ),
    ],
  },
  {
    id: 'watch-focus',
    target: 'app-store-watch-series-10',
    name: 'Focus Watch',
    description: 'Message bref et montre centrale, compatible avec les six profils Watch.',
    background: { type: 'solid', color: '#eef0ea' },
    layers: [
      textLayer(
        'watch-focus-title',
        'Title',
        'L’essentiel, au poignet.',
        { x: 24, y: 28, width: 392, height: 78, zIndex: 0 },
        { fontSize: 36, color: '#171816' },
      ),
      textLayer(
        'watch-focus-subtitle',
        'Subtitle',
        'Un geste suffit.',
        { x: 56, y: 112, width: 328, height: 38, zIndex: 1 },
        { fontSize: 17, fontWeight: 500, color: '#5a5d57' },
      ),
      deviceLayer(
        'watch-focus-device',
        'Montre',
        { x: 92, y: 175, width: 256, height: 303, rotation: 0, zIndex: 2 },
        'white',
        'watch-halo',
      ),
    ],
  },
]

const { width: ANDROID_W, height: ANDROID_H } = GOOGLE_PLAY_PROFILE.board

function androidVariant(template: TemplateDefinition): TemplateDefinition {
  const scaleX = ANDROID_W / W
  const scaleY = ANDROID_H / H
  return {
    ...structuredClone(template),
    id: `android-${template.id}`,
    target: 'google-play-phone',
    layers: template.layers.map((source) => {
      const layer = structuredClone(source)
      const center = (layer.x + layer.width / 2) / W
      layer.y = Math.round(layer.y * scaleY)
      layer.height = Math.round(layer.height * scaleY)
      if (layer.type === 'device-frame') {
        layer.deviceModel = 'android-phone'
        layer.deviceColor = 'black'
        layer.name = 'Téléphone Android'
        layer.width = Math.round(layer.height * (180 / 384))
        layer.x = Math.round(center * ANDROID_W - layer.width / 2)
      } else {
        layer.x = Math.round(layer.x * scaleX)
        layer.width = Math.round(layer.width * scaleX)
      }
      return layer
    }),
  }
}

export const TEMPLATES: TemplateDefinition[] = [
  ...APP_STORE_TEMPLATES,
  ...APP_STORE_TEMPLATES.filter((template) => template.target === 'app-store-iphone').map(
    androidVariant,
  ),
  ...CATALOG_TEMPLATES,
]
