import { useCanvasStore } from '@/stores/canvas.store'
import { DevicePicker } from '@/components/device-picker/DevicePicker'
import type { DeviceFrameLayer, Layer } from '@/types'

interface DeviceSectionProps {
  layer: DeviceFrameLayer
}

export function DeviceSection({ layer }: DeviceSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)

  return (
    <DevicePicker
      layer={layer}
      onUpdate={(updates, options) =>
        updateLayer(layer.id, updates as Partial<Layer>, options)
      }
    />
  )
}
