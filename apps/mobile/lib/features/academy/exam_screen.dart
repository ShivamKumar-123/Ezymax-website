// Academy › final exam (/academy/phase/:phase/exam): port of the web's LiveExam (components/academy/live/exam.tsx):
//   back link · chips · title · intro · locked card (Back to the chapters) or: result card (score, Retake exam,
//   certificate with Download / Verify page) · question cards · sticky "answered · Submit exam" bar · previous attempts.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'academy_api.dart';
import 'widgets/quiz.dart';
import 'widgets/shared.dart';

class AcademyExamScreen extends ConsumerStatefulWidget {
  const AcademyExamScreen({super.key, required this.phase});
  final String phase;

  @override
  ConsumerState<AcademyExamScreen> createState() => _AcademyExamScreenState();
}

class _AcademyExamScreenState extends ConsumerState<AcademyExamScreen> {
  final _scroll = ScrollController();
  List<int?> _answers = const [];
  String _examKey = '';
  ExamReply? _result;
  bool _busy = false;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Resets the answers when the exam itself changes, not when attempts are refreshed after a retake.
  void _sync(ExamView data) {
    final key = '${data.phase.slug}:${data.questions.length}';
    if (key != _examKey) {
      _examKey = key;
      _answers = List.filled(data.questions.length, null);
    }
  }

  void _toTop({bool animate = true}) {
    if (!_scroll.hasClients) return;
    if (animate) {
      _scroll.animateTo(0, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic);
    } else {
      _scroll.jumpTo(0);
    }
  }

  Future<void> _submit(ExamView data) async {
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    setState(() => _busy = true);
    try {
      final r = await ref.read(academyApiProvider).exam(widget.phase, _answers);
      if (!mounted) return;
      setState(() => _result = r);
      _toTop();
      ref.invalidate(academyCatalogProvider);
      if (r.certificateIssued) {
        KHaptics.success();
        ref.invalidate(academyCertificatesProvider);
        notes.toast(
          NotificationKind.success,
          t('academy.toast.certIssued'),
          description: t('academy.phaseTitle', {'n': data.phase.order, 'title': data.phase.title}),
        );
      }
    } on ApiException catch (e) {
      notes.toast(NotificationKind.error, t('academy.toast.examFailed'), description: localizeError(e, t));
    } catch (_) {
      notes.toast(NotificationKind.error, t('academy.toast.examFailed'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _retake(ExamView data) {
    setState(() {
      _result = null;
      _answers = List.filled(data.questions.length, null);
    });
    ref.invalidate(academyExamProvider(widget.phase));
    _toTop(animate: false);
  }

  @override
  Widget build(BuildContext context) {
    final exam = ref.watch(academyExamProvider(widget.phase));
    final data = exam.value;
    if (data != null) _sync(data);
    final showBar = data != null && data.unlocked && _result == null;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Stack(
      children: [
        KPageScroll(
          controller: _scroll,
          onRefresh: () async {
            ref.invalidate(academyExamProvider(widget.phase));
            await ref.read(academyExamProvider(widget.phase).future).then((_) {}, onError: (Object _) {});
          },
          padding: EdgeInsets.fromLTRB(KSpace.page, 12, KSpace.page, showBar ? 96 : 24),
          children: [
            KAsync(
              value: exam,
              loading: const AcademyPageSkeleton(),
              error: (e) => AcademyUnavailable(error: e, onRetry: () => ref.invalidate(academyExamProvider(widget.phase))),
              builder: (d) => _body(context, d),
            ),
          ],
        ),
        if (showBar)
          PositionedDirectional(
            start: KSpace.page,
            end: KSpace.page,
            bottom: bottom + 10,
            child: _SubmitBar(answered: _answers.where((a) => a != null).length, total: data.questions.length, busy: _busy, onSubmit: () => _submit(data)),
          ),
      ],
    );
  }

  Widget _body(BuildContext context, ExamView data) {
    final t = context.t;
    final k = context.k;
    final p = data.phase;
    final total = data.questions.length;
    final result = _result;
    final byIndex = {for (final r in result?.results ?? const <QuizResult>[]) r.index: r};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AcademyBackLink(href: '/academy/phase/${p.slug}', label: t('academy.phaseTitle', {'n': p.order, 'title': p.title})),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            KChip(label: t('academy.exam.final'), tone: KChipTone.ember),
            KChip(label: levelLabel(t, p.level), tone: levelTone(p.level)),
            if (p.elective) KChip(label: t('academy.elective')),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          t('academy.exam.pageTitle', {'n': p.order, 'title': p.title}),
          style: context.text.largeTitle.copyWith(fontSize: 28, fontWeight: FontWeight.w500, height: 1.2, letterSpacing: -0.5),
        ),
        const SizedBox(height: 8),
        // an elective is a single product track, so its exam doesn't span "both tracks"
        Text(
          t(p.elective ? 'academy.exam.introOneTrack' : 'academy.exam.intro', {'count': total, 'pass': data.passMark}),
          style: context.text.callout.copyWith(color: k.fg2, fontSize: 14),
        ),
        const SizedBox(height: 22),
        if (!data.unlocked)
          KCard(
            key: const ValueKey('exam-locked'),
            padding: const EdgeInsets.all(22),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SoftBadge(icon: LucideIcons.lock, tone: KChipTone.neutral, size: 44),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('academy.exam.lockedTitle'), style: context.text.title2),
                      const SizedBox(height: 4),
                      Text(
                        t('academy.exam.lockedBody', {'done': data.chaptersDone, 'total': data.chaptersTotal}),
                        style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13.5, height: 1.5),
                      ),
                      const SizedBox(height: 16),
                      AcademyProgress(pctOf(data.chaptersDone, data.chaptersTotal)),
                      const SizedBox(height: 18),
                      KButton(
                        label: t('academy.exam.backToChapters'),
                        onPressed: () => context.canPop() ? context.pop() : context.go('/academy/phase/${p.slug}'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else ...[
          if (result != null) ...[_ResultCard(result: result, phase: p, onRetake: () => _retake(data)), const SizedBox(height: 16)],
          for (var qi = 0; qi < total; qi++) ...[
            KCard(
              key: ValueKey('exam-q-$qi'),
              padding: const EdgeInsets.all(18),
              child: QuestionBlock(
                n: qi + 1,
                question: data.questions[qi].question,
                options: Column(
                  children: [
                    for (var oi = 0; oi < data.questions[qi].options.length; oi++) ...[
                      if (oi > 0) const SizedBox(height: 8),
                      OptionButton(
                        letter: kLetters[oi % kLetters.length],
                        label: data.questions[qi].options[oi],
                        state: optionState(byIndex[qi], qi < _answers.length ? _answers[qi] : null, oi),
                        disabled: result != null,
                        onTap: () => setState(() => _answers = [for (var i = 0; i < _answers.length; i++) i == qi ? oi : _answers[i]]),
                      ),
                    ],
                    if (byIndex[qi] case final r?) AnswerFeedback(correct: r.correct, text: r.explanation),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (data.attempts.isNotEmpty && result == null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                t('academy.exam.previousAttempts', {
                  'list': data.attempts.map((a) => a.passed ? t('academy.exam.attemptPassed', {'pct': a.pct}) : '${a.pct}%').join(' · '),
                }),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
              ),
            ),
        ],
        const RiskNote(),
      ],
    );
  }
}

class _SubmitBar extends StatelessWidget {
  const _SubmitBar({required this.answered, required this.total, required this.busy, required this.onSubmit});
  final int answered, total;
  final bool busy;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KFrosted(
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: k.line),
      shadows: k.shadowPop,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(18, 10, 10, 10),
        child: Row(
          children: [
            Expanded(
              child: Text(
                t('academy.answered', {'answered': answered, 'total': total}),
                style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13, fontFeatures: kTabular),
              ),
            ),
            KButton(
              key: const ValueKey('exam-submit'),
              label: busy ? t('academy.exam.submitting') : t('academy.exam.submit'),
              icon: LucideIcons.graduationCap,
              loading: busy,
              onPressed: answered < total ? null : onSubmit,
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result, required this.phase, required this.onRetake});
  final ExamReply result;
  final PhaseRef phase;
  final VoidCallback onRetake;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final passed = result.passed;
    final cert = result.certificate;
    return Container(
      key: const ValueKey('exam-result'),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(k.cardRadius + 1),
        border: Border.all(color: (passed ? k.up : k.warn).withValues(alpha: 0.35)),
      ),
      child: KCard(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: passed ? k.upSoft : k.warnSoft,
                    shape: BoxShape.circle,
                    border: Border.all(color: (passed ? k.up : k.warn).withValues(alpha: 0.3)),
                  ),
                  child: Icon(passed ? LucideIcons.award : LucideIcons.graduationCap, size: 24, color: passed ? k.up : k.warn),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${result.pct}%', textDirection: TextDirection.ltr, style: context.text.moneyL.copyWith(fontSize: 28)),
                      const SizedBox(height: 4),
                      Text(
                        '${t('academy.exam.resultLine', {'score': result.score, 'total': result.total})} · '
                        '${passed ? t('academy.exam.passed') : t('academy.exam.passMarkPct', {'pct': result.passMark})}',
                        style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KButton(label: t('academy.exam.retake'), icon: LucideIcons.rotateCcw, variant: KButtonVariant.surface, onPressed: onRetake),
            ),
            if (cert != null)
              Container(
                margin: const EdgeInsets.only(top: 18),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: k.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    CertificateImage(code: cert.code, semanticLabel: t('academy.cert.title'), radius: 10),
                    const SizedBox(height: 12),
                    Text(t('academy.cert.yours', {'n': phase.order}), style: context.text.headline),
                    const SizedBox(height: 2),
                    Text(
                      t('academy.cert.codeIssued', {'code': cert.code, 'date': fmtDay(t, cert.issuedAt)}),
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                    ),
                    const SizedBox(height: 12),
                    CertificateActions(code: cert.code),
                  ],
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Text(t('academy.exam.reviewText'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
              ),
          ],
        ),
      ),
    );
  }
}
