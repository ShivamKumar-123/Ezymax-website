'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Shield, X, ShieldCheck, Coins, Clock, Zap } from 'lucide-react';

const STORAGE_KEY = 'fx-insurance-onboarded';

type Screen = {
  icon: any;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
};

const SCREENS: Screen[] = [
  {
    icon: Shield,
    eyebrow: 'Hook',
    title: 'What if your losses were partially protected?',
    body: 'Trade with confidence. Reduce risk on every trade.',
    cta: 'Next',
  },
  {
    icon: Zap,
    eyebrow: 'The Problem',
    title: 'One bad trade can wipe your profits',
    body: 'Markets move fast. Losses are part of trading. Without protection, a single bad day can erase weeks of gains.',
    cta: 'Show me the solution',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'The Solution',
    title: 'Introducing Trade Protection',
    body: 'Pay a small fee. Get part of your loss back automatically when a covered trade closes in loss.',
    cta: 'How it works',
  },
  {
    icon: Check,
    eyebrow: 'How it works',
    title: 'Simple. Fast. Automatic.',
    body: '1. Open a trade  2. Turn ON protection + pick a tier  3. Pay the small fee  4. If the trade closes in loss, the refund is credited instantly.',
    cta: 'See plans',
  },
  {
    icon: Coins,
    eyebrow: 'Plans',
    title: 'Choose your protection level',
    body: 'Basic 20% (up to $100) · Advanced 30% (up to $300) · Pro 40% (up to $600) · Elite 50% (up to $1,000). A small fee applies per trade — fee scales with risk.',
    cta: 'Continue',
  },
  {
    icon: Coins,
    eyebrow: 'Real example',
    title: 'How it lands in practice',
    body: 'Trade size $1,000 · Loss $200 · Elite plan (50%) → $100 credited back to your wallet instantly. Cap rule: large losses are capped at the plan max.',
    cta: 'Got it',
  },
  {
    icon: Clock,
    eyebrow: 'Rules',
    title: 'Simple rules to keep it fair',
    body: '· Trade must run at least 5 minutes\n· Activate protection before placing the trade\n· Hedging or instant open/close not eligible\n· Valid only when the trade closes in loss\n· Max 2 insured trades per day',
    cta: 'Continue',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Ready',
    title: 'Trade smarter. Lose less.',
    body: 'Activate protection on your next trade — toggle the shield on the order ticket and pick your tier.',
    cta: 'Start trading with protection',
  },
];

export default function InsuranceOnboardingModal({ forceOpen }: { forceOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setOpen(true);
    } catch { /* private mode → just show once */
      setOpen(true);
    }
  }, [forceOpen]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  };
  const advance = () => {
    if (step < SCREENS.length - 1) setStep(step + 1);
    else close();
  };
  const back = () => setStep(Math.max(0, step - 1));

  if (!open) return null;

  const s = SCREENS[step];
  const Icon = s.icon;
  const total = SCREENS.length;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[#d6a93d]/30 bg-bg-secondary shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary p-1.5 rounded-full hover:bg-bg-hover z-10"
          aria-label="Skip onboarding"
        >
          <X size={16} />
        </button>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 pb-2">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={
                'h-1.5 rounded-full transition-all ' +
                (i === step ? 'w-6 bg-[#d6a93d]' : 'w-1.5 bg-border-primary')
              }
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-3 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#d6a93d]/20 to-[#d6a93d]/5 border border-[#d6a93d]/35 flex items-center justify-center mb-4">
            <Icon size={28} className="text-[#d6a93d]" />
          </div>
          <p className="text-[10.5px] uppercase tracking-wider text-[#d6a93d] font-semibold mb-1">{s.eyebrow}</p>
          <h2 className="text-xl font-bold text-text-primary leading-tight">{s.title}</h2>
          <p className="text-sm text-text-secondary mt-3 whitespace-pre-line leading-relaxed">{s.body}</p>
        </div>

        <div className="px-6 pb-6 flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="px-3 py-2.5 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:border-[#d6a93d]/45 text-sm flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={close}
              className="px-3 py-2.5 rounded-lg border border-border-primary text-text-tertiary hover:text-text-secondary text-sm"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={advance}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#d6a93d] text-bg-base hover:brightness-110 text-sm font-bold flex items-center justify-center gap-2"
          >
            {s.cta} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
