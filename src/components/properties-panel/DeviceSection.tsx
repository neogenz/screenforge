import { useCanvasStore } from '@/stores/canvas.store'
import { DevicePicker } from '@/components/device-picker/DevicePicker'
import type { DeviceFrameLayer } from '@/types'

interface DeviceSectionProps {
  layer: DeviceFrameLayer
}

export function DeviceSection({ layer }: DeviceSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)

  return (
    <div>
      <DevicePicker
        deviceModel={layer.deviceModel}
        deviceColor={layer.deviceColor}
        orientation={layer.orientation}
        screenshotUrl={layer.screenshotUrl}
        shadowEnabled={layer.shadowEnabled ?? false}
        shadowBlur={layer.shadowBlur ?? 0}
        shadowColor={layer.shadowColor ?? 'rgba(0,0,0,0.3)'}
        shadowOffsetX={layer.shadowOffsetX ?? 0}
        shadowOffsetY={layer.shadowOffsetY ?? 0}
        onUpdate={(updates) =>
          updateLayer(layer.id, updates as Partial<import('@/types').Layer>)
        }
      />
    </div>
  )
}
