import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, BarChart2, Monitor, User, DollarSign,
  Wrench, BookOpen, Info, Mail, Menu, X, Shield, Lock,
  ChevronDown
} from 'lucide-react'
import { usePopup } from './PopupContext'

const navItems = [
  { label: 'Home',        path: '/',                  icon: <TrendingUp size={16} /> },
  { label: 'Trading',     path: '/trading/forex',      icon: <BarChart2 size={16} /> },
  {
    label: 'Platforms',
    icon: <Monitor size={16} />,
    dropdown: [
      { name: 'Web Platform', path: '/platforms/web' },
      { name: 'Copy Trading', path: '/platforms/copy-trading' },
      { name: 'Prop Trading', path: '/platforms/prop-trading' },
      { name: 'IB Management', path: '/platforms/ib-management' },
    ]
  },
  {
    label: 'Accounts',
    icon: <User size={16} />,
    dropdown: [
      { name: 'Standard', path: '/accounts/standard' },
      { name: 'Pro', path: '/accounts/pro' },
      { name: 'Demo', path: '/accounts/demo' },
    ]
  },
  { label: 'Education',   path: '/education/tutorials', icon: <BookOpen size={16} /> },
  { label: 'About',       path: '/company/about',      icon: <Info size={16} /> },
  { label: 'Contact',     path: '/company/contact',    icon: <Mail size={16} /> },
]

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const location = useLocation()
  const menuRef = useRef(null)
  const { openPopup } = usePopup()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setIsOpen(false) }, [location])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isLoginOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isLoginOpen])

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        ref={menuRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-primary-bg/85 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
            : 'bg-transparent'
        }`}
      >
        <div className="container-custom">
          <div className="flex items-center justify-between h-16 md:h-[72px]">

            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0 group">
              <img
                src="/images/logo2.png"
                alt="TrustEdgeFX"
                className="h-12 w-auto object-contain transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(26,86,255,0.6)]"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-0.5">
              {navItems.map((item) =>
                item.dropdown ? (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setActiveDropdown(item.label)}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <button
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        item.dropdown.some(d => location.pathname.startsWith(d.path))
                          ? 'text-primary-accent bg-primary-accent/[0.08]'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.label}
                      <ChevronDown size={13} className={`transition-transform duration-200 ${activeDropdown === item.label ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`absolute top-full left-0 mt-2 w-44 bg-primary-bg/95 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 transition-all duration-200 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${
                      activeDropdown === item.label ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                    }`}>
                      {item.dropdown.map((sub) => (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className="block px-4 py-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 text-sm font-medium"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'text-primary-accent bg-primary-accent/[0.08]'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                )
              )}
            </div>

            {/* CTA + Login + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLoginOpen(true)}
                className="hidden sm:inline-flex items-center text-white border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300 px-5 py-2 rounded-lg text-sm font-medium"
              >
                Login
              </button>
              <button
                onClick={openPopup}
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2 text-white font-semibold text-sm rounded-lg transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #7B2FFF, #1A56FF)',
                  boxShadow: '0 0 16px rgba(123,47,255,0.35)',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 28px rgba(123,47,255,0.6), 0 0 50px rgba(26,86,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(123,47,255,0.35)'}
              >
                <User size={13} />
                Open Account
              </button>

              {/* Mobile toggle */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-200"
                aria-label="Toggle menu"
              >
                <AnimatePresence mode="wait">
                  {isOpen ? (
                    <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <X size={18} />
                    </motion.span>
                  ) : (
                    <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Menu size={18} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="lg:hidden overflow-hidden border-t border-white/5"
              style={{ background: 'rgba(10,14,26,0.97)', backdropFilter: 'blur(20px)' }}
            >
              <div className="container-custom py-4 space-y-1">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3 }}
                  >
                    {item.dropdown ? (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <span className="text-primary-accent">{item.icon}</span>
                          {item.label}
                        </div>
                        {item.dropdown.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className={({ isActive }) =>
                              `flex items-center gap-3 pl-11 pr-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isActive
                                  ? 'text-primary-accent bg-primary-accent/10 border border-primary-accent/20'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`
                            }
                          >
                            {sub.name}
                          </NavLink>
                        ))}
                      </>
                    ) : (
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? 'text-primary-accent bg-primary-accent/10 border border-primary-accent/20'
                              : 'text-slate-300 hover:text-white hover:bg-white/5'
                          }`
                        }
                      >
                        <span className="text-primary-accent">{item.icon}</span>
                        {item.label}
                      </NavLink>
                    )}
                  </motion.div>
                ))}

                {/* Mobile CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                  className="pt-3 border-t border-white/5 space-y-2"
                >
                  <button
                    onClick={() => { setIsOpen(false); setIsLoginOpen(true) }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-white font-medium text-sm rounded-lg border border-white/20 hover:bg-white/5 transition-all"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => { setIsOpen(false); openPopup() }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-white font-semibold text-sm rounded-lg transition-all duration-200"
                    style={{ background: 'linear-gradient(135deg, #7B2FFF, #1A56FF)', boxShadow: '0 0 16px rgba(123,47,255,0.3)' }}
                  >
                    <User size={14} />
                    Open Live Account
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Login Modal */}
      {isLoginOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsLoginOpen(false)}
        >
          <div
            className="relative w-full max-w-md glass-card p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsLoginOpen(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Welcome back</h2>
                <p className="text-text-secondary text-sm">Login to your TrustEdgeFX account</p>
              </div>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); setIsLoginOpen(false) }}
            >
              <div>
                <label className="block text-sm text-text-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-secondary absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-3 text-white placeholder:text-text-secondary focus:outline-none focus:border-primary-accent transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-secondary absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-3 text-white placeholder:text-text-secondary focus:outline-none focus:border-primary-accent transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                  <input type="checkbox" className="accent-primary-accent" />
                  Remember me
                </label>
                <a href="#" className="text-primary-accent hover:text-white transition-colors">
                  Forgot password?
                </a>
              </div>

              <button type="submit" className="btn-primary w-full">
                Login
              </button>

              <p className="text-center text-sm text-text-secondary">
                Don't have an account?{' '}
                <Link
                  to="/accounts/demo"
                  onClick={() => setIsLoginOpen(false)}
                  className="text-primary-accent hover:text-white transition-colors font-semibold"
                >
                  Open Account
                </Link>
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Navbar
