'use client';

/**
 * Wallet sign-in / link orchestration. Runs inside <Web3Provider> so the
 * wagmi + RainbowKit hooks are available.
 *
 * Steps (login variant):
 *   1. Click → if not connected, open RainbowKit modal. The button no-ops
 *      after open; user clicks again once their wallet is selected.
 *   2. Verify chain is one we support; toast and stop otherwise.
 *   3. POST /auth/wallet/nonce { address, chain_id } → server returns
 *      nonce + canonical SIWE statement + domain + issued/expires timestamps.
 *   4. Build the SIWE message client-side from those exact server fields.
 *   5. wagmi `useSignMessage` → wallet pops up; user signs.
 *   6. POST /auth/wallet/verify { message, signature } → server consumes
 *      nonce atomically, recovers the signer, finds-or-creates the user,
 *      and drops the same HttpOnly cookies as email/Google sign-in.
 *   7. Refetch /auth/me, push /accounts.
 *
 * Link variant: identical flow except step 3 hits /profile/wallet/link/nonce
 * (binds the nonce to the authenticated user) and step 6 hits
 * /profile/wallet/link.
 */
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAccount, useChainId, useSignMessage } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { SiweMessage } from 'siwe';

import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import { NETWORK_TO_CHAIN } from '@/lib/web3/config';

const SUPPORTED_CHAIN_IDS = new Set(
  Object.values(NETWORK_TO_CHAIN).map((c) => c.id),
);

type Props = {
  variant?: 'login' | 'link';
  disabled?: boolean;
};

export default function ConnectWalletFlow({ variant = 'login', disabled }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const { walletNonce, walletLogin, refreshUser } = useAuthStore();
  const [busy, setBusy] = useState(false);

  const labelIdle =
    variant === 'link' ? 'Link your wallet' : 'Sign in with wallet';
  const labelBusy =
    variant === 'link' ? 'Linking…' : 'Signing in…';

  const handleClick = async () => {
    if (busy || disabled) return;

    // Step 1: not connected → open the picker. The button re-fires once
    // the user comes back having selected a wallet.
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }

    // Step 2: chain check — must be one of the supported EVM chains.
    if (!chainId || !SUPPORTED_CHAIN_IDS.has(chainId)) {
      toast.error(
        'Switch your wallet to Ethereum, BSC, Polygon, or Arbitrum to sign in.',
      );
      return;
    }

    setBusy(true);
    try {
      // Step 3: ask server for a nonce.
      const nonceRes = await walletNonce(address, chainId, variant);

      // Step 4: build the SIWE message using exactly what the server
      // told us — domain, statement, nonce, timestamps. The wallet
      // displays this verbatim before signing.
      // SIWE `domain` MUST match the page's host (window.location.host) —
      // wallets compare the two and warn the user about phishing if they
      // diverge. We can't trust `nonceRes.domain` because the request may
      // arrive at the gateway through an internal proxy hop (Next.js →
      // gateway:8000) where the Host header is the docker service name
      // rather than the public hostname. The backend still validates the
      // submitted domain against the CORS allow-list on /verify, so the
      // client can't smuggle a foreign host past the server.
      const siweMsg = new SiweMessage({
        domain: window.location.host,
        address: address,
        statement: nonceRes.statement,
        uri: window.location.origin,
        version: '1',
        chainId: chainId,
        nonce: nonceRes.nonce,
        issuedAt: nonceRes.issued_at,
        expirationTime: nonceRes.expires_at,
      }).prepareMessage();

      // Step 5: ask the wallet to sign.
      const signature = await signMessageAsync({ message: siweMsg });

      // Step 6: verify on the server → drops cookies → fetch /auth/me.
      if (variant === 'link') {
        await api.post('/profile/wallet/link', {
          message: siweMsg,
          signature,
        });
        await refreshUser();
        toast.success('Wallet linked to your account');
      } else {
        const ref = searchParams.get('ref') || undefined;
        await walletLogin(siweMsg, signature, ref);
        toast.success('Signed in with wallet');
        router.push('/accounts');
      }
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const detail = err?.detail || err?.response?.data?.detail || err?.message || '';
      const lower = String(detail).toLowerCase();

      // User-rejected signature surfaces from wagmi as a viem error with
      // a few overlapping codes / messages depending on the wallet.
      const userRejected =
        err?.name === 'UserRejectedRequestError' ||
        err?.code === 4001 ||
        lower.includes('rejected') ||
        lower.includes('user denied') ||
        lower.includes('user cancelled');

      if (userRejected) {
        toast.error('Signature cancelled in wallet.');
      } else if (status === 401 && lower.includes('expired')) {
        toast.error('Wallet sign-in expired. Please try again.');
      } else if (status === 401 && lower.includes('signature')) {
        toast.error('Signature did not match the connected wallet.');
      } else if (status === 409) {
        toast.error('This wallet is already linked to another FXArtha account.');
      } else if (status === 404 && variant === 'login') {
        // Shouldn't happen for login variant (auto-creates), but defensive.
        toast.error(detail || 'No account found for this wallet.');
      } else if (status === 503) {
        toast.error('Wallet sign-in is not available right now.');
      } else {
        toast.error(detail || 'Wallet sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="auth-btn auth-btn--outline"
      onClick={handleClick}
      disabled={busy || disabled}
      aria-busy={busy}
      style={{ width: '100%' }}
    >
      {busy ? (
        <>
          <Loader2 size={16} className="auth-spinner" />
          <span>{labelBusy}</span>
        </>
      ) : (
        <>
          <Wallet size={16} />
          <span>{isConnected ? labelIdle : 'Connect wallet'}</span>
        </>
      )}
    </button>
  );
}
