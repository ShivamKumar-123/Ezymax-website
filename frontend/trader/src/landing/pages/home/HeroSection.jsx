import BlurText from '../../components/BlurText'
import GradientBlinds from '../../components/GradientBlinds'

export default function HeroSection() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Text overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <BlurText
          text="Your Edge in Every Market"
          delay={200}
          animateBy="words"
          direction="top"
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] justify-center"
        />
      </div>

      {/* Background WebGL Gradient */}
      <GradientBlinds
        gradientColors={['#FF9FFC', '#5227FF']}
        angle={0}
        noise={0.3}
        blindCount={12}
        blindMinWidth={50}
        spotlightRadius={0.5}
        spotlightSoftness={1}
        spotlightOpacity={1}
        mouseDampening={0.15}
        distortAmount={0}
        shineDirection="left"
        mixBlendMode="lighten"
      />
    </div>
  )
}
