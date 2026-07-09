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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Side by Side</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                FX Artha <span className="gradient-text">vs Traditional Brokers</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The five differences that matter most, laid out plainly.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp">
          <div className="fx-tile mt-10 md:mt-14 max-w-5xl mx-auto overflow-hidden p-0">
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
    </section>
  )
}
