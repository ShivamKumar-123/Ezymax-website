import ScrollReveal from './animations/ScrollReveal'

const SectionHeader = ({ badge, title, highlight, subtitle, align = 'center' }) => {
  const titleParts = highlight ? title.split(highlight) : [title]

  return (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      {badge && (
        <ScrollReveal variant="fadeUp">
          <div className={`inline-flex items-center gap-2 mb-4 ${align === 'center' ? 'justify-center' : ''}`}>
            <div className="w-5 h-px bg-primary-accent" />
            <span className="text-primary-accent text-xs font-bold uppercase tracking-[0.2em]">
              {badge}
            </span>
            <div className="w-5 h-px bg-primary-accent" />
          </div>
        </ScrollReveal>
      )}

      <ScrollReveal variant="fadeUp" delay={0.1}>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
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
        <div className={`flex ${align === 'center' ? 'justify-center' : ''} mb-4`}>
          <div className="w-16 h-px neon-divider" />
        </div>
      </ScrollReveal>

      {subtitle && (
        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p className={`text-text-secondary text-lg max-w-2xl leading-relaxed ${align === 'center' ? 'mx-auto' : ''}`}>
            {subtitle}
          </p>
        </ScrollReveal>
      )}
    </div>
  )
}

export default SectionHeader
