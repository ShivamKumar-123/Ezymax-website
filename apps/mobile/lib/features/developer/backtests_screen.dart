// API & Algo › Backtests (/developer/backtests): port of apps/crm/components/algo/backtests-page.tsx
// (LiveBacktestsPage). Phone order (xl grid collapsed): header (Strategy builder) · new backtest (strategy, dates,
// balance, costs, spread, Run) · history (progress, cancel) · the selected run (`?id=`): progress or the report.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'developer_api.dart';
import 'widgets/algo_widgets.dart';
import 'widgets/report.dart';

const _groups = ['standard', 'pro', 'ecn', 'vip'];
const _presets = [('1M', 30), ('3M', 91), ('6M', 182), ('1Y', 365), ('3Y', 1095)];

class DeveloperBacktestsScreen extends ConsumerStatefulWidget {
  const DeveloperBacktestsScreen({super.key, this.query = const {}});
  final Map<String, String> query;

  @override
  ConsumerState<DeveloperBacktestsScreen> createState() => _DeveloperBacktestsScreenState();
}

class _DeveloperBacktestsScreenState extends ConsumerState<DeveloperBacktestsScreen> {
  final _reportKey = GlobalKey();
  late int? _strategyId = int.tryParse(widget.query['strategy'] ?? '');
  late int? _openId = int.tryParse(widget.query['id'] ?? '');
  final DateTime _today = DateTime.now();
  late String _from = isoDay(_today.subtract(const Duration(days: 365)));
  late String _to = isoDay(_today);
  double _balance = 10000;
  String _costMode = 'group';
  String _group = 'standard';
  int? _login;
  double? _spread;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (_openId != null) revealLater(_reportKey);
  }

  @override
  void didUpdateWidget(DeveloperBacktestsScreen old) {
    super.didUpdateWidget(old);
    final id = int.tryParse(widget.query['id'] ?? '');
    if (id != null && widget.query['id'] != old.query['id']) {
      _openId = id;
      revealLater(_reportKey);
    }
    final s = int.tryParse(widget.query['strategy'] ?? '');
    if (s != null && widget.query['strategy'] != old.query['strategy']) _strategyId = s;
  }

  Future<void> _refresh() async {
    ref
      ..invalidate(strategiesProvider)
      ..invalidate(backtestsProvider)
      ..invalidate(algoAccountsProvider);
    if (_openId != null) ref.invalidate(backtestDetailProvider(_openId!));
    await ref.read(backtestsProvider.future).then((_) {}, onError: (Object _) {});
  }

  Future<void> _start(StrategyItem s) async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).algoPost('backtests', {
        'strategyId': s.id,
        'from': _from,
        'to': _to,
        'initialBalance': _balance,
        if (_costMode == 'account' && _login != null) 'login': _login else 'group': _group,
        'spreadPoints': ?_spread,
      });
      algoOk(ref, t('developer.bt.queued'), description: '${s.name} · ${s.symbol} ${s.timeframe} · $_from → $_to');
      ref.invalidate(backtestsProvider);
      setState(() => _openId = jI(r['id']));
      revealLater(_reportKey);
    } on Object catch (e) {
      algoFail(ref, t, t('developer.bt.startFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(int id) async {
    final t = context.t;
    try {
      await ref.read(apiProvider).algoPost('backtests/$id/cancel');
      ref.invalidate(backtestsProvider);
      if (id == _openId) ref.invalidate(backtestDetailProvider(id));
    } on Object catch (e) {
      algoFail(ref, t, t('developer.bt.cancelFailed'), e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final strategies = ref.watch(strategiesProvider);
    final accounts = ref.watch(algoAccountsProvider).value ?? const <AlgoAccount>[];
    final list = ref.watch(backtestsProvider);
    final items = strategies.value ?? const <StrategyItem>[];
    _strategyId ??= (items.where((s) => s.valid).firstOrNull ?? items.firstOrNull)?.id;
    final strat = items.where((s) => s.id == _strategyId).firstOrNull;
    final rows = list.value ?? const <BacktestRow>[];
    final acct = accounts.where((a) => a.login == _login).firstOrNull;

    return KPageScroll(
      onRefresh: _refresh,
      children: [
        KPageHeader(title: t('developer.bt.title'), subtitle: Text(t('developer.bt.subtitle'))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KButton(
            label: t('developer.bt.strategyBuilder'),
            icon: LucideIcons.workflow,
            variant: KButtonVariant.surface,
            onPressed: () => context.go('/developer/strategies'),
          ),
        ),
        const SizedBox(height: 20),
        // new backtest
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(icon: LucideIcons.flaskConical, title: t('developer.bt.new'), subtitle: t('developer.bt.newSubtitle')),
              const SizedBox(height: 14),
              if (strategies.isLoading && !strategies.hasValue)
                const KSkeleton(height: 44, radius: 14)
              else if (items.isEmpty)
                KRichText(
                  t('developer.bt.saveFirst'),
                  style: context.text.callout.copyWith(color: k.fg3),
                  tags: {'link': KTag.link(() => context.go('/developer/strategies'))},
                )
              else
                KPickerField(
                  value: strat?.name,
                  placeholder: t('developer.bt.chooseStrategy'),
                  leading: strat == null ? null : SymbolAvatar(strat.symbol, size: 18),
                  onTap: () async {
                    final id = await showKPicker<int>(
                      context,
                      title: t('developer.bt.strategy'),
                      selected: _strategyId,
                      options: [
                        for (final s in items)
                          KPickOption(
                            s.id,
                            s.name,
                            subtitle: '${s.symbol} ${s.timeframe} · v${s.version}${s.valid ? '' : ' · ${t('developer.draft')}'}',
                            leading: SymbolAvatar(s.symbol, size: 22),
                          ),
                      ],
                    );
                    if (id != null) setState(() => _strategyId = id);
                  },
                ),
              if (strat != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${strat.symbol} ${strat.timeframe} · v${strat.version}',
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(11.5, color: k.fg3),
                ),
              ],
              if (strat != null && !strat.valid) ...[
                const SizedBox(height: 6),
                Text(t('developer.bt.versionHasErrors'), style: context.text.footnote.copyWith(color: k.down)),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DateField(label: t('developer.bt.from'), value: _from, max: _to, onChanged: (v) => setState(() => _from = v)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DateField(label: t('developer.bt.to'), value: _to, min: _from, max: isoDay(_today), onChanged: (v) => setState(() => _to = v)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final (label, days) in _presets)
                    DashedPill(
                      label: label,
                      icon: LucideIcons.calendarRange,
                      onTap: () => setState(() {
                        _from = isoDay(_today.subtract(Duration(days: days)));
                        _to = isoDay(_today);
                      }),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              _InlineRow(
                label: t('developer.bt.initialBalance'),
                child: NumField(
                  value: _balance,
                  min: 100,
                  suffix: 'USD',
                  width: 90,
                  semanticLabel: t('developer.bt.initialBalance'),
                  onChanged: (v) => _balance = v,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(t('developer.bt.costsFrom'), style: context.text.callout.copyWith(color: k.fg3)),
                  ),
                  SizedBox(
                    width: 210,
                    child: KSegmented<String>(
                      values: const ['group', 'account'],
                      labels: [t('developer.bt.accountType'), t('developer.bt.myAccount')],
                      selected: _costMode,
                      plain: true,
                      height: 32,
                      onChanged: (v) => setState(() => _costMode = v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_costMode == 'group')
                PillChoice<String>(
                  values: _groups,
                  labels: [for (final g in _groups) t('developer.group.$g')],
                  isSelected: (v) => v == _group,
                  onTap: (v) => setState(() => _group = v),
                )
              else
                KPickerField(
                  value: acct == null ? null : '${accountTypeLabel(t, acct.type)} #${acct.login} · ${acct.groupName}',
                  placeholder: t('developer.chooseAccount'),
                  onTap: () async {
                    final l = await showKPicker<int>(
                      context,
                      title: t('developer.bt.accountForCosts'),
                      selected: _login,
                      options: [for (final a in accounts) KPickOption(a.login, '${accountTypeLabel(t, a.type)} #${a.login}', subtitle: a.groupName)],
                    );
                    if (l != null) setState(() => _login = l);
                  },
                ),
              const SizedBox(height: 12),
              _InlineRow(
                label: t('developer.bt.spread'),
                child: _spread == null
                    ? KTextButton(label: t('developer.bt.liveSpreadSetFixed'), onPressed: () => setState(() => _spread = 10))
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          NumField(
                            value: _spread!,
                            min: 0,
                            suffix: t('developer.unit.pts'),
                            semanticLabel: t('developer.bt.fixedSpread'),
                            onChanged: (v) => _spread = v,
                          ),
                          KPressable(
                            minSize: 36,
                            semanticLabel: t('developer.bt.useLiveSpread'),
                            onTap: () => setState(() => _spread = null),
                            child: Icon(LucideIcons.x, size: 15, color: k.fg3),
                          ),
                        ],
                      ),
              ),
              if (!readOnly) ...[
                const SizedBox(height: 14),
                KButton(
                  label: t('developer.bt.run'),
                  icon: LucideIcons.play,
                  expand: true,
                  size: KButtonSize.lg,
                  loading: _busy,
                  onPressed: strat == null || !strat.valid ? null : () => _start(strat),
                ),
              ],
              const SizedBox(height: 8),
              Text(
                t('developer.bt.limitsNote'),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // history
        KCard(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.bt.history'), subtitle: t('developer.bt.recent', {'count': rows.length})),
              const SizedBox(height: 8),
              KAsync(
                value: list,
                onRetry: () => ref.invalidate(backtestsProvider),
                loading: const Padding(padding: EdgeInsets.only(bottom: 8), child: KSkeleton(height: 80, radius: 14)),
                error: (e) => KLoadError(error: e, card: false, onRetry: () => ref.invalidate(backtestsProvider)),
                builder: (_) => rows.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                        child: Text(t('developer.bt.none'), style: context.text.footnote.copyWith(color: k.fg3)),
                      )
                    : Column(
                        children: [
                          for (final b in rows)
                            _HistoryRow(
                              b: b,
                              selected: b.id == _openId,
                              readOnly: readOnly,
                              onTap: () {
                                setState(() => _openId = b.id);
                                revealLater(_reportKey);
                              },
                              onCancel: () => _cancel(b.id),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        KeyedSubtree(
          key: _reportKey,
          child: _openId == null
              ? KCard(
                  child: KEmptyState(icon: LucideIcons.flaskConical, title: t('developer.bt.emptyTitle'), text: t('developer.bt.emptyText')),
                )
              : _ReportArea(id: _openId!),
        ),
      ],
    );
  }
}

class _InlineRow extends StatelessWidget {
  const _InlineRow({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      constraints: const BoxConstraints(minHeight: 48),
      padding: const EdgeInsetsDirectional.only(start: 12, end: 6),
      decoration: BoxDecoration(color: k.surface2.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: context.text.callout.copyWith(color: k.fg3)),
          ),
          child,
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.b, required this.selected, required this.readOnly, required this.onTap, required this.onCancel});
  final BacktestRow b;
  final bool selected, readOnly;
  final VoidCallback onTap, onCancel;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final tone = switch (b.status) {
      'done' => KChipTone.up,
      'failed' => KChipTone.down,
      'running' => KChipTone.ember,
      _ => KChipTone.neutral,
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(color: selected ? k.surface3 : Colors.transparent, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KPressable(
            pressedScale: 0.99,
            onTap: onTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(b.strategyName, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.headline.copyWith(fontSize: 14)),
                    ),
                    const SizedBox(width: 6),
                    Text('v${b.version}', style: context.text.caption.copyWith(color: k.fg3)),
                    const Spacer(),
                    KChip(
                      label: t.dyn('developer.btStatus.${b.status}', fallback: b.status),
                      tone: tone,
                      dot: b.status == 'running',
                      small: true,
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${b.symbol} ${b.timeframe} · ${fmtDate(jDn(b.params['from']))} → ${fmtDate(jDn(b.params['to']))}',
                        textDirection: TextDirection.ltr,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.mono(11, color: k.fg3),
                      ),
                    ),
                    if (b.summary != null)
                      Text(
                        fmtPct(b.summary!.returnPct),
                        textDirection: TextDirection.ltr,
                        style: context.text.mono(11.5, color: b.summary!.returnPct >= 0 ? k.up : k.down, weight: FontWeight.w600),
                      ),
                  ],
                ),
              ],
            ),
          ),
          if (b.active) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(child: KProgressBar(value: b.progress)),
                if (!readOnly) KTextButton(label: t('common.cancel'), color: k.fg3, onPressed: onCancel),
              ],
            ),
          ],
          if (b.status == 'failed' && b.error != null) ...[
            const SizedBox(height: 4),
            Text(
              b.error!,
              style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w400),
            ),
          ],
        ],
      ),
    );
  }
}

/// The selected run: progress while it runs, the failure, or the report.
class _ReportArea extends ConsumerWidget {
  const _ReportArea({required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final d = ref.watch(backtestDetailProvider(id));
    return KAsync(
      value: d,
      skeletonHeight: 480,
      onRetry: () => ref.invalidate(backtestDetailProvider(id)),
      builder: (b) {
        if (b.status != 'done' || b.report == null) {
          return KCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 8),
              child: b.status == 'failed'
                  ? Column(
                      children: [
                        Text(t('developer.bt.failed'), style: context.text.headline.copyWith(color: k.down)),
                        const SizedBox(height: 8),
                        Text(
                          b.error ?? '',
                          textAlign: TextAlign.center,
                          style: context.text.callout.copyWith(color: k.fg2),
                        ),
                      ],
                    )
                  : b.status == 'cancelled'
                  ? Text(
                      t('common.cancelled'),
                      textAlign: TextAlign.center,
                      style: context.text.callout.copyWith(color: k.fg2),
                    )
                  : Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SizedBox.square(dimension: 16, child: CircularProgressIndicator.adaptive(strokeWidth: 2)),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                b.status == 'queued' ? t('developer.bt.queuedLabel') : (b.stage ?? t('developer.bt.running')),
                                style: context.text.callout.copyWith(color: k.fg),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        KProgressBar(value: b.progress),
                        const SizedBox(height: 6),
                        Text('${(b.progress * 100).round()}%', style: context.text.mono(12, color: k.fg3)),
                      ],
                    ),
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                SymbolAvatar(b.symbol, size: 22),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(b.strategyName, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.title2),
                ),
                const SizedBox(width: 8),
                KChip(label: 'v${b.version}', small: true),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${b.symbol} ${b.timeframe} · ${fmtDate(jDn(b.params['from']))} → ${fmtDate(jDn(b.params['to']))} · \$${fmtNum(jD(b.params['initialBalance']), 0)}',
              textDirection: TextDirection.ltr,
              style: context.text.mono(11.5, color: k.fg3),
            ),
            const SizedBox(height: 2),
            Text(
              t('developer.bt.computedIn', {'s': (b.cpuMs / 1000).toStringAsFixed(1)}),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
            const SizedBox(height: 14),
            BacktestReportView(bt: b),
          ],
        );
      },
    );
  }
}
