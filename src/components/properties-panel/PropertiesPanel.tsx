import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
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

  let headerLabel = 'Background'
  if (selectedLayers.length === 1) headerLabel = 'Properties'
  else if (selectedLayers.length > 1) headerLabel = 'Multi-select'

  return (
    <aside
      className={cn(
        'panel-chrome sidebar-shell--properties flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto',
        'border-l border-border',
      )}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="mono-label-strong">{headerLabel}</span>
        {selectedLayers.length > 1 && (
          <span className="mono-label tabular-nums">
            {String(selectedLayers.length).padStart(2, '0')}
          </span>
        )}
      </div>

      {selectedLayers.length === 0 && (
        <div className="px-3 pt-4 pb-6">
          <BackgroundSection />
        </div>
      )}

      {selectedLayers.length > 1 && (
        <div className="p-3">
          <div className="surface-inner px-4 py-6 text-center">
            <p className="mono-label mb-2">Selection</p>
            <p className="text-[12px] leading-relaxed text-foreground-muted">
              {selectedLayers.length} calques sélectionnés.
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Sélectionnez un seul calque pour éditer.
            </p>
          </div>
        </div>
      )}

      {selectedLayer && (
        <>
          <Section title="Transform" defaultOpen>
            <TransformSection layer={selectedLayer} />
          </Section>

          {selectedLayer.type === 'text' && (
            <Section title="Text" defaultOpen>
              <TextSection layer={selectedLayer as TextLayer} />
            </Section>
          )}

          {selectedLayer.type === 'device-frame' && (
            <Section title="Device" defaultOpen>
              <DeviceSection layer={selectedLayer as DeviceFrameLayer} />
            </Section>
          )}

          {selectedLayer.type === 'image' && (
            <Section title="Image" defaultOpen>
              <ImageSection layer={selectedLayer as ImageLayer} />
            </Section>
          )}

          {selectedLayer.type === 'shape' && (
            <Section title="Shape" defaultOpen>
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
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-1.5 px-3',
          'mono-label-strong',
          'transition-colors duration-100 ease-out hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
        )}
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? (
          <Minus size={12} strokeWidth={1.5} className="text-muted" aria-hidden />
        ) : (
          <Plus size={12} strokeWidth={1.5} className="text-muted" aria-hidden />
        )}
      </button>

      {open && children && (
        <div className="min-w-0 max-w-full pb-3">
          <div className="panel-section-inset min-w-0 max-w-full">{children}</div>
        </div>
      )}
    </div>
  )
}
