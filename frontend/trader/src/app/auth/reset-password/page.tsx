'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { scorePassword } from '@/lib/passwordStrength';
import toast from 'react-hot-toast';

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="text-text-tertiary hover:text-text-primary transition-colors"
    >
      {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Email now sends a 6-digit code (no magic link). Pre-fill from a legacy
  // ?token= link if present, otherwise the user types the code.
  const [code, setCode] = useState(searchParams.get('token') || '');
  // C-AUTH-1: the reset code is now bound to the account, so the e-mail is
  // required. Pre-fill it from the forgot-password redirect (?email=) when
  // present; otherwise the user types the address they requested the code for.
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const strength = scorePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.error('Enter the email you requested the code for');
      return;
    }
    if (code.trim().length < 6) {
      toast.error('Enter the 6-digit code from your email');
      return;
    }
    if (!strength.ok) {
      toast.error(strength.issues[0] ?? 'Choose a stronger password');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>('/auth/reset-password', {
        email: email.trim(),
        token: code.trim(),
        new_password: password,
      });
      toast.success(res.message || 'Password reset');
      router.replace('/auth/login');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen relative overflow-hidden bg-bg-primary flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* Inline Swiss-flag brand mark — no PNG dependency.
              Same mark as the navbar / hero so the user knows they
              haven't been redirected to a different brand mid-reset. */}
          <svg viewBox="0 0 32 32" aria-hidden="true" className="w-14 h-14">
            <rect width="32" height="32" rx="4" fill="#DC2626" />
            <rect x="13" y="6" width="6" height="20" fill="#ffffff" />
            <rect x="6" y="13" width="20" height="6" fill="#ffffff" />
          </svg>
          <span className="inline-flex items-baseline font-bold italic tracking-tight text-lg select-none">
            <span className="text-text-primary">Swiss</span>
            <span className="text-[#E94E1B]">Cresta</span>
          </span>
        </div>
        <div className="glass-panel rounded-3xl p-8 noise-texture overflow-hidden">
          <h1 className="text-xl font-bold text-text-primary mb-2">Reset password</h1>
          <p className="text-xs text-text-tertiary mb-6">Enter the 6-digit code we emailed you, then choose a new password.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Input
              label="Reset code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoComplete="one-time-code"
              placeholder="6-digit code"
            />
            <Input
              label="New password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              suffix={<EyeToggle shown={showPw} onToggle={() => setShowPw((s) => !s)} />}
            />
            {password ? (
              <div aria-live="polite">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((seg) => (
                    <span
                      key={seg}
                      className="h-1 flex-1 rounded-full transition-colors"
                      style={{
                        backgroundColor: strength.score >= seg
                          ? ['#EF4444', '#EF4444', '#F59E0B', '#84CC16', '#22C55E'][strength.score]
                          : 'rgba(128,128,128,0.25)',
                      }}
                    />
                  ))}
                  <span
                    className="text-xs ml-1 shrink-0"
                    style={{ color: ['#EF4444', '#EF4444', '#F59E0B', '#84CC16', '#22C55E'][strength.score] }}
                  >
                    {strength.label}
                  </span>
                </div>
                {strength.issues.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {strength.issues.map((issue) => (
                      <li key={issue} className="text-xs text-text-tertiary flex items-start gap-1.5">
                        <span className="text-danger leading-4">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <Input
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Repeat password"
              suffix={<EyeToggle shown={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />}
            />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Update password
            </Button>
          </form>
          <p className="text-center mt-6">
            <Link href="/auth/login" className="text-xxs text-buy hover:text-buy-light transition-fast">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-primary flex items-center justify-center text-text-tertiary text-sm">
          Loading…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
