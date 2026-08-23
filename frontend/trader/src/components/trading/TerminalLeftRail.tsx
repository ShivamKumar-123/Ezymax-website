'use client';

import Link from 'next/link';
import { SwissCrestaWordmark } from '@/components/layout/SwissCrestaWordmark';
import {
  Search,
  LayoutTemplate,
  Newspaper,
  MessageCircle,
  Settings,
  Calculator,
} from 'lucide-react';
import { clsx } from 'clsx';

/** Kept for API back-compat (callers pass activeSpace / onSpaceChange) —
 *  the Spaces section itself has been removed from the rail. */
export type TerminalSpaceId = 'balanced' | 'chart' | 'trading';

interface TerminalLeftRailProps {
  /** No longer driven by the rail; left in the type so parent calls compile. */
  activeSpace?: TerminalSpaceId;
  onSpaceChange?: (id: TerminalSpaceId) => void;
  terminalMarketsOpen: boolean;
  onToggleMarkets: () => void;
  bottomPanelCollapsed: boolean;
  onToggleBottomPanel: () => void;
  onFocusSymbolSearch: () => void;
  chartExpanded: boolean;
  terminalNewsOpen: boolean;
  /** Right rail: symbol list + quotes */
  onPanelsSelectMarkets: () => void;
  /** Right rail: buy / sell order panel */
  onPanelsSelectOrder: () => void;
  /** Chart focus mode (expanded chart area; use with terminal page handler) */
  onExpandFullChart: () => void;
  /** Right rail: TradingView live news timeline */
  onPanelsSelectNews: () => void;
  /** Right rail: Risk calculator */
  terminalCalcOpen?: boolean;
  onPanelsSelectCalc?: () => void;
}

function RailBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'w-9 h-9 rounded-md flex items-center justify-center transition-colors shrink-0',
        active
          ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]'
          : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
      )}
    >
      {children}
    </button>
  );
}

// The rail is intentionally minimal: Search (opens the instrument search),
// the Panels / order view, Live news, and the Risk calculator — plus Support
// and Settings pinned to the bottom. The old Add-symbol, Markets, Chart-focus,
// positions-strip and connection-status buttons were removed.
export default function TerminalLeftRail({
  terminalMarketsOpen,
  onFocusSymbolSearch,
  chartExpanded,
  terminalNewsOpen,
  onPanelsSelectOrder,
  onPanelsSelectNews,
  terminalCalcOpen,
  onPanelsSelectCalc,
}: TerminalLeftRailProps) {
  const panelsActive =
    !terminalMarketsOpen && !chartExpanded && !terminalNewsOpen && !terminalCalcOpen;

  return (
    <aside
      className="shrink-0 w-[52px] flex flex-col items-stretch border-r border-border-primary bg-bg-secondary z-[5]"
      aria-label="Terminal toolbar"
    >
      <div className="flex flex-col items-center gap-0.5 pt-2 pb-1 px-1.5 border-b border-border-primary">
        <div className="mb-1 flex justify-center w-full">
          <SwissCrestaWordmark href="/accounts" variant="rail" />
        </div>
        {/* Search — opens the Markets panel with the instrument search focused. */}
        <RailBtn title="Search symbols" onClick={onFocusSymbolSearch}>
          <Search size={17} strokeWidth={1.75} />
        </RailBtn>
      </div>

      <div className="flex-1 flex flex-col items-center px-1.5 overflow-y-auto overflow-x-hidden min-h-0 py-1.5 gap-0.5">
        <RailBtn
          title="Panels — buy / sell order panel"
          active={panelsActive}
          onClick={onPanelsSelectOrder}
        >
          <LayoutTemplate size={17} strokeWidth={1.75} />
        </RailBtn>
        <RailBtn
          title="Market news & economic calendar"
          active={terminalNewsOpen && !chartExpanded}
          onClick={onPanelsSelectNews}
        >
          <Newspaper size={17} strokeWidth={1.75} />
        </RailBtn>
        {onPanelsSelectCalc && (
          <RailBtn
            title="Risk Calculator"
            active={!!terminalCalcOpen && !chartExpanded && !terminalNewsOpen}
            onClick={onPanelsSelectCalc}
          >
            <Calculator size={17} strokeWidth={1.75} />
          </RailBtn>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5 px-1.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] border-t border-border-primary">
        <Link
          href="/support"
          title="Support chat"
          className="w-9 h-9 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <MessageCircle size={17} strokeWidth={1.75} />
        </Link>
        <Link
          href="/profile"
          title="Settings"
          className="w-9 h-9 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <Settings size={17} strokeWidth={1.75} />
        </Link>
      </div>
    </aside>
  );
}
