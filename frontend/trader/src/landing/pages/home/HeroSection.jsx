import ColorBends from '../../components/ColorBends'
import ShimmerText from '../../components/ShimmerText'

export default function HeroSection() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#0A0E1A', overflow: 'hidden' }}>
      {/* Text overlay — left aligned, vertically centered */}
      <div className="absolute inset-0 z-10 flex items-center pointer-events-none px-6 sm:px-10 md:px-16 lg:px-24 xl:px-32">
        <div className="w-full max-w-7xl text-left pointer-events-auto">
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            <ShimmerText
              className="text-[28px] sm:text-[36px] md:text-[45px] lg:text-[56px] xl:text-[67px] font-extrabold text-white leading-[1.08] tracking-tight drop-shadow-[0_4px_30px_rgba(0,0,0,0.7)]"
              duration={1.5}
              delay={0.5}
            >
              Execution trade with lightning speed
            </ShimmerText>
            <ShimmerText
              className="text-[28px] sm:text-[36px] md:text-[45px] lg:text-[56px] xl:text-[67px] font-extrabold text-white leading-[1.08] tracking-tight drop-shadow-[0_4px_30px_rgba(0,0,0,0.7)]"
              duration={1.5}
              delay={1.5}
            >
              Trade with confidence
            </ShimmerText>
          </div>
          <h6 className="mt-5 sm:mt-6 md:mt-8 text-sm sm:text-base md:text-lg text-white/60 max-w-3xl leading-relaxed font-normal whitespace-normal">
            Trade smarter with ultra-fast execution, tight spreads, and powerful brokerage tools that ensure precision, stability, and confidence in every transaction.
          </h6>
        </div>
      </div>

      {/* Background ColorBends Animation */}
      <ColorBends
        colors={['#1A56FF', '#0D3FCC', '#0A2A99']}
        rotation={90}
        speed={0.2}
        scale={1}
        frequency={1}
        warpStrength={1}
        mouseInfluence={1}
        noise={0.15}
        parallax={0.5}
        iterations={1}
        intensity={1.5}
        bandWidth={6}
        transparent
        autoRotate={0}
      />
    </div>
  )
}
