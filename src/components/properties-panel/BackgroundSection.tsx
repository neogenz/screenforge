import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import type { Background } from '@/types'

export function BackgroundSection() {
  const activeScreenId = useCanvasStore((s) => s.activeScreenId)
  const project = useProjectStore((s) => s.project)
  const updateScreenBackground = useProjectStore((s) => s.updateScreenBackground)

  const screen = project?.screens.find((s) => s.id === activeScreenId)
  const background: Background = screen?.background ?? { type: 'solid', color: '#ffffff' }

  function handleChange(bg: Background) {
    if (!activeScreenId) return
    updateScreenBackground(activeScreenId, bg)
  }

  return <BackgroundEditor background={background} onChange={handleChange} />
}
