'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import {
  ArrowRight, Zap, TrendingDown, Lock, BarChart3, CreditCard, Globe,
  Monitor, Smartphone, Shield, Menu, X, ChevronDown, Twitter, Linkedin,
  Instagram, Youtube,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   HERO SCROLL CANVAS — 121-frame scroll-linked animation
   ═══════════════════════════════════════════════════════════ */
const TOTAL_FRAMES = 121
const getFramePath = (i: number) => `/frames/frame_${String(i).padStart(3, '0')}_delay-0.066s.webp`

function HeroScrollCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const currentFrameRef = useRef(0)
  const rafRef = useRef<number>(0)

  const [loadedCount, setLoadedCount] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loaderVisible, setLoaderVisible] = useState(true)

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  useEffect(() => {
    let cancelled = false
    const images: HTMLImageElement[] = []
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
          setTimeout(() => setLoaderVisible(false), 400)
        }
      }
      images[i] = img
    }
    return () => { cancelled = true }
  }, [])

  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imagesRef.current[index]
    if (!canvas || !ctx || !img || !img.complete) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
    const x = (canvas.width - img.naturalWidth * scale) / 2
    const y = (canvas.height - img.naturalHeight * scale) / 2
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale)
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    drawFrame(currentFrameRef.current)
  }, [drawFrame])

  useEffect(() => {
    if (!isLoaded) return
    resizeCanvas()
    const obs = new ResizeObserver(resizeCanvas)
    obs.observe(document.documentElement)
    return () => obs.disconnect()
  }, [isLoaded, resizeCanvas])

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (!isLoaded) return
    const index = Math.min(Math.floor(latest * TOTAL_FRAMES), TOTAL_FRAMES - 1)
    if (index !== currentFrameRef.current) {
      currentFrameRef.current = index
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => drawFrame(index))
    }
  })

  const progress = (loadedCount / TOTAL_FRAMES) * 100

  return (
    <div ref={containerRef} className="relative" style={{ height: '500vh' }}>
      {loaderVisible && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center transition-opacity duration-500" style={{ backgroundColor: '#0A0E1A', opacity: isLoaded ? 0 : 1, pointerEvents: isLoaded ? 'none' : 'all' }}>
          <div className="flex items-center gap-3 mb-8">
            <img src="/images/logo1.png" alt="TrustEdgeFX" className="h-12 w-auto" />
          </div>
          <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-200" style={{ width: `${progress}%`, background: 'linear-gradient(to right, #1A56FF, #7B2FFF)' }} />
          </div>
          <p className="text-[#8B9AB2] text-sm mt-4">Loading experience... {Math.round(progress)}%</p>
        </div>
      )}
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ willChange: 'transform' }}>
        <canvas ref={canvasRef} className="block w-full h-full" style={{ backgroundColor: '#0A0E1A' }} />
      </div>
      {isLoaded && (
        <motion.div className="fixed right-4 top-0 w-[2px] z-50 origin-top" style={{ height: '100vh', background: 'linear-gradient(to bottom, #1A56FF, #7B2FFF)', scaleY: scrollYProgress }} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   HERO OVERLAY — text sections that fade in/out on scroll
   ═══════════════════════════════════════════════════════════ */
function OverlaySection({ scrollYProgress, fadeIn, fadeOut, align = 'center', children }: { scrollYProgress: any; fadeIn: number[]; fadeOut: number[]; align?: string; children: React.ReactNode }) {
  const opacity = useTransform(scrollYProgress, [fadeIn[0], fadeIn[1], fadeOut[0], fadeOut[1]], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [fadeIn[0], fadeOut[1]], [40, -40])
  const alignClass = align === 'left' ? 'items-start text-left pl-6 md:pl-16 lg:pl-32' : align === 'right' ? 'items-end text-right pr-6 md:pr-16 lg:pr-32' : 'items-center text-center'

  return (
    <motion.div className={`absolute inset-0 z-10 flex flex-col justify-center ${alignClass} pointer-events-none`} style={{ opacity, y }}>
      <div className="pointer-events-auto">{children}</div>
    </motion.div>
  )
}

function HeroOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  return (
    <div ref={containerRef} className="absolute inset-0 z-10" style={{ height: '500vh', pointerEvents: 'none' }}>
      <div className="sticky top-0 h-screen w-full">
        <OverlaySection scrollYProgress={scrollYProgress} fadeIn={[0.3, 0.35]} fadeOut={[0.5, 0.55]} align="left">
          <div className="max-w-2xl">
            <span className="text-sm uppercase tracking-widest text-blue-400 mb-3 block font-semibold">Global Markets</span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              60+ Currency Pairs. <br /><span className="bg-gradient-to-r from-[#1A56FF] to-[#7B2FFF] bg-clip-text text-transparent">Zero Compromise.</span>
            </h2>
            <p className="text-lg text-gray-300 mt-4 max-w-xl">Spreads from 0.0 pips. Leverage up to 1:500.</p>
            <Link href="/auth/register" className="inline-flex items-center gap-2 text-blue-400 hover:text-white transition-colors font-semibold text-lg mt-6">
              Trade Forex <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </OverlaySection>

        <OverlaySection scrollYProgress={scrollYProgress} fadeIn={[0.6, 0.65]} fadeOut={[0.8, 0.85]} align="right">
          <div className="max-w-2xl">
            <span className="text-sm uppercase tracking-widest text-blue-400 mb-3 block font-semibold">Your Edge</span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              Powered by <br /><span className="bg-gradient-to-r from-[#1A56FF] to-[#7B2FFF] bg-clip-text text-transparent">Advanced Charts & Copy Trading.</span>
            </h2>
            <p className="text-lg text-gray-300 mt-4 max-w-xl ml-auto">Trade, copy top performers, invest in managed accounts.</p>
            <Link href="/auth/register" className="inline-flex items-center gap-2 text-blue-400 hover:text-white transition-colors font-semibold text-lg mt-6">
              Get Started <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </OverlaySection>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   STAT BOX — Animated counter
   ═══════════════════════════════════════════════════════════ */
function StatBox({ value, label }: { value: string; label: string }) {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setIsVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const num = parseFloat(value.replace(/[^0-9.]/g, ''))
    const steps = 60
    const inc = num / steps
    let cur = 0
    const t = setInterval(() => {
      cur += inc
      if (cur >= num) { setCount(num); clearInterval(t) } else setCount(cur)
    }, 2000 / steps)
    return () => clearInterval(t)
  }, [isVisible, value])

  const fmt = (n: number) => {
    if (value.includes('B')) return `$${n.toFixed(1)}B`
    if (value.includes('K')) return `${Math.floor(n)}K`
    if (value.includes('+')) return `${Math.floor(n)}+`
    return Math.floor(n).toString()
  }

  return (
    <div ref={ref} className="bg-white/[0.04] backdrop-blur-[10px] border border-white/[0.08] rounded-2xl p-8 text-center">
      <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#1A56FF] to-[#7B2FFF] bg-clip-text text-transparent mb-2">
        {isVisible ? fmt(count) : value}
      </div>
      <div className="text-[#8B9AB2] text-sm">{label}</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════════ */
function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDD, setActiveDD] = useState<string | null>(null)

  useEffect(() => {
    const h = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const navLinks = [
    { name: 'Trading', items: [{ name: 'Forex', path: '/auth/register' }, { name: 'Crypto', path: '/auth/register' }, { name: 'Indices', path: '/auth/register' }] },
    { name: 'Platforms', items: [{ name: 'Web Platform', path: '/auth/register' }, { name: 'Mobile App', path: '/auth/register' }] },
    { name: 'Company', items: [{ name: 'About Us', path: '/about' }, { name: 'Contact', path: '/contact' }] },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-[#0A0E1A]/80 backdrop-blur-lg border-b border-white/10' : 'bg-transparent'}`}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center group">
            <img src="/images/logo1.png" alt="TrustEdgeFX" className="h-10 w-auto group-hover:scale-110 transition-transform" />
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <div key={link.name} className="relative group" onMouseEnter={() => setActiveDD(link.name)} onMouseLeave={() => setActiveDD(null)}>
                <button className="flex items-center space-x-1 text-[#8B9AB2] hover:text-white transition-colors py-2">
                  <span>{link.name}</span><ChevronDown className="w-4 h-4" />
                </button>
                <div className={`absolute top-full left-0 mt-2 w-48 bg-white/[0.04] backdrop-blur-[10px] border border-white/[0.08] rounded-2xl p-2 transition-all duration-200 ${activeDD === link.name ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}>
                  {link.items.map((item) => (
                    <Link key={item.path + item.name} href={item.path} className="block px-4 py-2 text-[#8B9AB2] hover:text-white hover:bg-white/5 rounded-lg transition-all">
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:flex items-center space-x-4">
            <Link href="/auth/login" className="text-[#8B9AB2] hover:text-white transition-colors px-6 py-2">Login</Link>
            <Link href="/auth/register" className="bg-[#1A56FF] text-white px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(26,86,255,0.5)]">
              Open Account
            </Link>
          </div>

          <button className="lg:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-white/[0.04] backdrop-blur-[10px] border border-white/[0.08] rounded-2xl my-4 p-4 animate-fade-in">
            {navLinks.map((link) => (
              <div key={link.name} className="mb-4">
                <div className="text-white font-semibold mb-2">{link.name}</div>
                {link.items.map((item) => (
                  <Link key={item.path + item.name} href={item.path} className="block px-4 py-2 text-[#8B9AB2] hover:text-white hover:bg-white/5 rounded-lg transition-all" onClick={() => setMobileOpen(false)}>
                    {item.name}
                  </Link>
                ))}
              </div>
            ))}
            <div className="flex flex-col space-y-2 mt-4 pt-4 border-t border-white/10">
              <Link href="/auth/login" className="border-2 border-white/20 text-white px-6 py-3 rounded-full font-semibold text-center hover:bg-white/10">Login</Link>
              <Link href="/auth/register" className="bg-[#1A56FF] text-white px-6 py-3 rounded-full font-semibold text-center hover:shadow-[0_0_30px_rgba(26,86,255,0.5)]">Open Account</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
function LandingFooter() {
  const links = {
    trading: [{ name: 'Forex', path: '/auth/register' }, { name: 'Crypto', path: '/auth/register' }, { name: 'Indices', path: '/auth/register' }],
    company: [{ name: 'About Us', path: '/about' }, { name: 'Contact', path: '/contact' }],
    legal: [{ name: 'Privacy Policy', path: '/privacy' }, { name: 'Terms', path: '/terms' }, { name: 'Risk Disclosure', path: '/risk' }],
  }
  const socials = [{ icon: Twitter, label: 'Twitter' }, { icon: Linkedin, label: 'LinkedIn' }, { icon: Instagram, label: 'Instagram' }, { icon: Youtube, label: 'YouTube' }]

  return (
    <footer className="bg-[#070B15] border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div>
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#1A56FF] to-[#7B2FFF] rounded-lg flex items-center justify-center"><Shield className="w-6 h-6 text-white" /></div>
              <span className="text-2xl font-bold text-white">TrustEdgeFX</span>
            </Link>
            <p className="text-[#8B9AB2] mb-6">Trade with confidence. Trade with TrustEdgeFX.</p>
            <div className="flex space-x-4">
              {socials.map((s) => (<a key={s.label} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><s.icon className="w-5 h-5 text-[#8B9AB2]" /></a>))}
            </div>
          </div>
          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h3 className="text-white font-semibold mb-4 capitalize">{title}</h3>
              <ul className="space-y-2">
                {items.map((l) => (<li key={l.name}><Link href={l.path} className="text-[#8B9AB2] hover:text-white transition-colors">{l.name}</Link></li>))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-white/5">
          <p className="text-[#8B9AB2] text-sm text-center">2025 TrustEdgeFX Ltd. All rights reserved. | Risk Warning: Trading involves significant risk of loss.</p>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════ */
const features = [
  { icon: Zap, title: 'Ultra-Fast Execution', description: 'Orders executed in under 30ms with zero requotes.' },
  { icon: TrendingDown, title: 'Tight Spreads', description: 'Spreads from 0.0 pips on major currency pairs.' },
  { icon: Lock, title: 'Secure & Regulated', description: 'Client funds held in segregated accounts. Fully licensed.' },
  { icon: BarChart3, title: 'Advanced Charting', description: 'Integrated TradingView charts with 100+ indicators.' },
  { icon: CreditCard, title: 'Easy Deposits', description: 'Fund your account via card, bank wire, or crypto instantly.' },
  { icon: Globe, title: 'Trade Anywhere', description: 'Available on web, desktop, iOS and Android.' },
]

const platforms = [
  { name: 'Web Platform', description: 'No download needed - trade from any browser', features: ['Clean UI, real-time charts, one-click trading', 'Seamlessly synced with your account', 'Mobile-optimized for trading on the go'], icon: Smartphone },
  { name: 'Copy Trading', description: 'Follow top performers automatically', features: ['Browse leaderboard of master traders', 'Auto-copy trades proportionally', 'Full control over risk settings'], icon: BarChart3 },
  { name: 'PAMM / MAM', description: 'Invest in managed accounts', features: ['Pool-based managed accounts', 'Proportional P&L distribution', 'Performance fee transparency'], icon: Monitor },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <LandingNav />

      {/* HERO — Scroll Canvas + Overlay */}
      <div className="relative">
        <HeroScrollCanvas />
        <HeroOverlay />
      </div>

      {/* STATS */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-[#0A0E1A] mb-16">Trusted by Traders Worldwide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatBox value="500000+" label="Active Traders" />
            <StatBox value="2.3B+" label="Daily Trading Volume" />
            <StatBox value="1000+" label="Tradable Instruments" />
            <StatBox value="15+" label="Years Market Experience" />
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-[#0A0E1A]">
            <div className="flex items-center gap-2"><span className="text-2xl">&#11088;</span><span className="font-semibold">Top-Rated on Trustpilot 4.8</span></div>
            <div className="flex items-center gap-2"><Lock className="w-6 h-6 text-[#1A56FF]" /><span className="font-semibold">Regulated & Licensed</span></div>
            <div className="flex items-center gap-2"><Globe className="w-6 h-6 text-[#1A56FF]" /><span className="font-semibold">24/7 Dedicated Support</span></div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 md:py-32 bg-[#0F1628]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block text-[#1A56FF] text-sm font-semibold mb-4 tracking-wider uppercase">Why Choose TrustEdgeFX</div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Everything You Need to Trade Like a Pro</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {features.map((f, i) => (
              <div key={i} className="bg-white/[0.04] backdrop-blur-[10px] border border-white/[0.08] rounded-2xl p-6 hover:scale-105 transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-[#1A56FF] to-[#7B2FFF] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-[#8B9AB2]">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="py-24 md:py-32 bg-gray-100">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#0A0E1A] mb-6">Powerful Platforms. Built for Every Trader.</h2>
            <p className="text-xl text-gray-500 max-w-3xl mx-auto">Choose your preferred way to trade - from our web platform to copy trading and managed accounts.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {platforms.map((p, i) => (
              <div key={i} className="p-8 rounded-2xl border border-gray-200 shadow-lg hover:scale-[1.02] transition-all duration-300 border-t-4 border-t-[#1A56FF] bg-gray-50">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#1A56FF] to-[#7B2FFF] rounded-xl flex items-center justify-center">
                    <p.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0A0E1A]">{p.name}</h3>
                </div>
                <p className="text-gray-500 mb-6">{p.description}</p>
                <ul className="space-y-3 mb-6">
                  {p.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2 text-gray-600"><span className="text-[#1A56FF] mt-1">&#10003;</span><span>{feat}</span></li>
                  ))}
                </ul>
                <Link href="/auth/register" className="inline-flex items-center gap-2 text-[#1A56FF] hover:text-[#7B2FFF] transition-colors font-semibold">
                  Get Started <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 bg-gradient-to-br from-[#0A0E1A] via-[#1A1F3A] to-[#2A1F4A] relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"><div className="absolute inset-0 bg-gradient-to-r from-[#1A56FF]/20 to-[#7B2FFF]/20 blur-3xl" /></div>
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Start Your Trading Journey?</h2>
          <p className="text-xl text-[#8B9AB2] mb-8 max-w-2xl mx-auto">Join over 500,000 traders and access global markets in minutes.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register" className="bg-[#1A56FF] text-white px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(26,86,255,0.5)]">
              Open Account
            </Link>
            <Link href="/auth/demo-login" className="border-2 border-white/20 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 hover:bg-white/10 hover:border-white/40">
              Try Demo First
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
