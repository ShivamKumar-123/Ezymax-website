'use client';

import {
  BadgeCheck,
  Brain,
  Briefcase,
  Cpu,
  Gauge,
  Gift,
  Headphones,
  Lock,
  MonitorSmartphone,
  Network,
  ShieldCheck,
  ShieldPlus,
  TrendingDown,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { FeatureGrid, Section, SectionHeading, type FeatureItem } from '@/marketing/components';
import { WHY_US } from '../data';
import { BRAND_NAME } from '@/lib/brand';

const iconMap: Record<string, LucideIcon> = {
  ShieldCheck, ShieldPlus, Zap, TrendingDown, Headphones, Network, Gift, Lock, Brain, Gauge,
  BadgeCheck, Cpu, MonitorSmartphone, Briefcase,
};

const items: FeatureItem[] = WHY_US.map(({ icon, title, body }) => ({
  icon: iconMap[icon] ?? ShieldCheck,
  title,
  body,
}));

export function Pourquoi() {
  return (
    <Section id="why-choose" raised decor="rays" corners={{ at: ['bl', 'br'], tone: 'accent' }}>
      <SectionHeading
        kicker={`Why Choose ${BRAND_NAME}`}
        title="Why traders choose this platform"
        lead="No licence, no track record to lean on -- so the case is the engineering. Here is exactly how your orders are executed and your balance is handled."
      />
      <div style={{ marginTop: 'var(--mk-space-7)' }}>
        <FeatureGrid items={items} columns={3} />
      </div>
    </Section>
  );
}
