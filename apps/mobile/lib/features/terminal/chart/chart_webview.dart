// The chart on Android, in a WebView. Commands go in through `window.K.recv(...)` / `window.K.batch(...)` (one
// call per frame), events come back on the `EzymexChart` JavaScript channel.
//
// Two pages answer that bridge and the app does not care which: the licensed TradingView library
// (assets/chart/tv-chart.html, the same chart the web terminal runs) when the build has it, and
// assets/chart/chart.html (lightweight-charts, offline) when it does not. TradingView runs part of itself in
// an iframe and so needs a real origin, which file:// cannot give it; chart_server.dart serves the app's own
// assets over loopback for it. The fallback page keeps loading straight from the asset, as it always did.
//
// Neither page fetches anything. Every bar, tick and line comes from Flutter over the bridge, so whichever is
// drawing, the prices are the ones the rest of the app is using.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'chart_bridge.dart';
import 'chart_server.dart';
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
      ..addJavaScriptChannel('EzymexChart', onMessageReceived: (m) => _onMessage(m.message))
      ..setNavigationDelegate(
        // the chart's own two origins and nothing else: a page that tries to navigate away is stopped
        NavigationDelegate(onNavigationRequest: (r) => r.url.startsWith('file:') || r.url.startsWith('http://127.0.0.1:') ? NavigationDecision.navigate : NavigationDecision.prevent),
      );
    unawaited(_load());
  }

  /// TradingView where the build has it, the app's own chart where it does not - and also where the loopback
  /// server could not start, because a chart that draws is worth more than the one we would rather draw.
  Future<void> _load() async {
    final server = ChartServer.instance;
    if (await server.hasTradingView) {
      final base = await server.base();
      if (base != null && mounted) return _web.loadRequest(base.resolve('tv-chart.html'));
    }
    if (mounted) await _web.loadFlutterAsset('assets/chart/chart.html');
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
