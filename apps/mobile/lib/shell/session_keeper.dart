// Presence while the Client Area is open (web SessionGuard / AccountNotices): `POST auth/heartbeat` every 45 s and
// `GET auth/me` every 30 s, in the foreground only. A dead session is caught by the API client (401 -> sign-in).
// Not in previews or the in-app demo: the sample client has no presence to keep.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_providers.dart';
import '../core/auth/auth_api.dart';
import '../core/auth/auth_controller.dart';
import '../core/lifecycle.dart';
import '../env.dart';

class SessionKeeper extends ConsumerStatefulWidget {
  const SessionKeeper({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<SessionKeeper> createState() => _SessionKeeperState();
}

class _SessionKeeperState extends ConsumerState<SessionKeeper> {
  Timer? _heartbeat;
  Timer? _me;

  @override
  void initState() {
    super.initState();
    if (Env.preview || ref.read(demoModeProvider)) return;
    _heartbeat = Timer.periodic(const Duration(seconds: 45), (_) {
      if (ref.read(appForegroundProvider)) unawaited(ref.read(authApiProvider).heartbeat().then((_) {}, onError: (Object _) {}));
    });
    _me = Timer.periodic(const Duration(seconds: 30), (_) {
      if (ref.read(appForegroundProvider)) unawaited(ref.read(authProvider.notifier).refreshMe());
    });
  }

  @override
  void dispose() {
    _heartbeat?.cancel();
    _me?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
