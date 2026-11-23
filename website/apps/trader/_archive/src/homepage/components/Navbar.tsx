'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { LOGIN_HREF, NAV, SIGNUP_HREF } from '../data';

/**
 * Header exactly as the reference: logo left, menu centred
 * (Home▾ About Services▾ Pages▾ Contact), Login + "Sign up free" right.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <header className="kx-nav-in relative z-40">
      <div className="kx-container flex h-[76px] items-center justify-between">
        <BrandMark />

        {/* Desktop menu */}
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.label} className={`relative ${item.children ? 'kx-dd-parent' : ''}`}>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[15px] font-medium text-[#0a0a0a] transition-colors hover:bg-black/[0.04]"
                >
                  {item.label}
                  {item.children && <ChevronDown className="size-3.5 opacity-70" />}
                </Link>
                {item.children && (
                  <div className="kx-dd">
                    {item.children.map((c) => (
                      <Link key={c.href + c.label} href={c.href}>
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2.5 lg:flex">
          <Link href={LOGIN_HREF} className="kx-btn kx-btn-outline kx-btn-sm">
            Login
          </Link>
          <Link href={SIGNUP_HREF} className="kx-btn kx-btn-solid kx-btn-sm">
            Sign up free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-full border border-[#0a0a0a] lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f1ec] lg:hidden">
          <div className="kx-container flex h-[76px] items-center justify-between">
            <BrandMark />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-full border border-[#0a0a0a]"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="kx-container flex-1 overflow-y-auto py-2">
            <ul className="divide-y divide-black/10">
              {NAV.map((item) => {
                const isOpen = expanded === item.label;
                return (
                  <li key={item.label}>
                    {item.children ? (
                      <>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : item.label)}
                          className="flex w-full items-center justify-between py-4 text-[20px] font-semibold"
                        >
                          {item.label}
                          <ChevronDown className={`size-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <ul className="pb-3">
                            {item.children.map((c) => (
                              <li key={c.href + c.label}>
                                <Link
                                  href={c.href}
                                  onClick={() => setOpen(false)}
                                  className="block py-2 pl-4 text-[15px] text-black/70"
                                >
                                  {c.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block py-4 text-[20px] font-semibold"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="kx-container grid gap-3 border-t border-black/10 py-5">
            <Link href={SIGNUP_HREF} className="kx-btn kx-btn-solid" onClick={() => setOpen(false)}>
              Sign up free
            </Link>
            <Link href={LOGIN_HREF} className="kx-btn kx-btn-outline" onClick={() => setOpen(false)}>
              Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
