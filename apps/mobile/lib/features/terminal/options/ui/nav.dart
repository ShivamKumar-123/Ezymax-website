// Where the options mode is on screen (web mobile.tsx tab state): the bottom-bar tab, the Chart view (Chart / Book /
// Analytics) and the Positions view (Open / Orders / Closed / Settled). Kept as providers so any panel can move the
// trader along (the selection bar opens the ticket, "View orders" opens the working orders…).
import 'package:flutter_riverpod/flutter_riverpod.dart';

class OptValue<V> extends Notifier<V> {
  OptValue(this._initial);
  final V _initial;

  @override
  V build() => _initial;

  void set(V v) => state = v;
}

/// markets | chart | chain | trade | positions (null until the first build picks Trade or Chain like the web).
final optTabProvider = NotifierProvider<OptValue<String?>, String?>(() => OptValue<String?>(null));

/// chart | book | analytics
final optChartViewProvider = NotifierProvider<OptValue<String>, String>(() => OptValue<String>('chart'));

/// open | orders | closed | settled
final optPosViewProvider = NotifierProvider<OptValue<String>, String>(() => OptValue<String>('open'));

/// Shortcuts.
extension OptNav on WidgetRef {
  void optTab(String tab) => read(optTabProvider.notifier).set(tab);
  void optPosView(String view) => read(optPosViewProvider.notifier).set(view);
  void optChartView(String view) => read(optChartViewProvider.notifier).set(view);
}
