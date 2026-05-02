'use client';

/**
 * Blocks the trader UI with a one-time profile completion modal whenever
 * the signed-in user is missing required fields (first/last name, phone,
 * country, date of birth).
 *
 * Behaviour:
 *  - Only renders when `isAuthenticated` AND `user.profile_complete === false`.
 *  - Demo, staff, and unauthenticated routes bypass the gate (the backend
 *    already auto-passes those in /auth/me).
 *  - The modal cannot be dismissed — there is no close button. The user
 *    must finish the profile before they can use deposits, trading, or
 *    rewards. This is intentional: incomplete profiles cause downstream
 *    KYC / fraud / payout problems.
 *  - On submit we PUT /profile, then refreshUser() so the flag flips and
 *    the modal unmounts itself.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  date_of_birth: string;
};

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'EG', name: 'Egypt' },
  { code: 'TR', name: 'Turkey' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'NP', name: 'Nepal' },
  { code: 'OTHER', name: 'Other' },
];

function _toDateInput(s: string | null | undefined): string {
  if (!s) return '';
  // Backend returns ISO datetime ("2002-04-12T00:00:00") — strip to date.
  const t = String(s);
  const m = t.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

export default function ProfileCompleteGate() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const shouldRender =
    isInitialized &&
    isAuthenticated &&
    !!user &&
    !user.is_demo &&
    user.profile_complete === false;

  const [form, setForm] = useState<FormState>({
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    date_of_birth: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from whatever we already have so the user doesn't re-type
  // values that came from registration / Google sign-in.
  useEffect(() => {
    if (!shouldRender || !user) return;
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      country: user.country || '',
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
      postal_code: user.postal_code || '',
      date_of_birth: _toDateInput(user.date_of_birth),
    });
  }, [shouldRender, user?.id]);

  const missingCount = useMemo(() => {
    let n = 0;
    if (!form.first_name.trim()) n++;
    if (!form.last_name.trim()) n++;
    if (!form.phone.trim()) n++;
    if (!form.country.trim()) n++;
    if (!form.address.trim()) n++;
    if (!form.city.trim()) n++;
    if (!form.state.trim()) n++;
    if (!form.postal_code.trim()) n++;
    if (!form.date_of_birth.trim()) n++;
    return n;
  }, [form]);

  if (!shouldRender) return null;

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (missingCount > 0) {
      toast.error('Please fill all the required fields');
      return;
    }
    // Light client-side validation. Server is authoritative.
    if (!/^\+?[0-9 \-()]{6,20}$/.test(form.phone.trim())) {
      toast.error('Please enter a valid phone number');
      return;
    }
    const dob = new Date(form.date_of_birth);
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 18);
    if (Number.isNaN(dob.getTime()) || dob > minAge) {
      toast.error('You must be at least 18 years old');
      return;
    }

    setSubmitting(true);
    try {
      await api.put('/profile', {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
        date_of_birth: form.date_of_birth,
      });
      await refreshUser();
      toast.success('Profile completed — welcome to FXArtha');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Could not save profile';
      toast.error(typeof msg === 'string' ? msg : 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-gate-title"
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border-primary bg-bg-elevated shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#d6a93d]/15 flex items-center justify-center">
              <UserCircle2 size={20} className="text-[#d6a93d]" />
            </div>
            <div className="flex-1">
              <h2 id="profile-gate-title" className="text-text-primary font-bold text-lg leading-tight">
                Complete your profile
              </h2>
              <p className="text-text-tertiary text-xs mt-0.5">
                Required before you can deposit or trade
              </p>
            </div>
          </div>
          <p className="text-text-secondary text-xs leading-relaxed">
            We need a few details for KYC, fraud prevention, and to make sure
            payouts reach the right person. This takes about 30 seconds.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <input
                type="text"
                value={form.first_name}
                onChange={handleChange('first_name')}
                placeholder="Jane"
                autoComplete="given-name"
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 text-sm"
              />
            </Field>
            <Field label="Last name" required>
              <input
                type="text"
                value={form.last_name}
                onChange={handleChange('last_name')}
                placeholder="Doe"
                autoComplete="family-name"
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 text-sm"
              />
            </Field>
          </div>

          <Field label="Phone number" required>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="+91 98765 43210"
              autoComplete="tel"
              maxLength={20}
              className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 text-sm"
            />
          </Field>

          <Field label="Country of residence" required>
            <select
              value={form.country}
              onChange={handleChange('country')}
              className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary outline-none focus:border-[#d6a93d]/50 text-sm appearance-none"
            >
              <option value="">Select your country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Street address" required>
            <input
              type="text"
              value={form.address}
              onChange={handleChange('address')}
              placeholder="House / flat / street"
              autoComplete="street-address"
              maxLength={200}
              className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City" required>
              <input
                type="text"
                value={form.city}
                onChange={handleChange('city')}
                autoComplete="address-level2"
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 text-sm"
              />
            </Field>
            <Field label="State / province" required>
              <input
                type="text"
                value={form.state}
                onChange={handleChange('state')}
                autoComplete="address-level1"
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Postal / ZIP code" required>
              <input
                type="text"
                value={form.postal_code}
                onChange={handleChange('postal_code')}
                autoComplete="postal-code"
                maxLength={20}
                className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 text-sm"
              />
            </Field>
            <Field label="Date of birth" required hint="18+ to trade.">
              <input
                type="date"
                value={form.date_of_birth}
                onChange={handleChange('date_of_birth')}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary outline-none focus:border-[#d6a93d]/50 text-sm"
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              Encrypted in transit and at rest. Used only for compliance and account safety.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || missingCount > 0}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#d6a93d] text-bg-base font-bold text-sm transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving…
              </>
            ) : missingCount > 0 ? (
              `${missingCount} field${missingCount === 1 ? '' : 's'} remaining`
            ) : (
              'Save & continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-text-secondary mb-1.5">
        {label}{required ? <span className="text-red-400 ml-0.5">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="block text-[10px] text-text-tertiary mt-1">{hint}</span>
      ) : null}
    </label>
  );
}
