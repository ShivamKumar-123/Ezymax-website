import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowCircle } from '@/components/ui/Button';
import { SectionHead } from '@/components/ui/Section';
import { Picture } from '@/components/ui/Picture';
import { Art } from '@/components/ui/Art';
import { INSTRUMENTS } from '@/content/facts';
import { cn } from '@/lib/cn';

function Tile({
  href,
  className,
  children,
  tone = 'ink',
  delay = 0,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  tone?: 'ink' | 'ember' | 'cream';
  delay?: number;
}) {
  return (
    <Link
      href={href}
      data-reveal
      style={{ ['--reveal-delay' as string]: `${delay}s` }}
      className={cn(
        'group relative isolate flex min-h-[300px] flex-col overflow-hidden rounded-[30px] p-6 transition-[transform,box-shadow] duration-700 ease-out hover:-translate-y-1 sm:p-8',
        tone === 'ink' && 'border border-white/[0.09] bg-[linear-gradient(180deg,#141418,#0d0d10)] text-fg hover:border-ember/40',
        tone === 'ember' && 'bg-[linear-gradient(135deg,#ff5a1f_0%,#ff7a2e_55%,#ff9a4d_100%)] text-[#140904] shadow-[0_30px_80px_-30px_rgba(255,90,31,0.7)]',
        tone === 'cream' && 'bg-cream text-[#140904]',
        className,
      )}
    >
      {children}
    </Link>
  );
}

function TileHead({ kicker, title, tone = 'ink' }: { kicker: string; title: ReactNode; tone?: 'ink' | 'ember' | 'cream' }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', tone === 'ink' ? 'text-fg-3' : 'text-black/60')}>
          {kicker}
        </p>
        <h3 className="mt-3 font-display text-[1.9rem] font-semibold leading-[1] tracking-[-0.04em] sm:text-[2.3rem]">{title}</h3>
      </div>
      <ArrowCircle
        className={cn(
          tone !== 'ink' && '!border-black/25 !text-[#140904] group-hover:!border-[#140904] group-hover:!bg-[#140904] group-hover:!text-ember-2',
        )}
      />
    </div>
  );
}

export function ProductsBento() {
  return (
    <section className="section" aria-labelledby="products-title">
      <div className="container-site">
        <SectionHead
          id="products-title"
          kicker="Everything Ezymex does"
          lines={['Five ways to trade.', 'One account.']}
          lead="Options and CFDs share one trading account and one margin. Copy trading, PAMM and partner earnings live beside them in the Client Area, funded from a single USDT wallet."
        />
        <div className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-12 lg:gap-5">
          {/* Options */}
          <Tile href="/options" tone="ember" className="lg:col-span-7 lg:row-span-2 lg:min-h-[640px]">
            <TileHead tone="ember" kicker="New · Ezymex FX Options" title={<>Option chains<br />on forex, gold and oil.</>} />
            <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-black/75">
              Calls and puts with daily, weekly and monthly expiries. Quick trade in three taps, a strategy builder for
              straddles, spreads and iron condors, and a plain-language card that says what happens before you confirm.
            </p>
            <div className="relative mt-8 flex-1 lg:mt-auto">
              <div className="relative ml-auto w-full translate-y-6 overflow-hidden rounded-[18px] border border-black/20 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] transition-transform duration-700 group-hover:translate-y-3 lg:absolute lg:-right-16 lg:bottom-[-90px] lg:w-[118%] lg:translate-y-0 lg:[transform:perspective(1600px)_rotateX(10deg)_rotateZ(-3deg)] lg:group-hover:[transform:perspective(1600px)_rotateX(6deg)_rotateZ(-2deg)]">
                <Image
                  src="/images/product/options-chain.webp"
                  alt="Ezymex FX Options chain for EURUSD in Ezymex Trader, calls on the left and puts on the right of each strike"
                  width={1600}
                  height={950}
                  sizes="(min-width: 1024px) 760px, 92vw"
                  className="block h-auto w-full"
                />
              </div>
            </div>
          </Tile>

          {/* CFDs */}
          <Tile href="/markets" className="lg:col-span-5 lg:row-span-2" delay={0.08}>
            <TileHead kicker="CFDs" title="Every market that moves." />
            <div className="mt-auto pt-10">
              <p className="t-pixel text-[4.6rem] text-fg sm:text-[5.6rem]">1,389</p>
              <p className="mt-2 text-sm text-fg-2">
                instruments on Ezymex Trader. {INSTRUMENTS.liveMarkets} live for real money today; US, Hong Kong and Tokyo stocks
                coming soon.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['Forex', 'Metals', 'Energies', 'Indices', 'Crypto 24/7', 'Stocks soon'].map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </Tile>

          {/* Copy & PAMM */}
          <Link
            href="/copy-trading"
            data-reveal
            className="group relative isolate min-h-[420px] overflow-hidden rounded-[30px] border border-white/[0.09] lg:col-span-4"
          >
            <Art
              name="analyst"
              position="62% center"
              className="!absolute inset-0 -z-10 transition-transform duration-[1.2s] ease-out group-hover:scale-105"
              sizes="(min-width: 1024px) 440px, 92vw"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="flex h-full min-h-[inherit] flex-col justify-between p-6 sm:p-8">
              <div className="flex justify-end">
                <ArrowCircle />
              </div>
              <div className="glass rounded-[22px] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-3">Copy trading · PAMM · MAM</p>
                <h3 className="mt-2 font-display text-[1.6rem] font-semibold leading-[1.02] tracking-[-0.04em]">
                  Follow a master, or become one.
                </h3>
                <p className="mt-2 text-sm text-fg-2">Verified track records, risk controls you set, fees only on new highs.</p>
              </div>
            </div>
          </Link>

          {/* Ezymex Trader */}
          <Tile href="/platforms" className="lg:col-span-5" delay={0.08}>
            <TileHead kicker="Ezymex Trader" title="A terminal that gets out of the way." />
            <div className="relative mt-8 -mb-14 overflow-hidden rounded-t-[16px] border border-white/10 border-b-0 shadow-[0_-20px_60px_-30px_rgba(255,90,31,0.5)] transition-transform duration-700 group-hover:-translate-y-2 sm:-mb-16">
              <Image
                src="/images/product/trader-cfd.webp"
                alt="Ezymex Trader web terminal with an XAUUSD chart, one-click buy and sell, and the instruments list"
                width={1600}
                height={950}
                sizes="(min-width: 1024px) 560px, 92vw"
                className="block h-auto w-full"
              />
            </div>
          </Tile>

          {/* Partners */}
          <Tile href="/partners" tone="cream" className="lg:col-span-3" delay={0.12}>
            <TileHead tone="cream" kicker="Partners" title="Earn on every lot." />
            <div className="mt-auto pt-10">
              <p className="t-pixel text-[3.6rem]">5</p>
              <p className="mt-1 text-sm text-black/70">partner levels, from Bronze to Diamond. Paid weekly in USDT.</p>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}
