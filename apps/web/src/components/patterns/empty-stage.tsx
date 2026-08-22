import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { copy } from '@/lib/copy'
import { SCREENSHOT_IMAGE_ACCEPT, SCREENSHOT_IMAGE_TYPES } from '@/lib/image'
import { useUIStore } from '@/stores/ui.store'

/**
 * La planche sans écran : une invitation, deux actions.
 *
 * La primaire part des captures et non d'un écran vide qu'on remplirait
 * ensuite : `openCampaignWithCaptures` est déjà le seul chemin qui transforme
 * N captures en N planches complètes, que le geste vienne d'un dépôt sur la
 * scène ou du bouton ici (voir le commentaire de `pendingCaptures` dans
 * `ui.store.ts`) — un second import qui poserait ses propres calques
 * dupliquerait ce chemin plutôt que de le rejoindre.
 */
export function EmptyStage() {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].filter((file) =>
      (SCREENSHOT_IMAGE_TYPES as readonly string[]).includes(file.type),
    )
    event.target.value = ''
    if (files.length > 0) useUIStore.getState().openCampaignWithCaptures(files)
  }

  return (
    <Empty role="status" className="absolute inset-0">
      <EmptyMedia variant="icon">
        <Images size={18} strokeWidth={1.5} aria-hidden />
      </EmptyMedia>
      <EmptyTitle>{copy.empty.stageTitle}</EmptyTitle>
      <EmptyDescription>{copy.empty.stageDescription}</EmptyDescription>
      <EmptyContent>
        <Button variant="default" onClick={() => inputRef.current?.click()}>
          {copy.empty.stageImport}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useUIStore.getState().setShowTemplatesPicker(true)}
        >
          {copy.empty.stageTemplate}
        </Button>
        {/* Pas de nom accessible : un input masqué que rien ne focalise jamais
            (il n'est déclenché que par le bouton) porte, sinon, le même rôle
            « button » que lui — mesuré, `getByRole('button', { name: … })`
            trouvait les deux. Voir `LayersPanel.tsx`, même geste, même choix. */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SCREENSHOT_IMAGE_ACCEPT}
          className="hidden"
          onChange={handleFiles}
        />
      </EmptyContent>
    </Empty>
  )
}
