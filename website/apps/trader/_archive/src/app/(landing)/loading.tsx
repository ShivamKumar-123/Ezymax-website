/**
 * Landing route-group loading splash.
 *
 * Next.js renders this while any (landing)/page.tsx is suspending — it
 * replaces the empty-screen / FOUC moment the client saw on slower routes.
 * Pairs with TopLoader (a thin progress bar at the top of every route)
 * for the link-click → route-ready visual chain.
 */
import { BrandLogo } from '@/components/BrandLogo';

export default function LandingLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[9990] flex items-center justify-center"
      style={{ background: '#ffffff' }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Splash is pinned white, so it always takes the black mark. */}
        <BrandLogo tone="ink" className="h-9 w-auto object-contain" draggable={false} />
        <div className="relative size-8">
          <span
            className="absolute inset-0 rounded-full border-2 border-black/10"
            aria-hidden="true"
          />
          <span
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: '#E12019',
              borderRightColor: 'rgba(225, 32, 25, 0.35)',
              animationDuration: '1.05s',
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
