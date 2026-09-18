import { motion } from 'framer-motion'

export default function ShimmerText({
  children,
  className = '',
  duration = 1.5,
  delay = 1.5,
}) {
  return (
    <div className="overflow-hidden">
      <motion.div
        className={`inline-block ${className}`}
        style={{
          WebkitTextFillColor: 'transparent',
          background:
            'currentColor linear-gradient(to right, currentColor 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0.6) 60%, currentColor 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '50% 200%',
        }}
        initial={{ backgroundPositionX: '250%' }}
        animate={{ backgroundPositionX: ['-100%', '250%'] }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          repeatDelay: 1.5,
          ease: 'linear',
        }}
      >
        <span>{children}</span>
      </motion.div>
    </div>
  )
}
