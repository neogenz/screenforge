import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAssets, registerAsset, resolveAsset, sweepAssets } from '@/lib/assets'
import {
  instantiateTemplate,
  isCustomTemplate,
  readCustomTemplates,
  templateFromScreen,
  TemplateRefusedError,
  writeCustomTemplate,
  type CustomTemplate,
} from '@/lib/custom-templates'
import type { DeviceFrameLayer, ImageLayer, Screen, TextLayer } from '@/types'

/**
 * Ce qu'un gabarit doit emporter, et ce qu'il doit laisser.
 *
 * Les deux erreurs sont silencieuses et symétriques : un gabarit qui ne retient
 * qu'un `assetId` rend un logo vide au prochain démarrage, parce que le registre
 * est balayé au chargement de chaque projet ; un gabarit qui emporte la capture
 * fait porter à tous les écrans construits depuis lui la capture d'un autre.
 * Ni l'une ni l'autre ne casse quoi que ce soit — elles produisent juste un
 * écran faux que personne ne relie à une décision de sérialisation.
 */

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

function textLayer(): TextLayer {
  return {
    id: 'texte',
    type: 'text',
    name: 'Accroche',
    x: 20,
    y: 40,
    width: 400,
    height: 80,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    content: 'Vos dépenses, enfin lisibles',
    fontFamily: 'Inter',
    fontSize: 40,
    fontWeight: 700,
    color: '#111111',
    textAlign: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    textTransform: 'none',
  }
}

function imageLayer(assetId: string): ImageLayer {
  return {
    id: 'logo',
    type: 'image',
    name: 'Logo',
    x: 20,
    y: 20,
    width: 60,
    height: 60,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 1,
    assetId,
    originalWidth: 120,
    originalHeight: 120,
  }
}

function deviceLayer(screenshotAssetId?: string): DeviceFrameLayer {
  return {
    id: 'appareil',
    type: 'device-frame',
    name: 'iPhone',
    x: 80,
    y: 300,
    width: 280,
    height: 591,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 2,
    deviceModel: 'iphone-17-pro-max',
    deviceColor: 'silver',
    orientation: 'portrait',
    ...(screenshotAssetId
      ? {
          screenshotAssetId,
          screenshotSize: { width: 1290, height: 2796 },
          placement: { mode: 'cover' as const, focusX: 0.5, focusY: 0.5, zoom: 1 },
        }
      : {}),
  }
}

function screen(layers: Screen['layers']): Screen {
  return {
    id: 'ecran',
    name: 'Accueil',
    background: { type: 'solid', color: '#ffffff' },
    layers,
  }
}

beforeEach(() => {
  clearAssets()
})

describe('gabarit figé depuis un écran', () => {
  it('emporte le logo et laisse la capture', () => {
    const logo = registerAsset(PIXEL)
    const capture = registerAsset('data:image/png;base64,QUJD')
    const template = templateFromScreen(
      screen([textLayer(), imageLayer(logo), deviceLayer(capture)]),
      { name: 'Ouverture', source: 'ai' },
    )

    expect(template.layers).toHaveLength(3)
    expect(Object.keys(template.assets)).toEqual([logo])
    expect(template.assets[logo]).toBe(PIXEL)

    const device = template.layers[2]
    expect(device.type).toBe('device-frame')
    if (device.type !== 'device-frame') throw new Error('type inattendu')
    // Le cadre reste, son contenu appartient à la fiche : `batch-refresh` le remplit.
    expect(device.screenshotAssetId).toBeUndefined()
    expect(device.screenshotSize).toBeUndefined()
    expect(device.placement).toBeUndefined()

    expect(isCustomTemplate(template)).toBe(true)
  })

  it('refuse plutôt que d’amputer quand une image manque', () => {
    expect(() =>
      templateFromScreen(screen([imageLayer('jamais-enregistre')]), {
        name: 'Cassé',
        source: 'user',
      }),
    ).toThrow(TemplateRefusedError)
  })

  it('survit au balayage du registre, parce qu’il porte ses octets', () => {
    const logo = registerAsset(PIXEL)
    const template = templateFromScreen(screen([imageLayer(logo)]), {
      name: 'Logo seul',
      source: 'user',
    })

    // Ce que fait le chargement d'un autre projet : ne garder que ses assets.
    sweepAssets(new Set())
    expect(resolveAsset(logo)).toBeUndefined()

    const applied = instantiateTemplate(template)
    const image = applied.layers[0]
    if (image?.type !== 'image') throw new Error('type inattendu')
    expect(resolveAsset(image.assetId)).toBe(PIXEL)
  })

  it('retombe sur l’asset déjà présent quand l’image y est encore', () => {
    const logo = registerAsset(PIXEL)
    const template = templateFromScreen(screen([imageLayer(logo)]), {
      name: 'Logo bis',
      source: 'user',
    })

    const image = instantiateTemplate(template).layers[0]
    if (image?.type !== 'image') throw new Error('type inattendu')
    // Déduplication par contenu : appliquer un gabarit ne double pas l'octet.
    expect(image.assetId).toBe(logo)
  })
})

describe('validation', () => {
  it('refuse un enregistrement dont les calques ne passent pas le contrat du projet', () => {
    const template = templateFromScreen(screen([textLayer()]), { name: 'Base', source: 'user' })
    const broken: CustomTemplate = {
      ...template,
      layers: [{ ...textLayer(), fontSize: Number.NaN }],
    }
    expect(isCustomTemplate(broken)).toBe(false)
    expect(isCustomTemplate({ ...template, source: 'humain' })).toBe(false)
  })

  it('ignore un enregistrement illisible sans perdre les autres', async () => {
    const good = templateFromScreen(screen([textLayer()]), { name: 'Bon', source: 'ai' })
    await writeCustomTemplate(good)
    await writeCustomTemplate({ id: 'corrompu' } as unknown as CustomTemplate)

    const read = await readCustomTemplates()
    expect(read.map((template) => template.name)).toEqual(['Bon'])
  })
})
