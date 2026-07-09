'use client'

import { useEffect } from 'react'

/**
 * TapReveal
 * ----------------------------------------------------------------------------
 * On touch devices, the site's card/tile hover animations never fire (there's
 * no mouse hover). This mounts a single delegated `touchstart` listener that,
 * when a shared interactive element is tapped, adds `.fx-tapped` to it so the
 * mirrored CSS plays the same lift/zoom animation — then removes it after a
 * short beat so it settles back (play-once). Tapping another card releases the
 * previous one.
 *
 * No-ops on real mouse devices (`(hover: hover)`), so desktop is untouched.
 */
const SELECTOR =
  '.fx-tile, .fx-tile-gold, .fx-tile-media, .fx-card, .glass-card, .fx-stat-chart, .fx-puzzle-piece, .fx-venn-circle'

const HOLD_MS = 1600

export default function TapReveal() {
  useEffect(() => {
    // Skip devices that have a real hover-capable pointer (desktop) — they
    // already get the :hover animations and we don't want double behavior.
    if (typeof window === 'undefined') return
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) return

    let timer = null

    const clearOthers = (keep) => {
      document.querySelectorAll('.fx-tapped').forEach((n) => {
        if (n !== keep) n.classList.remove('fx-tapped')
      })
    }

    const onTouch = (e) => {
      const target = e.target
      if (!target || typeof target.closest !== 'function') return
      const el = target.closest(SELECTOR)
      if (!el) return
      clearOthers(el)
      el.classList.add('fx-tapped')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        el.classList.remove('fx-tapped')
        timer = null
      }, HOLD_MS)
    }

    document.addEventListener('touchstart', onTouch, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouch)
      if (timer) clearTimeout(timer)
    }
  }, [])

  return null
}
