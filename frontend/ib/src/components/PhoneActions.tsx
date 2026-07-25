'use client';

import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Phone, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Shows a follower's mobile number with a Call (tel:) button and a Copy
 * button. Used in the followers list and the follower detail header. Renders
 * a muted dash when no number is on file.
 */
export default function PhoneActions({
  phone,
  compact = false,
}: {
  phone?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const value = (phone || '').trim();

  if (!value) {
    return <span className="text-[11px] text-text-tertiary">No number</span>;
  }

  const copy = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Number copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {!compact && <span className="font-mono text-xs text-text-secondary">{value}</span>}
      <a
        href={`tel:${value}`}
        title={`Call ${value}`}
        aria-label={`Call ${value}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center rounded-md border border-success/40 bg-success/10 p-1.5 text-success hover:bg-success/20"
      >
        <Phone size={13} />
      </a>
      <button
        type="button"
        onClick={copy}
        title="Copy number"
        aria-label="Copy number"
        className="inline-flex items-center justify-center rounded-md border border-border-primary p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
      >
        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      </button>
    </div>
  );
}
