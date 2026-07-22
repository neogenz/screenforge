import { useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'
import { saveCurrentProject } from '@/lib/storage'
import type { Layer } from '@/types'

let clipboard: Layer[] = []

function isEditingInput(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if ((el as HTMLElement).isContentEditable) return true
  const canvasContainer = document.querySelector('.canvas-container')
  if (canvasContainer?.contains(el)) return true
  return false
}

export function useKeyboard(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isEditingInput()) return

      const meta = e.metaKey || e.ctrlKey
      const shift = e.shiftKey
      const key = e.key

      const {
        layers,
        selectedLayerIds,
        removeLayer,
        duplicateLayer,
        selectLayers,
        clearSelection,
        updateLayer,
        undo,
        redo,
      } = useCanvasStore.getState()

      const {
        zoomIn,
        zoomOut,
        resetZoom,
        setShowTemplatesPicker,
        setShowGlobalsEditor,
        setShowExportDialog,
      } = useUIStore.getState()

      if (meta && !shift && key === 's') {
        e.preventDefault()
        void saveCurrentProject().catch(() => undefined)
        return
      }

      // Undo
      if (meta && !shift && key === 'z') {
        e.preventDefault()
        undo()
        return
      }

      // Redo
      if (meta && shift && key === 'z') {
        e.preventDefault()
        redo()
        return
      }

      // Copy
      if (meta && !shift && key === 'c') {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        clipboard = layers
          .filter((l) => selectedLayerIds.includes(l.id))
          .map((l) => ({ ...l }))
        return
      }

      // Paste
      if (meta && !shift && key === 'v') {
        if (clipboard.length === 0) return
        e.preventDefault()
        const newIds: string[] = []
        for (const layer of clipboard) {
          const newLayer: Layer = {
            ...layer,
            id: crypto.randomUUID(),
            name: `${layer.name} copy`,
            x: layer.x + 20,
            y: layer.y + 20,
          }
          useCanvasStore.getState().addLayer(newLayer)
          newIds.push(newLayer.id)
        }
        selectLayers(newIds)
        return
      }

      // Duplicate
      if (meta && !shift && key === 'd') {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        for (const id of selectedLayerIds) {
          duplicateLayer(id)
        }
        return
      }

      // Delete
      if (key === 'Delete' || key === 'Backspace') {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        for (const id of selectedLayerIds) {
          removeLayer(id)
        }
        clearSelection()
        return
      }

      // Select all
      if (meta && !shift && key === 'a') {
        e.preventDefault()
        selectLayers(layers.map((l) => l.id))
        return
      }

      // Escape
      if (key === 'Escape') {
        const ui = useUIStore.getState()
        if (ui.showExportDialog) {
          setShowExportDialog(false)
          return
        }
        if (ui.showTemplatesPicker) {
          setShowTemplatesPicker(false)
          return
        }
        if (ui.showGlobalsEditor) {
          setShowGlobalsEditor(false)
          return
        }
        clearSelection()
        return
      }

      // Arrow nudge
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)
      ) {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        const delta = shift ? 10 : 1
        const dx =
          key === 'ArrowLeft' ? -delta : key === 'ArrowRight' ? delta : 0
        const dy =
          key === 'ArrowUp' ? -delta : key === 'ArrowDown' ? delta : 0
        for (const id of selectedLayerIds) {
          const layer = layers.find((l) => l.id === id)
          if (!layer) continue
          updateLayer(id, { x: layer.x + dx, y: layer.y + dy })
        }
        return
      }

      // Zoom in
      if (meta && (key === '+' || key === '=')) {
        e.preventDefault()
        zoomIn()
        return
      }

      // Zoom out
      if (meta && key === '-') {
        e.preventDefault()
        zoomOut()
        return
      }

      // Reset zoom
      if (meta && key === '0') {
        e.preventDefault()
        resetZoom()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
