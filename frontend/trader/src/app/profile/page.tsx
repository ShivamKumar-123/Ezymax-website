'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { type LucideIcon, User, Shield, Bell, Monitor, ChevronRight, ShieldCheck, BarChart3, Coins, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';
import GlossyIcon from '@/components/ui/GlossyIcon';
import Pagination, { usePagination } from '@/components/ui/Pagination';
import ProfileHeader from '@/components/profile/ProfileHeader';
import KycTab from '@/components/profile/KycTab';
import AnalyticsTab from '@/components/profile/AnalyticsTab';
import EarningsTab from '@/components/profile/EarningsTab';
import { Button } from '@/components/ui/Button';
import DashboardShell from '@/components/layout/DashboardShell';
import EmailVerificationCard from '@/components/profile/EmailVerificationCard';
import api from '@/lib/api/client';

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  kyc_status: string;
  avatar?: string | null;
  created_at?: string | null;
  two_factor_enabled: boolean;
  // Onboarding flag from /profile (mirror /auth/me) — drives the
  // EmailVerificationCard's "verified" badge and the Change-Email
  // button. `is_wallet_placeholder` removed with the wallet-integration
  // purge: no SIWE flow means no @wallet.swisscresta.local placeholder
  // emails any more.
  email_verified?: boolean;
}

interface TradingAccount {
  id: string;
  account_number: string;
  account_type: string;
  balance: number;
  is_demo: boolean;
  status?: string;
  leverage?: number;
}

interface Session {
  id: string;
  ip_address: string;
  user_agent: string;
  device_info: string;
  created_at: string;
}

type TabId = 'profile' | 'kyc' | 'analytics' | 'earnings' | 'security' | 'notifications' | 'sessions';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'profile',       label: 'Personal',      icon: User },
  { id: 'kyc',           label: 'KYC',           icon: ShieldCheck },
  { id: 'analytics',     label: 'Analytics',     icon: BarChart3 },
  { id: 'earnings',      label: 'Earnings',      icon: Coins },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'sessions',      label: 'Sessions',      icon: Monitor },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

/* 2FA card is hidden until the verify/enable flow is fixed end-to-end.
   State + handlers are left intact (referenced by the still-present
   JSX inside the `&& TWO_FA_ENABLED` gate below) so re-enabling is a
   one-line flip rather than a re-implementation. */
const TWO_FA_ENABLED = false;

export default function ProfilePage() {
  const [tab, setTab] = useState<TabId>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const sessionPager = usePagination(sessions, 8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Sessions
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);

  // 2FA setup
  const [showTwoFaSetup, setShowTwoFaSetup] = useState(false);
  const [twoFaUri, setTwoFaUri] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [settingUp2Fa, setSettingUp2Fa] = useState(false);
  const [verifying2Fa, setVerifying2Fa] = useState(false);

  // Notification preferences (namespaced key; one-time migration from the
  // legacy un-namespaced 'notifPrefs' key).
  const NOTIF_PREFS_KEY = 'sc.notifPrefs';
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      let raw = localStorage.getItem(NOTIF_PREFS_KEY);
      if (raw === null) {
        const legacy = localStorage.getItem('notifPrefs');
        if (legacy !== null) {
          localStorage.setItem(NOTIF_PREFS_KEY, legacy);
          localStorage.removeItem('notifPrefs');
          raw = legacy;
        }
      }
      return JSON.parse(raw || '{}');
    }
    catch { return {}; }
  });

  const toggleNotifPref = (key: string) => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSetup2Fa = async () => {
    try {
      setSettingUp2Fa(true);
      const res = await api.post<{ otp_uri: string }>('/auth/2fa/setup');
      setTwoFaUri(res.otp_uri);
      setShowTwoFaSetup(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to initiate 2FA setup');
    } finally { setSettingUp2Fa(false); }
  };

  const handleVerify2Fa = async () => {
    if (!twoFaCode.trim()) { toast.error('Please enter the verification code'); return; }
    try {
      setVerifying2Fa(true);
      await api.post('/auth/2fa/verify', { code: twoFaCode });
      toast.success('2FA enabled successfully!');
      setShowTwoFaSetup(false); setTwoFaCode(''); setTwoFaUri('');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid verification code');
    } finally { setVerifying2Fa(false); }
  };

  const handleDisable2Fa = async () => {
    try {
      setSettingUp2Fa(true);
      await api.delete('/auth/2fa');
      toast.success('2FA disabled');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally { setSettingUp2Fa(false); }
  };

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await api.get<Profile>('/profile');
      setProfile(data);
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');
      setPhone(data.phone ?? '');
      setCountry(data.country ?? '');
      setAddress((data.address ?? '').trim());
      setCity((data.city ?? '').trim());
      setState((data.state ?? '').trim());
      setPostal((data.postal_code ?? '').trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally { setLoading(false); }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ accounts?: TradingAccount[]; items?: TradingAccount[] }>('/accounts');
      setAccounts(res.accounts ?? res.items ?? []);
    } catch { /* non-critical */ }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get<{ sessions: Session[] }>('/profile/sessions');
      setSessions(res.sessions ?? []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchProfile(); fetchAccounts(); }, [fetchProfile, fetchAccounts]);
  useEffect(() => { if (tab === 'sessions') fetchSessions(); }, [tab, fetchSessions]);

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await api.put('/profile', {
        first_name: firstName, last_name: lastName,
        phone, country, address, city, state, postal_code: postal,
      });
      toast.success('Profile updated successfully!');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPass || !newPass) { toast.error('Please fill in all password fields'); return; }
    if (newPass !== confirmPass) { toast.error('New passwords do not match'); return; }
    try {
      setChangingPassword(true);
      await api.put('/profile/password', { current_password: currentPass, new_password: newPass });
      toast.success('Password changed successfully!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally { setChangingPassword(false); }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      setTerminatingSession(sessionId);
      await api.delete(`/profile/sessions/${sessionId}`);
      toast.success('Session terminated');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to terminate session');
    } finally { setTerminatingSession(null); }
  };


  const initials =
    `${(profile?.first_name?.[0] ?? '').toUpperCase()}${(profile?.last_name?.[0] ?? '').toUpperCase()}` || 'U';
  const username = profile?.email ? profile.email.split('@')[0] : '';

  const inputCls = 'w-full rounded-xl border border-border-secondary bg-bg-card-nested px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-[#E94E1B]/50 focus:outline-none disabled:opacity-60';
  const labelCls = 'mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-text-tertiary';

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const slideIndex = tabIndex >= 0 ? tabIndex : 0;

  return (
    <DashboardShell>
      {/* No mainClassName / inner scroll wrappers — they used to turn
          <main> into a narrow flex column where DashboardShell's
          1600px wrapper collapsed to content width, making the
          Settings page render as a ~700px centred card on wide
          monitors. The default shell layout (mx-auto max-w-[1600px]
          + native main scroll) gives full width across the page. */}
      <div className="space-y-5">
          <ProfileHeader profile={profile} onAvatarSaved={fetchProfile} />

        {loading && (
          <div className="rounded-[24px] bg-bg-card flex flex-col items-center gap-3 py-20">
            <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">Loading settings…</span>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-[24px] bg-bg-card text-center space-y-3 py-12 px-4">
            <p className="text-sell text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchProfile}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-hidden rounded-[24px] bg-bg-card">
            <div className="p-2 sm:p-3 border-b border-border-secondary">
              <div className="flex gap-1 overflow-x-auto rounded-2xl p-1 scrollbar-none" style={{ background: 'var(--bg-card-nested)' }}>
                {TABS.map((t) => {
                  const active = tab === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={clsx(
                        'relative flex-1 min-w-[112px] inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold whitespace-nowrap outline-none transition-colors',
                        active ? 'text-white' : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="profile-tab-pill"
                          className="absolute inset-0 rounded-xl bg-[#E94E1B] shadow-[0_6px_18px_rgba(233,78,27,0.35)]"
                          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                        />
                      )}
                      <GlossyIcon icon={Icon} size="sm" active={active} className="relative" />
                      <span className="relative">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="p-4 md:p-6 min-h-[200px]"
            >
        {/* ── Profile tab ── */}
        {tab === 'profile' && (
          <div className="w-full space-y-5">
            <div className="rounded-[24px] p-5 sm:p-6 border border-border-secondary">
              <div className="mb-5 flex items-center gap-3"><GlossyIcon icon={User} /><h2 className="text-sm font-semibold text-text-primary">Personal information</h2></div>

              <div className="space-y-4">
                {/* Username (read-only) */}
                <div>
                  <label className={labelCls}>Username</label>
                  <input
                    type="text"
                    value={`@${username}`}
                    disabled
                    className={`${inputCls} opacity-50 cursor-not-allowed`}
                  />
                </div>

                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      defaultValue={profile?.email ?? ''}
                      disabled
                      className={`${inputCls} opacity-50 cursor-not-allowed`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Street address */}
                <div>
                  <label className={labelCls}>Street Address</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House number, street" className={inputCls} />
                </div>

                {/* City + State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>State / Province</label>
                    <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Postal */}
                <div>
                  <label className={labelCls}>Postal / Zip Code</label>
                  <input type="text" value={postal} onChange={(e) => setPostal(e.target.value)} className={inputCls} placeholder="" />
                </div>

                <div className="flex justify-end pt-1">
                  <Button variant="primary" onClick={handleSaveProfile} loading={savingProfile}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>

            {/* Trading Accounts section */}
            {accounts.length > 0 && (
              <div className="rounded-[24px] overflow-hidden border border-border-secondary">
                <div className="px-5 py-3.5 border-b border-border-primary">
                  <div className="flex items-center gap-3"><GlossyIcon icon={LayoutGrid} size="sm" /><h3 className="text-sm font-semibold text-text-primary">Trading accounts</h3></div>
                </div>
                <ul className="divide-y divide-border-primary">
                  {accounts.map((acc) => (
                    <li key={acc.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[linear-gradient(160deg,#34343a,#0e0e10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {acc.is_demo ? 'D' : 'L'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{acc.account_number}</p>
                          <p className="text-xs text-text-tertiary">
                            {acc.is_demo ? 'Demo Account' : 'Live Account'}
                            {acc.leverage ? ` • 1:${acc.leverage}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-text-primary">{fmt(acc.balance)}</p>
                          <p className="text-[10px] text-text-tertiary">Balance</p>
                        </div>
                        <span className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                          acc.status === 'active' ? 'bg-accent/15 text-accent' : 'bg-bg-secondary text-text-tertiary',
                        )}>
                          {acc.status ?? 'active'}
                        </span>
                        <ChevronRight size={14} className="text-text-tertiary" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Security tab ── */}
        {tab === 'kyc' && <KycTab status={profile?.kyc_status} />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'earnings' && <EarningsTab />}
        {tab === 'security' && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="rounded-[24px] p-5 sm:p-6 border border-border-secondary">
              <h3 className="text-base font-semibold text-text-primary mb-4">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Current Password</label>
                  <input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className={inputCls} />
                </div>
                <Button variant="primary" onClick={handleChangePassword} loading={changingPassword}>
                  Update Password
                </Button>
              </div>
            </div>

            {TWO_FA_ENABLED && (
            <div className="rounded-[24px] p-5 sm:p-6 border border-border-secondary">
              <h3 className="text-base font-semibold text-text-primary mb-1">Two-Factor Authentication</h3>
              <p className="text-sm text-text-secondary mb-4">Add an extra layer of security to your account.</p>

              {showTwoFaSetup ? (
                <div className="space-y-4">
                  <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
                    <p className="text-xs text-text-secondary mb-2">Scan this URI in your authenticator app:</p>
                    <div className="font-mono text-xs text-text-primary break-all bg-card rounded-lg p-3 border border-border-primary select-all">{twoFaUri}</div>
                  </div>
                  <div>
                    <label className={labelCls}>Verification Code</label>
                    <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} className={inputCls} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowTwoFaSetup(false); setTwoFaCode(''); setTwoFaUri(''); }}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleVerify2Fa} loading={verifying2Fa}>Verify & Enable</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm text-text-primary">{profile?.two_factor_enabled ? '2FA is enabled' : '2FA is disabled'}</span>
                  <Button
                    variant={profile?.two_factor_enabled ? 'danger' : 'primary'}
                    size="sm"
                    onClick={profile?.two_factor_enabled ? handleDisable2Fa : handleSetup2Fa}
                    loading={settingUp2Fa}
                  >
                    {profile?.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </Button>
                </div>
              )}
            </div>
            )}

            <EmailVerificationCard
              email={profile?.email || ''}
              isVerified={Boolean(profile?.email_verified)}
              // No wallet flow any more, so no placeholder emails to
              // distinguish — every account is a real-email account.
              isPlaceholder={false}
              onChanged={() => void fetchProfile()}
            />
          </div>
        )}

        {/* ── Notifications tab ── */}
        {tab === 'notifications' && (
          <div className="max-w-lg mx-auto space-y-2">
            {[
              { label: 'Trade Executed',   desc: 'When a trade is placed or closed',          key: 'trade_executed' },
              { label: 'Deposit Approved', desc: 'When a deposit is processed',               key: 'deposit_approved' },
              { label: 'Margin Warning',   desc: 'When margin level drops below threshold',   key: 'margin_warning' },
              { label: 'Price Alerts',     desc: 'Custom price level notifications',          key: 'price_alerts' },
              { label: 'Copy Trading',     desc: 'When a copied trader opens a position',     key: 'copy_trading' },
              { label: 'Newsletter',       desc: 'Weekly market analysis and updates',        key: 'newsletter' },
            ].map((n) => (
              <div
                key={n.key}
                className="rounded-[24px] bg-bg-card px-4 py-3 flex items-center justify-between gap-3 noise-texture"
              >
                <div className="min-w-0">
                  <div className="text-sm text-text-primary">{n.label}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{n.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotifPref(n.key)}
                  className={clsx(
                    'relative w-9 h-5 rounded-full transition-all flex-shrink-0 border',
                    notifPrefs[n.key] ? 'bg-accent border-accent' : 'bg-bg-secondary border-border-primary',
                  )}
                  aria-pressed={!!notifPrefs[n.key]}
                >
                  <div
                    className={clsx(
                      'absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm',
                      notifPrefs[n.key] ? 'left-[18px] bg-black' : 'left-0.5 bg-text-primary',
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Sessions tab ── */}
        {tab === 'sessions' && (
          <div className="w-full">
            <div className="rounded-[24px] p-5 sm:p-6 border border-border-secondary">
              <h3 className="text-base font-semibold text-text-primary mb-4">Active Sessions</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-4">No active sessions</p>
              ) : (
                <div className="space-y-3">
                  {sessionPager.items.map((s) => (
                    <div
                      key={s.id}
                      className="bg-bg-secondary border border-border-primary rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary">{s.device_info || s.user_agent || 'Unknown Device'}</div>
                        <div className="text-xs text-text-tertiary mt-0.5">
                          IP: {s.ip_address} • {new Date(s.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleTerminateSession(s.id)} loading={terminatingSession === s.id}>
                        Terminate
                      </Button>
                    </div>
                  ))}
                  <Pagination {...sessionPager.props} itemLabel="sessions" />
                </div>
              )}
            </div>
          </div>
        )}
            </motion.div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
