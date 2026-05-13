'use client';

/**
 * Email OTP step inside the OnboardingGate (and reused on the profile
 * Security card for the change-email flow).
 *
 * Two phases:
 *   1. Enter the address → POST /auth/email/start-verification
 *      Backend rate-limits 1/min and 3/hour per user.
 *   2. Enter the 6-digit code → POST /auth/email/verify-otp
 *      Backend allows 5 wrong attempts before consuming the code.
 *
 * On success we call onVerified() which the parent uses to refreshUser()
 * (the gate then unmounts itself because email_verified flips to true).
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Mail, ArrowRight, RotateCcw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';

const RESEND_COOLDOWN_SECONDS = 60;

type StartResp = { sent: boolean; target_email: string; expires_at: string; ttl_seconds: number };
type VerifyResp = { verified: boolean; email: string; email_verified: boolean; action: string };

export default function EmailOtpStep({
  currentEmail, isPlaceholder, onVerified,
}: {
  /** users.email value at render time. Used to pre-fill if it's a real address; cleared if placeholder. */
  currentEmail: string;
  isPlaceholder: boolean;
  onVerified: () => void;
}) {
  const [phase, setPhase] = useState<'enter-email' | 'enter-otp'>('enter-email');
  const [email, setEmail] = useState(isPlaceholder ? '' : currentEmail);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Resend cooldown timer.
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (resendIn <= 0) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [resendIn]);

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<StartResp>('/auth/email/start-verification', { email: trimmed });
      toast.success(`Code sent to ${res.target_email}`);
      setPhase('enter-otp');
      setOtp('');
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : e?.message || 'Could not send code';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    const code = otp.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post<VerifyResp>('/auth/email/verify-otp', { otp: code });
      toast.success('Email verified');
      onVerified();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : e?.message || 'Could not verify code';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {phase === 'enter-email' ? (
        <>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Email address</label>
            <div className="relative">
              <Mail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void sendCode(); }}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-bg-base border border-border-primary text-sm text-text-primary placeholder:text-text-tertiary focus:border-[#d6a93d] focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={busy || !email.trim()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#d6a93d] text-bg-base text-sm font-bold hover:brightness-110 disabled:opacity-60 transition-colors"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Send code
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-text-secondary leading-relaxed">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-text-primary tabular-nums">{email.trim().toLowerCase()}</span>.
            It expires in 10 minutes.
          </p>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') void verifyCode(); }}
              placeholder="••••••"
              className="w-full px-3 py-3 rounded-lg bg-bg-base border border-border-primary text-center text-xl tracking-[0.5em] font-mono text-text-primary placeholder:text-text-tertiary focus:border-[#d6a93d] focus:outline-none"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void verifyCode()}
              disabled={busy || otp.length !== 6}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#d6a93d] text-bg-base text-sm font-bold hover:brightness-110 disabled:opacity-60 transition-colors"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Verify
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-tertiary">
            <button
              type="button"
              onClick={() => { setPhase('enter-email'); setOtp(''); setError(null); }}
              className="hover:text-text-primary"
            >
              Use a different email
            </button>
            <button
              type="button"
              onClick={() => { if (resendIn === 0) void sendCode(); }}
              disabled={resendIn > 0 || busy}
              className="inline-flex items-center gap-1 hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={10} />
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
