'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { formatCurrency } from '@/lib/formatters';
import { useAuthStore } from '@/stores/authStore';
import api, { getApiBase } from '@/lib/api/client';
// Automated deposits go through Razorpay Checkout (cards / UPI / netbanking).
// The user enters a USD amount; the backend converts USD→INR at the live
// mid-market rate, creates a Razorpay order, and we open the Razorpay
// Checkout popup (checkout.js). On success the handler posts the signature
// to /wallet/deposit/razorpay/verify which credits the USD amount.
import {
  Wallet as WalletIcon,
  CreditCard,
  ArrowUpFromLine,
  ArrowLeftRight,
  History as HistoryIcon,
  ChevronDown,
  RefreshCcw,
  CheckCircle2,
  Hourglass,
  FileText,
} from 'lucide-react';
import { downloadWalletStatementPdf } from '@/lib/pdf/walletStatementPdf';
import Pagination, { usePagination } from '@/components/ui/Pagination';

// Razorpay popup integration removed — local-banking flow replaces it.
// Admin can still attach Razorpay payment-links per request from the
// admin panel; those open in a new tab when the user clicks them, no
// in-app SDK / checkout.js needed.

interface AccountItem {
  id: string;
  account_number?: string;
  currency?: string;
  is_demo?: boolean;
  is_active?: boolean;
  is_wallet_account?: boolean;
  balance?: number;
  account_group?: {
    id?: string;
    name?: string;
    minimum_deposit?: number;
  } | null;
}

interface LiveAccountRow {
  id: string;
  account_number: string;
  balance: number;
  credit?: number;
  margin_used?: number;
  currency?: string;
  free_margin?: number;
  is_wallet_account?: boolean;
  account_group?: {
    id?: string;
    name?: string;
    minimum_deposit?: number;
  } | null;
}

interface WalletData {
  balance: number;
  currency: string;
  main_wallet_balance: number;
  bonus_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  pending_withdrawals: number;
  total_live_balance?: number;
  /** When the user has migrated to the wallet-bound model, the
   *  primary spendable balance lives on this trading account instead
   *  of main_wallet_balance. */
  wallet_account?: {
    id: string;
    account_number: string;
    balance: number;
  } | null;
}

interface WalletSummaryResponse {
  balance?: number;
  credit?: number;
  equity?: number;
  main_wallet_balance?: number;
  total_deposited?: number;
  total_withdrawn?: number;
  total_live_balance?: number;
  live_accounts?: LiveAccountRow[];
}

interface WalletListItem {
  id: string;
  created_at: string | null;
  type: string;
  method: string;
  amount: number;
  status: string;
  currency: string;
  // Populated by the backend for `local_banking` deposits once the admin
  // attaches a payment URL. Null while the request is still waiting for
  // admin review. When admin used the Razorpay-auto path this looks like
  // "razorpay:<order_id>" and the UI opens a Razorpay popup instead of an
  // external URL.
  payment_link?: string | null;
  // transaction_id holds the Razorpay order_id for auto-approved LB
  // deposits — the trader needs it to launch the Razorpay Checkout popup.
  transaction_id?: string | null;
}

/** Raw DB method code → friendly label. Covers both manual (bank / UPI /
 *  QR) and crypto (BTC / ETH / USDT / NOWPayments / OxaPay / wallet)
 *  channels so the history row reads clearly. */
function prettyMethod(method?: string): string {
  const m = (method || '').toLowerCase();
  switch (m) {
    case 'bank_transfer':
    case 'bank':
    case 'card':
      return 'Bank Transfer';
    case 'upi':
      return 'UPI';
    case 'qr':
      return 'QR Code';
    case 'manual':
      return 'Manual';
    case 'crypto_btc':
      return 'Crypto (BTC)';
    case 'crypto_eth':
      return 'Crypto (ETH)';
    case 'crypto_usdt':
      return 'Crypto (USDT)';
    case 'metamask':
      return 'Crypto (Wallet)';
    case 'razorpay':
      return 'Card / UPI';
    case 'nowpayments':
    case 'oxapay':
    case 'crypto':
      return 'Crypto';
    default:
      return m ? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';
  }
}

function fmtHistoryDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const DEMO_FUNDING_MSG =
  'Demo accounts cannot deposit, withdraw, or transfer funds. Open a live account to use wallet funding.';

// Networks the on-chain USDT payout supports (admin signs the transfer
// manually). Must mirror `ALLOWED_NETWORKS` in onchain_withdraw_service.py.
const WITHDRAW_NETWORK_OPTIONS = [
  {
    network: 'tron' as const,
    label: 'USDT TRC20',
    sub: 'Tron network',
    addressHint: 'Address starts with T (e.g. TXYZ…)',
    addressRegex: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  },
  {
    network: 'bsc' as const,
    label: 'USDT BEP20',
    sub: 'BNB Smart Chain',
    addressHint: 'EVM address — 0x followed by 40 hex characters',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    network: 'eth' as const,
    label: 'USDT ERC20',
    sub: 'Ethereum',
    addressHint: 'EVM address — 0x followed by 40 hex characters',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
  },
];

// 'crypto' = automated provider flow (Razorpay Checkout for deposits;
// on-chain USDT payout details for withdrawals). 'manual' = legacy bank/UPI
// manual path. (The deposit chip is labelled "Card / UPI" since Razorpay
// covers cards, UPI and netbanking.)
type FundingChannel = 'crypto' | 'manual';

interface ManualBankDetailsResponse {
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  qr_code_url?: string;
  /** Optional crypto wallet address admin attached on the same Banks row.
   *  Trader renders it as a copyable address + auto-generated QR. */
  wallet_address?: string;
}

type FundsTab = 'deposit' | 'withdrawal' | 'transfer' | 'history';

/** Synthetic id used inside the transfer source/destination pickers to
 *  represent the user's main wallet bucket (which is not an account row). */
const MAIN_WALLET_OPTION_ID = '__MAIN_WALLET__';

function WalletPageContent() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  // Wallet-integration purged: the SIWE link flow that populated this
  // field is gone, so `user.wallet_address` is always undefined now.
  const linkedWalletAddress = useAuthStore((s) => s.user?.wallet_address || '');
  // Prefill the Razorpay Checkout email field.
  const userEmail = useAuthStore((s) => s.user?.email || '');
  const userFullName = useAuthStore((s) => [s.user?.first_name, s.user?.last_name].filter(Boolean).join(' '));
  // KYC status — used for the inline notice in the withdraw panel. The
  // authoritative check happens server-side when a withdrawal is created
  // (403 KYC_REQUIRED); deposits and trading run without KYC.
  const kycStatus = useAuthStore((s) => (s.user?.kyc_status || '').toLowerCase());
  const kycApproved = kycStatus === 'approved' || kycStatus === 'verified';
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountFromUrl = searchParams.get('account');
  const withdrawDeepLinkHandled = useRef(false);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [liveAccounts, setLiveAccounts] = useState<LiveAccountRow[]>([]);
  /** True when user has accounts but none are live (all demo). */
  const [demoFundingBlocked, setDemoFundingBlocked] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGen = useRef(0);

  /** Top-level Vantage-style tab bar. */
  const [tab, setTab] = useState<FundsTab>('deposit');

  // Internal "fund target" preference — kept for backwards-compat with the
  // submit handlers (they branch on this for wallet-bound users).
  const [fundTargetPreference, setFundTargetPreference] = useState<'main' | 'wallet'>('main');

  // Channel chips ("Crypto" / "Bank/UPI") sit just below the voucher on
  // the Deposit and Withdrawal forms — kept inline (instead of moved into a
  // follow-up modal) so we don't have to surgically rewrite the submit
  // handlers' channel branching.
  // Deposit channels:
  //   - 'crypto'        = admin-set QR / wallet info shown, user pays externally
  //                       and uploads proof (the legacy manual flow's UI).
  //   - 'local_banking' = NEW: user submits a request, admin reviews KYC and
  //                       sends a payment link out of band. No upfront proof,
  //                       no upfront link — admin pushes it later.
  // The Razorpay-checkout popup that previously sat on 'crypto' is gone;
  // admin can still generate per-user Razorpay payment links and attach them
  // through the local-banking flow.
  const [depositUiSection, setDepositUiSection] = useState<'crypto' | 'local_banking'>('crypto');
  const [withdrawUiSection, setWithdrawUiSection] = useState<'crypto' | 'bank'>('crypto');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAccountId, setDepositAccountId] = useState<string | null>(null);
  const [depositTxId, setDepositTxId] = useState('');
  const [depositProofFile, setDepositProofFile] = useState<File | null>(null);
  const [cryptoGatewayBusy, setCryptoGatewayBusy] = useState(false);
  // Per-deposit amount inputs for the "Razorpay awaiting" row — keyed
  // by deposit id so multiple pending approvals don't overwrite each
  // other while the user is filling them in.
  const [rzpPayAmountByDeposit, setRzpPayAmountByDeposit] = useState<Record<string, string>>({});
  const [rzpCreatingForId, setRzpCreatingForId] = useState<string | null>(null);

  /** Open the OxaPay hosted crypto checkout for the entered amount. The
   *  backend creates a Deposit row + an OxaPay payment and returns the
   *  hosted payment_url; we redirect the user there. OxaPay's webhook
   *  flips the deposit to "approved" on payment confirmation. */
  const openCryptoGatewayCheckout = async () => {
    const amt = parseFloat(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a deposit amount first');
      return;
    }
    setCryptoGatewayBusy(true);
    try {
      const res = await api.post<{ payment_url?: string; id?: string }>(
        '/wallet/deposit',
        {
          amount: amt,
          method: 'oxapay',
          account_id: depositAccountId === MAIN_WALLET_OPTION_ID ? undefined : depositAccountId,
        },
      );
      if (res?.payment_url) {
        window.open(res.payment_url, '_blank', 'noopener');
        toast.success('Gateway opened — complete the payment in the new tab');
      } else {
        toast.error('Gateway did not return a payment link');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not open the gateway');
    } finally {
      setCryptoGatewayBusy(false);
    }
  };
  const [manualBankInfo, setManualBankInfo] = useState<ManualBankDetailsResponse | null>(null);
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  const [withdrawChannel, setWithdrawChannel] = useState<FundingChannel>('crypto');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccountId, setWithdrawAccountId] = useState<string | null>(null);
  const [withdrawNetwork, setWithdrawNetwork] = useState<'tron' | 'bsc' | 'eth'>('tron');
  const [withdrawCryptoAddress, setWithdrawCryptoAddress] = useState('');
  const [manualWithdrawUpi, setManualWithdrawUpi] = useState('');
  const [manualWithdrawNotes, setManualWithdrawNotes] = useState('');
  const [manualWithdrawQrFile, setManualWithdrawQrFile] = useState<File | null>(null);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // Transfer-between-accounts form (replaces the old card-level "balanceTransfer"
  // modal). Source / destination can be the synthetic main wallet (id =
  // MAIN_WALLET_OPTION_ID) or a real trading-account id.
  const [transferSourceId, setTransferSourceId] = useState<string>('');
  const [transferDestinationId, setTransferDestinationId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Local-banking pending requests shown inline on the Deposit tab — gives
  // the user a place to find the admin-issued payment link once it's been
  // attached. Refreshed on tab change + after submitting a new request.
  const [localBankingRequests, setLocalBankingRequests] = useState<WalletListItem[]>([]);
  // "I've Paid" inline confirmation: which request's form is open, and the
  // form fields. Kept local so multiple requests can have their own state
  // without an awkward outer modal.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmTxId, setConfirmTxId] = useState('');
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // History tab — recent ledger items rendered as a compact table.
  const [historyItems, setHistoryItems] = useState<WalletListItem[]>([]);
  const historyPager = usePagination(historyItems, 10);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      const id = ++loadGen.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);

      try {
        const [summaryRes, wdRes, accountsRes] = await Promise.allSettled([
          api.get<WalletSummaryResponse>('/wallet/summary'),
          api.get<{ items?: WalletListItem[] }>('/wallet/withdrawals'),
          api.get<{ items?: AccountItem[] }>('/accounts'),
        ]);

        if (id !== loadGen.current) return;

        let currency = 'USD';
        let balance = 0;
        let mainWalletBalance = 0;
        let bonusBalance = 0;
        let totalDeposited = 0;
        let totalWithdrawn = 0;
        let totalLiveBalance: number | undefined;

        if (summaryRes.status === 'fulfilled' && summaryRes.value) {
          const s = summaryRes.value as WalletSummaryResponse & { bonus_balance?: number };
          const live = s.live_accounts || [];
          setLiveAccounts(live);
          mainWalletBalance = Number(s.main_wallet_balance) || 0;
          bonusBalance = Number(s.bonus_balance) || 0;
          totalDeposited = Number(s.total_deposited) || 0;
          totalWithdrawn = Number(s.total_withdrawn) || 0;
          totalLiveBalance =
            typeof s.total_live_balance === 'number' ? s.total_live_balance : undefined;

          let targetId = selectedAccountId;
          if (!targetId || !live.some((a) => a.id === targetId)) {
            targetId =
              accountFromUrl && live.some((a) => a.id === accountFromUrl)
                ? accountFromUrl
                : live[0]?.id ?? null;
          }
          setSelectedAccountId(targetId);

          const sel = live.find((a) => a.id === targetId);
          balance = sel ? Number(sel.balance) || 0 : Number(s.balance) || 0;
          if (sel?.currency) currency = sel.currency;
        } else if (accountsRes.status === 'fulfilled') {
          const items = accountsRes.value?.items || [];
          const live = items.find((a) => a.is_demo === false) || items[0];
          if (live && typeof live.balance === 'number') balance = live.balance;
          if (summaryRes.status === 'rejected') {
            setLoadError('Wallet summary unavailable — balance from account only.');
            toast.error('Could not load wallet summary (totals may be incomplete).');
          }
        } else {
          const msg =
            summaryRes.status === 'rejected' && summaryRes.reason instanceof Error
              ? summaryRes.reason.message
              : 'Failed to load wallet';
          setLoadError(msg);
          toast.error(msg);
        }

        const wdItems =
          wdRes.status === 'fulfilled' ? wdRes.value?.items || [] : [];

        setDemoFundingBlocked(false);

        if (wdRes.status === 'rejected') {
          toast.error('Could not load pending withdrawal count.');
        }

        const pendingWd = wdItems.filter(
          (w) => (w.status || '').toLowerCase() === 'pending',
        ).length;

        const accountItems =
          accountsRes.status === 'fulfilled' ? accountsRes.value?.items || [] : [];
        const walletAcc = accountItems.find(
          (a) => Boolean(a.is_wallet_account) && a.is_active !== false,
        );
        const walletAccount = walletAcc
          ? {
              id: walletAcc.id,
              account_number: walletAcc.account_number || '',
              balance: Number(walletAcc.balance) || 0,
            }
          : null;

        setWallet({
          balance,
          currency,
          main_wallet_balance: mainWalletBalance,
          bonus_balance: bonusBalance,
          total_deposited: totalDeposited,
          total_withdrawn: totalWithdrawn,
          pending_withdrawals: pendingWd,
          total_live_balance: totalLiveBalance,
          wallet_account: walletAccount,
        });
      } catch (err) {
        if (id !== loadGen.current) return;
        const message = err instanceof Error ? err.message : 'Failed to load wallet';
        setLoadError(message);
        toast.error(message);
        setDemoFundingBlocked(false);
        setWallet({
          balance: 0,
          currency: 'USD',
          main_wallet_balance: 0,
          bonus_balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          pending_withdrawals: 0,
        });
      } finally {
        if (id === loadGen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedAccountId, accountFromUrl],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fmt = useCallback(
    (n: number) => formatCurrency(n, wallet?.currency || 'USD'),
    [wallet?.currency],
  );

  // Withdraw still uses the legacy `crypto / manual` FundingChannel; deposit
  // branches directly on depositUiSection now (no more depositChannel).

  useEffect(() => {
    setWithdrawChannel(withdrawUiSection === 'crypto' ? 'crypto' : 'manual');
  }, [withdrawUiSection]);

  // Default the deposit / withdrawal account picker to the first live row
  // (or the wallet-bound account if migrated) once accounts are loaded.
  useEffect(() => {
    // Non-migrated users always fund via the main wallet — default both
    // pickers to it (works even when they have no live trading account yet).
    if (!wallet?.wallet_account) {
      setDepositAccountId(MAIN_WALLET_OPTION_ID);
      setWithdrawAccountId(MAIN_WALLET_OPTION_ID);
      return;
    }
    if (liveAccounts.length === 0) return;
    const defaultId = wallet.wallet_account.id ?? liveAccounts[0]?.id ?? null;
    setDepositAccountId((cur) => cur && liveAccounts.some((a) => a.id === cur) ? cur : defaultId);
    setWithdrawAccountId((cur) => cur && liveAccounts.some((a) => a.id === cur) ? cur : defaultId);
  }, [liveAccounts, wallet?.wallet_account?.id]);

  // Default transfer pickers: source = main wallet (or wallet account if
  // migrated), destination = first non-source trading account.
  useEffect(() => {
    if (liveAccounts.length === 0) return;
    setTransferSourceId((cur) => {
      if (cur) return cur;
      return wallet?.wallet_account?.id ?? MAIN_WALLET_OPTION_ID;
    });
    setTransferDestinationId((cur) => {
      if (cur) return cur;
      // Deep-link from a trading account's Deposit/Transfer button
      // (?tab=transfer&account=X): preselect that account as the destination
      // so the user lands on main wallet → X and only has to type an amount.
      if (accountFromUrl && liveAccounts.some((a) => a.id === accountFromUrl)) {
        return accountFromUrl;
      }
      const first = liveAccounts.find((a) => a.id !== wallet?.wallet_account?.id);
      return first?.id ?? '';
    });
  }, [liveAccounts, wallet?.wallet_account?.id, accountFromUrl]);

  // Sync fundTargetPreference from the picked deposit/withdraw account so
  // the legacy submit handlers continue to tag the request correctly.
  useEffect(() => {
    if (!wallet?.wallet_account) return;
    if (tab === 'deposit') {
      setFundTargetPreference(depositAccountId === wallet.wallet_account.id ? 'wallet' : 'main');
    } else if (tab === 'withdrawal') {
      setFundTargetPreference(withdrawAccountId === wallet.wallet_account.id ? 'wallet' : 'main');
    }
  }, [tab, depositAccountId, withdrawAccountId, wallet?.wallet_account]);

  const loadManualBankDetails = useCallback(async () => {
    try {
      const amt = parseFloat(depositAmount);
      const body =
        !Number.isNaN(amt) && amt > 0 ? { amount: amt } : {};
      const d = await api.post<ManualBankDetailsResponse>('/wallet/deposit/bank-details', body);
      setManualBankInfo(d && Object.keys(d).length > 0 ? d : null);
    } catch {
      setManualBankInfo(null);
    }
  }, [depositAmount]);

  // Preload admin's deposit QR / bank details whenever the user lands on
  // the Crypto chip — that's where we render them (the legacy manual flow
  // populated the same fields).
  useEffect(() => {
    if (tab !== 'deposit' || depositUiSection !== 'crypto') return;
    void loadManualBankDetails();
  }, [tab, depositUiSection, loadManualBankDetails]);

  // Pull recent deposits and pick out the local-banking ones so they can
  // surface inline on the Local Banking chip. Stays cheap — the deposits
  // list is small and already used by /history.
  /** Create the Razorpay order for a "razorpay:awaiting" deposit then
   *  open the checkout popup. Two-step because the order is created
   *  lazily with the user's chosen amount. */
  const openRazorpayForAwaitingDeposit = useCallback(async (deposit: WalletListItem) => {
    const raw = rzpPayAmountByDeposit[deposit.id] || '';
    const amt = parseFloat(raw);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setRzpCreatingForId(deposit.id);
    let order: { order_id: string; key_id: string; amount_inr: number } | null = null;
    try {
      order = await api.post<{ order_id: string; key_id: string; amount_inr: number }>(
        `/wallet/deposit/${deposit.id}/razorpay-order`,
        { amount: amt },
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not create Razorpay order');
      setRzpCreatingForId(null);
      return;
    }

    const SCRIPT_ID = 'razorpay-checkout';
    const ensureSdk = () =>
      new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') return reject(new Error('no window'));
        const w = window as unknown as { Razorpay?: unknown };
        if (w.Razorpay) return resolve();
        const existing = document.getElementById(SCRIPT_ID);
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
          return;
        }
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Razorpay'));
        document.body.appendChild(s);
      });
    try {
      await ensureSdk();
    } catch {
      toast.error('Could not load Razorpay');
      setRzpCreatingForId(null);
      return;
    }

    type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };
    const w = window as unknown as { Razorpay: RazorpayCtor };
    const rzp = new w.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: Math.round(order.amount_inr * 100),
      currency: 'INR',
      name: 'SwissCresta',
      description: `Deposit ${deposit.id.slice(0, 8)}`,
      theme: { color: '#E94E1B' },
      handler: async (resp: Record<string, string>) => {
        try {
          await api.post('/wallet/deposit/razorpay/verify', {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          toast.success('Payment received — wallet credited');
          void loadLocalBankingRequests();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Verification failed');
        }
      },
    });
    rzp.open();
    setRzpCreatingForId(null);
  }, [rzpPayAmountByDeposit]);

  /** Open the Razorpay Checkout popup for an approved local-banking
   *  deposit. The order is already created server-side (deposit's
   *  transaction_id holds the order_id, payment_link holds the sentinel),
   *  so we only need to fetch the publishable key + locked amount and
   *  launch checkout.js. On success we re-poll the deposits list — the
   *  webhook will flip the row to "approved" once Razorpay confirms. */
  const openRazorpayCheckout = useCallback(async (deposit: WalletListItem) => {
    const orderId = deposit.transaction_id;
    if (!orderId) {
      toast.error('No Razorpay order on this deposit yet');
      return;
    }
    // Fetch the publishable key + INR amount for THIS order so we don't
    // hardcode the conversion math on the client.
    let keyId: string | undefined;
    let amountInr: number | undefined;
    try {
      const meta = await api.get<{ key_id?: string; amount_inr?: number; currency?: string }>(
        `/wallet/deposit/razorpay/${orderId}/meta`,
      );
      keyId = meta?.key_id;
      amountInr = meta?.amount_inr;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load payment details');
      return;
    }
    if (!keyId) {
      toast.error('Razorpay is not configured');
      return;
    }

    // Lazy-load the Checkout SDK exactly once.
    const SCRIPT_ID = 'razorpay-checkout';
    const ensureSdk = () =>
      new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') return reject(new Error('no window'));
        const w = window as unknown as { Razorpay?: unknown };
        if (w.Razorpay) return resolve();
        if (document.getElementById(SCRIPT_ID)) {
          document.getElementById(SCRIPT_ID)!.addEventListener('load', () => resolve());
          document.getElementById(SCRIPT_ID)!.addEventListener('error', () =>
            reject(new Error('Failed to load Razorpay')),
          );
          return;
        }
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Razorpay'));
        document.body.appendChild(s);
      });

    try {
      await ensureSdk();
    } catch {
      toast.error('Could not load Razorpay');
      return;
    }

    type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };
    const w = window as unknown as { Razorpay: RazorpayCtor };

    const rzp = new w.Razorpay({
      key: keyId,
      order_id: orderId,
      amount: amountInr ? Math.round(amountInr * 100) : undefined,
      currency: 'INR',
      name: 'SwissCresta',
      description: `Deposit ${deposit.id.slice(0, 8)}`,
      prefill: {},
      theme: { color: '#E94E1B' },
      handler: async (resp: Record<string, string>) => {
        // Verify the signature server-side so the row credits via the
        // same locked path the webhook uses. Webhook will also catch
        // this independently — double-credit is prevented by the
        // (payment_id, "captured") dedup row in webhook_events.
        try {
          await api.post('/wallet/deposit/razorpay/verify', {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          toast.success('Payment received — wallet credited');
          void loadLocalBankingRequests();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Verification failed');
        }
      },
      modal: {
        ondismiss: () => {
          // No-op — user can re-open the popup from the same row.
        },
      },
    });
    rzp.open();
  }, []);

  const loadLocalBankingRequests = useCallback(async () => {
    try {
      const res = await api.get<{ items?: WalletListItem[] }>('/wallet/deposits');
      const items = res?.items ?? [];
      // local_banking is the new method for the LB flow. When admin
      // chooses "Approve & Razorpay" the row gets flipped to method=
      // razorpay with a payment_link of "razorpay:<order_id>" — we
      // still want to surface those here so the user can find their
      // pending Razorpay payment in the same place.
      const local = items.filter((d) => {
        const m = (d.method || '').toLowerCase();
        if (m === 'local_banking') return true;
        return m === 'razorpay' && (d.payment_link || '').startsWith('razorpay:');
      });
      setLocalBankingRequests(local);
    } catch {
      setLocalBankingRequests([]);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'deposit' || depositUiSection !== 'local_banking') return;
    void loadLocalBankingRequests();
  }, [tab, depositUiSection, loadLocalBankingRequests]);

  /** Open withdraw via ?action=withdraw deep link. */
  useEffect(() => {
    if (loading || withdrawDeepLinkHandled.current) return;
    const act = searchParams.get('action');
    if (!act) return;
    if (act.toLowerCase() === 'withdraw') {
      if (demoFundingBlocked) {
        withdrawDeepLinkHandled.current = true;
        toast.error(DEMO_FUNDING_MSG);
        const next = new URLSearchParams(searchParams.toString());
        next.delete('action');
        const qs = next.toString();
        router.replace(qs ? `/wallet?${qs}` : '/wallet', { scroll: false });
        return;
      }
      withdrawDeepLinkHandled.current = true;
      setTab('withdrawal');
      setWithdrawUiSection('crypto');
      setWithdrawAmount('');
      setWithdrawCryptoAddress('');
      setManualWithdrawUpi('');
      setManualWithdrawNotes('');
      setManualWithdrawQrFile(null);
    } else if (act.toLowerCase() === 'deposit') {
      withdrawDeepLinkHandled.current = true;
      setTab('deposit');
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete('action');
    const qs = next.toString();
    router.replace(qs ? `/wallet?${qs}` : '/wallet', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when deep-linked
  }, [loading, searchParams, router, demoFundingBlocked]);

  /** Open a specific tab via ?tab=history|transfer|withdrawal|deposit.
   *  Used by the consolidated transaction history (/transactions now
   *  redirects here with ?tab=history) and the account-card "Transfer
   *  funds" action (?tab=transfer). */
  const tabDeepLinkHandled = useRef(false);
  useEffect(() => {
    if (tabDeepLinkHandled.current) return;
    const t = searchParams.get('tab');
    if (!t) return;
    const valid: FundsTab[] = ['deposit', 'withdrawal', 'transfer', 'history'];
    if ((valid as string[]).includes(t)) {
      tabDeepLinkHandled.current = true;
      setTab(t as FundsTab);
    }
  }, [searchParams]);

  // Lazy-load history items when the user lands on the History tab.
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [dep, wd, txn] = await Promise.allSettled([
        api.get<{ items?: WalletListItem[] }>('/wallet/deposits'),
        api.get<{ items?: WalletListItem[] }>('/wallet/withdrawals'),
        api.get<{ items?: (WalletListItem & { description?: string })[] }>('/wallet/transactions'),
      ]);
      const depItems = dep.status === 'fulfilled' ? dep.value?.items || [] : [];
      const wdItems = wd.status === 'fulfilled' ? wd.value?.items || [] : [];
      const txnItems = txn.status === 'fulfilled' ? txn.value?.items || [] : [];
      // Transaction History should only surface SETTLED activity. A
      // Razorpay popup that was opened and closed without paying, or
      // an LB request still awaiting admin review, are in-progress
      // states — they belong in the Deposit tab's "Your requests"
      // panel, not here.
      const SETTLED_STATUSES = new Set([
        'approved', 'auto_approved', 'completed', 'paid',
        'rejected', 'failed', 'cancelled',
      ]);
      const settledDeposits = depItems.filter((d) =>
        SETTLED_STATUSES.has(String(d.status || '').toLowerCase()),
      );
      const settledWithdrawals = wdItems.filter((w) =>
        SETTLED_STATUSES.has(String(w.status || '').toLowerCase()),
      );
      // Internal transfer legs (trading ↔ main wallet). Deposits/withdrawals
      // are already fetched above, so we pull only the 'transfer' rows here to
      // avoid double-listing. Each transfer surfaces both legs (out of one
      // bucket, into the other) with its own descriptive label.
      const transferItems: WalletListItem[] = txnItems
        .filter((t) => (t.type || '').toLowerCase() === 'transfer')
        .map((t) => ({ ...t, method: t.description || t.method }));
      const merged = [...settledDeposits, ...settledWithdrawals, ...transferItems].sort((a, b) => {
        const ad = a.created_at ? Date.parse(a.created_at) : 0;
        const bd = b.created_at ? Date.parse(b.created_at) : 0;
        return bd - ad;
      });
      setHistoryItems(merged);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'history') return;
    void loadHistory();
  }, [tab, loadHistory]);

  const submitWithdraw = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (withdrawChannel === 'crypto') {
      const opt = WITHDRAW_NETWORK_OPTIONS.find((o) => o.network === withdrawNetwork)
        ?? WITHDRAW_NETWORK_OPTIONS[0]!;
      const addr = withdrawCryptoAddress.trim();
      if (!addr) {
        toast.error('Enter your USDT wallet address');
        return;
      }
      if (!opt.addressRegex.test(addr)) {
        toast.error(`Invalid ${opt.label} address. ${opt.addressHint}`);
        return;
      }
      setWithdrawSubmitting(true);
      try {
        await api.post('/wallet/withdraw/onchain', {
          network: opt.network,
          amount: amt,
          destination_address: addr,
          source: wallet?.wallet_account ? fundTargetPreference : undefined,
        });
        toast.success(`Withdrawal of $${amt.toLocaleString()} submitted — pending approval`);
        setWithdrawCryptoAddress('');
        void fetchData(true);
      } catch (err) {
        // Withdrawal-time KYC check — the backend 403s with this exact
        // string when the user's identity isn't verified yet.
        if (err instanceof Error && err.message === 'KYC_REQUIRED') {
          toast.error('Complete KYC verification to withdraw funds.');
          router.push('/kyc');
        } else {
          toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
        }
      } finally {
        setWithdrawSubmitting(false);
      }
      return;
    }

    const upi = manualWithdrawUpi.trim();
    if (!upi && !manualWithdrawQrFile) {
      toast.error('Enter your UPI ID and/or upload a QR code for manual payout');
      return;
    }
    setWithdrawSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(amt));
      fd.append('upi_id', upi);
      fd.append('payout_notes', manualWithdrawNotes.trim());
      if (manualWithdrawQrFile) fd.append('file', manualWithdrawQrFile);
      if (wallet?.wallet_account) fd.append('source', fundTargetPreference);
      const token = api.getToken();
      // Multipart uploads bypass the api client (it sets a JSON
       // content-type) but we still need the absolute API base so the
       // request lands on the gateway (api.swisscresta.com) and not on
       // whichever marketing apex / trader subdomain the user is on.
      const res = await fetch(`${getApiBase()}/wallet/withdraw/manual`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        credentials: 'include',
      });
      const raw = await res.text();
      let json: { detail?: unknown; message?: string } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        const d = json.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : 'Withdrawal failed';
        throw new Error(msg);
      }
      toast.success(`Manual withdrawal of $${amt.toLocaleString()} submitted — pending approval`);
      void fetchData(true);
    } catch (err) {
      // Withdrawal-time KYC check — the backend 403s with this exact
      // string when the user's identity isn't verified yet.
      if (err instanceof Error && err.message === 'KYC_REQUIRED') {
        toast.error('Complete KYC verification to withdraw funds.');
        router.push('/kyc');
      } else {
        toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
      }
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const submitDeposit = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    // Crypto requires a real amount (user pays exactly that to admin's
    // QR). Local Banking is a permission request — admin sets the
    // final amount at approval time, so 0 is OK here.
    const amt = depositUiSection === 'local_banking'
      ? (parseFloat(depositAmount) || 0)
      : parseFloat(depositAmount);
    if (depositUiSection !== 'local_banking' && (!amt || amt <= 0)) {
      toast.error('Enter a valid amount');
      return;
    }
    // ── Crypto channel: user pays via admin's QR / wallet info shown
    //   in the panel, then uploads proof + reference. Existing manual
    //   deposit endpoint handles the row + admin review.
    if (depositUiSection === 'crypto') {
      // If admin hasn't configured any manual destination, the user has
      // no place to send funds outside the gateway — they should use
      // "Pay with crypto gateway" instead of hitting Continue.
      const hasManualDestination = !!(
        manualBankInfo &&
        (manualBankInfo.bank_name ||
          manualBankInfo.upi_id ||
          manualBankInfo.qr_code_url ||
          manualBankInfo.wallet_address)
      );
      if (!hasManualDestination) {
        toast.error('No manual payment destination configured — use "Pay with crypto gateway".');
        return;
      }
      if (!depositTxId.trim()) {
        toast.error('Enter your transaction reference / tx hash');
        return;
      }
      if (!depositProofFile) {
        toast.error('Upload a screenshot of your payment');
        return;
      }
      setDepositSubmitting(true);
      try {
        const fd = new FormData();
        fd.append('amount', String(amt));
        fd.append('transaction_id', depositTxId.trim());
        fd.append('file', depositProofFile);
        if (wallet?.wallet_account) fd.append('target', fundTargetPreference);
        const token = api.getToken();
        const res = await fetch(`${getApiBase()}/wallet/deposit/manual`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
          credentials: 'include',
        });
        const raw = await res.text();
        let json: { detail?: unknown; message?: string } = {};
        try {
          json = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`);
        }
        if (!res.ok) {
          const d = json.detail;
          const msg =
            typeof d === 'string'
              ? d
              : Array.isArray(d)
                ? d.map((x: { msg?: string }) => x.msg).join(', ')
                : 'Deposit failed';
          throw new Error(msg);
        }
        toast.success(`Deposit of $${amt.toLocaleString()} submitted — pending approval`);
        setDepositAmount('');
        setDepositTxId('');
        setDepositProofFile(null);
        void fetchData(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Deposit failed');
      } finally {
        setDepositSubmitting(false);
      }
      return;
    }

    // ── Local Banking channel: user just submits an amount. Admin
    //   pushes back a payment link out of band (via the
    //   /wallet/deposit/local-banking endpoint). No KYC gate — identity
    //   is verified at withdrawal time instead.
    setDepositSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(amt));
      const token = api.getToken();
      const res = await fetch(`${getApiBase()}/wallet/deposit/local-banking`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        credentials: 'include',
      });
      const raw = await res.text();
      let json: { detail?: unknown; message?: string } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        const d = json.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : 'Request failed';
        // Backend signals missing KYC as a special detail string so we can
        // route the user straight to the form instead of confusing copy.
        if (msg === 'KYC_REQUIRED') {
          toast.error('Complete KYC verification to continue.');
          router.push('/kyc');
          return;
        }
        throw new Error(msg);
      }
      toast.success(
        "Deposit request submitted. Our team will review your KYC and share payment details with you shortly.",
      );
      setDepositAmount('');
      void fetchData(true);
      void loadLocalBankingRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setDepositSubmitting(false);
    }
  };

  /**
   * "I've Paid" — the user has paid via the admin's payment link and is
   * uploading their proof so the admin can confirm and credit the wallet.
   */
  const submitLocalBankingProof = async (depositId: string) => {
    const amt = parseFloat(confirmAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter the amount you paid');
      return;
    }
    if (!confirmTxId.trim()) {
      toast.error('Enter the UTR / UPI reference of your payment');
      return;
    }
    if (!confirmFile) {
      toast.error('Upload a screenshot or PDF of your payment');
      return;
    }
    setConfirmSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(amt));
      fd.append('transaction_id', confirmTxId.trim());
      fd.append('file', confirmFile);
      const token = api.getToken();
      const res = await fetch(
        `${getApiBase()}/wallet/deposit/local-banking/${depositId}/confirm-payment`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
          credentials: 'include',
        },
      );
      const raw = await res.text();
      let json: { detail?: unknown } = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch { throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`); }
      if (!res.ok) {
        const d = json.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : 'Could not submit proof';
        throw new Error(msg);
      }
      toast.success("Proof submitted. We'll confirm and credit your wallet shortly.");
      setConfirmingId(null);
      setConfirmAmount('');
      setConfirmTxId('');
      setConfirmFile(null);
      void loadLocalBankingRequests();
      void fetchData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit proof');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  /**
   * Submit a transfer between two accounts. The backend only exposes
   * main↔trading transfers, so this resolves the picked source/destination
   * pair into one of those two endpoints. trading↔trading transfers aren't
   * supported on the backend yet — surfaced as an inline toast.
   */
  const submitTransfer = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    if (!transferSourceId || !transferDestinationId) {
      toast.error('Pick a source and destination account');
      return;
    }
    if (transferSourceId === transferDestinationId) {
      toast.error('Source and destination must be different');
      return;
    }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const srcIsMain = transferSourceId === MAIN_WALLET_OPTION_ID;
    const destIsMain = transferDestinationId === MAIN_WALLET_OPTION_ID;

    if (!srcIsMain && !destIsMain) {
      toast.error('Transfers between two trading accounts are not yet supported — route via main wallet.');
      return;
    }

    setTransferSubmitting(true);
    try {
      if (srcIsMain) {
        await api.post('/wallet/transfer-main-to-trading', {
          to_account_id: transferDestinationId,
          amount: amt,
        });
        const num = liveAccounts.find((a) => a.id === transferDestinationId)?.account_number ?? '';
        toast.success(`$${amt.toLocaleString()} sent to ${num || 'trading account'}`);
      } else {
        await api.post('/wallet/transfer-trading-to-main', {
          from_account_id: transferSourceId,
          amount: amt,
        });
        toast.success(`$${amt.toLocaleString()} moved to main wallet`);
      }
      setTransferAmount('');
      void fetchData(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Validation flags ------------------------------------------------------

  const depositAccount = useMemo(
    () => liveAccounts.find((a) => a.id === depositAccountId) ?? null,
    [liveAccounts, depositAccountId],
  );
  const depositMinDeposit = Number(depositAccount?.account_group?.minimum_deposit ?? 0);
  const depositAmountNumber = parseFloat(depositAmount);
  const depositAmountValid =
    !Number.isNaN(depositAmountNumber) &&
    depositAmountNumber > 0 &&
    (depositMinDeposit <= 0 || depositAmountNumber >= depositMinDeposit);
  const depositCanContinue =
    !demoFundingBlocked &&
    !depositSubmitting &&
    !!depositAccountId &&
    // Crypto needs amount; LB amount is optional (admin sets it later).
    (depositUiSection === 'local_banking' ? true : depositAmountValid);

  const withdrawAmountNumber = parseFloat(withdrawAmount);
  const withdrawAmountValid = !Number.isNaN(withdrawAmountNumber) && withdrawAmountNumber > 0;
  const withdrawAddrTrimmed = withdrawCryptoAddress.trim();
  const withdrawActiveNetwork =
    WITHDRAW_NETWORK_OPTIONS.find((o) => o.network === withdrawNetwork)
    ?? WITHDRAW_NETWORK_OPTIONS[0]!;
  const withdrawAddrValid =
    withdrawChannel !== 'crypto'
      ? true
      : withdrawAddrTrimmed.length > 0 && withdrawActiveNetwork.addressRegex.test(withdrawAddrTrimmed);
  const withdrawCanContinue =
    !demoFundingBlocked &&
    !withdrawSubmitting &&
    !!withdrawAccountId &&
    withdrawAmountValid &&
    withdrawAddrValid;

  const transferAmountNumber = parseFloat(transferAmount);
  const transferAmountValid = !Number.isNaN(transferAmountNumber) && transferAmountNumber > 0;
  const transferCanContinue =
    !demoFundingBlocked &&
    !transferSubmitting &&
    !!transferSourceId &&
    !!transferDestinationId &&
    transferSourceId !== transferDestinationId &&
    transferAmountValid;

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16">
          <div className="w-10 h-10 border-[3px] border-[#E94E1B] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-text-tertiary">Loading wallet…</span>
        </div>
      </DashboardShell>
    );
  }

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="Deposits & Withdrawals"
          description="Funding is only available on real trading accounts. Register a live account to deposit, withdraw and transfer funds."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  // ── Render -----------------------------------------------------------

  /** Top tab bar (underline style). */
  const renderTabBar = () => {
    const tabs: { id: FundsTab; label: string }[] = [
      { id: 'deposit', label: 'Deposit' },
      { id: 'withdrawal', label: 'Withdrawal' },
      { id: 'transfer', label: 'Transfer Between Accounts' },
      { id: 'history', label: 'Transaction History' },
    ];
    return (
      <div className="border-b border-border-primary">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={clsx(
                  'relative -mb-px py-3 text-sm transition-colors whitespace-nowrap',
                  active
                    ? 'font-bold text-text-primary'
                    : 'font-medium text-text-tertiary hover:text-text-primary',
                )}
              >
                {t.label}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#0A0A0A] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // -----------------------------------------------------------------
  // Tab bodies
  // -----------------------------------------------------------------

  // Non-migrated users fund through the main wallet: deposits land there and
  // withdrawals come from it; trading accounts are funded via the Transfer
  // tab. Migrated / wallet-bound users pick a real account row directly.
  const accountOptionsForFunding = wallet?.wallet_account
    ? liveAccounts.map((a) => ({
        id: a.id,
        label: `${a.account_group?.name || 'Standard'} · ${a.account_number || a.id.slice(0, 8)}`,
        sublabel: formatCurrency(Number(a.balance) || 0, a.currency || wallet?.currency || 'USD'),
      }))
    : [
        {
          id: MAIN_WALLET_OPTION_ID,
          label: 'Main Wallet',
          sublabel: formatCurrency(Number(wallet?.main_wallet_balance ?? 0), wallet?.currency || 'USD'),
        },
      ];

  const renderDepositTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      {/* LEFT — form */}
      <div className="lg:col-span-2 space-y-5">
        {/* Account */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Account</label>
          <FundsDropdown
            value={depositAccountId}
            options={accountOptionsForFunding}
            placeholder="Select an account"
            onChange={(id) => {
              setDepositAccountId(id);
              setDepositAmount('');
            }}
            disabled={accountOptionsForFunding.length === 0}
          />
        </div>

        {/* Amount — required for Crypto, optional for Local Banking. LB
            users submit a permission request; the admin sets the final
            Razorpay charge amount at approval time so the user can leave
            this blank or use it as a suggestion. */}
        {(depositUiSection === 'crypto' || depositUiSection === 'local_banking') && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Amount{depositUiSection === 'local_banking' ? ' (optional)' : ''}
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={depositMinDeposit > 0 ? depositMinDeposit : 0}
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Enter an amount"
              className={clsx(
                'w-full rounded-xl bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-shadow',
                'focus:ring-2 focus:ring-[#E94E1B]/40',
              )}
            />
            {depositAmount && !depositAmountValid && depositMinDeposit > 0 && (
              <p className="text-xs text-red-600">
                Minimum deposit for this account is {formatCurrency(depositMinDeposit, depositAccount?.currency || wallet?.currency || 'USD')}.
              </p>
            )}
            {depositMinDeposit > 0 && depositAmountValid && (
              <p className="text-xs text-text-tertiary">
                Minimum deposit: {formatCurrency(depositMinDeposit, depositAccount?.currency || wallet?.currency || 'USD')}
              </p>
            )}
          </div>
        )}

        {/* Payment method chips: Crypto (admin's QR shown, user pays + uploads
            proof) and Local Banking (request flow, admin sends back link). */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Payment method</label>
          <div className="flex gap-2">
            {(
              [
                { id: 'crypto' as const, label: 'Crypto', sub: '' },
                { id: 'local_banking' as const, label: 'Local Banking', sub: 'Request payment link' },
              ]
            ).map((c) => {
              const active = depositUiSection === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDepositUiSection(c.id)}
                  className={clsx(
                    'flex-1 rounded-xl border px-4 py-3 text-left transition-colors',
                    active
                      ? 'border-[#0A0A0A] bg-bg-card'
                      : 'border-transparent bg-bg-input hover:border-border-primary',
                  )}
                >
                  <div className="text-sm font-semibold text-text-primary">{c.label}</div>
                  {c.sub && <div className="text-xs text-text-tertiary mt-0.5">{c.sub}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel-specific extras ------------------------------ */}
        {depositUiSection === 'crypto' ? (
          <>
            {/* Admin's QR / wallet info — same source as the legacy manual
                flow used (per-tier bank/UPI/QR rows the admin maintains). */}
            {manualBankInfo && (
              manualBankInfo.bank_name ||
              manualBankInfo.upi_id ||
              manualBankInfo.qr_code_url ||
              manualBankInfo.wallet_address
            ) && (
              <div className="rounded-xl border border-border-primary bg-bg-card px-4 py-3.5 text-sm text-text-primary space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Pay to
                </div>
                {manualBankInfo.qr_code_url && (
                  <img
                    src={manualBankInfo.qr_code_url}
                    alt="Admin payment QR"
                    className="block w-40 h-40 object-contain rounded-lg border border-border-primary bg-bg-card"
                  />
                )}
                <div className="space-y-1 text-xs">
                  {manualBankInfo.bank_name && (
                    <div><span className="text-text-primary font-semibold">Bank:</span> {manualBankInfo.bank_name}</div>
                  )}
                  {manualBankInfo.account_holder && (
                    <div><span className="text-text-primary font-semibold">Holder:</span> {manualBankInfo.account_holder}</div>
                  )}
                  {manualBankInfo.account_number && (
                    <div><span className="text-text-primary font-semibold">A/C:</span> {manualBankInfo.account_number}</div>
                  )}
                  {manualBankInfo.ifsc_code && (
                    <div><span className="text-text-primary font-semibold">IFSC:</span> {manualBankInfo.ifsc_code}</div>
                  )}
                  {manualBankInfo.upi_id && (
                    <div><span className="text-text-primary font-semibold">UPI:</span> {manualBankInfo.upi_id}</div>
                  )}
                </div>
                {manualBankInfo.wallet_address && (
                  <div className="space-y-2 pt-2 border-t border-border-primary">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Crypto address
                    </div>
                    {(() => {
                      const addr = manualBankInfo.wallet_address!;
                      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(addr)}`;
                      return (
                        <div className="flex items-start gap-3 rounded-lg border border-border-primary p-2.5 bg-bg-card-nested">
                          <img
                            src={qrSrc}
                            alt="Wallet address QR"
                            className="block w-24 h-24 shrink-0 object-contain rounded bg-bg-card border border-border-primary"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="text-[11px] font-mono break-all leading-snug text-text-primary">{addr}</div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(addr);
                                toast.success('Address copied');
                              }}
                              className="text-[11px] font-semibold text-[#E94E1B] hover:underline"
                            >
                              Copy address
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    <p className="text-[10px] text-text-tertiary leading-snug">
                      Scan the QR or copy the address. After paying, paste your transaction hash below as proof.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Automated crypto checkout via the OxaPay gateway. Opens a
                hosted page where the user picks a coin/network, pays, and
                the OxaPay webhook auto-credits the deposit — no manual
                tx-hash entry required. */}
            <button
              type="button"
              onClick={() => void openCryptoGatewayCheckout()}
              disabled={cryptoGatewayBusy || !(parseFloat(depositAmount) > 0)}
              className="w-full rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold py-3 hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {cryptoGatewayBusy ? 'Opening gateway…' : 'Pay with crypto gateway →'}
            </button>

            {/* Manual proof submission — only show when admin has actually
                configured a bank/UPI/QR/wallet to pay TO. If nothing is
                configured the user has nowhere to send funds manually, so
                hide the tx-hash + proof fields rather than show empty
                inputs that lead to a stuck request. */}
            {manualBankInfo && (
              manualBankInfo.bank_name ||
              manualBankInfo.upi_id ||
              manualBankInfo.qr_code_url ||
              manualBankInfo.wallet_address
            ) && (
              <>
                <p className="text-[11px] text-text-tertiary leading-snug text-center">
                  Or pay manually to the address above and submit your transaction hash below.
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-primary">Transaction reference / tx hash</label>
                  <input
                    type="text"
                    value={depositTxId}
                    onChange={(e) => setDepositTxId(e.target.value)}
                    placeholder="On-chain tx hash, UTR, or transfer reference"
                    className="w-full rounded-xl bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-primary">Payment proof</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setDepositProofFile(e.target.files?.[0] ?? null)}
                    className="w-full rounded-xl bg-bg-input px-4 py-3 text-sm text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-crx-charcoal file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-crx-charcoal-ink"
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl bg-bg-input px-4 py-3.5 text-sm text-text-primary">
              <p className="leading-relaxed">
                Submit this request and our team will share a payment link (Razorpay, bank transfer, or UPI) with you shortly. Your wallet is credited the USD amount once payment is confirmed.
              </p>
            </div>

            {/* User's existing local-banking requests (admin queue / link). */}
            {localBankingRequests.length > 0 && (
              <div className="rounded-xl border border-border-primary bg-bg-card px-4 py-3.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                  Your requests
                </div>
                <ul className="space-y-2">
                  {localBankingRequests.slice(0, 5).map((r) => {
                    const status = (r.status || 'pending').toLowerCase();
                    const isApproved = status === 'approved' || status === 'auto_approved';
                    const isRejected = status === 'rejected' || status === 'failed';
                    const hasLink = !!r.payment_link;
                    const proofSubmitted = Number(r.amount || 0) > 0;
                    const isConfirming = confirmingId === r.id;
                    const stage = isApproved
                      ? 'Credited'
                      : isRejected
                        ? 'Rejected'
                        : proofSubmitted
                          ? 'Proof submitted — admin verifying'
                          : hasLink
                            ? 'Payment link ready'
                            : 'Awaiting admin review';
                    return (
                      <li
                        key={r.id}
                        className="rounded-lg bg-bg-input px-3 py-2 text-sm space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-text-primary tabular-nums">
                              {proofSubmitted
                                ? `$${Number(r.amount || 0).toLocaleString()}`
                                : 'Deposit request'}
                            </div>
                            <div className="text-[11px] text-text-tertiary">
                              {r.created_at ? new Date(r.created_at).toLocaleString() : ''} · {stage}
                            </div>
                          </div>
                          {hasLink && !isApproved && !isRejected && !proofSubmitted && (() => {
                            const pl = r.payment_link || '';
                            // Three states:
                            //   razorpay:awaiting → admin approved, user
                            //     enters amount and creates the order
                            //   razorpay:<order_id> → order already created
                            //     (legacy / repeat-open path) — open popup
                            //   anything else → external link admin shared
                            const isRzpAwaiting = pl === 'razorpay:awaiting';
                            const isRzpOrder = pl.startsWith('razorpay:') && !isRzpAwaiting;
                            if (isRzpAwaiting) {
                              return null; // handled by the inline amount form below
                            }
                            return (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isRzpOrder ? (
                                  <button
                                    type="button"
                                    onClick={() => void openRazorpayCheckout(r)}
                                    className="inline-flex items-center justify-center rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                                  >
                                    Pay with Razorpay
                                  </button>
                                ) : (
                                  <>
                                    <a
                                      href={r.payment_link as string}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                                    >
                                      Pay now
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmingId(isConfirming ? null : r.id);
                                        setConfirmAmount('');
                                        setConfirmTxId('');
                                        setConfirmFile(null);
                                      }}
                                      className="inline-flex items-center justify-center rounded-lg border border-[#0A0A0A] text-text-primary text-xs font-semibold px-3 py-1.5 hover:bg-[#0A0A0A] hover:text-white transition-colors"
                                    >
                                      {isConfirming ? 'Cancel' : "I've Paid"}
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Razorpay-awaiting form — admin approved, user enters
                            the amount and we create the Razorpay order on the
                            fly, then open the Checkout popup. */}
                        {r.payment_link === 'razorpay:awaiting' && !isApproved && !isRejected && (
                          <div className="space-y-2 rounded-lg bg-bg-card border border-border-primary p-3">
                            <p className="text-xs text-text-tertiary leading-snug">
                              Your request was approved. Enter how much you want to deposit and pay via Razorpay.
                            </p>
                            <div className="flex items-end gap-2">
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-text-primary">Amount (USD)</label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="1"
                                  value={rzpPayAmountByDeposit[r.id] || ''}
                                  onChange={(e) =>
                                    setRzpPayAmountByDeposit((prev) => ({ ...prev, [r.id]: e.target.value }))
                                  }
                                  placeholder="e.g. 100"
                                  className="w-full rounded-lg bg-bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => void openRazorpayForAwaitingDeposit(r)}
                                disabled={
                                  rzpCreatingForId === r.id ||
                                  !(parseFloat(rzpPayAmountByDeposit[r.id] || '0') > 0)
                                }
                                className="inline-flex items-center justify-center rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-semibold px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {rzpCreatingForId === r.id ? 'Opening…' : 'Pay with Razorpay'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline "I've Paid" form — collapses back when closed. */}
                        {isConfirming && (
                          <div className="space-y-2 rounded-lg bg-bg-card border border-border-primary p-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-text-primary">Amount paid (USD)</label>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={confirmAmount}
                                onChange={(e) => setConfirmAmount(e.target.value)}
                                placeholder="e.g. 100"
                                className="w-full rounded-lg bg-bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-text-primary">UTR / UPI reference</label>
                              <input
                                type="text"
                                value={confirmTxId}
                                onChange={(e) => setConfirmTxId(e.target.value)}
                                placeholder="Transaction reference from your bank / UPI app"
                                className="w-full rounded-lg bg-bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-text-primary">Payment proof (screenshot / PDF)</label>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => setConfirmFile(e.target.files?.[0] ?? null)}
                                className="w-full rounded-lg bg-bg-input px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-crx-charcoal file:px-3 file:py-1 file:text-xs file:font-semibold file:text-crx-charcoal-ink"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => void submitLocalBankingProof(r.id)}
                              disabled={confirmSubmitting}
                              className="w-full rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] disabled:opacity-60 text-white text-sm font-semibold py-2 transition-colors"
                            >
                              {confirmSubmitting ? 'Submitting…' : 'Submit proof'}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Continue */}
        <ContinueButton
          disabled={!depositCanContinue}
          busy={depositSubmitting}
          onClick={() => void submitDeposit()}
          label={depositUiSection === 'local_banking' ? 'Send Request' : 'Continue'}
        />
      </div>

      {/* RIGHT — stepper */}
      <Stepper
        steps={[
          {
            icon: <WalletIcon size={16} />,
            title: 'Deposit Funds',
            description:
              'Start by depositing the desired amount into your account to initiate the process.',
            state: 'current',
          },
          {
            icon: <CreditCard size={16} />,
            title: 'Select Deposit Method',
            description:
              'Choose the most convenient payment method from the available options for your deposit.',
            state: 'upcoming',
          },
        ]}
      />
    </div>
  );

  const renderWithdrawalTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      <div className="lg:col-span-2 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Account</label>
          <FundsDropdown
            value={withdrawAccountId}
            options={accountOptionsForFunding}
            placeholder="Select an account"
            onChange={(id) => {
              setWithdrawAccountId(id);
              setWithdrawAmount('');
            }}
            disabled={accountOptionsForFunding.length === 0}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">Amount</label>
            <button
              type="button"
              onClick={() => {
                const acc = liveAccounts.find((a) => a.id === withdrawAccountId);
                const bal = Number(acc?.balance ?? wallet?.main_wallet_balance ?? 0);
                setWithdrawAmount(String(Math.max(0, bal)));
              }}
              className="text-xs font-bold text-text-primary hover:underline"
            >
              Max
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Enter an amount"
            className="w-full rounded-xl bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
          />
        </div>

        {/* Withdrawals are the platform's one hard KYC gate — warn before
            the user fills in the whole form. The backend enforces this
            regardless (403 KYC_REQUIRED on submit). */}
        {!kycApproved && (
          <div className="rounded-xl border border-[#E94E1B]/40 bg-[#FCE6DD] px-4 py-3 text-sm text-text-primary flex flex-wrap items-center justify-between gap-3">
            <span className="leading-relaxed">
              Withdrawals require <span className="font-semibold">verified KYC</span>. Your KYC status is checked when you submit a request.
            </span>
            <button
              type="button"
              onClick={() => router.push('/kyc')}
              className="shrink-0 inline-flex items-center justify-center rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              Complete KYC
            </button>
          </div>
        )}

        {/* Payment-method chips */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Payout method</label>
          <div className="flex gap-2">
            {(
              [
                { id: 'crypto' as const, label: 'Crypto', sub: 'USDT on-chain' },
                { id: 'bank' as const, label: 'Bank / UPI', sub: 'Manual payout' },
              ]
            ).map((c) => {
              const active = withdrawUiSection === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setWithdrawUiSection(c.id)}
                  className={clsx(
                    'flex-1 rounded-xl border px-4 py-3 text-left transition-colors',
                    active
                      ? 'border-[#0A0A0A] bg-bg-card'
                      : 'border-transparent bg-bg-input hover:border-border-primary',
                  )}
                >
                  <div className="text-sm font-semibold text-text-primary">{c.label}</div>
                  {c.sub && <div className="text-xs text-text-tertiary mt-0.5">{c.sub}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {withdrawUiSection === 'crypto' ? (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">USDT Network</label>
              <div className="grid grid-cols-3 gap-2">
                {WITHDRAW_NETWORK_OPTIONS.map((opt) => {
                  const active = opt.network === withdrawNetwork;
                  return (
                    <button
                      key={opt.network}
                      type="button"
                      onClick={() => setWithdrawNetwork(opt.network)}
                      className={clsx(
                        'rounded-xl border px-3 py-2.5 text-left text-xs transition-colors',
                        active
                          ? 'border-[#0A0A0A] bg-bg-card'
                          : 'border-transparent bg-bg-input hover:border-border-primary',
                      )}
                    >
                      <div className="font-semibold text-text-primary">{opt.label}</div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-text-primary">Your {withdrawActiveNetwork.label} address</label>
                {linkedWalletAddress && withdrawActiveNetwork.addressRegex.test(linkedWalletAddress) && (
                  <button
                    type="button"
                    onClick={() => setWithdrawCryptoAddress(linkedWalletAddress)}
                    className="text-xs font-bold text-text-primary hover:underline"
                  >
                    Use linked wallet
                  </button>
                )}
              </div>
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                value={withdrawCryptoAddress}
                onChange={(e) => setWithdrawCryptoAddress(e.target.value)}
                placeholder={withdrawActiveNetwork.addressHint}
                className={clsx(
                  'w-full rounded-xl bg-bg-input px-4 py-3.5 text-sm font-mono text-text-primary placeholder:text-text-tertiary outline-none break-all',
                  withdrawAddrTrimmed && !withdrawAddrValid
                    ? 'ring-2 ring-red-500/60'
                    : 'focus:ring-2 focus:ring-[#E94E1B]/40',
                )}
              />
              <p className="text-xs text-text-tertiary leading-relaxed">
                {withdrawAddrTrimmed && !withdrawAddrValid
                  ? `That doesn't look like a valid ${withdrawActiveNetwork.label} address.`
                  : `Double-check the address — payouts on the wrong network can't be recovered. Processing time: up to 24h.`}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">UPI ID</label>
              <input
                type="text"
                value={manualWithdrawUpi}
                onChange={(e) => setManualWithdrawUpi(e.target.value)}
                placeholder="yourname@upi"
                className="w-full rounded-xl bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">QR code (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setManualWithdrawQrFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl bg-bg-input px-4 py-3 text-sm text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-crx-charcoal file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-crx-charcoal-ink"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Notes (optional)</label>
              <input
                type="text"
                value={manualWithdrawNotes}
                onChange={(e) => setManualWithdrawNotes(e.target.value)}
                placeholder="Any context for finance"
                className="w-full rounded-xl bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
              />
            </div>
          </>
        )}

        <ContinueButton
          disabled={!withdrawCanContinue}
          busy={withdrawSubmitting}
          onClick={() => void submitWithdraw()}
          label={
            withdrawAmount
              ? `Continue — ${fmt(withdrawAmountNumber || 0)}`
              : 'Continue'
          }
        />
      </div>

      <Stepper
        steps={[
          {
            icon: <ArrowUpFromLine size={16} />,
            title: 'Withdrawal Request',
            description: 'Enter the amount and payout destination, then submit your request for review.',
            state: 'current',
          },
          {
            icon: <CheckCircle2 size={16} />,
            title: 'Funds Released',
            description: 'Finance approves the request and your funds are released to the chosen destination.',
            state: 'upcoming',
          },
        ]}
      />
    </div>
  );

  const renderTransferTab = () => {
    // Build the option list once — main wallet (or wallet account row, when
    // migrated) + every other live trading account.
    const sharedOptions = [
      ...(wallet?.wallet_account
        ? [] // wallet-bound users have their wallet listed as a normal row
        : [{
            id: MAIN_WALLET_OPTION_ID,
            label: 'Main Wallet',
            sublabel: formatCurrency(Number(wallet?.main_wallet_balance ?? 0), wallet?.currency || 'USD'),
          }]),
      ...liveAccounts.map((a) => ({
        id: a.id,
        label: `${a.account_group?.name || (a.is_wallet_account ? 'Wallet Account' : 'Standard')} · ${a.account_number || a.id.slice(0, 8)}`,
        sublabel: formatCurrency(Number(a.balance) || 0, a.currency || wallet?.currency || 'USD'),
      })),
    ];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">From</label>
            <FundsDropdown
              value={transferSourceId}
              options={sharedOptions}
              placeholder="Select source account"
              onChange={setTransferSourceId}
              disabled={sharedOptions.length === 0}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">To</label>
            <FundsDropdown
              value={transferDestinationId}
              options={sharedOptions.filter((o) => o.id !== transferSourceId)}
              placeholder="Select destination account"
              onChange={setTransferDestinationId}
              disabled={sharedOptions.length === 0}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Amount</label>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Enter an amount"
              className="w-full rounded-xl bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#E94E1B]/40"
            />
            <p className="text-xs text-text-tertiary leading-relaxed">
              Transfers between accounts are instant. Trading-account ↔ trading-account routes via your main wallet automatically.
            </p>
          </div>

          <ContinueButton
            disabled={!transferCanContinue}
            busy={transferSubmitting}
            onClick={() => void submitTransfer()}
            label="Continue"
          />
        </div>

        <Stepper
          steps={[
            {
              icon: <WalletIcon size={16} />,
              title: 'Pick Source Account',
              description: 'Choose the account you want to move funds from.',
              state: 'current',
            },
            {
              icon: <ArrowLeftRight size={16} />,
              title: 'Pick Destination Account',
              description: 'Select where the funds should land and confirm the transfer.',
              state: 'upcoming',
            },
          ]}
        />
      </div>
    );
  };

  const renderHistoryTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">Recent transactions</h2>
          <button
            type="button"
            onClick={() => {
              if (historyItems.length === 0) { toast.error('No transactions to export'); return; }
              void downloadWalletStatementPdf(
                historyItems.map((it) => ({
                  type: it.type, method: it.method, amount: it.amount,
                  currency: it.currency, status: it.status, created_at: it.created_at,
                })),
                {
                  accountName: userFullName || undefined,
                  accountEmail: userEmail || undefined,
                  currency: wallet?.currency || 'USD',
                  totalDeposited: wallet?.total_deposited,
                  totalWithdrawn: wallet?.total_withdrawn,
                  currentBalance: wallet?.balance,
                },
              );
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-primary bg-bg-card text-xs font-medium text-text-primary transition hover:bg-[#F9FAFB] shrink-0"
          >
            <FileText size={14} className="text-text-tertiary" /> Statement PDF
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-card">
          <div className="grid min-w-[560px] grid-cols-[1fr_1.2fr_1fr_1.4fr_1fr] text-xs font-semibold uppercase tracking-wide text-text-tertiary bg-[#F9FAFB] px-4 py-3 border-b border-border-primary">
            <span>Type</span>
            <span>Method</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Date</span>
            <span className="text-right">Status</span>
          </div>
          {historyLoading ? (
            <div className="px-4 py-10 text-center text-sm text-text-tertiary">Loading…</div>
          ) : historyItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-text-tertiary">No transactions yet.</div>
          ) : (
            historyPager.items.map((it) => {
              const t = (it.type || '').toLowerCase();
              const status = (it.status || '').toLowerCase();
              const statusClass =
                status === 'completed' || status === 'approved'
                  ? 'text-emerald-600 bg-emerald-50'
                  : status === 'pending'
                    ? 'text-amber-600 bg-amber-50'
                    : status === 'failed' || status === 'rejected' || status === 'cancelled'
                      ? 'text-red-600 bg-red-50'
                      : 'text-text-tertiary bg-bg-input';
              return (
                <div
                  key={`${it.id}-${it.type}`}
                  className="grid min-w-[560px] grid-cols-[1fr_1.2fr_1fr_1.4fr_1fr] items-center px-4 py-3 text-sm border-b border-[#F0F0F0] last:border-b-0"
                >
                  <div className="font-medium text-text-primary capitalize truncate">{t || 'transaction'}</div>
                  <div className="text-text-tertiary truncate">{prettyMethod(it.method)}</div>
                  <div className="font-mono tabular-nums text-right text-text-primary">
                    {formatCurrency(Number(it.amount) || 0, it.currency || wallet?.currency || 'USD')}
                  </div>
                  <div className="text-right text-text-tertiary text-xs tabular-nums">{fmtHistoryDate(it.created_at)}</div>
                  <div className="flex justify-end">
                    <span className={clsx('rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', statusClass)}>
                      {status || 'unknown'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          {historyItems.length > 0 && (
            <div className="px-4 pb-3"><Pagination {...historyPager.props} itemLabel="transactions" /></div>
          )}
        </div>
      </div>

      {/* Right — info card */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#0A0A0A] text-white flex items-center justify-center">
              <HistoryIcon size={16} />
            </div>
            <h3 className="text-sm font-bold text-text-primary">Wallet Snapshot</h3>
          </div>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary">Total deposits</dt>
              <dd className="font-mono tabular-nums font-semibold text-text-primary">
                {fmt(wallet?.total_deposited ?? 0)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary">Total withdrawals</dt>
              <dd className="font-mono tabular-nums font-semibold text-text-primary">
                {fmt(wallet?.total_withdrawn ?? 0)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary">Pending withdrawals</dt>
              <dd className="font-mono tabular-nums font-semibold text-text-primary">
                {wallet?.pending_withdrawals ?? 0}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-bg-input text-text-tertiary flex items-center justify-center">
              <Hourglass size={16} />
            </div>
            <h3 className="text-sm font-bold text-text-primary">Processing time</h3>
          </div>
          <p className="text-xs text-text-tertiary leading-relaxed">
            Crypto withdrawals are reviewed by finance; most requests are processed within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardShell mainClassName="flex flex-col min-h-0 overflow-hidden p-0 bg-bg-card">
      <div className="dashboard-main-scroll flex-1 min-h-0 min-w-0 overflow-y-auto bg-bg-card">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Funds</h1>
            <button
              type="button"
              onClick={() => void fetchData(true)}
              disabled={refreshing}
              className={clsx(
                'p-2 rounded-lg border border-border-primary bg-bg-card hover:bg-bg-input transition-all active:scale-95 shrink-0',
                refreshing && 'animate-spin cursor-not-allowed opacity-50',
              )}
              aria-label="Refresh wallet"
            >
              <RefreshCcw className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>

          {loadError && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {loadError}
            </div>
          )}

          {demoFundingBlocked && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-900">
              <p className="font-bold">Demo account — funding disabled</p>
              <p className="mt-1 leading-relaxed">{DEMO_FUNDING_MSG}</p>
            </div>
          )}

          {renderTabBar()}

          <div className="pt-2">
            {tab === 'deposit' && renderDepositTab()}
            {tab === 'withdrawal' && renderWithdrawalTab()}
            {tab === 'transfer' && renderTransferTab()}
            {tab === 'history' && renderHistoryTab()}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ---------------------------------------------------------------------------
// Local UI primitives — kept inside the file because they're tightly coupled
// to the Vantage-style Funds layout and aren't reused elsewhere yet.
// ---------------------------------------------------------------------------

/**
 * Controlled-menu dropdown mirroring the FilterDropdown pattern in
 * accounts/page.tsx. Rendered as a styled button + popover (NOT a native
 * <select>) so the visual treatment matches the rest of the Funds form.
 */
function FundsDropdown({
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  value: string | null;
  options: ReadonlyArray<{ id: string; label: string; sublabel?: string }>;
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          'flex w-full items-center justify-between gap-2 rounded-xl bg-bg-input px-4 py-3.5 text-left text-sm outline-none transition-shadow',
          'focus:ring-2 focus:ring-[#E94E1B]/40',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {selected ? (
          <span className="flex flex-col min-w-0">
            <span className="text-text-primary font-medium truncate">{selected.label}</span>
            {selected.sublabel && (
              <span className="text-xs text-text-tertiary font-mono tabular-nums truncate">{selected.sublabel}</span>
            )}
          </span>
        ) : (
          <span className="text-text-tertiary">{placeholder}</span>
        )}
        <ChevronDown
          size={16}
          className={clsx('text-text-tertiary transition-transform shrink-0', open && 'rotate-180')}
        />
      </button>
      {open && !disabled && options.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border-primary bg-bg-card shadow-lg ring-1 ring-black/5"
        >
          {options.map((o) => {
            const sel = o.id === value;
            return (
              <li key={o.id} role="option" aria-selected={sel}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-input',
                    sel && 'bg-bg-input',
                  )}
                >
                  <span className="flex flex-col min-w-0">
                    <span className={clsx('truncate', sel ? 'font-semibold text-text-primary' : 'text-text-primary')}>
                      {o.label}
                    </span>
                    {o.sublabel && (
                      <span className="text-xs text-text-tertiary font-mono tabular-nums truncate">{o.sublabel}</span>
                    )}
                  </span>
                  {sel && <CheckCircle2 size={14} className="text-text-primary shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Black pill Continue button used at the bottom of every Funds form. */
function ContinueButton({
  disabled,
  busy,
  onClick,
  label,
}: {
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full rounded-full py-3.5 text-sm font-semibold transition-colors',
        disabled
          ? 'bg-bg-active text-text-tertiary cursor-not-allowed'
          : 'bg-[#0A0A0A] text-white hover:bg-black active:scale-[0.99]',
      )}
    >
      {busy ? 'Processing…' : label}
    </button>
  );
}

/**
 * Right-column stepper. Vertical line connects the two icon squares;
 * the current step is a filled black square, upcoming steps are hollow.
 */
function Stepper({
  steps,
}: {
  steps: ReadonlyArray<{
    icon: React.ReactNode;
    title: string;
    description: string;
    state: 'current' | 'upcoming' | 'done';
  }>;
}) {
  return (
    <div className="relative">
      <div className="absolute left-[15px] top-8 bottom-8 w-px bg-border-primary" aria-hidden />
      <ul className="space-y-7 relative">
        {steps.map((s, i) => {
          const filled = s.state === 'current' || s.state === 'done';
          return (
            <li key={i} className="flex items-start gap-3.5">
              <div
                className={clsx(
                  'shrink-0 w-8 h-8 rounded-md flex items-center justify-center border-2',
                  filled
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-bg-card text-text-tertiary border-border-primary',
                )}
              >
                {s.icon}
              </div>
              <div className="min-w-0 pt-0.5">
                <h4 className={clsx('text-sm font-bold', filled ? 'text-text-primary' : 'text-text-tertiary')}>
                  {s.title}
                </h4>
                <p className="mt-1 text-xs text-text-tertiary leading-relaxed">{s.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16">
            <div className="w-10 h-10 border-[3px] border-[#E94E1B] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-text-tertiary">Loading wallet…</span>
          </div>
        </DashboardShell>
      }
    >
      <WalletPageContent />
    </Suspense>
  );
}
