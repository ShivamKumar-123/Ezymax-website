'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, User } from 'lucide-react';
import { fmt } from '@/lib/api';
import type { TreeNode as TNode } from '@/lib/types';

export default function TreeNode({ node, depth = 0 }: { node: TNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const children = node.children || [];
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 border-b border-border-primary/40 py-2 pr-3 hover:bg-bg-hover/30"
        style={{ paddingLeft: `${12 + depth * 18}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setOpen((o) => !o)} className="grid h-5 w-5 place-items-center rounded text-text-tertiary hover:text-text-primary">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="grid h-5 w-5 place-items-center text-text-tertiary/50"><User size={12} /></span>
        )}
        <Link href={`/users/${node.user_id}`} className="min-w-0 flex-1 truncate text-xs text-text-primary hover:text-accent">
          {node.name || node.email}
          <span className="ml-2 font-mono text-[11px] text-accent">{node.referral_code}</span>
        </Link>
        <span className="hidden shrink-0 text-[11px] text-text-tertiary sm:inline">L{node.level}</span>
        <span className="shrink-0 font-mono text-[11px] text-success">${fmt(node.total_earned)}</span>
      </div>
      {open && hasChildren && (
        <div>
          {children.map((c) => (
            <TreeNode key={c.user_id || c.referral_code} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
