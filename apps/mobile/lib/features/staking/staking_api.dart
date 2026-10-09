// Staking (Earn) data: the shapes of services/staking (README "API", client routes) served by the Client Area BFF
// apps/crm/app/api/staking/[[...path]]/route.ts, here under /api/mobile/staking/*. Plans lock wallet funds for a fixed
// term; each month the broker sets the plan's return (never promised in advance) and pays it to the wallet once the
// month is settled; the principal returns at maturity; there is no early withdrawal. Models, providers, the subscribe
// call, the error texts and the formatting the pages share.
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/format.dart';
import '../../core/lifecycle.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';

/* ------------------------------------------------------------------ parsing helpers */

double _d(Object? v, [double f = 0]) => v is num ? v.toDouble() : (double.tryParse('${v ?? ''}') ?? f);
double? _dn(Object? v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
int _i(Object? v, [int f = 0]) => v is num ? v.toInt() : (int.tryParse('${v ?? ''}') ?? f);
String _s(Object? v, [String f = '']) => v == null ? f : '$v';
String? _sn(Object? v) => v == null || '$v'.isEmpty ? null : '$v';
bool _b(Object? v, [bool f = false]) => v is bool ? v : f;
DateTime? _dt(Object? v) => v is String && v.isNotEmpty ? DateTime.tryParse(v) : null;
Map<String, dynamic> _m(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};
List<Map<String, dynamic>> _l(Object? v) => v is List ? [for (final e in v.whereType<Map<dynamic, dynamic>>()) e.cast<String, dynamic>()] : const [];

/* ------------------------------------------------------------------ service shapes */

/// The return of one settled month (`period` "2026-09").
class StakingRate {
  const StakingRate(this.period, this.ratePct);
  final String period;
  final double ratePct;

  factory StakingRate.fromJson(Map<String, dynamic> j) => StakingRate(_s(j['period']), _d(j['ratePct']));
}

class StakingPlan {
  const StakingPlan({
    required this.id,
    required this.name,
    required this.currency,
    required this.status,
    required this.termMonths,
    required this.minAmount,
    required this.maxAmount,
    required this.perUserMax,
    required this.capacityLeft,
    required this.full,
    required this.invested,
    required this.maxNow,
    required this.description,
    required this.riskText,
    required this.version,
    required this.recentRates,
  });

  final int id;
  final String name, currency;

  /// active | paused (only active is sold).
  final String status;
  final int termMonths;
  final double minAmount;

  /// Per subscription, per client, the plan's capacity: null = no limit.
  final double? maxAmount, perUserMax, capacityLeft;
  final bool full;

  /// What this client already holds in the plan.
  final double invested;

  /// The most this client can still subscribe now (every limit applied); null = no limit.
  final double? maxNow;
  final String description, riskText;
  final int version;

  /// Settled months only (rates are never promised in advance).
  final List<StakingRate> recentRates;

  bool get paused => status != 'active';

  /// Open for a new subscription: active, not full, and room for at least the minimum.
  bool get open => !paused && !full && (maxNow == null || maxNow! >= minAmount);

  factory StakingPlan.fromJson(Map<String, dynamic> j) => StakingPlan(
    id: _i(j['id']),
    name: _s(j['name']),
    currency: _s(j['currency'], 'USDT'),
    status: _s(j['status'], 'active'),
    termMonths: _i(j['termMonths']),
    minAmount: _d(j['minAmount']),
    maxAmount: _dn(j['maxAmount']),
    perUserMax: _dn(j['perUserMax']),
    capacityLeft: _dn(j['capacityLeft']),
    full: _b(j['full']),
    invested: _d(j['invested']),
    maxNow: _dn(j['maxNow']),
    description: _s(j['description']),
    riskText: _s(j['riskText']),
    version: _i(j['version'], 1),
    recentRates: [for (final r in _l(j['recentRates'])) StakingRate.fromJson(r)],
  );
}

class StakingPlans {
  const StakingPlans({required this.plans, required this.currencies, required this.currentPeriod, required this.nextPayoutAfter, required this.serverTime});
  final List<StakingPlan> plans;
  final List<String> currencies;
  final String currentPeriod;
  final DateTime? nextPayoutAfter, serverTime;

  factory StakingPlans.fromJson(Map<String, dynamic> j) => StakingPlans(
    plans: [for (final p in _l(j['plans'])) StakingPlan.fromJson(p)],
    currencies: [
      for (final c in (j['currencies'] is List ? j['currencies'] as List : const ['USDT'])) '$c',
    ],
    currentPeriod: _s(j['currentPeriod']),
    nextPayoutAfter: _dt(j['nextPayoutAfter']),
    serverTime: _dt(j['serverTime']),
  );
}

/// The latest paid return of a position.
class StakingLastReturn {
  const StakingLastReturn({required this.period, required this.ratePct, required this.amount});
  final String period;
  final double ratePct, amount;

  factory StakingLastReturn.fromJson(Map<String, dynamic> j) => StakingLastReturn(period: _s(j['period']), ratePct: _d(j['ratePct']), amount: _d(j['amount']));
}

class StakingPosition {
  const StakingPosition({
    required this.id,
    required this.planId,
    required this.planName,
    required this.currency,
    required this.termMonths,
    required this.principal,
    required this.status,
    required this.startedAt,
    required this.maturesAt,
    required this.maturedAt,
    required this.returnsPaid,
    required this.daysTotal,
    required this.daysElapsed,
    required this.failureReason,
    required this.lastReturn,
    required this.termsAcceptedAt,
    required this.riskAcknowledgedAt,
    required this.createdAt,
  });

  final int id, planId;
  final String planName, currency;
  final int termMonths;
  final double principal;

  /// pending_payment | payment_failed | active | matured.
  final String status;
  final DateTime? startedAt, maturesAt, maturedAt;
  final double returnsPaid;
  final int daysTotal, daysElapsed;
  final String? failureReason;
  final StakingLastReturn? lastReturn;
  final DateTime? termsAcceptedAt, riskAcknowledgedAt, createdAt;

  /// Share of the term behind it (0..1).
  double get progress => daysTotal > 0 ? (daysElapsed / daysTotal).clamp(0.0, 1.0) : (status == 'matured' ? 1 : 0);

  factory StakingPosition.fromJson(Map<String, dynamic> j) => StakingPosition(
    id: _i(j['id']),
    planId: _i(j['planId']),
    planName: _s(j['planName']),
    currency: _s(j['currency'], 'USDT'),
    termMonths: _i(j['termMonths']),
    principal: _d(j['principal']),
    status: _s(j['status'], 'pending_payment'),
    startedAt: _dt(j['startedAt']),
    maturesAt: _dt(j['maturesAt']),
    maturedAt: _dt(j['maturedAt']),
    returnsPaid: _d(j['returnsPaid']),
    daysTotal: _i(j['daysTotal']),
    daysElapsed: _i(j['daysElapsed']),
    failureReason: _sn(j['failureReason']),
    lastReturn: j['lastReturn'] is Map ? StakingLastReturn.fromJson(_m(j['lastReturn'])) : null,
    termsAcceptedAt: _dt(j['termsAcceptedAt']),
    riskAcknowledgedAt: _dt(j['riskAcknowledgedAt']),
    createdAt: _dt(j['createdAt']),
  );
}

class StakingSummary {
  const StakingSummary({
    required this.currency,
    required this.invested,
    required this.pending,
    required this.returnsPaid,
    required this.returnsThisYear,
    required this.activePositions,
    required this.nextPayoutPeriod,
    required this.nextPayoutAfter,
    required this.nextMaturity,
  });
  final String currency;
  final double invested, pending, returnsPaid, returnsThisYear;
  final int activePositions;

  /// The month whose return is paid next (null: nothing earning).
  final String? nextPayoutPeriod;
  final DateTime? nextPayoutAfter;
  final ({int positionId, String planName, DateTime? date, double principal})? nextMaturity;

  factory StakingSummary.fromJson(Map<String, dynamic> j) {
    final np = j['nextPayout'] is Map ? _m(j['nextPayout']) : null;
    final nm = j['nextMaturity'] is Map ? _m(j['nextMaturity']) : null;
    return StakingSummary(
      currency: _s(j['currency'], 'USDT'),
      invested: _d(j['invested']),
      pending: _d(j['pending']),
      returnsPaid: _d(j['returnsPaid']),
      returnsThisYear: _d(j['returnsThisYear']),
      activePositions: _i(j['activePositions']),
      nextPayoutPeriod: np == null ? null : _sn(np['period']),
      nextPayoutAfter: np == null ? null : _dt(np['after']),
      nextMaturity: nm == null ? null : (positionId: _i(nm['positionId']), planName: _s(nm['planName']), date: _dt(nm['date']), principal: _d(nm['principal'])),
    );
  }
}

class StakingPortfolio {
  const StakingPortfolio({required this.summary, required this.positions, required this.monthly, required this.serverTime});
  final StakingSummary summary;
  final List<StakingPosition> positions;

  /// Returns credited per month, oldest first (at most 12).
  final List<({String period, double amount})> monthly;
  final DateTime? serverTime;

  factory StakingPortfolio.fromJson(Map<String, dynamic> j) => StakingPortfolio(
    summary: StakingSummary.fromJson(_m(j['summary'])),
    positions: [for (final p in _l(j['positions'])) StakingPosition.fromJson(p)],
    monthly: [for (final m in _l(j['monthly'])) (period: _s(m['period']), amount: _d(m['amount']))],
    serverTime: _dt(j['serverTime']),
  );
}

/// The plan as the client accepted it (the position keeps it even when the plan changes later).
class StakingTerms {
  const StakingTerms({
    required this.name,
    required this.termMonths,
    required this.currency,
    required this.minAmount,
    required this.maxAmount,
    required this.description,
    required this.riskText,
  });
  final String name;
  final int termMonths;
  final String currency;
  final double minAmount;
  final double? maxAmount;
  final String description, riskText;

  factory StakingTerms.fromJson(Map<String, dynamic> j) => StakingTerms(
    name: _s(j['name']),
    termMonths: _i(j['termMonths']),
    currency: _s(j['currency'], 'USDT'),
    minAmount: _d(j['minAmount']),
    maxAmount: _dn(j['maxAmount']),
    description: _s(j['description']),
    riskText: _s(j['riskText']),
  );
}

/// One month's return of a position.
class StakingReturn {
  const StakingReturn({
    required this.period,
    required this.ratePct,
    required this.daysActive,
    required this.daysInMonth,
    required this.amount,
    required this.status,
    required this.paidAt,
  });
  final String period;
  final double ratePct;
  final int daysActive, daysInMonth;
  final double amount;

  /// paid | pending | processing.
  final String status;
  final DateTime? paidAt;

  factory StakingReturn.fromJson(Map<String, dynamic> j) => StakingReturn(
    period: _s(j['period']),
    ratePct: _d(j['ratePct']),
    daysActive: _i(j['daysActive']),
    daysInMonth: _i(j['daysInMonth']),
    amount: _d(j['amount']),
    status: _s(j['status'], 'pending'),
    paidAt: _dt(j['paidAt']),
  );
}

/// GET positions/{id} and the answer of POST positions.
class StakingPositionDetail {
  const StakingPositionDetail({required this.position, required this.terms, required this.returns});
  final StakingPosition position;
  final StakingTerms terms;
  final List<StakingReturn> returns;

  factory StakingPositionDetail.fromJson(Map<String, dynamic> j) => StakingPositionDetail(
    position: StakingPosition.fromJson(_m(j['position'])),
    terms: StakingTerms.fromJson(_m(j['terms'])),
    returns: [for (final r in _l(j['returns'])) StakingReturn.fromJson(r)],
  );
}

class StakingEvent {
  const StakingEvent({
    required this.kind,
    required this.at,
    required this.positionId,
    required this.planName,
    required this.amount,
    required this.currency,
    required this.period,
    required this.ratePct,
    required this.days,
  });

  /// subscribe | reward | principal | payment_failed.
  final String kind;
  final DateTime? at;
  final int positionId;
  final String planName;
  final double amount;
  final String currency;
  final String? period;
  final double? ratePct;
  final int? days;

  /// The amount as the wallet saw it: out for a subscription, in for a return or the principal, nothing moved for a
  /// failed payment (0 sign).
  int get sign => switch (kind) {
    'subscribe' => -1,
    'reward' || 'principal' => 1,
    _ => 0,
  };

  factory StakingEvent.fromJson(Map<String, dynamic> j) => StakingEvent(
    kind: _s(j['kind']),
    at: _dt(j['at']),
    positionId: _i(j['positionId']),
    planName: _s(j['planName']),
    amount: _d(j['amount']),
    currency: _s(j['currency'], 'USDT'),
    period: _sn(j['period']),
    ratePct: _dn(j['ratePct']),
    days: j['days'] == null ? null : _i(j['days']),
  );
}

class StakingHistoryPage {
  const StakingHistoryPage({required this.items, required this.total, required this.page, required this.limit});
  final List<StakingEvent> items;
  final int total, page, limit;

  int get pages => limit <= 0 ? 1 : math.max(1, (total + limit - 1) ~/ limit);

  factory StakingHistoryPage.fromJson(Map<String, dynamic> j) => StakingHistoryPage(
    items: [for (final e in _l(j['items'])) StakingEvent.fromJson(e)],
    total: _i(j['total']),
    page: _i(j['page'], 1),
    limit: _i(j['limit'], kStakingHistoryPer),
  );
}

/* ------------------------------------------------------------------ providers */

/// History rows per page.
const int kStakingHistoryPer = 20;

/// GET plans (every 60 s: capacity and room change as other clients subscribe).
final stakingPlansProvider = FutureProvider.autoDispose<StakingPlans>((ref) async {
  ref.pollEvery(const Duration(seconds: 60));
  return StakingPlans.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('staking/plans'));
});

/// GET portfolio (every 30 s: a pending payment turns active, returns are credited).
final stakingPortfolioProvider = FutureProvider.autoDispose<StakingPortfolio>((ref) async {
  ref.pollEvery(const Duration(seconds: 30));
  return StakingPortfolio.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('staking/portfolio'));
});

/// GET positions/{id} (every 15 s while open: a pending payment usually confirms within moments).
final stakingPositionProvider = FutureProvider.autoDispose.family<StakingPositionDetail, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 15));
  return StakingPositionDetail.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('staking/positions/$id'));
});

/// GET history?page&limit (every 60 s).
final stakingHistoryProvider = FutureProvider.autoDispose.family<StakingHistoryPage, int>((ref, page) async {
  ref.pollEvery(const Duration(seconds: 60));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('staking/history', query: {'page': page, 'limit': kStakingHistoryPer});
  return StakingHistoryPage.fromJson(j);
});

/// POST positions: subscribes `amount` (a decimal string, at most 2 decimals) of the wallet to the plan, after the
/// client accepted the terms and the risk acknowledgement. Never retried on its own; a retry by the client reuses
/// the same key, so a retry after a network error never subscribes twice.
Future<StakingPositionDetail> subscribeStaking(ApiClient api, {required int planId, required String amount, required String key}) async {
  final j = await api.post<Map<String, dynamic>>(
    'staking/positions',
    body: {'planId': planId, 'amount': amount, 'idempotencyKey': key, 'acceptTerms': true, 'acceptRisk': true},
  );
  return StakingPositionDetail.fromJson(j);
}

/// A fresh idempotency key: 1–80 of [A-Za-z0-9_-] (the service's rule).
String newStakingKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final r = math.Random.secure();
  return 'stk-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-${List.generate(20, (_) => chars[r.nextInt(chars.length)]).join()}';
}

/* ------------------------------------------------------------------ errors */

/// Codes with a next step outside the page: (href, label key).
const Map<String, (String href, String labelKey)> kStakingErrorLink = {
  'kyc_required': ('/profile/verification', 'staking.errorLink.verify'),
  'insufficient_funds': ('/wallet/deposit', 'staking.errorLink.deposit'),
};

const Map<String, String> _errorKey = {
  'kyc_required': 'staking.error.kycRequired',
  'wallet_restricted': 'staking.error.walletRestricted',
  'account_unavailable': 'staking.error.accountUnavailable',
  'insufficient_funds': 'staking.error.insufficientFunds',
  'plan_unavailable': 'staking.error.planUnavailable',
  'capacity_reached': 'staking.error.capacityReached',
  'user_limit': 'staking.error.userLimit',
  'below_minimum': 'staking.error.belowMinimum',
  'above_maximum': 'staking.error.aboveMaximum',
  'terms_required': 'staking.error.termsRequired',
  'risk_ack_required': 'staking.error.riskRequired',
  'payment_pending': 'staking.error.paymentPending',
  'payment_failed': 'staking.error.paymentFailed',
  'idempotency_conflict': 'staking.error.idempotencyConflict',
  'unavailable': 'staking.error.unavailable',
};

String stakingErrorCode(Object? e) => e is ApiException ? (e.isNetwork ? 'network' : e.code) : 'error';

/// The reader's text for a failed staking call: the known codes translated, network errors, else the generic text.
String stakingErrorText(Object? e, T t) {
  if (e is! ApiException) return t('staking.error.generic');
  if (e.isNetwork) return t('staking.error.network');
  final key = _errorKey[e.code];
  return key != null ? t(key) : t('staking.error.generic');
}

/// An informational outcome, not a refusal: the wallet hasn't confirmed yet (retried by the service).
bool stakingErrorSoft(Object? e) => stakingErrorCode(e) == 'payment_pending';

/// The request may have reached the service (no answer, still being paid, or a server error): the same amount must
/// be sent again with the same key, so the amount is locked.
bool stakingOutcomeUnknown(Object? e) => e is ApiException && (e.isNetwork || e.code == 'payment_pending' || e.status >= 500);

/// The wallet refused the payment: the position ended as payment_failed and nothing was charged, so the next attempt
/// may use a new key (the old one would answer the same failure).
bool stakingPaymentRefused(Object? e) => e is ApiException && (e.code == 'payment_failed' || e.code == 'insufficient_funds');

/* ------------------------------------------------------------------ amounts */

/// The amount typed in the field ("1,000.5" or "1000,50"), or null when it isn't a number with at most 2 decimals.
double? parseStakingAmount(String raw) {
  final s = raw.trim().replaceAll(' ', '');
  if (s.isEmpty) return null;
  // one decimal separator (dot or comma); grouping commas when a dot is the separator
  final normal = s.contains('.') ? s.replaceAll(',', '') : s.replaceAll(',', '.');
  if (!RegExp(r'^\d+(\.\d{0,2})?$').hasMatch(normal)) return null;
  return double.tryParse(normal);
}

/// The amount as the service takes it: a plain decimal string ("1000", "1000.5").
String stakingAmountString(double v) {
  var s = v.toStringAsFixed(2);
  if (s.contains('.')) s = s.replaceFirst(RegExp(r'\.?0+$'), '');
  return s;
}

/// The most the client can subscribe to the plan now (null: no limit).
double? stakingCap(StakingPlan p) => p.maxNow ?? p.maxAmount;

enum StakingAmountIssue { empty, belowMin, aboveMax }

/// What is wrong with the amount for this plan, or null when it can be subscribed.
StakingAmountIssue? stakingAmountIssue(StakingPlan p, double? amount) {
  if (amount == null || amount <= 0) return StakingAmountIssue.empty;
  if (amount + 1e-9 < p.minAmount) return StakingAmountIssue.belowMin;
  final cap = stakingCap(p);
  if (cap != null && amount > cap + 1e-9) return StakingAmountIssue.aboveMax;
  return null;
}

/// The amount Max fills in: everything the plan still takes, within the wallet balance; whole cents, rounded down.
double? stakingMaxFill(StakingPlan p, double? available) {
  final cap = stakingCap(p);
  final v = cap == null ? available : (available == null ? cap : math.min(cap, available));
  if (v == null || v <= 0) return null;
  return (v * 100).floorToDouble() / 100;
}

/* ------------------------------------------------------------------ formatting */

/// "1,000.00 USDT" ({amount} in the staking texts).
String stakingMoney(num v, String currency) => Fmt.money(v, currency: currency);

/// Figures stay left to right inside right-to-left text: an LTR isolate around them in Arabic, Urdu and Persian
/// (otherwise "1,000.00 USDT" reads "USDT 1,000.00" and "1.20%" reads "%1.20").
String stakingLtr(T t, String s) => t.rtl ? '\u2066$s\u2069' : s;

/// [stakingMoney] for the pages: kept left to right in right-to-left text.
String stakingAmount(T t, num v, String currency) => stakingLtr(t, stakingMoney(v, currency));

/// "+12.50 USDT" / "-1,000.00 USDT" / "1,000.00 USDT" (sign 0).
String stakingSigned(num v, String currency, int sign) => '${sign > 0 ? '+' : (sign < 0 ? '-' : '')}${Fmt.money(v.abs(), currency: currency)}';

/// "1.20%": two decimals in the reader's language, Latin digits.
String stakingRate(T t, num v) => stakingLtr(t, LocaleFormat(t.locale).percent(v));

final Map<String, DateFormat> _monthFormats = {};

/// "2026-09" -> "Sep 2026" in the reader's language (the raw period when it isn't one).
String stakingMonth(T t, String? period) {
  if (period == null || period.isEmpty) return '—';
  final m = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(period);
  if (m == null) return period;
  final tag = intlLocale(t.locale);
  final f = _monthFormats.putIfAbsent(tag, () => DateFormat.yMMM(tag));
  return latinDigits(f.format(DateTime.utc(int.parse(m[1]!), int.parse(m[2]!))));
}

/// "Sep 24, 2026" in the reader's language (server time); "—" when missing.
String stakingDate(T t, DateTime? d) => d == null ? '—' : LocaleFormat(t.locale).date(d);

/// "6 months".
String stakingTerm(T t, int months) => t('staking.plan.term', {'count': months});

/// When a subscription made at `now` matures: the same calendar day `months` later at 00:00 server time (the last
/// day of a shorter month), as the service counts it.
DateTime stakingMaturity(DateTime now, int months) {
  final s = toServerTime(now);
  final index = s.month - 1 + months;
  final y = s.year + index ~/ 12, m = index % 12 + 1;
  final last = DateTime.utc(y, m + 1, 0).day;
  return DateTime.utc(y, m, math.min(s.day, last)).subtract(kServerOffset);
}

KChipTone stakingStatusTone(String s) => switch (s) {
  'active' => KChipTone.up,
  'pending_payment' => KChipTone.warn,
  'payment_failed' => KChipTone.down,
  'matured' => KChipTone.info,
  _ => KChipTone.neutral,
};

String stakingStatusLabel(T t, String s) => t.dyn('staking.status.$s', fallback: s.replaceAll('_', ' '));

KChipTone stakingReturnTone(String s) => switch (s) {
  'paid' => KChipTone.up,
  'processing' => KChipTone.info,
  _ => KChipTone.warn,
};

String stakingReturnLabel(T t, String s) => t.dyn('staking.return.$s', fallback: s);

IconData stakingEventIcon(String kind) => switch (kind) {
  'subscribe' => LucideIcons.lock,
  'reward' => LucideIcons.coins,
  'principal' => LucideIcons.undo2,
  'payment_failed' => LucideIcons.circleX,
  _ => LucideIcons.piggyBank,
};

KTone stakingEventTone(String kind) => switch (kind) {
  'subscribe' => KTone.lavender,
  'reward' => KTone.mint,
  'principal' => KTone.sky,
  'payment_failed' => KTone.coral,
  _ => KTone.neutral,
};
