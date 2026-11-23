'use client';

import { useEffect } from 'react';
import { CRM_URL } from '@/lib/crm';

/**
 * First-touch campaign attribution (Ezymex D144). The first website visit with utm_* / ref tags is remembered
 * for 30 days, and every link into the Client Area (sign-up, sign-in, open account) carries those tags, so the
 * Client Area stores them on the new client. Links that already have utm_* are left alone.
 */
const KEY = 'ezymex_campaign';
const TAGS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'c'] as const;
const TTL = 30 * 24 * 3600 * 1000;

type Stored = { at: number; tags: Record<string, string> };

function read(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Stored | null;
    return v && Date.now() - v.at < TTL ? v : null;
  } catch {
    return null;
  }
}

export default function CampaignForwarder() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tags: Record<string, string> = {};
    for (const k of TAGS) {
      const v = q.get(k);
      if (v && v.trim()) tags[k] = v.trim().slice(0, 100);
    }
    if (Object.keys(tags).length && !read()) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), tags }));
      } catch {
        /* storage blocked: tags still ride on this page's links below */
      }
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      const toCrm = url.href.startsWith(CRM_URL) || (url.origin === window.location.origin && url.pathname.startsWith('/auth/'));
      if (!toCrm || [...url.searchParams.keys()].some((k) => k.startsWith('utm_'))) return;
      const t = Object.keys(tags).length ? tags : read()?.tags;
      if (!t) return;
      for (const [k, v] of Object.entries(t)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
      a.href = url.toString();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
