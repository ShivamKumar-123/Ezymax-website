'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ibGet, fmt, UnauthorizedError } from '@/lib/api';
import type { DashboardData, SubIb } from '@/lib/types';
import SectionCard from '@/components/SectionCard';
import DataTable from '@/components/DataTable';
import Spinner from '@/components/Spinner';

export default function SubIbsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<SubIb[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await ibGet<DashboardData>('/business/ib/dashboard');
        setSubs(d.sub_ibs || []);
      } catch (e: any) {
        if (e instanceof UnauthorizedError) return router.replace('/login');
        toast.error('Could not load sub-IBs.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Sub-IBs</h1>
      <p className="text-xs text-text-tertiary">Referrals who became IBs themselves — your downline.</p>
      <SectionCard title="Your sub-IBs" subtitle={`${subs.length} direct downline partners`}>
        <DataTable<SubIb & { id: string }>
          rows={subs.map((s) => ({ ...s, id: s.referral_code }))}
          empty="No sub-IBs yet."
          columns={[
            {
              key: 'name', label: 'Name',
              render: (s) => (
                <div>
                  <p className="text-text-primary">{s.name}</p>
                  <p className="text-[11px] text-text-tertiary">{s.email}</p>
                </div>
              ),
            },
            { key: 'referral_code', label: 'Code', render: (s) => <span className="font-mono text-accent">{s.referral_code}</span> },
            { key: 'level', label: 'Level', align: 'center', render: (s) => `L${s.level}` },
            { key: 'earned', label: 'Earned', align: 'right', render: (s) => <span className="font-mono text-success">${fmt(s.total_earned)}</span> },
          ]}
        />
      </SectionCard>
    </div>
  );
}
