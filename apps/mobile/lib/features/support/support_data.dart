// Shared plumbing of the Support module: the support stream's frames for the chat, Ask Ezymex AI and the launcher;
// the file picker of the chat's paperclip (injectable for tests); attachment downloads; the launcher's unread badge.
import 'dart:async';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/files.dart';
import '../../core/notifications/notifications.dart';
import '../../core/realtime/socket.dart';
import '../../core/realtime/support_stream.dart';
import 'support_models.dart';

/// The frames of the support stream (web lib/realtime.ts subscribers), plus frames the app adds itself with `add`
/// (tests and the screenshot harness play a streamed answer that way). `live` is false without a connected socket
/// (previews, tests, view-only, a dropped connection): the chat and Ask Ezymex AI then poll instead.
class SupportFrames {
  SupportFrames(this.socket);
  final SupportStream? socket;
  final StreamController<Map<String, dynamic>> _local = StreamController.broadcast();

  bool get live => socket?.status == SocketStatus.open;

  void add(Map<String, dynamic> frame) {
    if (!_local.isClosed) _local.add(frame);
  }

  /// Calls `onFrame` for every frame; returns the function that stops listening.
  void Function() listen(void Function(Map<String, dynamic> frame) onFrame) {
    final a = socket?.frames.listen(onFrame);
    final b = _local.stream.listen(onFrame);
    return () {
      unawaited(a?.cancel());
      unawaited(b.cancel());
    };
  }

  Future<void> dispose() => _local.close();
}

final supportFramesProvider = Provider<SupportFrames>((ref) {
  final f = SupportFrames(ref.watch(supportStreamProvider));
  ref.onDispose(() => unawaited(f.dispose()));
  return f;
});

/// A file chosen for the chat: its name, type, size and a reader (read only after the size / type checks).
typedef PickedSupportFile = ({String name, String mime, int size, Future<Uint8List> Function() read});

typedef SupportFilePicker = Future<PickedSupportFile?> Function();

/// The system file picker limited to the chat's types (web <input type=file accept=…>).
Future<PickedSupportFile?> pickSupportFile() async {
  final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: kSupportAttachmentExtensions);
  if (f == null) return null;
  final size = f.lengthSync() ?? await f.length() ?? 0;
  return (name: f.name, mime: supportMimeOf(f.name), size: size, read: f.readAsBytes);
}

/// The chat's file picker; tests swap it with `set`.
class SupportPicker extends Notifier<SupportFilePicker> {
  @override
  SupportFilePicker build() => pickSupportFile;
  void set(SupportFilePicker picker) => state = picker;
}

final supportPickerProvider = NotifierProvider<SupportPicker, SupportFilePicker>(SupportPicker.new);

/// An attachment's file (`GET support/attachments/{id}`, own files only): image previews and the share sheet.
final supportAttachmentProvider = FutureProvider.autoDispose.family<DownloadedFile, int>(
  (ref, id) => ref.watch(apiProvider).download('support/attachments/$id'),
);

/// The floating chat: open or not, and the unread count of agent replies while it's closed (web launcher state,
/// fed by `conversation` frames' clientUnread).
class SupportLauncherState extends Notifier<({bool open, int unread})> {
  @override
  ({bool open, int unread}) build() {
    final off = ref.watch(supportFramesProvider).listen((f) {
      if (f['type'] != 'conversation' || state.open || f['conversation'] is! Map) return;
      final n = ((f['conversation'] as Map)['clientUnread'] as num?)?.toInt() ?? 0;
      state = (open: false, unread: n);
    });
    ref.onDispose(off);
    return (open: false, unread: 0);
  }

  void opened() => state = (open: true, unread: 0);
  void closed() => state = (open: false, unread: state.unread);
}

final supportLauncherProvider = NotifierProvider<SupportLauncherState, ({bool open, int unread})>(SupportLauncherState.new);
