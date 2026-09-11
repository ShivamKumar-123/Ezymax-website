import { AlertTriangle, ShieldOff } from 'lucide-react'

export const metadata = { title: 'Disclaimer — SetupFX' }

/**
 * Disclaimer, rewritten for a software development company.
 *
 * This route held a full retail trading risk disclosure — leverage risk,
 * margin calls, negative balance protection, counterparty risk. Those are the
 * disclosures a BROKER owes its clients about money they have placed with it.
 * We hold no client money and are nobody's counterparty, so publishing them
 * claimed a relationship with the reader that does not exist.
 *
 * What belongs here instead is the boundary of what we do, stated once and
 * without hedging.
 */
export default function DisclaimerPage() {
  return (
    <div className="bg-white text-gray-900">
      <section className="bg-white pt-16 pb-12">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Disclaimer</h1>
          <p className="text-gray-500">Last updated: September 2026</p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="w-full px-3 sm:px-6 lg:px-8 space-y-10">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
            <ShieldOff className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-900 mb-1">SetupFX is a software company, not a broker.</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                We build and license trading technology. We do not trade, broker, hold, manage
                or handle client funds, and we provide no financial, investment or advisory
                services.
              </p>
            </div>
          </div>

          <Section title="1. What we do">
            Setupfx Softech OPC Pvt Ltd, trading as SetupFX, develops software: trading
            terminals, administrative back offices, risk engines, client portals, reporting
            suites and the integrations that connect them. We license that software to
            businesses — brokerages, proprietary trading firms and similar operators — who
            deploy it under their own brand and their own authorisation.
          </Section>

          <Section title="2. What we do not do">
            <List items={[
              'We are not a broker, dealer, exchange, custodian, payment institution or financial institution of any kind, and we are not registered as one.',
              'We do not hold, manage, transmit or handle client funds at any point.',
              'We do not route, match or execute orders, and we are never counterparty to a trade.',
              'We do not accept deposits, process withdrawals or maintain trading accounts for members of the public.',
              'We do not provide financial, investment, tax, accounting or legal advice.',
              'We do not solicit or accept investments, and we do not manage money on anyone’s behalf.',
            ]} />
          </Section>

          <Section title="3. Platforms operated by our clients">
            Where a client operates a trading platform we developed, that platform is theirs.
            They hold the licence, they carry the regulatory obligations, they hold any client
            money, and they are responsible for their own clients, their conduct and their
            marketing. Our role ended at delivering and supporting the software. A platform
            carrying a client&rsquo;s branding is not a SetupFX service, and SetupFX is not a party
            to any relationship between that client and their customers.
          </Section>

          <Section title="4. Features described on this site">
            Capabilities described anywhere on this site — liquidity routing, managed-account
            structures, copy trading, algorithmic execution, IB and affiliate management and
            similar — are features we build into a client&rsquo;s platform for that client to
            operate. Describing them is not an offer of those services by us.
          </Section>

          <Section title="5. Trading carries risk">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-4 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-gray-600 text-sm leading-relaxed">
                Trading leveraged products carries a significant risk of loss and is not
                suitable for everyone. Losses can exceed the amount initially placed.
              </p>
            </div>
            We say this not because you can trade with us — you cannot — but because our
            software is used to run trading businesses, and anyone evaluating one should
            understand what they are entering. Nothing on this site is an offer, solicitation
            or recommendation to trade, nor a representation that any strategy, platform
            feature or business model will be profitable.
          </Section>

          <Section title="6. No guarantee of regulatory outcome">
            Our software includes features intended to support compliance workflows. Providing
            them is not a representation that a deployment satisfies the requirements of any
            regulator in any jurisdiction. Licensing, registration and regulatory compliance
            remain entirely the operator&rsquo;s responsibility, and anyone planning a trading
            business should take independent legal and regulatory advice where they intend to
            operate.
          </Section>

          <Section title="7. Information on this site">
            Content here is provided for general information about our services and may be
            updated without notice. Delivery timeframes, capability descriptions and comparisons
            are indicative and depend on the scope of an individual engagement.
          </Section>

          <Section title="8. Contact">
            Questions about this disclaimer can be sent to setupfx24@gmail.com, or to
            Setupfx Softech OPC Pvt Ltd, 4012, 4th Floor, Currency Tower, Vishal Nagar,
            Raipur, Chhattisgarh 492001.
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
