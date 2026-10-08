// The chat's pieces (port of apps/crm/components/support/live-chat.tsx rendering helpers): the bot's avatar, the
// typing dots, the bot's safe markdown (Rich), attachments (image preview / file tile, opened in the share sheet) and
// one message row (client, bot, agent, system and "agent joined" lines). Shared by the live chat, the conversation
// history and Ask Ezymex AI.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/files.dart';
import '../../../core/format/format.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../support_data.dart';
import '../support_models.dart';

/// "18:33" in the reader's language (web hhmm: the phone's local time).
String hhmm(BuildContext context, DateTime d) => latinDigits(DateFormat.Hm(intlLocale(context.t.locale)).format(d.toLocal()));

/// The bot's round ember avatar with the sparkles (web BotAvatar).
class BotAvatar extends StatelessWidget {
  const BotAvatar({super.key, this.size = 32});
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
      child: Icon(LucideIcons.sparkles, size: size * 0.45, color: k.onEmber),
    );
  }
}

/// The brand disc with the sparkles (web .k-brand-disc Spark of Ask Ezymex AI).
class AiSpark extends StatelessWidget {
  const AiSpark({super.key, this.size = 40});
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(center: const Alignment(-0.4, -0.5), radius: 0.62 * 1.42, colors: [mixOklab(k.ember, Colors.white, 0.62), k.ember]),
        boxShadow: [BoxShadow(color: k.ember.withValues(alpha: 0.55), offset: const Offset(0, 10), blurRadius: 22, spreadRadius: -10)],
      ),
      child: Icon(LucideIcons.sparkles, size: size * 0.46, color: Colors.white),
    );
  }
}

/// Three pulsing dots (the bot or an agent is writing).
class TypingDots extends StatefulWidget {
  const TypingDots({super.key, this.label});

  /// Screen-reader text (e.g. "Ezymex AI is writing an answer").
  final String? label;

  @override
  State<TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<TypingDots> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      label: widget.label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < 3; i++)
                Container(
                  width: 6,
                  height: 6,
                  margin: EdgeInsetsDirectional.only(end: i < 2 ? 4 : 0),
                  decoration: BoxDecoration(
                    color: k.fg3.withValues(alpha: 0.3 + 0.7 * (0.5 + 0.5 * math.sin((_c.value - i * 0.18) * 2 * math.pi))),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The bot's answer text: **bold**, bullets, paragraphs (web Rich). `strong` is the bold colour.
class ChatRich extends StatelessWidget {
  const ChatRich(this.text, {super.key, required this.style, this.strong});
  final String text;
  final TextStyle style;
  final Color? strong;

  @override
  Widget build(BuildContext context) {
    final bold = style.copyWith(fontWeight: FontWeight.w600, color: strong ?? context.k.fg);
    List<InlineSpan> spans(List<RichRun> runs) => [for (final r in runs) TextSpan(text: r.text, style: r.bold ? bold : null)];
    final blocks = parseChatRich(text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var bi = 0; bi < blocks.length; bi++)
          Padding(
            padding: EdgeInsets.only(top: bi > 0 ? 8 : 0),
            child: blocks[bi].list
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final line in blocks[bi].lines)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(width: 16, child: Text('•', style: style)),
                              Expanded(
                                child: Text.rich(TextSpan(style: style, children: spans(line))),
                              ),
                            ],
                          ),
                        ),
                    ],
                  )
                : Text.rich(
                    TextSpan(
                      style: style,
                      children: [
                        for (var li = 0; li < blocks[bi].lines.length; li++) ...[if (li > 0) const TextSpan(text: '\n'), ...spans(blocks[bi].lines[li])],
                      ],
                    ),
                  ),
          ),
      ],
    );
  }
}

/// Downloads an attachment and opens the share sheet (the web opens it in a new tab).
Future<void> openSupportAttachment(BuildContext context, WidgetRef ref, SupportAttachment a) async {
  final t = context.t;
  try {
    final file = await ref.read(supportAttachmentProvider(a.id).future);
    final ok = await shareFile(file, fallbackName: a.name);
    if (!ok) throw const ApiException(status: 0, code: 'unavailable', message: '');
  } catch (e) {
    ref.read(notificationsProvider.notifier).toast(NotificationKind.error, t('common.error'), description: errorText(e, t));
  }
}

/// An attachment in a message: an image preview, else a file tile with its size (web AttachmentView).
class AttachmentView extends ConsumerWidget {
  const AttachmentView({super.key, required this.attachment, required this.mine});
  final SupportAttachment attachment;
  final bool mine;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = attachment;
    void open() => openSupportAttachment(context, ref, a);
    if (a.image) {
      final file = ref.watch(supportAttachmentProvider(a.id));
      return Padding(
        padding: const EdgeInsets.only(top: 4),
        child: file.when(
          loading: () => const KSkeleton(width: 200, height: 140, radius: 12),
          error: (_, _) => _FileTile(a: a, mine: mine, onTap: open),
          data: (f) => KPressable(
            onTap: open,
            semanticLabel: a.name,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 192, maxWidth: 240),
                child: Image.memory(
                  f.bytes,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => _FileTile(a: a, mine: mine, onTap: open),
                ),
              ),
            ),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: _FileTile(a: a, mine: mine, onTap: open),
    );
  }
}

class _FileTile extends StatelessWidget {
  const _FileTile({required this.a, required this.mine, required this.onTap});
  final SupportAttachment a;
  final bool mine;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      semanticLabel: a.name,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
        decoration: BoxDecoration(
          color: mine ? k.emberSoft : k.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: mine ? k.ember.withValues(alpha: 0.3) : k.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(12)),
              child: Icon(LucideIcons.fileText, size: 16, color: k.ember),
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 180),
                    child: Text(
                      a.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.label.copyWith(color: k.fg),
                    ),
                  ),
                  Text(
                    context.t('support.attachmentSize', {'size': math.max(1, (a.size / 1024).round())}),
                    // "178 KB · PDF" in every language: keep its order in right-to-left pages
                    textDirection: TextDirection.ltr,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The articles a bot answer is based on (small pills under it).
class CitePills extends StatelessWidget {
  const CitePills(this.cites, {super.key, this.bordered = true});
  final List<SupportCite> cites;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final c in cites)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: k.surface2,
                borderRadius: BorderRadius.circular(10),
                border: bordered ? Border.all(color: k.line) : null,
              ),
              child: Text(
                c.title,
                style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ),
        ],
      ),
    );
  }
}

/// A chat bubble's corners: 16 everywhere but the speaker's bottom corner (web rounded-2xl rounded-es-md / ee-md).
BorderRadius bubbleRadius(BuildContext context, {required bool mine, double r = 16, double tail = 6}) => BorderRadiusDirectional.only(
  topStart: Radius.circular(r),
  topEnd: Radius.circular(r),
  bottomStart: Radius.circular(mine ? r : tail),
  bottomEnd: Radius.circular(mine ? tail : r),
).resolve(Directionality.of(context));

/// One message of the chat or a transcript (web MessageRow).
class MessageRow extends StatelessWidget {
  const MessageRow({super.key, required this.m, required this.botName, required this.meName});
  final SupportMessage m;
  final String botName;
  final String meName;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    if (m.author == 'system') {
      if (m.kind == 'join') {
        return Center(
          child: Container(
            padding: const EdgeInsetsDirectional.fromSTEB(4, 4, 14, 4),
            decoration: BoxDecoration(
              color: k.upSoft,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: k.up.withValues(alpha: 0.25)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                KAvatar(name: m.agentName ?? t('support.agent'), size: 22),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(m.body, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12)),
                ),
                const SizedBox(width: 8),
                Text(hhmm(context, m.createdAt), style: context.text.mono(10.5, color: k.fg3)),
              ],
            ),
          ),
        );
      }
      return Center(
        child: FractionallySizedBox(
          widthFactor: 0.9,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: k.surface2, borderRadius: BorderRadius.circular(14)),
              child: Text(
                m.body,
                textAlign: TextAlign.center,
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ),
          ),
        ),
      );
    }
    final mine = m.author == 'client';
    final bot = m.author == 'bot';
    final name = mine ? t('support.you') : (bot ? botName : (m.authorName ?? t('support.supportName')));
    final avatar = bot ? const BotAvatar(size: 28) : KAvatar(name: mine ? meName : (m.authorName ?? t('support.agent')), size: 28);
    final textStyle = context.text.callout.copyWith(fontSize: 13.5, height: 1.5, color: mine ? k.onEmber : (bot ? k.fg2 : k.fg));
    Widget body(double maxWidth) => ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: Column(
        crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(color: k.fg2, fontSize: 11),
                  ),
                ),
                const SizedBox(width: 8),
                Text(hhmm(context, m.createdAt), style: context.text.mono(11, color: k.fg3)),
              ],
            ),
          ),
          if (m.body.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: mine ? k.ember : (bot ? k.surface2 : k.surface3),
                borderRadius: bubbleRadius(context, mine: mine),
                border: mine ? null : Border.all(color: bot ? k.ember.withValues(alpha: 0.2) : k.line),
              ),
              child: ChatRich(m.body, style: textStyle, strong: mine ? k.onEmber : k.fg),
            ),
          if (m.attachment != null) AttachmentView(attachment: m.attachment!, mine: mine),
          if (bot && m.cites.isNotEmpty) CitePills(m.cites),
        ],
      ),
    );
    return LayoutBuilder(
      builder: (context, c) {
        final b = Flexible(child: body(c.maxWidth * 0.8));
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
          children: mine ? [b, const SizedBox(width: 10), avatar] : [avatar, const SizedBox(width: 10), b],
        );
      },
    );
  }
}
