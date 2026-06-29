'use client';

/**
 * Host for the first-time onboarding tour (driver.js).
 *
 * Lazy-loaded (mounted via next/dynamic, ssr:false) so the driver.js bundle
 * + styles never ship in the main bundle. driver.js paints its own overlay /
 * popover to the DOM, so this component renders nothing — useTourState() does
 * all the work. The CSS below themes the popover to the platform tokens
 * (auto dark/light via CSS variables).
 */
import 'driver.js/dist/driver.css';
import './onboardingTour.css';
import { useTourState } from './useTourState';

export default function OnboardingTour() {
  useTourState();
  return null;
}
