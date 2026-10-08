// The Client Area's market list: the 28 core instruments of the web (packages/mock/src/symbols.ts INSTRUMENTS), their
// contract specification and trading hours (packages/mock/src/markets-extra.ts contractSpec, live build: no swap
// rows), the open/closed rule of the market-data service (prices.ts isMarketOpen) and the symbol avatar
// (packages/ui avatars.tsx SymbolAvatar). Used by Markets, News and Calendar.
import 'package:flutter/material.dart';

import '../../core/format/format.dart';
import '../../ui/ui.dart';

enum AssetClass { forex, metals, indices, energies, crypto, stocks }

/// How the avatar is drawn: two flags, a coin, a stock logo, a country flag, a metal or an energy code.
sealed class SymbolIcon {
  const SymbolIcon();
}

class PairIcon extends SymbolIcon {
  const PairIcon(this.base, this.quote);
  final String base, quote;
}

class CoinIcon extends SymbolIcon {
  const CoinIcon(this.coin);
  final String coin;
}

class StockIcon extends SymbolIcon {
  const StockIcon(this.logo, this.bg);
  final String logo;
  final Color bg;
}

class FlagIcon extends SymbolIcon {
  const FlagIcon(this.country);
  final String country;
}

class MetalIcon extends SymbolIcon {
  const MetalIcon(this.gold);
  final bool gold;
}

class EnergyIcon extends SymbolIcon {
  const EnergyIcon(this.code);
  final String code;
}

class Instrument {
  const Instrument(this.symbol, this.name, this.assetClass, this.digits, this.price, this.spread, this.change, this.contractSize, this.icon);
  final String symbol;
  final String name;
  final AssetClass assetClass;
  final int digits;

  /// Reference mid price, spread and day change (previews only; live builds take the feed's).
  final double price, spread, change;
  final double contractSize;
  final SymbolIcon icon;

  /// FX pips: 0.0001 (5 / 3 digits: the 4th / 2nd decimal), else one point.
  double get pipSize => digits == 5 || digits == 3 ? _pow10(-(digits - 1)) : _pow10(-digits);
}

double _pow10(int e) {
  var v = 1.0;
  for (var i = 0; i < e.abs(); i++) {
    v = e < 0 ? v / 10 : v * 10;
  }
  return v;
}

/// The 28 core instruments, in the web's order.
const List<Instrument> kInstruments = [
  Instrument('EURUSD', 'Euro vs US Dollar', AssetClass.forex, 5, 1.08456, 0.00008, 0.21, 100000, PairIcon('eu', 'us')),
  Instrument('GBPUSD', 'Pound vs US Dollar', AssetClass.forex, 5, 1.27881, 0.0001, -0.14, 100000, PairIcon('gb', 'us')),
  Instrument('USDJPY', 'US Dollar vs Yen', AssetClass.forex, 3, 149.382, 0.012, 0.36, 100000, PairIcon('us', 'jp')),
  Instrument('AUDUSD', 'Aussie vs US Dollar', AssetClass.forex, 5, 0.66214, 0.0001, 0.52, 100000, PairIcon('au', 'us')),
  Instrument('USDCAD', 'US Dollar vs Loonie', AssetClass.forex, 5, 1.35722, 0.00012, -0.08, 100000, PairIcon('us', 'ca')),
  Instrument('USDCHF', 'US Dollar vs Franc', AssetClass.forex, 5, 0.84917, 0.00012, -0.22, 100000, PairIcon('us', 'ch')),
  Instrument('GBPJPY', 'Pound vs Yen', AssetClass.forex, 3, 191.024, 0.02, 1.12, 100000, PairIcon('gb', 'jp')),
  Instrument('EURJPY', 'Euro vs Yen', AssetClass.forex, 3, 162.011, 0.018, 0.58, 100000, PairIcon('eu', 'jp')),
  Instrument('USDINR', 'US Dollar vs Rupee', AssetClass.forex, 4, 83.5125, 0.0035, 0.04, 100000, PairIcon('us', 'in')),
  Instrument('XAUUSD', 'Gold vs US Dollar', AssetClass.metals, 2, 2654.3, 0.18, 0.84, 100, MetalIcon(true)),
  Instrument('XAGUSD', 'Silver vs US Dollar', AssetClass.metals, 3, 31.184, 0.02, 1.46, 5000, MetalIcon(false)),
  Instrument('US30', 'Dow Jones 30', AssetClass.indices, 1, 42318.5, 1.8, 0.31, 1, FlagIcon('us')),
  Instrument('NAS100', 'Nasdaq 100', AssetClass.indices, 1, 20118.4, 1.2, 1.24, 1, FlagIcon('us')),
  Instrument('SPX500', 'S&P 500', AssetClass.indices, 1, 5762.8, 0.5, 0.44, 1, FlagIcon('us')),
  Instrument('GER40', 'Germany 40', AssetClass.indices, 1, 18994.2, 1.4, -0.27, 1, FlagIcon('de')),
  Instrument('UK100', 'FTSE 100', AssetClass.indices, 1, 8321.6, 1.1, -0.12, 1, FlagIcon('gb')),
  Instrument('JP225', 'Nikkei 225', AssetClass.indices, 0, 38742, 8, 0.92, 1, FlagIcon('jp')),
  Instrument('USOIL', 'WTI Crude Oil', AssetClass.energies, 2, 71.84, 0.03, -1.38, 1000, EnergyIcon('WTI')),
  Instrument('UKOIL', 'Brent Crude Oil', AssetClass.energies, 2, 75.12, 0.03, -1.11, 1000, EnergyIcon('BRN')),
  Instrument('BTCUSD', 'Bitcoin', AssetClass.crypto, 2, 63412, 18, 2.84, 1, CoinIcon('btc')),
  Instrument('ETHUSD', 'Ethereum', AssetClass.crypto, 2, 2618.44, 1.6, 1.92, 1, CoinIcon('eth')),
  Instrument('SOLUSD', 'Solana', AssetClass.crypto, 3, 148.212, 0.12, 4.61, 1, CoinIcon('sol')),
  Instrument('XRPUSD', 'Ripple', AssetClass.crypto, 4, 0.5874, 0.0012, -2.14, 1, CoinIcon('xrp')),
  Instrument('AAPL', 'Apple Inc.', AssetClass.stocks, 2, 228.14, 0.06, 0.72, 1, StockIcon('apple', Color(0xFF1D1D1F))),
  Instrument('TSLA', 'Tesla Inc.', AssetClass.stocks, 2, 254.28, 0.08, -3.18, 1, StockIcon('tesla', Color(0xFFCC0000))),
  Instrument('NVDA', 'NVIDIA Corp.', AssetClass.stocks, 2, 121.44, 0.05, 2.26, 1, StockIcon('nvidia', Color(0xFF76B900))),
  Instrument('META', 'Meta Platforms', AssetClass.stocks, 2, 568.31, 0.12, 1.08, 1, StockIcon('meta', Color(0xFF0866FF))),
  Instrument('NFLX', 'Netflix Inc.', AssetClass.stocks, 2, 709.52, 0.2, -0.64, 1, StockIcon('netflix', Color(0xFFE50914))),
];

final Map<String, Instrument> kInstrumentMap = {for (final i in kInstruments) i.symbol: i};

/// The web's default favourites (markets-extra.ts DEFAULT_FAVOURITES).
const List<String> kDefaultFavourites = ['XAUUSD', 'EURUSD', 'NAS100', 'BTCUSD'];

/// Asset classes of the Markets filter, in the web's order.
const List<AssetClass> kAssetClasses = AssetClass.values;

const Map<AssetClass, String> kAssetClassLabel = {
  AssetClass.forex: 'Forex',
  AssetClass.metals: 'Metals',
  AssetClass.indices: 'Indices',
  AssetClass.energies: 'Energies',
  AssetClass.crypto: 'Crypto',
  AssetClass.stocks: 'Stocks',
};

/* ------------------------------------------------------------------ spec */

class ContractSpec {
  const ContractSpec({
    required this.digits,
    required this.contractSize,
    required this.contractUnit,
    required this.minLot,
    required this.maxLot,
    required this.lotStep,
    required this.leverage,
    required this.marginCurrency,
    required this.hours,
    required this.hoursShort,
  });
  final int digits;
  final double contractSize;
  final String contractUnit;
  final double minLot, maxLot, lotStep;
  final int leverage;
  final String marginCurrency;

  /// Monday..Sunday sessions in server time ("00:05 – 23:55" or "Closed").
  final List<({String day, String sessions})> hours;
  final String hoursShort;
}

const Map<AssetClass, ({String week, String sat, String sun, String short})> _hours = {
  AssetClass.forex: (week: '00:05 – 23:55', sat: 'Closed', sun: 'Closed', short: '24/5'),
  AssetClass.metals: (week: '01:05 – 23:55', sat: 'Closed', sun: 'Closed', short: '24/5 · 1h break'),
  AssetClass.indices: (week: '01:05 – 23:50', sat: 'Closed', sun: 'Closed', short: '23/5'),
  AssetClass.energies: (week: '01:05 – 23:55', sat: 'Closed', sun: 'Closed', short: '23/5'),
  AssetClass.crypto: (week: '00:00 – 24:00', sat: '00:00 – 24:00', sun: '00:00 – 24:00', short: '24/7'),
  AssetClass.stocks: (week: '16:30 – 23:00', sat: 'Closed', sun: 'Closed', short: 'US session'),
};

const Map<AssetClass, int> _leverage = {
  AssetClass.forex: 1000,
  AssetClass.metals: 500,
  AssetClass.indices: 200,
  AssetClass.energies: 200,
  AssetClass.crypto: 100,
  AssetClass.stocks: 20,
};

const Map<AssetClass, String> _unit = {
  AssetClass.forex: 'units of base',
  AssetClass.metals: 'troy oz',
  AssetClass.indices: '× index',
  AssetClass.energies: 'barrels',
  AssetClass.crypto: 'coin',
  AssetClass.stocks: 'share',
};

const List<String> kWeekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

ContractSpec contractSpec(Instrument i) {
  final h = _hours[i.assetClass]!;
  return ContractSpec(
    digits: i.digits,
    contractSize: i.contractSize,
    contractUnit: i.symbol == 'XAGUSD' ? 'troy oz' : _unit[i.assetClass]!,
    minLot: 0.01,
    maxLot: i.assetClass == AssetClass.forex ? 200 : (i.assetClass == AssetClass.stocks ? 500 : 100),
    lotStep: 0.01,
    leverage: _leverage[i.assetClass]!,
    marginCurrency: i.assetClass == AssetClass.forex ? i.symbol.substring(0, 3) : 'USD',
    hours: [
      for (var d = 0; d < 7; d++)
        (
          day: kWeekDays[d],
          sessions: d == 5
              ? h.sat
              : d == 6
              ? h.sun
              : (d == 4 && i.assetClass != AssetClass.crypto ? h.week.replaceAll(RegExp(r'23:5\d|23:00'), '23:45') : h.week),
        ),
    ],
    hoursShort: h.short,
  );
}

/// Spread in the Markets table's units: pips for FX, price units for everything else.
String spreadText(Instrument i, double bid, double ask) =>
    i.assetClass == AssetClass.forex ? ((ask - bid) / i.pipSize).toStringAsFixed(1) : Fmt.number(ask - bid, i.digits);

/* ------------------------------------------------------------------ hours */

/// Server time offset (seconds) at `t`: GMT+3 while US daylight saving is on, else GMT+2 (New York close).
int serverOffsetSeconds(DateTime t) {
  final u = t.toUtc();
  DateTime nthSunday(int month, int n) {
    final first = DateTime.utc(u.year, month);
    return DateTime.utc(u.year, month, 1 + (7 - first.weekday % 7) % 7 + (n - 1) * 7);
  }

  final start = nthSunday(3, 2).add(const Duration(hours: 7));
  final end = nthSunday(11, 1).add(const Duration(hours: 6));
  return !u.isBefore(start) && u.isBefore(end) ? 3 * 3600 : 2 * 3600;
}

/// Server time (as a UTC DateTime holding the server's wall clock).
DateTime serverNow([DateTime? at]) {
  final u = (at ?? DateTime.now()).toUtc();
  return u.add(Duration(seconds: serverOffsetSeconds(u)));
}

/// Is `i`'s market open at `at`? Crypto always; US stocks 09:30–16:00 New York; the rest Monday–Friday server time.
bool isMarketOpen(Instrument? i, [DateTime? at]) {
  if (i == null || i.assetClass == AssetClass.crypto) return true;
  final server = serverNow(at);
  if (i.assetClass == AssetClass.stocks) {
    final ny = server.subtract(const Duration(hours: 7));
    final mins = ny.hour * 60 + ny.minute;
    return ny.weekday != DateTime.saturday && ny.weekday != DateTime.sunday && mins >= 570 && mins < 960;
  }
  return server.weekday != DateTime.saturday && server.weekday != DateTime.sunday;
}

/* ------------------------------------------------------------------ avatar */

/// The instrument avatar (web SymbolAvatar): two currency flags, a coin, a stock logo, a flag, a metal, an energy.
class SymbolAvatar extends StatelessWidget {
  const SymbolAvatar(this.symbol, {super.key, this.size = 28});
  final String symbol;
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final icon = kInstrumentMap[symbol]?.icon;
    switch (icon) {
      case PairIcon(:final base, :final quote):
        return SizedBox(
          width: size * 1.45,
          height: size,
          child: Stack(
            textDirection: TextDirection.ltr,
            children: [
              Positioned(left: 0, top: 0, child: _ring(context, KFlag(base, size: size))),
              Positioned(right: 0, top: 0, child: _ring(context, KFlag(quote, size: size))),
            ],
          ),
        );
      case CoinIcon(:final coin):
        return KCoinIcon(coin, size: size);
      case FlagIcon(:final country):
        return KFlag(country, size: size);
      case StockIcon(:final logo, :final bg):
        return Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: ColorFiltered(
            colorFilter: const ColorFilter.matrix([-1, 0, 0, 0, 255, 0, -1, 0, 0, 255, 0, 0, -1, 0, 255, 0, 0, 0, 1, 0]),
            child: KCoinIcon(logo, size: size * 0.62, stock: true),
          ),
        );
      case MetalIcon(:final gold):
        return Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              center: const Alignment(-0.4, -0.5),
              colors: gold ? const [Color(0xFFFFF3C4), Color(0xFFE9B949), Color(0xFF9C6F14)] : const [Color(0xFFFFFFFF), Color(0xFFC7CCD4), Color(0xFF7A818C)],
              stops: const [0, 0.45, 1],
            ),
          ),
          child: Text(
            gold ? 'Au' : 'Ag',
            style: TextStyle(fontSize: size * 0.36, fontWeight: FontWeight.w700, color: Colors.black.withValues(alpha: 0.7)),
          ),
        );
      case EnergyIcon(:final code):
        return Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            gradient: const RadialGradient(center: Alignment(-0.4, -0.5), colors: [Color(0xFF3B3B44), Color(0xFF141418)]),
          ),
          child: Text(
            code,
            style: TextStyle(fontSize: size * 0.32, fontWeight: FontWeight.w700, color: k.gold),
          ),
        );
      case null:
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: k.surface3, shape: BoxShape.circle),
        );
    }
  }

  Widget _ring(BuildContext context, Widget child) => Container(
    padding: const EdgeInsets.all(1.5),
    decoration: BoxDecoration(color: context.k.surface, shape: BoxShape.circle),
    child: child,
  );
}

/// Symbol and name (web SymbolCell).
class SymbolCell extends StatelessWidget {
  const SymbolCell(this.symbol, {super.key, this.size = 28, this.sub});
  final String symbol;
  final double size;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SymbolAvatar(symbol, size: size),
        const SizedBox(width: 10),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                symbol,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              Text(
                sub ?? kInstrumentMap[symbol]?.name ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.caption.copyWith(color: k.fg3, fontSize: 12, fontWeight: FontWeight.w400),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
