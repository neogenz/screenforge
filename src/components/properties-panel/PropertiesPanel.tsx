import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '@/stores/canvas.store'
import { cn } from '@/lib/utils'
import { TransformSection } from './TransformSection'
import { TextSection } from './TextSection'
import { DeviceSection } from './DeviceSection'
import { ImageSection } from './ImageSection'
import { ShapeSection } from './ShapeSection'
import { BackgroundSection } from './BackgroundSection'
import type { Layer, TextLayer, DeviceFrameLayer, ImageLayer, ShapeLayer } from '@/types'

export function PropertiesPanel() {
  const { layers, selectedLayerIds } = useCanvasStore(
    useShallow((s) => ({ layers: s.layers, selectedLayerIds: s.selectedLayerIds })),
  )

  const selectedLayers = selectedLayerIds
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is Layer => l !== undefined)

  const selectedLayer = selectedLayers.length === 1 ? selectedLayers[0] : null

  return (
    <aside
      className={cn(
        'panel-chrome sidebar-shell--properties flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto border-l border-border',
      )}
    >
      {selectedLayers.length === 0 && (
        <Section title="Arrière-plan" defaultOpen>
          <BackgroundSection />
        </Section>
      )}

      {selectedLayers.length > 1 && (
        <div className="px-3 py-4">
          <div className="rounded-md border border-border bg-surface/30 px-4 py-5 text-center">
            <p className="text-xs font-medium text-foreground">
              {selectedLayers.length} calques sélectionnés
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Sélectionnez un seul calque.
            </p>
          </div>
        </div>
      )}

      {selectedLayer && (
        <>
          <Section title="Transformation" defaultOpen>
            <TransformSection layer={selectedLayer} />
          </Section>

          {selectedLayer.type === 'text' && (
            <Section title="Texte" defaultOpen>
              <TextSection layer={selectedLayer as TextLayer} />
            </Section>
          )}

          {selectedLayer.type === 'device-frame' && (
            <Section title="Appareil" defaultOpen>
              <DeviceSection layer={selectedLayer as DeviceFrameLayer} />
            </Section>
          )}

          {selectedLayer.type === 'image' && (
            <Section title="Image" defaultOpen>
              <ImageSection layer={selectedLayer as ImageLayer} />
            </Section>
          )}

          {selectedLayer.type === 'shape' && (
            <Section title="Forme" defaultOpen>
              <ShapeSection layer={selectedLayer as ShapeLayer} />
            </Section>
          )}
        </>
      )}
    </aside>
  )
}

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children?: React.ReactNode
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 w-full items-center gap-1.5 px-3',
          'text-[10px] font-semibold uppercase tracking-[0.15em] text-muted',
          'transition-colors hover:bg-surface-hover/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
        )}
        aria-expanded={open}
      >
        <ChevronRight
          size={12}
          strokeWidth={2.5}
          className={cn(
            'shrink-0 text-muted/50 transition-transform duration-150',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        {title}
      </button>

      {open && children && (
        <div className="min-w-0 max-w-full pb-3">
          <div className="panel-section-inset min-w-0 max-w-full">{children}</div>
        </div>
      )}
    </div>
  )
}
