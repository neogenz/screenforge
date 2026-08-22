import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { ShadowEditor } from '@/components/properties-panel/ShadowEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { registerAsset } from '@/lib/assets'
import { IMAGE_ACCEPT, imageImportErrorMessage, importImageFile } from '@/lib/image'
import type { ImageLayer, Layer } from '@/types'

interface ImageSectionProps {
  layer: ImageLayer
}

export function ImageSection({ layer }: ImageSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function update(patch: Partial<ImageLayer>, options?: { coalesceKey?: string }) {
    updateLayer(layer.id, patch as Partial<Layer>, options)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileError(null)
    e.target.value = ''

    try {
      const image = await importImageFile(file)
      update({
        assetId: registerAsset(image.dataUrl),
        originalWidth: image.width,
        originalHeight: image.height,
      })
    } catch (error) {
      setFileError(imageImportErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Input
          unstyled
          nativeInput
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={(event) => void handleFileChange(event)}
          className="sr-only"
          aria-label="Remplacer le fichier image"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={11} strokeWidth={1.5} aria-hidden />
          Remplacer
        </Button>
        {fileError && (
          <p role="alert" className="mt-1.5 text-2xs text-destructive">
            {fileError}
          </p>
        )}
      </div>

      <ShadowEditor
        shadow={layer.shadow}
        onChange={(shadow, options) => update({ shadow }, options)}
        ariaLabel="Activer l’ombre"
        coalesceKey={`layer:${layer.id}:shadow`}
      />
    </div>
  )
}
