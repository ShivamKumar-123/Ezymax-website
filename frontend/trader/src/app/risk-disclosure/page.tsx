import { AlertTriangle } from 'lucide-react'

export const metadata = { title: 'Risk Disclosure — FXArtha' }

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#d6a93d]/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#d6a93d]" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Risk Disclosure</h1>
        </div>

        <p className="text-lg font-semibold text-text-primary mt-8 mb-1">FXArtha — Risk Disclosure Statement</p>
        <p className="text-sm text-text-secondary mb-10">Last updated: February 2026</p>

        <div className="space-y-8">
          <Section title="1. High-Risk Investment Warning">
            Trading foreign exchange (forex) and contracts for difference (CFDs) on margin carries a high level of risk and may not be suitable for all investors. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite. There is a possibility that you could sustain a loss of some or all of your invested capital. You should not invest money that you cannot afford to lose.
          </Section>

          <Section title="2. Leverage Risk">
            Leverage allows you to control a large position with a relatively small amount of capital. While leverage can magnify your profits, it equally magnifies your losses. A small adverse movement in the market can result in losses that exceed your initial margin. You are responsible for all losses incurred on your account.
          </Section>

          <Section title="3. Market Volatility">
            Financial markets can be highly volatile. Prices may move rapidly against your position due to economic news, geopolitical events, low liquidity, or other market conditions. Gaps in price and slippage may occur, meaning your orders (including stop-loss orders) may be executed at a price different from the one requested.
          </Section>

          <Section title="4. No Guarantee of Profit">
            Past performance is not indicative of future results. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown. FXArtha does not guarantee any specific outcome or profit from trading on the platform.
          </Section>

          <Section title="5. Margin Calls and Stop-Out">
            If the equity in your account falls below the required margin level, your positions may be subject to a margin call and may be automatically closed (stop-out) without prior notice, in order to limit further losses. It is your responsibility to monitor your account and maintain sufficient margin at all times.
          </Section>

          <Section title="6. Risks of Leveraged Crypto & CFD Products">
            Cryptocurrency and other CFD instruments can experience extreme price swings and may be subject to additional risks, including operational, technological, and regulatory risks. The value of these instruments can fall as well as rise.
          </Section>

          <Section title="7. Technology & Execution Risk">
            Online trading carries risks associated with the use of internet-based systems, including hardware and software failures, connectivity issues, and delays in order execution. FXArtha is not liable for losses arising from such technical issues beyond its reasonable control.
          </Section>

          <Section title="8. PAMM & Copy Trading Risk">
            Allocating funds to a PAMM manager or copying another trader means your capital is exposed to the trading decisions of a third party. Past performance of any manager or strategy does not guarantee future results. You should conduct your own due diligence before allocating funds, and only allocate what you can afford to lose.
          </Section>

          <Section title="9. Independent Advice">
            The information provided on the FXArtha platform is for general purposes only and does not constitute financial, investment, legal, or tax advice. If you have any doubts about the risks involved, you should seek advice from an independent and suitably licensed financial advisor.
          </Section>

          <Section title="10. Your Acknowledgement">
            By opening an account and trading on FXArtha, you acknowledge that you have read and understood this Risk Disclosure Statement, that you understand the risks involved in leveraged trading, and that you accept full responsibility for your own trading decisions and any resulting losses.
          </Section>

          {/* Highlighted warning */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          >
            <h2 className="text-lg font-bold text-text-primary mb-3">Important</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Leveraged trading can result in the loss of all your invested capital. You could lose more than your initial deposit. Only trade with money you can afford to lose, and never trade with borrowed funds or money set aside for essential needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-text-primary mb-3">{title}</h2>
      <div className="text-text-secondary text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  )
}
