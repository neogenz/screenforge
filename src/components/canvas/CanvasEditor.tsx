import { useCanvas } from '@/hooks/use-canvas'
import { useUIStore } from '@/stores/ui.store'

export default function CanvasEditor() {
  const { canvasRef, containerRef } = useCanvas()
  const zoom = useUIStore((s) => s.zoom)

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-canvas-bg"
    >
      <canvas ref={canvasRef} />

      <div className="pointer-events-none absolute bottom-3 right-3">
        <div className="pointer-events-none rounded-md border border-border bg-panel/90 px-2 py-1 text-[10px] font-medium tabular-nums text-muted shadow-sm backdrop-blur-md select-none">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  )
}
