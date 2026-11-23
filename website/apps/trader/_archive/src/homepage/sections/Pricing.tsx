'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Reveal } from '../components/Reveal';
import { PLANS, PRICING_HEADING, SIGNUP_HREF } from '../data';

export function Pricing() {
  const [period, setPeriod] = useState<'monthly' | 'annually'>('monthly');

  return (
    <section className="kx-container pb-20 text-center lg:pb-28">
      <Reveal as="h2" className="kx-h2 mx-auto max-w-[720px]">
        {PRICING_HEADING[0]}
        <br />
        {PRICING_HEADING[1]}
      </Reveal>

      {/* Monthly / Annually toggle */}
      <Reveal delay={140} className="mt-8 inline-flex rounded-full border border-[#0a0a0a] p-1">
        {(['monthly', 'annually'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`rounded-full px-6 py-2 text-[14px] font-semibold capitalize transition-colors ${
              period === p ? 'bg-[#0a0a0a] text-white' : 'text-[#0a0a0a]'
            }`}
          >
            {p}
          </button>
        ))}
      </Reveal>

      <div className="mt-10 grid gap-6 text-left md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal
            as="article"
            key={plan.name}
            delay={200 + i * 140}
            className="kx-lift flex flex-col rounded-[20px] border border-[#0a0a0a] bg-[#f4f1ec] p-8"
          >
            <h3 className="text-[18px] font-bold tracking-[-0.02em]">{plan.name}</h3>
            <p className="mt-1 text-[13px] text-[#4a4a4a]">{plan.seats}</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-[52px] font-extrabold leading-none tracking-[-0.04em]">{plan.price}</span>
              <span className="text-[13px] font-semibold text-[#4a4a4a]">
                /Per {period === 'monthly' ? 'month' : 'year'}
              </span>
            </p>
            <p className="mt-6 text-[14px] leading-relaxed text-[#3a3a3a]">{plan.text}</p>
            <Link href={SIGNUP_HREF} className="kx-btn kx-btn-outline mt-8 w-full">
              Choose the plan
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
