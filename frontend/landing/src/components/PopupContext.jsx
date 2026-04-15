import { createContext, useContext, useState, useEffect } from 'react'
import { X, Shield, User, Mail, Phone, ArrowRight } from 'lucide-react'

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
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={closePopup}
        >
          <div
            className="relative w-full max-w-lg glass-card p-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow accent */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-accent/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary-purple/30 rounded-full blur-3xl"></div>

            <button
              onClick={closePopup}
              className="absolute top-4 right-4 text-text-secondary hover:text-white transition-colors z-10"
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
                <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
                <p className="text-text-secondary">Our team will reach out to you shortly.</p>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Get Started with TrustEdgeFX</h2>
                  </div>
                </div>
                <p className="text-text-secondary mb-6">Fill in your details and our team will get you trading in minutes.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-text-secondary absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-3 text-white placeholder:text-text-secondary focus:outline-none focus:border-primary-accent transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
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
                    <label className="block text-sm text-text-secondary mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-text-secondary absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="+1 234 567 890"
                        className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-3 text-white placeholder:text-text-secondary focus:outline-none focus:border-primary-accent transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Account Type</label>
                    <select
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-3 text-white focus:outline-none focus:border-primary-accent transition-colors appearance-none"
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

                  <p className="text-center text-xs text-text-secondary">
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
