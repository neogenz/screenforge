import { useEffect, useRef, useCallback } from 'react'
import { Canvas, Rect, Textbox, Shadow, Gradient, Group, Point, type FabricObject } from 'fabric'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { layerToFabricObject, fabricObjectToLayerUpdate } from '@/components/canvas/canvas-utils'
import { getDeviceFrame } from '@/assets/device-frames'
import type { Background, Layer, Screen, DeviceFrameLayer } from '@/types'

export const SCREEN_WIDTH = 440
export const SCREEN_HEIGHT = 956
const SCREEN_GAP = 40

export function getScreenOffset(i: number) { return i * (SCREEN_WIDTH + SCREEN_GAP) }
export function getTotalWidth(n: number) { return n < 1 ? SCREEN_WIDTH : n * SCREEN_WIDTH + (n - 1) * SCREEN_GAP }

/**
 * Group clipPath covering ALL screen areas but NOT the gaps.
 * Applied to every user layer so content is visible on screens,
 * hidden in gaps, and flows naturally across screen boundaries.
 */
function makeScreensClipPath(screenCount: number): Group {
  const rects: Rect[] = []
  for (let i = 0; i < screenCount; i++) {
    rects.push(new Rect({
      left: getScreenOffset(i),
      top: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    }))
  }
  return new Group(rects, { absolutePositioned: true })
}

function bgFill(bg: Background, w: number, h: number): string | Gradient<'linear'> | Gradient<'radial'> {
  if (bg.type === 'solid') return bg.color
  if (bg.type === 'linear-gradient') {
    const r = (bg.angle * Math.PI) / 180
    return new Gradient<'linear'>({ type: 'linear', coords: {
      x1: w/2 - Math.cos(r)*w/2, y1: h/2 - Math.sin(r)*h/2,
      x2: w/2 + Math.cos(r)*w/2, y2: h/2 + Math.sin(r)*h/2,
    }, colorStops: bg.stops })
  }
  const cx = (bg.centerX ?? 50) / 100, cy = (bg.centerY ?? 50) / 100
  return new Gradient<'radial'>({ type: 'radial', coords: {
    x1: w*cx, y1: h*cy, r1: 0, x2: w*cx, y2: h*cy, r2: Math.max(w, h)/2,
  }, colorStops: bg.stops })
}

type D = FabricObject & { data?: Record<string, unknown> }

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const syncing = useRef(false)
  const syncVersion = useRef(0)
  const panning = useRef(false)
  const panPt = useRef<{ x: number; y: number } | null>(null)
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbGen = useRef(0)
  const setZoom = useUIStore(s => s.setZoom)

  /** Generate thumbnails by cropping each screen from the rendered lowerCanvasEl.
   *  Uses getBoundingRect() on background rects to get EXACT pixel coordinates —
   *  no manual DPR/viewport math needed. */
  const generateThumbnails = useCallback((screens: Screen[]) => {
    if (thumbTimer.current) clearTimeout(thumbTimer.current)
    const gen = ++thumbGen.current
    thumbTimer.current = setTimeout(() => {
      const canvas = fabricRef.current
      if (!canvas || gen !== thumbGen.current) return

      const sourceEl = canvas.lowerCanvasEl
      if (!sourceEl) return

      // Save viewport, fit all screens, render — then crop — then restore.
      // renderAll() is synchronous so the browser never repaints the fitAll state.
      const savedVpt = [...canvas.viewportTransform] as typeof canvas.viewportTransform

      // Compute a viewport that shows ALL screens with margin
      type D = FabricObject & { data?: Record<string, unknown> }
      const bgs = (canvas.getObjects() as D[]).filter(o => o.data?.type === 'bg')
      if (bgs.length === 0) return

      // Find the bounding box of ALL bg rects (using aCoords for correct corners)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const bg of bgs) {
        const tl = bg.aCoords.tl, br = bg.aCoords.br
        minX = Math.min(minX, tl.x); minY = Math.min(minY, tl.y)
        maxX = Math.max(maxX, br.x); maxY = Math.max(maxY, br.y)
      }
      const contentW = maxX - minX, contentH = maxY - minY
      const pad = 20
      const cw = canvas.width, ch = canvas.height
      const fitZoom = Math.min((cw - pad * 2) / contentW, (ch - pad * 2) / contentH, 1)
      const fitPanX = (cw - contentW * fitZoom) / 2 - minX * fitZoom
      const fitPanY = (ch - contentH * fitZoom) / 2 - minY * fitZoom

      canvas.viewportTransform = [fitZoom, 0, 0, fitZoom, fitPanX, fitPanY]
      canvas.calcViewportBoundaries()
      canvas.renderAll()

      const dpr = canvas.getRetinaScaling()
      const thumbW = Math.round(SCREEN_WIDTH * 0.2)
      const thumbH = Math.round(SCREEN_HEIGHT * 0.2)
      const thumbs: Record<string, string> = {}

      for (let i = 0; i < screens.length; i++) {
        if (gen !== thumbGen.current) break
        const sc = screens[i]
        try {
          const bgObj = bgs.find(o => o.data?.uid === `bg-${sc.id}`)
          if (!bgObj) continue

          const tl = bgObj.aCoords.tl
          const br = bgObj.aCoords.br
          const zoom = fitZoom

          const srcX = (tl.x * zoom + fitPanX) * dpr
          const srcY = (tl.y * zoom + fitPanY) * dpr
          const srcW = (br.x - tl.x) * zoom * dpr
          const srcH = (br.y - tl.y) * zoom * dpr

          if (srcW <= 0 || srcH <= 0) continue

          const crop = document.createElement('canvas')
          crop.width = thumbW
          crop.height = thumbH
          const ctx = crop.getContext('2d')!
          ctx.drawImage(sourceEl, srcX, srcY, srcW, srcH, 0, 0, thumbW, thumbH)
          thumbs[sc.id] = crop.toDataURL('image/png')
        } catch { /* skip */ }
      }

      // Restore original viewport immediately — no visual flicker
      canvas.viewportTransform = savedVpt
      canvas.calcViewportBoundaries()
      canvas.renderAll()

      if (gen !== thumbGen.current) return

      const p = useProjectStore.getState().project
      if (p) {
        const updatedScreens = p.screens.map(s =>
          thumbs[s.id] && s.thumbnail !== thumbs[s.id]
            ? { ...s, thumbnail: thumbs[s.id] }
            : s
        )
        if (updatedScreens.some((s, i) => s !== p.screens[i])) {
          useProjectStore.setState({ project: { ...p, screens: updatedScreens } })
        }
      }
    }, 600)
  }, [])

  const fitAll = useCallback((c: Canvas, n: number) => {
    const tw = getTotalWidth(n), pad = 80
    const cw = c.width ?? 800, ch = c.height ?? 600
    const s = Math.min((cw - pad*2) / tw, (ch - pad*2) / SCREEN_HEIGHT, 1)
    c.setViewportTransform([s, 0, 0, s, (cw - tw*s)/2, (ch - SCREEN_HEIGHT*s)/2])
    setZoom(s)
  }, [setZoom])

  const sync = useCallback(async (screens: Screen[]) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const ver = ++syncVersion.current
    syncing.current = true

    try {
    const objs = canvas.getObjects() as D[]
    const map = new Map<string, D>()
    for (const o of objs) {
      const u = o.data?.uid as string
      if (u) {
        if (map.has(u)) canvas.remove(o)
        else map.set(u, o)
      }
    }

    const want = new Set<string>()
    for (const sc of screens) {
      want.add(`bg-${sc.id}`); want.add(`lbl-${sc.id}`)
      for (const l of sc.layers) want.add(l.id)
    }
    for (const o of objs) { const u = o.data?.uid as string; if (u && !want.has(u)) canvas.remove(o) }

    // Shared clipPath: visible on all screens, hidden in gaps
    const clip = makeScreensClipPath(screens.length)

    for (let i = 0; i < screens.length; i++) {
      const sc = screens[i], off = getScreenOffset(i)

      // BG
      const bgId = `bg-${sc.id}`, fill = bgFill(sc.background, SCREEN_WIDTH, SCREEN_HEIGHT)
      const eBg = map.get(bgId)
      if (eBg) { eBg.set({ left: off, fill }); eBg.setCoords() }
      else {
        const r = new Rect({ left: off, top: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT,
          fill, rx: 4, ry: 4, selectable: false, evented: false,
          shadow: new Shadow({ color: 'rgba(0,0,0,0.25)', blur: 16, offsetX: 0, offsetY: 3 }) })
        r.set('data', { uid: bgId, type: 'bg', screenId: sc.id })
        canvas.add(r); canvas.sendObjectToBack(r)
      }

      // Label
      const lId = `lbl-${sc.id}`, eL = map.get(lId)
      if (eL) { eL.set({ left: off + 8, text: sc.name } as Record<string, unknown>); eL.setCoords() }
      else {
        const t = new Textbox(sc.name, { left: off + 8, top: SCREEN_HEIGHT - 24, width: SCREEN_WIDTH - 16,
          fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif', fill: 'rgba(255,255,255,0.3)',
          selectable: false, evented: false, editable: false, textAlign: 'left' })
        t.set('data', { uid: lId, type: 'lbl', screenId: sc.id }); canvas.add(t)
      }

      // Layers — clipped to all screen areas (Group clipPath)
      for (const layer of sc.layers) {
        const ex = map.get(layer.id)
        if (ex) {
          if (layer.type === 'device-frame') {
            const dfl = layer as DeviceFrameLayer, prev = ex.data as Record<string, unknown> | undefined
            if (prev?.deviceModel !== dfl.deviceModel || prev?.deviceColor !== dfl.deviceColor ||
                prev?.orientation !== dfl.orientation || prev?.screenshotUrl !== dfl.screenshotUrl) {
              try {
                const o = await layerToFabricObject(layer)
                if (syncVersion.current !== ver) return
                canvas.remove(ex)
                o.set({ left: layer.x + off }); o.clipPath = clip
                o.set('data', { ...(o as D).data, uid: layer.id, screenId: sc.id })
                canvas.add(o)
              } catch (e) { console.error('device recreate:', e) }
              continue
            }
            const cfg = getDeviceFrame(dfl.deviceModel)
            ex.set({ left: layer.x + off, top: layer.y, angle: layer.rotation,
              opacity: layer.opacity, visible: layer.visible,
              scaleX: layer.width / cfg.width, scaleY: layer.height / cfg.height })
            ex.clipPath = clip; ex.setCoords()
          } else {
            ex.set({ left: layer.x + off, top: layer.y, angle: layer.rotation,
              opacity: layer.opacity, visible: layer.visible })
            ex.clipPath = clip; ex.setCoords()
          }
        } else {
          try {
            const o = await layerToFabricObject(layer)
            if (syncVersion.current !== ver) return
            o.set({ left: layer.x + off }); o.clipPath = clip
            o.set('data', { ...(o as D).data, uid: layer.id, screenId: sc.id })
            canvas.add(o)
          } catch (e) { console.error('layer create:', layer.id, e) }
        }
      }
    }

    for (const o of canvas.getObjects() as D[]) { if (o.data?.type === 'bg') canvas.sendObjectToBack(o) }
    canvas.requestRenderAll()
    generateThumbnails(screens)
    } finally {
      if (syncVersion.current === ver) {
        requestAnimationFrame(() => { syncing.current = false })
      }
    }
  }, [generateThumbnails])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const container = containerRef.current
    const { width, height } = container.getBoundingClientRect()
    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: 'transparent', width, height, selection: true, preserveObjectStacking: true,
    })
    fabricRef.current = canvas

    canvas.on('object:modified', (e) => {
      if (syncing.current) return
      const obj = e.target as D
      const lid = obj?.data?.uid as string, sid = obj?.data?.screenId as string
      if (!lid || !sid || obj.data?.type === 'bg' || obj.data?.type === 'lbl') return
      const proj = useProjectStore.getState().project; if (!proj) return
      const si = proj.screens.findIndex(s => s.id === sid); if (si === -1) return
      const aid = useCanvasStore.getState().activeScreenId
      if (sid === aid) useHistoryStore.getState().record(JSON.stringify(useCanvasStore.getState().layers))
      const upd = fabricObjectToLayerUpdate(obj); upd.x = (upd.x ?? 0) - getScreenOffset(si)
      useProjectStore.getState().updateScreenLayer(sid, lid, upd as Partial<Layer>)
      if (sid === aid) useCanvasStore.getState().syncLayersFromProject()
    })

    function handleSel(sel: FabricObject[]) {
      if (syncing.current) return
      const ids: string[] = []; let fs: string | null = null
      for (const o of sel) {
        const d = (o as D).data; if (!d || d.type === 'bg' || d.type === 'lbl') continue
        if (d.uid) { ids.push(d.uid as string); if (!fs) fs = d.screenId as string }
      }
      if (fs && fs !== useCanvasStore.getState().activeScreenId) useCanvasStore.getState().setActiveScreenId(fs)
      if (ids.length === 1) useCanvasStore.getState().selectLayer(ids[0])
      else if (ids.length > 1) useCanvasStore.getState().selectLayers(ids)
    }
    canvas.on('selection:created', e => handleSel(e.selected ?? []))
    canvas.on('selection:updated', e => handleSel(e.selected ?? []))
    canvas.on('selection:cleared', () => { if (!syncing.current) useCanvasStore.getState().clearSelection() })

    canvas.on('mouse:wheel', (opt: { e: WheelEvent }) => {
      const { e } = opt; e.preventDefault()
      if (e.metaKey || e.ctrlKey) {
        let z = canvas.getZoom() * (0.999 ** e.deltaY)
        z = Math.min(4, Math.max(0.1, z)); canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), z); setZoom(z)
      } else canvas.relativePan(new Point(-e.deltaX, -e.deltaY))
      // Regenerate thumbnails after viewport change
      const pr = useProjectStore.getState().project
      if (pr) generateThumbnails(pr.screens)
    })
    canvas.on('mouse:down', opt => {
      const e = opt.e as MouseEvent | TouchEvent; if (!('button' in e)) return
      if (e.altKey || e.button === 1) { panning.current = true; panPt.current = { x: e.clientX, y: e.clientY }; canvas.selection = false; canvas.setCursor('grabbing') }
    })
    canvas.on('mouse:move', opt => {
      if (!panning.current || !panPt.current) return
      const e = opt.e as MouseEvent | TouchEvent; if (!('clientX' in e)) return
      canvas.relativePan(new Point(e.clientX - panPt.current.x, e.clientY - panPt.current.y))
      panPt.current = { x: e.clientX, y: e.clientY }
    })
    canvas.on('mouse:up', () => { if (panning.current) { panning.current = false; panPt.current = null; canvas.selection = true; canvas.setCursor('default') } })

    const obs = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect; if (!r || r.width < 1) return
      canvas.setDimensions({ width: r.width, height: r.height }); canvas.requestRenderAll()
      const pr = useProjectStore.getState().project
      if (pr) generateThumbnails(pr.screens)
    })
    obs.observe(container)

    const proj = useProjectStore.getState().project
    if (proj?.screens.length) sync(proj.screens).then(() => fitAll(canvas, proj.screens.length))
    return () => { obs.disconnect(); canvas.dispose(); fabricRef.current = null }
  }, [setZoom, sync, fitAll, generateThumbnails])

  useEffect(() => useProjectStore.subscribe((s, p) => {
    if (s.project && s.project.screens !== p.project?.screens) sync(s.project.screens)
  }), [sync])

  useEffect(() => useUIStore.subscribe((s, p) => {
    const c = fabricRef.current; if (!c) return
    if (s.zoom !== p.zoom && Math.abs(c.getZoom() - s.zoom) > 0.0001) {
      if (s.zoom === 1) c.setViewportTransform([1,0,0,1,0,0])
      else c.zoomToPoint(c.getVpCenter(), s.zoom)
      c.requestRenderAll()
      const pr = useProjectStore.getState().project
      if (pr) generateThumbnails(pr.screens)
    } else if (s.viewportResetKey !== p.viewportResetKey) {
      const pr = useProjectStore.getState().project
      if (pr) { fitAll(c, pr.screens.length); c.requestRenderAll(); generateThumbnails(pr.screens) }
    }
  }), [fitAll, generateThumbnails])

  return { canvasRef, containerRef }
}
