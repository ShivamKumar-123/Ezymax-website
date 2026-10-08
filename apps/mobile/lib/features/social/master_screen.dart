// Copy & PAMM › Become a master (/social/master): the application (requirements per account, programme, fees and
// terms, public profile, preview, submit), the pending / rejected / suspended status, and the approved master's
// dashboard. Port of the phone layout of apps/crm/components/social-live/master-dashboard.tsx (LiveMasterPage,
// GET master/me, POST master/apply).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'social_api.dart';
import 'widgets/bits.dart';
import 'widgets/master_dashboard.dart';

class MasterScreen extends ConsumerWidget {
  const MasterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final q = ref.watch(masterMeProvider);
    final data = q.value;
    final m = data?.master;
    final approved = m?.status == 'approved';
    return KPageScroll(
      onRefresh: () async {
        ref
          ..invalidate(masterMeProvider)
          ..invalidate(masterDashboardProvider);
        await ref.read(masterMeProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(
          title: approved ? t('social.md.title') : t('social.becomeMaster'),
          subtitle: Text(approved ? t('social.md.subtitle') : t('social.md.applySubtitle')),
        ),
        const SizedBox(height: 18),
        if (q.hasError && data == null)
          SocialErrorCard(error: q.error, onRetry: () => ref.invalidate(masterMeProvider))
        else if (data == null)
          const BlockSkeleton(h: 160)
        else if (m == null)
          _ApplyView(me: data, readOnly: readOnly)
        else if (approved)
          MasterDashboardView(me: data, readOnly: readOnly)
        else ...[
          _StatusCard(m: m),
          if (m.status == 'rejected') ...[const SizedBox(height: 16), _ApplyView(me: data, readOnly: readOnly, rejected: m)],
        ],
      ],
    );
  }
}

class _StateIcon extends StatelessWidget {
  const _StateIcon({required this.ok});
  final bool? ok;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final (bg, fg, border) = ok == true ? k.chip(KChipTone.up) : (ok == false ? k.chip(KChipTone.down) : (k.surface3, k.fg3, k.line));
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: bg,
        border: Border.all(color: border),
      ),
      child: Icon(ok == true ? LucideIcons.check : (ok == false ? LucideIcons.x : LucideIcons.clock), size: 15, color: fg),
    );
  }
}

/* ------------------------------------------------------------------ application */

class _ApplyView extends ConsumerStatefulWidget {
  const _ApplyView({required this.me, required this.readOnly, this.rejected});
  final MasterMe me;
  final bool readOnly;
  final MasterView? rejected;

  @override
  ConsumerState<_ApplyView> createState() => _ApplyViewState();
}

class _ApplyViewState extends ConsumerState<_ApplyView> {
  MasterMe get me => widget.me;
  late int? _login =
      widget.rejected?.login ??
      intOrNull(me.candidates.where((c) => c['eligible'] == true).firstOrNull?['login']) ??
      intOrNull(me.candidates.firstOrNull?['login']);
  late String _program = widget.rejected?.program ?? 'copy';
  late double _fee = math.min(me.feeMaxPct, math.max(me.feeMinPct, widget.rejected?.perfFeePct ?? 20));
  late String _period = widget.rejected?.feePeriod ?? 'monthly';
  late final _minAlloc = TextEditingController(text: inputText(widget.rejected?.minAllocation ?? me.minAllocation));
  late final _nickname = TextEditingController(text: widget.rejected?.nickname ?? '');
  late final _strategy = TextEditingController(text: widget.rejected?.strategy ?? '');
  late final _desc = TextEditingController(text: widget.rejected?.description ?? '');
  bool _busy = false;
  List<Map<String, dynamic>>? _failed;

  @override
  void dispose() {
    for (final c in [_minAlloc, _nickname, _strategy, _desc]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic>? get _cand => me.candidates.where((c) => intOf(c['login']) == _login).firstOrNull;

  String? _nickErr(T t) {
    final n = _nickname.text.trim();
    return _nickname.text.isNotEmpty && (n.length < 3 || n.length > 32) ? t('social.md.err.nickLength') : null;
  }

  String? _minErr(T t) => _minAlloc.text.trim().isNotEmpty && !((parseAmount(_minAlloc.text) ?? -1) >= me.minAllocation)
      ? t('social.md.err.atLeast', {'amount': usd(me.minAllocation, 0)})
      : null;

  bool _ready(T t) =>
      _cand != null &&
      _nickname.text.trim().length >= 3 &&
      _nickErr(t) == null &&
      _strategy.text.trim().isNotEmpty &&
      _desc.text.trim().isNotEmpty &&
      _minErr(t) == null;

  Future<void> _submit() async {
    final t = context.t;
    final cand = _cand;
    if (cand == null) return plainError(ref, t('social.md.err.chooseAccount'));
    if (!_ready(t)) return plainError(ref, t('social.md.err.complete'));
    setState(() {
      _busy = true;
      _failed = null;
    });
    try {
      await socialPost(ref, 'master/apply', {
        'login': intOf(cand['login']),
        'nickname': _nickname.text.trim(),
        'strategy': _strategy.text.trim(),
        'description': _desc.text.trim(),
        'program': _program,
        'perfFeePct': _fee,
        'feePeriod': _period,
        if (parseAmount(_minAlloc.text) != null) 'minAllocation': parseAmount(_minAlloc.text),
      });
      okToast(ref, t('social.md.toast.applied'), t('social.md.toast.appliedDesc'));
      ref.invalidate(masterMeProvider);
    } on ApiException catch (e) {
      final checks = listOf(e.data?['checks']);
      if (checks.isNotEmpty && mounted) setState(() => _failed = checks);
      if (mounted) errToast(ref, context, t('social.md.toast.applyFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cands = me.candidates;
    final cand = _cand;
    final checks = _failed != null && cand != null ? _failed! : listOf(cand?['checks']);
    final met = checks.where((c) => c['ok'] == true).length;
    final nickname = _nickname.text;
    final strategy = _strategy.text;
    final desc = _desc.text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // requirements
        SectionCard(
          title: t('social.md.req.title'),
          subtitle: t('social.md.req.subtitle'),
          icon: LucideIcons.shieldCheck,
          action: cand != null
              ? KChip(
                  label: t('social.md.req.met', {'met': met, 'total': checks.length}),
                  tone: met == checks.length ? KChipTone.up : KChipTone.warn,
                  small: true,
                )
              : null,
          child: cands.isEmpty
              ? KEmptyState(
                  compact: true,
                  icon: LucideIcons.idCard,
                  title: t('social.md.req.needLive'),
                  text: t('social.md.req.needLiveText', {'days': me.minTrackDays, 'equity': usd(me.minMasterEquity, 0)}),
                  action: KButton(
                    label: t('social.md.req.openLive'),
                    icon: LucideIcons.plus,
                    size: KButtonSize.sm,
                    onPressed: () => context.go('/accounts/new'),
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    GroupLabel(t('social.md.req.strategyAccount')),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final c in cands)
                          KPressable(
                            onTap: () => setState(() {
                              _login = intOf(c['login']);
                              _failed = null;
                            }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: intOf(c['login']) == _login ? k.emberSoft : k.surface2,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: intOf(c['login']) == _login ? k.ember.withValues(alpha: 0.5) : k.line),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Num('#${strOf(c['login'])}', style: context.text.mono(13)),
                                      const SizedBox(width: 6),
                                      Icon(c['eligible'] == true ? LucideIcons.check : LucideIcons.x, size: 13, color: c['eligible'] == true ? k.up : k.down),
                                    ],
                                  ),
                                  Text(
                                    '${strOf(c['group'])} · ${usd(numOf(c['equity']), 0)} · ${t('social.age.days', {'d': intOf(c['ageDays'])})}',
                                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    for (final r in checks)
                      Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                        decoration: BoxDecoration(
                          color: k.surface2,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: r['ok'] == true ? k.line : k.down.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          children: [
                            _StateIcon(ok: r['ok'] == true),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    strOf(r['label']),
                                    style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                                  ),
                                  Text(strOf(r['detail']), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                                ],
                              ),
                            ),
                            if (r['ok'] != true && r['key'] == 'kyc') ...[
                              const SizedBox(width: 8),
                              KButton(label: t('social.md.req.verify'), size: KButtonSize.sm, onPressed: () => context.go('/profile/verification')),
                            ],
                          ],
                        ),
                      ),
                    Container(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                      decoration: BoxDecoration(
                        color: k.surface2,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: k.line),
                      ),
                      child: Row(
                        children: [
                          const _StateIcon(ok: null),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  t('social.md.req.approval'),
                                  style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                                ),
                                Text(t('social.md.req.approvalText'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 16),
        // programme
        SectionCard(
          title: t('social.md.programme'),
          subtitle: t('social.md.programmeSub'),
          icon: LucideIcons.layers,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              RadioCard(
                selected: _program == 'copy',
                icon: LucideIcons.copy,
                title: t('social.subs.title'),
                text: t('social.md.prog.copyText'),
                onSelect: () => setState(() => _program = 'copy'),
              ),
              const SizedBox(height: 8),
              RadioCard(
                selected: _program == 'pamm',
                icon: LucideIcons.landmark,
                title: t('social.funds.pammFund'),
                text: t('social.md.prog.pammText'),
                onSelect: () => setState(() => _program = 'pamm'),
              ),
              const SizedBox(height: 8),
              RadioCard(
                selected: _program == 'both',
                icon: LucideIcons.crown,
                title: t('social.md.prog.both'),
                text: t('social.md.prog.bothText'),
                onSelect: () => setState(() => _program = 'both'),
              ),
              if (_program != 'copy') ...[
                const SizedBox(height: 10),
                InfoBox(text: t('social.md.prog.pammNote', {'pct': numText(me.minOwnCapitalPct)})),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        // fees and terms
        SectionCard(
          title: t('social.md.feesTerms'),
          subtitle: t('social.md.feesTermsSub', {'min': numText(me.feeMinPct), 'max': numText(me.feeMaxPct)}),
          icon: LucideIcons.percent,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Expanded(
                    child: Text(t('social.performanceFee'), style: context.text.label.copyWith(color: k.fg2)),
                  ),
                  Num('${numText(_fee)}%', color: k.gold, style: context.text.title1.copyWith(fontSize: 22)),
                ],
              ),
              SocialSlider(value: _fee, min: me.feeMinPct, max: me.feeMaxPct, onChanged: (v) => setState(() => _fee = v)),
              Hint(
                t('social.md.feeExample', {'start': usd(10000, 0), 'end': usd(11200, 0), 'fee': usd(1200 * (_fee / 100)), 'cut': numText(me.platformCutPct)}),
              ),
              const SizedBox(height: 16),
              GroupLabel(t('social.md.copyFeeSettlement')),
              KSegmented<String>(
                plain: true,
                values: kPeriods,
                labels: [for (final p in kPeriods) periodLabel(t, p)],
                selected: _period,
                onChanged: (v) => setState(() => _period = v),
              ),
              Hint(t('social.md.settleNote'), top: 6),
              const SizedBox(height: 14),
              NumberField(
                controller: _minAlloc,
                label: t('social.profile.minAllocation'),
                hint: t('social.md.minAllocHint', {'amount': usd(me.minAllocation, 0)}),
                dollar: true,
                error: _minErr(t),
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // public profile
        SectionCard(
          title: t('social.md.publicProfile'),
          subtitle: t('social.md.publicProfileSub'),
          icon: LucideIcons.fileText,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KTextField(
                controller: _nickname,
                label: t('social.md.nickname'),
                hint: Num('${nickname.length}/32', color: k.fg3),
                placeholder: t('social.md.nicknamePh'),
                error: _nickErr(t),
                inputFormatters: [LengthLimitingTextInputFormatter(32)],
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              KTextField(
                controller: _strategy,
                label: t('social.md.strategy'),
                hint: Num('${strategy.length}/60', color: k.fg3),
                placeholder: t('social.md.strategyPh'),
                inputFormatters: [LengthLimitingTextInputFormatter(60)],
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              TextArea(
                controller: _desc,
                label: t('social.md.description'),
                counter: '${desc.length}/1000',
                placeholder: t('social.md.descriptionPh'),
                maxLength: 1000,
                lines: 5,
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // preview
        SectionCard(
          title: t('social.md.preview'),
          subtitle: t('social.md.previewSub'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: k.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MasterIdentity(
                      nickname: nickname.isEmpty ? t('social.md.yourNickname') : nickname,
                      subText: strategy.isEmpty ? t('social.md.yourStrategy') : strategy,
                      size: 48,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      desc.isEmpty ? t('social.md.descPlaceholder') : desc,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.footnote.copyWith(color: k.fg2, height: 1.5),
                    ),
                    const SizedBox(height: 12),
                    TileGrid(
                      columns: 3,
                      gap: 6,
                      tiles: [
                        Tile(label: t('social.fee'), value: Num('${numText(_fee)}%')),
                        Tile(label: t('social.min'), value: Num(usd(parseAmount(_minAlloc.text) ?? 0, 0))),
                        Tile(label: t('social.md.settles'), value: Text(periodLabel(t, _period))),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        ProgramTags(program: _program),
                        const Spacer(),
                        if (cand != null)
                          Text(
                            t('social.md.trackRecord', {'d': intOf(cand['ageDays'])}),
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              Hint(t('social.md.previewNote'), top: 10),
            ],
          ),
        ),
        if (!widget.readOnly) ...[
          const SizedBox(height: 16),
          KButton(
            label: t('social.md.submit'),
            icon: LucideIcons.send,
            size: KButtonSize.lg,
            expand: true,
            loading: _busy,
            onPressed: !_ready(t) || cand == null ? null : _submit,
          ),
          if (cand != null && cand['eligible'] != true)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                t('social.md.notEligible'),
                textAlign: TextAlign.center,
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ pending / rejected / suspended */

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.m});
  final MasterView m;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pending = m.status == 'pending';
    final (bg, fg, border) = k.chip(pending ? KChipTone.warn : KChipTone.down);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: bg,
                  border: Border.all(color: border),
                ),
                child: Icon(pending ? LucideIcons.clock : LucideIcons.triangleAlert, size: 22, color: fg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  pending
                      ? t('social.md.status.pendingTitle')
                      : (m.status == 'rejected' ? t('social.md.status.rejectedTitle') : t('social.md.status.suspendedTitle')),
                  style: context.text.title2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: StatusChip(
              status: m.status,
              label: t.dyn('social.masterStatus.${m.status}', fallback: m.status),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            pending ? t('social.md.status.pendingText') : (m.status == 'rejected' ? t('social.md.status.rejectedText') : t('social.md.status.suspendedText')),
            style: context.text.callout.copyWith(color: k.fg2),
          ),
          if (m.reviewNote != null && m.reviewNote!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
              decoration: BoxDecoration(
                color: k.surface2,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: k.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t('social.md.status.note'),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                  const SizedBox(height: 2),
                  Text(m.reviewNote!, style: context.text.callout),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          TileGrid(
            tiles: [
              Tile(label: t('social.md.nickname'), value: Text(m.nickname)),
              Tile(label: t('common.account'), value: Num(m.login != null ? '#${m.login}' : '—')),
              Tile(
                label: t('social.md.programme'),
                value: Text(m.program == 'both' ? t('social.md.copyPlusPamm') : (m.program == 'pamm' ? 'PAMM' : t('social.program.copy'))),
              ),
              Tile(label: t('social.fee'), value: Text('${numText(m.perfFeePct)}% · ${periodLabel(t, m.feePeriod).toLowerCase()}')),
            ],
          ),
          if (m.createdAt != null) Hint(t('social.md.status.submitted', {'time': serverTime(t, m.createdAt)}), top: 10),
        ],
      ),
    );
  }
}
