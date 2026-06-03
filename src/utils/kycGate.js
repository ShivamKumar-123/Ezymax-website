import { Alert } from 'react-native';
import { authedFetch } from './authedFetch';

// Mirrors the web trader app: a user can sign in and browse, but cannot open
// a new live trading account until their KYC is approved/verified. Pending,
// rejected, or unsubmitted users are shown a gate dialog instead.

export function isKycApproved(status) {
  const v = String(status || '').toLowerCase();
  return v === 'approved' || v === 'verified';
}

export function kycStatusLabel(status) {
  const v = String(status || '').toLowerCase();
  if (!v || v === 'pending' || v === 'none') return 'Not started';
  if (v === 'submitted' || v === 'under_review') return 'Under review';
  if (v === 'rejected' || v === 'failed') return 'Rejected — please resubmit';
  if (v === 'approved' || v === 'verified') return 'Approved';
  return v;
}

// Fetch the current user's KYC status from /profile. Returns the raw string
// (lowercased) — caller can pass it through isKycApproved(). Returns 'none' if
// the request fails so the gate stays closed (fail-safe).
export async function fetchKycStatus() {
  try {
    const res = await authedFetch('/profile');
    if (!res.ok) return 'none';
    const data = await res.json().catch(() => ({}));
    return String(data?.kyc_status || 'none').toLowerCase();
  } catch (_) {
    return 'none';
  }
}

// Show the standard KYC-required dialog with a "Complete KYC" CTA that
// navigates to the Kyc screen. Use this anywhere you would otherwise let the
// user open a live trading account.
export function showKycGate(navigation, status) {
  const label = kycStatusLabel(status);
  const message =
    `Live trading accounts are only available after your identity verification is approved.\n\n` +
    `Current KYC status: ${label}.\n\n` +
    `Complete your KYC documents and wait for review to continue.`;
  Alert.alert(
    'Complete KYC to open a live account',
    message,
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Complete KYC', onPress: () => navigation?.navigate?.('Kyc') },
    ],
  );
}

// Convenience: fetch status, gate if not approved, otherwise call onApproved.
export async function gateOpenLiveAccount(navigation, onApproved) {
  const status = await fetchKycStatus();
  if (!isKycApproved(status)) {
    showKycGate(navigation, status);
    return false;
  }
  await onApproved?.();
  return true;
}
