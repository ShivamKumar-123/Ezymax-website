import { Mail, MessageCircle, MapPin, Building2, Search, MonitorPlay, FileText } from 'lucide-react'
import Disclaimer from '@/landing/marketing/Disclaimer'

export const metadata = { title: 'Contact SetupFX — Trading Platform Development Enquiries' }

/**
 * Contact page, rewritten from setupfx24.com.
 *
 * The previous version was a retail broker support desk: a French phone
 * number, support@swisscresta.com, "available 24/7", "response within 1 hour".
 * The real contact route for this business is the enquiry path — company
 * details and a one-business-day reply — so that is what it says.
 */
export default function ContactPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E94E1B] mb-5">Get in touch</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Let&rsquo;s talk<br />
            <span className="text-[#E94E1B]">about your project</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Send us the details. We&rsquo;ll come back with a demo, a scope and an honest timeline.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {['Reply within 1 business day', 'Free demo', 'No obligation'].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Direct contact */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Reach us directly</h2>
            <p className="text-gray-500">Prefer to skip the form?</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { icon: Building2, label: 'Company', value: 'Setupfx Softech OPC Pvt Ltd' },
              { icon: Mail, label: 'Email', value: 'setupfx24@gmail.com', href: 'mailto:setupfx24@gmail.com' },
              { icon: MessageCircle, label: 'WhatsApp', value: '+1 (908) 228-0305' },
              { icon: MapPin, label: 'Office', value: '4012, 4th Floor, Currency Tower, Vishal Nagar, Raipur, Chhattisgarh 492001' },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="bg-gray-50 rounded-xl border border-gray-200 p-5 flex gap-4">
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
          <p className="text-center text-xs text-gray-400 mt-8">
            GST No. 22ABSCS5663H1ZX &nbsp;·&nbsp; Technical support runs 24/7 for live clients.
          </p>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">The process</p>
            <h2 className="text-3xl font-extrabold text-gray-900">After you get in touch</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Search, n: '01', title: 'We review', desc: 'Your requirement reaches the team, not an inbox. Reply within one business day.' },
              { icon: MonitorPlay, n: '02', title: 'We demo', desc: 'A live walkthrough of the platform that fits your model — screen share, not a video.' },
              { icon: FileText, n: '03', title: 'We scope', desc: 'A written scope, timeline and quotation. No obligation at any stage.' },
            ].map(({ icon: Icon, n, title, desc }) => (
              <div key={n} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#FCE6DD] rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#E94E1B]" />
                  </div>
                  <span className="text-xs font-semibold text-gray-300">{n}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Before you ask</p>
            <h2 className="text-3xl font-extrabold text-gray-900">Quick answers</h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: 'How long does a platform take to launch?',
                a: 'It depends on scope and integrations. After the discovery call you get a written plan with dated milestones — and we hold to it.',
              },
              {
                q: 'Will the platform carry SetupFX branding?',
                a: 'No. Every deployment is fully white-labelled. Your brand is the only brand your clients see.',
              },
              {
                q: 'Can you customise the platform to my model?',
                a: 'Yes. Rules, instruments, fee structures, challenge parameters and UI can all be modified. Custom development is available.',
              },
              {
                q: 'Do you provide mobile apps too?',
                a: 'Yes — Android and iOS, under your developer account and branding.',
              },
              {
                q: 'What happens after go-live?',
                a: 'Ongoing support: monitoring, issue resolution, updates and scheduled enhancement cycles.',
              },
              {
                q: 'Do you help with licensing or regulation?',
                a: 'We are a technology company, not a legal consultancy. We build software that supports your compliance workflows — obtaining licences and meeting regulatory obligations in your jurisdiction stays with you, and we would recommend specialist legal advice.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-900 mb-2">{q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Disclaimer />
    </div>
  )
}
