/**
 * Page-level banner / image slot.
 *
 * Sits between sections (NOT inside an fx-section-frame). Use 2-3 per
 * page max — typically after the hero, around the mid-page break, and
 * before the final CTA. Drop a real <img> in to replace.
 *
 * The styling is intentionally the same dashed-gold placeholder so the
 * visual story is consistent across pages.
 */
export default function FxPageBanner({ label = 'Banner / Image', tone = 'bg' }) {
  return (
    <section
      className="relative"
      style={{ background: tone === 'elev' ? 'var(--fx-bg-elev)' : 'var(--fx-bg)' }}
    >
      <div className="fx-container py-8 md:py-10 lg:py-12">
        <div className="fx-section-banner" aria-hidden>
          <span>{label}</span>
        </div>
      </div>
    </section>
  )
}
