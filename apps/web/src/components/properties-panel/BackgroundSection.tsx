import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { DEFAULT_STOP_COLOR } from '@/lib/content-defaults'
import type { Background } from '@/types'

/* Constante de module : un repli créé au rendu changerait de référence à
   chaque passage et referait re-rendre la section pour rien. */
const FALLBACK_BACKGROUND: Background = { type: 'solid', color: DEFAULT_STOP_COLOR }

export function BackgroundSection() {
  /* Deux sélecteurs ciblés plutôt que `s.project` entier : la section est
     montée pendant chaque réglage du canvas, et le projet change de référence
     à chaque nudge — elle re-rendait un éditeur de dégradé pour un déplacement
     de calque qui ne la concerne pas. */
  const activeScreenId = useProjectStore((state) => state.project?.activeScreenId ?? '')
  const background: Background =
    useProjectStore(
      (state) =>
        state.project?.screens.find((screen) => screen.id === state.project?.activeScreenId)
          ?.background,
    ) ?? FALLBACK_BACKGROUND
  const updateBackground = useCanvasStore((s) => s.updateBackground)

  function handleChange(bg: Background, coalesceKey?: string) {
    updateBackground(
      bg,
      coalesceKey
        ? { coalesceKey: `screen:${activeScreenId}:background:${coalesceKey}` }
        : undefined,
    )
  }

  return <BackgroundEditor background={background} onChange={handleChange} />
}
