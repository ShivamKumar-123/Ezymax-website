// The approved master's dashboard on /social/master: profile, KPIs, performance, PAMM funds (create / edit with the
// one-time credentials), followers, who can follow (A11), announcements and performance fees. Port of Dashboard,
// EditProfileDialog, FundFormDialog, FundBlock in apps/crm/components/social-live/master-dashboard.tsx and
// master-tools.tsx (GET master/dashboard every 15 s, PATCH master/me, POST/PATCH funds, POST master/announcements).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../social_api.dart';
import 'bits.dart';
import 'copy_sheets.dart';
import 'follow_sheet.dart';
import 'fund_sheet.dart';

const List<String> kPeriods = ['daily', 'weekly', 'monthly'];
const List<int> _locks = [0, 7, 14, 30, 60, 90];

class MasterDashboardView extends ConsumerWidget {
  const MasterDashboardView({super.key, required this.me, required this.readOnly});
  final MasterMe me;
  final bool readOnly;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final q = ref.watch(masterDashboardProvider);
    final data = q.value;
    final m = data?.master ?? me.master!;
    final s = m.stats;
    void reload() => ref.invalidate(masterDashboardProvider);
    void reloadAll() {
      reload();
      ref.invalidate(masterMeProvider);
    }

    final kpiWidth = (MediaQuery.sizeOf(context).width - 2 * KSpace.page) * 0.72;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final children = <Widget>[
      KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                KAvatar(name: m.nickname, size: 56),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(m.nickname, style: context.text.title1.copyWith(fontWeight: FontWeight.w500)),
                      Text(m.strategy, style: context.text.callout.copyWith(color: k.fg2)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                KChip(label: t('social.md.approved'), tone: KChipTone.up, icon: LucideIcons.badgeCheck, small: true),
                if (m.hidden) KChip(label: t('social.md.hidden'), small: true),
                if (m.frozen) KChip(label: t('social.md.frozen'), tone: KChipTone.down, small: true),
                if (m.inviteOnly) KChip(label: t('social.inviteOnly'), tone: KChipTone.gold, icon: LucideIcons.link2, small: true),
                if (m.acceptingNew == false) KChip(label: t('social.notAccepting'), tone: KChipTone.warn, icon: LucideIcons.userX, small: true),
                ProgramTags(program: m.program),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 14,
              runSpacing: 3,
              children: [
                if (m.login != null) Text('${t('social.md.req.strategyAccount')} #${m.login}', style: context.text.footnote.copyWith(color: k.fg3)),
                Text(
                  t('social.md.feeLine', {'fee': numText(m.perfFeePct), 'period': periodLabel(t, m.feePeriod).toLowerCase()}),
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
                Text(t('social.md.minAllocLine', {'amount': usd(m.minAllocation, 0)}), style: context.text.footnote.copyWith(color: k.fg3)),
                Text(t('social.md.masterSince', {'date': fmtDate(t, m.since)}), style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                KButton(
                  label: t('social.md.publicProfile'),
                  trailingIcon: rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
                  variant: KButtonVariant.surface,
                  size: KButtonSize.sm,
                  onPressed: () => context.push('/social/masters/${m.id}'),
                ),
                if (!readOnly)
                  KButton(
                    label: t('common.edit'),
                    icon: LucideIcons.pencil,
                    variant: KButtonVariant.surface,
                    size: KButtonSize.sm,
                    onPressed: () => showKSheet<void>(
                      context,
                      expand: true,
                      builder: (_) => _EditProfileSheet(m: m, me: me, onSaved: reloadAll),
                    ),
                  ),
                if (m.login != null) TraderButton(login: m.login),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
    ];

    if (q.hasError && data == null) {
      children.add(SocialErrorCard(error: q.error, title: t('social.md.dashUnavailable'), onRetry: reload));
    } else if (data == null) {
      children.add(const BlockSkeleton());
    } else {
      final tot = data.totals;
      final churn = numOf(tot['churn30dPct']);
      final left = intOf(tot['left30d']);
      final termsPending = intOf(tot['termsPending']);
      Widget kpis(List<Widget> cards) => SizedBox(
        height: 160,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          itemCount: cards.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (_, i) => cards[i],
        ),
      );
      children.addAll([
        kpis([
          KKpiCard(
            width: kpiWidth,
            label: t('social.followers'),
            icon: LucideIcons.users,
            value: Num('${intOf(tot['followers'])}', style: context.text.moneyL),
            chip: KChip(label: t('social.md.kpi.investors', {'count': s.investors})),
          ),
          KKpiCard(
            width: kpiWidth,
            label: t('social.lb.stat.aum'),
            icon: LucideIcons.wallet,
            value: Num(compactUsd(numOf(tot['aum'])), style: context.text.moneyL),
            chip: KChip(label: t('social.md.kpi.aumChip')),
          ),
          KKpiCard(
            width: kpiWidth,
            label: t('social.feesPending'),
            icon: LucideIcons.clock,
            value: KMoney(numOf(tot['feesPending']), style: context.text.moneyL),
            chip: KChip(label: t('social.subs.kpi.awaitingApproval'), tone: KChipTone.warn),
          ),
          KKpiCard(
            width: kpiWidth,
            label: t('social.inv.kpi.feesPaid'),
            icon: LucideIcons.percent,
            value: KMoney(numOf(tot['feesPaid']), style: context.text.moneyL),
            chip: KChip(label: t('social.md.kpi.paidChip'), tone: KChipTone.up),
          ),
        ]),
        const SizedBox(height: 12),
        kpis([
          KKpiCard(
            width: kpiWidth,
            label: t('social.md.kpi.new30d'),
            icon: LucideIcons.userPlus,
            value: Num('${intOf(tot['new30d'])}', style: context.text.moneyL),
            chip: KChip(label: t('social.md.kpi.last30d'), tone: KChipTone.up),
          ),
          KKpiCard(
            width: kpiWidth,
            label: t('social.md.kpi.left30d'),
            icon: LucideIcons.userMinus,
            value: Num('$left', style: context.text.moneyL),
            chip: KChip(label: t('social.md.kpi.last30d'), tone: left > 0 ? KChipTone.down : KChipTone.neutral),
          ),
          KKpiCard(
            width: kpiWidth,
            label: t('social.md.kpi.churn'),
            icon: LucideIcons.trendingDown,
            value: Num('${churn.toStringAsFixed(1)}%', style: context.text.moneyL),
            chip: KChip(label: t('social.md.kpi.churnChip'), tone: churn >= 20 ? KChipTone.down : (churn >= 10 ? KChipTone.warn : KChipTone.neutral)),
          ),
          KKpiCard(
            width: kpiWidth,
            label: t('social.md.kpi.termsPending'),
            icon: LucideIcons.fileText,
            value: Num('$termsPending', style: context.text.moneyL),
            chip: KChip(label: t('social.md.kpi.termsChip'), tone: termsPending > 0 ? KChipTone.warn : KChipTone.neutral),
          ),
        ]),
        const SizedBox(height: 16),
        SectionCard(
          title: t('social.md.performance'),
          subtitle: t('social.md.performanceSub'),
          action: RiskBadge(risk: s.riskScore, showLabel: true),
          child: TileGrid(
            tiles: [
              Tile(label: t('social.lb.col.return', {'period': t('social.lb.period.1m')}), value: Num(pct(s.return1m))),
              Tile(label: t('social.lb.col.return', {'period': t('social.lb.period.3m')}), value: Num(pct(s.return3m))),
              Tile(label: t('social.lb.col.return', {'period': t('social.lb.period.1y')}), value: Num(pct(s.return1y))),
              Tile(label: t('social.returnAll'), value: Num(pct(s.returnAll))),
              Tile(label: t('social.maxDd'), value: Num(ddText(s.maxDd))),
              Tile(label: t('social.profile.volatility'), value: Num('${s.volatility.toStringAsFixed(1)}%')),
              Tile(label: t('social.profile.winRate'), value: Num(s.trades > 0 ? '${s.winRate.toStringAsFixed(1)}%' : '—')),
              Tile(label: t('common.equity'), value: Num(usd(s.equity, 0))),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'PAMM',
          subtitle: m.program == 'copy' ? t('social.md.pamm.notInProgramme') : t('social.funds.count', {'count': data.funds.length}),
          icon: LucideIcons.landmark,
          child: m.program == 'copy'
              ? Text(t('social.md.pamm.copyOnly'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(t('social.md.pamm.openText'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
                    if (!readOnly) ...[
                      const SizedBox(height: 14),
                      KButton(
                        label: t('social.md.pamm.create'),
                        icon: LucideIcons.plus,
                        expand: true,
                        onPressed: () => showKSheet<void>(
                          context,
                          expand: true,
                          builder: (_) => _FundFormSheet(fund: null, me: me, onSaved: reload),
                        ),
                      ),
                    ],
                  ],
                ),
        ),
        if (data.funds.isNotEmpty) ...[
          const SizedBox(height: 16),
          SectionCard(
            title: t('social.md.yourFunds'),
            subtitle: t('social.md.yourFundsSub'),
            icon: LucideIcons.landmark,
            child: Column(
              children: [
                for (final f in data.funds) ...[
                  _FundBlock(
                    f: f,
                    readOnly: readOnly,
                    onOpen: () => showFundSheet(context, f.id),
                    onEdit: () => showKSheet<void>(
                      context,
                      expand: true,
                      builder: (_) => _FundFormSheet(fund: f, me: me, onSaved: reload),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        SectionCard(
          title: t('social.followers'),
          subtitle: t('social.md.followersSub'),
          icon: LucideIcons.users,
          child: data.followers.isEmpty
              ? EmptyRow(t('social.md.noFollowers'))
              : RowsBox(
                  children: [
                    for (final f in data.followers)
                      DataLine(
                        title: Num('#${strOf(f['subscriptionId'])}', style: context.text.mono(12.5)),
                        subtitle: Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            StatusChip(
                              status: strOf(f['status']),
                              label: t.dyn('social.subStatus.${strOf(f['status'])}', fallback: strOf(f['status'])),
                            ),
                            if (f['termsPending'] == true && f['status'] != 'stopped')
                              KChip(label: t('social.md.col.termsPending'), tone: KChipTone.warn, small: true),
                            if (f['status'] == 'stopped' && (f['stoppedAt'] != null || f['stopReason'] != null))
                              Text(
                                [
                                  if (f['stoppedAt'] != null) fmtDate(t, strOrNull(f['stoppedAt'])),
                                  if (f['stopReason'] != null) stopReasonText(t, strOrNull(f['stopReason'])),
                                ].join(' · '),
                                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                              ),
                          ],
                        ),
                        trailing: Num(usd(numOf(f['equity']))),
                        trailingSub: Num(usd(numOf(f['profit']), 2, true), color: toneColor(context, numOf(f['profit']))),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 16),
        FollowerSettingsCard(m: m, followers: intOf(tot['followers']), readOnly: readOnly, onSaved: reloadAll),
        const SizedBox(height: 16),
        AnnouncementsCard(items: data.announcements, readOnly: readOnly, onSent: reload),
        const SizedBox(height: 16),
        SectionCard(
          title: t('social.md.perfFees'),
          subtitle: t('social.md.perfFeesSub'),
          icon: LucideIcons.percent,
          child: data.fees.isEmpty
              ? EmptyRow(t('social.md.noFees'))
              : RowsBox(
                  children: [
                    for (final f in data.fees)
                      DataLine(
                        title: Text(
                          f.source == 'copy' ? t('social.md.srcCopy', {'id': f.subscriptionId ?? ''}) : t('social.md.srcPamm', {'id': f.fundId ?? ''}),
                        ),
                        subtitle: Text(fmtDate(t, f.periodEnd)),
                        trailing: Num(usd(f.masterAmount), style: const TextStyle(fontWeight: FontWeight.w600)),
                        trailingSub: KChip(
                          label: t.dyn('social.feeStatus.${f.status}', fallback: f.status),
                          tone: feeStatusTone[f.status] ?? KChipTone.neutral,
                          small: true,
                        ),
                      ),
                  ],
                ),
        ),
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}

class _FundBlock extends StatelessWidget {
  const _FundBlock({required this.f, required this.readOnly, required this.onEdit, required this.onOpen});
  final FundView f;
  final bool readOnly;
  final VoidCallback onEdit, onOpen;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final investors = f.investorList;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KPressable(
            pressedScale: 1,
            onTap: onOpen,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.headline),
                    ),
                    const SizedBox(width: 8),
                    FundStatusChip(status: f.status),
                  ],
                ),
                Text(
                  '${f.login != null ? '#${f.login} · ' : ''}${t('social.md.fundRollover', {'period': periodLabel(t, f.period).toLowerCase(), 'next': serverTime(t, f.nextRolloverAt, withYear: false)})}',
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!readOnly)
                KButton(label: t('social.md.editTerms'), icon: LucideIcons.pencil, variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: onEdit),
              if (f.login != null) TraderButton(login: f.login, blocked: f.status == 'closed'),
            ],
          ),
          const SizedBox(height: 10),
          TileGrid(
            columns: 3,
            gap: 6,
            tiles: [
              Tile(label: 'NAV', value: Num(nav4(f.nav))),
              Tile(label: t('common.equity'), value: Num(compactUsd(f.equity))),
              Tile(label: t('social.md.investorAum'), value: Num(compactUsd(f.aum))),
              Tile(label: t('social.investors'), value: Num('${f.investorCount}')),
              Tile(label: t('social.md.yourShare'), value: Num('${f.masterSharePct.toStringAsFixed(1)}%')),
              Tile(label: t('common.pending'), value: Num('${f.pendingCount}')),
            ],
          ),
          if (investors.isNotEmpty) ...[
            const SizedBox(height: 10),
            RowsBox(
              pageSize: 8,
              children: [
                for (final i in investors)
                  DataLine(
                    title: Num('#${strOf(i['investorId'])}', style: context.text.mono(12.5)),
                    subtitle: Num('${units4(numOf(i['units']))} ${t('social.inv.unitsUnit')}'),
                    trailing: Num(usd(numOf(i['value']))),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ edit profile */

class _EditProfileSheet extends ConsumerStatefulWidget {
  const _EditProfileSheet({required this.m, required this.me, required this.onSaved});
  final MasterView m;
  final MasterMe me;
  final VoidCallback onSaved;

  @override
  ConsumerState<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends ConsumerState<_EditProfileSheet> {
  late final _nickname = TextEditingController(text: widget.m.nickname);
  late final _strategy = TextEditingController(text: widget.m.strategy);
  late final _desc = TextEditingController(text: widget.m.description);
  late double _fee = widget.m.perfFeePct;
  late String _period = widget.m.feePeriod;
  late final _minAlloc = TextEditingController(text: inputText(widget.m.minAllocation));
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_nickname, _strategy, _desc, _minAlloc]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final t = context.t;
    final m = widget.m;
    final minAlloc = parseAmount(_minAlloc.text);
    final body = <String, Object?>{
      if (_nickname.text.trim() != m.nickname) 'nickname': _nickname.text.trim(),
      if (_strategy.text.trim() != m.strategy) 'strategy': _strategy.text.trim(),
      if (_desc.text.trim() != m.description) 'description': _desc.text.trim(),
      if (_fee != m.perfFeePct) 'perfFeePct': _fee,
      if (_period != m.feePeriod) 'feePeriod': _period,
      if (minAlloc != null && minAlloc != m.minAllocation) 'minAllocation': minAlloc,
    };
    if (body.isEmpty) return Navigator.of(context).pop();
    setState(() => _busy = true);
    try {
      final r = await socialPatch(ref, 'master/me', body);
      // A8: a lower fee reaches the followers at once; anything else waits for their acceptance
      final termsChanged = body.containsKey('perfFeePct') || body.containsKey('feePeriod');
      final terms = r['terms'] is Map ? mapOf(r['terms']) : null;
      final parts = <String>[
        if (intOf(terms?['pending']) > 0) t('social.md.terms.pending', {'count': intOf(terms?['pending'])}),
        if (intOf(terms?['applied']) > 0) t('social.md.terms.applied', {'count': intOf(terms?['applied'])}),
      ];
      okToast(
        ref,
        t('social.md.toast.profileUpdated'),
        parts.isNotEmpty ? parts.join(' ') : (termsChanged ? (terms != null ? t('social.md.terms.newOnly') : t('social.md.toast.newTerms')) : null),
      );
      widget.onSaved();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.md.toast.profileFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final m = widget.m;
    final lower = _fee < m.perfFeePct && _period == m.feePeriod;
    return KSheetContent(
      footer: SheetFooter(label: t('common.save'), busy: _busy, onPressed: _nickname.text.trim().length < 3 || _strategy.text.trim().isEmpty ? null : _save),
      children: [
        SheetTitle(title: t('social.md.edit.title'), description: t('social.md.edit.description')),
        KTextField(
          controller: _nickname,
          label: t('social.md.nickname'),
          hint: Num('${_nickname.text.length}/32', color: k.fg3),
          inputFormatters: [LengthLimitingTextInputFormatter(32)],
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        KTextField(
          controller: _strategy,
          label: t('social.md.strategy'),
          hint: Num('${_strategy.text.length}/60', color: k.fg3),
          inputFormatters: [LengthLimitingTextInputFormatter(60)],
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        TextArea(
          controller: _desc,
          label: t('social.md.description'),
          counter: '${_desc.text.length}/1000',
          maxLength: 1000,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        _FeeSlider(value: _fee, min: widget.me.feeMinPct, max: widget.me.feeMaxPct, onChanged: (v) => setState(() => _fee = v)),
        if (_fee != m.perfFeePct || _period != m.feePeriod) ...[
          const SizedBox(height: 10),
          InfoBox(
            tone: lower ? KChipTone.up : KChipTone.warn,
            icon: LucideIcons.fileText,
            text: lower ? t('social.md.terms.lowerHint') : t('social.md.terms.changeHint'),
          ),
        ],
        const SizedBox(height: 16),
        GroupLabel(t('social.md.feeSettlement')),
        KSegmented<String>(
          plain: true,
          values: kPeriods,
          labels: [for (final p in kPeriods) periodLabel(t, p)],
          selected: _period,
          onChanged: (v) => setState(() => _period = v),
        ),
        const SizedBox(height: 14),
        NumberField(controller: _minAlloc, label: t('social.profile.minAllocation'), hint: 'USD', dollar: true),
      ],
    );
  }
}

/// The performance-fee slider with its big gold value (web RangeSlider tone gold).
class _FeeSlider extends StatelessWidget {
  const _FeeSlider({required this.value, required this.min, required this.max, required this.onChanged});
  final double value, min, max;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(t('social.performanceFee'), style: context.text.label.copyWith(color: context.k.fg2)),
            ),
            Num('${numText(value)}%', color: context.k.gold, style: context.text.title1),
          ],
        ),
        SocialSlider(value: value, min: min, max: max, onChanged: onChanged),
      ],
    );
  }
}

/* ------------------------------------------------------------------ fund form */

class _FundFormSheet extends ConsumerStatefulWidget {
  const _FundFormSheet({required this.fund, required this.me, required this.onSaved});
  final FundView? fund;
  final MasterMe me;
  final VoidCallback onSaved;

  @override
  ConsumerState<_FundFormSheet> createState() => _FundFormSheetState();
}

class _FundFormSheetState extends ConsumerState<_FundFormSheet> {
  late final _name = TextEditingController(text: widget.fund?.name ?? '');
  late String _period = widget.fund?.period ?? 'weekly';
  late double _fee = (widget.fund?.perfFeePct ?? 20).clamp(widget.me.feeMinPct, widget.me.feeMaxPct);
  late int _lock = widget.fund?.lockInDays ?? 30;
  late final _minInv = TextEditingController(text: inputText(widget.fund?.minInvestment ?? 100));
  late final _maxDd = TextEditingController(text: inputText(widget.fund?.maxDdPct ?? 35));
  final _seed = TextEditingController();
  bool _busy = false;
  Map<String, dynamic>? _creds;
  String _credsName = '';

  bool get _create => widget.fund == null;

  @override
  void dispose() {
    for (final c in [_name, _minInv, _maxDd, _seed]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _err(T t) {
    if (_name.text.trim().length < 3) return t('social.md.fund.err.name');
    if (!((parseAmount(_minInv.text) ?? -1) >= 0)) return t('social.md.fund.err.minInv');
    final dd = parseAmount(_maxDd.text);
    if (dd == null || dd < 1 || dd > 99) return t('social.md.fund.err.maxDd');
    if (_create && !((parseAmount(_seed.text) ?? 0) > 0)) return t('social.md.fund.err.seed');
    return null;
  }

  Future<void> _save() async {
    final t = context.t;
    final err = _err(t);
    if (err != null) return plainError(ref, err);
    setState(() => _busy = true);
    try {
      final body = <String, Object?>{
        'name': _name.text.trim(),
        'period': _period,
        'perfFeePct': _fee,
        'lockInDays': _lock,
        'minInvestment': parseAmount(_minInv.text),
        'maxDdPct': parseAmount(_maxDd.text),
      };
      if (_create) {
        body['seed'] = parseAmount(_seed.text);
        final r = await socialPost(ref, 'funds', body);
        final fund = FundView(mapOf(r['fund']));
        final creds = mapOf(r['credentials']);
        okToast(
          ref,
          t('social.md.fund.isOpen', {'name': fund.name}),
          t('social.md.fund.openedDesc', {'login': strOf(creds['login']), 'amount': usd(parseAmount(_seed.text) ?? 0)}),
        );
        if (mounted) {
          setState(() {
            _creds = creds;
            _credsName = fund.name;
          });
        }
      } else {
        await socialPatch(ref, 'funds/${widget.fund!.id}', body);
        okToast(ref, t('social.md.fund.updated'));
        if (mounted) Navigator.of(context).pop();
      }
      widget.onSaved();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, _create ? t('social.md.fund.openFailed') : t('social.md.fund.updateFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    if (_creds != null) return _credsView(context);
    final err = _err(t);
    return KSheetContent(
      footer: SheetFooter(label: _create ? t('social.md.fund.create') : t('common.save'), busy: _busy, onPressed: err != null ? null : _save),
      children: [
        SheetTitle(
          title: _create ? t('social.md.fund.createTitle') : t('social.md.fund.editTitle', {'name': widget.fund!.name}),
          description: _create ? t('social.md.fund.createDesc') : t('social.md.fund.editDesc'),
        ),
        KTextField(
          controller: _name,
          label: t('social.md.fund.name'),
          hint: Num('${_name.text.length}/40', color: context.k.fg3),
          placeholder: t('social.md.fund.namePh'),
          inputFormatters: [LengthLimitingTextInputFormatter(40)],
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        GroupLabel(t('social.rollover')),
        KSegmented<String>(
          plain: true,
          values: kPeriods,
          labels: [for (final p in kPeriods) periodLabel(t, p)],
          selected: _period,
          onChanged: (v) => setState(() => _period = v),
        ),
        Hint(t('social.md.fund.rolloverNote'), top: 6),
        const SizedBox(height: 16),
        _FeeSlider(value: _fee, min: widget.me.feeMinPct, max: widget.me.feeMaxPct, onChanged: (v) => setState(() => _fee = v)),
        const SizedBox(height: 12),
        GroupLabel(t('social.md.fund.lockPeriod')),
        KChoiceChips<int>(
          values: _locks,
          labels: [
            for (final l in _locks) l > 0 ? t('social.age.days', {'d': l}) : t('common.none'),
          ],
          selected: _lock,
          onChanged: (v) => setState(() => _lock = v),
        ),
        const SizedBox(height: 12),
        NumberField(controller: _minInv, label: t('social.funds.minInvestment'), hint: 'USD', dollar: true, onChanged: (_) => setState(() {})),
        const SizedBox(height: 12),
        NumberField(
          controller: _maxDd,
          label: t('social.follow.maxDrawdown'),
          hint: t('social.md.fund.freezeAt'),
          unit: '%',
          onChanged: (_) => setState(() {}),
        ),
        if (_create) ...[
          const SizedBox(height: 12),
          NumberField(
            controller: _seed,
            label: t('social.md.fund.seed'),
            hint: t('social.md.fund.fromWallet'),
            dollar: true,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          InfoBox(
            text: t('social.md.fund.seedNote', {
              'pct': numText(widget.me.minOwnCapitalPct),
              'dd': parseAmount(_maxDd.text) != null ? numText(parseAmount(_maxDd.text)!) : '—',
            }),
          ),
        ],
      ],
    );
  }

  Widget _credsView(BuildContext context) {
    final t = context.t;
    final c = _creds!;
    final login = strOf(c['login']);
    final password = strOrNull(c['password']);
    final investor = strOrNull(c['investorPassword']);
    void copyAll() => kCopy(
      context,
      [
        '${t('social.md.fund.login')}: $login',
        '${t('social.md.fund.server')}: Ezymex-Live',
        if (password != null) '${t('social.md.fund.tradingPassword')}: $password',
        if (investor != null) '${t('social.md.fund.investorPassword')}: $investor',
      ].join('\n'),
      message: t('social.md.fund.credsCopied'),
    );
    return KSheetContent(
      footer: Row(
        children: [
          Expanded(
            child: KButton(
              label: t('common.done'),
              variant: KButtonVariant.surface,
              size: KButtonSize.lg,
              expand: true,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: KButton(
              label: t('social.md.fund.trade'),
              icon: LucideIcons.candlestickChart,
              size: KButtonSize.lg,
              expand: true,
              onPressed: () {
                final router = GoRouter.of(context);
                Navigator.of(context).pop();
                router.push('/trader?login=$login');
              },
            ),
          ),
        ],
      ),
      children: [
        SheetTitle(title: t('social.md.fund.isOpen', {'name': _credsName}), description: t('social.md.fund.credsDesc')),
        Row(
          children: [
            Icon(LucideIcons.keyRound, size: 16, color: context.k.fg3),
            const SizedBox(width: 8),
            Expanded(child: Text(t('social.md.fund.creds'), style: context.text.headline)),
            KButton(label: t('social.md.fund.copyAll'), icon: LucideIcons.copy, variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: copyAll),
          ],
        ),
        const SizedBox(height: 10),
        SecretRow(label: t('social.md.fund.login'), value: login),
        SecretRow(label: t('social.md.fund.server'), value: 'Ezymex-Live'),
        if (password != null) SecretRow(label: t('social.md.fund.tradingPassword'), value: password, secret: true, hint: t('social.md.fund.fullAccess')),
        if (investor != null) SecretRow(label: t('social.md.fund.investorPassword'), value: investor, secret: true, hint: t('social.md.fund.readOnly')),
        const SizedBox(height: 6),
        InfoBox(
          tone: KChipTone.warn,
          icon: LucideIcons.triangleAlert,
          child: KRichText(t('social.md.fund.onceWarning'), tags: const {'b': KTag()}),
        ),
        const SizedBox(height: 8),
        InfoBox(text: t('social.md.fund.moneyNote')),
      ],
    );
  }
}

/// A credential line (web SecretField): label, the value (hidden until revealed when secret), copy.
class SecretRow extends StatefulWidget {
  const SecretRow({super.key, required this.label, required this.value, this.secret = false, this.hint});
  final String label;
  final String value;
  final bool secret;
  final String? hint;

  @override
  State<SecretRow> createState() => _SecretRowState();
}

class _SecretRowState extends State<SecretRow> {
  bool _shown = false;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final t = context.t;
    final hidden = widget.secret && !_shown;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsetsDirectional.fromSTEB(14, 8, 6, 8),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.label,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
                const SizedBox(height: 2),
                Num(hidden ? '••••••••••' : widget.value, style: context.text.mono(14, weight: FontWeight.w600)),
                if (widget.hint != null)
                  Text(
                    widget.hint!,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
              ],
            ),
          ),
          if (widget.secret)
            KIconButton(
              icon: _shown ? LucideIcons.eyeOff : LucideIcons.eye,
              size: 34,
              semanticLabel: widget.label,
              onPressed: () => setState(() => _shown = !_shown),
            ),
          KIconButton(icon: LucideIcons.copy, size: 34, semanticLabel: t('common.copy'), onPressed: () => kCopy(context, widget.value)),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ A11 master tools */

/// Max followers, "accept new followers" and the private (invite-only) copy link: PATCH master/me.
class FollowerSettingsCard extends ConsumerStatefulWidget {
  const FollowerSettingsCard({super.key, required this.m, required this.followers, required this.readOnly, required this.onSaved});
  final MasterView m;
  final int followers;
  final bool readOnly;
  final VoidCallback onSaved;

  @override
  ConsumerState<FollowerSettingsCard> createState() => _FollowerSettingsCardState();
}

class _FollowerSettingsCardState extends ConsumerState<FollowerSettingsCard> {
  late bool _acceptNew = widget.m.acceptNew ?? true;
  late bool _inviteOnly = widget.m.inviteOnly;
  late final _maxF = TextEditingController(text: inputText(widget.m.maxFollowers));
  String? _busy;

  @override
  void didUpdateWidget(FollowerSettingsCard old) {
    super.didUpdateWidget(old);
    // follow the server after each save / poll
    if (old.m.acceptNew != widget.m.acceptNew) _acceptNew = widget.m.acceptNew ?? true;
    if (old.m.inviteOnly != widget.m.inviteOnly) _inviteOnly = widget.m.inviteOnly;
    if (old.m.maxFollowers != widget.m.maxFollowers) _maxF.text = inputText(widget.m.maxFollowers);
  }

  @override
  void dispose() {
    _maxF.dispose();
    super.dispose();
  }

  Future<void> _patch(String key, Map<String, Object?> body, String ok, {String? desc, VoidCallback? revert}) async {
    final t = context.t;
    setState(() => _busy = key);
    try {
      await socialPatch(ref, 'master/me', body);
      okToast(ref, ok, desc);
      widget.onSaved();
    } on ApiException catch (e) {
      revert?.call();
      if (mounted) errToast(ref, context, t('social.md.fol.saveFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final m = widget.m;
    final raw = _maxF.text.trim();
    final maxV = raw.isEmpty ? null : int.tryParse(raw);
    final maxErr = raw.isNotEmpty && (maxV == null || maxV < 0 || maxV > 100000) ? t('social.md.fol.maxErr') : null;
    final maxDirty = maxErr == null && maxV != m.maxFollowers;
    final appUrl = ref.watch(configProvider).appUrl;
    final link = m.inviteCode != null ? '$appUrl/social/masters/${m.id}?invite=${m.inviteCode}' : '';
    final accepting = m.acceptingNew != false;
    Widget settingRow(String title, String text, Widget control) => Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(14, 11, 10, 11),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                ),
                Text(text, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          control,
        ],
      ),
    );
    return SectionCard(
      title: t('social.md.fol.title'),
      subtitle: t('social.md.fol.subtitle'),
      icon: LucideIcons.userCog,
      action: KChip(
        label: '${accepting ? t('social.md.fol.open') : t('social.notAccepting')}${m.maxFollowers != null ? ' · ${widget.followers}/${m.maxFollowers}' : ''}',
        tone: accepting ? KChipTone.up : KChipTone.warn,
        small: true,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          settingRow(
            t('social.md.fol.acceptNew'),
            t('social.md.fol.acceptNewText'),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_busy == 'acceptNew') const Padding(padding: EdgeInsetsDirectional.only(end: 6), child: KSpinner()),
                KSwitch(
                  value: _acceptNew,
                  semanticLabel: t('social.md.fol.acceptNew'),
                  onChanged: widget.readOnly
                      ? null
                      : (v) {
                          setState(() => _acceptNew = v);
                          _patch(
                            'acceptNew',
                            {'acceptNew': v},
                            v ? t('social.md.fol.toast.open') : t('social.md.fol.toast.closed'),
                            desc: v ? null : t('social.md.fol.toast.closedDesc'),
                            revert: () => setState(() => _acceptNew = !v),
                          );
                        },
                ),
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(14, 11, 14, 12),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  t('social.md.fol.max'),
                  style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                ),
                Text(t('social.md.fol.maxText'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: NumberField(
                        controller: _maxF,
                        placeholder: t('social.md.fol.noLimit'),
                        integer: true,
                        error: maxErr,
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    if (!widget.readOnly) ...[
                      const SizedBox(width: 8),
                      KButton(
                        label: t('common.save'),
                        variant: KButtonVariant.surface,
                        loading: _busy == 'max',
                        onPressed: !maxDirty
                            ? null
                            : () => _patch(
                                'max',
                                {'maxFollowers': maxV},
                                t('social.md.fol.toast.maxSaved'),
                                desc: maxV == null ? t('social.md.fol.toast.noLimitDesc') : t('social.md.fol.toast.maxDesc', {'n': maxV}),
                              ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          settingRow(
            t('social.md.fol.inviteOnly'),
            t('social.md.fol.inviteOnlyText'),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_busy == 'inviteOnly') const Padding(padding: EdgeInsetsDirectional.only(end: 6), child: KSpinner()),
                KSwitch(
                  value: _inviteOnly,
                  semanticLabel: t('social.md.fol.inviteOnly'),
                  onChanged: widget.readOnly
                      ? null
                      : (v) {
                          setState(() => _inviteOnly = v);
                          _patch(
                            'inviteOnly',
                            {'inviteOnly': v},
                            v ? t('social.md.fol.toast.private') : t('social.md.fol.toast.public'),
                            desc: v ? t('social.md.fol.toast.privateDesc') : t('social.md.fol.toast.publicDesc'),
                            revert: () => setState(() => _inviteOnly = !v),
                          );
                        },
                ),
              ],
            ),
          ),
          if (_inviteOnly && m.inviteOnly)
            Builder(
              builder: (context) {
                final (bg, _, border) = k.chip(KChipTone.gold);
                return Container(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(LucideIcons.link2, size: 14, color: k.gold),
                          const SizedBox(width: 6),
                          Text(
                            t('social.md.fol.link'),
                            style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (link.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                          decoration: BoxDecoration(
                            color: k.surface2,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: k.line),
                          ),
                          child: Num(link, color: k.fg2, style: context.text.mono(12)),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            KButton(
                              label: t('social.md.fol.copyLink'),
                              icon: LucideIcons.copy,
                              size: KButtonSize.sm,
                              onPressed: () => kCopy(context, link, message: t('social.md.fol.linkCopied')),
                            ),
                            if (!widget.readOnly)
                              KButton(
                                label: t('social.md.fol.newLink'),
                                icon: LucideIcons.refreshCw,
                                variant: KButtonVariant.surface,
                                size: KButtonSize.sm,
                                loading: _busy == 'regen',
                                onPressed: () =>
                                    _patch('regen', {'regenerateInvite': true}, t('social.md.fol.toast.newLink'), desc: t('social.md.fol.toast.newLinkDesc')),
                              ),
                          ],
                        ),
                      ] else
                        Text(t('social.md.fol.linkPending'), style: context.text.footnote.copyWith(color: k.fg3)),
                      Hint(t('social.md.fol.linkNote'), top: 8),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

/// A small activity indicator next to a switch.
class KSpinner extends StatelessWidget {
  const KSpinner({super.key});

  @override
  Widget build(BuildContext context) => SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 1.6, color: context.k.fg3));
}

/// Compose an announcement to every follower still copying (POST master/announcements) and the ones sent before.
class AnnouncementsCard extends ConsumerStatefulWidget {
  const AnnouncementsCard({super.key, required this.items, required this.readOnly, required this.onSent});
  final List<Map<String, dynamic>> items;
  final bool readOnly;
  final VoidCallback onSent;

  @override
  ConsumerState<AnnouncementsCard> createState() => _AnnouncementsCardState();
}

class _AnnouncementsCardState extends ConsumerState<AnnouncementsCard> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _busy = false;
  List<Map<String, dynamic>>? _sent;

  @override
  void didUpdateWidget(AnnouncementsCard old) {
    super.didUpdateWidget(old);
    // a newer list from the dashboard poll replaces the one returned by the last send
    String ids(List<Map<String, dynamic>> l) => l.map((a) => strOf(a['id'])).join(',');
    if (ids(old.items) != ids(widget.items)) _sent = null;
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  bool get _ok => _title.text.trim().length >= 3 && _title.text.trim().length <= 120 && _body.text.length <= 2000;

  Future<void> _send() async {
    final t = context.t;
    if (!_ok) return plainError(ref, t('social.md.ann.err'));
    setState(() => _busy = true);
    try {
      final r = await socialPost(ref, 'master/announcements', {'title': _title.text.trim(), if (_body.text.trim().isNotEmpty) 'body': _body.text.trim()});
      okToast(ref, t('social.md.ann.sent'), t('social.md.ann.sentDesc', {'count': intOf(mapOf(r['announcement'])['recipients'])}));
      setState(() {
        _sent = r['items'] is List ? listOf(r['items']) : null;
        _title.clear();
        _body.clear();
      });
      widget.onSent();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.md.ann.failed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return SectionCard(
      title: t('social.md.ann.title'),
      subtitle: t('social.md.ann.subtitle'),
      icon: LucideIcons.megaphone,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!widget.readOnly) ...[
            KTextField(
              controller: _title,
              label: t('social.md.ann.titleLabel'),
              hint: Num('${_title.text.length}/120', color: context.k.fg3),
              placeholder: t('social.md.ann.titlePh'),
              inputFormatters: [LengthLimitingTextInputFormatter(120)],
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextArea(
              controller: _body,
              label: t('social.md.ann.message'),
              counter: '${_body.text.length}/2000',
              placeholder: t('social.md.ann.messagePh'),
              maxLength: 2000,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            Hint(t('social.md.ann.note')),
            const SizedBox(height: 10),
            KButton(
              label: t('social.md.ann.send'),
              icon: LucideIcons.send,
              variant: KButtonVariant.surface,
              loading: _busy,
              expand: true,
              onPressed: _ok ? _send : null,
            ),
            const SizedBox(height: 16),
          ],
          GroupLabel(t('social.md.ann.past')),
          AnnouncementList(items: _sent ?? widget.items, empty: t('social.md.ann.empty'), showRecipients: true),
          const SizedBox(height: 4),
          InfoBox(text: t('social.md.ann.rules')),
        ],
      ),
    );
  }
}
