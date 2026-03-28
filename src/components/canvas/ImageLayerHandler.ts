import { FabricImage, type Canvas as FabricCanvas } from 'fabric'
import type { ImageLayer } from '@/types'
import { generateLayerId } from './canvas-utils'

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function createImageLayerFromFile(file: File): Promise<ImageLayer> {
  const src = await fileToDataUrl(file)

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })

  return {
    id: generateLayerId(),
    type: 'image',
    name: file.name.replace(/\.[^.]+$/, ''),
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    src,
    originalWidth: dimensions.width,
    originalHeight: dimensions.height,
  }
}

export async function addImageToFabricCanvas(canvas: FabricCanvas, layer: ImageLayer): Promise<FabricImage> {
  const img = await FabricImage.fromURL(layer.src)
  img.set({
    left: layer.x,
    top: layer.y,
    angle: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    selectable: !layer.locked,
    evented: !layer.locked,
    scaleX: layer.width / (img.width ?? layer.width),
    scaleY: layer.height / (img.height ?? layer.height),
  })
  img.set('data', { id: layer.id })
  canvas.add(img)
  return img
}
