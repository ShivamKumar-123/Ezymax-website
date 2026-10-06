'use client';

/**
 * Sign-in page (Ezymex) — thin wrapper around the shared
 * FullScreenSignup card. The card itself owns the form state, validation
 * and auth-store wiring; this page just selects the `login` variant.
 */

import { FullScreenSignup } from '@/components/ui/full-screen-signup';

export default function LoginPage() {
  return <FullScreenSignup mode="login" />;
}
