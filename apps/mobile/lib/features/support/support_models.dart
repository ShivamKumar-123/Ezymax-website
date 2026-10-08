// The support chat's data (services/support client API through /api/mobile/support/*, the web's types in
// apps/crm/components/support/live-chat.tsx): the chat home (settings, open conversation, messages), conversations,
// messages and attachments. Plus the pure helpers the chat needs: attachment checks (web onFile), the bot's safe
// markdown (web Rich) and the conversation status chips (web STATUS).
import '../../ui/ui.dart';

/// bot | waiting | assigned | resolved
typedef ConvStatus = String;

class SupportCsat {
  const SupportCsat({required this.rating, this.comment});
  final int rating;
  final String? comment;

  static SupportCsat? fromJson(Object? j) {
    if (j is! Map) return null;
    return SupportCsat(rating: (j['rating'] as num?)?.toInt() ?? 0, comment: j['comment'] as String?);
  }
}

class SupportConversation {
  const SupportConversation({
    required this.id,
    required this.subject,
    required this.status,
    required this.createdAt,
    this.assigneeName,
    this.handedOverAt,
    this.clientUnread = 0,
    this.csat,
    this.resolvedAt,
    this.lastMessageAt,
    this.preview = '',
  });

  final int id;
  final String subject;
  final ConvStatus status;
  final String? assigneeName;
  final DateTime? handedOverAt;
  final int clientUnread;
  final SupportCsat? csat;
  final DateTime? resolvedAt;
  final DateTime createdAt;
  final DateTime? lastMessageAt;
  final String preview;

  bool get resolved => status == 'resolved';

  /// With (or queued for) a person.
  bool get human => status == 'waiting' || status == 'assigned';

  SupportConversation copyWith({int? clientUnread}) => SupportConversation(
    id: id,
    subject: subject,
    status: status,
    createdAt: createdAt,
    assigneeName: assigneeName,
    handedOverAt: handedOverAt,
    clientUnread: clientUnread ?? this.clientUnread,
    csat: csat,
    resolvedAt: resolvedAt,
    lastMessageAt: lastMessageAt,
    preview: preview,
  );

  static SupportConversation? tryParse(Object? j) => j is Map ? SupportConversation.fromJson(j.cast<String, dynamic>()) : null;

  factory SupportConversation.fromJson(Map<String, dynamic> j) => SupportConversation(
    id: (j['id'] as num?)?.toInt() ?? 0,
    subject: '${j['subject'] ?? ''}',
    status: '${j['status'] ?? 'bot'}',
    assigneeName: j['assigneeName'] as String?,
    handedOverAt: _date(j['handedOverAt']),
    clientUnread: (j['clientUnread'] as num?)?.toInt() ?? 0,
    csat: SupportCsat.fromJson(j['csat']),
    resolvedAt: _date(j['resolvedAt']),
    createdAt: _date(j['createdAt']) ?? DateTime.now(),
    lastMessageAt: _date(j['lastMessageAt']),
    preview: '${j['preview'] ?? ''}',
  );
}

class SupportAttachment {
  const SupportAttachment({required this.id, required this.name, required this.mime, required this.size});
  final int id;
  final String name;
  final String mime;
  final int size;

  bool get image => mime.startsWith('image/');

  static SupportAttachment? tryParse(Object? j) {
    if (j is! Map) return null;
    return SupportAttachment(
      id: (j['id'] as num?)?.toInt() ?? 0,
      name: '${j['name'] ?? 'file'}',
      mime: '${j['mime'] ?? 'application/octet-stream'}',
      size: (j['size'] as num?)?.toInt() ?? 0,
    );
  }
}

/// A help-centre article the bot's answer is based on.
typedef SupportCite = ({String slug, String title});

class SupportMessage {
  const SupportMessage({
    required this.id,
    required this.conversationId,
    required this.author,
    required this.body,
    required this.createdAt,
    this.authorName,
    this.attachment,
    this.kind,
    this.cites = const [],
    this.agentName,
  });

  final int id;
  final int conversationId;

  /// client | bot | agent | system
  final String author;
  final String? authorName;
  final String body;
  final SupportAttachment? attachment;

  /// meta.kind (system messages: "join" when an agent joined).
  final String? kind;
  final List<SupportCite> cites;

  /// meta.agentName (the agent of a "join" message).
  final String? agentName;
  final DateTime createdAt;

  static SupportMessage? tryParse(Object? j) => j is Map ? SupportMessage.fromJson(j.cast<String, dynamic>()) : null;

  factory SupportMessage.fromJson(Map<String, dynamic> j) {
    final meta = j['meta'] is Map ? (j['meta'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    return SupportMessage(
      id: (j['id'] as num?)?.toInt() ?? 0,
      conversationId: (j['conversationId'] as num?)?.toInt() ?? 0,
      author: '${j['author'] ?? 'system'}',
      authorName: j['authorName'] as String?,
      body: '${j['body'] ?? ''}',
      attachment: SupportAttachment.tryParse(j['attachment']),
      kind: meta['kind'] as String?,
      cites: [
        for (final c in (meta['cites'] is List ? meta['cites'] as List : const []))
          if (c is Map) (slug: '${c['slug'] ?? ''}', title: '${c['title'] ?? ''}'),
      ],
      agentName: meta['agentName'] as String?,
      createdAt: _date(j['createdAt']) ?? DateTime.now(),
    );
  }
}

class SupportSettings {
  const SupportSettings({this.botName = 'Kalks AI', this.greeting = '', this.ai = true, this.agentsOnline = 0, this.maxAttachmentMb = 10});
  final String botName;
  final String greeting;
  final bool ai;
  final int agentsOnline;
  final int maxAttachmentMb;

  factory SupportSettings.fromJson(Object? raw) {
    final j = raw is Map ? raw.cast<String, dynamic>() : const <String, dynamic>{};
    final name = j['botName'];
    return SupportSettings(
      botName: name is String && name.isNotEmpty ? name : 'Kalks AI',
      greeting: '${j['greeting'] ?? ''}',
      ai: j['ai'] != false,
      agentsOnline: (j['agentsOnline'] as num?)?.toInt() ?? 0,
      maxAttachmentMb: (j['maxAttachmentMb'] as num?)?.toInt() ?? 10,
    );
  }
}

/// `GET support/me`: settings, the open (or just-resolved) conversation and its messages.
class SupportHome {
  const SupportHome({required this.settings, this.conversation, this.messages = const []});
  final SupportSettings settings;
  final SupportConversation? conversation;
  final List<SupportMessage> messages;

  factory SupportHome.fromJson(Map<String, dynamic> j) => SupportHome(
    settings: SupportSettings.fromJson(j['settings']),
    conversation: SupportConversation.tryParse(j['conversation']),
    messages: parseMessages(j['messages']),
  );
}

List<SupportMessage> parseMessages(Object? raw) =>
    [for (final m in (raw is List ? raw : const [])) ?SupportMessage.tryParse(m)]..sort((a, b) => a.id.compareTo(b.id));

DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;

/// The conversation status chip (web STATUS: label key + tone).
({String label, KChipTone tone}) supportStatus(ConvStatus s) => switch (s) {
  'waiting' => (label: 'support.status.waiting', tone: KChipTone.warn),
  'assigned' => (label: 'support.status.assigned', tone: KChipTone.up),
  'resolved' => (label: 'support.status.resolved', tone: KChipTone.neutral),
  _ => (label: 'support.status.bot', tone: KChipTone.ember),
};

/* ------------------------------------------------------------------ attachments (web onFile) */

/// Files the chat accepts (web: accept="image/png,image/jpeg,image/gif,image/webp,application/pdf").
const List<String> kSupportAttachmentExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'];

/// The MIME type of an attachment by its name.
String supportMimeOf(String name) => switch (name.split('.').last.toLowerCase()) {
  'png' => 'image/png',
  'jpg' || 'jpeg' => 'image/jpeg',
  'gif' => 'image/gif',
  'webp' => 'image/webp',
  'pdf' => 'application/pdf',
  _ => 'application/octet-stream',
};

enum AttachmentProblem { tooLarge, unsupported }

/// Why a file can't be attached (web onFile: larger than the broker's limit, or not an image / PDF); null when fine.
AttachmentProblem? attachmentProblem({required int size, required String mime, int maxMb = 10}) {
  if (size > maxMb * 1024 * 1024) return AttachmentProblem.tooLarge;
  if (!RegExp(r'^image/(png|jpe?g|gif|webp)$').hasMatch(mime) && mime != 'application/pdf') return AttachmentProblem.unsupported;
  return null;
}

/* ------------------------------------------------------------------ the bot's safe markdown (web Rich) */

/// A run of text, bold or not (`**bold**`).
typedef RichRun = ({String text, bool bold});

/// A paragraph (lines) or a bullet list (items), each line a list of runs.
class RichBlock {
  const RichBlock({required this.list, required this.lines});
  final bool list;
  final List<List<RichRun>> lines;
}

final RegExp _bullet = RegExp(r'^\s*[-•]\s+');

List<RichRun> _inline(String s) {
  final parts = s.split('**');
  return [
    for (var i = 0; i < parts.length; i++)
      if (parts[i].isNotEmpty) (text: parts[i], bold: i.isOdd),
  ];
}

/// Minimal safe markdown (web Rich): **bold**, "- " bullets, paragraphs split by blank lines. Text only.
List<RichBlock> parseChatRich(String text) {
  final out = <RichBlock>[];
  for (final b in text.split(RegExp(r'\n{2,}'))) {
    final lines = b.split('\n');
    final list = lines.every((l) => _bullet.hasMatch(l) || l.trim().isEmpty);
    if (list) {
      out.add(
        RichBlock(
          list: true,
          lines: [
            for (final l in lines)
              if (l.trim().isNotEmpty) _inline(l.replaceFirst(_bullet, '')),
          ],
        ),
      );
    } else {
      out.add(RichBlock(list: false, lines: [for (final l in lines) _inline(l)]));
    }
  }
  return out;
}

/// The greeting under the bot's name (web: t("support.greeting") + the broker's greeting without its own "Hi …." opening).
String greetingRest(String greeting) => greeting.replaceFirst(RegExp(r'^Hi[^.]*\.\s*'), '');
