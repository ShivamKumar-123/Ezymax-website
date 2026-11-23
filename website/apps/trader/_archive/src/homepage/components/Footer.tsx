'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Reveal } from './Reveal';
import { BRAND, FOOTER } from '../data';

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#f4f1ec] pt-6 pb-10">
      <div className="kx-container">
        <Reveal className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr] lg:gap-8">
          <div>
            <BrandMark />
            <p className="mt-5 max-w-[300px] text-[13px] leading-relaxed text-[#3a3a3a]">{FOOTER.mission}</p>
            <p className="mt-6 text-[13px] text-[#3a3a3a]">Website: {FOOTER.website}</p>
          </div>

          <div>
            <h3 className="text-[14px] font-bold">Primary Pages</h3>
            <ul className="mt-4 space-y-2.5">
              {FOOTER.primary.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-[#3a3a3a] hover:text-[#0a0a0a]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[14px] font-bold">Utility Pages</h3>
            <ul className="mt-4 space-y-2.5">
              {FOOTER.utility.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-[#3a3a3a] hover:text-[#0a0a0a]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[14px] font-bold">Subscribe To Our Newsletter</h3>
            <form
              className="mt-4 flex h-12 max-w-[360px] items-center rounded-full border border-[#0a0a0a] bg-white p-1 pl-5"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                required
                placeholder="Enter your email"
                aria-label="Email"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#7a7a7a]"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0a0a0a] text-white"
              >
                <ArrowRight className="size-4" />
              </button>
            </form>
          </div>
        </Reveal>

        <Reveal as="p" delay={160} className="mt-14 text-center text-[12px] text-[#3a3a3a]">
          &copy; Copyright {new Date().getFullYear()}, All Rights Reserved by {BRAND}
        </Reveal>
      </div>
    </footer>
  );
}
