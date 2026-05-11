import ScrollReveal from './animations/ScrollReveal'

const SectionHeader = ({ badge, title, highlight, subtitle, align = 'center' }) => {
  const titleParts = highlight ? title.split(highlight) : [title]
  const isCenter = align === 'center'

  return (
    <div className={isCenter ? 'text-center' : 'text-left'}>
      {badge && (
        <ScrollReveal variant="fadeUp">
          <div className={`inline-flex items-center gap-2 mb-5 ${isCenter ? 'justify-center' : ''}`}>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] md:text-[11px] font-bold uppercase"
              style={{
                letterSpacing: '0.22em',
                color: 'var(--fx-gold-light)',
                background:
                  'linear-gradient(180deg, rgba(214,169,61,0.18), rgba(214,169,61,0.04))',
                border: '1px solid rgba(214,169,61,0.32)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: 'var(--fx-gold)',
                  boxShadow: '0 0 8px rgba(214,169,61,0.7)',
                }}
              />
              {badge}
            </span>
          </div>
        </ScrollReveal>
      )}

      <ScrollReveal variant="fadeUp" delay={0.1}>
        <h2
          className="text-3xl md:text-4xl lg:text-5xl xl:text-[56px] font-bold text-white leading-[1.08] mb-5 tracking-tight"
        >
          {highlight ? (
            <>
              {titleParts[0]}
              <span className="gradient-text">{highlight}</span>
              {titleParts[1]}
            </>
          ) : title}
        </h2>
      </ScrollReveal>

      <ScrollReveal variant="fadeUp" delay={0.15}>
        <div className={`flex ${isCenter ? 'justify-center' : ''} mb-5`}>
          <div className="flex items-center gap-2">
            <span className="w-8 h-px" style={{ background: 'rgba(214,169,61,0.6)' }} />
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
            />
            <span className="w-8 h-px" style={{ background: 'rgba(214,169,61,0.6)' }} />
          </div>
        </div>
      </ScrollReveal>

      {subtitle && (
        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className={`text-base md:text-lg leading-relaxed max-w-2xl ${isCenter ? 'mx-auto' : ''}`}
            style={{ color: 'var(--fx-text-2)' }}
          >
            {subtitle}
          </p>
        </ScrollReveal>
      )}
    </div>
  )
}

export default SectionHeader
