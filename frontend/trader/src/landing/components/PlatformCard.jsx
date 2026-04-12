import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'

const PlatformCard = ({ name, description, features, cta, ctaLink, icon: Icon, featured = false }) => {
  return (
    <div className={`glass-card p-6 flex flex-col h-full ${featured ? 'border-primary-accent/30' : ''}`}>
      <div className="flex-1">
        {Icon && (
          <div className="feature-icon bg-primary-accent/10 text-primary-accent mb-4">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-white mb-2">{name}</h3>
        <p className="text-text-secondary text-sm leading-relaxed mb-5">{description}</p>

        <ul className="space-y-2 mb-5">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
              <Check className="w-4 h-4 text-primary-accent flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        to={ctaLink}
        className="inline-flex items-center gap-2 text-primary-accent text-sm font-medium hover:text-white transition-colors"
      >
        {cta}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

export default PlatformCard
