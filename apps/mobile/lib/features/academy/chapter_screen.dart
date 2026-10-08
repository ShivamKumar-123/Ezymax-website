// Academy › chapter reader (/academy/chapter/:slug): port of the web's LiveChapter (components/academy/live/reader.tsx),
// phone layout (the xl side rails with the chapter list, contents and reading % are desktop-only):
//   reading bar · back link · chips · title · summary · meta · markdown body · key takeaways · practise in Kalks
//   Trader · chapter quiz · previous / next chapter · risk note.
// Reading progress is reported like the web: the furthest point seen, throttled (1.5 s), on leave and when the app
// goes to the background; the visit itself is registered after 0.8 s.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'academy_api.dart';
import 'widgets/markdown.dart';
import 'widgets/quiz.dart';
import 'widgets/shared.dart';

class AcademyChapterScreen extends ConsumerWidget {
  const AcademyChapterScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(academyChapterProvider(slug));
    if (view.value case final v? when v.slug == slug) return _Reader(key: ValueKey(slug), view: v);
    if (view.hasError && !view.isLoading) {
      return KPageScroll(
        onRefresh: () async => ref.invalidate(academyChapterProvider(slug)),
        children: [AcademyUnavailable(error: view.error, onRetry: () => ref.invalidate(academyChapterProvider(slug)))],
      );
    }
    return const KPageScroll(children: [_ReaderSkeleton()]);
  }
}

class _ReaderSkeleton extends StatelessWidget {
  const _ReaderSkeleton();

  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(height: 20),
      KSkeleton(width: 280, height: 30, radius: 10),
      SizedBox(height: 16),
      KSkeleton(),
      SizedBox(height: 8),
      KSkeleton(width: 260),
      SizedBox(height: 16),
      KSkeleton(height: 256, radius: 16),
    ],
  );
}

class _Reader extends ConsumerStatefulWidget {
  const _Reader({super.key, required this.view});
  final ChapterView view;

  @override
  ConsumerState<_Reader> createState() => _ReaderState();
}

class _ReaderState extends ConsumerState<_Reader> {
  final _scroll = ScrollController();
  final _article = GlobalKey();
  late final AcademyApi _api;
  late final ProviderContainer _container;
  late final AppLifecycleListener _life;
  late int _pct = widget.view.progress.readPct;
  late int _sent = widget.view.progress.readPct;
  late int _max = widget.view.progress.readPct;
  late bool _completed = widget.view.progress.completed;
  Timer? _first, _throttle;

  String get _slug => widget.view.slug;

  @override
  void initState() {
    super.initState();
    _api = ref.read(academyApiProvider);
    _container = ProviderScope.containerOf(context, listen: false);
    _scroll.addListener(_onScroll);
    _life = AppLifecycleListener(onHide: () => unawaited(_flush()));
    // register the visit (and the part that is already visible) once
    _first = Timer(const Duration(milliseconds: 800), () {
      _onScroll();
      if (_sent == 0 && _max == 0) {
        unawaited(_api.progress(_slug, 0));
      } else {
        unawaited(_flush());
      }
    });
  }

  @override
  void dispose() {
    _first?.cancel();
    _throttle?.cancel();
    final sent = _flush();
    _life.dispose();
    // the pages underneath (phase, home) show the new reading progress, as the web's pages refetch when opened
    final c = _container;
    unawaited(
      Future<void>(() async {
        await sent;
        try {
          c.invalidate(academyCatalogProvider);
        } catch (_) {}
      }),
    );
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _flush() async {
    final v = _max;
    if (v <= _sent) return;
    _sent = v;
    await _api.progress(_slug, v);
  }

  /// How far through the article the reader has scrolled (web: window height − article top over article height).
  void _onScroll() {
    if (!mounted) return;
    final box = _article.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.attached || !box.hasSize) return;
    final top = box.localToGlobal(Offset.zero).dy;
    final seen = MediaQuery.sizeOf(context).height - top;
    final p = (seen / (box.size.height <= 0 ? 1 : box.size.height) * 100).round().clamp(0, 100);
    if (p > _max) {
      _max = p;
      setState(() => _pct = p);
      _throttle ??= Timer(const Duration(milliseconds: 1500), () {
        _throttle = null;
        unawaited(_flush());
      });
    }
  }

  void _onQuiz(QuizReply r) {
    if (r.completed) setState(() => _completed = true);
    // the phase page, home and progress show the new state when the reader returns
    ref.invalidate(academyCatalogProvider);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final v = widget.view;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final meta = context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular);
    Widget metaItem(IconData icon, String text) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: k.fg3),
        const SizedBox(width: 6),
        Text(text, style: meta),
      ],
    );

    final article = Column(
      key: _article,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            KChip(label: trackLabel(t, v.track), tone: trackTone(v.track), icon: trackIcon(v.track)),
            KChip(label: levelLabel(t, v.phase.level), tone: levelTone(v.phase.level)),
            if (v.phase.elective) KChip(label: t('academy.elective')),
            if (_completed) KChip(label: t('common.completed'), tone: KChipTone.up, dot: true),
          ],
        ),
        const SizedBox(height: 16),
        Text(v.title, style: context.text.largeTitle.copyWith(fontSize: 28, fontWeight: FontWeight.w500, height: 1.2, letterSpacing: -0.5)),
        const SizedBox(height: 8),
        Text(v.summary, style: context.text.body.copyWith(color: k.fg2, fontSize: 15, height: 1.55)),
        const SizedBox(height: 14),
        Wrap(
          spacing: 18,
          runSpacing: 6,
          children: [
            metaItem(LucideIcons.bookOpen, t('academy.reader.chapterOf', {'n': v.index, 'total': v.count})),
            metaItem(LucideIcons.clock, t('academy.reader.minRead', {'count': v.minutes})),
            metaItem(LucideIcons.graduationCap, t('academy.reader.quizLength', {'count': v.quiz.length})),
          ],
        ),
        const SizedBox(height: 18),
        Container(height: 0.6, color: k.line),
        const SizedBox(height: 22),
        Markdown(v.body),
        if (v.takeaways.isNotEmpty) ...[
          const SizedBox(height: 28),
          KCard(
            key: const ValueKey('takeaways'),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(LucideIcons.lightbulb, size: 16, color: k.gold),
                    const SizedBox(width: 8),
                    Expanded(child: Text(t('academy.reader.takeaways'), style: context.text.headline.copyWith(fontSize: 16))),
                  ],
                ),
                const SizedBox(height: 10),
                for (final tk in v.takeaways)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Icon(LucideIcons.circleCheck, size: 16, color: k.up),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(tk, style: context.text.body.copyWith(color: k.fg2, fontSize: 14, height: 1.55)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        if (v.practice != null) ...[
          const SizedBox(height: 16),
          KCard(
            key: const ValueKey('practice'),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SoftBadge(icon: LucideIcons.monitorPlay, tone: KChipTone.ember),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AcademyLabel('${t('academy.practice.inTrader')}${v.practice!.symbol != null ? ' · ${v.practice!.symbol}' : ''}'),
                          const SizedBox(height: 4),
                          Text(v.practice!.label, style: context.text.body.copyWith(color: k.fg2, fontSize: 14, height: 1.55)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                PracticeButton(small: true, label: t('academy.practice.openDemo')),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        ChapterQuiz(key: ValueKey('quiz-${v.slug}'), slug: v.slug, questions: v.quiz, passedBefore: v.progress.completed, onDone: _onQuiz),
        const SizedBox(height: 22),
        if (v.prev != null) ...[
          _NavRow(
            key: const ValueKey('prev-chapter'),
            caption: t('academy.reader.previous'),
            title: v.prev!.title,
            icon: rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft,
            onTap: () => context.pushReplacement('/academy/chapter/${v.prev!.slug}'),
          ),
          const SizedBox(height: 10),
        ],
        if (v.next != null)
          _NavRow(
            key: const ValueKey('next-chapter'),
            caption: t('common.next'),
            title: v.next!.title,
            icon: rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight,
            end: true,
            onTap: () => context.pushReplacement('/academy/chapter/${v.next!.slug}'),
          )
        else
          _NavRow(
            title: t('academy.reader.end'),
            icon: rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight,
            end: true,
            onTap: () => context.go('/academy/progress'),
          ),
        const RiskNote(),
      ],
    );

    return Stack(
      children: [
        KPageScroll(
          controller: _scroll,
          onRefresh: () async {
            ref.invalidate(academyChapterProvider(_slug));
            await ref.read(academyChapterProvider(_slug).future).then((_) {}, onError: (Object _) {});
          },
          children: [
            AcademyBackLink(href: '/academy/phase/${v.phase.slug}', label: t('academy.phaseTitle', {'n': v.phase.order, 'title': v.phase.title})),
            const SizedBox(height: 14),
            article,
          ],
        ),
        // the reading bar under the header (web: fixed 3 px bar at the top of the window)
        Positioned(
          top: MediaQuery.paddingOf(context).top,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: AnimatedFractionallySizedBox(
                key: const ValueKey('read-progress'),
                duration: const Duration(milliseconds: 300),
                widthFactor: _pct / 100,
                child: Container(height: 3, color: k.ember),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _NavRow extends StatelessWidget {
  const _NavRow({super.key, this.caption, required this.title, required this.icon, required this.onTap, this.end = false});
  final String? caption;
  final String title;
  final IconData icon;
  final VoidCallback onTap;
  final bool end;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final text = Expanded(
      child: Column(
        crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (caption != null)
            Text(
              caption!,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
            ),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: end ? TextAlign.end : TextAlign.start,
            style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
    final ic = Icon(icon, size: 16, color: k.fg3);
    return KPressable(
      onTap: onTap,
      semanticLabel: title,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: k.cardBg,
          borderRadius: BorderRadius.circular(k.rowRadius),
          border: Border.all(color: k.cardBorder),
        ),
        child: Row(children: end ? [text, const SizedBox(width: 12), ic] : [ic, const SizedBox(width: 12), text]),
      ),
    );
  }
}
