import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// True while the app is in the foreground (set by the app's lifecycle observer).
class AppForeground extends Notifier<bool> {
  @override
  bool build() => true;
  void set(bool v) {
    if (v != state) state = v;
  }
}

final appForegroundProvider = NotifierProvider<AppForeground, bool>(AppForeground.new);

extension PollRef on Ref {
  /// Refetches this provider every `every` while it is listened to and the app is in the foreground (the web's
  /// usePoll: polls only while the tab is visible). The previous value stays on screen while it refreshes.
  void pollEvery(Duration every) {
    Timer? timer;
    void arm() {
      timer?.cancel();
      timer = Timer(every, () {
        if (read(appForegroundProvider)) {
          invalidateSelf();
        } else {
          arm();
        }
      });
    }

    arm();
    onDispose(() => timer?.cancel());
  }
}
