// After submitting (web components/verification/tracker.tsx + live-verification Levels): the "Checking your
// documents…" sequence, the live status tracker (submitted / in review / approved / not approved, stages, activity)
// and the Verification levels card.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../widgets/profile_ui.dart';
import 'kyc_models.dart';

/* ------------------------------------------------------------------ "Checking your documents…" */

/// One step every 520 ms; the last waits for the server, then the sequence finishes (web CheckingSequence).
class KycCheckingSequence extends StatefulWidget {
  const KycCheckingSequence({super.key, required this.steps, required this.serverDone, required this.onFinish});
  final List<KycCheckStep> steps;
  final bool serverDone;
  final VoidCallback onFinish;

  @override
  State<KycCheckingSequence> createState() => _KycCheckingSequenceState();
}

class _KycCheckingSequenceState extends State<KycCheckingSequence> {
  int _n = 0;
  Timer? _timer;
  bool _finished = false;

  int get _last => widget.steps.length - 1;

  @override
  void initState() {
    super.initState();
    _tick();
  }

  @override
  void didUpdateWidget(KycCheckingSequence old) {
    super.didUpdateWidget(old);
    if (widget.serverDone && !old.serverDone) _tick();
  }

  void _tick() {
    _timer?.cancel();
    if (_n < _last) {
      _timer = Timer(const Duration(milliseconds: 520), () {
        if (!mounted) return;
        setState(() => _n++);
        _tick();
      });
    } else if (_n == _last && widget.serverDone) {
      _timer = Timer(const Duration(milliseconds: 450), () {
        if (!mounted) return;
        setState(() => _n = _last + 1);
        _tick();
      });
    } else if (_n > _last && !_finished) {
      _timer = Timer(const Duration(milliseconds: 500), () {
        if (!mounted || _finished) return;
        _finished = true;
        widget.onFinish();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Column(
      key: const ValueKey('kyc-checking'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        Center(
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: k.emberSoft,
              shape: BoxShape.circle,
              border: Border.all(color: k.ember.withValues(alpha: 0.3)),
            ),
            child: Icon(LucideIcons.fileSearch, size: 24, color: k.ember),
          ),
        ),
        const SizedBox(height: 16),
        Text(t('kyc.checking.title'), textAlign: TextAlign.center, style: context.text.title1),
        const SizedBox(height: 4),
        Text(
          t('kyc.checking.text'),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
        ),
        const SizedBox(height: 20),
        for (var i = 0; i < widget.steps.length; i++) _step(context, widget.steps[i], i),
      ],
    );
  }

  Widget _step(BuildContext context, KycCheckStep s, int i) {
    final t = context.t;
    final k = context.k;
    final done = i < _n;
    final active = i == _n;
    final (Color bg, Color fg, Color border) = done
        ? (s.warn ? (k.warnSoft, k.warn, k.warn.withValues(alpha: 0.4)) : (k.upSoft, k.up, k.up.withValues(alpha: 0.4)))
        : active
        ? (Colors.transparent, k.ember, k.ember.withValues(alpha: 0.5))
        : (Colors.transparent, k.fg3, k.line);
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: i <= _n ? 1 : 0.45,
      child: Container(
        key: ValueKey('kyc-step-${s.key}'),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: active ? k.ember.withValues(alpha: 0.4) : k.line),
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: bg,
                shape: BoxShape.circle,
                border: Border.all(color: border),
              ),
              child: done
                  ? Icon(s.warn ? LucideIcons.triangleAlert : LucideIcons.check, size: 13, color: fg)
                  : Text(
                      '${i + 1}',
                      style: context.text.caption.copyWith(color: fg, fontSize: 11, fontFeatures: kTabular),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.label, style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
                  Text(
                    done ? s.detail : (active ? t('kyc.checking.active') : t('kyc.checking.waiting')),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
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

/* ------------------------------------------------------------------ status tracker */

enum _Stage { done, current, todo, failed, action }

class KycStatusTracker extends StatefulWidget {
  const KycStatusTracker({super.key, required this.state, this.justSubmitted = false, this.onRestart});
  final KycState state;
  final bool justSubmitted;
  final VoidCallback? onRestart;

  @override
  State<KycStatusTracker> createState() => _KycStatusTrackerState();
}

class _KycStatusTrackerState extends State<KycStatusTracker> {
  bool _activity = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = widget.state;
    final c = s.kase!;
    final typical = hoursLabel(t, s.typicalHours);
    final email = s.p('email');
    String fmt(DateTime? d) => d == null ? '' : fmtWhen(t.locale, d);

    final (IconData icon, Color tone, Color soft, String title, String text) = switch (c.status) {
      'approved' => (LucideIcons.badgeCheck, k.up, k.upSoft, t('kyc.tracker.approved.title'), t('kyc.tracker.approved.text')),
      'rejected' => (
        LucideIcons.triangleAlert,
        k.down,
        k.downSoft,
        t('kyc.tracker.rejected.title'),
        c.decisionLabel != null ? '${c.decisionLabel}.' : t('kyc.tracker.rejected.text'),
      ),
      'in_review' => (LucideIcons.userCheck, k.ember, k.emberSoft, t('kyc.tracker.inReview.title'), t('kyc.tracker.inReview.text', {'hours': typical})),
      _ => (
        LucideIcons.clock,
        k.ember,
        k.emberSoft,
        widget.justSubmitted ? t('kyc.tracker.submitted.title', {'hours': typical}) : t('kyc.tracker.queued.title', {'hours': typical}),
        t('kyc.tracker.queued.text'),
      ),
    };
    // the founder's art for waiting on the review and for the approval; a rejection keeps its plain icon
    final art = c.status == 'approved' ? KIllustrationName.kycApproved : (c.status == 'rejected' ? null : KIllustrationName.kycPending);

    final reviewing = c.status == 'in_review';
    final decided = c.status == 'approved' || c.status == 'rejected';
    final firstSubmit = s.timeline.where((e) => e.kind == 'submitted').firstOrNull?.at ?? c.submittedAt;
    final stages = <(String, IconData, String, String, _Stage)>[
      (
        'submitted',
        LucideIcons.check,
        t('kyc.tracker.stage.submitted'),
        fmt(firstSubmit) + (c.submissions > 1 ? t('kyc.tracker.stage.resubmitted', {'date': fmt(c.submittedAt)}) : ''),
        _Stage.done,
      ),
      ('auto', LucideIcons.shieldCheck, t('kyc.tracker.stage.auto'), t('kyc.tracker.stage.autoDetail'), _Stage.done),
      (
        'review',
        LucideIcons.userCheck,
        t('kyc.tracker.stage.review'),
        decided
            ? t('kyc.tracker.stage.completed', {'date': fmt(c.decidedAt)})
            : c.status == 'more_info'
            ? t('kyc.tracker.stage.waitingDocs')
            : reviewing
            ? t('kyc.tracker.stage.inReviewSince', {'date': fmt(c.reviewStartedAt)})
            : t('kyc.tracker.stage.usuallyWithin', {'hours': typical}),
        decided ? _Stage.done : (c.status == 'more_info' ? _Stage.action : _Stage.current),
      ),
      (
        'decision',
        c.status == 'rejected' ? LucideIcons.x : LucideIcons.badgeCheck,
        c.status == 'approved'
            ? t('kyc.tracker.stage.verified')
            : c.status == 'rejected'
            ? t('kyc.tracker.stage.notApproved')
            : t('kyc.tracker.stage.decision'),
        c.status == 'approved'
            ? t('kyc.tracker.stage.unlocked')
            : c.status == 'rejected'
            ? (c.decisionLabel ?? t('kyc.tracker.stage.seeReason'))
            : t('kyc.tracker.stage.emailResult'),
        c.status == 'approved' ? _Stage.done : (c.status == 'rejected' ? _Stage.failed : _Stage.todo),
      ),
    ];

    (Color, Color, Color) stageTone(_Stage st) => switch (st) {
      _Stage.done => (k.upSoft, k.up, k.up.withValues(alpha: 0.4)),
      _Stage.current => (k.emberSoft, k.ember, k.ember.withValues(alpha: 0.5)),
      _Stage.action => (k.warnSoft, k.warn, k.warn.withValues(alpha: 0.5)),
      _Stage.failed => (k.downSoft, k.down, k.down.withValues(alpha: 0.4)),
      _Stage.todo => (Colors.transparent, k.fg3, k.line),
    };

    final events = s.timeline.reversed.toList();
    return Column(
      key: ValueKey('kyc-tracker-${c.status}'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (art != null)
          Align(alignment: AlignmentDirectional.centerStart, child: KIllustration(art, width: 128, maxHeight: 120))
        else
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: soft,
                shape: BoxShape.circle,
                border: Border.all(color: tone.withValues(alpha: 0.3)),
              ),
              child: Icon(icon, size: 28, color: tone),
            ),
          ),
        const SizedBox(height: 16),
        Text(title, style: context.text.title1.copyWith(fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        Text(text, style: context.text.callout.copyWith(color: k.fg2)),
        if (c.status == 'rejected' && c.decisionMessage != null) ...[const SizedBox(height: 16), KycTeamNote(message: c.decisionMessage!)],
        const SizedBox(height: 24),
        Semantics(
          label: t('kyc.tracker.progressAria'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < stages.length; i++)
                IntrinsicHeight(
                  key: ValueKey('kyc-stage-${stages[i].$1}-${stages[i].$5.name}'),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        width: 36,
                        child: Column(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: stageTone(stages[i].$5).$1,
                                shape: BoxShape.circle,
                                border: Border.all(color: stageTone(stages[i].$5).$3),
                              ),
                              child: Icon(stages[i].$5 == _Stage.done ? LucideIcons.check : stages[i].$2, size: 16, color: stageTone(stages[i].$5).$2),
                            ),
                            if (i < stages.length - 1)
                              Expanded(
                                child: Container(
                                  width: 1,
                                  margin: const EdgeInsets.symmetric(vertical: 2),
                                  color: stages[i].$5 == _Stage.done ? k.up.withValues(alpha: 0.4) : k.line,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(top: 6, bottom: i < stages.length - 1 ? 20 : 0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                spacing: 8,
                                runSpacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(stages[i].$3, style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                                  if (stages[i].$5 == _Stage.current) KChip(label: t('kyc.tracker.inProgress'), tone: KChipTone.ember, dot: true, small: true),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(stages[i].$4, style: context.text.footnote.copyWith(color: k.fg3)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: k.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(LucideIcons.mail, size: 16, color: k.fg3),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      decided ? t('kyc.tracker.emailedDecision', {'email': email}) : t('kyc.tracker.willEmail', {'email': email}),
                      style: context.text.footnote.copyWith(color: k.fg3),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(c.reference, style: context.text.mono(12).copyWith(color: k.fg3)),
            ],
          ),
        ),
        if (c.status == 'rejected' && s.canStart && widget.onRestart != null) ...[
          const SizedBox(height: 20),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: KButton(label: t('kyc.tracker.startAgain'), icon: LucideIcons.rotateCcw, onPressed: widget.onRestart),
          ),
        ],
        if (c.status == 'approved') ...[
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.lock, size: 14, color: k.fg3),
              const SizedBox(width: 8),
              Expanded(
                child: Text(t('kyc.tracker.locked'), style: context.text.footnote.copyWith(color: k.fg3)),
              ),
            ],
          ),
        ],
        if (s.timeline.length > 1) ...[
          const SizedBox(height: 16),
          KPressable(
            onTap: () => setState(() => _activity = !_activity),
            semanticLabel: t('kyc.tracker.activity'),
            child: Row(
              children: [
                Icon(
                  _activity ? LucideIcons.chevronDown : (Directionality.of(context) == TextDirection.rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight),
                  size: 14,
                  color: k.fg3,
                ),
                const SizedBox(width: 4),
                Text(t('kyc.tracker.activity'), style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ),
          ),
          if (_activity)
            for (final e in events)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        t.dyn('kyc.event.${e.kind}', fallback: e.kind.replaceAll('_', ' ')),
                        style: context.text.footnote.copyWith(color: k.fg2),
                      ),
                    ),
                    Text(fmt(e.at), style: context.text.footnote.copyWith(color: k.fg3)),
                  ],
                ),
              ),
        ],
      ],
    );
  }
}

/// "Note from our team" (gold start border): a reviewer's message.
class KycTeamNote extends StatelessWidget {
  const KycTeamNote({super.key, required this.message, this.background});
  final String message;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      decoration: BoxDecoration(
        color: background ?? k.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 3, color: k.gold),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 9, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.t('kyc.wizard.noteFromTeam').toUpperCase(),
                      style: context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.8, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 2),
                    Text(message, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ verification levels */

class KycLevelsCard extends StatelessWidget {
  const KycLevelsCard({super.key, required this.state, required this.emailVerified});
  final KycState? state;
  final bool emailVerified;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = state;
    final verified = s?.kycStatus == 'verified';
    final pending = s?.kase != null && const ['submitted', 'in_review', 'more_info'].contains(s!.kase!.status);
    final levels = [
      (0, t('kyc.levels.registered'), [t('kyc.levels.unlock.demoAccounts'), t('kyc.levels.unlock.platformTools')], true),
      (
        1,
        t('kyc.levels.contactVerified'),
        [t('kyc.levels.unlock.liveAccounts'), t('kyc.levels.unlock.deposits'), t('kyc.levels.unlock.copyPamm')],
        emailVerified,
      ),
      (
        2,
        t('kyc.levels.identityVerified'),
        [t('kyc.levels.unlock.withdrawals'), t('kyc.levels.unlock.partnerPayouts'), t('kyc.levels.unlock.higherLimits')],
        verified,
      ),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PCardHeader(title: t('kyc.levels.title'), icon: LucideIcons.shieldCheck),
          const SizedBox(height: 16),
          for (final (n, name, unlocks, done) in levels)
            Container(
              key: ValueKey('kyc-level-$n'),
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: !done && n == 2 ? k.emberSoft.withValues(alpha: 0.4) : k.surface2,
                borderRadius: BorderRadius.circular(k.rowRadius),
                border: Border.all(color: !done && n == 2 ? k.ember.withValues(alpha: 0.4) : k.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: done ? k.upSoft : k.surface3, shape: BoxShape.circle),
                        child: done
                            ? Icon(LucideIcons.check, size: 16, color: k.up)
                            : Text(
                                '$n',
                                style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w700),
                              ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(t('kyc.levels.level', {'n': n}), style: context.text.label.copyWith(fontSize: 14, color: k.fg)),
                            Text(
                              name,
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      if (done)
                        KChip(label: t('kyc.levels.complete'), tone: KChipTone.up, small: true)
                      else if (n == 2 && pending)
                        KChip(
                          label: s.kase!.status == 'more_info' ? t('kyc.levels.actionNeeded') : t('kyc.levels.inReview'),
                          tone: KChipTone.warn,
                          dot: true,
                          small: true,
                        )
                      else
                        KChip(label: t('kyc.levels.notStarted'), small: true),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final u in unlocks)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(20)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (!done) ...[Icon(LucideIcons.lock, size: 10, color: k.fg2), const SizedBox(width: 4)],
                              Text(
                                u,
                                style: context.text.caption.copyWith(color: k.fg2, fontSize: 11, fontWeight: FontWeight.w400),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
            child: Text(
              t('kyc.levels.privacy'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.5),
            ),
          ),
          if (s != null && s.history.length > 1) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                t('kyc.levels.previous'),
                style: context.text.footnote.copyWith(color: k.fg2, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 6),
            for (final h in s.history.skip(1))
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                child: Row(
                  children: [
                    Text('${h['reference'] ?? ''}', style: context.text.mono(12).copyWith(color: k.fg3)),
                    const Spacer(),
                    Text(
                      t.dyn('kyc.history.status.${h['status']}', fallback: '${h['status'] ?? ''}'),
                      style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}
