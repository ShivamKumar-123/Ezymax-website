// The sheets of My copies (/social/copy): settings (PATCH subscriptions/{id}), the stop wizard (POST …/stop and the
// optional archive of the copy account with step-up), add / withdraw funds (POST …/funds), the detail drawer
// (GET subscriptions/{id}, …/execution) and the shared fee / announcement lists. Port of
// apps/crm/components/social-live/subscriptions.tsx, sub-funds.tsx and execution.tsx.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../data/client_data.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../social_api.dart';
import 'bits.dart';
import 'follow_sheet.dart';

const Map<String, KChipTone> feeStatusTone = {
  'pending': KChipTone.warn,
  'approved': KChipTone.info,
  'paid': KChipTone.up,
  'rejected': KChipTone.neutral,
  'failed': KChipTone.down,
};

String stopReasonText(T t, String? r) => r == null ? '' : t.dyn('social.subs.stopReason.$r', fallback: r.replaceAll('_', ' '));

/// A sheet footer: Cancel (ghost) and the sheet's one primary action.
class SheetFooter extends StatelessWidget {
  const SheetFooter({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.icon,
    this.variant = KButtonVariant.ember,
    this.cancelLabel,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;
  final KButtonVariant variant;
  final String? cancelLabel;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      KButton(
        label: cancelLabel ?? context.t('common.cancel'),
        variant: KButtonVariant.ghost,
        size: KButtonSize.lg,
        onPressed: busy ? null : () => Navigator.of(context).pop(),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: KButton(label: label, icon: icon, variant: variant, size: KButtonSize.lg, expand: true, loading: busy, onPressed: onPressed),
      ),
    ],
  );
}

/* ------------------------------------------------------------------ fees, announcements, execution */

/// The fee rows (web FeesTable): period, fee, status (HWM hidden on phones).
class FeesRows extends StatelessWidget {
  const FeesRows({super.key, required this.fees, this.empty});
  final List<FeeView> fees;
  final String? empty;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    if (fees.isEmpty) return EmptyRow(empty ?? t('social.fees.empty'));
    return RowsBox(
      children: [
        for (final f in fees)
          DataLine(
            title: Text('${fmtDate(t, f.periodStart)} – ${fmtDate(t, f.periodEnd)}'),
            trailing: Num(usd(f.amount)),
            trailingSub: KChip(
              label: t.dyn('social.feeStatus.${f.status}', fallback: f.status),
              tone: feeStatusTone[f.status] ?? KChipTone.neutral,
              small: true,
            ),
          ),
      ],
    );
  }
}

/// A master's announcements, newest first.
class AnnouncementList extends StatelessWidget {
  const AnnouncementList({super.key, required this.items, required this.empty, this.showRecipients = false});
  final List<Map<String, dynamic>> items;
  final String empty;
  final bool showRecipients;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    if (items.isEmpty) return EmptyRow(empty);
    return Column(
      children: [
        for (final a in items)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(LucideIcons.megaphone, size: 14, color: k.ember),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        strOf(a['title']),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (a['createdAt'] != null)
                      Text(
                        serverTime(t, strOrNull(a['createdAt']), withYear: false),
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                  ],
                ),
                if (showRecipients) ...[
                  const SizedBox(height: 6),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: KChip(label: t('social.ann.recipients', {'count': intOf(a['recipients'])}), small: true),
                  ),
                ],
                if (strOf(a['body']).isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(strOf(a['body']), style: context.text.footnote.copyWith(color: k.fg2, height: 1.5)),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

/// Slippage in pips, coloured: positive = worse for the follower (down), negative = better (up).
Widget slippage(BuildContext context, num? pips) {
  final k = context.k;
  if (pips == null || !pips.isFinite) return Num('—', color: k.fg3);
  return Num('${pips > 0 ? '+' : ''}${pips1(pips)}', color: pips > 0.05 ? k.down : (pips < -0.05 ? k.up : k.fg2));
}

class ExecutionSummaryTiles extends StatelessWidget {
  const ExecutionSummaryTiles({super.key, required this.s});
  final Map<String, dynamic>? s;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final s = this.s ?? const <String, dynamic>{};
    return TileGrid(
      tiles: [
        Tile(label: t('social.exec.trades'), value: Num('${intOf(s['trades'])}')),
        Tile(label: t('social.exec.avgSlippage'), value: slippage(context, numOrNull(s['avgSlippagePips']))),
        Tile(label: t('social.exec.avgDelay'), value: Num(delayText(numOrNull(s['avgDelayMs'])))),
        Tile(
          label: t('social.exec.worst'),
          value: Row(
            children: [
              slippage(context, numOrNull(s['worstSlippagePips'])),
              Flexible(
                child: Text(
                  ' · ${delayText(numOrNull(s['maxDelayMs']))}',
                  maxLines: 1,
                  style: context.text.caption.copyWith(color: context.k.fg3, fontWeight: FontWeight.w400),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The Execution tab of the subscription drawer: summary tiles and every copied trade (GET …/execution, 15 s).
class ExecutionPanel extends ConsumerWidget {
  const ExecutionPanel({super.key, required this.id, this.fallback});
  final int id;
  final Map<String, dynamic>? fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final q = ref.watch(executionProvider(id));
    final data = q.value;
    final items = listOf(data?['items']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExecutionSummaryTiles(s: data == null ? fallback : mapOf(data['summary'])),
        Hint(t('social.exec.hint'), top: 8),
        const SizedBox(height: 10),
        if (data == null)
          q.hasError ? InfoBox(tone: KChipTone.down, text: socialError(q.error, t)) : const BlockSkeleton(n: 2, h: 60)
        else if (items.isEmpty)
          EmptyRow(t('social.exec.empty'))
        else
          RowsBox(
            pageSize: 15,
            children: [
              for (final r in items)
                DataLine(
                  title: Text(t.dyn('social.logAction.${strOf(r['action'])}', fallback: strOf(r['action']).replaceAll('_', ' '))),
                  subtitle: Text('${serverTime(t, strOrNull(r['at']), withYear: false)} · ${fmtPrice(numOrNull(r['followerPrice']))}'),
                  trailing: slippage(context, numOrNull(r['slippagePips'])),
                  trailingSub: Num(delayText(numOrNull(r['delayMs']))),
                ),
            ],
          ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ settings */

Future<void> showSubSettingsSheet(BuildContext context, SubscriptionView sub, {required VoidCallback onSaved}) => showKSheet<void>(
  context,
  expand: true,
  builder: (_) => _SettingsSheet(sub: sub, onSaved: onSaved),
);

class _SettingsSheet extends ConsumerStatefulWidget {
  const _SettingsSheet({required this.sub, required this.onSaved});
  final SubscriptionView sub;
  final VoidCallback onSaved;

  @override
  ConsumerState<_SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends ConsumerState<_SettingsSheet> {
  late String _mode = widget.sub.sizing.mode;
  late final _value = TextEditingController(text: inputText(widget.sub.sizing.value));
  late final _maxLot = TextEditingController(text: inputText(widget.sub.maxLot));
  late final _equityStop = TextEditingController(text: inputText(widget.sub.equityStop));
  late final _autoSl = TextEditingController(text: inputText(widget.sub.autoSlPips));
  late bool _ddOn = widget.sub.maxDdPct != null;
  late double _dd = widget.sub.maxDdPct ?? 30;
  late final List<String> _ex = [...widget.sub.excludedSymbols];
  String _add = '';
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_value, _maxLot, _equityStop, _autoSl]) {
      c.dispose();
    }
    super.dispose();
  }

  double? get _val => _mode == 'equity' ? 1 : parseAmount(_value.text);

  String? _err(T t) {
    final autoSl = _autoSl.text.trim().isEmpty ? null : parseAmount(_autoSl.text);
    final autoSlErr = _autoSl.text.trim().isNotEmpty && (autoSl == null || autoSl < 1 || autoSl > 5000) ? t('social.autoSl.err') : null;
    if (_mode != 'equity' && !((_val ?? 0) > 0)) return t('social.subs.err.sizing');
    if (_maxLot.text.trim().isNotEmpty && !((parseAmount(_maxLot.text) ?? 0) >= 0.01)) return t('social.subs.err.maxLot');
    if (_equityStop.text.trim().isNotEmpty && !((parseAmount(_equityStop.text) ?? -1) >= 0)) return t('social.subs.err.equityStop');
    return autoSlErr;
  }

  Future<void> _save() async {
    final t = context.t;
    final err = _err(t);
    if (err != null) return plainError(ref, err);
    setState(() => _busy = true);
    try {
      await socialPatch(ref, 'subscriptions/${widget.sub.id}', {
        'sizing': {'mode': _mode, 'value': _val},
        'maxLot': parseAmount(_maxLot.text),
        'equityStop': parseAmount(_equityStop.text),
        'maxDdPct': _ddOn ? _dd.round() : null,
        'excludedSymbols': _ex,
        'autoSlPips': parseAmount(_autoSl.text),
      });
      okToast(ref, t('social.subs.toast.saved'), t('social.subs.toast.savedDesc'));
      widget.onSaved();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.subs.toast.saveFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final sub = widget.sub;
    final err = _err(t);
    final all = ref.watch(socialSymbolsProvider).value ?? const <String>[];
    final add = _add.trim().toLowerCase();
    final matches = add.isEmpty ? const <String>[] : all.where((s) => s.toLowerCase().contains(add) && !_ex.contains(s)).take(12).toList();
    final autoSlErr = _autoSl.text.trim().isNotEmpty && err == t('social.autoSl.err') ? err : null;
    return KSheetContent(
      footer: SheetFooter(label: t('common.saveChanges'), busy: _busy, onPressed: err != null ? null : _save),
      children: [
        SheetTitle(title: t('social.subs.settings.title'), description: t('social.subs.nameAccount', {'name': sub.masterName, 'login': sub.login})),
        GroupLabel(t('social.follow.step.sizing')),
        for (final k in const ['equity', 'fixed_lot', 'multiplier', 'allocation']) ...[
          RadioCard(
            selected: _mode == k,
            title: sizingLabel(t, k),
            onSelect: () => setState(() {
              _mode = k;
              _value.text = k != sub.sizing.mode
                  ? inputText(switch (k) {
                      'fixed_lot' => 0.1,
                      'multiplier' => 1.0,
                      'allocation' => sub.allocation,
                      _ => 1.0,
                    })
                  : inputText(sub.sizing.value);
            }),
          ),
          const SizedBox(height: 8),
        ],
        if (_mode != 'equity') ...[
          NumberField(
            controller: _value,
            label: _mode == 'fixed_lot'
                ? t('social.follow.lotPerTrade')
                : (_mode == 'multiplier' ? t('social.sizing.multiplier') : t('social.follow.allocForSizing')),
            unit: _mode == 'fixed_lot' ? t('social.lotsUnit') : (_mode == 'multiplier' ? '×' : 'USD'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 8),
        SwitchBox(
          title: t('social.follow.ddStop'),
          hint: t('social.subs.settings.fromPeak', {'amount': usd(sub.peakEquity)}),
          on: _ddOn,
          onChanged: (v) => setState(() => _ddOn = v),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TriggerLine(value: '-${_dd.round()}%'),
              SocialSlider(
                value: _dd,
                min: 5,
                max: 90,
                ticks: const [5, 20, 30, 50, 90],
                format: (v) => '${v.round()}%',
                enabled: _ddOn,
                onChanged: (v) => setState(() => _dd = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        NumberField(
          controller: _equityStop,
          label: t('social.equityStop'),
          hint: t('social.subs.settings.emptyOff'),
          placeholder: t('social.follow.noEquityStop'),
          dollar: true,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        NumberField(
          controller: _maxLot,
          label: t('social.follow.maxLotPerTrade'),
          hint: t('social.subs.settings.emptyNoCap'),
          placeholder: t('social.noCap'),
          unit: t('social.lotsUnit'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        NumberField(
          controller: _autoSl,
          label: t('social.autoSl.label'),
          hint: t('social.subs.settings.emptyOff'),
          placeholder: t('social.autoSl.off'),
          leading: LucideIcons.target,
          unit: t('social.autoSl.pips'),
          integer: true,
          error: autoSlErr,
          onChanged: (_) => setState(() {}),
        ),
        Hint(t('social.autoSl.hint'), top: 6),
        const SizedBox(height: 16),
        GroupLabel(
          t('social.follow.excludedSymbols'),
          trailing: Text(
            _ex.isNotEmpty ? t('social.follow.excludedCount', {'count': _ex.length}) : t('social.follow.copyEverything'),
            style: context.text.footnote.copyWith(color: context.k.fg3),
          ),
        ),
        if (_ex.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final s in _ex) ToggleChip(label: s, on: true, down: true, removable: true, onTap: () => setState(() => _ex.remove(s)))],
          ),
          const SizedBox(height: 8),
        ],
        KSearchField(key: ValueKey('ex-${_ex.length}'), placeholder: t('social.subs.settings.searchExclude'), onChanged: (v) => setState(() => _add = v)),
        if (matches.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in matches)
                ToggleChip(
                  label: s,
                  on: false,
                  down: true,
                  onTap: () => setState(() {
                    _ex.add(s);
                    _add = '';
                  }),
                ),
            ],
          ),
        ],
        Hint(t('social.subs.settings.note'), top: 14),
      ],
    );
  }
}

/* ------------------------------------------------------------------ stop */

Future<void> showStopSheet(BuildContext context, SubscriptionView sub, {required VoidCallback onStopped}) => showKSheet<void>(
  context,
  builder: (_) => _StopSheet(sub: sub, onStopped: onStopped),
);

class _StopSheet extends ConsumerStatefulWidget {
  const _StopSheet({required this.sub, required this.onStopped});
  final SubscriptionView sub;
  final VoidCallback onStopped;

  @override
  ConsumerState<_StopSheet> createState() => _StopSheetState();
}

class _StopSheetState extends ConsumerState<_StopSheet> {
  // close every copied position and order at market (default), or keep them open as the client's own trades
  bool _close = true;
  bool _returnFunds = true;
  // last choice (only when everything closes and the balance goes back to the wallet): archive the copy account
  bool _delAcc = false;
  bool _busy = false;
  Map<String, dynamic>? _res;
  bool _kept = false;

  /// running | done | failed | stepup
  String? _archive;

  SubscriptionView get sub => widget.sub;

  Future<void> _archiveAccount(String? token) async {
    await ref
        .read(apiProvider)
        .post<Map<String, dynamic>>('trading/accounts/${sub.login}/archive', body: {'empty': true, 'ackForfeit': true}, stepupToken: token);
  }

  Future<void> _runArchive() async {
    final t = context.t;
    setState(() => _archive = 'running');
    try {
      final r = await withStepUp<bool>(
        context,
        action: 'account_archive',
        target: '${sub.login}',
        title: t('social.subs.stop.archiveTitle', {'login': sub.login}),
        what: t('social.subs.stop.archiveWhat', {'login': sub.login}),
        confirmLabel: t('social.subs.stop.archiveConfirm'),
        run: (token) async {
          await _archiveAccount(token);
          return true;
        },
      );
      // closing the code sheet without confirming keeps the account
      if (mounted) setState(() => _archive = r == true ? 'done' : 'failed');
      if (r == true) ref.invalidate(accountsProvider);
    } catch (_) {
      if (mounted) setState(() => _archive = 'failed');
    }
  }

  Future<void> _stop() async {
    final t = context.t;
    final open = sub.positions + sub.orders > 0;
    final keep = open && !_close;
    final canDelete = !keep && _returnFunds;
    setState(() => _busy = true);
    try {
      final r = await socialPost(ref, 'subscriptions/${sub.id}/stop', {if (_returnFunds) 'returnFunds': true, if (keep) 'closePositions': false});
      setState(() {
        _res = r;
        _kept = keep;
      });
      final returned = numOrNull(r['returned']);
      final back = returned != null && returned != 0 ? t('social.subs.stop.backToWallet', {'amount': usd(returned)}) : '';
      final closed = r['closed'] is List ? (r['closed'] as List).length : 0;
      okToast(
        ref,
        t('social.subs.stop.stopped'),
        keep ? (back.isEmpty ? null : back) : '${t('social.subs.stop.closedCount', {'count': closed})}${back.isNotEmpty ? ' · $back' : ''}',
      );
      widget.onStopped();
      ref.invalidate(walletOverviewProvider);
      if (canDelete && _delAcc && mounted) await _runArchive();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.subs.stop.failed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    if (_res != null) return _done(context);
    final open = sub.positions + sub.orders > 0;
    final keep = open && !_close;
    final canDelete = !keep && _returnFunds;
    return KSheetContent(
      footer: SheetFooter(
        label: keep ? t('social.subs.stop.confirmKeep') : t('social.subs.stop.confirm'),
        cancelLabel: t('social.subs.stop.keep'),
        icon: LucideIcons.square,
        variant: KButtonVariant.sell,
        busy: _busy,
        onPressed: _stop,
      ),
      children: [
        SheetTitle(title: t('social.subs.stop.title'), description: t('social.subs.nameAccount', {'name': sub.masterName, 'login': sub.login})),
        if (open) ...[
          RadioCard(selected: _close, icon: LucideIcons.x, title: t('social.subs.stop.closeAll'), onSelect: () => setState(() => _close = true)),
          const SizedBox(height: 8),
          RadioCard(selected: !_close, icon: LucideIcons.layers, title: t('social.subs.stop.keepOpen'), onSelect: () => setState(() => _close = false)),
          const SizedBox(height: 12),
        ],
        InfoBox(
          tone: keep ? KChipTone.neutral : KChipTone.down,
          icon: keep ? LucideIcons.layers : LucideIcons.triangleAlert,
          child: !open
              ? Text('${t('social.subs.stop.noPositions')} ${t('social.subs.stop.undone', {'name': sub.masterName})}')
              : keep
              ? Text('${t('social.subs.stop.keepText', {'login': sub.login})} ${t('social.subs.stop.undone', {'name': sub.masterName})}')
              : KRichText(
                  '${t('social.subs.stop.allPositions', {'count': sub.positions})}'
                  '${sub.orders > 0 ? ' ${t('social.subs.stop.andOrders', {'count': sub.orders})}' : ''} ${t('social.subs.stop.atMarket')} '
                  '${t('social.subs.stop.undone', {'name': sub.masterName})}',
                  tags: const {'b': KTag()},
                ),
        ),
        const SizedBox(height: 12),
        TileGrid(
          tiles: [
            Tile(label: t('social.subs.equityNow'), value: Num(usd(sub.equity))),
            Tile(label: t('social.feesPending'), value: Num(usd(sub.feesPending))),
          ],
        ),
        const SizedBox(height: 10),
        KCheckRow(value: _returnFunds, onChanged: (v) => setState(() => _returnFunds = v), child: Text(t('social.subs.stop.moveBack'))),
        if (keep && _returnFunds) Padding(padding: const EdgeInsetsDirectional.only(start: 32), child: Hint(t('social.subs.stop.keepFunds'))),
        if (canDelete) ...[
          const SizedBox(height: 12),
          Text(
            t('social.subs.stop.accountQ'),
            style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          RadioCard(
            selected: _delAcc,
            icon: LucideIcons.archive,
            title: t('social.subs.stop.deleteAcc'),
            text: t('social.subs.stop.deleteAccS'),
            onSelect: () => setState(() => _delAcc = true),
          ),
          const SizedBox(height: 8),
          RadioCard(
            selected: !_delAcc,
            icon: LucideIcons.wallet,
            title: t('social.subs.stop.keepAcc'),
            text: t('social.subs.stop.keepAccS'),
            onSelect: () => setState(() => _delAcc = false),
          ),
        ],
      ],
    );
  }

  Widget _done(BuildContext context) {
    final t = context.t;
    final r = _res!;
    final closed = (r['closed'] is List) ? (r['closed'] as List).length : 0;
    final failed = listOf(r['failed']);
    final returned = numOrNull(r['returned']);
    return KSheetContent(
      footer: KButton(label: t('common.done'), size: KButtonSize.lg, expand: true, onPressed: () => Navigator.of(context).pop()),
      children: [
        SheetTitle(title: t('social.subs.stop.stopped'), description: t('social.subs.nameAccount', {'name': sub.masterName, 'login': sub.login})),
        TileGrid(
          tiles: [
            Tile(label: t('social.subs.stop.positionsClosed'), value: Num('$closed')),
            Tile(label: t('social.subs.stop.returned'), value: Num(returned != null ? usd(returned) : '—')),
          ],
        ),
        if (_kept) ...[
          const SizedBox(height: 10),
          InfoBox(icon: LucideIcons.layers, text: t('social.subs.stop.kept', {'login': sub.login})),
        ],
        if (failed.isNotEmpty) ...[
          const SizedBox(height: 10),
          InfoBox(
            tone: KChipTone.down,
            icon: LucideIcons.triangleAlert,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t('social.subs.stop.failedCount', {'count': failed.length})),
                for (final f in failed) Text('• #${strOf(f['ticket'])}: ${strOf(f['error'])}'),
                Text(t('social.subs.stop.contactSupport')),
              ],
            ),
          ),
        ],
        if (_returnFunds && returned == null) ...[
          const SizedBox(height: 10),
          InfoBox(tone: KChipTone.warn, text: t('social.subs.stop.notMoved', {'login': sub.login})),
        ],
        if (!_returnFunds) ...[
          const SizedBox(height: 10),
          InfoBox(text: t('social.subs.stop.stays', {'login': sub.login})),
        ],
        if (_archive == 'running' || _archive == 'stepup') ...[
          const SizedBox(height: 10),
          InfoBox(icon: LucideIcons.loader, text: t('social.subs.stop.archiving')),
        ],
        if (_archive == 'done') ...[
          const SizedBox(height: 10),
          InfoBox(tone: KChipTone.up, icon: LucideIcons.archive, text: t('social.subs.stop.archived', {'login': sub.login})),
        ],
        if (_archive == 'failed') ...[
          const SizedBox(height: 10),
          InfoBox(
            tone: KChipTone.warn,
            icon: LucideIcons.triangleAlert,
            child: KRichText(
              '${t('social.subs.stop.archiveFailed', {'login': sub.login})} <link>${t('common.accounts')}</link>',
              tags: {
                'link': KTag.link(() {
                  final router = GoRouter.of(context);
                  Navigator.of(context).pop();
                  router.go('/accounts');
                }),
              },
            ),
          ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ add / withdraw funds */

Future<void> showSubFundsSheet(BuildContext context, SubscriptionView sub, {required String direction, required VoidCallback onDone}) => showKSheet<void>(
  context,
  builder: (_) => _FundsSheet(sub: sub, direction: direction, onDone: onDone),
);

class _FundsSheet extends ConsumerStatefulWidget {
  const _FundsSheet({required this.sub, required this.direction, required this.onDone});
  final SubscriptionView sub;
  final String direction;
  final VoidCallback onDone;

  @override
  ConsumerState<_FundsSheet> createState() => _FundsSheetState();
}

class _FundsSheetState extends ConsumerState<_FundsSheet> {
  late String _dir = widget.sub.status == 'stopped' ? 'withdraw' : widget.direction;
  final _amount = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit(bool ready, String? err) async {
    final t = context.t;
    final sub = widget.sub;
    final add = _dir == 'add';
    if (!ready) return plainError(ref, err ?? t('social.subs.funds.err.amount'));
    final v = parseAmount(_amount.text)!;
    setState(() => _busy = true);
    try {
      final r = await socialPost(ref, 'subscriptions/${sub.id}/funds', {'direction': _dir, 'amount': (v * 100).round() / 100});
      final moved = usd(numOrNull(r['amount']) ?? v);
      final balance = numOrNull(r['balance']);
      final bal = balance != null ? t('social.subs.funds.toast.balance', {'amount': usd(balance)}) : '';
      final desc = add
          ? t('social.subs.funds.toast.addedDesc', {'amount': moved, 'login': sub.login})
          : t('social.subs.funds.toast.withdrawnDesc', {'amount': moved, 'login': sub.login});
      okToast(ref, add ? t('social.subs.funds.toast.added') : t('social.subs.funds.toast.withdrawn'), '$desc${bal.isNotEmpty ? ' $bal' : ''}');
      ref.invalidate(walletOverviewProvider);
      widget.onDone();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, add ? t('social.subs.funds.toast.addFailed') : t('social.subs.funds.toast.withdrawFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final sub = widget.sub;
    final stopped = sub.status == 'stopped';
    final add = _dir == 'add';
    final walletAvail = add ? walletAvailable(ref) : null;
    final canWithdraw = sub.withdrawableNow;
    final raw = _amount.text.trim();
    final v = parseAmount(raw);
    String? err;
    if (raw.isNotEmpty) {
      if (!validAmount(v)) {
        err = t('social.subs.funds.err.amount');
      } else if (add && walletAvail != null && v! > walletAvail) {
        err = t('social.follow.err.overBalance', {'balance': fmtUsdt(walletAvail)});
      } else if (!add && v! > canWithdraw + 1e-9) {
        err = t('social.subs.funds.err.overWithdrawable', {'amount': usd(canWithdraw)});
      }
    }
    final ready = raw.isNotEmpty && err == null && validAmount(v);
    final walletEnd = _End(
      icon: LucideIcons.wallet,
      title: t('social.subs.funds.wallet'),
      sub: walletAvail != null && add ? t('social.follow.walletAvailable', {'balance': fmtUsdt(walletAvail)}) : 'USDT',
    );
    final accountEnd = _End(
      icon: LucideIcons.repeat,
      title: t('social.subs.funds.copyAccount', {'login': sub.login}),
      sub: t('social.subs.funds.balanceLine', {'amount': usd(sub.balanceOrNull ?? sub.equity)}),
    );
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return KSheetContent(
      footer: SheetFooter(
        label: add ? t('social.subs.funds.add') : t('social.subs.funds.withdraw'),
        icon: add ? LucideIcons.arrowDownToLine : LucideIcons.arrowUpFromLine,
        variant: KButtonVariant.ink,
        busy: _busy,
        onPressed: ready ? () => _submit(ready, err) : null,
      ),
      children: [
        SheetTitle(
          title: add ? t('social.subs.funds.addTitle') : t('social.subs.funds.withdrawTitle'),
          description: t('social.subs.nameAccount', {'name': sub.masterName, 'login': sub.login}),
        ),
        if (!stopped) ...[
          KSegmented<String>(
            plain: true,
            values: const ['add', 'withdraw'],
            labels: [t('social.subs.funds.add'), t('social.subs.funds.withdraw')],
            selected: _dir,
            onChanged: (d) => setState(() {
              _dir = d;
              _amount.clear();
            }),
          ),
          const SizedBox(height: 14),
        ],
        Row(
          children: [
            Expanded(child: add ? walletEnd : accountEnd),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Icon(rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight, size: 16, color: k.ember),
            ),
            Expanded(child: add ? accountEnd : walletEnd),
          ],
        ),
        const SizedBox(height: 14),
        NumberField(
          controller: _amount,
          label: t('social.subs.funds.amount'),
          dollar: true,
          unit: 'USD',
          error: err,
          autofocus: true,
          onChanged: (_) => setState(() {}),
        ),
        if (!add)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                Flexible(child: Hint(t('social.subs.funds.available', {'amount': usd(canWithdraw)}))),
                const SizedBox(width: 8),
                KTextButton(
                  label: t('social.subs.funds.max'),
                  onPressed: canWithdraw <= 0 ? null : () => setState(() => _amount.text = inputText((canWithdraw * 100).floorToDouble() / 100)),
                ),
              ],
            ),
          ),
        if (add && walletAvail != null && walletAvail > 0) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final x in const [100.0, 500.0, 1000.0, 2500.0].where((x) => x <= walletAvail))
                ToggleChip(label: usd(x, 0), on: v == x, onTap: () => setState(() => _amount.text = inputText(x))),
            ],
          ),
        ],
        const SizedBox(height: 14),
        if (add)
          InfoBox(
            tone: KChipTone.gold,
            text: '${t('social.subs.funds.addNote')}${sub.sizing.mode == 'equity' ? ' ${t('social.subs.funds.addEquityNote')}' : ''}',
          )
        else ...[
          if (canWithdraw <= 0) ...[InfoBox(tone: KChipTone.warn, text: t('social.subs.funds.nothing')), const SizedBox(height: 8)],
          InfoBox(
            text:
                '${t('social.subs.funds.withdrawNote')}'
                '${sub.positions + sub.orders > 0 ? ' ${t('social.subs.funds.openNote')}' : ''}'
                '${sub.equityStop != null && !stopped ? ' ${t('social.subs.funds.equityStopNote', {'amount': usd(sub.equityStop, 0)})}' : ''}',
          ),
        ],
        Hint(t('social.subs.funds.hwmNote'), top: 10),
      ],
    );
  }
}

class _End extends StatelessWidget {
  const _End({required this.icon, required this.title, required this.sub});
  final IconData icon;
  final String title;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(shape: BoxShape.circle, color: k.surface3),
            child: Icon(icon, size: 15, color: k.fg2),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                ),
                Text(
                  sub,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ detail drawer */

Future<void> showSubDetailSheet(BuildContext context, int id, {String tab = 'positions'}) => showKSheet<void>(
  context,
  expand: true,
  builder: (_) => _DetailSheet(id: id, initialTab: tab),
);

class _DetailSheet extends ConsumerStatefulWidget {
  const _DetailSheet({required this.id, required this.initialTab});
  final int id;
  final String initialTab;

  @override
  ConsumerState<_DetailSheet> createState() => _DetailSheetState();
}

class _DetailSheetState extends ConsumerState<_DetailSheet> {
  late String _tab = widget.initialTab;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final q = ref.watch(subscriptionDetailProvider(widget.id));
    final d = q.value;
    final s = d?.subscription;
    return KSheetContent(
      children: [
        SheetTitle(title: s != null ? '${s.masterName} · #${s.login}' : t('social.subs.detail.title'), description: t('social.subs.detail.description')),
        if (d == null || s == null)
          q.hasError ? InfoBox(tone: KChipTone.down, text: socialError(q.error, t)) : const BlockSkeleton(h: 90)
        else ...[
          TileGrid(
            tiles: [
              Tile(label: t('common.equity'), value: Num(usd(s.equity))),
              Tile(
                label: t('social.profit'),
                value: Num(usd(s.profit, 2, true), color: s.profit >= 0 ? k.up : k.down),
              ),
              Tile(label: t('social.return'), value: Num(pct(s.returnPct))),
              Tile(label: t('social.funds.explain.hwmT'), value: Num(usd(s.hwm))),
              Tile(label: t('social.feesPending'), value: Num(usd(s.feesPending))),
              Tile(label: t('social.subs.detail.nextFee'), value: Text(s.nextFeeAt != null ? serverTime(t, s.nextFeeAt, withYear: false) : '—')),
            ],
          ),
          const SizedBox(height: 12),
          KChoiceChips<String>(
            values: const ['positions', 'orders', 'log', 'execution', 'fees', 'news'],
            labels: [
              t('social.subs.detail.tabPositions', {'n': d.positions.length}),
              t('social.subs.detail.tabOrders', {'n': d.orders.length}),
              t('social.subs.detail.tabLog'),
              t('social.subs.detail.tabExecution'),
              t('social.subs.detail.tabFees', {'n': d.fees.length}),
              t('social.subs.detail.tabNews', {'n': d.announcements.length}),
            ],
            selected: _tab,
            onChanged: (v) => setState(() => _tab = v),
          ),
          const SizedBox(height: 10),
          ...switch (_tab) {
            'positions' => [
              if (d.positions.isEmpty)
                EmptyRow(t('social.subs.detail.noPositions'))
              else
                RowsBox(
                  pageSize: 20,
                  children: [
                    for (final p in d.positions)
                      DataLine(
                        title: Row(
                          children: [
                            Text(strOf(p['symbol'])),
                            const SizedBox(width: 6),
                            KChip(
                              label: t.dyn('common.${strOf(p['side'])}', fallback: strOf(p['side'])).toUpperCase(),
                              tone: p['side'] == 'buy' ? KChipTone.up : KChipTone.down,
                              small: true,
                            ),
                          ],
                        ),
                        subtitle: Num('#${strOf(p['ticket'])} · ${numOf(p['volume']).toStringAsFixed(2)} ${t('social.lotsUnit')}'),
                        trailing: Num(usd(numOf(p['profit']), 2, true), color: toneColor(context, numOf(p['profit']))),
                      ),
                  ],
                ),
            ],
            'orders' => [
              if (d.orders.isEmpty)
                EmptyRow(t('social.subs.detail.noOrders'))
              else
                RowsBox(
                  pageSize: 20,
                  children: [
                    for (final o in d.orders)
                      DataLine(
                        title: Text(strOf(o['symbol'])),
                        subtitle: Text(
                          '#${strOf(o['ticket'])} · ${t.dyn('common.${strOf(o['side'])}', fallback: strOf(o['side']))} '
                          '${t.dyn('social.orderType.${strOf(o['type'])}', fallback: strOf(o['type']).replaceAll('_', ' '))}',
                        ),
                        trailing: Num(fmtPrice(numOrNull(o['price']))),
                        trailingSub: Num('${numOf(o['volume']).toStringAsFixed(2)} ${t('social.lotsUnit')}'),
                      ),
                  ],
                ),
            ],
            'log' => [
              Hint(t('social.subs.detail.logHint')),
              const SizedBox(height: 8),
              if (d.log.isEmpty)
                EmptyRow(t('social.subs.detail.noLog'))
              else
                RowsBox(
                  pageSize: 20,
                  children: [
                    for (final l in d.log)
                      DataLine(
                        title: Text(t.dyn('social.logAction.${strOf(l['action'])}', fallback: strOf(l['action']).replaceAll('_', ' '))),
                        subtitle: Text(
                          '${serverTime(t, strOrNull(l['at']), withYear: false)}${strOf(l['message']).isNotEmpty ? ' · ${strOf(l['message'])}' : ''}',
                        ),
                        trailing: KChip(
                          label: t.dyn('social.logStatus.${strOf(l['status'])}', fallback: strOf(l['status'])),
                          tone: l['status'] == 'ok' || l['status'] == 'done' ? KChipTone.up : (l['status'] == 'skipped' ? KChipTone.neutral : KChipTone.down),
                          small: true,
                        ),
                      ),
                  ],
                ),
            ],
            'execution' => [ExecutionPanel(id: s.id, fallback: d.execution)],
            'fees' => [FeesRows(fees: d.fees)],
            _ => [
              Hint(t('social.subs.detail.newsHint', {'name': s.masterName})),
              const SizedBox(height: 8),
              AnnouncementList(items: d.announcements, empty: t('social.subs.detail.noNews')),
            ],
          },
          const SizedBox(height: 12),
          InfoBox(text: t('social.subs.detail.note')),
        ],
      ],
    );
  }
}
