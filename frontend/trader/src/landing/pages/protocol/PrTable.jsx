import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const rows = [
  { feature: 'Fund Custody',  fx: 'Smart Contract Layer', broker: 'Broker Holds Funds' },
  { feature: 'Withdrawals',   fx: 'System-Based',         broker: 'Approval-Based' },
  { feature: 'Execution',     fx: 'Automated Logic',      broker: 'Broker-Controlled' },
  { feature: 'Transparency',  fx: 'Structured Flow',      broker: 'Limited Visibility' },
  { feature: 'User Control',  fx: 'High',                 broker: 'Limited' },
]

export default function PrTable() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="Side by Side"
          title="FX Artha vs Traditional Brokers"
          highlight="vs Traditional Brokers"
          subtitle="The five differences that matter most, laid out plainly."
        />
        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 max-w-5xl mx-auto rounded-2xl overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
              border: '1px solid rgba(214,169,61,0.32)',
              boxShadow: '0 30px 70px -30px rgba(214,169,61,0.30)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px]">
                <thead>
                  <tr style={{ background: 'rgba(214,169,61,0.06)', borderBottom: '1px solid var(--fx-line)' }}>
                    <th
                      className="text-left px-3 sm:px-5 md:px-7 py-4 text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-text-3)' }}
                    >
                      Feature
                    </th>
                    <th
                      className="text-left px-3 sm:px-5 md:px-7 py-4 text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      FX Artha
                    </th>
                    <th
                      className="text-left px-3 sm:px-5 md:px-7 py-4 text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: '#f87171' }}
                    >
                      Traditional Broker
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.feature}
                      style={{
                        borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--fx-line)',
                      }}
                    >
                      <td className="px-3 sm:px-5 md:px-7 py-4 text-[13px] sm:text-sm md:text-[15px] font-semibold text-white">
                        {r.feature}
                      </td>
                      <td className="px-3 sm:px-5 md:px-7 py-4 text-[13px] sm:text-sm md:text-[15px]" style={{ color: 'var(--fx-gold-light)' }}>
                        {r.fx}
                      </td>
                      <td className="px-3 sm:px-5 md:px-7 py-4 text-[13px] sm:text-sm md:text-[15px]" style={{ color: 'var(--fx-text-2)' }}>
                        {r.broker}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
