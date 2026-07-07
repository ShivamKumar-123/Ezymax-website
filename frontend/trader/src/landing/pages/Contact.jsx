import { useState, useRef, useEffect } from 'react'
import { Mail, Phone, MapPin, Send, X } from 'lucide-react'
import Button from '../components/Button'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([
    { from: 'agent', text: 'Hi there! 👋 I\'m Sarah from FXArtha Support. How can I help you today?', time: 'now' }
  ])
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatOpen])

  const getAutoReply = (text) => {
    const t = text.toLowerCase()
    if (t.includes('account') || t.includes('open')) return 'You can open a free account in under 2 minutes from our Accounts page. Would you like me to send you the link?'
    if (t.includes('deposit') || t.includes('fund')) return 'We support card, bank wire, and crypto deposits with zero fees. Minimum deposit is $100 for Standard and $5,000 for Pro.'
    if (t.includes('spread') || t.includes('fee')) return 'Our spreads start from 0.0 pips on Pro accounts. Standard accounts have no commission with spreads from 1.2 pips.'
    if (t.includes('platform')) return 'We offer our Web Platform, Copy Trading, Prop Trading, and IB Management tools. Visit the Platforms page to learn more.'
    if (t.includes('hi') || t.includes('hello') || t.includes('hey')) return 'Hello! 👋 How can I assist you with your trading today?'
    if (t.includes('thank')) return 'You\'re welcome! Is there anything else I can help you with?'
    return 'Thanks for your message! One of our support specialists will get back to you shortly. In the meantime, feel free to ask about accounts, platforms, spreads, or deposits.'
  }

  const handleSendChat = (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const userMsg = { from: 'user', text: chatInput, time: 'now' }
    setMessages((prev) => [...prev, userMsg])
    const replyText = getAutoReply(chatInput)
    setChatInput('')
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: 'agent', text: replyText, time: 'now' }])
    }, 800)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Thank you for your message! We will get back to you soon.')
    setFormData({ name: '', email: '', subject: '', message: '' })
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const contactInfo = [
    {
      icon: Mail,
      title: 'Email Us',
      content: 'support@fxartha.com',
      link: 'mailto:support@fxartha.com'
    },
    {
      icon: Phone,
      title: 'Call Us',
      content: '+44 20 1234 5678',
      link: 'tel:+442012345678'
    },
    {
      icon: MapPin,
      title: 'Visit Us',
      content: '123 Financial District, London, UK',
      link: '#'
    }
  ]

  const inputClass = 'w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:outline-none'
  const inputStyle = {
    background: 'var(--fx-bg-elev-2)',
    border: '1px solid var(--fx-line-strong)',
    color: 'var(--fx-text)'
  }

  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container text-center">
          <ScrollReveal variant="fadeUp">
            <span className="fx-eyebrow mb-6">Contact</span>
            <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">Get in Touch</h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
              Have a question? Our team is here to help. Reach out to us anytime.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Contact info + form ──────────────────────────────── */}
      <section className="fx-section" style={{ paddingTop: 0, background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollRevealGroup className="grid md:grid-cols-3 gap-8 mb-16">
            {contactInfo.map((info, index) => (
              <ScrollRevealItem key={index}>
                <div className="fx-card p-6 text-center">
                  <div className="feature-icon mx-auto mb-4">
                    <info.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--fx-text)' }}>{info.title}</h3>
                  <a
                    href={info.link}
                    className="transition-colors hover:text-[var(--fx-gold-light)]"
                    style={{ color: 'var(--fx-text-2)' }}
                  >
                    {info.content}
                  </a>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* ── Message form ─────────────────────────────── */}
            <ScrollReveal variant="fadeLeft">
              <div>
                <h2 className="fx-headline text-3xl md:text-4xl mb-6">Send Us a Message</h2>
                <div className="fx-section-frame">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--fx-text-2)' }}>Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className={`${inputClass} focus:border-[var(--fx-gold-light)]`}
                        style={inputStyle}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--fx-text-2)' }}>Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className={`${inputClass} focus:border-[var(--fx-gold-light)]`}
                        style={inputStyle}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--fx-text-2)' }}>Subject</label>
                      <select
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className={`${inputClass} focus:border-[var(--fx-gold-light)]`}
                        style={inputStyle}
                      >
                        <option value="">Select a subject</option>
                        <option value="general">General Inquiry</option>
                        <option value="account">Account Support</option>
                        <option value="technical">Technical Issue</option>
                        <option value="partnership">Partnership</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--fx-text-2)' }}>Message</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows="6"
                        className={`${inputClass} focus:border-[var(--fx-gold-light)] resize-none`}
                        style={inputStyle}
                        placeholder="How can we help you?"
                      ></textarea>
                    </div>
                    <Button type="submit" variant="primary" noPopup className="w-full flex items-center justify-center gap-2">
                      <Send className="w-5 h-5" />
                      Send Message
                    </Button>
                  </form>
                </div>
              </div>
            </ScrollReveal>

            {/* ── Office + map ─────────────────────────────── */}
            <ScrollReveal variant="fadeRight" delay={0.2}>
              <div>
                <h2 className="fx-headline text-3xl md:text-4xl mb-6">Our Office</h2>
                <div className="fx-card p-6 mb-6">
                  <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--fx-text)' }}>FXArtha Ltd</h3>
                  <p className="mb-4" style={{ color: 'var(--fx-text-2)' }}>
                    123 Financial District<br />
                    London, EC2N 2DL<br />
                    United Kingdom
                  </p>
                  <div className="space-y-2">
                    <p style={{ color: 'var(--fx-text-2)' }}>
                      <span className="font-semibold" style={{ color: 'var(--fx-text)' }}>Phone:</span> +44 20 1234 5678
                    </p>
                    <p style={{ color: 'var(--fx-text-2)' }}>
                      <span className="font-semibold" style={{ color: 'var(--fx-text)' }}>Email:</span> support@fxartha.com
                    </p>
                    <p style={{ color: 'var(--fx-text-2)' }}>
                      <span className="font-semibold" style={{ color: 'var(--fx-text)' }}>Hours:</span> Mon-Fri, 9:00 AM - 6:00 PM GMT
                    </p>
                  </div>
                </div>

                <div className="fx-image-slot fx-image-slot-16x9 flex items-center justify-center">
                  <MapPin className="w-24 h-24" style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="fx-image-slot-label">Map</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-[100] w-[calc(100vw-3rem)] sm:w-96 animate-fade-in">
          <div className="fx-card overflow-hidden flex flex-col h-[500px] shadow-2xl">
            <div className="p-4 flex items-center justify-between" style={{ background: 'linear-gradient(180deg, var(--fx-gold-light) 0%, var(--fx-gold) 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold" style={{ color: '#1a1408' }}>
                    S
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <div className="font-semibold" style={{ color: '#1a1408' }}>Sarah — Support</div>
                  <div className="text-xs" style={{ color: 'rgba(26,20,8,0.75)' }}>Online • Typically replies instantly</div>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="transition-colors"
                style={{ color: 'rgba(26,20,8,0.75)' }}
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'var(--fx-bg)' }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                      msg.from === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'
                    }`}
                    style={
                      msg.from === 'user'
                        ? { background: 'linear-gradient(180deg, var(--fx-gold-light) 0%, var(--fx-gold) 100%)', color: '#1a1408' }
                        : { background: 'var(--fx-bg-elev-2)', color: 'var(--fx-text)' }
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--fx-line)', background: 'var(--fx-bg-elev)' }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 rounded-full px-4 py-2 text-sm outline-none transition-colors focus:outline-none focus:border-[var(--fx-gold-light)]"
                style={{ background: 'var(--fx-bg-elev-2)', border: '1px solid var(--fx-line-strong)', color: 'var(--fx-text)' }}
              />
              <button
                type="submit"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:-translate-y-px flex-shrink-0"
                style={{ background: 'linear-gradient(180deg, var(--fx-gold-light) 0%, var(--fx-gold) 100%)' }}
                aria-label="Send"
              >
                <Send className="w-4 h-4" style={{ color: '#1a1408' }} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Contact
