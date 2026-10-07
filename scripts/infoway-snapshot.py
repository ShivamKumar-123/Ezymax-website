#!/usr/bin/env python3
"""Snapshot of the Infoway instrument universe, the input of scripts/gen-catalogue.mjs.

WHY: config/instruments.json lists every instrument Kalks carries. Its provider-catalogue rows are generated from
this snapshot (symbol lists, names, currencies, exchanges, a recent price and turnover per symbol), so the
generation is reproducible and reviewable in git, and no service needs the provider at startup.

HOW (production server only: the provider key is the server's and allows a single stream connection, so never run
the fetch from a laptop with the production key):

    ssh kalks-vps 'cd ~/kalks && python3 scripts/infoway-snapshot.py fetch' > config/provider/infoway-snapshot.json
    node scripts/gen-catalogue.mjs

`fetch` reads INFOWAY_API_KEY from ~/kalks/.env.local (never printed), calls only the provider's read-only REST
reference endpoints (symbol lists, symbol info, the latest two daily bars, trading days) at ~3 requests/s, under the
plan's 10/s so the live service keeps its share, and writes the snapshot JSON to stdout. Nothing on the server
changes.

`compact DIR` builds the same snapshot from raw dumps of those endpoints saved in DIR (development).
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

TYPES = ["FOREX", "METAL", "ENERGY", "INDICES", "FUTURES", "CRYPTO", "STOCK_US", "STOCK_HK", "STOCK_CN", "STOCK_JP", "STOCK_KS", "STOCK_IN", "STOCK_TW"]
# provider types the catalogue draws from, and the provider market (WebSocket "business") that streams them
MARKET = {"FOREX": "common", "METAL": "common", "ENERGY": "common", "INDICES": "common", "CRYPTO": "crypto", "STOCK_US": "stock", "STOCK_HK": "stock", "STOCK_JP": "japan"}
# stocks kept in the snapshot per exchange, by turnover (the generator takes its top N from these)
STOCK_KEEP = {"STOCK_US": 3000, "STOCK_HK": 600, "STOCK_JP": 600}
US_EXCHANGES = {"NASD", "NYSE", "AMEX", "NYSD", "XNYS", "XNAS", "NASDAQ", "XASE"}
CALENDAR_MARKETS = ["HK"]  # exchange calendars taken from the provider's trading days


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def stock_ok(t, info):
    """Main-board listings only (no OTC / pink sheets)."""
    if t == "STOCK_US":
        return info.get("board") == "USMain" and (info.get("exchange") or "").strip() in US_EXCHANGES
    if t == "STOCK_HK":
        return info.get("board") == "HKEquity"
    if t == "STOCK_JP":
        return (info.get("exchange") or "") == "TSE"
    return False


def compact(lists, infos, bars, days, plan, fetched_at):
    """lists: {type: [list rows]}, infos: {type: [info rows]}, bars: {market: {code: [daily bars, newest first]}},
    days: {market: {year: {trade_days, half_trade_days}}}."""
    rows = []
    counts = {t: len(lists.get(t, [])) for t in TYPES}
    for t, market in MARKET.items():
        info = {r["symbol"]: r for r in infos.get(t, [])}
        cand = []
        for r in lists.get(t, []):
            code = r["symbol"]
            i = info.get(code, {})
            if t == "CRYPTO" and code.endswith(".P"):
                continue  # perpetual futures: the catalogue carries spot crypto
            if t.startswith("STOCK_") and not stock_ok(t, i):
                continue
            b = bars.get(market, {}).get(code) or []
            close = num(b[0]["c"]) if b else 0.0
            turnover = sum(num(x.get("vw")) for x in b) / len(b) if b else 0.0
            cand.append({
                "type": t,
                "code": code,
                "market": market,
                "name": (r.get("name_en") or i.get("name_en") or "").strip(),
                "ccy": i.get("currency"),
                "exchange": (i.get("exchange") or "").strip() or None,
                "index": bool(r.get("index")),
                "close": close,
                "turnover": round(turnover),
            })
        if t in STOCK_KEEP:
            cand = [c for c in cand if c["close"] > 0 and not c["index"]]
            cand.sort(key=lambda c: (-c["turnover"], c["code"]))
            cand = cand[: STOCK_KEEP[t]]
        rows.extend(sorted(cand, key=lambda c: (c["type"], c["code"])))
    calendars = {}
    for m, years in days.items():
        out = {}
        for y, d in sorted(years.items()):
            out[str(y)] = {"tradeDays": sorted(d.get("trade_days") or []), "halfDays": sorted(d.get("half_trade_days") or [])}
        calendars[m] = out
    return {
        "source": "Infoway REST: /common/basic/symbols (lists), /common/basic/symbols/info (currency, exchange, board), "
        "/{market}/v2/batch_kline (latest 2 daily bars: close, turnover), /common/basic/markets/trading_days",
        "generatedBy": "scripts/infoway-snapshot.py",
        "fetchedAt": fetched_at,
        "plan": {k: plan.get(k) for k in ["packageName", "apiNumPerSec", "maxWsConNum", "maxNum", "allWsNum", "maxYearHisData"]},
        "providerCounts": counts,
        "tradingDays": calendars,
        "rows": rows,
    }


def fetch():
    key = None
    for line in open(os.path.expanduser("~/kalks/.env.local")):
        if line.startswith("INFOWAY_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("INFOWAY_API_KEY not found in ~/kalks/.env.local")
    base = os.environ.get("INFOWAY_REST_URL", "https://data.infoway.io").rstrip("/")
    last = [0.0]

    def call(method, path, body=None):
        wait = last[0] + 0.35 - time.time()
        if wait > 0:
            time.sleep(wait)
        last[0] = time.time()
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(base + path, data=data, method=method, headers={"apiKey": key, "content-type": "application/json"})
        err = ""
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    v = json.loads(r.read())
                    if v.get("ret") == 200:
                        return v.get("data")
                    err = f"ret {v.get('ret')}: {v.get('msg')}"
            except Exception as e:  # noqa: BLE001 - report and retry
                err = str(e)
            time.sleep(2 + 3 * attempt)
        print(f"{method} {path.split('?')[0]} failed: {err}", file=sys.stderr)
        return None

    plan = call("GET", "/package/info") or {}
    lists = {t: call("GET", "/common/basic/symbols?" + urllib.parse.urlencode({"type": t})) or [] for t in TYPES}
    infos = {}
    for t in MARKET:
        syms = [r["symbol"] for r in lists[t]]
        rows = []
        for i in range(0, len(syms), 500):
            rows.extend(call("GET", "/common/basic/symbols/info?" + urllib.parse.urlencode({"type": t, "symbols": ",".join(syms[i : i + 500])})) or [])
        infos[t] = rows
    bars = {}
    for t, market in MARKET.items():
        info = {r["symbol"]: r for r in infos[t]}
        codes = [r["symbol"] for r in lists[t] if not (t == "CRYPTO" and r["symbol"].endswith(".P")) and (not t.startswith("STOCK_") or stock_ok(t, info.get(r["symbol"], {})))]
        for i in range(0, len(codes), 100):
            for row in call("POST", f"/{market}/v2/batch_kline", {"klineType": 8, "klineNum": 2, "codes": ",".join(codes[i : i + 100])}) or []:
                bars.setdefault(market, {})[row["s"]] = row.get("respList") or []
    year = int(time.strftime("%Y"))
    days = {m: {y: call("GET", "/common/basic/markets/trading_days?" + urllib.parse.urlencode({"market": m, "beginDay": f"{y}0101", "endDay": f"{y}1231"})) or {} for y in (year, year + 1)} for m in CALENDAR_MARKETS}
    return compact(lists, infos, bars, days, plan, time.strftime("%Y-%m-%d"))


def from_dumps(d):
    """Raw dumps: {TYPE}.json (symbol lists), stage1_out.json ({"info": {type: rows}}), stage2_out.json
    ({"kline": {market: rows}}), days_{M}_{Y}.json, plan.json."""
    load = lambda f: json.load(open(os.path.join(d, f)))  # noqa: E731
    lists = {t: load(f"{t}.json")["data"] for t in TYPES}
    infos = load("stage1_out.json")["info"]
    bars = {m: {r["s"]: r.get("respList") or [] for r in rows} for m, rows in load("stage2_out.json")["kline"].items()}
    days = {}
    for m in CALENDAR_MARKETS:
        for f in sorted(os.listdir(d)):
            if f.startswith(f"days_{m}_") and f.endswith(".json"):
                days.setdefault(m, {})[int(f[len(f"days_{m}_") : -5])] = load(f).get("data") or {}
    plan = load("plan.json") if os.path.exists(os.path.join(d, "plan.json")) else {}
    fetched = time.strftime("%Y-%m-%d", time.gmtime(os.path.getmtime(os.path.join(d, "stage2_out.json"))))
    return compact(lists, infos, bars, days, plan, fetched)


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "fetch":
        snap = fetch()
    elif len(sys.argv) == 3 and sys.argv[1] == "compact":
        snap = from_dumps(sys.argv[2])
    else:
        sys.exit(__doc__)
    json.dump(snap, sys.stdout, ensure_ascii=False, indent=0, sort_keys=False)
    sys.stdout.write("\n")
