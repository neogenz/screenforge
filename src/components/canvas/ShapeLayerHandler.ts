import { Rect, Circle, type Canvas as FabricCanvas } from 'fabric'
import type { ShapeLayer } from '@/types'
import { generateLayerId } from './canvas-utils'

export function createDefaultShapeLayer(shapeType: ShapeLayer['shapeType']): ShapeLayer {
  return {
    id: generateLayerId(),
    type: 'shape',
    name: shapeType === 'circle' ? 'Circle' : shapeType === 'rounded-rect' ? 'Rounded Rect' : 'Rectangle',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    shapeType,
    fill: '#3B82F6',
    borderRadius: shapeType === 'rounded-rect' ? 12 : undefined,
  }
}

export function addShapeToFabricCanvas(canvas: FabricCanvas, layer: ShapeLayer): Rect | Circle {
  const base = {
    left: layer.x,
    top: layer.y,
    angle: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    selectable: !layer.locked,
    evented: !layer.locked,
    fill: typeof layer.fill === 'string' ? layer.fill : '#3B82F6',
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth ?? 0,
  }

  let shape: Rect | Circle

  if (layer.shapeType === 'circle') {
    shape = new Circle({
      ...base,
      radius: Math.min(layer.width, layer.height) / 2,
    })
  } else {
    const radius = layer.shapeType === 'rounded-rect' ? (layer.borderRadius ?? 12) : 0
    shape = new Rect({
      ...base,
      width: layer.width,
      height: layer.height,
      rx: radius,
      ry: radius,
    })
  }

  shape.set('data', { id: layer.id })
  canvas.add(shape)
  return shape
}
