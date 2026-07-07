'use client'

import { useEffect, useRef } from 'react'

/**
 * SmokeRevealHero
 * ----------------------------------------------------------------------------
 * Interactive "smoke reveal" hero. The TOP image is painted onto a <canvas>
 * that sits above a BOTTOM <img>. Moving the cursor erases the top canvas with
 * a soft, feathered radial brush (globalCompositeOperation = "destination-out"),
 * wiping fog off glass to reveal the bottom image. Small smoke particles puff
 * up from the cursor, and the erased areas slowly heal back after a couple of
 * seconds. Pure React hooks + vanilla canvas — no animation libraries.
 *
 * Props:
 *   topImage    (string)  URL of the image shown by default (painted on canvas)
 *   bottomImage (string)  URL of the image revealed underneath
 *   title       (node)    hero heading (rendered in a pointer-events:none layer)
 *   subtitle    (node)    hero subheading
 *   className   (string)  extra classes for the <section> (e.g. height override)
 *   children    (node)    optional extra overlay content (buttons, etc.)
 */
export default function SmokeRevealHero({
  topImage,
  bottomImage,
  title,
  subtitle,
  className = '',
  children,
}) {
  // ─────────────────────────────────────────────────────────────────────────
  // TWEAKABLE CONFIG — change these to tune the feel of the effect.
  // ─────────────────────────────────────────────────────────────────────────
  const CONFIG = {
    BRUSH_RADIUS: 85,      // radius (px) of the erase brush — bigger = wider wipe
    BRUSH_SOFTNESS: 0.35,  // 0–1: where the soft feather starts (lower = softer/foggier edge)
    BRUSH_STRENGTH: 0.5,   // 0–1: how much a single stamp erases (lower = needs more passes)
    TRAIL_SPACING: 0.18,   // stamp spacing as a fraction of radius (smaller = smoother trail, no gaps)

    HEAL_SPEED: 0.55,      // fraction of the top image that heals back per second
                           // (~0.5 ≈ erased areas fully restore in ~2.5–3s)

    SMOKE_INTENSITY: 2,    // smoke particles spawned per mouse-move sample
    SMOKE_LIFETIME: 1500,  // particle lifetime in ms (longer = smoke lingers)
    SMOKE_SIZE: 26,        // starting particle radius (px)
    SMOKE_GROWTH: 34,      // how fast a particle expands (px per second)
    SMOKE_DRIFT: 42,       // upward drift speed (px per second)
    SMOKE_SWAY: 22,        // random horizontal sway (px per second)
    SMOKE_ALPHA: 0.28,     // peak opacity of a smoke puff (0–1)
    SMOKE_COLOR: '230, 228, 224', // rgb of the smoke (warm off-white)
    MAX_PARTICLES: 280,    // hard cap on live particles (keeps it at 60fps)

    MAX_DPR: 2,            // cap devicePixelRatio for performance on retina screens
  }

  // Refs for everything that changes every frame — never useState here, so the
  // component does NOT re-render during the animation.
  const containerRef = useRef(null)
  const revealCanvasRef = useRef(null) // top image + erase mask
  const smokeCanvasRef = useRef(null)  // smoke particles (separate layer)

  const stateRef = useRef({
    ctx: null,
    smokeCtx: null,
    topImg: null,
    particles: [],
    pointer: { x: 0, y: 0, lastX: 0, lastY: 0, has: false },
    size: { w: 0, h: 0 },
    dpr: 1,
    raf: 0,
    lastT: 0,
    ready: false,
  })

  useEffect(() => {
    const S = stateRef.current
    const container = containerRef.current
    const revealCanvas = revealCanvasRef.current
    const smokeCanvas = smokeCanvasRef.current
    if (!container || !revealCanvas || !smokeCanvas) return

    S.ctx = revealCanvas.getContext('2d')
    S.smokeCtx = smokeCanvas.getContext('2d')

    // ── Draw an image with "object-fit: cover" behaviour ────────────────────
    const drawCover = (ctx, img, w, h) => {
      if (!img || !img.width || !img.height) return
      const scale = Math.max(w / img.width, h / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }

    // ── Size / resize both canvases to the container (DPR-aware) ────────────
    const setupCanvas = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      const dpr = Math.min(CONFIG.MAX_DPR, window.devicePixelRatio || 1)
      S.size = { w, h }
      S.dpr = dpr

      for (const canvas of [revealCanvas, smokeCanvas]) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        const ctx = canvas.getContext('2d')
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      // Repaint the top image fully (resizing resets the erased mask).
      if (S.ready) {
        S.ctx.globalCompositeOperation = 'source-over'
        S.ctx.globalAlpha = 1
        S.ctx.clearRect(0, 0, w, h)
        drawCover(S.ctx, S.topImg, w, h)
      }
    }

    // ── Soft feathered erase stamp at (x, y) ────────────────────────────────
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

    // ── Spawn a few smoke particles at (x, y) ───────────────────────────────
    const spawnSmoke = (x, y) => {
      const P = S.particles
      for (let i = 0; i < CONFIG.SMOKE_INTENSITY; i++) {
        if (P.length >= CONFIG.MAX_PARTICLES) break
        P.push({
          x: x + (Math.random() - 0.5) * CONFIG.BRUSH_RADIUS * 0.5,
          y: y + (Math.random() - 0.5) * CONFIG.BRUSH_RADIUS * 0.5,
          vx: (Math.random() - 0.5) * CONFIG.SMOKE_SWAY,
          vy: -CONFIG.SMOKE_DRIFT * (0.6 + Math.random() * 0.8),
          size: CONFIG.SMOKE_SIZE * (0.6 + Math.random() * 0.8),
          grow: CONFIG.SMOKE_GROWTH * (0.6 + Math.random() * 0.8),
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 1.2, // slight rotation (rad/sec)
          life: 1,
          decay: 1 / (CONFIG.SMOKE_LIFETIME / 1000),
        })
      }
    }

    // ── Handle a pointer sample: interpolate the trail + erase + smoke ──────
    const handleMove = (clientX, clientY) => {
      if (!S.ready) return
      const rect = revealCanvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const p = S.pointer

      if (!p.has) {
        // First sample (or after leaving) — no trail to interpolate yet.
        stamp(x, y)
        spawnSmoke(x, y)
      } else {
        const dx = x - p.lastX
        const dy = y - p.lastY
        const dist = Math.hypot(dx, dy)
        const step = Math.max(1, CONFIG.BRUSH_RADIUS * CONFIG.TRAIL_SPACING)
        const steps = Math.max(1, Math.ceil(dist / step))
        // Interpolate between the previous and current point → gapless trail.
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          stamp(p.lastX + dx * t, p.lastY + dy * t)
        }
        spawnSmoke(x, y)
      }
      p.lastX = x
      p.lastY = y
      p.x = x
      p.y = y
      p.has = true
    }

    const endPointer = () => {
      S.pointer.has = false // reset so the next entry doesn't draw a long jump-line
    }

    // ── Main animation loop: heal the top image + animate the smoke ─────────
    const frame = (t) => {
      const { ctx, smokeCtx, size } = S
      const dt = S.lastT ? Math.min(0.05, (t - S.lastT) / 1000) : 0.016
      S.lastT = t
      const { w, h } = size

      // 1) HEAL — redraw the top image at a small alpha so erased pixels slowly
      //    come back. Areas under the cursor get re-erased, so they stay clear.
      const healAlpha = Math.min(1, CONFIG.HEAL_SPEED * dt)
      if (healAlpha > 0) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = healAlpha
        drawCover(ctx, S.topImg, w, h)
        ctx.globalAlpha = 1
      }

      // 2) SMOKE — clear the smoke layer, then update + draw each particle.
      smokeCtx.clearRect(0, 0, w, h)
      const P = S.particles
      for (let i = P.length - 1; i >= 0; i--) {
        const s = P[i]
        s.life -= s.decay * dt
        if (s.life <= 0) {
          P.splice(i, 1)
          continue
        }
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.size += s.grow * dt
        s.rot += s.vrot * dt
        s.vy *= 0.99 // ease the rise slightly as it ages

        // Fade in then out over the particle's life (life goes 1 → 0).
        const alpha = Math.sin(s.life * Math.PI) * CONFIG.SMOKE_ALPHA
        smokeCtx.save()
        smokeCtx.globalAlpha = alpha
        smokeCtx.translate(s.x, s.y)
        smokeCtx.rotate(s.rot)
        smokeCtx.scale(1, 0.82) // squash slightly so the rotation reads as motion
        const g = smokeCtx.createRadialGradient(0, 0, 0, 0, 0, s.size)
        g.addColorStop(0, `rgba(${CONFIG.SMOKE_COLOR}, 0.9)`)
        g.addColorStop(0.6, `rgba(${CONFIG.SMOKE_COLOR}, 0.25)`)
        g.addColorStop(1, `rgba(${CONFIG.SMOKE_COLOR}, 0)`)
        smokeCtx.fillStyle = g
        smokeCtx.beginPath()
        smokeCtx.arc(0, 0, s.size, 0, Math.PI * 2)
        smokeCtx.fill()
        smokeCtx.restore()
      }

      S.raf = requestAnimationFrame(frame)
    }

    // ── Event handlers ──────────────────────────────────────────────────────
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY)
    const onMouseLeave = () => endPointer()
    const onTouchStart = (e) => {
      // Reset the trail so touching down doesn't streak from the last touch.
      endPointer()
      if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onTouchMove = (e) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onTouchEnd = () => endPointer()

    // ── Load BOTH images before drawing anything ────────────────────────────
    let cancelled = false
    const loadImage = (src) =>
      new Promise((resolve) => {
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
      setupCanvas() // sizes canvases + paints the full top image
      S.lastT = 0
      S.raf = requestAnimationFrame(frame)
    })

    // ── Resize handling ─────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => setupCanvas())
    ro.observe(container)

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    container.addEventListener('touchend', onTouchEnd)

    // ── Cleanup: cancel frames + remove every listener/observer ─────────────
    return () => {
      cancelled = true
      cancelAnimationFrame(S.raf)
      ro.disconnect()
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      S.particles = []
    }
    // topImage/bottomImage identity drives a full reload+redraw when they change.
  }, [topImage, bottomImage])

  return (
    <section
      ref={containerRef}
      className={
        'relative w-full overflow-hidden select-none ' +
        'min-h-[600px] md:min-h-[720px] lg:min-h-[760px] ' +
        className
      }
    >
      {/* BOTTOM image — revealed underneath */}
      <img
        src={bottomImage}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* TOP image layer (canvas) — erased on hover to reveal the bottom image */}
      <canvas
        ref={revealCanvasRef}
        className="absolute inset-0 h-full w-full"
      />

      {/* SMOKE particle layer — above the reveal, ignores pointer events */}
      <canvas
        ref={smokeCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Legibility scrim (does not block the effect) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(8,9,11,0.72) 0%, rgba(8,9,11,0.35) 45%, rgba(8,9,11,0) 75%)',
        }}
      />

      {/* TEXT layer — above everything, pointer-events:none so hovering still
          triggers the reveal on the canvas underneath */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-[1320px] px-6 md:px-10 xl:px-12">
          {title && (
            <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              {subtitle}
            </p>
          )}
          {/* Buttons/extra content should be clickable, so re-enable pointer events */}
          {children && <div className="pointer-events-auto mt-8">{children}</div>}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
 * USAGE EXAMPLE
 * ───────────────────────────────────────────────────────────────────────────
 *
 * import SmokeRevealHero from '@/landing/components/SmokeRevealHero'
 *
 * export default function Page() {
 *   return (
 *     <SmokeRevealHero
 *       topImage="/images/reaveal1.png"
 *       bottomImage="/images/reaveal2.png"
 *       title={<>Trade Globally<br />Prosper Limitlessly</>}
 *       subtitle="Experience next-level trading with ARTHA FX where technology meets opportunity."
 *     >
 *       <div className="flex gap-4">
 *         <button className="rounded-full bg-amber-400 px-6 py-3 font-semibold text-black">
 *           Open Live Account
 *         </button>
 *         <button className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white">
 *           Try Demo Account
 *         </button>
 *       </div>
 *     </SmokeRevealHero>
 *   )
 * }
 *
 * // Match a specific hero height by passing height classes via className, e.g.:
 * //   <SmokeRevealHero className="min-h-[560px]" ... />
 * ─────────────────────────────────────────────────────────────────────────── */
