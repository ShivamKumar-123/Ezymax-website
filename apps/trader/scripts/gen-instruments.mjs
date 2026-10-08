#!/usr/bin/env node
/**
 * Builds public/data/instruments.json (the searchable list on /markets) from the platform's instrument catalogue.
 *
 *   node scripts/gen-instruments.mjs [path/to/ezymex/config/instruments.json]
 *
 * Default source: ../../../ezymex/config/instruments.json (the platform repo next to this one).
 * Rows: [symbol, name, class, exchange, status, digits]
 *   status "live"  = tradable on real-money accounts today (core rows and catalogue rows with "live": true)
 *   status "soon"  = stocks: on demo now, coming to live accounts
 * Catalogue rows kept off live trading ("live_off") are left out: the website lists what a live account can trade.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.argv[2] || resolve(here, '../../../../ezymex/config/instruments.json'));
const out = resolve(here, '../public/data/instruments.json');

const CORE_NAMES = {
  EURUSD: 'Euro / US Dollar', GBPUSD: 'British Pound / US Dollar', USDJPY: 'US Dollar / Japanese Yen',
  AUDUSD: 'Australian Dollar / US Dollar', USDCAD: 'US Dollar / Canadian Dollar', USDCHF: 'US Dollar / Swiss Franc',
  GBPJPY: 'British Pound / Japanese Yen', EURJPY: 'Euro / Japanese Yen', USDINR: 'US Dollar / Indian Rupee',
  XAUUSD: 'Gold / US Dollar', XAGUSD: 'Silver / US Dollar', US30: 'US Wall Street 30', NAS100: 'US Tech 100',
  SPX500: 'US 500', GER40: 'Germany 40', UK100: 'UK 100', JP225: 'Japan 225', USOIL: 'WTI Crude Oil',
  UKOIL: 'Brent Crude Oil', BTCUSD: 'Bitcoin / US Dollar', ETHUSD: 'Ethereum / US Dollar', SOLUSD: 'Solana / US Dollar',
  XRPUSD: 'XRP / US Dollar', AAPL: 'Apple', TSLA: 'Tesla', NVDA: 'NVIDIA', META: 'Meta Platforms', NFLX: 'Netflix',
};
const EXCHANGE = { NASD: 'Nasdaq', NYSE: 'NYSE', XNYS: 'NYSE', AMEX: 'NYSE American', SEHK: 'Hong Kong', TSE: 'Tokyo' };

const rows = JSON.parse(readFileSync(src, 'utf8'));
const list = [];
for (const r of rows) {
  const core = r.tier !== 'catalogue';
  const cls = r.asset_class;
  let status;
  if (core) status = 'live';
  else if (cls === 'stocks') status = 'soon';
  else if (r.live) status = 'live';
  else continue;
  const name = r.name || CORE_NAMES[r.symbol] || r.symbol;
  const ex = cls === 'stocks' ? EXCHANGE[r.exchange] || (r.session === 'us_equity' ? 'US' : '') : '';
  list.push([r.symbol, name, cls, ex, status, r.digits ?? 2]);
}
const order = ['forex', 'metals', 'energies', 'indices', 'crypto', 'stocks'];
list.sort((a, b) => order.indexOf(a[2]) - order.indexOf(b[2]) || (a[4] === b[4] ? 0 : a[4] === 'live' ? -1 : 1));
writeFileSync(out, JSON.stringify({ source: 'ezymex/config/instruments.json', total: rows.length, rows: list }));
const by = {};
for (const r of list) by[`${r[2]}:${r[4]}`] = (by[`${r[2]}:${r[4]}`] || 0) + 1;
console.log(`wrote ${list.length} of ${rows.length} rows to ${out}`, by);
