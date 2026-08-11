import { Alert } from 'react-native';
import { authedFetch } from '../services/api/authedFetch';

// Mirrors the web trader app: everything (registering, depositing, trading,
// opening live accounts) works without KYC. Identity is verified at
// WITHDRAWAL time only — the backend 403s with detail "KYC_REQUIRED" when a
// withdrawal is requested by an unverified user, and the withdraw screens
// show the gate dialog below.

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

// Withdrawal-time KYC dialog. Shown when a withdrawal request comes back
// with the backend's 403 "KYC_REQUIRED". The Kyc screen lives in the
// HomeTab stack, so navigate cross-tab from the Funds screens.
export function showWithdrawKycGate(navigation) {
  Alert.alert(
    'Complete KYC to withdraw',
    'Deposits and trading work without verification, but withdrawals require ' +
      'approved KYC. Complete your identity verification and your withdrawal ' +
      'will go through once it is approved.',
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Complete KYC',
        onPress: () => navigation?.navigate?.('HomeTab', { screen: 'Kyc' }),
      },
    ],
  );
}
