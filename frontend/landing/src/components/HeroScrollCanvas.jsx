import { useRef, useEffect, useState, useCallback } from 'react'
import { useScroll, useMotionValueEvent, motion } from 'framer-motion'

const TOTAL_FRAMES = 121

const getFramePath = (index) =>
  `/frames/frame_${String(index).padStart(3, '0')}_delay-0.066s.webp`

const HeroScrollCanvas = () => {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const currentFrameRef = useRef(0)
  const rafRef = useRef(null)

  const [loadedCount, setLoadedCount] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  // Preload all frames
  useEffect(() => {
    let cancelled = false
    const images = []
    let loaded = 0

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image()
      img.src = getFramePath(i)
      img.onload = img.onerror = () => {
        if (cancelled) return
        loaded++
        setLoadedCount(loaded)
        if (loaded === TOTAL_FRAMES) {
          imagesRef.current = images
          setIsLoaded(true)
        }
      }
      images[i] = img
    }

    return () => { cancelled = true }
  }, [])

  // Canvas resize
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    drawFrame(currentFrameRef.current)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    resizeCanvas()
    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [isLoaded, resizeCanvas])

  // Draw frame on canvas
  const drawFrame = useCallback((index) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imagesRef.current[index]
    if (!canvas || !ctx || !img || !img.complete) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // object-fit: cover
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
    const x = (canvas.width - img.naturalWidth * scale) / 2
    const y = (canvas.height - img.naturalHeight * scale) / 2
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale)
  }, [])

  // Scroll → frame index
  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (!isLoaded) return
    const index = Math.min(Math.floor(latest * TOTAL_FRAMES), TOTAL_FRAMES - 1)
    if (index !== currentFrameRef.current) {
      currentFrameRef.current = index
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => drawFrame(index))
    }
  })

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative" style={{ height: '500vh' }}>
      {/* Sticky canvas container */}
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ willChange: 'transform' }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          style={{ backgroundColor: '#0A0E1A' }}
        />
      </div>

      {/* Scroll progress bar */}
      {isLoaded && (
        <motion.div
          className="fixed right-4 top-0 w-[2px] z-50 origin-top"
          style={{
            height: '100vh',
            background: 'linear-gradient(to bottom, #1A56FF, #7B2FFF)',
            scaleY: scrollYProgress,
          }}
        />
      )}
    </div>
  )
}

export default HeroScrollCanvas
