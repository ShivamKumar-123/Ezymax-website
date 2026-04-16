import GooeyText from '../../components/GooeyText'
import ColorBends from '../../components/ColorBends'

export default function HeroSection() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#0A0E1A', overflow: 'hidden' }}>
      {/* Text overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none pt-20 sm:pt-32 md:pt-40 lg:pt-52">
        <GooeyText
          texts={["Your", "Edge", "in", "Every", "Market"]}
          morphTime={1}
          cooldownTime={0.25}
          className="font-bold h-[100px] sm:h-[120px] md:h-[250px] lg:h-[300px] w-full"
          textClassName="font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
        />
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
