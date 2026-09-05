'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Info, Calculator, RotateCcw, Search, ChevronDown, X } from 'lucide-react';
import { useTradingStore, type InstrumentInfo } from '@/stores/tradingStore';

type CalcTab = 'margin' | 'pnl' | 'lotsize' | 'swap';

const TABS: { id: CalcTab; label: string }[] = [
  { id: 'margin', label: 'Margin' },
  { id: 'pnl', label: 'P&L' },
  { id: 'lotsize', label: 'Lot Size' },
  { id: 'swap', label: 'Swap' },
];

/* ─── Field card: label + control inside one nested tile (order-ticket style) ─── */
function Row({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl px-3.5 py-2" style={{ background: 'var(--bg-card-nested)' }}>
      <label className="flex items-center text-[11px] text-text-tertiary">
        {label}
        {tip && (
          <span className="ml-1 cursor-help" title={tip}>
            <Info size={11} className="text-text-tertiary" />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function CompactSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="ticket-input w-full cursor-pointer appearance-none border-0 bg-transparent p-0 pt-0.5 text-[15px] font-bold text-text-primary shadow-none outline-none focus:ring-0"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function CompactInput({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ticket-input w-0 min-w-0 flex-1 border-0 bg-transparent p-0 pt-0.5 text-[15px] font-bold tabular-nums text-text-primary shadow-none outline-none placeholder:font-medium placeholder:text-text-tertiary focus:ring-0"
      />
      {suffix && (
        <span className="shrink-0 text-[12px] font-medium text-text-secondary">{suffix}</span>
      )}
    </div>
  );
}

/* ─── Compact searchable instrument picker ─── */
function CompactInstrumentPicker({
  value,
  onChange,
  instruments,
}: {
  value: string;
  onChange: (v: string) => void;
  instruments: InstrumentInfo[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = instruments.filter((i) =>
    i.symbol.toLowerCase().includes(search.toLowerCase()) ||
    i.display_name.toLowerCase().includes(search.toLowerCase()) ||
    i.segment.toLowerCase().includes(search.toLowerCase())
  );

  const current = instruments.find((i) => i.symbol === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex w-full cursor-pointer items-center justify-between pt-0.5 text-[15px] font-bold text-text-primary"
      >
        <span className="truncate">{current?.symbol || 'Select instrument'}</span>
        <ChevronDown size={14} className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full -left-3.5 -right-3.5 z-50 mt-2 overflow-hidden rounded-xl border border-border-primary bg-bg-secondary shadow-[0_20px_50px_-16px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-1.5 border-b border-border-primary px-3 py-2">
            <Search size={12} className="text-text-tertiary shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="ticket-input flex-1 border-0 bg-transparent p-0 text-[12px] text-text-primary shadow-none outline-none placeholder:text-text-tertiary focus:ring-0"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-text-tertiary hover:text-text-primary">
                <X size={11} />
              </button>
            )}
          </div>
          <div className="max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((inst) => (
              <button
                key={inst.symbol}
                type="button"
                onClick={() => { onChange(inst.symbol); setOpen(false); setSearch(''); }}
                className={clsx('flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-bg-hover', inst.symbol === value ? 'text-accent' : 'text-text-primary')}
              >
                <span className="text-[12px] font-semibold">{inst.symbol}</span>
                <span className="text-[10px] text-text-tertiary">{inst.segment}</span>
              </button>
            )) : (
              <div className="px-2 py-3 text-center text-[10px] text-text-tertiary">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskCalculator() {
  // Narrow selectors: needs live `prices` for the calc inputs but no longer
  // re-renders on unrelated store slices (positions, orders, ...).
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const accounts = useTradingStore((s) => s.accounts);

  const [tab, setTab] = useState<CalcTab>('margin');
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id ?? '');
  const [symbol, setSymbol] = useState(selectedSymbol || 'EURUSD');

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || activeAccount;
  const instrumentInfo = instruments.find((i: InstrumentInfo) => i.symbol === symbol);
  const tick = prices[symbol];
  const digits = instrumentInfo?.digits ?? 5;
  const pipSize = instrumentInfo?.pip_size ?? 0.0001;
  const contractSize = instrumentInfo?.contract_size ?? 100000;
  const balance = selectedAccount?.balance ?? 10000;
  const accountLeverage = selectedAccount?.leverage ?? 100;
  const [side, setSide] = useState('buy');
  const [lots, setLots] = useState('0.01');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');
  const [stopLoss, setStopLoss] = useState('');
  const [daysHeld, setDaysHeld] = useState('1');

  const livePrice = tick ? (side === 'buy' ? tick.ask : tick.bid) : 0;

  // ── Margin ──
  const marginResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || livePrice;
    const lev = accountLeverage;
    const lot = parseFloat(lots) || 0;
    if (!ep || !lot) return null;
    return { margin: (lot * contractSize * ep) / lev, ep, lot, lev };
  }, [entryPrice, accountLeverage, lots, livePrice, contractSize]);

  // ── P&L ──
  const pnlResult = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const lot = parseFloat(lots) || 0;
    if (!ep || !xp || !lot) return null;
    const pips = side === 'buy' ? (xp - ep) / pipSize : (ep - xp) / pipSize;
    const pipVal = (pipSize / ep) * contractSize;
    return { pnl: lot * pips * pipVal, pips, pipVal };
  }, [entryPrice, exitPrice, lots, side, pipSize, contractSize]);

  // ── Lot Size ──
  const lotResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || livePrice;
    const sl = parseFloat(stopLoss);
    const rp = parseFloat(riskPercent);
    if (!ep || !sl || !rp || ep <= 0 || sl <= 0) return null;
    const riskAmt = balance * (rp / 100);
    const slPips = Math.abs(ep - sl) / pipSize;
    if (slPips <= 0) return null;
    const pipVal = (pipSize / ep) * contractSize;
    return { lotSize: Math.max(0.01, parseFloat((riskAmt / (slPips * pipVal)).toFixed(2))), riskAmt, slPips, pipVal };
  }, [entryPrice, stopLoss, riskPercent, balance, livePrice, pipSize, contractSize]);

  // ── Swap ──
  const swapResult = useMemo(() => {
    // Priced off the entry field (live only as a fallback) like every other
    // tab — reading `tick` directly made the figure drift on each incoming
    // tick after Calculate, with no input having changed.
    const ep = parseFloat(entryPrice) || livePrice;
    const lot = parseFloat(lots) || 0;
    const days = parseInt(daysHeld) || 1;
    if (!lot || !ep) return null;
    const dailySwap = lot * 0.5 * ((pipSize / ep) * contractSize);
    return { dailySwap, totalSwap: dailySwap * days, days };
  }, [lots, daysHeld, entryPrice, livePrice, pipSize, contractSize]);

  // The result panel used to render straight off the useMemos, so a figure
  // appeared while the user was still typing and Calculate did nothing but
  // auto-fill the entry price. We remember WHICH inputs were calculated and
  // show the result only while the form still matches them; touching any
  // field hides it until Calculate is pressed again. (A signature rather
  // than a boolean, so the auto-fill can't race its own invalidation.)
  // Mirrors /risk-calculator — keep the two in step.
  const inputSignature = (entry: string) =>
    [tab, selectedAccountId, symbol, side, lots, entry, exitPrice, riskPercent, stopLoss, daysHeld].join('|');

  const [calculatedSig, setCalculatedSig] = useState<string | null>(null);
  const showResult = calculatedSig !== null && calculatedSig === inputSignature(entryPrice);

  const handleCalculate = () => {
    // Sign against the entry we actually used, not the one in state, so the
    // fill below doesn't immediately invalidate the result it just produced.
    let entry = entryPrice;
    if (!entry && livePrice > 0) {
      entry = livePrice.toFixed(digits);
      setEntryPrice(entry);
    }
    setCalculatedSig(inputSignature(entry));
  };

  const activeResult =
    tab === 'margin' ? marginResult :
    tab === 'pnl' ? pnlResult :
    tab === 'lotsize' ? lotResult : swapResult;

  // Current result
  const resultLabel =
    tab === 'margin' ? 'Required Margin' :
    tab === 'pnl' ? (pnlResult && pnlResult.pnl >= 0 ? 'Profit' : 'Loss') :
    tab === 'lotsize' ? 'Lot Size' : 'Est. Swap';

  const resultValue =
    tab === 'margin' ? (marginResult ? `$${marginResult.margin.toFixed(2)}` : '$0.00') :
    tab === 'pnl' ? (pnlResult ? `${pnlResult.pnl >= 0 ? '+' : '-'}$${Math.abs(pnlResult.pnl).toFixed(2)}` : '$0.00') :
    tab === 'lotsize' ? (lotResult ? lotResult.lotSize.toFixed(2) : '0.00') :
    (swapResult ? `$${swapResult.totalSwap.toFixed(2)}` : '$0.00');

  const resultDetails: { l: string; v: string }[] =
    tab === 'margin' && marginResult ? [
      { l: 'Lots', v: marginResult.lot.toFixed(2) },
      { l: 'Leverage', v: `1:${marginResult.lev}` },
      { l: 'Price', v: marginResult.ep.toFixed(digits) },
    ] :
    tab === 'pnl' && pnlResult ? [
      { l: 'Pips', v: pnlResult.pips.toFixed(1) },
      { l: 'Pip Value', v: `$${pnlResult.pipVal.toFixed(4)}` },
    ] :
    tab === 'lotsize' && lotResult ? [
      { l: 'Risk', v: `$${lotResult.riskAmt.toFixed(2)}` },
      { l: 'SL Pips', v: lotResult.slPips.toFixed(1) },
    ] :
    tab === 'swap' && swapResult ? [
      { l: 'Daily', v: `$${swapResult.dailySwap.toFixed(4)}` },
      { l: 'Days', v: String(swapResult.days) },
    ] : [];

  const handleReset = () => {
    setCalculatedSig(null);
    setEntryPrice('');
    setExitPrice('');
    setLots('0.01');
    setStopLoss('');
    setRiskPercent('1');
    setDaysHeld('1');
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-2.5 pb-1">
        <h2 className="flex items-center gap-2 text-[17px] font-bold leading-none text-text-primary">
          <Calculator size={17} className="text-accent" />
          Risk calculator
        </h2>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          title="Reset"
          aria-label="Reset calculator"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Tabs — orange underline, same language as Markets / News */}
      <div className="shrink-0 flex gap-5 px-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'relative pb-2 pt-1 text-[14px] transition-colors',
              tab === t.id ? 'font-bold text-text-primary' : 'font-medium text-text-tertiary hover:text-text-secondary',
            )}
          >
            {t.label}
            <span className={clsx('absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-accent transition-opacity', tab === t.id ? 'opacity-100' : 'opacity-0')} aria-hidden />
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain" style={{ scrollbarWidth: 'none' }}>
        <div className="px-3 py-2.5 space-y-2">

          {/* Account */}
          <Row label="Account" tip="Select your trading account">
            <CompactSelect
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              options={accounts.map((a) => ({ value: a.id, label: `${a.account_number} — $${a.balance.toFixed(2)}${a.is_demo ? ' (D)' : ''}` }))}
              placeholder="Select Account"
            />
          </Row>

          {/* Direction (margin uses it for live price, P&L for calc) */}
          {(tab === 'margin' || tab === 'pnl') && (
            <Row label="Direction" tip="Buy or Sell">
              <CompactSelect
                value={side}
                onChange={setSide}
                options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
              />
            </Row>
          )}

          {/* Lot Size: Balance */}
          {tab === 'lotsize' && (
            <Row label="Account Balance" tip="Your balance">
              <div className="pt-0.5 text-[15px] font-bold tabular-nums text-text-primary">
                ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Row>
          )}

          {/* Instrument with search */}
          <Row label="Instrument" tip="Search instruments">
            <CompactInstrumentPicker value={symbol} onChange={setSymbol} instruments={instruments} />
          </Row>

          {/* Entry Price */}
          <Row label="Entry Price" tip="Enter your entry price">
            <CompactInput
              value={entryPrice}
              onChange={setEntryPrice}
              placeholder="Enter Entry Price"
            />
          </Row>

          {/* Exit Price — only for P&L */}
          {tab === 'pnl' && (
            <Row label="Exit Price" tip="Enter your exit / TP price">
              <CompactInput
                value={exitPrice}
                onChange={setExitPrice}
                placeholder="Enter Exit Price"
              />
            </Row>
          )}

          {/* Margin-specific */}
          {tab === 'margin' && (
            <>
              <Row label="Leverage" tip="Account leverage">
                <div className="pt-0.5 text-[15px] font-bold tabular-nums text-text-primary">1:{accountLeverage}</div>
              </Row>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
            </>
          )}

          {/* P&L-specific */}
          {tab === 'pnl' && (
            <>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
            </>
          )}

          {/* Lot Size-specific */}
          {tab === 'lotsize' && (
            <>
              <Row label="Risk %" tip="% of balance to risk">
                <CompactInput value={riskPercent} onChange={setRiskPercent} placeholder="1" suffix="%" />
              </Row>
              <Row label="Stop Loss Price" tip="SL level">
                <CompactInput value={stopLoss} onChange={setStopLoss} placeholder="Enter SL price" />
              </Row>
            </>
          )}

          {/* Swap-specific */}
          {tab === 'swap' && (
            <>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
              <Row label="Days Held" tip="Days position open">
                <CompactInput value={daysHeld} onChange={setDaysHeld} placeholder="1" suffix="days" />
              </Row>
            </>
          )}

          {/* Calculate button */}
          <button
            type="button"
            onClick={handleCalculate}
            className="w-full rounded-xl bg-accent py-2.5 text-[15px] font-semibold text-white transition-[transform,opacity] hover:opacity-90 active:scale-[0.98]"
          >
            Calculate
          </button>

          {/* ─── Result panel ─── shown only for inputs that were actually
              calculated. Otherwise a placeholder that says what to do next,
              never a $0.00 that reads like a real answer. */}
          {showResult && activeResult ? (
            <div className="rounded-2xl p-4 text-white ring-1 ring-[#E94E1B]/35 shadow-[0_14px_40px_-12px_rgba(233,78,27,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] bg-[linear-gradient(165deg,#E94E1B_0%,#7a2a0e_28%,#1a0b06_62%,#0a0a0a_100%)]">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/70">{resultLabel}</p>
              <p className="mt-1 text-[26px] font-bold leading-none tabular-nums">{resultValue}</p>
              {resultDetails.length > 0 && (
                <dl className="mt-3 space-y-1 border-t border-white/10 pt-2.5 text-[12px] leading-none">
                  {resultDetails.map((d) => (
                    <div key={d.l} className="flex items-center justify-between gap-3 py-[3px]">
                      <dt className="text-white/60">{d.l}</dt>
                      <dd className="font-medium tabular-nums text-white">{d.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-primary/60 bg-bg-secondary/30 px-4 py-6 text-center">
              <Calculator size={20} className="mb-2 text-text-tertiary" />
              <span className="max-w-[200px] text-[12px] leading-relaxed text-text-tertiary">
                {activeResult ? 'Press Calculate to see your result' : 'Fill in the fields to calculate'}
              </span>
            </div>
          )}

          <p className="pb-1 text-center text-[10px] leading-relaxed text-text-tertiary">
            Approximate values — may vary with market conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
