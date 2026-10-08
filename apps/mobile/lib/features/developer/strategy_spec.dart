// The visual strategy spec (services/algo/src/spec.rs) as JSON maps, with the web's defaults, templates, condition
// presets and enum labels (apps/crm/components/algo/api.ts, builder.tsx, strategies-page.tsx).
import '../../i18n/i18n.dart';

typedef Json = Map<String, dynamic>;

Json emptyRuleSet() => {'logic': 'all', 'groups': <Object?>[]};

/// An operand (price field, indicator, constant or candle pattern).
Json operand(
  String kind, {
  String field = 'close',
  String indicator = 'none',
  int period = 0,
  int period2 = 0,
  int period3 = 0,
  num mult = 0,
  num value = 0,
  String pattern = 'none',
}) => {
  'kind': kind,
  'field': field,
  'indicator': indicator,
  'period': period,
  'period2': period2,
  'period3': period3,
  'mult': mult,
  'value': value,
  'pattern': pattern,
};

Json condition(Json left, String op, Json right, [String timeframe = 'same']) => {'left': left, 'op': op, 'right': right, 'timeframe': timeframe};

Json ruleSet(List<Json> conditions) => {
  'logic': 'all',
  'groups': [
    {'logic': 'all', 'conditions': conditions},
  ],
};

Json defaultSpec(T t, {required String symbol, required String timeframe}) => {
  'name': t('developer.spec.defaultName', {'symbol': symbol, 'timeframe': timeframe}),
  'symbol': symbol,
  'timeframe': timeframe,
  'long': emptyRuleSet(),
  'short': emptyRuleSet(),
  'exitLong': emptyRuleSet(),
  'exitShort': emptyRuleSet(),
  'exitIntrabar': false,
  'sizing': {'mode': 'lots', 'lots': 0.1, 'riskPct': 1},
  'maxLots': 0.1,
  'sl': {'mode': 'pips', 'value': 20, 'atrPeriod': 14},
  'tp': {'mode': 'rr', 'value': 2, 'atrPeriod': 14},
  'trailing': {'mode': 'none', 'value': 0, 'atrPeriod': 14, 'breakevenTrigger': 0, 'breakevenOffset': 0},
  'sessions': <Object?>[],
  'days': <Object?>[],
  'closeOutsideSession': false,
  'maxTradesPerDay': 0,
  'maxDailyLoss': 0,
  'oneAtATime': true,
};

Json _ind(String key, int p, {int p2 = 0, int p3 = 0, num mult = 0}) => operand('indicator', indicator: key, period: p, period2: p2, period3: p3, mult: mult);
Json _price([String f = 'close']) => operand('price', field: f);
Json _val(num v) => operand('value', value: v);

/// The builder's four templates (strategies-page.tsx TEMPLATES).
class StrategyTemplate {
  const StrategyTemplate(this.id, this.make);
  final String id;
  final Json Function(T t) make;
  String name(T t) => t('developer.tpl.$id.name');
  String text(T t) => t('developer.tpl.$id.text');
}

final List<StrategyTemplate> kTemplates = [
  StrategyTemplate(
    'ema',
    (t) => {
      ...defaultSpec(t, symbol: 'EURUSD', timeframe: 'H1'),
      'name': t('developer.tpl.ema.name'),
      'long': ruleSet([condition(_ind('ema', 20), 'crosses_above', _ind('ema', 50))]),
      'short': ruleSet([condition(_ind('ema', 20), 'crosses_below', _ind('ema', 50))]),
      'sl': {'mode': 'atr', 'value': 2, 'atrPeriod': 14},
      'tp': {'mode': 'rr', 'value': 2, 'atrPeriod': 14},
    },
  ),
  StrategyTemplate(
    'rsi',
    (t) => {
      ...defaultSpec(t, symbol: 'EURUSD', timeframe: 'M15'),
      'name': t('developer.tpl.rsi.name'),
      'long': ruleSet([condition(_ind('rsi', 14), 'crosses_above', _val(30)), condition(_price(), 'gt', _ind('sma', 200))]),
      'short': ruleSet([condition(_ind('rsi', 14), 'crosses_below', _val(70)), condition(_price(), 'lt', _ind('sma', 200))]),
      'sl': {'mode': 'pips', 'value': 15, 'atrPeriod': 14},
      'tp': {'mode': 'pips', 'value': 25, 'atrPeriod': 14},
      'maxTradesPerDay': 3,
    },
  ),
  StrategyTemplate(
    'breakout',
    (t) => {
      ...defaultSpec(t, symbol: 'XAUUSD', timeframe: 'H1'),
      'name': t('developer.tpl.breakout.name'),
      'long': ruleSet([condition(_price(), 'crosses_above', _ind('highest', 20))]),
      'short': ruleSet([condition(_price(), 'crosses_below', _ind('lowest', 20))]),
      'sizing': {'mode': 'lots', 'lots': 0.05, 'riskPct': 1},
      'maxLots': 0.05,
      'sl': {'mode': 'atr', 'value': 1.5, 'atrPeriod': 14},
      'tp': {'mode': 'none', 'value': 0, 'atrPeriod': 14},
      'trailing': {'mode': 'atr', 'value': 2, 'atrPeriod': 14, 'breakevenTrigger': 0, 'breakevenOffset': 0},
    },
  ),
  StrategyTemplate(
    'macd',
    (t) => {
      ...defaultSpec(t, symbol: 'GBPUSD', timeframe: 'H1'),
      'name': t('developer.tpl.macd.name'),
      'long': ruleSet([
        condition(_ind('macd', 12, p2: 26, p3: 9), 'crosses_above', _ind('macd_signal', 12, p2: 26, p3: 9)),
        condition(_price(), 'gt', _ind('ema', 50), 'H4'),
      ]),
      'short': ruleSet([
        condition(_ind('macd', 12, p2: 26, p3: 9), 'crosses_below', _ind('macd_signal', 12, p2: 26, p3: 9)),
        condition(_price(), 'lt', _ind('ema', 50), 'H4'),
      ]),
      'sl': {'mode': 'pips', 'value': 30, 'atrPeriod': 14},
      'tp': {'mode': 'rr', 'value': 1.5, 'atrPeriod': 14},
      'trailing': {'mode': 'none', 'value': 0, 'atrPeriod': 14, 'breakevenTrigger': 200, 'breakevenOffset': 10},
    },
  ),
];

/// The "+ Add condition" presets (builder.tsx PRESETS): the label key (null: the plain label) and the condition.
final List<({String label, String? key, Json Function() make})> kPresets = [
  (label: 'EMA(20) crosses above EMA(50)', key: 'developer.preset.emaCross', make: () => condition(_ind('ema', 20), 'crosses_above', _ind('ema', 50))),
  (label: 'RSI(14) < 30', key: null, make: () => condition(_ind('rsi', 14), 'lt', _val(30))),
  (label: 'Close > SMA(200)', key: 'developer.preset.closeSma', make: () => condition(_price(), 'gt', _ind('sma', 200))),
  (
    label: 'MACD crosses above signal',
    key: 'developer.preset.macdCross',
    make: () => condition(_ind('macd', 12, p2: 26, p3: 9), 'crosses_above', _ind('macd_signal', 12, p2: 26, p3: 9)),
  ),
  (label: 'Close breaks 20-bar high', key: 'developer.preset.breakHigh', make: () => condition(_price(), 'crosses_above', _ind('highest', 20))),
  (label: 'Close < Bollinger lower', key: 'developer.preset.bbLower', make: () => condition(_price(), 'lt', _ind('bb_lower', 20, mult: 2))),
  (label: 'ADX(14) > 25', key: null, make: () => condition(_ind('adx', 14, p2: 14), 'gt', _val(25))),
  (
    label: 'Bullish engulfing candle',
    key: 'developer.preset.engulfing',
    make: () => condition(operand('candle', pattern: 'bullish_engulfing'), 'gte', _val(1)),
  ),
];

/* ------------------------------------------------------------------ labels (translated when a key exists) */

const Map<String, String> _opLabel = {'gt': '>', 'lt': '<', 'gte': '≥', 'lte': '≤', 'crosses_above': 'crosses above', 'crosses_below': 'crosses below'};
const Map<String, String> _fieldLabel = {'close': 'Close', 'open': 'Open', 'high': 'High', 'low': 'Low', 'hl2': 'HL/2', 'hlc3': 'HLC/3', 'ohlc4': 'OHLC/4'};
const Map<String, String> _distLabel = {
  'none': 'Off',
  'points': 'Points',
  'pips': 'Pips',
  'price': 'Price distance',
  'percent': '% of entry',
  'atr': '× ATR',
  'level': 'Fixed level',
  'rr': '× stop (R)',
};

/// Indicators with a second period, and its name (period2 label key suffix).
const Map<String, String> kTwoPeriods = {
  'macd': 'slow',
  'macd_signal': 'slow',
  'macd_hist': 'slow',
  'stoch_k': '%D',
  'stoch_d': '%D',
  'adx': 'smooth',
  'plus_di': 'smooth',
  'minus_di': 'smooth',
};

/// Indicators computed from the bar itself (no price source).
const List<String> kNoSource = ['atr', 'stoch_k', 'stoch_d', 'highest', 'lowest', 'willr', 'adx', 'plus_di', 'minus_di'];

String opLabel(T t, String o) => t.dyn('developer.op.$o', fallback: _opLabel[o] ?? o);
String fieldLabel(T t, String f) => t.dyn('developer.field.$f', fallback: _fieldLabel[f] ?? f);
String patternLabel(T t, String p) {
  final s = p.replaceAll('_', ' ');
  return t.dyn('developer.pattern.$p', fallback: s.isEmpty ? s : s[0].toUpperCase() + s.substring(1));
}

String distLabel(T t, String m) => t.dyn('developer.dist.$m', fallback: _distLabel[m] ?? m);

String _n(Object? v) {
  final d = v is num ? v : 0;
  return d == d.roundToDouble() ? d.toStringAsFixed(0) : '$d';
}

/// An operand as the builder's chip shows it: `EMA(20)`, `Close`, `30`, `Bullish engulfing`.
String operandText(T t, Json o, String Function(String key) indicatorLabel) {
  switch (o['kind']) {
    case 'value':
      return _n(o['value']);
    case 'price':
      return fieldLabel(t, '${o['field']}');
    case 'candle':
      return patternLabel(t, '${o['pattern']}');
  }
  final key = '${o['indicator']}';
  final args = [
    _n(o['period']),
    if (kTwoPeriods.containsKey(key)) _n(o['period2']),
    if (key.startsWith('macd')) _n(o['period3']),
    if (key.startsWith('bb_')) _n(o['mult']),
  ];
  return '${indicatorLabel(key)}(${args.join(', ')})';
}
