"use client";

import * as React from "react";
import { Logo, formatNumber } from "@/components/kit";
import { ACCOUNTS, HISTORY, ME, POSITIONS, accountUsd, getInstrument } from "@ezymex/mock";
import { BROKER_INFO, LEDGER } from "@ezymex/mock/portfolio-extra";
import { serverTime } from "./export";

const n2 = (v: number) => formatNumber(Math.abs(v) < 0.005 ? 0 : v, 2);

/** Paper-like MT5-style account statement, rendered in light "print" colours regardless of theme. */
export function StatementPreview({ login, period, from, to }: { login: string; period: string; from: number; to: number }) {
  const acc = ACCOUNTS.find((a) => a.login === login) ?? ACCOUNTS[0]!;
  const inRange = HISTORY.filter((t) => t.login === acc.login && Date.parse(t.closeTime) >= from && Date.parse(t.closeTime) <= to);
  // mock history is shorter than a real account's; fall back to the account's latest trades for older periods
  const trades = (inRange.length ? inRange : HISTORY.filter((t) => t.login === acc.login)).slice(0, 14);
  const open = POSITIONS.filter((p) => p.login === acc.login);
  const funding = LEDGER.filter((e) => e.login === acc.login && ["deposit", "withdrawal", "transfer-in", "transfer-out", "bonus", "ib-payout"].includes(e.type)).slice(0, 5);
  const closedPnl = trades.reduce((s, t) => s + t.profit - t.swap + t.commission, 0);
  const commission = trades.reduce((s, t) => s + t.commission, 0);
  const swap = trades.reduce((s, t) => s + t.swap, 0);
  const dep = funding.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0);
  const wd = funding.filter((f) => f.amount < 0).reduce((s, f) => s + f.amount, 0);
  const balance = accountUsd(acc, "balance");
  const equity = accountUsd(acc, "equity");
  const margin = accountUsd(acc, "margin");
  const floating = equity - balance;

  const th = "border-b border-[#d9d6d0] bg-[#f1efeb] px-2 py-1.5 text-left font-semibold text-[#3b3b44]";
  const td = "border-b border-[#ecebe7] px-2 py-1.5";

  return (
    <div className="rounded-xl bg-[#fdfcfa] p-5 text-[11px] leading-snug text-[#1a1a1f] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] ring-1 ring-black/10 sm:p-8">
      {/* Letterhead */}
      <div className="flex flex-col gap-4 border-b-2 border-[var(--k-ember)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo height={26} className="text-[#0e0e12]" />
          <div className="mt-2 max-w-xs text-[10px] text-[#6b6b74]">
            {BROKER_INFO.legal} · {BROKER_INFO.address} · {BROKER_INFO.licence}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-[18px] font-semibold tracking-tight">Trade Statement</div>
          <div className="text-[#6b6b74]">{period}</div>
          <div className="font-mono text-[10px] text-[#6b6b74]">Generated 24 Sep 2026, 21:00 (GMT+3)</div>
        </div>
      </div>

      {/* Account info */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
        {[
          ["Name", ME.name],
          ["Account", <span key="a" className="font-mono">{acc.login}</span>],
          ["Server", acc.server],
          ["Currency", acc.currency],
          ["Group", `${acc.group} · ${acc.mode === "hedging" ? "Hedging" : "Netting"}`],
          ["Leverage", `1:${acc.leverage}`],
          ["Email", ME.email],
          ["Time zone", "GMT+3 (server)"],
        ].map(([k, v], i) => (
          <div key={i}>
            <div className="text-[9.5px] uppercase tracking-wider text-[#8a8a93]">{k}</div>
            <div className="truncate font-medium">{v}</div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-lg ring-1 ring-[#e3e1dc] sm:grid-cols-4">
        {[
          ["Balance", n2(balance)],
          ["Equity", n2(equity)],
          ["Floating P/L", n2(floating)],
          ["Margin", n2(margin)],
          ["Free margin", n2(equity - margin)],
          ["Margin level", `${n2((equity / margin) * 100)}%`],
          ["Closed trade P/L", n2(closedPnl)],
          ["Credit", n2(accountUsd(acc, "credit"))],
        ].map(([k, v]) => (
          <div key={k} className="border-b border-r border-[#ecebe7] px-3 py-2">
            <div className="text-[9.5px] uppercase tracking-wider text-[#8a8a93]">{k}</div>
            <div className={`k-num mt-0.5 text-[13px] font-semibold ${String(v).startsWith("-") ? "text-[#c62b20]" : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Closed trades */}
      <h4 className="mt-6 mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#3b3b44]">Closed transactions</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              {["Ticket", "Open time", "Type", "Volume", "Symbol", "Price", "Close time", "Price", "Commission", "Swap", "Profit"].map((h, i) => (
                <th key={i} className={`${th} ${i >= 8 || i === 3 || i === 5 || i === 7 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="k-num">
            {trades.map((t) => {
              const d = getInstrument(t.symbol).digits;
              const gross = t.profit - t.swap + t.commission;
              return (
                <tr key={t.ticket}>
                  <td className={`${td} font-mono`}>{t.ticket}</td>
                  <td className={`${td} font-mono`}>{serverTime(t.openTime)}</td>
                  <td className={td}>{t.side}</td>
                  <td className={`${td} text-right`}>{t.volume.toFixed(2)}</td>
                  <td className={`${td} font-medium`}>{t.symbol.toLowerCase()}</td>
                  <td className={`${td} text-right font-mono`}>{formatNumber(t.openPrice, d)}</td>
                  <td className={`${td} font-mono`}>{serverTime(t.closeTime)}</td>
                  <td className={`${td} text-right font-mono`}>{formatNumber(t.closePrice, d)}</td>
                  <td className={`${td} text-right`}>{n2(-t.commission)}</td>
                  <td className={`${td} text-right`}>{n2(t.swap)}</td>
                  <td className={`${td} text-right font-semibold ${gross < 0 ? "text-[#c62b20]" : "text-[#15803d]"}`}>{n2(gross)}</td>
                </tr>
              );
            })}
            {!trades.length && (
              <tr>
                <td colSpan={11} className={`${td} py-4 text-center text-[#8a8a93]`}>
                  No closed transactions in this period
                </td>
              </tr>
            )}
            <tr className="font-semibold">
              <td colSpan={8} className="px-2 py-2 text-right text-[#6b6b74]">
                Total · {trades.length} trades
              </td>
              <td className="px-2 py-2 text-right">{n2(-commission)}</td>
              <td className="px-2 py-2 text-right">{n2(swap)}</td>
              <td className={`px-2 py-2 text-right ${closedPnl < 0 ? "text-[#c62b20]" : "text-[#15803d]"}`}>{n2(closedPnl)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Open positions */}
      <h4 className="mt-5 mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#3b3b44]">Open positions</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              {["Ticket", "Open time", "Type", "Volume", "Symbol", "Price", "S / L", "T / P", "Swap"].map((h, i) => (
                <th key={i} className={`${th} ${i === 3 || i >= 5 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="k-num">
            {open.map((p) => {
              const d = getInstrument(p.symbol).digits;
              return (
                <tr key={p.ticket}>
                  <td className={`${td} font-mono`}>{p.ticket}</td>
                  <td className={`${td} font-mono`}>{serverTime(p.openTime)}</td>
                  <td className={td}>{p.side}</td>
                  <td className={`${td} text-right`}>{p.volume.toFixed(2)}</td>
                  <td className={`${td} font-medium`}>{p.symbol.toLowerCase()}</td>
                  <td className={`${td} text-right font-mono`}>{formatNumber(p.openPrice, d)}</td>
                  <td className={`${td} text-right font-mono`}>{p.sl ? formatNumber(p.sl, d) : "0.00"}</td>
                  <td className={`${td} text-right font-mono`}>{p.tp ? formatNumber(p.tp, d) : "0.00"}</td>
                  <td className={`${td} text-right`}>{n2(p.swap)}</td>
                </tr>
              );
            })}
            {!open.length && (
              <tr>
                <td colSpan={9} className={`${td} py-4 text-center text-[#8a8a93]`}>
                  No open positions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Funding */}
      <h4 className="mt-5 mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#3b3b44]">Deposits / withdrawals</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr>
              {["Time", "Reference", "Type", "Comment", "Amount"].map((h, i) => (
                <th key={h} className={`${th} ${i === 4 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="k-num">
            {funding.map((f) => (
              <tr key={f.id}>
                <td className={`${td} font-mono`}>{serverTime(f.time)}</td>
                <td className={`${td} font-mono`}>{f.ref}</td>
                <td className={td}>{f.type.replace("-", " ")}</td>
                <td className={td}>{f.note}</td>
                <td className={`${td} text-right font-semibold ${f.amount < 0 ? "text-[#c62b20]" : ""}`}>{n2(f.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_280px]">
        <p className="text-[10px] leading-relaxed text-[#8a8a93]">
          This statement is generated automatically from the Ezymex trade server and reflects all transactions in server time (GMT+3). Spread costs are included in execution prices and are not charged separately. Please report any discrepancy to {BROKER_INFO.support} within 7 days.
        </p>
        <div className="rounded-lg ring-1 ring-[#e3e1dc]">
          {[
            ["Deposit / withdrawal", n2(dep + wd)],
            ["Closed trade P/L", n2(closedPnl)],
            ["Commission", n2(-commission)],
            ["Swap", n2(swap)],
            ["Floating P/L", n2(floating)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-[#ecebe7] px-3 py-1.5">
              <span className="text-[#6b6b74]">{k}</span>
              <span className="k-num font-medium">{v}</span>
            </div>
          ))}
          <div className="flex justify-between rounded-b-lg bg-[#fff1ea] px-3 py-2 text-[12.5px] font-semibold">
            <span>Equity</span>
            <span className="k-num">{n2(equity)} {acc.currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
