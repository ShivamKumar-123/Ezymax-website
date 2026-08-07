'use client';

import DashboardShell from '@/components/layout/DashboardShell';
import InternalTransferPanel from '@/components/wallet/InternalTransferPanel';

export default function TransferPage() {
  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-2xl pb-8">
        <InternalTransferPanel />
      </div>
    </DashboardShell>
  );
}
