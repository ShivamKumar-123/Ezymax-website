"use client";

import { animated, useSpring } from "@react-spring/web";
import { useState } from "react";

import { Inview } from "@/components/animation/springs/in-view";
import { SectionHeading } from "@/components/ui/section-heading";
import type { marginCalculator } from "@/data/mocks/home";

export interface MarginCalculatorProps {
  content: typeof marginCalculator;
}

/** Example market for the demo math — EUR/USD, 1 lot = 100,000 units. */
const PRICE = 1.08;
const CONTRACT = 100_000;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * The one interactive proof on the page: move deposit, lots and leverage, and
 * watch how little of the balance actually locks. A trader who moves these
 * sliders for ten seconds understands the entire business model.
 */
export const MarginCalculator = ({ content }: MarginCalculatorProps) => {
  const [deposit, setDeposit] = useState(10_000);
  const [lots, setLots] = useState(0.5);
  const [leverage, setLeverage] = useState<number>(100);

  const margin = (lots * CONTRACT * PRICE) / leverage;
  const locked = Math.min(margin, deposit);
  const free = deposit - locked;
  const over = margin > deposit;

  const bar = useSpring({
    lockedPct: (locked / deposit) * 100,
    config: { tension: 210, friction: 28 },
  });

  return (
    <section id="margin" aria-label={content.eyebrow} className="relative z-10">
      <div className="shell px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading
          eyebrow={content.eyebrow}
          heading={content.heading}
          intro={content.intro}
        />

        <Inview
          tag="div"
          mode="once"
          delayIn={160}
          from={{ opacity: 0, y: 28 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 180, friction: 26 }}
          className="mt-12 rounded-card border border-line bg-glass p-8 backdrop-blur-glass"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <label className="flex flex-col gap-3 text-sm">
              <span className="flex items-baseline justify-between">
                <span className="text-foreground/60">{content.depositLabel}</span>
                <output className="font-medium tabular-nums">
                  {usd.format(deposit)}
                </output>
              </span>
              <input
                type="range"
                min={1000}
                max={100_000}
                step={500}
                value={deposit}
                onChange={(event) => setDeposit(Number(event.target.value))}
                className="w-full [accent-color:var(--accent)]"
              />
            </label>

            <label className="flex flex-col gap-3 text-sm">
              <span className="flex items-baseline justify-between">
                <span className="text-foreground/60">
                  {content.lotsLabel} · EUR/USD
                </span>
                <output className="font-medium tabular-nums">
                  {lots.toFixed(2)} lots
                </output>
              </span>
              <input
                type="range"
                min={0.05}
                max={5}
                step={0.05}
                value={lots}
                onChange={(event) => setLots(Number(event.target.value))}
                className="w-full [accent-color:var(--accent)]"
              />
            </label>

            <fieldset className="flex flex-col gap-3 text-sm">
              <legend className="sr-only">{content.leverageLabel}</legend>
              <span className="text-foreground/60">{content.leverageLabel}</span>
              <div className="flex flex-wrap gap-2">
                {content.leverageOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={leverage === option}
                    onClick={() => setLeverage(option)}
                    className={`rounded-pill border px-4 py-2 text-sm tabular-nums transition-colors duration-[var(--duration-fast)] ease-entrance ${
                      leverage === option
                        ? "border-accent bg-accent text-ink"
                        : "border-line text-foreground/60 hover:border-accent hover:text-accent"
                    }`}
                  >
                    1:{option}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-10">
            <div className="flex h-4 overflow-hidden rounded-pill bg-ink ring-1 ring-line">
              <animated.div
                style={{ width: bar.lockedPct.to((value) => `${value}%`) }}
                className="h-full min-w-1 rounded-pill bg-accent"
              />
            </div>
            <dl className="mt-4 flex flex-wrap justify-between gap-4 text-sm">
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="size-2.5 rounded-pill bg-accent" />
                <dt className="text-foreground/60">{content.lockedLabel}</dt>
                <dd className="font-medium text-accent-from tabular-nums">
                  {usd.format(locked)}
                </dd>
              </div>
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="size-2.5 rounded-pill bg-accent-positive" />
                <dt className="text-foreground/60">{content.freeLabel}</dt>
                <dd className="font-medium tabular-nums">{usd.format(free)}</dd>
              </div>
            </dl>
            {over ? (
              <p className="mt-3 text-xs text-accent-from">
                This position needs {usd.format(margin)} of margin — more than
                your allocation at 1:{leverage}.
              </p>
            ) : null}
          </div>

          <p className="mt-8 text-sm font-medium text-foreground/70">
            {content.note}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground/45">
            {content.assumptions}
          </p>
        </Inview>
      </div>
    </section>
  );
};
