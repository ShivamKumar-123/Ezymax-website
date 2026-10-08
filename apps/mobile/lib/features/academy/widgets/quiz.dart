// The chapter quiz (web components/academy/live/quiz.tsx): every answer is checked by the service at once, the attempt
// is recorded when all are answered; plus the option button shared with the final exam.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../academy_api.dart';
import 'shared.dart';

enum OptionState { idle, chosen, correct, wrong, reveal }

/// One answer option: letter (or check / cross once graded) and the text.
class OptionButton extends StatelessWidget {
  const OptionButton({super.key, required this.label, required this.letter, required this.state, this.disabled = false, this.onTap});
  final String label, letter;
  final OptionState state;
  final bool disabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final (Color bg, Color border) = switch (state) {
      OptionState.idle => (k.surface2, k.line),
      OptionState.chosen => (k.emberSoft, k.ember.withValues(alpha: 0.5)),
      OptionState.correct => (k.upSoft, k.up.withValues(alpha: 0.4)),
      OptionState.wrong => (k.downSoft, k.down.withValues(alpha: 0.4)),
      OptionState.reveal => (k.surface2, k.up.withValues(alpha: 0.3)),
    };
    final (Color markFg, Color markBorder) = switch (state) {
      OptionState.correct || OptionState.reveal => (k.up, k.up.withValues(alpha: 0.4)),
      OptionState.wrong => (k.down, k.down.withValues(alpha: 0.4)),
      OptionState.chosen => (k.ember, k.ember.withValues(alpha: 0.5)),
      OptionState.idle => (k.fg3, k.line),
    };
    final mark = switch (state) {
      OptionState.correct || OptionState.reveal => Icon(LucideIcons.circleCheck, size: 14, color: markFg),
      OptionState.wrong => Icon(LucideIcons.circleX, size: 14, color: markFg),
      _ => Text(letter, style: context.text.micro.copyWith(color: markFg, fontSize: 11)),
    };
    final box = AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: markBorder),
            ),
            child: mark,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(label, style: context.text.callout.copyWith(fontSize: 14, color: state == OptionState.idle ? k.fg2 : k.fg, height: 1.35)),
            ),
          ),
        ],
      ),
    );
    return Opacity(
      opacity: disabled && state == OptionState.idle ? 0.6 : 1,
      child: KPressable(pressedScale: 0.99, semanticLabel: '$letter. $label', onTap: disabled ? null : onTap, child: box),
    );
  }
}

/// The explanation under a graded question (green when right, red when wrong).
class AnswerFeedback extends StatelessWidget {
  const AnswerFeedback({super.key, required this.correct, required this.text, this.lead});
  final bool correct;
  final String text;
  final String? lead;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final style = context.text.footnote.copyWith(fontSize: 13, color: k.fg2, height: 1.5);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: correct ? k.upSoft : k.downSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: (correct ? k.up : k.down).withValues(alpha: 0.25)),
      ),
      child: Text.rich(
        TextSpan(
          style: style,
          children: [
            if (lead != null)
              TextSpan(
                text: '$lead ',
                style: TextStyle(fontWeight: FontWeight.w600, color: correct ? k.up : k.down),
              ),
            TextSpan(text: text),
          ],
        ),
      ),
    );
  }
}

/// A numbered question with its options.
class QuestionBlock extends StatelessWidget {
  const QuestionBlock({super.key, required this.n, required this.question, required this.options});
  final int n;
  final String question;
  final Widget options;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$n.',
              style: context.text.headline.copyWith(color: k.fg3, fontSize: 14.5, fontFeatures: kTabular),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(question, style: context.text.headline.copyWith(fontSize: 14.5, height: 1.35))),
          ],
        ),
        const SizedBox(height: 10),
        options,
      ],
    );
  }
}

OptionState optionState(QuizResult? r, int? chosen, int oi) {
  if (r != null) {
    if (oi == r.choice) return r.correct ? OptionState.correct : OptionState.wrong;
    return oi == r.answer ? OptionState.reveal : OptionState.idle;
  }
  return chosen == oi ? OptionState.chosen : OptionState.idle;
}

class ChapterQuiz extends ConsumerStatefulWidget {
  const ChapterQuiz({super.key, required this.slug, required this.questions, required this.passedBefore, required this.onDone});
  final String slug;
  final List<Question> questions;
  final bool passedBefore;
  final ValueChanged<QuizReply> onDone;

  @override
  ConsumerState<ChapterQuiz> createState() => _ChapterQuizState();
}

class _ChapterQuizState extends ConsumerState<ChapterQuiz> {
  late List<int?> _answers = List.filled(widget.questions.length, null);
  Map<int, QuizResult> _results = {};
  QuizReply? _final;
  bool _busy = false;

  Future<void> _choose(int qi, int oi) async {
    if (_busy || _results.containsKey(qi)) return;
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    final before = _answers;
    final next = [for (var i = 0; i < _answers.length; i++) i == qi ? oi : _answers[i]];
    setState(() {
      _answers = next;
      _busy = true;
    });
    try {
      final r = await ref.read(academyApiProvider).quiz(widget.slug, next);
      if (!mounted) return;
      setState(() => _results = {for (final x in r.results) x.index: x});
      if (r.allAnswered) {
        setState(() => _final = r);
        widget.onDone(r);
        if (r.completedNow) {
          KHaptics.success();
          notes.toast(
            NotificationKind.success,
            t('academy.toast.chapterComplete'),
            description: r.examUnlocked ? t('academy.toast.examUnlocked') : t('academy.toast.phaseProgress', {'done': r.phaseDone, 'total': r.phaseTotal}),
          );
        }
      }
    } catch (e) {
      if (mounted) setState(() => _answers = before);
      notes.toast(NotificationKind.error, t('academy.toast.checkFailed'), description: e is ApiException ? localizeError(e, t) : null);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _reset() => setState(() {
    _answers = List.filled(widget.questions.length, null);
    _results = {};
    _final = null;
  });

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final qs = widget.questions;
    final f = _final;
    return KCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AcademyLabel(t('academy.quiz.eyebrow')),
                    const SizedBox(height: 4),
                    Text(t('academy.quiz.title'), style: context.text.title2.copyWith(fontSize: 19)),
                    const SizedBox(height: 2),
                    Text(t('academy.quiz.meta', {'count': qs.length}), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
                  ],
                ),
              ),
              if (widget.passedBefore && f == null) ...[
                const SizedBox(width: 10),
                KChip(label: t('academy.quiz.alreadyPassed'), tone: KChipTone.up, dot: true),
              ],
            ],
          ),
          for (var qi = 0; qi < qs.length; qi++) ...[
            const SizedBox(height: 22),
            QuestionBlock(
              n: qi + 1,
              question: qs[qi].question,
              options: Column(
                children: [
                  for (var oi = 0; oi < qs[qi].options.length; oi++) ...[
                    if (oi > 0) const SizedBox(height: 8),
                    OptionButton(
                      letter: kLetters[oi % kLetters.length],
                      label: qs[qi].options[oi],
                      state: optionState(_results[qi], _answers[qi], oi),
                      disabled: _results.containsKey(qi) || _busy,
                      onTap: () => _choose(qi, oi),
                    ),
                  ],
                  if (_results[qi] case final r?)
                    AnswerFeedback(correct: r.correct, lead: r.correct ? t('academy.quiz.correct') : t('academy.quiz.notQuite'), text: r.explanation),
                ],
              ),
            ),
          ],
          if (f != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 22),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: f.passed ? k.upSoft : k.warnSoft,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: (f.passed ? k.up : k.warn).withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t('academy.quiz.score', {'score': f.score, 'total': f.total}),
                    style: context.text.title2.copyWith(fontSize: 18, fontFeatures: kTabular),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    f.passed
                        ? (f.completedNow ? t('academy.quiz.passedComplete') : t('academy.quiz.passed'))
                        : t('academy.quiz.needMore', {'count': (f.passPct / 100 * f.total).ceil()}),
                    style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  KButton(
                    label: t('academy.quiz.retake'),
                    icon: LucideIcons.rotateCcw,
                    variant: KButtonVariant.surface,
                    size: KButtonSize.sm,
                    onPressed: _reset,
                  ),
                ],
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: Text(
                t('academy.answered', {'answered': _results.length, 'total': qs.length}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
              ),
            ),
        ],
      ),
    );
  }
}
