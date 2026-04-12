const FeatureCard = ({ icon: Icon, title, description }) => {
  return (
    <div className="glass-card p-6">
      <div className="feature-icon bg-primary-accent/10 text-primary-accent mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
    </div>
  )
}

export default FeatureCard
