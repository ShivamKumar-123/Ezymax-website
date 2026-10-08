// The live support chat's state and actions (port of LiveChat's hooks in apps/crm/components/support/live-chat.tsx):
// the chat home over `support/me`, messages, the bot's streamed answer (bot.typing / bot.delta frames), the agent's
// typing, hand-over to a person, end chat, rating, attachments, read receipts and typing pings. Realtime through the
// support stream's frames; without a connected socket (previews, tests, a dropped connection) it polls the open
// conversation instead, faster while the bot's answer is due.
import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../core/api/api_providers.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/t.dart';
import '../../ui/ui.dart';
import 'support_data.dart';
import 'support_models.dart';

/// Toasts from the chat (web toast.success / toast.error).
typedef SupportToast = void Function(NotificationKind kind, String title, {String? description});

class LiveChatController extends ChangeNotifier {
  LiveChatController({
    required this.api,
    required this.frames,
    required this.t,
    required this.toast,
    required this.picker,
    this.foreground = _always,
    this.pollEvery = const Duration(milliseconds: 2500),
  });

  final ApiClient api;
  final SupportFrames frames;
  final T Function() t;
  final SupportToast toast;
  final SupportFilePicker Function() picker;
  final bool Function() foreground;

  /// The fallback poll while there is no live socket (the web's 2.5 s while an answer is due; every 2nd tick otherwise).
  final Duration pollEvery;

  static bool _always() => true;

  SupportHome? home;
  bool failed = false;
  SupportConversation? conv;
  List<SupportMessage> msgs = const [];

  /// The bot's answer being written: null = none, text '' = typing dots.
  ({String id, String text})? stream;
  bool agentTyping = false;
  bool sending = false;
  bool uploading = false;
  int rating = 0;
  final TextEditingController input = TextEditingController();
  final TextEditingController comment = TextEditingController();

  void Function()? _off;
  Timer? _poll;
  Timer? _typingTimer;
  int _ticks = 0;
  bool _polling = false;
  DateTime _lastTypingSent = DateTime.fromMillisecondsSinceEpoch(0);
  bool _disposed = false;

  SupportSettings get settings => home?.settings ?? const SupportSettings();
  String get botName => home?.settings.botName ?? 'Ezymex AI';
  ConvStatus? get status => conv?.status;
  bool get resolved => status == 'resolved';
  bool get human => status == 'waiting' || status == 'assigned';
  bool get showGreeting => conv == null || msgs.isEmpty;
  bool get canRate => resolved && conv?.csat == null && msgs.any((m) => m.author == 'agent' || m.author == 'bot');

  /// Starts loading, listening to the stream and the fallback poll.
  void start() {
    unawaited(load());
    _off = frames.listen(onFrame);
    _poll = Timer.periodic(pollEvery, (_) => unawaited(_tick()));
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _off?.call();
    _poll?.cancel();
    _typingTimer?.cancel();
    input.dispose();
    comment.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final r = await api.get<Map<String, dynamic>>('support/me');
      final h = SupportHome.fromJson(r);
      failed = false;
      home = h;
      _setConv(h.conversation);
      msgs = h.messages;
    } catch (_) {
      failed = true;
    }
    _notify();
  }

  void _addMsg(SupportMessage m) {
    if (msgs.any((x) => x.id == m.id)) return;
    msgs = [...msgs, m]..sort((a, b) => a.id.compareTo(b.id));
  }

  /// Sets the conversation; the open chat marks unread replies read (web: POST read while visible).
  void _setConv(SupportConversation? c) {
    conv = c;
    if (c != null && c.clientUnread > 0 && foreground()) {
      conv = c.copyWith(clientUnread: 0);
      unawaited(api.post<Object?>('support/read').then((_) {}, onError: (Object _) {}));
    }
  }

  /// A frame of the support stream (web realtime().subscribe in LiveChat).
  void onFrame(Map<String, dynamic> f) {
    final cur = conv;
    int? convId(Object? v) => (v as num?)?.toInt();
    switch (f['type']) {
      case 'reconnected':
        unawaited(load());
        return;
      case 'message':
        final m = SupportMessage.tryParse(f['message']);
        if (m == null) return;
        if (cur != null && m.conversationId != cur.id) return;
        if (cur == null) {
          unawaited(load());
          return;
        }
        _addMsg(m);
        if (m.author == 'bot') stream = null;
        if (m.author == 'agent') agentTyping = false;
      case 'conversation':
        final c = SupportConversation.tryParse(f['conversation']);
        if (c == null) return;
        if (cur == null || c.id == cur.id) _setConv(c);
      case 'bot.typing':
        if (cur == null || convId(f['conversationId']) != cur.id) return;
        stream = (id: '${f['streamId']}', text: '');
      case 'bot.delta':
        if (cur == null || convId(f['conversationId']) != cur.id) return;
        final id = '${f['streamId']}';
        final s = stream;
        stream = s != null && s.id == id ? (id: id, text: '${s.text}${f['text'] ?? ''}') : (id: id, text: '${f['text'] ?? ''}');
      case 'typing':
        if (cur == null || convId(f['conversationId']) != cur.id || f['from'] != 'agent') return;
        agentTyping = true;
        _typingTimer?.cancel();
        _typingTimer = Timer(const Duration(seconds: 4), () {
          agentTyping = false;
          _notify();
        });
      default:
        return;
    }
    _notify();
  }

  /// Without a live socket: read the open conversation (every tick while the bot's answer is due, else every 2nd).
  Future<void> _tick() async {
    _ticks++;
    final cur = conv;
    if (frames.live || _polling || cur == null || cur.resolved || !foreground()) return;
    if (stream == null && _ticks.isOdd) return;
    _polling = true;
    try {
      final r = await api.get<Map<String, dynamic>>('support/conversations/${cur.id}');
      if (_disposed || conv?.id != cur.id) return;
      for (final m in parseMessages(r['messages'])) {
        if (msgs.any((x) => x.id == m.id)) continue;
        _addMsg(m);
        if (m.author == 'bot' || m.author == 'agent') stream = null;
        if (m.author == 'agent') agentTyping = false;
      }
      final c = SupportConversation.tryParse(r['conversation']);
      if (c != null) _setConv(c);
      if (c != null && c.status != 'bot') stream = null;
      _notify();
    } catch (_) {
      // the next tick tries again
    } finally {
      _polling = false;
    }
  }

  /// Sends the composer's text (or `raw`, a quick reply), optionally with an uploaded attachment.
  Future<void> send({String? raw, int? attachmentId}) async {
    final text = (raw ?? input.text).trim();
    if ((text.isEmpty && attachmentId == null) || sending) return;
    sending = true;
    if (raw == null) input.clear();
    if (resolved) {
      conv = null;
      msgs = const [];
      rating = 0;
    }
    _notify();
    try {
      final r = await api.post<Map<String, dynamic>>('support/messages', body: {'body': text, 'attachmentId': ?attachmentId});
      sending = false;
      final c = SupportConversation.tryParse(r['conversation']);
      final m = SupportMessage.tryParse(r['message']);
      if (c != null) _setConv(c);
      if (m != null) _addMsg(m);
      if (c?.status == 'bot') stream ??= (id: 'pending', text: '');
    } catch (e) {
      sending = false;
      final t = this.t();
      toast(NotificationKind.error, t('support.toast.notSent'), description: errorText(e, t));
      if (raw == null) input.text = text;
    }
    _notify();
  }

  /// Talk to a person (the chat's menu and quick reply).
  Future<void> handover() async {
    final had = conv != null;
    try {
      final r = await api.post<Map<String, dynamic>>('support/handover');
      _setConv(SupportConversation.tryParse(r['conversation']) ?? conv);
      _notify();
      if (!had) await load();
    } catch (e) {
      final t = this.t();
      toast(NotificationKind.error, t('support.toast.teamUnreachable'), description: errorText(e, t));
    }
  }

  Future<void> endChat() async {
    final c = conv;
    if (c == null) return;
    try {
      final r = await api.post<Map<String, dynamic>>('support/conversations/${c.id}/resolve');
      _setConv(SupportConversation.tryParse(r['conversation']) ?? conv);
      stream = null;
      _notify();
    } catch (e) {
      final t = this.t();
      toast(NotificationKind.error, t('support.toast.endFailed'), description: errorText(e, t));
    }
  }

  void setRating(int n) {
    rating = n;
    _notify();
  }

  Future<void> rate() async {
    final c = conv;
    if (c == null || rating == 0) return;
    final t = this.t();
    try {
      final r = await api.post<Map<String, dynamic>>('support/conversations/${c.id}/rate', body: {'rating': rating, 'comment': comment.text});
      _setConv(SupportConversation.tryParse(r['conversation']) ?? conv);
      _notify();
      toast(NotificationKind.success, t('support.toast.thanks'));
    } catch (e) {
      toast(NotificationKind.error, t('support.toast.rateFailed'), description: errorText(e, t));
    }
  }

  /// Start new chat (menu): a fresh greeting; the next message opens a new conversation.
  void newChat() {
    conv = null;
    msgs = const [];
    rating = 0;
    comment.clear();
    stream = null;
    _notify();
  }

  /// The paperclip: pick an image or PDF, check it, upload it raw, then send it with the composer's text.
  Future<void> attach() async {
    if (uploading || home == null) return;
    final f = await picker()();
    if (f == null) return;
    final t = this.t();
    final mb = settings.maxAttachmentMb;
    switch (attachmentProblem(size: f.size, mime: f.mime, maxMb: mb)) {
      case AttachmentProblem.tooLarge:
        return toast(NotificationKind.error, t('support.toast.fileTooLarge'), description: t('support.toast.fileTooLargeText', {'mb': mb}));
      case AttachmentProblem.unsupported:
        return toast(NotificationKind.error, t('support.toast.unsupported'), description: t('support.toast.unsupportedText'));
      case null:
        break;
    }
    uploading = true;
    _notify();
    try {
      final bytes = await f.read();
      final r = await api.upload<Map<String, dynamic>>(
        'support/attachments',
        data: bytes,
        contentType: f.mime,
        headers: {'X-File-Name': Uri.encodeComponent(f.name)},
      );
      final a = SupportAttachment.tryParse(r['attachment']);
      if (a == null) throw const ApiException(status: 502, code: 'upload_failed', message: 'Upload failed.');
      await send(raw: input.text.trim(), attachmentId: a.id);
      input.clear();
    } catch (e) {
      toast(NotificationKind.error, t('support.toast.uploadFailed'), description: e is ApiException ? localizeError(e, t) : t('support.error.uploadFailed'));
    } finally {
      uploading = false;
      _notify();
    }
  }

  /// Typing pings to the agent (at most every 3 s, only while a person has the chat).
  void onType(String v) {
    if (human && DateTime.now().difference(_lastTypingSent) > const Duration(seconds: 3)) {
      _lastTypingSent = DateTime.now();
      unawaited(api.post<Object?>('support/typing').then((_) {}, onError: (Object _) {}));
    }
  }
}
