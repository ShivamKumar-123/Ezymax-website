// The chart on Android: assets/chart/chart.html (lightweight-charts 5.2.1, offline) in a WebView. Commands go in
// through `window.K.recv(...)` / `window.K.batch(...)` (one call per frame), events come back on the `KalksChart`
// JavaScript channel.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'chart_bridge.dart';
import 'chart_surface.dart';

Widget webViewChartSurface(ChartSurfaceController c) => _WebViewChart(controller: c);

class _WebViewChart extends StatefulWidget {
  const _WebViewChart({required this.controller});
  final ChartSurfaceController controller;

  @override
  State<_WebViewChart> createState() => _WebViewChartState();
}

class _WebViewChartState extends State<_WebViewChart> {
  late final WebViewController _web;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..addJavaScriptChannel('KalksChart', onMessageReceived: (m) => _onMessage(m.message))
      ..setNavigationDelegate(
        NavigationDelegate(onNavigationRequest: (r) => r.url.startsWith('file:') ? NavigationDecision.navigate : NavigationDecision.prevent),
      );
    _web.loadFlutterAsset('assets/chart/chart.html');
  }

  void _onMessage(String raw) {
    final e = ChartEvent.decode(raw);
    if (e == null) return;
    if (e is ChartReady) {
      final again = _ready;
      _ready = true;
      widget.controller.attach(_run);
      // the page reloaded (the WebView's renderer restarted): the chart sends its data again
      if (again) widget.controller.emit(e);
      return;
    }
    widget.controller.emit(e);
  }

  void _run(List<String> batch) {
    // one call per batch; the JSON array is passed as a JS string literal (jsonEncode quotes and escapes it)
    final js = batch.length == 1
        ? 'window.K && window.K.recv(${jsonEncode(batch.first)})'
        : 'window.K && window.K.batch(${jsonEncode('[${batch.join(',')}]')})';
    _web.runJavaScript(js).catchError((Object _) {});
  }

  @override
  void didUpdateWidget(_WebViewChart old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller && _ready) {
      old.controller.detach();
      widget.controller.attach(_run);
    }
  }

  @override
  void dispose() {
    widget.controller.detach();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => WebViewWidget(
    controller: _web,
    // the chart pans and pinches itself; vertical drags of trade lines stay inside it too
    gestureRecognizers: const {Factory<OneSequenceGestureRecognizer>(EagerGestureRecognizer.new)},
  );
}
