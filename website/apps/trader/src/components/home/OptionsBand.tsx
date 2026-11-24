import Link from 'next/link';
import { ArrowUpRight, CalendarClock, Layers, ShieldCheck } from 'lucide-react';
import { Headline } from '@/components/motion/Headline';
import { Picture } from '@/components/ui/Picture';
import { REGISTER_HREF } from '@/lib/crm';
import { OPTIONS } from '@/content/facts';

/**
 * Ezymex FX Options flagship band. Full-bleed orange that continues the model image's own background
 * (#f09b00 at the top, fading to #d18000 at the floor), so the figure stands in the band with no visible box.
 */
const BAND_BG =
  'linear-gradient(180deg, #f09b00 0%, #f09b00 37%, #ea9800 55%, #e49200 74%, #d98700 92%, #d18000 100%)';

export function OptionsBand() {
  return (
    <section className="relative isolate overflow-hidden text-[#140904]" style={{ background: BAND_BG }} aria-labelledby="band-title">
      <div className="container-site relative grid lg:min-h-[760px] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative z-10 flex flex-col justify-center gap-7 pb-6 pt-20 lg:py-24">
          <p className="flex items-center gap-3 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-black/70" data-reveal>
            <span className="h-px w-7 bg-[#140904]" />
            Ezymex FX Options
            <span className="rounded-full bg-[#140904] px-2 py-0.5 text-[10.5px] tracking-[0.1em] text-[#ffb15c]">Coming soon</span>
          </p>
          <Headline id="band-title" lines={['Options on forex,', 'made simple.']} className="t-display max-w-[13ch]" />
          <p className="max-w-[34rem] text-[1.08rem] leading-relaxed text-black/75" data-reveal>
            Calls and puts on {OPTIONS.fxPairs - 1} FX pairs, gold, silver and oil, with daily, weekly and monthly expiries.
            Buy one and the most you can lose is what you pay. It sits in the same account as your CFDs.
          </p>
          <ul className="grid max-w-[34rem] gap-3 sm:grid-cols-3" data-reveal>
            {[
              { Icon: CalendarClock, t: 'Daily expiries', d: 'Plus weekly and monthly' },
              { Icon: Layers, t: '8 strategies', d: 'Up to 8 legs per order' },
              { Icon: ShieldCheck, t: 'Plain language', d: 'What happens, before you confirm' },
            ].map(({ Icon, t, d }) => (
              <li key={t} className="rounded-2xl border border-black/15 bg-white/15 p-4 backdrop-blur-sm">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#140904] text-[#ffb15c]">
                  <Icon size={17} aria-hidden />
                </span>
                <p className="mt-3 text-[15px] font-semibold">{t}</p>
                <p className="mt-0.5 text-[13px] text-black/65">{d}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3" data-reveal>
            <Link href="/options" className="btn bg-[#140904] text-[#fff1e3] hover:bg-black">
              <span>Explore FX Options</span>
              <span className="arrow !bg-[#ff8a3d] !text-[#140904]" aria-hidden>
                <ArrowUpRight size={16} strokeWidth={2.2} />
              </span>
            </Link>
            <Link href={REGISTER_HREF} className="btn border border-[#140904]/40 text-[#140904] hover:bg-[#140904]/10">
              Create your account
            </Link>
          </div>
        </div>
        <div className="relative -mx-[var(--gutter)] flex items-end justify-center lg:mx-0 lg:justify-end">
          <Picture
            name="/images/brand/model-orange"
            widths={[736, 490]}
            height={1086}
            alt="A glossy black figure traced with glowing orange circuit lines, sitting cross-legged"
            sizes="(min-width: 1024px) 515px, min(100vw, 480px)"
            className="band-model-mask block w-full max-w-[480px] lg:max-w-[515px]"
          />
        </div>
      </div>
    </section>
  );
}
