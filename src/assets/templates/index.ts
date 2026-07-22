import type { DeviceFrameLayer, ShapeLayer, TemplateDefinition, TextLayer } from '@/types'

const W = 440
const H = 956

function textLayer(
  id: string,
  name: string,
  content: string,
  geometry: Pick<TextLayer, 'x' | 'y' | 'width' | 'height' | 'zIndex'>,
  style: Partial<Pick<TextLayer, 'fontSize' | 'fontWeight' | 'color' | 'textAlign' | 'lineHeight' | 'letterSpacing' | 'textTransform'>> = {},
): TextLayer {
  return {
    id,
    type: 'text',
    name,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fontFamily: 'Space Grotesk',
    fontSize: 48,
    fontWeight: 700,
    color: '#0b6b32',
    textAlign: 'center',
    lineHeight: 1.12,
    letterSpacing: -0.5,
    textTransform: 'none',
    content,
    ...geometry,
    ...style,
  }
}

function deviceLayer(
  id: string,
  name: string,
  geometry: Pick<DeviceFrameLayer, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex'>,
  color: DeviceFrameLayer['deviceColor'] = 'black-titanium',
): DeviceFrameLayer {
  return {
    id,
    type: 'device-frame',
    name,
    opacity: 1,
    locked: false,
    visible: true,
    deviceModel: 'iphone-16-pro-max',
    deviceColor: color,
    orientation: 'portrait',
    shadowEnabled: true,
    shadowBlur: 18,
    shadowColor: 'rgba(0,0,0,0.22)',
    shadowOffsetX: 0,
    shadowOffsetY: 10,
    ...geometry,
  }
}

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
      { offset: 0, color: 'rgba(0,63,29,0)' },
      { offset: 1, color: 'rgba(0,63,29,0.92)' },
    ],
  },
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'hero',
    name: 'Hero',
    description: 'Grand titre et appareil incliné, utile comme ouverture panoramique.',
    background: { type: 'solid', color: '#efffea' },
    layers: [
      textLayer('hero-title', 'Title', 'Titre de la capture', {
        x: 30, y: 76, width: W - 60, height: 110, zIndex: 0,
      }, { fontSize: 56 }),
      textLayer('hero-subtitle', 'Subtitle', 'Description facultative', {
        x: 52, y: 194, width: W - 104, height: 44, zIndex: 1,
      }, { fontSize: 20, fontWeight: 500, color: '#31533d', letterSpacing: 0 }),
      deviceLayer('hero-device', 'iPhone', {
        x: 88, y: 340, width: 264, height: 557, rotation: -10, zIndex: 2,
      }),
    ],
  },
  {
    id: 'feature',
    name: 'Feature',
    description: 'Hiérarchie verticale pour expliquer une fonctionnalité.',
    background: { type: 'solid', color: '#f7f8f3' },
    layers: [
      textLayer('feature-title', 'Title', 'Titre de la fonctionnalité', {
        x: 32, y: 64, width: W - 64, height: 120, zIndex: 0,
      }, { fontSize: 52, color: '#141413' }),
      textLayer('feature-subtitle', 'Subtitle', 'Une phrase courte pour donner le contexte.', {
        x: 48, y: 190, width: W - 96, height: 52, zIndex: 1,
      }, { fontSize: 18, fontWeight: 400, color: '#5a5a57', letterSpacing: 0 }),
      deviceLayer('feature-device', 'iPhone', {
        x: 80, y: 318, width: 280, height: 591, rotation: 0, zIndex: 2,
      }, 'white-titanium'),
    ],
  },
  {
    id: 'side-by-side',
    name: 'Side by Side',
    description: 'Deux états d’interface comparés sur une même capture.',
    background: {
      type: 'linear-gradient',
      angle: 155,
      stops: [
        { offset: 0, color: '#f4fff0' },
        { offset: 1, color: '#dff5db' },
      ],
    },
    layers: [
      textLayer('side-title', 'Title', 'Deux vues. Un seul message.', {
        x: 28, y: 72, width: W - 56, height: 100, zIndex: 0,
      }, { fontSize: 46 }),
      deviceLayer('side-device-left', 'iPhone Left', {
        x: 8, y: 360, width: 196, height: 414, rotation: -7, zIndex: 1,
      }, 'natural-titanium'),
      deviceLayer('side-device-right', 'iPhone Right', {
        x: 236, y: 332, width: 196, height: 414, rotation: 7, zIndex: 2,
      }, 'desert-titanium'),
    ],
  },
  {
    id: 'full-bleed',
    name: 'Full Bleed',
    description: 'Appareil plein cadre avec zone de texte contrastée.',
    background: { type: 'solid', color: '#dff5db' },
    layers: [
      deviceLayer('full-bleed-device', 'iPhone', {
        x: 20, y: 54, width: 400, height: 844, rotation: 0, zIndex: 0,
      }, 'black-titanium'),
      overlay,
      textLayer('full-bleed-title', 'Title', 'Titre sur l’image', {
        x: 32, y: 690, width: W - 64, height: 116, zIndex: 2,
      }, { fontSize: 48, color: '#ffffff', textAlign: 'left' }),
      textLayer('full-bleed-subtitle', 'Subtitle', 'Description facultative', {
        x: 32, y: 820, width: W - 64, height: 42, zIndex: 3,
      }, { fontSize: 18, fontWeight: 400, color: '#ffffff', textAlign: 'left', letterSpacing: 0 }),
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Composition éditoriale simple, texte à gauche et appareil à droite.',
    background: { type: 'solid', color: '#ffffff' },
    layers: [
      textLayer('minimal-label', 'Label', 'CATÉGORIE', {
        x: 28, y: 166, width: 220, height: 30, zIndex: 0,
      }, { fontSize: 13, color: '#0b6b32', textAlign: 'left', letterSpacing: 2, textTransform: 'uppercase' }),
      textLayer('minimal-title', 'Title', 'Titre de la\ncapture', {
        x: 28, y: 210, width: 238, height: 180, zIndex: 1,
      }, { fontSize: 50, color: '#141413', textAlign: 'left' }),
      deviceLayer('minimal-device', 'iPhone', {
        x: 220, y: 118, width: 210, height: 443, rotation: 4, zIndex: 2,
      }),
    ],
  },
]
