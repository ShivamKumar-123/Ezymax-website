// A loopback HTTP server for the chart's WebView, serving the app's own `assets/chart/` directory.
//
// The chart used to load straight from `file://`, which is enough for a single self-contained page. The
// licensed TradingView library is not that: it loads several thousand bundles of its own and runs part of
// itself in an iframe, and a `file://` document has an opaque origin, so the frames cannot reach each other
// and the library never finishes starting. Served over http on 127.0.0.1 it has a real origin and behaves
// exactly as it does on the web terminal.
//
// Nothing leaves the phone. The socket is bound to the loopback address on a port the system picks, so it is
// not reachable from the network, and every byte it serves comes out of the APK. The chart's data still
// arrives over the Flutter bridge, not over this - the server carries the library, never the prices.

import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Where the chart's files live in the bundle.
const String _root = 'assets/chart';

/// The licensed library's entry point. Absent from a build whose `scripts/sync-assets.mjs` had no copy of it,
/// exactly as on the terminal, and then the app draws its own chart instead.
const String tvEntry = '$_root/tv/charting_library.standalone.js';

const Map<String, String> _types = {
  'html': 'text/html; charset=utf-8',
  'js': 'text/javascript; charset=utf-8',
  'mjs': 'text/javascript; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'json': 'application/json; charset=utf-8',
  'svg': 'image/svg+xml',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'gif': 'image/gif',
  'woff2': 'font/woff2',
  'woff': 'font/woff',
  'ttf': 'font/ttf',
  'cur': 'image/x-icon',
  'ico': 'image/x-icon',
  'txt': 'text/plain; charset=utf-8',
};

String _typeOf(String path) {
  final dot = path.lastIndexOf('.');
  return dot < 0 ? 'application/octet-stream' : (_types[path.substring(dot + 1).toLowerCase()] ?? 'application/octet-stream');
}

class ChartServer {
  ChartServer._();

  static final ChartServer instance = ChartServer._();

  HttpServer? _server;
  Future<Uri?>? _starting;
  bool? _hasTv;

  /// Whether the licensed library is in this build.
  Future<bool> get hasTradingView async {
    if (_hasTv != null) return _hasTv!;
    try {
      await rootBundle.load(tvEntry);
      _hasTv = true;
    } catch (_) {
      _hasTv = false;
    }
    return _hasTv!;
  }

  /// The base URL, starting the server on first use. Null when it cannot be started, which leaves the caller
  /// to fall back to the file:// chart rather than show nothing.
  Future<Uri?> base() => _starting ??= _start();

  Future<Uri?> _start() async {
    try {
      final s = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      _server = s;
      s.listen(_serve, onError: (Object e) => debugPrint('chart server: $e'));
      return Uri.parse('http://${s.address.address}:${s.port}/');
    } catch (e) {
      debugPrint('chart server could not start: $e');
      _starting = null;
      return null;
    }
  }

  Future<void> _serve(HttpRequest req) async {
    final res = req.response;
    try {
      if (req.method != 'GET' && req.method != 'HEAD') {
        res.statusCode = HttpStatus.methodNotAllowed;
        return await res.close();
      }
      // The path is resolved against the chart directory and then checked to be still inside it, so a request
      // dressed up with `..` cannot read the rest of the bundle.
      final rel = Uri.decodeComponent(req.uri.path).replaceFirst(RegExp(r'^/+'), '');
      final path = _normalise('$_root/${rel.isEmpty ? 'chart.html' : rel}');
      if (path == null) {
        res.statusCode = HttpStatus.forbidden;
        return await res.close();
      }
      final ByteData data;
      try {
        data = await rootBundle.load(path);
      } catch (_) {
        res.statusCode = HttpStatus.notFound;
        return await res.close();
      }
      res.headers
        ..contentType = ContentType.parse(_typeOf(path))
        // it all ships inside the APK, so it is as immutable as the build itself
        ..set(HttpHeaders.cacheControlHeader, 'public, max-age=31536000, immutable')
        ..set('X-Content-Type-Options', 'nosniff');
      if (req.method == 'HEAD') {
        res.contentLength = data.lengthInBytes;
        return await res.close();
      }
      res.add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
      await res.close();
    } catch (e) {
      debugPrint('chart server: $e');
      try {
        await res.close();
      } catch (_) {
        // the client went away mid-response; there is nothing left to tell
      }
    }
  }

  /// `assets/chart/...` with `.` and `..` resolved, or null when it climbs out of the chart directory.
  static String? _normalise(String path) {
    final out = <String>[];
    for (final part in path.split('/')) {
      if (part.isEmpty || part == '.') continue;
      if (part == '..') {
        if (out.isEmpty) return null;
        out.removeLast();
        continue;
      }
      out.add(part);
    }
    final joined = out.join('/');
    return joined.startsWith('$_root/') ? joined : null;
  }

  @visibleForTesting
  static String? normaliseForTest(String path) => _normalise(path);

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
    _starting = null;
  }
}
