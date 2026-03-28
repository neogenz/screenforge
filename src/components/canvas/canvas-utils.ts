import {
  Rect,
  Circle,
  Textbox,
  FabricImage,
  Shadow,
  Gradient,
  type FabricObject,
} from 'fabric'
import type { Layer, BaseLayer, TextLayer, ShapeLayer, ImageLayer, DeviceFrameLayer } from '@/types'
import { getDeviceFrame, generateDeviceFrameSVG } from '@/assets/device-frames'

export function generateLayerId(): string {
  return crypto.randomUUID()
}

export async function layerToFabricObject(layer: Layer): Promise<FabricObject> {
  const base = {
    left: layer.x,
    top: layer.y,
    angle: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    selectable: !layer.locked,
    evented: !layer.locked,
  }

  let obj: FabricObject

  switch (layer.type) {
    case 'text': {
      const tl = layer as TextLayer
      const textbox = new Textbox(tl.content, {
        ...base,
        width: tl.width,
        fontSize: tl.fontSize,
        fontFamily: tl.fontFamily,
        fontWeight: tl.fontWeight.toString(),
        fill: tl.color,
        textAlign: tl.textAlign,
        lineHeight: tl.lineHeight,
        charSpacing: tl.letterSpacing,
      })
      if (tl.shadow) {
        textbox.set(
          'shadow',
          new Shadow({
            offsetX: tl.shadow.offsetX,
            offsetY: tl.shadow.offsetY,
            blur: tl.shadow.blur,
            color: tl.shadow.color,
          }),
        )
      }
      if (tl.gradientFill) {
        textbox.set(
          'fill',
          tl.gradientFill.type === 'linear'
            ? new Gradient<'linear'>({
                type: 'linear',
                gradientUnits: 'percentage',
                coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
                colorStops: tl.gradientFill.stops,
              })
            : new Gradient<'radial'>({
                type: 'radial',
                gradientUnits: 'percentage',
                coords: { r1: 0, r2: 0.5, x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.5 },
                colorStops: tl.gradientFill.stops,
              }),
        )
      }
      obj = textbox
      break
    }

    case 'shape': {
      const sl = layer as ShapeLayer
      const fill =
        typeof sl.fill === 'string'
          ? sl.fill
          : sl.fill.type === 'linear'
            ? new Gradient<'linear'>({
                type: 'linear',
                gradientUnits: 'percentage',
                coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
                colorStops: sl.fill.stops,
              })
            : new Gradient<'radial'>({
                type: 'radial',
                gradientUnits: 'percentage',
                coords: { r1: 0, r2: 0.5, x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.5 },
                colorStops: sl.fill.stops,
              })

      if (sl.shapeType === 'circle') {
        obj = new Circle({
          ...base,
          radius: Math.min(sl.width, sl.height) / 2,
          fill,
          stroke: sl.stroke,
          strokeWidth: sl.strokeWidth,
        })
      } else {
        obj = new Rect({
          ...base,
          width: sl.width,
          height: sl.height,
          rx: sl.shapeType === 'rounded-rect' ? (sl.borderRadius ?? 8) : 0,
          ry: sl.shapeType === 'rounded-rect' ? (sl.borderRadius ?? 8) : 0,
          fill,
          stroke: sl.stroke,
          strokeWidth: sl.strokeWidth,
        })
      }

      if (sl.shadow) {
        obj.set(
          'shadow',
          new Shadow({
            offsetX: sl.shadow.offsetX,
            offsetY: sl.shadow.offsetY,
            blur: sl.shadow.blur,
            color: sl.shadow.color,
          }),
        )
      }
      break
    }

    case 'image': {
      const il = layer as ImageLayer
      const imgEl = await loadImage(il.src)
      obj = new FabricImage(imgEl, {
        ...base,
        scaleX: il.width / imgEl.naturalWidth,
        scaleY: il.height / imgEl.naturalHeight,
      })
      break
    }

    case 'device-frame': {
      const dfl = layer as DeviceFrameLayer
      const config = getDeviceFrame(dfl.deviceModel)
      const svgString = generateDeviceFrameSVG(config, dfl.deviceColor, dfl.screenshotUrl)
      // Keep blob URL alive so Fabric's clone()/toObject() can re-use it.
      // Revoking it would break overflow clone creation.
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const blobUrl = URL.createObjectURL(blob)
      const imgEl = await loadImage(blobUrl)

      obj = new FabricImage(imgEl, {
        ...base,
        scaleX: layer.width / config.width,
        scaleY: layer.height / config.height,
      })
      break
    }
  }

  const data: Record<string, unknown> = { id: layer.id }
  if (layer.type === 'device-frame') {
    const dfl = layer as DeviceFrameLayer
    data.deviceModel = dfl.deviceModel
    data.deviceColor = dfl.deviceColor
    data.orientation = dfl.orientation
    data.screenshotUrl = dfl.screenshotUrl
  }
  obj.set('data', data)
  return obj
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function fabricObjectToLayerUpdate(obj: FabricObject): Partial<BaseLayer> {
  return {
    x: obj.left,
    y: obj.top,
    width: obj.getScaledWidth(),
    height: obj.getScaledHeight(),
    rotation: obj.angle,
    opacity: obj.opacity,
  }
}
