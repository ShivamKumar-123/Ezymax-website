// Sample answers for the Support pages (development previews and widget tests only; never in a shipped build).
// Shapes are the real API's (the web's /api/support/... BFF = services/support /v1/support/me/…, see its README);
// values are made up. Return null for paths this file doesn't answer.
//
// A small in-memory support desk so the flows work: `support/me` (settings + the open conversation), conversations
// (history + transcripts), messages (a client message gets the bot's answer on the next read of the conversation,
// as the app's poll sees it without a live stream; a message to a person gets the agent's reply), hand-over,
// resolve, rate, read, typing, attachments and the stream ticket.
// `PreviewSupport.scenario` picks the starting desk (tests and screenshots set it, then call `reset()`):
//   agent  (default) an open conversation with Mei Lin (a bot answer, the hand-over, her reply)
//   waiting          an open request for a person, nobody assigned yet
//   bot              an open conversation with the bot
//   none             no open conversation (history only)

abstract final class PreviewSupport {
  static String scenario = 'agent';
  static Map<String, dynamic>? _open;
  static final List<Map<String, dynamic>> _msgs = [];
  static final List<Map<String, dynamic>> _past = [];
  static int _nextId = 9100;
  static bool _botDue = false;
  static bool _agentDue = false;
  static bool _ready = false;

  /// Every upload's answer (tests read it).
  static final List<Map<String, dynamic>> uploads = [];

  /// Every message body the client sent (tests read it).
  static final List<Map<String, dynamic>> sent = [];

  /// The open (or just-resolved) conversation's id (screenshots play stream frames into it).
  static int? get openId => _open?['id'] as int?;

  /// Starts the desk again in `scenario` (tests call it in setUp).
  static void reset([String? to]) {
    if (to != null) scenario = to;
    _ready = false;
    uploads.clear();
    sent.clear();
  }

  static String _ago(Duration d) => DateTime.now().toUtc().subtract(d).toIso8601String();

  static Map<String, dynamic> _conv(
    int id,
    String subject,
    String status, {
    String? agent,
    int unread = 0,
    Map<String, dynamic>? csat,
    Duration age = Duration.zero,
  }) => {
    'id': id,
    'subject': subject,
    'status': status,
    'assigneeName': agent,
    'handedOverAt': status == 'bot' ? null : _ago(age),
    'clientUnread': unread,
    'csat': csat,
    'resolvedAt': status == 'resolved' ? _ago(age) : null,
    'createdAt': _ago(age),
    'lastMessageAt': _ago(age),
    'preview': subject,
  };

  static Map<String, dynamic> _msg(
    int conv,
    String author,
    String body, {
    String? name,
    Map<String, dynamic> meta = const {},
    Map<String, dynamic>? attachment,
    Duration ago = Duration.zero,
  }) => {
    'id': _nextId++,
    'conversationId': conv,
    'author': author,
    'authorId': null,
    'authorName': name,
    'body': body,
    'attachment': attachment,
    'meta': meta,
    'createdAt': _ago(ago),
  };

  static const String _depositAnswer =
      "Here's what our help centre says about **Depositing USDT**:\n\n"
      'Open **Wallet → Deposit**, choose USDT and the network (TRC20 or ERC20), then send to the address shown.\n\n'
      '- **TRC20** needs 20 network confirmations, usually about a minute.\n'
      '- **ERC20** needs 12 confirmations, usually a few minutes.\n\n'
      'The deposit appears in **Wallet → History** with its status and network hash.';

  static const List<Map<String, dynamic>> _depositCites = [
    {'slug': 'deposit-usdt', 'title': 'Depositing USDT'},
    {'slug': 'deposit-not-arrived', 'title': 'My deposit has not arrived'},
  ];

  static void _boot() {
    if (_ready) return;
    _ready = true;
    _nextId = 9100;
    _botDue = false;
    _agentDue = false;
    _msgs.clear();
    _past
      ..clear()
      ..add(_conv(7712, 'How do I change my leverage?', 'resolved', csat: {'rating': 5, 'comment': null}, age: const Duration(days: 6)))
      ..add(_conv(7604, 'Withdrawal to my bank card', 'resolved', agent: 'Daniel Okafor', age: const Duration(days: 19)));
    const id = 7801;
    switch (scenario) {
      case 'none':
        _open = null;
      case 'bot':
        _open = _conv(id, 'How do I deposit USDT?', 'bot', age: const Duration(minutes: 12));
        _msgs
          ..add(_msg(id, 'client', 'How do I deposit USDT?', ago: const Duration(minutes: 12)))
          ..add(_msg(id, 'bot', _depositAnswer, meta: {'kind': 'answer', 'cites': _depositCites}, ago: const Duration(minutes: 12)));
      case 'waiting':
        _open = _conv(id, 'My deposit has not arrived', 'waiting', age: const Duration(minutes: 9));
        _msgs
          ..add(_msg(id, 'client', 'My deposit has not arrived', ago: const Duration(minutes: 9)))
          ..add(_msg(id, 'bot', _depositAnswer, meta: {'kind': 'answer', 'cites': _depositCites}, ago: const Duration(minutes: 9)))
          ..add(_msg(id, 'system', 'Connecting you to our support team…', meta: {'kind': 'handover'}, ago: const Duration(minutes: 7)));
      default:
        _open = _conv(id, 'My USDT deposit is still pending', 'assigned', agent: 'Mei Lin', unread: 1, age: const Duration(minutes: 14));
        _msgs
          ..add(_msg(id, 'client', 'My USDT deposit is still pending', ago: const Duration(minutes: 14)))
          ..add(_msg(id, 'bot', _depositAnswer, meta: {'kind': 'answer', 'cites': _depositCites}, ago: const Duration(minutes: 14)))
          ..add(
            _msg(
              id,
              'client',
              '',
              attachment: {'id': 4401, 'name': 'tx-receipt.pdf', 'mime': 'application/pdf', 'size': 182400},
              ago: const Duration(minutes: 12),
            ),
          )
          ..add(_msg(id, 'system', 'Mei Lin joined the chat', meta: {'kind': 'join', 'agentName': 'Mei Lin'}, ago: const Duration(minutes: 10)))
          ..add(
            _msg(
              id,
              'agent',
              "Hi Arjun, Mei Lin here from Client Support. I can see your transfer of **2,500.00 USDT**. It cleared our risk check and I'm confirming it with the payments desk now.",
              name: 'Mei Lin',
              ago: const Duration(minutes: 9),
            ),
          );
    }
  }

  static List<Map<String, dynamic>> _of(int conv) => _msgs.where((m) => m['conversationId'] == conv).toList();

  static String _answerFor(String q) {
    final s = q.toLowerCase();
    if (s.contains('margin')) {
      return "Here's what our help centre says about **Margin, margin call and stop-out**:\n\n"
          '**Margin level** = equity / used margin × 100%.\n\n'
          "- When the margin level falls to your account type's **margin call** level, we notify you.\n"
          '- At the **stop-out** level, positions are closed from the largest loss first.';
    }
    if (s.contains('verif') || s.contains('identity')) {
      return 'To verify your identity, open **Profile → Verification** and follow the steps:\n\n'
          '- A photo of your ID (passport, ID card or driving licence)\n'
          '- A selfie\n'
          '- Proof of address, not older than 3 months\n\n'
          'Most checks finish within minutes.';
    }
    if (s.contains('withdraw')) {
      return 'Withdrawals are processed within **15 minutes** on average, 24/7. You can follow every step in **Wallet → History**.';
    }
    if (s.contains('stop')) {
      return 'A **stop-out** happens when your margin level falls to the stop-out level of your account type: positions are closed, largest loss first, until the margin level is back above it.';
    }
    return _depositAnswer;
  }

  static (int, Object) _err(int status, String code, String message) => (
    status,
    {
      'error': {'code': code, 'message': message},
    },
  );

  static (int, Object)? answer(String method, String path, Map<String, dynamic> body) {
    if (!path.startsWith('support/')) return null;
    _boot();
    final rest = path.substring('support/'.length);
    final settings = {
      'botName': 'Kalks AI',
      'greeting': "Hi there. I'm Kalks AI. Ask me about deposits, withdrawals, verification or trading, or ask for a person at any time.",
      'ai': true,
      'agentsOnline': 3,
      'maxAttachmentMb': 10,
    };
    final open = _open;
    if (method == 'GET') {
      if (rest == 'me') {
        return (200, {'settings': settings, 'conversation': open, 'messages': open == null ? <Object>[] : _of(open['id'] as int)});
      }
      if (rest == 'conversations') {
        return (
          200,
          {
            'items': [?open, ..._past],
          },
        );
      }
      final m = RegExp(r'^conversations/(\d+)$').firstMatch(rest);
      if (m != null) {
        final id = int.parse(m.group(1)!);
        if (open != null && open['id'] == id) {
          // the answer the client is waiting for arrives with this read (the app's poll without a live stream)
          if (_botDue && open['status'] == 'bot') {
            _botDue = false;
            final q = _of(id).lastWhere((x) => x['author'] == 'client', orElse: () => const {'body': ''});
            _msgs.add(_msg(id, 'bot', _answerFor('${q['body']}'), meta: {'kind': 'answer', 'cites': _depositCites}));
          }
          if (_agentDue && open['status'] == 'assigned') {
            _agentDue = false;
            _msgs.add(_msg(id, 'agent', "Thanks, I'm checking this for you now.", name: '${open['assigneeName']}'));
          }
          return (200, {'conversation': open, 'messages': _of(id)});
        }
        final past = _past.where((c) => c['id'] == id).firstOrNull;
        if (past == null) return _err(404, 'not_found', 'Not found.');
        return (
          200,
          {
            'conversation': past,
            'messages': [
              {
                'id': id * 10,
                'conversationId': id,
                'author': 'client',
                'authorName': null,
                'body': '${past['subject']}',
                'attachment': null,
                'meta': const <String, Object>{},
                'createdAt': past['createdAt'],
              },
              {
                'id': id * 10 + 1,
                'conversationId': id,
                'author': 'bot',
                'authorName': null,
                'body': 'Open **Accounts**, choose the account and tap **Change leverage**. The new leverage applies at once to new and open positions.',
                'attachment': null,
                'meta': const {
                  'cites': [
                    {'slug': 'leverage', 'title': 'Leverage'},
                  ],
                },
                'createdAt': past['createdAt'],
              },
            ],
          },
        );
      }
      if (RegExp(r'^attachments/\d+$').hasMatch(rest)) return (200, const <String, Object>{});
      return null;
    }
    if (method != 'POST') return null;
    switch (rest) {
      case 'stream-ticket':
        return (200, {'ticket': 'preview', 'url': null});
      case 'read':
        if (open != null) open['clientUnread'] = 0;
        return (200, {'status': 'ok'});
      case 'typing':
        return (200, {'status': 'ok'});
      case 'attachments':
        final a = {'id': 4500 + uploads.length, 'name': 'attachment.pdf', 'mime': 'application/pdf', 'size': 245760};
        uploads.add(a);
        return (200, {'attachment': a});
      case 'messages':
        final text = '${body['body'] ?? ''}'.trim();
        final att = body['attachmentId'];
        if (text.isEmpty && att == null) return _err(422, 'validation', 'Write a message.');
        sent.add({'body': text, 'attachmentId': ?att});
        var conv = open;
        if (conv == null || conv['status'] == 'resolved') {
          if (conv != null) _past.insert(0, conv);
          conv = _conv(_nextId++, text.isEmpty ? 'Attachment' : (text.length > 60 ? '${text.substring(0, 60)}…' : text), 'bot');
          _open = conv;
        }
        final id = conv['id'] as int;
        final upload = att == null ? null : uploads.where((u) => u['id'] == att).firstOrNull;
        final m = _msg(id, 'client', text, attachment: upload);
        _msgs.add(m);
        conv['lastMessageAt'] = m['createdAt'];
        if (conv['status'] == 'bot') _botDue = true;
        if (conv['status'] == 'assigned') _agentDue = true;
        return (200, {'conversation': conv, 'message': m});
      case 'handover':
        var conv = open;
        if (conv == null || conv['status'] == 'resolved') {
          if (conv != null) _past.insert(0, conv);
          conv = _conv(_nextId++, 'Talk to a person', 'waiting');
          _open = conv;
        }
        conv['status'] = 'waiting';
        _botDue = false;
        _msgs.add(_msg(conv['id'] as int, 'system', 'Connecting you to our support team…', meta: {'kind': 'handover'}));
        return (200, {'conversation': conv});
    }
    final m = RegExp(r'^conversations/(\d+)/(resolve|rate)$').firstMatch(rest);
    if (m == null) return null;
    final id = int.parse(m.group(1)!);
    final conv = (open != null && open['id'] == id) ? open : _past.where((c) => c['id'] == id).firstOrNull;
    if (conv == null) return _err(404, 'not_found', 'Not found.');
    if (m.group(2) == 'resolve') {
      conv['status'] = 'resolved';
      conv['resolvedAt'] = DateTime.now().toUtc().toIso8601String();
      _botDue = false;
      _agentDue = false;
      return (200, {'conversation': conv});
    }
    if (conv['status'] != 'resolved') return _err(409, 'not_resolved', 'Rate the chat after it ends.');
    final rating = (body['rating'] as num?)?.toInt() ?? 0;
    if (rating < 1 || rating > 5) return _err(422, 'validation', 'Choose 1 to 5 stars.');
    conv['csat'] = {'rating': rating, 'comment': body['comment']};
    return (200, {'conversation': conv});
  }
}

(int, Object)? previewSupport(String method, String path, Map<String, dynamic> body, Map<String, String> query) => PreviewSupport.answer(method, path, body);
