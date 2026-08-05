import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { DEFAULT_STOP_COLOR } from '@/lib/content-defaults'
import type { Background } from '@/types'

export function BackgroundSection() {
  const project = useProjectStore((s) => s.project)
  const updateBackground = useCanvasStore((s) => s.updateBackground)

  const activeScreenId = project?.activeScreenId ?? ''
  const screen = project?.screens.find((s) => s.id === activeScreenId)
  const background: Background = screen?.background ?? { type: 'solid', color: DEFAULT_STOP_COLOR }

  function handleChange(bg: Background, coalesceKey?: string) {
    updateBackground(
      bg,
      coalesceKey ? { coalesceKey: `screen:${activeScreenId}:background:${coalesceKey}` } : undefined,
    )
  }

  return <BackgroundEditor background={background} onChange={handleChange} />
}
