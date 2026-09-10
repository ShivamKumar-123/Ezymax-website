import { Code2, MessagesSquare, Timer, Handshake, Mail, MapPin, Phone, Building2 } from 'lucide-react'
import Disclaimer from '@/landing/marketing/Disclaimer'

export const metadata = { title: 'About SetupFX — Trading Platform Development Company' }

/**
 * About page, rewritten from setupfx24.com.
 *
 * What was here described a retail broker — "we're not just a broker, we're a
 * movement", "thousands of traders across 150+ countries" — and carried a
 * stats band reading 150+ countries, 50K+ active traders, $500M+ daily volume
 * and 99.9% uptime. None of those figures were measured anywhere in this
 * business; they arrived with the template the site was ported from. They are
 * gone rather than restated, because an invented number on an About page is
 * the one thing a prospect can check and a regulator will.
 */
export default function AboutPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E94E1B] mb-5">
            Software Development Company
          </p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            We build the technology<br />
            <span className="text-[#E94E1B]">behind trading businesses</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Not a broker. Not a reseller. A development team that ships trading
            platforms ready to run a real business.
          </p>
        </div>
      </section>

      {/* In short */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">In short</p>
            <h2 className="text-3xl font-extrabold text-gray-900">Trading platforms, built to launch</h2>
          </div>
          <div className="space-y-6">
            <p className="text-gray-500 leading-relaxed">
              We develop platforms covering global forex markets, Indian exchanges and
              both sides of the prop firm industry — and we build custom systems when a
              client&rsquo;s model calls for something different.
            </p>
            <p className="text-gray-500 leading-relaxed">
              Every deployment is white-labelled, integrated with your payments and KYC
              stack, and supported after go-live. Your brand is the only brand your
              clients see; nothing points back to us.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {['Development', 'Branding', 'Integration', 'Deployment', 'Support'].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Principles</p>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Four things we hold to</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Code2, title: 'Ownership', desc: 'We take responsibility for what we ship, including the parts that are hard to fix.' },
              { icon: MessagesSquare, title: 'Clarity', desc: 'Plain timelines, plain pricing, plain answers. No jargon used to cover gaps.' },
              { icon: Timer, title: 'Longevity', desc: 'Systems built to run for years and scale with your client base.' },
              { icon: Handshake, title: 'Partnership', desc: 'Our best client relationships are measured in years, not project cycles.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="w-16 h-16 bg-[#FCE6DD] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-[#E94E1B]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Who you&rsquo;ll work with</p>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-6">One team, start to finish</h2>
          <p className="text-gray-500 leading-relaxed mb-4">
            Developers, UI/UX designers, QA engineers, DevOps specialists and support
            staff — organised into dedicated project teams.
          </p>
          <p className="text-gray-500 leading-relaxed">
            You&rsquo;ll know who is building your platform and who to call when something
            needs attention. No account manager relaying messages to a team you never meet.
          </p>
        </div>
      </section>

      {/* Where to find us */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Get in touch</p>
            <h2 className="text-3xl font-extrabold text-gray-900">Where to find us</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { icon: Building2, label: 'Company', value: 'Setupfx Softech OPC Pvt Ltd' },
              { icon: Mail, label: 'Email', value: 'setupfx24@gmail.com', href: 'mailto:setupfx24@gmail.com' },
              { icon: Phone, label: 'WhatsApp', value: '+1 (908) 228-0305' },
              { icon: MapPin, label: 'Office', value: '4012, 4th Floor, Currency Tower, Vishal Nagar, Raipur, Chhattisgarh 492001' },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-[#FCE6DD] rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#E94E1B]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</div>
                  {href ? (
                    <a href={href} className="text-gray-900 font-medium break-words hover:text-[#E94E1B]">{value}</a>
                  ) : (
                    <div className="text-gray-900 font-medium break-words">{value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-8">GST No. 22ABSCS5663H1ZX</p>
        </div>
      </section>

      <Disclaimer />
    </div>
  )
}
