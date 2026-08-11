'use client';

/**
 * Sign-up page (SwissCresta) — thin wrapper around the shared
 * FullScreenSignup card. Only email + password are collected here;
 * personal details (name, phone, country, address, DOB) are asked for
 * later, on the /kyc page, when the user applies for verification.
 */

import { FullScreenSignup } from '@/components/ui/full-screen-signup';

export default function RegisterPage() {
  return <FullScreenSignup mode="signup" />;
}
