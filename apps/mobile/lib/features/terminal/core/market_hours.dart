// Is a market open right now? The same sessions as the market-data service and the web (packages/mock prices.ts
// isMarketOpen): crypto / 24x7 always; US stocks 09:30–16:00 New York; Hong Kong 09:30–12:00 and 13:00–16:00 HKT;
// Tokyo 09:00–11:30 and 12:30–15:30 JST (weekdays); everything else Monday–Friday in server time. Exchange holidays
// are the engine's business (it answers `market_closed`).
import 'models.dart';
import 'trade_math.dart';

bool isMarketOpen(SymbolSpec? s, [DateTime? at]) {
  if (s == null) return true;
  final now = (at ?? DateTime.now()).toUtc();
  if (s.assetClass == 'crypto' || s.session == '24x7') return true;
  ({bool weekday, int mins}) local(int offsetH) {
    final d = now.add(Duration(hours: offsetH));
    return (weekday: d.weekday != DateTime.saturday && d.weekday != DateTime.sunday, mins: d.hour * 60 + d.minute);
  }

  if (s.session == 'hk_equity') {
    final l = local(8);
    return l.weekday && ((l.mins >= 570 && l.mins < 720) || (l.mins >= 780 && l.mins < 960));
  }
  if (s.session == 'jp_equity') {
    final l = local(9);
    return l.weekday && ((l.mins >= 540 && l.mins < 690) || (l.mins >= 750 && l.mins < 930));
  }
  final server = now.add(Duration(seconds: serverOffsetSeconds(now)));
  if (s.session == 'us_equity' || s.assetClass == 'stocks') {
    final ny = server.subtract(const Duration(hours: 7));
    final mins = ny.hour * 60 + ny.minute;
    return ny.weekday != DateTime.saturday && ny.weekday != DateTime.sunday && mins >= 570 && mins < 960;
  }
  return server.weekday != DateTime.saturday && server.weekday != DateTime.sunday;
}
