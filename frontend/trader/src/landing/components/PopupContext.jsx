import { createContext, useContext, useState, useEffect } from 'react'
import { X, Shield, User, Mail, Phone, ArrowRight } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand'

const PopupContext = createContext()

export const usePopup = () => useContext(PopupContext)

export const PopupProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const openPopup = () => {
    setSubmitted(false)
    setIsOpen(true)
  }
  const closePopup = () => setIsOpen(false)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      setIsOpen(false)
      setSubmitted(false)
    }, 2500)
  }

  return (
    <PopupContext.Provider value={{ openPopup, closePopup }}>
      {children}

      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={closePopup}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--fx-line)] bg-white p-8 shadow-[0_28px_70px_rgba(11,11,12,0.24)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow accent */}
            
            

            <button
              onClick={closePopup}
              className="absolute top-4 right-4 text-[var(--fx-text-3)] hover:text-[var(--fx-text)] transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="relative z-10 text-center py-8">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[var(--fx-text)] mb-2">You're All Set!</h2>
                <p className="text-[var(--fx-text-2)]">Our team will reach out to you shortly.</p>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-[var(--fx-gold)] rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--fx-text)]">Get Started with {BRAND_NAME}</h2>
                  </div>
                </div>
                <p className="text-[var(--fx-text-2)] mb-6">Fill in your details and our team will get you trading in minutes.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-[var(--fx-text-2)] mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[var(--fx-text-3)] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        className="w-full bg-white border border-[var(--fx-line-strong)] rounded-full pl-11 pr-4 py-3 text-[var(--fx-text)] placeholder:text-[var(--fx-text-3)] focus:outline-none focus:border-[var(--fx-gold)] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--fx-text-2)] mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--fx-text-3)] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        className="w-full bg-white border border-[var(--fx-line-strong)] rounded-full pl-11 pr-4 py-3 text-[var(--fx-text)] placeholder:text-[var(--fx-text-3)] focus:outline-none focus:border-[var(--fx-gold)] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--fx-text-2)] mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[var(--fx-text-3)] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="+1 234 567 890"
                        className="w-full bg-white border border-[var(--fx-line-strong)] rounded-full pl-11 pr-4 py-3 text-[var(--fx-text)] placeholder:text-[var(--fx-text-3)] focus:outline-none focus:border-[var(--fx-gold)] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--fx-text-2)] mb-1.5">Account Type</label>
                    <select
                      required
                      className="w-full bg-white border border-[var(--fx-line-strong)] rounded-full px-4 py-3 text-[var(--fx-text)] focus:outline-none focus:border-[var(--fx-gold)] transition-colors appearance-none"
                    >
                      <option value="" className="bg-primary-bg">Select account type</option>
                      <option value="demo" className="bg-primary-bg">Demo Account</option>
                      <option value="standard" className="bg-primary-bg">Standard Account</option>
                      <option value="pro" className="bg-primary-bg">Pro Account</option>
                    </select>
                  </div>

                  <button type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2 mt-2">
                    Get Started Now
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <p className="text-center text-xs text-[var(--fx-text-3)]">
                    By submitting, you agree to our Terms & Conditions and Privacy Policy.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </PopupContext.Provider>
  )
}
