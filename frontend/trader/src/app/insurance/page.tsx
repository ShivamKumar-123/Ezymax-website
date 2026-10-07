'use client';

/**
 * Insurance — Ezymex Shield only.
 *
 * The per-trade micro-insurance product (a fee per trade, tiers priced by
 * position size) was removed at the client's request. It had zero policies and
 * zero claims when it went, so no cover was in force and nobody was stranded.
 * Shield — one plan covering a share of cumulative loss over a Daily / Weekly /
 * Monthly window — is now the only insurance product.
 */
import { ShieldCheck } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import ShieldPanel from '@/components/insurance/ShieldPanel';

export default function InsurancePage() {
  return (
    <DashboardShell>
      <div className="space-y-5 pb-8">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          <ShieldCheck size={22} className="text-[#1E88FF]" /> Ezymex Shield
        </h1>
        <p className="text-sm text-text-secondary -mt-1">
          Buy one plan (Daily / Weekly / Monthly) that covers a share of your cumulative
          loss over the whole window.
        </p>

        <ShieldPanel />
      </div>
    </DashboardShell>
  );
}
