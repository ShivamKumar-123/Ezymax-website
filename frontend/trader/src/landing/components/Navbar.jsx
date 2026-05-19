'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronDown, ArrowRight } from 'lucide-react'

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Trading', path: '/trading/forex' },
  { label: 'Partnership', path: '/company/partnership' },
  { label: 'Staking',    path: '/staking' },
  { label: 'Insurance',  path: '/insurance/overview' },
  { label: 'About',      path: '/company/about' },
  { label: 'Contact',    path: '/company/contact' },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [mobileDropdown, setMobileDropdown] = useState(null)
  const pathname = usePathname()
  const menuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setIsOpen(false); setMobileDropdown(null) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const isActive = (path) => pathname === path
  const isDropdownActive = (dropdown) => dropdown?.some(d => pathname?.startsWith(d.path))

  return (
    <motion.nav
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      ref={menuRef}
      className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
      style={{
        background: scrolled || isOpen ? 'rgba(8,9,11,0.85)' : 'transparent',
        backdropFilter: scrolled || isOpen ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled || isOpen ? 'blur(16px)' : 'none',
        borderBottom: scrolled || isOpen ? '1px solid var(--fx-line)' : '1px solid transparent',
      }}
    >
      <div className="fx-container">
        <div className="flex items-center justify-between h-16 md:h-[72px]">

          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0 group" aria-label="FXArtha home">
            <img
              src="/images/fxartha-logo.png"
              alt="FXArtha"
              className="h-7 md:h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) =>
              item.dropdown ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setActiveDropdown(item.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-2 rounded-full text-[15px] font-medium transition-colors duration-200"
                    style={{
                      color: isDropdownActive(item.dropdown) ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                    }}
                  >
                    {item.label}
                    <ChevronDown
                      size={14}
                      className="transition-transform duration-200"
                      style={{ transform: activeDropdown === item.label ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>
                  <AnimatePresence>
                    {activeDropdown === item.label && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="absolute top-full left-0 mt-2 w-52 p-1.5 rounded-2xl"
                        style={{
                          background: 'rgba(16,17,20,0.96)',
                          border: '1px solid var(--fx-line-strong)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                        }}
                      >
                        {item.dropdown.map((sub) => {
                          const active = isActive(sub.path)
                          return (
                            <Link
                              key={sub.path}
                              href={sub.path}
                              className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150"
                              style={{
                                color: active ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                                background: active ? 'var(--fx-gold-soft)' : 'transparent',
                              }}
                              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                            >
                              {sub.name}
                            </Link>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={item.path}
                  href={item.path}
                  className="px-3 py-2 rounded-full text-[15px] font-medium transition-colors duration-200"
                  style={{
                    color: isActive(item.path) ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                  }}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          {/* CTA + mobile toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth/login"
              className="hidden sm:inline-flex fx-btn-ghost text-sm py-2 px-4"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="hidden sm:inline-flex fx-btn-primary text-sm py-2 px-4"
            >
              Open Account
              <ArrowRight size={14} />
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(prev => !prev)}
              className="lg:hidden relative z-[60] w-10 h-10 flex items-center justify-center rounded-full transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--fx-line-strong)',
                color: 'var(--fx-text)',
              }}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="lg:hidden overflow-hidden"
            style={{
              background: 'rgba(8,9,11,0.97)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTop: '1px solid var(--fx-line)',
            }}
          >
            <div className="fx-container py-4 space-y-1 max-h-[calc(100dvh-72px)] overflow-y-auto">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.25 }}
                >
                  {item.dropdown ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMobileDropdown(mobileDropdown === item.label ? null : item.label)}
                        className="flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors"
                        style={{
                          color: isDropdownActive(item.dropdown) ? 'var(--fx-gold-light)' : 'var(--fx-text)',
                          background: mobileDropdown === item.label ? 'rgba(255,255,255,0.04)' : 'transparent',
                        }}
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                        <ChevronDown
                          size={16}
                          className="transition-transform duration-200"
                          style={{
                            color: 'var(--fx-text-3)',
                            transform: mobileDropdown === item.label ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      </button>
                      <AnimatePresence>
                        {mobileDropdown === item.label && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {item.dropdown.map((sub) => {
                              const active = isActive(sub.path)
                              return (
                                <Link
                                  key={sub.path}
                                  href={sub.path}
                                  className="block pl-8 pr-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                  style={{
                                    color: active ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                                    background: active ? 'var(--fx-gold-soft)' : 'transparent',
                                  }}
                                >
                                  {sub.name}
                                </Link>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <Link
                      href={item.path}
                      className="block px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        color: isActive(item.path) ? 'var(--fx-gold-light)' : 'var(--fx-text)',
                        background: isActive(item.path) ? 'var(--fx-gold-soft)' : 'transparent',
                      }}
                    >
                      {item.label}
                    </Link>
                  )}
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32, duration: 0.25 }}
                className="pt-3 mt-2 border-t flex flex-col gap-2"
                style={{ borderColor: 'var(--fx-line)' }}
              >
                <Link href="/auth/login" className="fx-btn-ghost justify-center text-sm py-3">
                  Login
                </Link>
                <Link href="/auth/register" className="fx-btn-primary justify-center text-sm py-3">
                  Open Live Account
                  <ArrowRight size={14} />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
