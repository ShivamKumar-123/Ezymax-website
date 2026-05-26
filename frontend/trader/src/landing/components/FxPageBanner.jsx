/**
 * Page-level banner / image slot.
 *
 * Sits between sections (NOT inside an fx-section-frame). Use 2-3 per
 * page max — typically after the hero, around the mid-page break, and
 * before the final CTA.
 *
 * Pass `image` to render a real banner image. Without it, the component
 * falls back to the dashed-gold placeholder so the visual story stays
 * consistent across pages still being built.
 *
 * Pass `tagline` (and optional `taglineSub`) to overlay copy on the empty
 * area of the banner. `align` controls which side the copy sits on; a soft
 * scrim is drawn behind it so the text stays readable on both bright and
 * dark banners.
 */
/**
 * @param {{
 *   label?: string,
 *   tone?: string,
 *   image?: string,
 *   alt?: string,
 *   tagline?: string,
 *   taglineSub?: string,
 *   align?: 'left' | 'right' | 'center',
 * }} props
 */
export default function FxPageBanner({
  label = 'Banner / Image',
  tone = 'bg',
  image,
  alt = '',
  tagline,
  taglineSub,
  align = 'left',
}) {
  const scrim =
    align === 'right'
      ? 'linear-gradient(270deg, rgba(8,10,14,0.78) 0%, rgba(8,10,14,0.40) 32%, transparent 58%)'
      : align === 'center'
        ? 'linear-gradient(0deg, rgba(8,10,14,0.55), rgba(8,10,14,0.25))'
        : 'linear-gradient(90deg, rgba(8,10,14,0.78) 0%, rgba(8,10,14,0.40) 32%, transparent 58%)'

  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'

  const textAlign = align === 'center' ? 'text-center' : 'text-left'

  return (
    <section
      className="relative"
      style={{ background: tone === 'elev' ? 'var(--fx-bg-elev)' : 'var(--fx-bg)' }}
    >
      <div className="fx-container py-8 md:py-10 lg:py-12">
        {image ? (
          <div className="relative overflow-hidden rounded-2xl">
            <img src={image} alt={alt} className="w-full h-auto block" />

            {tagline && (
              <>
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: scrim }}
                />
                <div className={`absolute inset-0 flex items-center ${justify}`}>
                  <div
                    className={`px-[7%] md:px-[8%] ${textAlign}`}
                    style={{ maxWidth: align === 'center' ? '80%' : '52%' }}
                  >
                    <h3 className="text-white font-extrabold leading-tight text-xl sm:text-2xl md:text-3xl lg:text-[40px]">
                      {tagline}
                    </h3>
                    {taglineSub && (
                      <p
                        className="mt-2 md:mt-3 text-sm md:text-base lg:text-lg leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.88)' }}
                      >
                        {taglineSub}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="fx-section-banner" aria-hidden>
            <span>{label}</span>
          </div>
        )}
      </div>
    </section>
  )
}
