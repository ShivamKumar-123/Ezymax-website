'use client';

import { BrandLogo } from '@/components/BrandLogo';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { scorePassword, PASSWORD_REQUIREMENTS } from '@/lib/passwordPolicy';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('Invalid reset link');
      return;
    }
    // Same policy as register page — keeps the bar from sliding sideways
    // (signup demands strong, but reset would have accepted '12345678').
    const pwCheck = scorePassword(password);
    if (!pwCheck.acceptable) {
      toast.error(pwCheck.issues[0] || 'Password is too weak — pick a stronger one');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>('/auth/reset-password', {
        token: token.trim(),
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
        <div className="mb-8 flex justify-center">
          <BrandLogo className="w-20 h-20 object-contain" />
        </div>
        <div className="glass-panel rounded-3xl p-8 noise-texture overflow-hidden">
          <h1 className="text-xl font-bold text-text-primary mb-2">Reset password</h1>
          <p className="text-xs text-text-tertiary mb-6">Choose a new password for your account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="8+ chars · upper · lower · number · symbol"
            />
            {password.length > 0 && (() => {
              const pwCheck = scorePassword(password);
              return (
                <div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 4, borderRadius: 2,
                          background: i <= pwCheck.score ? pwCheck.color : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: pwCheck.color }}>
                    {pwCheck.label}
                  </div>
                  {!pwCheck.acceptable && (
                    <ul style={{ marginTop: 6, padding: 0, listStyle: 'none', fontSize: 11, lineHeight: 1.6 }}>
                      {PASSWORD_REQUIREMENTS.map((req) => {
                        const ok = pwCheck.checks[req.id];
                        return (
                          <li key={req.id} style={{ color: ok ? '#22c55e' : '#9ca3af' }}>
                            <span style={{ marginRight: 6 }}>{ok ? '✓' : '○'}</span>
                            {req.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Repeat password"
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
