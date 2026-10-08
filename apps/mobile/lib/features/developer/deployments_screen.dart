// API & Algo › Running strategies (/developer/deployments): port of apps/crm/components/algo/deployments-page.tsx
// (LiveDeploymentsPage). Phone order (xl grid collapsed): header (Strategy builder) · kill switch · deployments
// (Active / All) · the selected deployment (`?id=`): pause / resume / stop / close positions / kill (confirm), stats,
// realised curve, Log / Trades / Setup.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'developer_api.dart';
import 'widgets/algo_widgets.dart';

class DeveloperDeploymentsScreen extends ConsumerStatefulWidget {
  const DeveloperDeploymentsScreen({super.key, this.query = const {}});
  final Map<String, String> query;

  @override
  ConsumerState<DeveloperDeploymentsScreen> createState() => _DeveloperDeploymentsScreenState();
}

class _DeveloperDeploymentsScreenState extends ConsumerState<DeveloperDeploymentsScreen> {
  final _detailKey = GlobalKey();
  late int? _picked = int.tryParse(widget.query['id'] ?? '');
  String _filter = 'active';

  @override
  void didUpdateWidget(DeveloperDeploymentsScreen old) {
    super.didUpdateWidget(old);
    final id = int.tryParse(widget.query['id'] ?? '');
    if (id != null && widget.query['id'] != old.query['id']) {
      _picked = id;
      revealLater(_detailKey);
    }
  }

  Future<void> _refresh(int? sel) async {
    ref
      ..invalidate(deploymentsProvider)
      ..invalidate(algoControlsProvider);
    if (sel != null) ref.invalidate(deploymentDetailProvider(sel));
    await ref.read(deploymentsProvider.future).then((_) {}, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final list = ref.watch(deploymentsProvider);
    final items = list.value ?? const <Deployment>[];
    final selected = _picked ?? items.where((d) => d.status == 'running').firstOrNull?.id ?? items.firstOrNull?.id;
    final shown = items.where((d) => _filter == 'all' || d.live).toList();

    return KPageScroll(
      onRefresh: () => _refresh(selected),
      children: [
        KPageHeader(title: t('developer.dep.title'), subtitle: Text(t('developer.dep.subtitle'))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KButton(label: t('developer.bt.strategyBuilder'), icon: LucideIcons.workflow, onPressed: () => context.go('/developer/strategies')),
        ),
        const SizedBox(height: 20),
        _KillSwitchCard(readOnly: readOnly, onChange: () => ref.invalidate(deploymentsProvider)),
        const SizedBox(height: 16),
        KCard(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(
                title: t('developer.dep.deployments'),
                subtitle: t('developer.dep.nRunning', {'count': items.where((d) => d.status == 'running').length}),
                action: SizedBox(
                  width: 150,
                  child: KSegmented<String>(
                    values: const ['active', 'all'],
                    labels: [t('common.active'), t('common.all')],
                    selected: _filter,
                    height: 32,
                    onChanged: (v) => setState(() => _filter = v),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              KAsync(
                value: list,
                onRetry: () => ref.invalidate(deploymentsProvider),
                loading: const Padding(padding: EdgeInsets.only(bottom: 8), child: KSkeleton(height: 96, radius: 14)),
                error: (e) => KLoadError(error: e, card: false, onRetry: () => ref.invalidate(deploymentsProvider)),
                builder: (_) => shown.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                        child: Text(
                          '${_filter == 'active' ? t('developer.dep.nothingRunning') : t('developer.dep.noDeployments')} ${t('developer.dep.deployHint')}',
                          style: context.text.footnote.copyWith(color: k.fg3),
                        ),
                      )
                    : Column(
                        children: [
                          for (final d in shown)
                            KPressable(
                              pressedScale: 0.99,
                              onTap: () {
                                setState(() => _picked = d.id);
                                revealLater(_detailKey);
                              },
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 4),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                decoration: BoxDecoration(color: selected == d.id ? k.surface3 : Colors.transparent, borderRadius: BorderRadius.circular(12)),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      children: [
                                        SymbolAvatar(d.symbol, size: 18),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            d.strategyName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: context.text.headline.copyWith(fontSize: 14),
                                          ),
                                        ),
                                        DepStatusChip(d.status),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Padding(
                                      padding: const EdgeInsetsDirectional.only(start: 26),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              '${d.symbol} ${d.timeframe} · #${d.login}',
                                              textDirection: TextDirection.ltr,
                                              style: context.text.mono(11, color: k.fg3),
                                            ),
                                          ),
                                          Text(
                                            fmtSigned(d.realized),
                                            textDirection: TextDirection.ltr,
                                            style: context.text.mono(11.5, color: d.realized >= 0 ? k.up : k.down, weight: FontWeight.w600),
                                          ),
                                        ],
                                      ),
                                    ),
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
        const SizedBox(height: 16),
        KeyedSubtree(
          key: _detailKey,
          child: selected != null
              ? _DeploymentDetail(key: ValueKey(selected), id: selected, readOnly: readOnly, onChanged: () => ref.invalidate(deploymentsProvider))
              : (list.hasValue
                    ? KCard(
                        child: KEmptyState(icon: LucideIcons.workflow, title: t('developer.dep.emptyTitle'), text: t('developer.dep.emptyText')),
                      )
                    : const SizedBox.shrink()),
        ),
      ],
    );
  }
}

/// The account-wide kill switch (web KillSwitch, D84).
class _KillSwitchCard extends ConsumerStatefulWidget {
  const _KillSwitchCard({required this.readOnly, required this.onChange});
  final bool readOnly;
  final VoidCallback onChange;

  @override
  ConsumerState<_KillSwitchCard> createState() => _KillSwitchCardState();
}

class _KillSwitchCardState extends ConsumerState<_KillSwitchCard> {
  bool _busy = false;

  Future<void> _run(bool kill, {bool close = false}) async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).algoPost('controls/kill', {'killed': kill, 'closePositions': kill && close});
      if (kill) {
        final failed = jI(r['failed']);
        algoOk(
          ref,
          t('developer.kill.onToast'),
          kind: NotificationKind.warning,
          description:
              '${t('developer.kill.strategiesStopped', {'count': jI(r['stopped'])})} · ${t('developer.positionsClosed', {'count': jI(r['closed'])})}${failed > 0 ? ' · ${t('developer.kill.couldNotClose', {'count': failed})}' : ''}. ${t('developer.kill.blocked')}',
        );
      } else {
        algoOk(ref, t('developer.kill.releasedToast'), description: t('developer.kill.releasedText'));
      }
      ref.invalidate(algoControlsProvider);
      widget.onChange();
    } on Object catch (e) {
      algoFail(ref, t, t('developer.kill.failed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirm() async {
    final close = await showKSheet<bool>(context, title: context.t('developer.kill.confirmTitle'), builder: (_) => const _KillConfirmSheet());
    if (close != null && mounted) await _run(true, close: close);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final c = ref.watch(algoControlsProvider).value;
    final killed = c?.killed ?? false;
    final card = KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.shieldAlert, tone: KTone.coral, title: t('developer.kill.title'), subtitle: t('developer.kill.subtitle')),
          const SizedBox(height: 14),
          if (c?.globalKill ?? false) ...[KNotice(text: t('developer.kill.globalPaused'), tone: KChipTone.down), const SizedBox(height: 10)],
          if (killed) ...[
            Row(
              children: [
                Icon(LucideIcons.octagonX, size: 16, color: k.down),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(t('developer.kill.onSince', {'at': fmtDateTime(c?.killedAt)}), style: context.text.callout.copyWith(color: k.down)),
                ),
              ],
            ),
            if (!widget.readOnly) ...[
              const SizedBox(height: 10),
              KButton(
                label: t('developer.kill.release'),
                icon: LucideIcons.power,
                variant: KButtonVariant.surface,
                expand: true,
                loading: _busy,
                onPressed: () => _run(false),
              ),
            ],
          ] else if (!widget.readOnly)
            KButton(
              label: t('developer.kill.stopAll'),
              icon: LucideIcons.octagonX,
              variant: KButtonVariant.danger,
              expand: true,
              loading: _busy,
              onPressed: _confirm,
            ),
        ],
      ),
    );
    return killed
        ? DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(k.cardRadius),
              border: Border.all(color: k.down.withValues(alpha: 0.4)),
            ),
            child: card,
          )
        : card;
  }
}

/// web kill switch Dialog: "also close positions" and Kill all. Pops the toggle's value.
class _KillConfirmSheet extends StatefulWidget {
  const _KillConfirmSheet();

  @override
  State<_KillConfirmSheet> createState() => _KillConfirmSheetState();
}

class _KillConfirmSheetState extends State<_KillConfirmSheet> {
  bool _close = true;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KSheetContent(
      footer: KButton(
        label: t('developer.kill.killAll'),
        icon: LucideIcons.octagonX,
        variant: KButtonVariant.sell,
        expand: true,
        size: KButtonSize.lg,
        onPressed: () => Navigator.of(context).pop(_close),
      ),
      children: [
        Text(
          t('developer.kill.confirmText'),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg2),
        ),
        const SizedBox(height: 16),
        KListSection(
          margin: EdgeInsets.zero,
          children: [
            KListRow(
              title: t('developer.kill.alsoClose'),
              subtitle: t('developer.kill.alsoCloseHint'),
              trailing: KSwitch(value: _close, semanticLabel: t('developer.dep.closePositions'), onChanged: (v) => setState(() => _close = v)),
            ),
          ],
        ),
      ],
    );
  }
}

const Map<String, String> _kindTone = {'order': 'up', 'close': 'gold', 'signal': 'ember', 'eval': 'fg3', 'manage': 'info', 'error': 'down', 'info': 'fg2'};

/// The selected deployment (web Detail).
class _DeploymentDetail extends ConsumerStatefulWidget {
  const _DeploymentDetail({super.key, required this.id, required this.readOnly, required this.onChanged});
  final int id;
  final bool readOnly;
  final VoidCallback onChanged;

  @override
  ConsumerState<_DeploymentDetail> createState() => _DeploymentDetailState();
}

class _DeploymentDetailState extends ConsumerState<_DeploymentDetail> {
  String _tab = 'log';
  String? _busy;

  Future<void> _act(String action, [Map<String, Object?> body = const {}]) async {
    final t = context.t;
    setState(() => _busy = action);
    try {
      final r = await ref.read(apiProvider).algoPost('deployments/${widget.id}/$action', body);
      final title = switch (action) {
        'kill' => t('developer.dep.killed'),
        'stop' => t('developer.dep.stopped'),
        'pause' => t('developer.dep.paused'),
        'resume' => t('developer.dep.resumed'),
        _ => t('developer.dep.positionsClosedToast'),
      };
      final failed = jI(r['failed']);
      algoOk(
        ref,
        title,
        description: r['closed'] == null
            ? null
            : '${t('developer.positionsClosed', {'count': jI(r['closed'])})}${failed > 0 ? ', ${t('developer.dep.nFailed', {'count': failed})}' : ''}',
      );
      ref.invalidate(deploymentDetailProvider(widget.id));
      widget.onChanged();
    } on Object catch (e) {
      algoFail(ref, t, t('developer.dep.actionFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _kill(DeploymentDetail x) async {
    final t = context.t;
    final ok = await showKAlert<bool>(
      context,
      title: t('developer.dep.killTitle', {'name': x.strategyName}),
      message: '${t('developer.dep.killText')}\n\n${t('developer.dep.killNote')}',
      actions: [
        KAction(label: t('common.cancel'), value: false),
        KAction(label: t('developer.dep.killAndClose'), value: true, destructive: true, primary: true),
      ],
    );
    if (ok == true && mounted) await _act('kill', {'closePositions': true});
  }

  Color _tone(BuildContext context, String? name) {
    final k = context.k;
    return switch (name) {
      'up' => k.up,
      'down' => k.down,
      'gold' => k.gold,
      'ember' => k.ember,
      'info' => k.info,
      'fg3' => k.fg3,
      _ => k.fg2,
    };
  }

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(deploymentDetailProvider(widget.id));
    return KAsync(value: d, skeletonHeight: 520, onRetry: () => ref.invalidate(deploymentDetailProvider(widget.id)), builder: (x) => _build(context, x));
  }

  Widget _build(BuildContext context, DeploymentDetail x) {
    final t = context.t;
    final k = context.k;
    final live = x.live;
    final openCount = x.positions.where((p) => p.closedAt == null).length;
    var cum = x.startBalance ?? 0;
    final curve = [for (final p in x.daily) double.parse((cum += p.realized).toStringAsFixed(2))];
    final busy = _busy != null;
    final actions = <Widget>[
      if (x.status == 'running')
        KButton(
          label: t('developer.dep.pause'),
          icon: LucideIcons.pause,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          loading: _busy == 'pause',
          onPressed: busy ? null : () => _act('pause'),
        ),
      if (x.status == 'paused')
        KButton(
          label: t('developer.dep.resume'),
          icon: LucideIcons.play,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          loading: _busy == 'resume',
          onPressed: busy ? null : () => _act('resume'),
        ),
      if (live)
        KButton(
          label: t('developer.dep.stop'),
          icon: LucideIcons.square,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          loading: _busy == 'stop',
          onPressed: busy ? null : () => _act('stop', {'closePositions': false}),
        ),
      if (x.openPositions > 0 || openCount > 0)
        KButton(
          label: t('developer.dep.closePositions'),
          icon: LucideIcons.circleX,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          loading: _busy == 'close-positions',
          onPressed: busy ? null : () => _act('close-positions'),
        ),
      if (live)
        KButton(
          label: t('developer.dep.kill'),
          icon: LucideIcons.octagonX,
          variant: KButtonVariant.danger,
          size: KButtonSize.sm,
          loading: _busy == 'kill',
          onPressed: busy ? null : () => _kill(x),
        ),
    ];
    final realized = x.realized;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SymbolAvatar(x.symbol, size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(x.strategyName, style: context.text.title2),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        KChip(label: 'v${x.version}', small: true),
                        DepStatusChip(x.status),
                        if (x.subscriptionId != null) KChip(label: t('developer.dep.marketplaceCopy'), tone: KChipTone.gold, small: true),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${x.symbol} · ${x.timeframe} · ${accountTypeLabel(t, x.accountType)} #${x.login} · ${t('developer.dep.lastEval', {'ago': algoAgo(t, x.lastEvalAt)})}',
                      style: context.text.mono(11.5, color: k.fg3),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (!widget.readOnly && actions.isNotEmpty) ...[const SizedBox(height: 12), Wrap(spacing: 8, runSpacing: 8, children: actions)],
          if (x.error != null) ...[const SizedBox(height: 12), KNotice(text: x.error!, tone: KChipTone.down)],
          if (x.stopReason != null && !live) ...[
            const SizedBox(height: 10),
            Text(t('developer.dep.stoppedReason', {'reason': x.stopReason}), style: context.text.footnote.copyWith(color: k.fg3)),
          ],
          const SizedBox(height: 14),
          TileGrid(
            children: [
              MiniTile(label: t('developer.dep.realizedPnl'), value: fmtSigned(realized), color: realized >= 0 ? k.up : k.down, big: true),
              MiniTile(label: t('developer.dep.closedTrades'), value: '${x.trades}', big: true),
              MiniTile(label: t('developer.dep.winRate'), value: x.trades > 0 ? '${(x.wins / x.trades * 100).toStringAsFixed(1)}%' : '–', big: true),
              MiniTile(label: t('developer.dep.openPositions'), value: '$openCount', big: true),
            ],
          ),
          if (curve.length > 1) ...[
            const SizedBox(height: 14),
            KLineChart(values: curve, labels: [for (final p in x.daily) p.day], height: 150, color: k.gold, format: fmtMoney),
          ],
          const SizedBox(height: 14),
          KSegmented<String>(
            values: const ['log', 'positions', 'setup'],
            labels: ['${t('developer.dep.tabLog')} ${x.logs.length}', '${t('developer.dep.tabTrades')} ${x.positions.length}', t('developer.dep.tabSetup')],
            selected: _tab,
            plain: true,
            onChanged: (v) => setState(() => _tab = v),
          ),
          const SizedBox(height: 12),
          if (_tab == 'log')
            Container(
              constraints: const BoxConstraints(maxHeight: 420),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: k.dark ? Colors.black.withValues(alpha: 0.2) : k.surface2,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: k.line),
              ),
              child: x.logs.isEmpty
                  ? Text(t('developer.dep.waitingBar'), style: context.text.mono(11.5, color: k.fg3))
                  : SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final l in x.logs)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(
                                      text: '${_hms(l.at)}  ',
                                      style: TextStyle(color: k.fg3),
                                    ),
                                    TextSpan(
                                      text: '${t.dyn('developer.logKind.${l.kind}', fallback: l.kind).toUpperCase()}  ',
                                      style: TextStyle(color: _tone(context, _kindTone[l.kind])),
                                    ),
                                    TextSpan(
                                      text: l.message,
                                      style: TextStyle(color: l.level == 'error' ? k.down : (l.level == 'warn' ? k.warn : k.fg2)),
                                    ),
                                  ],
                                ),
                                style: context.text.mono(11.5).copyWith(height: 1.5),
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
          if (_tab == 'positions')
            x.positions.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      t('developer.dep.noTrades'),
                      textAlign: TextAlign.center,
                      style: context.text.footnote.copyWith(color: k.fg3),
                    ),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < x.positions.length; i++) ...[if (i > 0) const KDivider(), _PositionRow(p: x.positions[i])],
                    ],
                  ),
          if (_tab == 'setup') ...[
            SmallLabel(t('developer.dep.signals')),
            const SizedBox(height: 6),
            if (x.rulesHidden) Text(t('developer.dep.rulesHidden'), style: context.text.footnote.copyWith(color: k.fg3)) else SignalSummary(summary: x.summary),
            const SizedBox(height: 16),
            SmallLabel(t('developer.dep.limits')),
            const SizedBox(height: 4),
            KKeyValues(dense: true, [
              KKV(t('developer.dep.lotMultiplier'), numText(jDn(x.risk['lotMultiplier']) ?? 1), mono: true),
              KKV(
                t('developer.builder.maxLotsPerOrder'),
                jDn(x.risk['maxLots']) != null ? numText(jD(x.risk['maxLots'])) : (jDn(x.spec['maxLots']) != null ? numText(jD(x.spec['maxLots'])) : '–'),
                mono: true,
              ),
              KKV(t('developer.dep.maxOpenPositions'), '${jIn(x.risk['maxOpenPositions']) ?? (x.spec['oneAtATime'] == true ? 1 : 5)}', mono: true),
              KKV(
                t('developer.builder.maxDailyLoss'),
                jD(x.risk['maxDailyLoss']) > 0
                    ? fmtMoney(jD(x.risk['maxDailyLoss']))
                    : (jD(x.spec['maxDailyLoss']) > 0 ? fmtMoney(jD(x.spec['maxDailyLoss'])) : t('developer.off')),
                mono: true,
              ),
              KKV(t('developer.dep.started'), fmtDateTime(x.createdAt), mono: true),
              KKV(t('developer.dep.startingBalance'), x.startBalance != null && x.startBalance != 0 ? fmtMoney(x.startBalance) : '–', mono: true),
            ]),
          ],
        ],
      ),
    );
  }
}

String _hms(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  return d.toUtc().toIso8601String().substring(11, 19);
}

class _PositionRow extends StatelessWidget {
  const _PositionRow({required this.p});
  final DepPosition p;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final reason = p.reason == 'client'
        ? t('developer.exit.closed')
        : p.reason == 'sl'
        ? t('developer.exit.sl')
        : p.reason == 'tp'
        ? t('developer.exit.tp')
        : t.dyn('developer.exit.${p.reason}', fallback: (p.reason ?? '').replaceAll('_', ' '));
    final buy = p.side == 'buy';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    KChip(
                      label: (buy ? t('common.buy') : (p.side == 'sell' ? t('common.sell') : p.side)).toUpperCase(),
                      tone: buy ? KChipTone.up : KChipTone.down,
                      small: true,
                    ),
                    const SizedBox(width: 8),
                    Text('#${p.ticket}', style: context.text.mono(12, color: k.fg2)),
                    const SizedBox(width: 8),
                    Text('${numText(p.volume)} ${t('developer.unit.lot')}', style: context.text.mono(12, color: k.fg)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${p.openPrice ?? '–'} → ${p.closedAt != null ? (p.closePrice ?? '–') : '…'}${p.closedAt != null && reason.isNotEmpty ? ' · $reason' : ''}',
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(11, color: k.fg3),
                ),
              ],
            ),
          ),
          if (p.closedAt == null)
            KChip(label: t('developer.dep.openChip'), tone: KChipTone.ember, small: true)
          else
            Text(
              p.profit == null ? '–' : fmtSigned(p.profit),
              textDirection: TextDirection.ltr,
              style: context.text.mono(13, color: (p.profit ?? 0) >= 0 ? k.up : k.down, weight: FontWeight.w600),
            ),
        ],
      ),
    );
  }
}

/// The signals of a strategy (web Summary / Setup signals): BUY / SELL / EXIT … with their expressions.
class SignalSummary extends StatelessWidget {
  const SignalSummary({super.key, required this.summary, this.empty});
  final Map<String, String> summary;
  final String? empty;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    if (summary.isEmpty) return Text(empty ?? t('developer.strat.noSignal'), style: context.text.footnote.copyWith(color: k.fg3));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final e in summary.entries)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 72,
                  child: Text(
                    signalLabel(t, e.key).toUpperCase(),
                    style: context.text.micro.copyWith(color: e.key == 'buy' ? k.up : (e.key == 'sell' ? k.down : k.gold), letterSpacing: 0.4, height: 1.6),
                  ),
                ),
                Expanded(
                  child: Text(
                    e.value,
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(12, color: k.fg2).copyWith(height: 1.45),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
