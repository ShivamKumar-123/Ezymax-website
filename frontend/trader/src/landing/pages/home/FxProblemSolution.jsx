import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const problemText =
  'You deposit funds and the platform controls them. Withdrawals wait on approvals, and execution is never fully transparent.'

const solutionText =
  'Funds interact with a smart-contract layer — no platform custody. Trades run on system-defined logic and P&L settles automatically.'

/* One Venn circle. `problem` = dark disc, `solution` = warm gold glass disc.
   Text is pinned to the outer half of each disc so the central overlap stays clear. */
function Circle({ variant, title, text }) {
  const isProblem = variant === 'problem'
  return (
    <div
      className="fx-venn-circle relative rounded-full w-[270px] h-[270px] sm:w-[400px] sm:h-[400px] lg:w-[460px] lg:h-[460px]"
      style={
        isProblem
          ? {
              background:
                'radial-gradient(125% 125% at 30% 22%, #24262e 0%, #0c0d11 55%, #060709 100%)',
              border: '1px solid rgba(214,169,61,0.18)',
              boxShadow:
                '0 44px 100px -34px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
            }
          : {
              background:
                'radial-gradient(120% 120% at 60% 28%, #fbeaa8 0%, #ecc657 45%, #b6842a 100%)',
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow:
                '0 44px 110px -30px rgba(214,169,61,0.6), inset 0 2px 10px rgba(255,255,255,0.5)',
            }
      }
    >
      <div className={`flex h-full items-center ${isProblem ? '' : 'justify-end'}`}>
        <div className={`w-[66%] ${isProblem ? 'pl-[12%]' : 'pr-[12%]'}`}>
          <h3
            className="text-xl md:text-2xl lg:text-3xl font-semibold mb-3"
            style={{ color: isProblem ? '#ffffff' : '#14100a' }}
          >
            {title}
          </h3>
          <p
            className="text-[13px] leading-snug md:text-[15px] md:leading-relaxed"
            style={{ color: isProblem ? 'rgba(255,255,255,0.72)' : 'rgba(20,16,10,0.74)' }}
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FxProblemSolution() {
  return (
    <section className="fx-section relative overflow-hidden" style={{ background: 'var(--fx-bg)', paddingTop: '3.5rem' }}>
      <div className="fx-container relative">
        {/* ── Header: big title left, "What is it?" right ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <ScrollReveal variant="fadeUp">
            <h2 className="fx-headline text-5xl sm:text-6xl lg:text-7xl leading-[1.02]">
              Problem &amp;
              <br />
              <span className="fx-gold-text">Solution</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="lg:pt-3 lg:max-w-md lg:ml-auto">
              <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--fx-text)' }}>
                What is it?
              </h3>
              <p className="text-base leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                Most trading platforms still hold your funds and gatekeep withdrawals — progress is
                opaque and control sits with someone else. FX Artha replaces that custodial model
                with a smart-contract layer where custody stays with you and trades settle
                automatically.
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* ── Overlapping Venn circles ── */}
        <div className="relative mt-10 md:mt-14 flex flex-col items-center lg:flex-row lg:items-start lg:justify-center lg:pb-24">
          {/* soft ambient glow behind the circles (kept inside this container so the
              `.fx-section > *` position:relative rule can't override its absolute) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="w-[720px] h-[520px] max-w-none"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(214,169,61,0.14), rgba(214,169,61,0) 72%)',
                filter: 'blur(20px)',
              }}
            />
          </div>

          <ScrollReveal variant="fadeUp" className="relative z-[1] hover:z-[30] shrink-0">
            <Circle variant="problem" title="Problem" text={problemText} />
          </ScrollReveal>
          <ScrollReveal
            variant="fadeUp"
            delay={0.12}
            className="relative z-[2] hover:z-[30] shrink-0 -mt-14 sm:-mt-20 lg:mt-24 lg:-ml-28"
          >
            <Circle variant="solution" title="Solution" text={solutionText} />
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-8 md:mt-4 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Control stays with you. Execution stays with the system.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
