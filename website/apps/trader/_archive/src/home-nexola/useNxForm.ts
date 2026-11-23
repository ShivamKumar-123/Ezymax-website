'use client';

import { useState } from 'react';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';

export type NxFormStatus = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Submit handler for the marketing forms (contact, market brief). Posts to
 * the public contact endpoint the /company/contact page already uses, so
 * every submission reaches the support inbox instead of being discarded.
 *
 * `fallbackMessage` fills the message body for forms that have no message
 * field (the newsletter signup).
 */
export function useNxForm(subject: string, fallbackMessage?: string) {
  const [status, setStatus] = useState<NxFormStatus>('idle');
  const [error, setError] = useState('');

  const fail = `We couldn't send that. Please email ${BRAND_SUPPORT_EMAIL} directly.`;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const message = String(fd.get('message') || '').trim() || fallbackMessage || '';
    if (!name || !email || !message) {
      setStatus('error');
      setError('Please fill in every field.');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/v1/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) {
        const data: { detail?: unknown } = await res.json().catch(() => ({}));
        throw new Error(typeof data?.detail === 'string' ? data.detail : fail);
      }
      setStatus('sent');
      form.reset();
      // Floating labels are toggled by init.ts on input; clear them too.
      form.querySelectorAll('.has-value').forEach((el) => el.classList.remove('has-value'));
    } catch (err) {
      setStatus('error');
      setError((err as Error)?.message || fail);
    }
  };

  return { status, error, onSubmit };
}
