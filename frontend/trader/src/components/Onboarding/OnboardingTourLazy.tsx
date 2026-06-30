'use client';

/**
 * Client-only, code-split entry point for the onboarding tour. The heavy
 * react-joyride bundle is loaded lazily (ssr:false) so it never ships in the
 * main bundle — only fetched in the browser when this mounts.
 */
import dynamic from 'next/dynamic';

const OnboardingTour = dynamic(() => import('./OnboardingTour'), { ssr: false });

export default function OnboardingTourLazy() {
  return <OnboardingTour />;
}
