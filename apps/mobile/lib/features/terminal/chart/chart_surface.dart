// Where the chart is drawn. On Android: the bundled lightweight-charts page in a WebView (chart_webview.dart). On the
// web preview and in widget tests: a small native painter that understands the same commands (chart_native.dart),
// because webview_flutter has no web implementation. Both take ChartCmd JSON and report ChartEvents.
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../../../ui/ui.dart';
import 'chart_bridge.dart';
import 'chart_native.dart';
import 'chart_webview_stub.dart' if (dart.library.io) 'chart_webview.dart';

/// Sends commands to a surface and receives its events. Commands sent before the surface is ready are queued.
class ChartSurfaceController {
  final List<String> _queue = [];
  void Function(String json)? _sink;

  /// Gestures and requests from the chart.
  void Function(ChartEvent e)? onEvent;

  /// The last `init`, replayed to a surface that (re)attaches.
  String? lastInit;

  void send(String json) {
    if (json.startsWith('{"type":"init"')) {
      lastInit = json;
      _queue.clear();
    }
    final s = _sink;
    if (s == null) {
      _queue.add(json);
    } else {
      s(json);
    }
  }

  /// Called by the surface when it can draw.
  void attach(void Function(String json) sink) {
    _sink = sink;
    final pending = [..._queue];
    _queue.clear();
    if (lastInit != null && (pending.isEmpty || pending.first != lastInit)) sink(lastInit!);
    for (final m in pending) {
      sink(m);
    }
  }

  void detach() => _sink = null;

  void emit(ChartEvent e) => onEvent?.call(e);
}

/// The surface widget for this platform.
Widget chartSurface(ChartSurfaceController c, {bool native = false}) => native || kIsWeb ? NativeChartSurface(controller: c) : webViewChartSurface(c);

String _hex(Color c) {
  final v = c.toARGB32();
  return '#${(v & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
}

String _rgba(Color c) => 'rgba(${(c.r * 255).round()},${(c.g * 255).round()},${(c.b * 255).round()},${c.a.toStringAsFixed(3)})';

/// The chart colours of the terminal theme (web --t-chart-bg, --t-grid, --k-*).
ChartPalette chartPalette(KTokens k) => ChartPalette(
  dark: k.dark,
  bg: k.dark ? '#0a0a0d' : '#ffffff',
  grid: k.dark ? 'rgba(255,255,255,0.035)' : 'rgba(15,15,20,0.055)',
  line: k.dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,15,20,0.1)',
  up: _hex(k.up),
  down: _hex(k.down),
  gold: _hex(k.gold),
  warn: _hex(k.warn),
  ember: _hex(k.ember),
  fg: _hex(k.fg),
  fg2: _hex(k.fg2),
  fg3: _hex(k.fg3),
  label: k.dark ? '#26262e' : '#55555f',
  panel: _rgba(k.surface2.withValues(alpha: 1)),
);
