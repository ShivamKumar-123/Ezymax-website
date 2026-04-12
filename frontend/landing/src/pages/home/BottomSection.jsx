import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Star, ChevronDown, TrendingUp } from 'lucide-react'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { testimonials, faqs } from '../HomeData'

function FAQItem({ q, a, index }) {
  const [open, setOpen] = useState(false)
  return (
    <ScrollReveal variant="fadeUp" delay={index * 0.08}>
      <div
        className={`border rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
          open ? 'border-primary-accent/30 bg-primary-accent/[0.04]' : 'border-white/[0.06] bg-[#111827] hover:border-white/10'
        }`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between p-5">
          <h4 className="text-white font-medium text-sm pr-4">{q}</h4>
          <span className={`flex-shrink-0 transition-transform duration-300 ${open ? 'text-primary-accent rotate-180' : 'text-text-secondary'}`}>
            <ChevronDown size={18} />
          </span>
        </div>
        <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
          <p className="px-5 pb-5 text-text-secondary text-sm leading-relaxed">{a}</p>
        </motion.div>
      </div>
    </ScrollReveal>
  )
}

export default function BottomSection() {
  return (
    <>
      {/* TESTIMONIALS */}
      <section className="section-padding bg-primary-bg relative overflow-hidden">
        <div className="container-custom relative z-10">
          <SectionHeader
            badge="Testimonials"
            title="What Our Clients Say"
            highlight="Clients Say"
            subtitle="Trusted by thousands of traders worldwide."
          />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
            {testimonials.map((t, i) => (
              <ScrollRevealItem key={i}>
                <div className="glass-card p-6 h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} size={14} style={{ color: '#7B2FFF', fill: '#7B2FFF' }} />
                    ))}
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed flex-1 mb-5 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <div className="w-9 h-9 rounded-full bg-primary-accent/20 flex items-center justify-center text-primary-accent font-bold text-sm">
                      {t.author[0]}
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{t.author}</div>
                      <div className="text-text-secondary text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-primary-secondary relative overflow-hidden">
        <div className="container-custom relative z-10">
          <SectionHeader
            badge="FAQ"
            title="Frequently Asked Questions"
            highlight="Frequently Asked"
            subtitle="Find answers to the most common questions about trading with TrustEdgeFX."
          />
          <div className="max-w-3xl mx-auto mt-12 space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="section-padding bg-primary-bg relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-64 bg-primary-accent/5 rounded-full blur-3xl" />
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-primary-accent/25 to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-primary-accent/25 to-transparent pointer-events-none" />

        <div className="container-custom relative z-10 text-center">
          <ScrollReveal variant="fadeUp">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-accent/10 border border-primary-accent/20 mb-6">
              <TrendingUp size={14} className="text-primary-accent" />
              <span className="text-primary-accent text-xs font-semibold uppercase tracking-widest">Start Trading Today</span>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Ready to Trade with <span className="gradient-text">Institutional Precision?</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="fadeIn" delay={0.2}>
            <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
              Join thousands of traders who trust TrustEdgeFX for professional-grade execution, transparent pricing, and competitive conditions.
            </p>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.3}>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/accounts/standard" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3.5">
                Open Live Account <ArrowRight size={16} />
              </Link>
              <Link to="/accounts/demo" className="btn-outline gap-2 text-base px-8 py-3.5">
                <Play size={14} /> Try Free Demo
              </Link>
            </div>
          </ScrollReveal>

          <div className="flex items-center justify-center gap-3 mt-12 opacity-30">
            <div className="w-16 h-px bg-primary-accent" />
            <div className="text-primary-accent text-sm font-semibold">TrustEdgeFX</div>
            <div className="w-16 h-px bg-primary-accent" />
          </div>
        </div>
      </section>
    </>
  )
}
