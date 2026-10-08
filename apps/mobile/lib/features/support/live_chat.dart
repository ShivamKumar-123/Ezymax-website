// The live support chat (port of LiveChat in apps/crm/components/support/live-chat.tsx): the AI bot answers first
// (streamed), hands over to a person on request, agents reply live, attachments (images / PDF), end the chat and rate
// it. The Support page shows it as a card; the floating launcher and "Continue in chat" open it in a tall sheet.
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/lifecycle.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'live_chat_controller.dart';
import 'support_data.dart';
import 'support_models.dart';
import 'widgets/message_row.dart';

/// A chat controller on the app's API, stream, toasts and file picker (already started).
LiveChatController createLiveChatController(WidgetRef ref) => LiveChatController(
  api: ref.read(apiProvider),
  frames: ref.read(supportFramesProvider),
  t: () => ref.read(tProvider),
  toast: (kind, title, {description}) => ref.read(notificationsProvider.notifier).toast(kind, title, description: description),
  picker: () => ref.read(supportPickerProvider),
  foreground: () => ref.read(appForegroundProvider),
)..start();

/// Suggested first questions (translation keys; the translated text is sent as the message).
const List<String> kSupportQuick = ['support.quick.verify', 'support.quick.deposit', 'support.quick.withdrawal', 'support.quick.stopOut'];

enum LiveChatVariant { page, sheet }

/// The page card's smallest height (small phones scroll the page to reach the composer).
const double kSupportChatMinHeight = 420;

class LiveChat extends ConsumerStatefulWidget {
  const LiveChat({super.key, this.variant = LiveChatVariant.page, this.onClose, this.controller, this.height});
  final LiveChatVariant variant;

  /// The page card's height (the Support page fits it below its header, above the tab bar); null = the viewport
  /// between the shell's bars.
  final double? height;

  /// The sheet's close button.
  final VoidCallback? onClose;

  /// A controller owned by the caller (the Support page shares it with the history); else the chat makes its own.
  final LiveChatController? controller;

  @override
  ConsumerState<LiveChat> createState() => _LiveChatState();
}

class _LiveChatState extends ConsumerState<LiveChat> {
  LiveChatController? _own;
  final ScrollController _scroll = ScrollController();
  final FocusNode _focus = FocusNode();
  String _sig = '';

  LiveChatController get c => widget.controller ?? _own!;

  @override
  void initState() {
    super.initState();
    if (widget.controller == null) _own = createLiveChatController(ref);
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _own?.dispose();
    _scroll.dispose();
    _focus.dispose();
    super.dispose();
  }

  /// Keeps the newest message in view (web: scroll to the bottom on every change).
  void _follow() {
    final sig = '${c.msgs.length}|${c.stream?.text.length}|${c.agentTyping}|${c.status}|${c.home != null}';
    if (sig == _sig) return;
    _sig = sig;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients && _scroll.offset > 0) _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOutCubic);
    });
  }

  Future<void> _menu() async {
    final t = context.t;
    final c = this.c;
    final v = await showKActionSheet<String>(
      context,
      actions: [
        KAction(label: t('support.menu.talkToPerson'), value: 'person', icon: LucideIcons.userRound),
        if (c.conv != null && !c.resolved) KAction(label: t('support.menu.endChat'), value: 'end', icon: LucideIcons.circleX),
        KAction(label: t('support.menu.newChat'), value: 'new', icon: LucideIcons.rotateCcw),
      ],
    );
    switch (v) {
      case 'person':
        if (c.human) {
          final name = c.conv?.assigneeName;
          ref
              .read(notificationsProvider.notifier)
              .toast(NotificationKind.info, c.status == 'assigned' ? t('support.toast.chattingWith', {'name': name ?? ''}) : t('support.toast.inQueue'));
        } else {
          await c.handover();
        }
      case 'end':
        await c.endChat();
      case 'new':
        c.newChat();
    }
  }

  @override
  Widget build(BuildContext context) {
    final sheet = widget.variant == LiveChatVariant.sheet;
    final chat = ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        _follow();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(c: c, onMenu: _menu, onClose: sheet ? widget.onClose : null, sheet: sheet),
            Expanded(child: _messages(context)),
            _composer(context),
          ],
        );
      },
    );
    if (sheet) return KeyedSubtree(key: const ValueKey('support-chat'), child: chat);
    // web: h-[calc(100vh-180px)] (the viewport between its bars); here the space between the shell's header and tab bar
    final mq = MediaQuery.of(context);
    final h = widget.height ?? mq.size.height - mq.padding.top - mq.padding.bottom - 24;
    return KCard(
      key: const ValueKey('support-chat'),
      padding: EdgeInsets.zero,
      child: SizedBox(height: h < kSupportChatMinHeight ? kSupportChatMinHeight : h, child: chat),
    );
  }

  Widget _messages(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final c = this.c;
    final me = ref.watch(meProvider);
    final botName = c.botName;
    final items = <Widget>[
      if (c.home == null && !c.failed)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Center(child: CupertinoActivityIndicator(color: k.fg3)),
        ),
      if (c.failed)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Center(
            child: KRichText(
              '${t('support.unavailable')} <retry>${t('common.retry')}</retry>',
              textAlign: TextAlign.center,
              style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
              tags: {'retry': KTag.link(c.load)},
            ),
          ),
        ),
      if (c.home != null && c.showGreeting)
        _BotBubble(
          botName: botName,
          child: Text('${t('support.greeting', {'name': me?.firstName ?? ''})} ${greetingRest(c.settings.greeting)}'.trim(), style: _bubbleText(context)),
        ),
      for (final m in c.msgs) MessageRow(m: m, botName: botName, meName: me?.name ?? ''),
      if (c.stream != null && c.status == 'bot')
        KeyedSubtree(
          key: const ValueKey('bot-streaming'),
          child: _BotBubble(
            botName: botName,
            child: c.stream!.text.isEmpty ? const TypingDots() : ChatRich(c.stream!.text, style: _bubbleText(context)),
          ),
        ),
      if (c.agentTyping && c.status == 'assigned')
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            KAvatar(name: c.conv?.assigneeName ?? t('support.agent'), size: 28),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: k.surface3,
                borderRadius: bubbleRadius(context, mine: false),
                border: Border.all(color: k.line),
              ),
              child: const TypingDots(),
            ),
          ],
        ),
      if (c.canRate) _Csat(c: c),
      if (c.resolved && c.conv?.csat != null)
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(color: k.surface2, borderRadius: BorderRadius.circular(14)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  t('support.csat.rated', {'rating': c.conv!.csat!.rating}),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
                const SizedBox(width: 4),
                Icon(Icons.star_rounded, size: 13, color: k.gold),
              ],
            ),
          ),
        ),
    ];
    return ListView.separated(
      controller: _scroll,
      reverse: true,
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 16),
      itemBuilder: (_, i) => items[items.length - 1 - i],
    );
  }

  Widget _composer(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final c = this.c;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final agentName = c.conv?.assigneeName;
    final placeholder = c.status == 'assigned' && agentName != null
        ? t('support.composer.messageTo', {'name': agentName.split(' ').first})
        : (c.resolved ? t('support.composer.newChat') : t('support.composer.ask', {'name': c.botName}));
    final quick = c.showGreeting || (c.status == 'bot' && c.msgs.length < 3);
    Widget pill(String label, VoidCallback? onTap) => KPressable(
      onTap: onTap,
      semanticLabel: label,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 150),
        opacity: onTap == null ? 0.5 : 1,
        child: Container(
          height: 30,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: k.line),
          ),
          child: Text(
            label,
            style: context.text.caption.copyWith(color: k.fg2, fontSize: 12, fontWeight: FontWeight.w500),
          ),
        ),
      ),
    );
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (quick) ...[
            SizedBox(
              key: const ValueKey('support-quick'),
              height: 34,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final q in kSupportQuick) ...[pill(t(q), c.sending || c.home == null ? null : () => c.send(raw: t(q))), const SizedBox(width: 6)],
                  if (!c.human) pill(t('support.menu.talkToPerson'), c.home == null ? null : c.handover),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsetsDirectional.fromSTEB(6, 5, 5, 5),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _focus.hasFocus ? k.ember.withValues(alpha: 0.5) : k.line),
            ),
            child: Row(
              children: [
                KPressable(
                  onTap: c.uploading || c.home == null ? null : c.attach,
                  semanticLabel: t('support.composer.attach'),
                  minSize: 40,
                  child: SizedBox.square(
                    dimension: 36,
                    child: Center(
                      child: c.uploading ? CupertinoActivityIndicator(color: k.fg3, radius: 8) : Icon(LucideIcons.paperclip, size: 17, color: k.fg3),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: TextField(
                    key: const ValueKey('support-composer'),
                    controller: c.input,
                    focusNode: _focus,
                    onChanged: c.onType,
                    onSubmitted: (_) => c.send(),
                    textInputAction: TextInputAction.send,
                    inputFormatters: [LengthLimitingTextInputFormatter(4000)],
                    style: context.text.body.copyWith(fontSize: 14),
                    cursorColor: k.ember,
                    minLines: 1,
                    maxLines: 4,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: placeholder,
                      hintMaxLines: 1,
                      hintStyle: context.text.body.copyWith(fontSize: 14, color: k.fg3),
                      contentPadding: const EdgeInsets.symmetric(vertical: 9),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: c.input,
                  builder: (context, v, _) {
                    final enabled = v.text.trim().isNotEmpty && !c.sending && c.home != null;
                    return KPressable(
                      onTap: enabled ? c.send : null,
                      semanticLabel: t('common.send'),
                      minSize: 40,
                      child: AnimatedOpacity(
                        duration: const Duration(milliseconds: 150),
                        opacity: enabled || c.sending ? 1 : 0.4,
                        child: Container(
                          width: 36,
                          height: 36,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                          child: c.sending
                              ? CupertinoActivityIndicator(color: k.onEmber, radius: 8)
                              : Transform.flip(
                                  flipX: rtl,
                                  child: Icon(LucideIcons.sendHorizontal, size: 16, color: k.onEmber),
                                ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            t('support.disclaimer', {'name': c.botName}),
            textAlign: TextAlign.center,
            style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
        ],
      ),
    );
  }
}

TextStyle _bubbleText(BuildContext context) => context.text.callout.copyWith(fontSize: 13.5, height: 1.5, color: context.k.fg2);

/// A bot bubble that isn't a message yet (the greeting, the answer being written).
class _BotBubble extends StatelessWidget {
  const _BotBubble({required this.botName, required this.child});
  final String botName;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return LayoutBuilder(
      builder: (context, cons) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const BotAvatar(size: 28),
          const SizedBox(width: 10),
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: cons.maxWidth * 0.8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(botName, style: context.text.caption.copyWith(color: k.fg2, fontSize: 11)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: k.surface2,
                      borderRadius: bubbleRadius(context, mine: false),
                      border: Border.all(color: k.ember.withValues(alpha: 0.2)),
                    ),
                    child: child,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.c, required this.onMenu, required this.onClose, required this.sheet});
  final LiveChatController c;
  final VoidCallback onMenu;
  final VoidCallback? onClose;
  final bool sheet;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final status = c.status;
    final agentName = c.conv?.assigneeName;
    final assigned = status == 'assigned' && agentName != null;
    final name = assigned ? agentName : (status == 'waiting' ? t('support.header.supportTeam') : c.botName);
    final sub = status == 'assigned'
        ? t('support.header.agentSub')
        : status == 'waiting'
        ? (c.settings.agentsOnline > 0 ? t('support.header.connecting') : t('support.header.replySoon'))
        : (!c.settings.ai ? t('support.header.helpCentre') : t('support.header.instant'));
    final (String chip, KChipTone tone) = switch (status) {
      'assigned' => (t('support.chip.liveAgent'), KChipTone.up),
      'waiting' => (t('support.status.waiting'), KChipTone.warn),
      'resolved' => (t('support.status.resolved'), KChipTone.neutral),
      _ => (t('support.status.bot'), KChipTone.ember),
    };
    return Container(
      padding: EdgeInsetsDirectional.fromSTEB(sheet ? 16 : 20, sheet ? 4 : 14, 10, 14),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Row(
        children: [
          if (assigned)
            SizedBox(
              width: 54,
              height: 36,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  const PositionedDirectional(start: 0, top: 4, child: BotAvatar(size: 28)),
                  PositionedDirectional(
                    start: 18,
                    top: 0,
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: k.surface, width: 2),
                      ),
                      child: KAvatar(name: agentName, size: 34),
                    ),
                  ),
                  PositionedDirectional(
                    start: 46,
                    bottom: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: k.up,
                        shape: BoxShape.circle,
                        border: Border.all(color: k.surface, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            const BotAvatar(size: 36),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.headline.copyWith(fontWeight: FontWeight.w500),
                      ),
                    ),
                    const SizedBox(width: 8),
                    KChip(label: chip, tone: tone, dot: true, small: true),
                  ],
                ),
                const SizedBox(height: 1),
                Text(
                  sub,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          KIconButton(icon: LucideIcons.ellipsis, size: 34, filled: true, semanticLabel: t('support.menu.aria'), onPressed: onMenu),
          if (onClose != null) KIconButton(icon: LucideIcons.x, size: 34, semanticLabel: t('support.closeChat'), onPressed: onClose),
        ],
      ),
    );
  }
}

/// "How was this chat?": stars, an optional comment and Send rating (web csat block).
class _Csat extends StatelessWidget {
  const _Csat({required this.c});
  final LiveChatController c;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Center(
      key: const ValueKey('csat'),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: k.line),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              t('support.csat.question'),
              textAlign: TextAlign.center,
              style: context.text.footnote.copyWith(color: k.fg2),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var n = 1; n <= 5; n++)
                  KPressable(
                    onTap: () => c.setRating(n),
                    semanticLabel: t('support.csat.stars', {'count': n}),
                    minSize: 36,
                    child: Padding(
                      padding: const EdgeInsets.all(2),
                      child: n <= c.rating ? Icon(Icons.star_rounded, size: 24, color: k.gold) : Icon(LucideIcons.star, size: 20, color: k.fg3),
                    ),
                  ),
              ],
            ),
            if (c.rating > 0) ...[
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: k.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: k.line),
                ),
                child: TextField(
                  controller: c.comment,
                  minLines: 2,
                  maxLines: 2,
                  inputFormatters: [LengthLimitingTextInputFormatter(1000)],
                  style: context.text.footnote.copyWith(color: k.fg),
                  cursorColor: k.ember,
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: t('support.csat.placeholder'),
                    hintStyle: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              KButton(label: t('support.csat.send'), size: KButtonSize.sm, onPressed: c.rate),
            ],
          ],
        ),
      ),
    );
  }
}
