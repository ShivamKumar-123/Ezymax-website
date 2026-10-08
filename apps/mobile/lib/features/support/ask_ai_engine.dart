// The engine behind "Ask Kalks AI" (port of useLiveAi in apps/crm/components/ai/engine.ts).
//
// The question goes to the client's support conversation (POST support/messages, the same chat as /support), and the
// bot's answer streams over the support stream (bot.typing / bot.delta / message), with a poll of the conversation
// while an answer is due (a missed frame or no live stream). Everything stays in the client's support history, so
// "Continue in chat" opens the same conversation and "Talk to a person" is the chat's own hand-over. The service keeps
// one open conversation per client and the bot only answers "bot" conversations (ask_ai_rules.dart): while a request
// for a person is open, a question is held until the client closes that request (then it goes to the bot in a new
// conversation) or sends it to the team.
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/api/api_providers.dart';
import '../../i18n/t.dart';
import 'ask_ai_rules.dart';
import 'support_data.dart';
import 'support_models.dart';

/// One line of the Ask Kalks AI thread. role: you | bot | agent | system.
class AiTurn {
  const AiTurn({required this.id, required this.role, required this.text, this.name, this.cites = const [], this.chip});
  final String id;
  final String role;
  final String text;
  final String? name;
  final List<SupportCite> cites;

  /// The suggestion this question came from (its extra panel shows under it).
  final String? chip;

  AiTurn withId(String id) => AiTurn(id: id, role: role, text: text, name: name, cites: cites, chip: chip);

  static AiTurn of(SupportMessage m) => AiTurn(id: '${m.id}', role: m.author == 'client' ? 'you' : m.author, text: m.body, name: m.authorName, cites: m.cites);
}

class AskAiEngine extends ChangeNotifier {
  AskAiEngine({
    required this.api,
    required this.frames,
    required this.t,
    this.fallbackName = 'Kalks AI',
    this.foreground = _always,
    this.pollEvery = const Duration(milliseconds: 2500),
    this.slowAfter = const Duration(seconds: 25),
    this.giveUpAfter = const Duration(seconds: 120),
  }) : botName = fallbackName;

  final ApiClient api;
  final SupportFrames frames;
  final T Function() t;
  final String fallbackName;
  final bool Function() foreground;
  final Duration pollEvery, slowAfter, giveUpAfter;

  static bool _always() => true;

  String botName;
  SupportConversation? conv;
  List<AiTurn> turns = const [];

  /// The answer being written: null = none, '' = typing dots, text = streamed so far.
  String? streaming;
  bool waiting = false;
  bool slow = false;
  bool sending = false;
  String? error;
  ({String id, String text})? _held;
  bool _sentToTeam = false;
  int _lastAsked = 0;
  DateTime _since = DateTime.now();
  Timer? _poll;
  bool _polling = false;
  void Function()? _off;
  bool _disposed = false;
  int _tmp = 0;

  ConvStatus? get status => conv?.status;
  String? get agentName => conv?.assigneeName;
  bool get _has => turns.isNotEmpty;

  /// A request for a person was already open before this card's questions (a note with "View").
  bool get openRequest => withPerson(status) && (!_has || _held != null);

  /// A question is held: a request for a person is open and the bot can't answer there.
  bool get blocked => _held != null;

  /// The conversation is with our support team now (handed over, or sent to the team).
  bool get withTeam => _has && _held == null && (_sentToTeam || withPerson(status));

  /// Anything in the thread (questions or an answer being written).
  bool get hasThread => _has || streaming != null;

  /// An answer is in: the follow-up actions show.
  bool get answered => hasThread && !waiting && !blocked && turns.isNotEmpty && turns.last.role != 'you';

  bool get human => status == 'waiting' || status == 'assigned';

  /// Loads the broker's bot name and any open conversation; listens to the stream.
  void start() {
    _off = frames.listen(onFrame);
    unawaited(_home());
  }

  Future<void> _home() async {
    try {
      final r = await api.get<Map<String, dynamic>>('support/me');
      final name = (r['settings'] is Map) ? (r['settings'] as Map)['botName'] : null;
      if (name is String && name.isNotEmpty) botName = name;
      conv ??= SupportConversation.tryParse(r['conversation']);
      _notify();
    } catch (_) {
      // the card works without it (fallback name, no open-request note)
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _off?.call();
    _poll?.cancel();
    super.dispose();
  }

  void _stopWaiting() {
    streaming = null;
    waiting = false;
    slow = false;
    _poll?.cancel();
    _poll = null;
  }

  void _startWaiting() {
    waiting = true;
    _since = DateTime.now();
    _poll?.cancel();
    _poll = Timer.periodic(pollEvery, (_) => unawaited(_tick()));
  }

  void _onConv(SupportConversation c) {
    final wasWaiting = waiting;
    conv = c;
    // the bot handed the question over: no bot answer is coming
    if (passedToTeam(wasWaiting, c.status) && _lastAsked > 0) _stopWaiting();
  }

  void _take(SupportMessage m) {
    final cur = conv;
    if (cur == null || m.conversationId != cur.id || m.id <= _lastAsked || m.author == 'client') return;
    if (!turns.any((x) => x.id == '${m.id}')) turns = [...turns, AiTurn.of(m)];
    if (m.author == 'bot' || m.author == 'agent') _stopWaiting();
  }

  /// A frame of the support stream.
  void onFrame(Map<String, dynamic> f) {
    final cur = conv;
    bool mine() => cur != null && (f['conversationId'] as num?)?.toInt() == cur.id;
    switch (f['type']) {
      case 'bot.typing':
        if (mine() && waiting) streaming ??= '';
      case 'bot.delta':
        if (mine() && waiting) streaming = '${streaming ?? ''}${f['text'] ?? ''}';
      case 'message':
        final m = SupportMessage.tryParse(f['message']);
        if (m != null) _take(m);
      case 'conversation':
        final c = SupportConversation.tryParse(f['conversation']);
        if (c != null && (cur == null || c.id == cur.id)) _onConv(c);
      default:
        return;
    }
    _notify();
  }

  /// While an answer is due: read the conversation (a missed frame or a stream that's down).
  Future<void> _tick() async {
    final cur = conv;
    if (cur == null || _polling || !waiting) return;
    if (!foreground()) return;
    _polling = true;
    try {
      final r = await api.get<Map<String, dynamic>>('support/conversations/${cur.id}');
      if (_disposed) return;
      parseMessages(r['messages']).forEach(_take);
      final c = SupportConversation.tryParse(r['conversation']);
      if (c != null) _onConv(c);
      final elapsed = DateTime.now().difference(_since);
      if (waiting && elapsed > slowAfter) slow = true;
      if (elapsed > giveUpAfter) _stopWaiting();
      _notify();
    } catch (_) {
      // try again on the next tick
    } finally {
      _polling = false;
    }
  }

  /// Sends a question that's already shown as turn `tmp`; `toBot` false = it goes to the team's open request.
  Future<void> _send(String text, String tmp, bool toBot) async {
    sending = true;
    slow = false;
    streaming = toBot ? '' : null;
    if (toBot) {
      _startWaiting();
    } else {
      _stopWaiting();
    }
    _notify();
    try {
      final r = await api.post<Map<String, dynamic>>('support/messages', body: {'body': text});
      sending = false;
      final m = SupportMessage.tryParse(r['message']);
      final c = SupportConversation.tryParse(r['conversation']);
      if (m == null || c == null) throw const ApiException(status: 502, code: 'unavailable', message: '');
      _lastAsked = m.id;
      conv = c;
      turns = [for (final x in turns) x.id == tmp ? x.withId('${m.id}') : x];
      // the bot answers only conversations it owns; anything else is with the team
      if (c.status != 'bot') {
        _stopWaiting();
        if (!toBot) _sentToTeam = true;
      }
    } catch (e) {
      sending = false;
      turns = turns.where((x) => x.id != tmp).toList();
      _stopWaiting();
      error = _errorOf(e);
    }
    _notify();
  }

  String _errorOf(Object e) {
    final t = this.t();
    if (e is ApiException && !e.isNetwork && e.message.isNotEmpty) return localizeError(e, t);
    return t('support.unavailable');
  }

  /// Asks a question (typed, or a suggestion `chip`).
  void ask(String raw, {String? chip}) {
    final text = raw.trim();
    if (text.isEmpty || sending || _held != null) return;
    final tmp = 'tmp-${++_tmp}';
    error = null;
    turns = [...turns, AiTurn(id: tmp, role: 'you', text: text, chip: chip)];
    // a request for a person is open: the bot would never answer there, so the client chooses first
    if (askRoute(conv?.status) == AskRoute.person) {
      _held = (id: tmp, text: text);
      _notify();
      return;
    }
    unawaited(_send(text, tmp, true));
  }

  /// Held question: close the open request, then ask the bot (a new conversation).
  Future<void> closeAndAsk() async {
    final h = _held;
    final cur = conv;
    if (h == null) return;
    _held = null;
    error = null;
    if (cur == null || !withPerson(cur.status)) return _send(h.text, h.id, true);
    sending = true;
    _notify();
    try {
      final r = await api.post<Map<String, dynamic>>('support/conversations/${cur.id}/resolve');
      sending = false;
      // the request is closed; the question opens a new conversation that the bot owns
      conv = SupportConversation.tryParse(r['conversation']) ?? conv;
      await _send(h.text, h.id, true);
    } catch (e) {
      sending = false;
      _held = h;
      error = _errorOf(e);
      _notify();
    }
  }

  /// Held question: send it to the team in the open request instead.
  Future<void> sendToTeam() async {
    final h = _held;
    if (h == null) return;
    _held = null;
    error = null;
    await _send(h.text, h.id, false);
  }

  /// Talk to a person (the chat's hand-over).
  Future<void> handover() async {
    error = null;
    _notify();
    try {
      final r = await api.post<Map<String, dynamic>>('support/handover');
      conv = SupportConversation.tryParse(r['conversation']) ?? conv;
      _stopWaiting();
    } catch (e) {
      error = _errorOf(e);
    }
    _notify();
  }

  /// New question: clears the thread (the conversation stays in the support history).
  void reset() {
    turns = const [];
    _held = null;
    _sentToTeam = false;
    _stopWaiting();
    error = null;
    _notify();
  }
}
