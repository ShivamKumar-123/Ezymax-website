'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Activity, Bot, LineChart, Sparkles } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import BuilderTab from '@/components/ai-strategies/BuilderTab';
import StrategiesTab from '@/components/ai-strategies/StrategiesTab';
import InstancesTab from '@/components/ai-strategies/InstancesTab';
import AiTradesTab from '@/components/ai-strategies/AiTradesTab';

type Tab = 'builder' | 'strategies' | 'instances' | 'trades';

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: 'builder', label: 'Builder', icon: Sparkles },
  { id: 'strategies', label: 'My Strategies', icon: Bot },
  { id: 'instances', label: 'Live Instances', icon: Activity },
  { id: 'trades', label: 'AI Trades', icon: LineChart },
];

/**
 * AI Strategy Builder — describe a strategy in plain English, let AI turn it
 * into rules, backtest it against history, then deploy it to trade live.
 */
export default function AiStrategiesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('builder');

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Strategies</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Build trading strategies with AI, backtest them, and run them live on your accounts.
          </p>
        </div>

        {/* Tab bar — mirrors the PAMM/Social tab pattern */}
        <div className="flex gap-1 p-1 rounded-xl bg-bg-secondary border border-border-primary">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={clsx(
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5',
                  activeTab === t.id
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                )}
              >
                <Icon size={13} className="hidden sm:block" />
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'builder' && <BuilderTab onSaved={() => setActiveTab('strategies')} />}
        {activeTab === 'strategies' && <StrategiesTab />}
        {activeTab === 'instances' && <InstancesTab />}
        {activeTab === 'trades' && <AiTradesTab />}
      </div>
    </DashboardShell>
  );
}
