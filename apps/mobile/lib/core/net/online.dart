// Whether the device has a network at all.
//
// Nothing in the app asked this before: a client on a train watched pages fail one at a time with no idea
// why, and nothing came back by itself when the signal did - every screen waited to be pulled down again.
//
// connectivity_plus reports the interface, not reachability: "connected to Wi-Fi" is not "the internet
// works". So this is used for the one thing it answers honestly - there is definitely no network - which is
// enough to say so plainly and to know the moment that changes.
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// True unless every interface is gone. Starts true: an app that flashed "offline" on launch, before the
/// first reading arrives, would cry wolf.
final onlineProvider = StreamProvider<bool>((ref) async* {
  final c = Connectivity();
  bool up(List<ConnectivityResult> r) => r.any((x) => x != ConnectivityResult.none);
  try {
    yield up(await c.checkConnectivity());
    yield* c.onConnectivityChanged.map(up);
  } catch (_) {
    // No platform implementation - a widget test, or a host the plugin does not cover. Not knowing is not
    // the same as being offline, and claiming otherwise would put the strip over every screen.
    yield true;
  }
});
