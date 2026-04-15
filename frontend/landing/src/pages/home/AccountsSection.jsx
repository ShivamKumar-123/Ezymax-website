import { Link } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'
import { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { accounts } from '../HomeData'

export default function AccountsSection() {
  return (
    <section className="section-padding relative overflow-hidden bg-primary-bg">
      <div className="container-custom relative z-10">
        <SectionHeader
          badge="Accounts"
          title="Account Types"
          highlight="Account Types"
          subtitle="Choose the account that matches your trading style and experience level."
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
          {accounts.map((acc) => (
            <ScrollRevealItem key={acc.name}>
              <div
                className={`relative rounded-lg p-6 h-full flex flex-col transition-all duration-300 ${
                  acc.highlight
                    ? 'bg-primary-accent/[0.06] border border-primary-accent/30'
                    : 'bg-[#111827] border border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {acc.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 text-white text-xs font-bold rounded-full uppercase tracking-wider bg-primary-accent"
                    >
                      Popular
                    </span>
                  </div>
                )}

                <span className={`badge mb-4 w-fit text-xs ${acc.highlight ? 'bg-white/15 text-white' : acc.badgeColor}`}>
                  {acc.badge}
                </span>

                <h3 className="text-xl font-bold mb-1 text-white">{acc.name}</h3>

                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: acc.highlight ? '#ffffff' : '#1A56FF' }}
                >
                  {acc.minDeposit}
                </div>

                <div className={`text-xs mb-2 ${acc.highlight ? 'text-white/60' : 'text-text-secondary'}`}>
                  Minimum Deposit
                </div>

                <div className={`text-sm mb-1 ${acc.highlight ? 'text-white/80' : 'text-text-secondary'}`}>
                  Spreads: <span className="font-semibold text-white">{acc.spreads}</span>
                </div>

                <div className={`text-xs mb-4 pb-4 border-b ${acc.highlight ? 'border-white/15 text-white/60' : 'border-white/5 text-text-secondary'}`}>
                  Commission: {acc.commission}
                </div>

                <p className={`text-xs leading-relaxed mb-4 flex-1 ${acc.highlight ? 'text-white/75' : 'text-text-secondary'}`}>
                  {acc.desc}
                </p>

                <ul className="space-y-2 mb-6">
                  {acc.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-xs ${acc.highlight ? 'text-white/85' : 'text-text-secondary'}`}>
                      <Check size={11} className={acc.highlight ? 'text-white' : 'text-primary-accent'} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/accounts/standard"
                  className={`w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 block ${
                    acc.highlight
                      ? 'bg-white text-primary-accent hover:bg-white/90'
                      : 'border border-primary-accent/30 text-primary-accent hover:bg-primary-accent/10'
                  }`}
                >
                  {acc.cta}
                </Link>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>

        <div className="text-center mt-8">
          <Link to="/accounts/standard" className="btn-outline inline-flex items-center gap-2">
            Compare All Accounts <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
