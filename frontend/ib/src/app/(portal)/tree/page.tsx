'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ibGet, fmt, UnauthorizedError } from '@/lib/api';
import type { TreeNode as TNode } from '@/lib/types';
import SectionCard from '@/components/SectionCard';
import Spinner from '@/components/Spinner';
import TreeNode from '@/components/TreeNode';

interface TreeResp {
  root: { referral_code: string; level: number; total_earned: number };
  tree: TNode[];
  total_nodes: number;
}

export default function TreePage() {
  const router = useRouter();
  const [data, setData] = useState<TreeResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [depth, setDepth] = useState(5);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await ibGet<TreeResp>('/business/ib/tree', { max_depth: depth }));
    } catch (e: any) {
      if (e instanceof UnauthorizedError) return router.replace('/login');
      toast.error('Could not load tree.');
    } finally {
      setLoading(false);
    }
  }, [depth, router]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">MLM Tree</h1>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Depth
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="rounded-lg border border-border-primary bg-bg-secondary px-2 py-1.5 text-xs outline-none focus:border-accent/50"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <SectionCard
          title="Your downline"
          subtitle={data ? `${data.total_nodes} partners · root ${data.root.referral_code} · earned $${fmt(data.root.total_earned)}` : ''}
        >
          {!data || data.tree.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-text-tertiary">No downline yet.</p>
          ) : (
            <div className="py-1">
              {data.tree.map((n) => <TreeNode key={n.user_id || n.referral_code} node={n} />)}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
