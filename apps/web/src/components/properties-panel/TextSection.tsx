import { TextEditor } from '@/components/text-editor/TextEditor'
import type { TextLayer } from '@/types'

interface TextSectionProps {
  layer: TextLayer
}

export function TextSection({ layer }: TextSectionProps) {
  return <TextEditor layer={layer} />
}
