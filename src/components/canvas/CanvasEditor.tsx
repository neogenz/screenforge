import { useCanvas } from '@/hooks/use-canvas'

export default function CanvasEditor() {
  const { canvasRef, containerRef } = useCanvas()

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-canvas-bg"
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
