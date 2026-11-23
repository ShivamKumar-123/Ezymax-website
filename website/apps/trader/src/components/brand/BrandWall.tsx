import { EzymexLogo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

/**
 * The Ezymex wordmark as giant glossy black letters on a glowing red wall, standing on a dark reflective floor. Drawn
 * with CSS and the inline logo (no bitmap), so it stays sharp at every size and always shows the current brand.
 */
export function BrandWall({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The Ezymex logo in giant glossy black letters on a glowing red wall"
      className={cn('relative isolate aspect-[1672/941] w-full overflow-hidden bg-[#160000]', className)}
    >
      {/* the wall: a red glow brightest behind the letters */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(115% 85% at 50% 42%, #ff3218 0%, #dc1208 30%, #8c0704 62%, #2c0101 100%)' }}
      />
      {/* the floor, with a thin bright line where it meets the wall */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[30%]"
        style={{ background: 'linear-gradient(to bottom, #4a0302 0%, #1f0100 55%, #0c0000 100%)' }}
      />
      <div aria-hidden className="absolute inset-x-0 top-[70%] h-[2px] bg-[#ff6a4a]/50 blur-[1.5px]" />
      {/* the letters: black, a red rim on their edges and a soft shadow on the wall */}
      <div
        aria-hidden
        className="absolute inset-x-[7%] top-[36%]"
        style={{ filter: 'drop-shadow(0 0 1.5px rgba(255,120,90,0.85)) drop-shadow(0 18px 22px rgba(40,0,0,0.65))' }}
      >
        <EzymexLogo className="block h-auto w-full text-[#050505]" title="" />
      </div>
      {/* their reflection on the floor */}
      <div
        aria-hidden
        className="absolute inset-x-[7%] top-[71%] opacity-40"
        style={{
          transform: 'scaleY(-1)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 55%)',
          maskImage: 'linear-gradient(to top, black 0%, transparent 55%)',
          filter: 'blur(1px)',
        }}
      >
        <EzymexLogo className="block h-auto w-full text-black" title="" />
      </div>
      {/* vignette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
      />
    </div>
  );
}
