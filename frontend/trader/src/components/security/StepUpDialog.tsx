'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api/client';

/**
 * Step-up verification dialog (spec D3/D4).
 *
 * Flow: POST /auth/step-up/start {action, method:'auto'} → the server picks
 * the method (authenticator code when 2FA is on, otherwise a code emailed to
 * the account address) → user enters the code → POST /auth/step-up/verify →
 * onVerified(challenge_id). The caller then sends that id with the protected
 * request (e.g. `step_up_challenge_id` on a withdrawal) within 5 minutes; the
 * server redeems it exactly once.
 */

export type StepUpAction = 'withdrawal' | 'wallet_link' | 'wallet_disconnect' | 'email_change';

interface StartResponse {
  challenge_id: string;
  method: 'totp' | 'otp_old_email' | 'siwe';
  expires_at?: string;
  target_email_masked?: string;
}

interface StepUpDialogProps {
  open: boolean;
  action: StepUpAction;
  title?: string;
  description?: string;
  onClose: () => void;
  onVerified: (challengeId: string) => void | Promise<void>;
}

/** Server error details that mean "run step-up and retry". */
export function isStepUpError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg === 'STEP_UP_REQUIRED' || msg === 'STEP_UP_INVALID';
}

export default function StepUpDialog({
  open,
  action,
  title = 'Confirm it’s you',
  description,
  onClose,
  onVerified,
}: StepUpDialogProps) {
  const [challenge, setChallenge] = useState<StartResponse | null>(null);
  const [code, setCode] = useState('');
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedFor = useRef<boolean>(false);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    setCode('');
    try {
      const res = await api.post<StartResponse>('/auth/step-up/start', { action, method: 'auto' });
      setChallenge(res);
    } catch (err) {
      setChallenge(null);
      setError(err instanceof Error ? err.message : 'Could not start verification');
    } finally {
      setStarting(false);
    }
  }, [action]);

  useEffect(() => {
    if (open && !startedFor.current) {
      startedFor.current = true;
      void start();
    }
    if (!open) {
      startedFor.current = false;
      setChallenge(null);
      setCode('');
      setError(null);
    }
  }, [open, start]);

  const submit = async () => {
    if (!challenge) return;
    const trimmed = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const proof = challenge.method === 'totp' ? { code: trimmed } : { otp: trimmed };
      await api.post('/auth/step-up/verify', { challenge_id: challenge.challenge_id, proof });
      await onVerified(challenge.challenge_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const isTotp = challenge?.method === 'totp';
  const hint = isTotp
    ? 'Enter the 6-digit code from your authenticator app.'
    : challenge
      ? `We emailed a 6-digit code to ${challenge.target_email_masked || 'your email address'}.`
      : '';

  return (
    <Modal open={open} onClose={onClose} title={title} width="sm">
      <div className="flex flex-col gap-4">
        {description && <p className="text-sm text-text-secondary">{description}</p>}
        {starting && <p className="text-sm text-text-tertiary">Preparing verification…</p>}
        {!starting && challenge && (
          <>
            <p className="text-sm text-text-secondary">{hint}</p>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              className="w-full rounded-lg border border-border-glass bg-bg-base px-4 py-3 text-center font-mono text-xl tracking-[0.5em] text-text-primary outline-none focus:border-buy"
              placeholder="••••••"
              aria-label="Verification code"
            />
          </>
        )}
        {error && <p className="text-sm text-sell">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          {!isTotp && challenge ? (
            <button
              type="button"
              className="text-xs text-text-tertiary hover:text-text-primary disabled:opacity-50"
              disabled={starting || verifying}
              onClick={() => {
                void start().then(() => toast.success('New code sent'));
              }}
            >
              Send a new code
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="md" onClick={onClose} disabled={verifying}>
              Cancel
            </Button>
            {challenge ? (
              <Button variant="primary" size="md" loading={verifying} onClick={() => void submit()}>
                Verify
              </Button>
            ) : (
              <Button variant="primary" size="md" loading={starting} onClick={() => void start()}>
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
