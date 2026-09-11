import { FileText } from 'lucide-react'

export const metadata = { title: 'Terms of Service — SetupFX' }

/**
 * Terms of Service, rewritten for a software development company.
 *
 * What was here were the terms of a RETAIL BROKERAGE: account eligibility to
 * "engage in financial trading", deposits and withdrawals, bonus terms,
 * affiliate rebates, PAMM investments, trading risk. None of it described
 * anything this business does, and unlike marketing copy a terms page is the
 * document someone would be held to — so it was the most dangerous page on
 * the site to leave pointing at a service we do not provide.
 */
export default function TermsPage() {
  return (
    <div className="bg-white text-gray-900">
      <section className="bg-white pt-16 pb-12">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#FCE6DD] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#E94E1B]" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">Terms of Service</h1>
          </div>
          <p className="text-lg font-semibold text-gray-900 mt-6 mb-1">
            Setupfx Softech OPC Pvt Ltd (&ldquo;SetupFX&rdquo;) — Terms of Service
          </p>
          <p className="text-sm text-gray-500">Last updated: September 2026</p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="w-full px-3 sm:px-6 lg:px-8 space-y-8">
          <Section title="1. Who we are">
            SetupFX is the trading name of Setupfx Softech OPC Pvt Ltd, a company registered
            in India with its office at 4012, 4th Floor, Currency Tower, Vishal Nagar, Raipur,
            Chhattisgarh 492001 (GST 22ABSCS5663H1ZX). We are a software development company.
            We design, build and license trading technology to businesses.
          </Section>

          <Section title="2. What these terms cover">
            These terms govern your use of this website and any enquiry you send through it.
            They are not a contract for development work. Any engagement to build, license or
            support software is governed by a separate written agreement signed by both
            parties; where that agreement and these terms conflict, that agreement prevails.
          </Section>

          <Section title="3. The nature of our services">
            This is the most important section on this page, so it is stated plainly:
            <List items={[
              'We build and license software. We are not a broker, dealer, exchange, custodian or financial institution of any kind.',
              'We do not hold, manage, transmit or handle client funds.',
              'We do not route, match or execute orders, and we are never counterparty to a trade.',
              'We do not provide financial, investment, tax, accounting or legal advice, and nothing on this site or in any conversation with us constitutes such advice.',
              'We do not solicit or accept investments, and we make no representation about the returns any trading activity may produce.',
              'Where one of our clients operates a trading platform we built, that platform is operated by that client, under their own licence and their own regulatory obligations. It is not operated by us, and we are not responsible for their conduct or their clients.',
            ]} />
          </Section>

          <Section title="4. Using this website">
            You may use this site to learn about our services and to contact us. You may not
            attempt to gain unauthorised access to it, interfere with its operation, scrape it
            at a scale that degrades service for others, or use it to transmit unlawful or
            malicious content.
          </Section>

          <Section title="5. Enquiries and demonstrations">
            Sending an enquiry does not create a contract or oblige either party to proceed.
            Demonstrations, scopes, timelines and quotations we provide before a signed
            agreement are indicative and provided without charge or obligation. Figures given
            for delivery timeframes are estimates based on the scope described to us at the
            time.
          </Section>

          <Section title="6. Intellectual property">
            The software we develop, together with our underlying frameworks, libraries, tooling
            and know-how, remains our intellectual property unless a signed agreement expressly
            assigns specific rights. A white-label deployment grants the client the right to
            operate and brand the platform on the terms of that agreement; it does not transfer
            ownership of the underlying technology. Content on this site — text, design, logos
            and images — belongs to us or our licensors.
          </Section>

          <Section title="7. Your responsibilities as a client">
            Obtaining and maintaining every licence, registration, authorisation and regulatory
            permission required to operate a trading business in your jurisdiction is your
            responsibility, not ours. The same applies to your obligations on client onboarding,
            AML, client-money handling, reporting, marketing conduct and data protection.
            <br /><br />
            Our software includes features intended to support compliance workflows — KYC
            document capture, audit logging, reporting and similar. Providing those features is
            not a representation that any particular deployment satisfies the requirements of
            any particular regulator. We are a technology company, not a legal or compliance
            consultancy, and you should take specialist advice for your jurisdiction.
          </Section>

          <Section title="8. Confidentiality">
            Business information you share with us while scoping a project is treated as
            confidential and used only to evaluate and deliver that project. We expect the same
            of anything we share with you about how our systems are built.
          </Section>

          <Section title="9. Third-party services">
            Deployments commonly integrate third-party services — payment gateways, KYC and AML
            providers, liquidity venues, market-data feeds, CRM and messaging platforms. Those
            services are supplied by their own providers under their own terms. We integrate
            them; we do not control their availability, pricing, data or conduct.
          </Section>

          <Section title="10. Warranties and disclaimers">
            This website is provided as-is. We make no warranty that it will be uninterrupted or
            error-free, and any information on it may be updated without notice. Warranties
            relating to delivered software are set out in the applicable signed agreement and
            not here.
          </Section>

          <Section title="11. Limitation of liability">
            To the fullest extent permitted by law, we are not liable for indirect, incidental,
            special or consequential loss, or for loss of profit, revenue, goodwill or data,
            arising out of your use of this website. Liability arising under a development or
            licensing engagement is governed by the limits set out in that agreement. Nothing
            here excludes liability that cannot lawfully be excluded.
          </Section>

          <Section title="12. Changes to these terms">
            We may update these terms as our services change. The revision date at the top of
            this page reflects the current version, and continued use of the site after a change
            constitutes acceptance of it.
          </Section>

          <Section title="13. Governing law">
            These terms are governed by the laws of India, and the courts at Raipur,
            Chhattisgarh have exclusive jurisdiction over any dispute arising from them, unless
            a signed agreement between us specifies otherwise.
          </Section>

          <Section title="14. Contact">
            Questions about these terms can be sent to setupfx24@gmail.com, or to the registered
            office address in section 1.
          </Section>
        </div>
      </section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-gray-500 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-2 mt-3 text-gray-500">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}
