'use client'

import { useEffect, useRef } from 'react'

/**
 * SmokeRevealBg
 * ----------------------------------------------------------------------------
 * Background-layer image reveal. Renders the BOTTOM image and the TOP image (on
 * a canvas) as an absolute, full-bleed layer that fills its closest positioned
 * ancestor (e.g. a hero <section>). Pointer listeners attach to that ancestor,
 * so hovering ANYWHERE over the hero — even over the headline and buttons —
 * erases the top image with a soft feathered brush and reveals the bottom one.
 * The erased areas slowly heal back after a couple of seconds.
 *
 * (Smoke particles were removed on request — this is now a clean wipe reveal.)
 *
 * Props: topImage, bottomImage (URLs). Config lives at the top of the component.
 */
export default function SmokeRevealBg({ topImage, bottomImage }) {
  // ── TWEAKABLE CONFIG ──────────────────────────────────────────────────────
  const CONFIG = {
    BRUSH_RADIUS: 90,      // erase brush radius (px) — bigger = wider wipe
    BRUSH_SOFTNESS: 0.35,  // where the soft feather starts (0–1, lower = foggier edge)
    BRUSH_STRENGTH: 0.5,   // how much one stamp erases (0–1)
    TRAIL_SPACING: 0.18,   // stamp spacing as a fraction of radius (smaller = smoother trail)
    HEAL_SPEED: 0.5,       // fraction healed per second (~0.5 ≈ restores in ~2.5–3s)
    MAX_DPR: 2,            // cap devicePixelRatio for performance
  }

  const rootRef = useRef(null)
  const revealCanvasRef = useRef(null)
  const stateRef = useRef({
    ctx: null, topImg: null,
    pointer: { lastX: 0, lastY: 0, has: false },
    size: { w: 0, h: 0 }, dpr: 1, raf: 0, lastT: 0, ready: false,
  })

  useEffect(() => {
    const S = stateRef.current
    const root = rootRef.current
    const revealCanvas = revealCanvasRef.current
    if (!root || !revealCanvas) return

    // The whole hero section is the event target + sizing reference.
    const host = root.parentElement || root

    S.ctx = revealCanvas.getContext('2d')

    const drawCover = (ctx, img, w, h) => {
      if (!img || !img.width || !img.height) return
      const scale = Math.max(w / img.width, h / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }

    const setupCanvas = () => {
      const rect = host.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      const dpr = Math.min(CONFIG.MAX_DPR, window.devicePixelRatio || 1)
      S.size = { w, h }
      S.dpr = dpr
      revealCanvas.width = Math.floor(w * dpr)
      revealCanvas.height = Math.floor(h * dpr)
      revealCanvas.style.width = w + 'px'
      revealCanvas.style.height = h + 'px'
      S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (S.ready) {
        S.ctx.globalCompositeOperation = 'source-over'
        S.ctx.globalAlpha = 1
        S.ctx.clearRect(0, 0, w, h)
        drawCover(S.ctx, S.topImg, w, h)
      }
    }

    const stamp = (x, y) => {
      const r = CONFIG.BRUSH_RADIUS
      const ctx = S.ctx
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(0,0,0,${CONFIG.BRUSH_STRENGTH})`)
      g.addColorStop(CONFIG.BRUSH_SOFTNESS, `rgba(0,0,0,${CONFIG.BRUSH_STRENGTH * 0.55})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
      ctx.globalCompositeOperation = 'source-over'
    }

    const handleMove = (clientX, clientY) => {
      if (!S.ready) return
      const rect = revealCanvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const p = S.pointer
      if (!p.has) {
        stamp(x, y)
      } else {
        const dx = x - p.lastX, dy = y - p.lastY
        const dist = Math.hypot(dx, dy)
        const step = Math.max(1, CONFIG.BRUSH_RADIUS * CONFIG.TRAIL_SPACING)
        const steps = Math.max(1, Math.ceil(dist / step))
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          stamp(p.lastX + dx * t, p.lastY + dy * t)
        }
      }
      p.lastX = x; p.lastY = y; p.has = true
    }

    const endPointer = () => { S.pointer.has = false }

    // Main loop: heal the top image back a little each frame.
    const frame = (t) => {
      const { ctx, size } = S
      const dt = S.lastT ? Math.min(0.05, (t - S.lastT) / 1000) : 0.016
      S.lastT = t
      const { w, h } = size
      const healAlpha = Math.min(1, CONFIG.HEAL_SPEED * dt)
      if (healAlpha > 0) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = healAlpha
        drawCover(ctx, S.topImg, w, h)
        ctx.globalAlpha = 1
      }
      S.raf = requestAnimationFrame(frame)
    }

    const onMouseMove = (e) => handleMove(e.clientX, e.clientY)
    const onMouseLeave = () => endPointer()
    const onTouchStart = (e) => { endPointer(); if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY) }
    const onTouchMove = (e) => { if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY) }
    const onTouchEnd = () => endPointer()

    let cancelled = false
    const loadImage = (src) => new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })

    Promise.all([loadImage(topImage), loadImage(bottomImage)]).then(([top]) => {
      if (cancelled) return
      S.topImg = top
      S.ready = true
      setupCanvas()
      S.lastT = 0
      S.raf = requestAnimationFrame(frame)
    })

    const ro = new ResizeObserver(() => setupCanvas())
    ro.observe(host)

    host.addEventListener('mousemove', onMouseMove)
    host.addEventListener('mouseleave', onMouseLeave)
    host.addEventListener('touchstart', onTouchStart, { passive: true })
    host.addEventListener('touchmove', onTouchMove, { passive: true })
    host.addEventListener('touchend', onTouchEnd)

    return () => {
      cancelled = true
      cancelAnimationFrame(S.raf)
      ro.disconnect()
      host.removeEventListener('mousemove', onMouseMove)
      host.removeEventListener('mouseleave', onMouseLeave)
      host.removeEventListener('touchstart', onTouchStart)
      host.removeEventListener('touchmove', onTouchMove)
      host.removeEventListener('touchend', onTouchEnd)
    }
  }, [topImage, bottomImage])

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* BOTTOM image — revealed underneath */}
      <img
        src={bottomImage}
        alt=""
        draggable="false"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* TOP image (canvas) — erased on hover */}
      <canvas ref={revealCanvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
