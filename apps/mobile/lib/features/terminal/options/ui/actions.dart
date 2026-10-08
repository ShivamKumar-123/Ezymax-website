// What the trader's taps send, with the web's toasts and haptics (web: positions-tab.tsx closeOptionPosition /
// closeCombo, the cancel buttons of the order lists, ticket.tsx / simple.tsx order texts). Money writes are sent once:
// a failure says why and leaves the next step to the trader.
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_error.dart';
import '../../../../core/notifications/notifications.dart';
import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/terminal_controller.dart';
import '../core/data.dart';
import '../core/errors.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/pricer.dart';
import '../core/store.dart';

void optToast(WidgetRef ref, NotificationKind kind, String title, {String? description}) =>
    ref.read(notificationsProvider.notifier).toast(kind, title, description: description);

/// "Buy 2 × EURUSD 1.0850 Call · 09 Oct" (web trader.opt.ticket.what).
String orderWhat(T t, {required String side, required num n, required String u, required String strikeLabel, required String right, required String expiry}) =>
    t('trader.opt.ticket.what', {
      'side': side == 'buy' ? t('common.buy') : t('common.sell'),
      'n': n,
      'series': '$u $strikeLabel ${right == 'call' ? t('trader.opt.call') : t('trader.opt.put')}',
      'date': expiryLabel(expiry, t.locale, withWeekday: false),
    });

/// Engine money in the account's currency → USD (cent accounts keep 100 × USD).
double? engineUsd(Object? v, bool cent) {
  final n = numOf(v);
  if (n == null) return null;
  return cent ? n / 100 : n;
}

/// Close one option position (all of it, or `n` contracts). A book-venue position closes reduce-only at market through
/// the book (a partial close says how much is still open); house positions at the house price.
Future<void> closeOptionPosition(WidgetRef ref, T t, OptPosition p, PosLive v, {double? n}) async {
  final api = ref.read(optionsApiProvider);
  if (api == null) return;
  final cent = ref.read(terminalProvider).account?.cent ?? false;
  final part = n != null && n < p.contracts;
  final want = part ? n : p.contracts;
  final u = p.option.underlying;
  final what = '$u ${strikeOf(p.option.series, p.option.strike, optionSpecs[u]?.digits ?? 5)} ${p.option.right == 'call' ? 'C' : 'P'} #${p.ticket}';
  Map<String, dynamic> d;
  try {
    d = await api.closePosition(p.ticket, contracts: part ? n : null);
  } on ApiException catch (e) {
    KHaptics.error();
    optToast(ref, NotificationKind.error, t('trader.opt.toast.closeRejected'), description: '$what · ${errText(t, e)}');
    return;
  }
  final avgPx = numOf(d['avgPrice']);
  final avg = avgPx == null ? null : t('trader.opt.bt.toast.avg', {'price': usd(avgPx * v.usdU)});
  final pr = engineUsd(d['profit'], cent);
  final desc = [what, ?avg, if (pr != null) '${usdSigned(pr)} USD'].join(' · ');
  if (d['status'] == 'partial') {
    final filled = numOr(d['filled']);
    KHaptics.medium();
    optToast(
      ref,
      NotificationKind.warning,
      t('trader.opt.toast.closedPartialBook', {'filled': qty(filled), 'total': qty(want), 'left': qty(numOf(d['left']) ?? want - filled)}),
      description: desc,
    );
    return;
  }
  final ok = pr == null || pr >= 0;
  ok ? KHaptics.success() : KHaptics.error();
  optToast(
    ref,
    ok ? NotificationKind.success : NotificationKind.error,
    part ? t('trader.opt.toast.closedPartial', {'count': n}) : t('trader.opt.toast.closed'),
    description: desc,
  );
}

/// Close a whole strategy: house prices, or a reduce-only combo RFQ through the book (`venue: book`, the net per unit).
Future<void> closeOptionCombo(WidgetRef ref, T t, String id, List<OptPosition> legs, double usdU) async {
  final api = ref.read(optionsApiProvider);
  if (api == null) return;
  final cent = ref.read(terminalProvider).account?.cent ?? false;
  Map<String, dynamic> d;
  try {
    d = await api.closeCombo(id);
  } on ApiException catch (e) {
    KHaptics.error();
    optToast(ref, NotificationKind.error, t('trader.opt.toast.closeRejected'), description: rfqErrorText(t, optCode(e), e.message));
    return;
  }
  final pr = engineUsd(d['profit'], cent);
  final ok = pr == null || pr >= 0;
  ok ? KHaptics.success() : KHaptics.error();
  if (d['venue'] == 'book') {
    var size = 0;
    for (final l in legs) {
      size = gcd(size, l.contracts.round());
    }
    if (size <= 0) size = 1;
    final net = numOf(d['net']);
    final amount = net != null && usdU > 0 ? net.abs() * usdU * size : null;
    final pnl = pr != null ? moneySigned(pr) : '—';
    var desc = amount != null
        ? t((net ?? 0) >= 0 ? 'trader.opt.pos.closedNetPaid' : 'trader.opt.pos.closedNetGot', iso({'amount': money(amount), 'pnl': pnl}))
        : (pr != null ? pnl : null);
    if (d['settling'] == true && desc != null) desc = '$desc · ${t('trader.opt.toast.settling')}';
    optToast(ref, ok ? NotificationKind.success : NotificationKind.error, t('trader.opt.toast.strategyClosedBook'), description: desc);
    return;
  }
  optToast(ref, ok ? NotificationKind.success : NotificationKind.error, t('trader.opt.toast.strategyClosed'), description: pr != null ? moneySigned(pr) : null);
}

/// Cancel a working house option order (limit premium / trigger).
Future<void> cancelHouseOrder(WidgetRef ref, T t, OptOrder o) async {
  final api = ref.read(optionsApiProvider);
  if (api == null) return;
  try {
    await api.cancelOrder(o.ticket);
  } on ApiException catch (e) {
    optToast(ref, NotificationKind.error, t('trader.opt.toast.cancelRejected'), description: errText(t, e));
    return;
  }
  optToast(ref, NotificationKind.neutral, t('trader.opt.toast.cancelled'), description: '#${o.ticket} ${o.option.series}');
}

/// Cancel a working book order.
Future<void> cancelBookOrder(WidgetRef ref, T t, BookOrder o) async {
  final api = ref.read(optionsApiProvider);
  if (api == null) return;
  try {
    await api.bookCancel(o.id);
  } on ApiException catch (e) {
    optToast(ref, NotificationKind.error, t('trader.opt.toast.cancelRejected'), description: errText(t, e));
    return;
  }
  optToast(ref, NotificationKind.neutral, t('trader.opt.toast.cancelled'), description: '#${o.id} ${o.series}');
  await ref.read(bookOrdersProvider.notifier).refresh();
}

/// The total of an order button: what the preview says is paid / received (premium ± commission).
double? previewTotal(OptPreview? p) => p == null ? null : p.netPremium.abs() + (p.netPremium >= 0 ? p.commission : -p.commission);

/// Contracts clamped to the underlying's limits and step.
int clampContracts(num v, {int min = 1, int max = 100, int step = 1}) {
  final s = step < 1 ? 1 : step;
  final r = ((v / s).round() * s).toInt();
  return math.min(max, math.max(min, r));
}
