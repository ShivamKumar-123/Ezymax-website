'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { formatCurrency } from '@/lib/formatters';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import WalletDepositModal from '@/components/wallet/WalletDepositModal';
import OnChainWalletBalance from '@/components/wallet/OnChainWalletBalance';
import WalletAccountMigrateBanner from '@/components/wallet/WalletAccountMigrateBanner';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet as WalletIcon,
  Clock,
  RefreshCcw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Minus,
  TrendingUp,
  X,
  Gift,
  History,
} from 'lucide-react';

interface AccountItem {
  id: string;
  account_number?: string;
  currency?: string;
  is_demo?: boolean;
  is_active?: boolean;
  is_wallet_account?: boolean;
  balance?: number;
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
   *  of main_wallet_balance. The "Main Balance" card swaps to a
   *  "Wallet Account" card backed by these numbers. */
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
}

const DEMO_FUNDING_MSG =
  'Demo accounts cannot deposit, withdraw, or transfer funds. Open a live account to use wallet funding.';

// Provider used for new deposits. NOWPayments replaced OxaPay in this build;
// the OxaPay backend code stays mounted so historical / in-flight OxaPay
// deposits still settle, but new deposits are always created against
// NOWPayments. Withdrawals still echo the OxaPay-style payout payload (only
// the inbound deposit channel changed).
const CRYPTO_DEPOSIT_METHOD = 'nowpayments';

/** UI grid — selection is sent with NOWPayments / payout details for finance matching. */
const CRYPTO_ASSETS = [
  { id: 'USDT_BSC', label: 'USDT', sub: 'BEP20' },
  { id: 'USDT_ERC', label: 'USDT', sub: 'ERC20' },
  { id: 'USDT_TRC', label: 'USDT', sub: 'TRC20' },
  { id: 'BTC', label: 'BTC', sub: 'Bitcoin' },
  { id: 'ETH', label: 'ETH', sub: 'Ethereum' },
  { id: 'USDC_ERC', label: 'USDC', sub: 'ERC20' },
  { id: 'TRX', label: 'TRX', sub: 'Tron' },
  { id: 'USDC_TRC', label: 'USDC', sub: 'TRC20' },
  { id: 'USDT_SOL', label: 'USDT', sub: 'SOL' },
  { id: 'USDC_SOL', label: 'USDC', sub: 'SOL' },
  { id: 'SOL', label: 'SOL', sub: 'Solana' },
  { id: 'XRP', label: 'XRP', sub: 'XRP' },
] as const;

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

// 'crypto' = automated provider flow (NOWPayments for deposits, OxaPay-style
// payout details for withdrawals). 'manual' = legacy bank/UPI manual path.
type FundingChannel = 'crypto' | 'manual';

interface ManualBankDetailsResponse {
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  qr_code_url?: string;
}

function WalletPageContent() {
  const user = useAuthStore((s) => s.user);
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  // Linked wallet address (lowercase) from /auth/me. Withdrawals always go
  // here — the input on the withdraw card is read-only. Server enforces the
  // same rule even if the FE is bypassed.
  const linkedWalletAddress = useAuthStore((s) => s.user?.wallet_address || '');
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountFromUrl = searchParams.get('account');
  const withdrawDeepLinkHandled = useRef(false);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [liveAccounts, setLiveAccounts] = useState<LiveAccountRow[]>([]);
  /** True when user has accounts but none are live (all demo) — block deposits, withdrawals, transfers. */
  const [demoFundingBlocked, setDemoFundingBlocked] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGen = useRef(0);
  const fundPanelRef = useRef<HTMLDivElement>(null);

  const [fundMainTab, setFundMainTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositUiSection, setDepositUiSection] = useState<'crypto' | 'manual'>('crypto');
  const [withdrawUiSection, setWithdrawUiSection] = useState<'crypto' | 'bank'>('crypto');
  const [selectedCryptoDeposit, setSelectedCryptoDeposit] = useState<string>(CRYPTO_ASSETS[0].id);

  const [depositChannel, setDepositChannel] = useState<FundingChannel>('crypto');
  // On-site wallet-connect deposit modal — opened from the deposit form's
  // submit handler when depositChannel === 'crypto'. The modal owns the
  // /wallet/deposit/wallet POST + the polling loop.
  const [walletDepositOpen, setWalletDepositOpen] = useState(false);
  const [walletDepositAmount, setWalletDepositAmount] = useState(0);
  const [walletDepositAsset, setWalletDepositAsset] = useState<string>(CRYPTO_ASSETS[0].id);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositTxId, setDepositTxId] = useState('');
  const [depositProofFile, setDepositProofFile] = useState<File | null>(null);
  const [manualBankInfo, setManualBankInfo] = useState<ManualBankDetailsResponse | null>(null);
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  const [withdrawChannel, setWithdrawChannel] = useState<FundingChannel>('crypto');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  /** USDT payout chain the user is sending to. Server requires one of these. */
  const [withdrawNetwork, setWithdrawNetwork] = useState<'tron' | 'bsc' | 'eth'>('tron');
  /** Destination wallet address (typed by user). No wallet-connect needed. */
  const [withdrawCryptoAddress, setWithdrawCryptoAddress] = useState('');
  const [manualWithdrawUpi, setManualWithdrawUpi] = useState('');
  const [manualWithdrawNotes, setManualWithdrawNotes] = useState('');
  const [manualWithdrawQrFile, setManualWithdrawQrFile] = useState<File | null>(null);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  /** Compact card transfers: trading ↔ main */
  const [balanceTransfer, setBalanceTransfer] = useState<{
    mode: 'to_main' | 'to_trading';
    tradingAccountId: string | null;
  } | null>(null);
  const [balanceTransferPickId, setBalanceTransferPickId] = useState('');
  const [balanceTransferAmount, setBalanceTransferAmount] = useState('');
  const [balanceTransferBusy, setBalanceTransferBusy] = useState(false);

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

        // Deposits always credit main wallet directly — no trading account required.
        setDemoFundingBlocked(false);

        if (wdRes.status === 'rejected') {
          toast.error('Could not load pending withdrawal count.');
        }

        const pendingWd = wdItems.filter(
          (w) => (w.status || '').toLowerCase() === 'pending',
        ).length;

        // Pick out the user's wallet-bound account (if any) so the UI
        // can swap the "Main Balance" card for a "Wallet Account" card
        // when migration has happened. Backend's partial unique index
        // guarantees at most one active wallet-bound account.
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

  const fmt = (n: number) => formatCurrency(n, wallet?.currency || 'USD');

  const selectedDepositCrypto = CRYPTO_ASSETS.find((c) => c.id === selectedCryptoDeposit) ?? CRYPTO_ASSETS[0];

  useEffect(() => {
    setDepositChannel(depositUiSection === 'manual' ? 'manual' : 'crypto');
  }, [depositUiSection]);

  useEffect(() => {
    setWithdrawChannel(withdrawUiSection === 'crypto' ? 'crypto' : 'manual');
  }, [withdrawUiSection]);

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

  const scrollToFundPanel = () => {
    requestAnimationFrame(() => {
      fundPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openDepositModal = () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    setDepositAmount('');
    setDepositTxId('');
    setDepositProofFile(null);
    setDepositUiSection('crypto');
    setManualBankInfo(null);
    setFundMainTab('deposit');
    scrollToFundPanel();
  };

  const openWithdrawModal = () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    setWithdrawAmount('');
    setWithdrawCryptoAddress('');
    setWithdrawUiSection('crypto');
    setManualWithdrawUpi('');
    setManualWithdrawNotes('');
    setManualWithdrawQrFile(null);
    setFundMainTab('withdraw');
    scrollToFundPanel();
  };

  // Auto-preload bank details when the user lands on the Manual tab so
  // the destination bank/UPI is visible immediately (no extra click).
  useEffect(() => {
    if (fundMainTab !== 'deposit' || depositUiSection !== 'manual') return;
    void loadManualBankDetails();
  }, [fundMainTab, depositUiSection, loadManualBankDetails]);

  /** Open withdraw modal from main wallet (?action=withdraw); external payouts use main balance only. */
  useEffect(() => {
    if (loading || withdrawDeepLinkHandled.current) return;
    const act = searchParams.get('action');
    if (!act || act.toLowerCase() !== 'withdraw') return;
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
    setFundMainTab('withdraw');
    setWithdrawUiSection('crypto');
    setWithdrawAmount('');
    setWithdrawCryptoAddress('');
    setManualWithdrawUpi('');
    setManualWithdrawNotes('');
    setManualWithdrawQrFile(null);
    scrollToFundPanel();
    const next = new URLSearchParams(searchParams.toString());
    next.delete('action');
    const qs = next.toString();
    router.replace(qs ? `/wallet?${qs}` : '/wallet', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when deep-linked
  }, [loading, searchParams, router, demoFundingBlocked]);

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
      // Manual USDT payout: user types their own destination address +
      // picks the chain. No wallet-connect required. Admin reviews +
      // signs the on-chain transfer from the back office.
      const opt = WITHDRAW_NETWORK_OPTIONS.find((o) => o.network === withdrawNetwork)
        ?? WITHDRAW_NETWORK_OPTIONS[0];
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
        });
        toast.success(`Withdrawal of $${amt.toLocaleString()} submitted — pending approval`);
        setWithdrawCryptoAddress('');
        void fetchData(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
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
      const token = api.getToken();
      const res = await fetch('/api/v1/wallet/withdraw/manual/', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
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
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const submitDeposit = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (depositChannel === 'crypto') {
      // On-site wallet-connect flow: open the modal which calls
      // POST /wallet/deposit/wallet itself, renders the QR + connect button,
      // and polls the status. The legacy hosted-redirect path stays mounted
      // on the backend as a manual fallback (Pay manually link inside the
      // modal — copy address to any external wallet/exchange).
      setWalletDepositAmount(amt);
      setWalletDepositAsset(selectedCryptoDeposit);
      setWalletDepositOpen(true);
      return;
    }

    if (!depositTxId.trim()) {
      toast.error('Enter your bank / UPI transaction or reference ID');
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
      const token = api.getToken();
      const res = await fetch('/api/v1/wallet/deposit/manual', {
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
      toast.success(`Manual deposit of $${amt.toLocaleString()} submitted — pending approval`);
      void fetchData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setDepositSubmitting(false);
    }
  };

  const openTransferToMain = (tradingAccountId: string) => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    setBalanceTransfer({ mode: 'to_main', tradingAccountId });
    setBalanceTransferAmount('');
  };

  const openTransferFromMain = (tradingAccountId: string | null) => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    setBalanceTransfer({ mode: 'to_trading', tradingAccountId });
    setBalanceTransferAmount('');
    const pick =
      tradingAccountId ??
      (selectedAccountId && liveAccounts.some((a) => a.id === selectedAccountId)
        ? selectedAccountId
        : liveAccounts[0]?.id) ??
      '';
    setBalanceTransferPickId(pick);
  };

  const closeBalanceTransfer = () => {
    setBalanceTransfer(null);
    setBalanceTransferAmount('');
    setBalanceTransferBusy(false);
  };

  const submitBalanceTransfer = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    if (!balanceTransfer) return;
    const tradingId =
      balanceTransfer.mode === 'to_main'
        ? balanceTransfer.tradingAccountId
        : balanceTransfer.tradingAccountId ?? balanceTransferPickId;
    if (!tradingId) {
      toast.error('Select a trading account');
      return;
    }
    const amt = parseFloat(balanceTransferAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setBalanceTransferBusy(true);
    try {
      if (balanceTransfer.mode === 'to_main') {
        await api.post('/wallet/transfer-trading-to-main', {
          from_account_id: tradingId,
          amount: amt,
        });
        toast.success(`$${amt.toLocaleString()} moved to main wallet`);
      } else {
        await api.post('/wallet/transfer-main-to-trading', {
          to_account_id: tradingId,
          amount: amt,
        });
        const num = liveAccounts.find((a) => a.id === tradingId)?.account_number ?? '';
        toast.success(`$${amt.toLocaleString()} sent to ${num || 'trading account'}`);
      }
      closeBalanceTransfer();
      void fetchData(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
      setBalanceTransferBusy(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell mainClassName="flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-8 h-8 border-2 border-[#d6a93d] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading wallet...</span>
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

  return (
    <DashboardShell mainClassName="flex flex-col min-h-0 overflow-hidden p-0">
      <div className="dashboard-main-scroll flex-1 min-h-0 min-w-0 overflow-y-auto bg-bg-base">
        <div className="w-full max-w-full space-y-4 sm:space-y-6 px-2.5 sm:px-4 py-3 sm:py-4 pb-24 md:px-6 md:py-6">
          {/* Crucial-ui style page header */}
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-text-primary">Wallet</h1>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Manage deposits and withdrawals. Approved funds credit your main wallet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchData(true)}
              disabled={refreshing}
              className={clsx(
                'p-2 rounded-lg bg-card border border-border-primary hover:bg-bg-hover transition-all active:scale-95 shrink-0',
                refreshing && 'animate-spin cursor-not-allowed opacity-50',
              )}
              aria-label="Refresh wallet"
            >
              <RefreshCcw className="w-4 h-4 text-text-secondary" />
            </button>
          </div>

          {loadError && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text-primary">
              {loadError}
            </div>
          )}

          {demoFundingBlocked && (
            <div className="rounded-xl border border-sell/30 bg-sell/10 px-3 py-2.5 text-xs text-text-primary">
              <p className="font-bold text-sell">Demo account — funding disabled</p>
              <p className="text-text-secondary mt-1 leading-relaxed">{DEMO_FUNDING_MSG}</p>
            </div>
          )}

          {/* ── Migration banner: shown only when user has linked a
                wallet but hasn't yet migrated to the wallet-bound
                account model. Hidden after migration. ── */}
          <WalletAccountMigrateBanner
            mainWalletBalance={wallet?.main_wallet_balance ?? 0}
            onMigrated={() => { void fetchData(); }}
          />

          {/* ── Wallet overview (KYC card removed per client — it lives on /profile) ── */}
          <div>
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 className="text-lg font-bold text-text-primary">Wallet Overview</h2>
                <button
                  type="button"
                  onClick={() => router.push('/transactions')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary hover:bg-bg-hover text-xs font-medium text-text-secondary transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  Transaction History
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Primary balance card. For non-migrated users it's the
                    legacy Main Balance (main_wallet_balance). For migrated
                    users it swaps to the Wallet Account — deposits land
                    there directly and withdrawals leave from there back
                    to the linked wallet. */}
                <div
                  className="rounded-2xl p-4 border flex flex-col"
                  style={{ background: 'var(--card-blue-bg)', borderColor: 'var(--card-blue-border)' }}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl border flex items-center justify-center"
                      style={{ background: 'var(--card-blue-icon-bg)', borderColor: 'var(--card-blue-icon-border)' }}
                    >
                      <WalletIcon size={18} style={{ color: 'var(--card-blue-icon)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--card-blue-text-muted)' }}>
                        {wallet?.wallet_account ? 'Wallet Account' : 'Main Balance'}
                      </p>
                      {wallet?.wallet_account && (
                        <p className="text-[10px] font-mono text-text-tertiary truncate">
                          #{wallet.wallet_account.account_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--card-blue-text-strong)' }}>
                    ${(wallet?.wallet_account?.balance ?? wallet?.main_wallet_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-medium" style={{ color: 'var(--card-blue-text-faint)' }}>USD</span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setFundMainTab('deposit'); scrollToFundPanel(); }}
                      className="py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors"
                    >
                      Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFundMainTab('withdraw'); scrollToFundPanel(); }}
                      className="py-2 rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-primary text-xs font-bold transition-colors"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>

                {/* Bonus Balance — green (locked/unwagered bonuses; merges into main on release) */}
                <div
                  className="rounded-2xl p-4 border flex flex-col"
                  style={{ background: 'var(--card-green-bg)', borderColor: 'var(--card-green-border)' }}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl border flex items-center justify-center"
                      style={{ background: 'var(--card-green-icon-bg)', borderColor: 'var(--card-green-icon-border)' }}
                    >
                      <Gift size={18} style={{ color: 'var(--card-green-icon)' }} />
                    </div>
                    <p className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--card-green-text-muted)' }}>Bonus Balance</p>
                  </div>
                  <p className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--card-green-text-strong)' }}>
                    ${(wallet?.bonus_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-medium" style={{ color: 'var(--card-green-text-faint)' }}>USD</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/rewards')}
                    className="mt-3 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>

              {/* On-chain balance for the user's linked external wallet.
                  Strictly read-only — shows live USDT balances on every
                  supported chain so the trader can see "what's in my
                  MetaMask" without leaving the app. The Deposit button
                  next to chains with non-zero USDT scrolls to the fund
                  panel and pre-selects that network's invoice. */}
              <OnChainWalletBalance
                onDepositClick={(slug) => {
                  // Slug maps to the deposit-asset radio in the modal
                  // (USDT_ERC / USDT_BSC / etc.). The fund panel uses
                  // its own state, so we just scroll for now; user
                  // picks the network manually in the picker.
                  setFundMainTab('deposit');
                  scrollToFundPanel();
                }}
              />
            </div>

          </div>

          {/* ── Account Cards Grid ── */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              {/* ── Main Wallet Card ── */}
              <div
                className="relative group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-accent)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-[60px] bg-[#d6a93d]/[0.04] group-hover:bg-[#d6a93d]/[0.08] transition-colors duration-500" />
                <div className="relative p-3 sm:p-4 md:p-5 flex flex-col gap-2.5 sm:gap-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border border-[#d6a93d]/25"
                      style={{ background: 'linear-gradient(135deg, rgba(214,169,61,0.18) 0%, rgba(214,169,61,0.05) 100%)' }}
                    >
                      <WalletIcon className="h-4 w-4 sm:h-5 sm:w-5 text-[#d6a93d]" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 6px rgba(214,169,61,0.5))' }} />
                    </div>
                    {(wallet?.pending_withdrawals ?? 0) > 0 && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                        {wallet?.pending_withdrawals} pending
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#d6a93d]/60 mb-0.5 sm:mb-1">
                      {wallet?.wallet_account ? 'Wallet Account' : 'Main Wallet'}
                    </p>
                    <p className="text-sm sm:text-lg md:text-xl font-bold tabular-nums font-mono text-text-primary truncate">
                      {fmt(wallet?.wallet_account?.balance ?? wallet?.main_wallet_balance ?? 0)}
                    </p>
                  </div>
                  {liveAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openTransferFromMain(liveAccounts.length === 1 ? liveAccounts[0].id : null)}
                      disabled={demoFundingBlocked}
                      title="Add to trading account"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold transition-all bg-[#d6a93d]/10 text-[#d6a93d] border border-[#d6a93d]/20 hover:bg-[#d6a93d]/20 hover:border-[#d6a93d]/40 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                      To Trading
                    </button>
                  )}
                </div>
              </div>

              {/* ── Live Account Cards ── */}
              {liveAccounts.map((a) => {
                const cur = a.currency || wallet?.currency || 'USD';
                const bal = Number(a.balance) || 0;
                const line = formatCurrency(bal, cur);
                const isSel = a.id === selectedAccountId;
                const num = a.account_number || '';
                const isManaged = num.startsWith('IF') || num.startsWith('CF');
                const isPool = num.startsWith('PM') || num.startsWith('MM') || num.startsWith('CT');
                const cardLabel = num.startsWith('IF') ? 'PAMM Investment'
                  : num.startsWith('CF') ? 'MAM Account'
                  : num.startsWith('PM') ? 'PAMM Master Pool'
                  : num.startsWith('CT') ? 'MAM Master Pool'
                  : num;
                const ac = isManaged ? { r: '245,158,11', hex: '#f59e0b' } : isPool ? { r: '168,85,247', hex: '#a855f7' } : { r: '214,169,61', hex: '#d6a93d' };

                return (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Trading account ${num}`}
                    onClick={() => setSelectedAccountId(a.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAccountId(a.id); } }}
                    className={clsx(
                      'relative group rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer outline-none hover:scale-[1.02]',
                      isSel && 'ring-2 ring-[#d6a93d]/30',
                    )}
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid rgba(${ac.r},${isSel ? 0.35 : 0.15})`,
                      boxShadow: isSel ? `0 2px 12px rgba(${ac.r},0.1)` : '0 2px 12px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-[60px] transition-colors duration-500"
                      style={{ background: `rgba(${ac.r},0.03)` }}
                    />
                    <div className="relative p-3 sm:p-4 md:p-5 flex flex-col gap-2.5 sm:gap-3">
                      <div className="flex items-center justify-between">
                        <div
                          className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, rgba(${ac.r},0.18) 0%, rgba(${ac.r},0.05) 100%)`, border: `1px solid rgba(${ac.r},0.22)` }}
                        >
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} style={{ color: ac.hex, filter: `drop-shadow(0 0 6px rgba(${ac.r},0.5))` }} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5 sm:mb-1 truncate" style={{ color: `rgba(${ac.r},0.6)` }}>
                          {cardLabel}
                        </p>
                        <p className="text-sm sm:text-lg md:text-xl font-bold tabular-nums font-mono text-text-primary truncate">{line}</p>
                      </div>
                      {!isManaged ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openTransferFromMain(a.id); }}
                            disabled={demoFundingBlocked}
                            title="Add from main wallet"
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border-primary bg-bg-hover/40 py-2 text-[10px] font-semibold text-text-tertiary hover:bg-bg-hover hover:text-accent hover:border-accent/25 transition-all disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            <span>Deposit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openTransferToMain(a.id); }}
                            disabled={demoFundingBlocked}
                            title="Move to main wallet"
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border-primary bg-bg-hover/40 py-2 text-[10px] font-semibold text-text-tertiary hover:bg-bg-hover hover:text-accent hover:border-accent/25 transition-all disabled:opacity-40"
                          >
                            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            <span>Withdraw</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center rounded-xl border py-2 text-[10px] font-bold tracking-wide"
                          style={{ borderColor: `rgba(${ac.r},0.15)`, color: `rgba(${ac.r},0.5)`, background: `rgba(${ac.r},0.04)` }}
                        >
                          Managed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {liveAccounts.length > 1 && wallet?.total_live_balance != null &&
              Math.abs((wallet.total_live_balance ?? 0) - (wallet.balance || 0)) > 0.009 && (
              <p className="px-1 text-[11px] text-text-tertiary">
                All live accounts total:{' '}
                <span className="font-mono font-semibold text-text-secondary">
                  {formatCurrency(wallet.total_live_balance, wallet?.currency || 'USD')}
                </span>
              </p>
            )}
          </div>

          <div
            ref={fundPanelRef}
            id="wallet-fund-panel"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-border-primary bg-card"
          >
            {/* Curved “crucial” tab shell — slides with spring; no mid-tab seam */}
            <div className="relative flex min-h-[52px] border-b border-border-primary bg-card">
              <div
                className="pointer-events-none absolute inset-0 z-0"
                aria-hidden
              >
                <div
                  className="absolute top-0 h-full w-1/2 transition-[transform] duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)] will-change-transform"
                  style={{
                    transform:
                      fundMainTab === 'deposit' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
                  }}
                >
                  <div
                    className={clsx(
                      'absolute inset-x-1.5 top-0 h-full rounded-t-2xl border-2 border-b-0 border-accent bg-card-nested',
                      'animate-wallet-main-tab-glow',
                    )}
                  />
                </div>
              </div>
              {(['deposit', 'withdraw'] as const).map((t) => {
                const active = fundMainTab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFundMainTab(t)}
                    className={clsx(
                      'relative z-10 flex-1 border-0 bg-transparent py-3.5 text-sm font-semibold capitalize outline-none',
                      'transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/50',
                      active ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {active ? (
                      <span
                        key={fundMainTab}
                        className="relative inline-block animate-wallet-main-tab-text drop-shadow-[0_0_20px_rgba(214,169,61,0.7)]"
                      >
                        {t === 'deposit' ? 'Deposit' : 'Withdraw'}
                      </span>
                    ) : (
                      <span className="relative inline-block">{t === 'deposit' ? 'Deposit' : 'Withdraw'}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              key={fundMainTab}
              className="space-y-5 bg-card-nested p-4 md:p-6 animate-wallet-fund-enter-lg"
            >
              {fundMainTab === 'deposit' ? (
                <>
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 border border-accent/20">
                      <ArrowDownToLine className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">Deposit funds</h2>
                      <p className="text-sm text-text-secondary">Add funds to your wallet or accounts</p>
                    </div>
                  </div>

                  {/* Deposit To */}
                  <div>
                    <p className="text-xs text-text-tertiary mb-2 font-medium uppercase tracking-wide">Deposit To</p>
                    <button
                      type="button"
                      className="w-full py-3.5 rounded-xl bg-[#d6a93d] text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <WalletIcon className="w-4 h-4" />
                      Wallet
                    </button>
                  </div>

                  {depositUiSection === 'crypto' ? (
                    <>
                      {/* USDT network picker. NowPayments invoice is pre-locked to
                          the selected variant so user pays on exactly that chain. */}
                      <div className="space-y-2">
                        <label className="text-xs text-text-secondary font-medium uppercase tracking-wide">Network</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'USDT_BSC', label: 'USDT', sub: 'BEP-20', hint: '~$0.30 gas' },
                            { id: 'USDT_ERC', label: 'USDT', sub: 'ERC-20', hint: '~$5–20 gas' },
                            { id: 'USDT_TRC', label: 'USDT', sub: 'TRC-20', hint: '~$1 gas' },
                          ].map((n) => {
                            const active = selectedCryptoDeposit === n.id;
                            return (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => setSelectedCryptoDeposit(n.id)}
                                className={clsx(
                                  'rounded-xl border p-3 text-left transition-colors',
                                  active
                                    ? 'border-accent bg-accent/10'
                                    : 'border-border-primary bg-bg-secondary hover:border-border-secondary',
                                )}
                              >
                                <div className="font-bold text-text-primary text-sm">{n.label}</div>
                                <div className="text-[11px] text-text-tertiary mt-0.5">{n.sub}</div>
                                <div className="text-[10px] text-text-tertiary mt-1">{n.hint}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-text-secondary">Amount (USD)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-bold">$</span>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-7 pr-4 py-3 rounded-xl border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 font-mono font-bold text-lg"
                          />
                        </div>
                      </div>

                      {/* Fee preview — approximate. NowPayments adds a service
                          fee (~0.5%) + the network gas to the user's amount
                          (is_fee_paid_by_user=true on the backend), so the
                          user actually sends more than they entered. Showing
                          this here removes the surprise on the next screen. */}
                      {Number(depositAmount) > 0 && (() => {
                        const amt = Number(depositAmount);
                        const svcFee = +(amt * 0.005).toFixed(2); // ~0.5%
                        const gasEstimate = selectedCryptoDeposit === 'USDT_BSC'
                          ? 0.30
                          : selectedCryptoDeposit === 'USDT_TRC'
                            ? 1.00
                            : 7.00; // ERC midpoint of $5-20
                        const networkLabel = selectedCryptoDeposit === 'USDT_BSC'
                          ? 'BEP-20'
                          : selectedCryptoDeposit === 'USDT_TRC'
                            ? 'TRC-20'
                            : 'ERC-20';
                        const total = +(amt + svcFee + gasEstimate).toFixed(2);
                        return (
                          <div className="rounded-xl border border-border-primary bg-bg-secondary px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-text-tertiary">Amount</span>
                              <span className="font-mono text-text-primary">${amt.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-text-tertiary">Service fee (~0.5%)</span>
                              <span className="font-mono text-text-primary">~${svcFee.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-text-tertiary">Network gas ({networkLabel})</span>
                              <span className="font-mono text-text-primary">~${gasEstimate.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-border-primary pt-1.5 mt-1.5 flex items-center justify-between">
                              <span className="text-xs font-semibold text-text-secondary">You&apos;ll send approximately</span>
                              <span className="font-mono font-bold text-accent text-sm">~${total.toFixed(2)} USDT</span>
                            </div>
                            <p className="text-[10px] text-text-tertiary leading-snug pt-1">
                              Exact amount is locked when the payment is generated. Network gas can vary with on-chain conditions.
                            </p>
                          </div>
                        );
                      })()}

                      <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                        <p className="text-xs text-text-secondary leading-relaxed">
                          A NowPayments invoice will be generated for the selected USDT network. Send the exact amount from any wallet or exchange to the address shown — funds credit automatically after on-chain confirmations.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void submitDeposit()}
                        disabled={demoFundingBlocked || depositSubmitting || !depositAmount}
                        className={clsx(
                          'w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.99]',
                          demoFundingBlocked || depositSubmitting || !depositAmount
                            ? 'bg-bg-hover text-text-tertiary cursor-not-allowed'
                            : 'bg-accent text-white hover:bg-[#5cffb8] shadow-neon-green-lg'
                        )}
                      >
                        {depositSubmitting ? 'Processing…' : 'Pay with Crypto'}
                      </button>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Withdraw header */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 border border-accent/20">
                      <ArrowUpFromLine className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">Withdraw funds</h2>
                      <p className="text-sm text-text-secondary">
                        {wallet?.wallet_account ? 'Withdraw from your wallet account' : 'Withdraw from your main wallet'}
                      </p>
                    </div>
                  </div>

                  {/* Wallet balance */}
                  <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary mb-1">
                      {wallet?.wallet_account ? 'Wallet Account Balance' : 'Wallet Balance'}
                    </p>
                    <p className="text-xl font-mono font-bold text-text-primary tabular-nums">
                      {fmt(wallet?.wallet_account?.balance ?? wallet?.main_wallet_balance ?? 0)}
                    </p>
                  </div>

                  <p className="text-xs text-text-tertiary leading-relaxed">
                    {wallet?.wallet_account ? (
                      <>Withdrawals are sent from your <span className="text-text-primary font-medium">wallet account</span> directly to your linked wallet.</>
                    ) : (
                      <>Withdrawals are sent from your <span className="text-text-primary font-medium">main wallet</span> only. Ensure the amount
                      you need is available on the main wallet before requesting a payout.</>
                    )}
                  </p>

                  {withdrawUiSection === 'crypto' ? (
                    (() => {
                      const activeOpt = WITHDRAW_NETWORK_OPTIONS.find((o) => o.network === withdrawNetwork)
                        ?? WITHDRAW_NETWORK_OPTIONS[0];
                      const linkedMatchesNetwork = !!linkedWalletAddress &&
                        activeOpt.addressRegex.test(linkedWalletAddress);
                      const trimmedAddr = withdrawCryptoAddress.trim();
                      const addrLooksValid =
                        trimmedAddr.length > 0 && activeOpt.addressRegex.test(trimmedAddr);
                      return (
                        <>
                          <div>
                            <p className="text-xs text-text-tertiary mb-3 font-medium uppercase tracking-wide">USDT Network</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {WITHDRAW_NETWORK_OPTIONS.map((opt) => {
                                const active = opt.network === withdrawNetwork;
                                return (
                                  <button
                                    key={opt.network}
                                    type="button"
                                    onClick={() => setWithdrawNetwork(opt.network)}
                                    className={clsx(
                                      'rounded-xl border p-3.5 text-left transition-colors',
                                      active
                                        ? 'border-accent/60 bg-accent/10'
                                        : 'border-border-primary bg-bg-secondary hover:border-border-secondary hover:bg-bg-hover',
                                    )}
                                  >
                                    <div className={clsx(
                                      'font-bold text-sm font-mono',
                                      active ? 'text-accent' : 'text-text-primary',
                                    )}>
                                      {opt.label}
                                    </div>
                                    <div className="text-[11px] text-text-tertiary mt-0.5">{opt.sub}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs text-text-secondary">Amount (USD)</label>
                              <button
                                type="button"
                                onClick={() =>
                                  setWithdrawAmount(String(Math.max(0, wallet?.wallet_account?.balance ?? wallet?.main_wallet_balance ?? 0)))
                                }
                                className="text-xs font-bold text-[#d6a93d] hover:underline"
                              >
                                Max
                              </button>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-bold">$</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-7 pr-4 py-3 rounded-xl border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 font-mono font-bold text-lg"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs text-text-secondary">Your {activeOpt.label} address</label>
                              {linkedMatchesNetwork && (
                                <button
                                  type="button"
                                  onClick={() => setWithdrawCryptoAddress(linkedWalletAddress)}
                                  className="text-[11px] font-bold text-[#d6a93d] hover:underline"
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
                              placeholder={activeOpt.addressHint}
                              className={clsx(
                                'w-full px-4 py-3 rounded-xl border bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none font-mono text-sm break-all',
                                trimmedAddr && !addrLooksValid
                                  ? 'border-red-500/60 focus:border-red-500'
                                  : 'border-border-primary focus:border-accent/50',
                              )}
                            />
                            <p className="text-[11px] text-text-tertiary leading-relaxed">
                              {trimmedAddr && !addrLooksValid
                                ? `That doesn't look like a valid ${activeOpt.label} address.`
                                : `Double-check the address — payouts on the wrong network can't be recovered.`}
                            </p>
                          </div>

                          <p className="text-[11px] text-text-tertiary">Processing time: up to 24 hours.</p>

                          <button
                            type="button"
                            onClick={() => void submitWithdraw()}
                            disabled={
                              demoFundingBlocked ||
                              withdrawSubmitting ||
                              !withdrawAmount ||
                              !addrLooksValid
                            }
                            className={clsx(
                              'w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.99]',
                              demoFundingBlocked ||
                                withdrawSubmitting ||
                                !withdrawAmount ||
                                !addrLooksValid
                                ? 'bg-bg-hover text-text-tertiary cursor-not-allowed'
                                : 'bg-accent text-white hover:bg-[#5cffb8] shadow-neon-green-lg',
                            )}
                          >
                            {withdrawSubmitting
                              ? 'Submitting…'
                              : `Withdraw funds${withdrawAmount ? ` — ${fmt(parseFloat(withdrawAmount || '0'))}` : ''}`}
                          </button>
                        </>
                      );
                    })()
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Card variant="glass" className="flex flex-col gap-1 border-border-glass/30 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-success text-[10px] md:text-xs font-bold uppercase tracking-wider">
                <ArrowDownLeft className="w-3 h-3" /> Total Deposits
              </div>
              <div className="text-base md:text-xl font-bold text-text-primary tabular-nums font-mono">
                {fmt(wallet?.total_deposited || 0)}
              </div>
              <div className="absolute top-0 right-0 w-12 h-12 bg-success/5 rounded-bl-full group-hover:bg-success/10 transition-colors" />
            </Card>
            <Card variant="glass" className="flex flex-col gap-1 border-border-glass/30 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-buy text-[10px] md:text-xs font-bold uppercase tracking-wider">
                <ArrowUpRight className="w-3 h-3" /> Total Withdrawals
              </div>
              <div className="text-base md:text-xl font-bold text-text-primary tabular-nums font-mono">
                {fmt(wallet?.total_withdrawn || 0)}
              </div>
              <div className="absolute top-0 right-0 w-12 h-12 bg-buy/5 rounded-bl-full group-hover:bg-buy/10 transition-colors" />
            </Card>
          </div>

          <div className="bg-bg-secondary/50 border border-border-glass/20 rounded-xl p-4 flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-buy/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-buy" />
            </div>
            <div>
              <h5 className="text-text-primary font-bold text-xs uppercase tracking-wide">Processing Time</h5>
              <p className="text-text-tertiary text-[10px] leading-relaxed mt-0.5">
                Crypto withdrawals are reviewed by finance; most requests are processed within 24 hours.
              </p>
            </div>
          </div>

        </div>
      </div>

      {balanceTransfer && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-transfer-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm"
            aria-label="Close"
            onClick={closeBalanceTransfer}
          />
          <div
            className="relative w-full max-w-sm rounded-t-2xl border border-border-primary bg-card-nested p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 id="wallet-transfer-title" className="pr-6 text-sm font-bold text-text-primary">
                {balanceTransfer.mode === 'to_main' ? 'Move to main wallet' : 'Add from main wallet'}
              </h2>
              <button
                type="button"
                onClick={closeBalanceTransfer}
                className="shrink-0 rounded-lg p-1 text-text-secondary transition-colors hover:bg-bg-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {balanceTransfer.mode === 'to_trading' && !balanceTransfer.tradingAccountId ? (
              <div className="mb-3 space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Trading account
                </label>
                <select
                  value={balanceTransferPickId}
                  onChange={(e) => setBalanceTransferPickId(e.target.value)}
                  className="w-full rounded-lg border border-border-primary bg-bg-primary px-2.5 py-2 text-xs font-mono text-text-primary outline-none focus:border-accent/40"
                >
                  {liveAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_number}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {balanceTransfer.mode === 'to_main' && balanceTransfer.tradingAccountId ? (
              <p className="mb-3 font-mono text-[11px] text-text-tertiary">
                From{' '}
                {liveAccounts.find((x) => x.id === balanceTransfer.tradingAccountId)?.account_number ?? '—'}
              </p>
            ) : null}
            {balanceTransfer.mode === 'to_trading' && balanceTransfer.tradingAccountId ? (
              <p className="mb-3 font-mono text-[11px] text-text-tertiary">
                To{' '}
                {liveAccounts.find((x) => x.id === balanceTransfer.tradingAccountId)?.account_number ?? '—'}
              </p>
            ) : null}
            <div className="mb-3 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                Amount ({wallet?.currency || 'USD'})
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-tertiary">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={balanceTransferAmount}
                  onChange={(e) => setBalanceTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border-primary bg-bg-primary py-2 pl-7 pr-3 text-sm font-mono font-bold text-text-primary outline-none focus:border-accent/40"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeBalanceTransfer}
                className="flex-1 rounded-lg border border-border-primary py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitBalanceTransfer()}
                disabled={balanceTransferBusy}
                className={clsx(
                  'flex-1 rounded-lg py-2 text-xs font-bold transition-colors',
                  balanceTransferBusy
                    ? 'cursor-not-allowed bg-border-primary text-text-tertiary opacity-60'
                    : 'bg-accent text-black hover:bg-accent/90',
                )}
              >
                {balanceTransferBusy ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <WalletDepositModal
        open={walletDepositOpen}
        onClose={() => setWalletDepositOpen(false)}
        amountUsd={walletDepositAmount}
        cryptoAsset={walletDepositAsset}
        onSettled={() => {
          // The IPN webhook already credited balance + sent the email; just
          // refresh the wallet view so the user sees the new total.
          void fetchData(true);
        }}
      />

    </DashboardShell>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell mainClassName="flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-8 h-8 border-2 border-[#d6a93d] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">Loading wallet…</span>
          </div>
        </DashboardShell>
      }
    >
      <WalletPageContent />
    </Suspense>
  );
}
