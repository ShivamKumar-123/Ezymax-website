// Price alerts while the terminal is open (web store: alerts fire once when the bid crosses the price): a banner, a
// sound when sounds are on, and the alert switches off.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../core/market.dart';
import '../core/trade_math.dart';
import '../core/workspace.dart';

class AlertsWatcher extends ConsumerStatefulWidget {
  const AlertsWatcher({super.key});

  @override
  ConsumerState<AlertsWatcher> createState() => _AlertsWatcherState();
}

class _AlertsWatcherState extends ConsumerState<AlertsWatcher> {
  void Function()? _unsub;
  String _key = '';

  @override
  void dispose() {
    _unsub?.call();
    super.dispose();
  }

  void _check(TQuote q) {
    final ws = ref.read(workspaceProvider);
    for (final a in ws.alerts) {
      if (!a.active || a.symbol != q.symbol) continue;
      final hit = a.cond == 'above' ? q.bid >= a.price : q.bid <= a.price;
      if (!hit) continue;
      ref.read(workspaceProvider.notifier).updateAlert(a.id, active: false);
      final t = ref.read(tProvider);
      final digits = ref.read(symbolBookProvider)[a.symbol]?.digits ?? 5;
      ref
          .read(notificationsProvider.notifier)
          .push(
            title: t('order.toast.alert', {'symbol': a.symbol, 'cond': t('order.toast.alertCond.${a.cond}'), 'price': fmtPrice(digits, a.price)}),
            body: t('order.toast.alertBid', {'price': fmtPrice(digits, q.bid)}),
            severity: 'warning',
            category: 'trading_alerts',
          );
      if (ws.sound) unawaited(SystemSound.play(SystemSoundType.alert));
    }
  }

  @override
  Widget build(BuildContext context) {
    final symbols = ref.watch(workspaceProvider.select((w) => {for (final a in w.alerts.where((a) => a.active)) a.symbol}.toList()..sort()));
    final key = symbols.join(',');
    if (key != _key) {
      _key = key;
      _unsub?.call();
      _unsub = symbols.isEmpty ? null : ref.read(marketFeedProvider).subscribe(symbols, _check);
    }
    return const SizedBox.shrink();
  }
}
