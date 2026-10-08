'use client';

/**
 * Admin · Ezymax Shield.
 *
 * The per-trade Trade Insurance product (tier multipliers, coverage %, fee
 * caps, cover-duration pricing, anti-abuse and dynamic surcharges) was removed
 * at the client's request. It had zero policies and zero claims at the time, so
 * no cover was in force. Shield period plans are now the only insurance
 * product, and ShieldAdminSection is the whole page.
 *
 * The backend routes (/insurance/settings, /insurance/stats) and the
 * system_settings rows behind them are untouched — nothing calls them, so the
 * product can be brought back without re-deriving its configuration.
 */
import ShieldAdminSection from './ShieldAdminSection';

export default function AdminInsurancePage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <ShieldAdminSection />
    </div>
  );
}
