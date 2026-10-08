// Contract specs and accounts for the Ezymex Trader tests (the engine's /v1/symbols and account shapes).
import 'package:ezymex/features/terminal/core/models.dart';

SymbolSpec spec(
  String symbol, {
  String cls = 'forex',
  int digits = 5,
  double? pip,
  double contract = 100000,
  String quote = 'USD',
  String? base,
  double marginPct = 100,
  int maxLeverage = 1000,
  double lotMin = 0.01,
  double lotMax = 100,
  double lotStep = 0.01,
  String swapUnit = 'points',
}) => SymbolSpec.fromJson({
  'symbol': symbol,
  'name': symbol,
  'assetClass': cls,
  'digits': digits,
  'pipSize': ?pip,
  'contractSize': contract,
  'profitCurrency': quote,
  'baseCurrency': base ?? (cls == 'forex' ? symbol.substring(0, 3) : symbol),
  'marginPct': marginPct,
  'maxLeverage': maxLeverage,
  'lotMin': lotMin,
  'lotMax': lotMax,
  'lotStep': lotStep,
  'swapLong': -7.2,
  'swapShort': 1.4,
  'swapUnit': swapUnit,
  'tripleSwapDay': 'Wednesday',
  'session': cls == 'crypto' ? '24x7' : 'fx',
  'core': true,
  'liveTrading': true,
});

final eurusd = spec('EURUSD');
final usdjpy = spec('USDJPY', digits: 3, quote: 'JPY');
final xauusd = spec('XAUUSD', cls: 'metals', digits: 2, contract: 100);
final btcusd = spec('BTCUSD', cls: 'crypto', digits: 2, contract: 1, marginPct: 500, maxLeverage: 100, base: 'BTC', swapUnit: 'percent_per_year');

Map<String, dynamic> accountJson({
  String login = '10042817',
  bool cent = false,
  String type = 'live',
  double balance = 10000,
  double equity = 10250,
  double margin = 500,
}) => {
  'login': int.parse(login),
  'type': type,
  'group': cent ? 'cent' : 'pro',
  'groupName': cent ? 'Cent' : 'Pro',
  'spreadGroup': cent ? 'standard' : 'pro',
  'mode': 'hedging',
  'cent': cent,
  'currency': cent ? 'USC' : 'USD',
  'leverage': 200,
  'status': 'active',
  'marginCallLevel': 100,
  'stopOutLevel': 50,
  'controls': {'tradingDisabled': false, 'closeOnly': false, 'maxLot': null},
  'balance': balance,
  'credit': 0,
  'bonus': 0,
  'profit': equity - balance,
  'swap': 0,
  'equity': equity,
  'margin': margin,
  'freeMargin': equity - margin,
  'marginLevel': margin > 0 ? equity / margin * 100 : null,
  'demo': type == 'demo' ? {'initialBalance': 10000, 'refillsPerDay': 3, 'refillsUsedToday': 1, 'expiryDays': 30} : null,
  'createdAt': '2026-03-04T10:00:00Z',
};

TAccount account({bool cent = false, String type = 'live'}) =>
    TAccount.fromJson(accountJson(cent: cent, type: type, balance: cent ? 1000000 : 10000, equity: cent ? 1025000 : 10250, margin: cent ? 50000 : 500));
