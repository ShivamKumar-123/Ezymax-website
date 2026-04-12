import { useState, useRef, useEffect } from 'react'
import { Mail, Phone, MapPin, Send, MessageCircle, X } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
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
    { from: 'agent', text: 'Hi there! 👋 I\'m Sarah from TrustEdgeFX Support. How can I help you today?', time: 'now' }
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
      content: 'support@trustedgefx.com',
      link: 'mailto:support@trustedgefx.com'
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

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Get in Touch</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Have a question? Our team is here to help. Reach out to us anytime.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollRevealGroup className="grid md:grid-cols-3 gap-8 mb-16">
            {contactInfo.map((info, index) => (
              <ScrollRevealItem key={index}>
                <Card className="text-center p-8">
                  <info.icon className="w-12 h-12 text-primary-accent mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">{info.title}</h3>
                  <a href={info.link} className="text-text-secondary hover:text-primary-accent transition-colors">
                    {info.content}
                  </a>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>

          <div className="grid lg:grid-cols-2 gap-12">
            <ScrollReveal variant="fadeLeft">
              <div>
                <h2 className="text-3xl font-bold text-white mb-6">Send Us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-text-secondary mb-2">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-accent transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-2">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-accent transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-2">Subject</label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-accent transition-colors"
                    >
                      <option value="">Select a subject</option>
                      <option value="general">General Inquiry</option>
                      <option value="account">Account Support</option>
                      <option value="technical">Technical Issue</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-2">Message</label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows="6"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-accent transition-colors resize-none"
                      placeholder="How can we help you?"
                    ></textarea>
                  </div>
                  <Button type="submit" variant="primary" noPopup className="w-full flex items-center justify-center gap-2">
                    <Send className="w-5 h-5" />
                    Send Message
                  </Button>
                </form>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fadeRight" delay={0.2}>
              <div>
                <h2 className="text-3xl font-bold text-white mb-6">Our Office</h2>
                <Card className="p-8 mb-6">
                  <h3 className="text-xl font-semibold text-white mb-4">TrustEdgeFX Ltd</h3>
                  <p className="text-text-secondary mb-4">
                    123 Financial District<br />
                    London, EC2N 2DL<br />
                    United Kingdom
                  </p>
                  <div className="space-y-2">
                    <p className="text-text-secondary">
                      <span className="text-white font-semibold">Phone:</span> +44 20 1234 5678
                    </p>
                    <p className="text-text-secondary">
                      <span className="text-white font-semibold">Email:</span> support@trustedgefx.com
                    </p>
                    <p className="text-text-secondary">
                      <span className="text-white font-semibold">Hours:</span> Mon-Fri, 9:00 AM - 6:00 PM GMT
                    </p>
                  </div>
                </Card>

                <div className="glass-card p-8 aspect-video bg-gradient-primary/10 flex items-center justify-center">
                  <MapPin className="w-24 h-24 text-primary-accent" />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Need Immediate Assistance?
            </h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Our live chat support is available 24/5 to answer your questions instantly.
            </p>
            <Button variant="primary" onClick={() => setIsChatOpen(true)}>
              <MessageCircle className="w-5 h-5" />
              Start Live Chat
            </Button>
          </ScrollReveal>
        </div>
      </section>

      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-[100] w-[calc(100vw-3rem)] sm:w-96 animate-fade-in">
          <div className="glass-card overflow-hidden flex flex-col h-[500px] shadow-2xl">
            <div className="bg-gradient-primary p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-white">
                    S
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <div className="font-semibold text-white">Sarah — Support</div>
                  <div className="text-xs text-white/80">Online • Typically replies instantly</div>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-primary-bg/50">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                      msg.from === 'user'
                        ? 'bg-primary-accent text-white rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-3 border-t border-white/10 bg-primary-secondary flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-white placeholder:text-text-secondary focus:outline-none focus:border-primary-accent transition-colors text-sm"
              />
              <button
                type="submit"
                className="w-10 h-10 bg-primary-accent hover:bg-primary-accent/80 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Send"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Contact
