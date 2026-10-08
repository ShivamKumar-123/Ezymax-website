// An account's closed trades and balance ledger (port of apps/crm/components/trading/activity.tsx HistoryPanel /
// LedgerPanel): range picker, instrument filter, the list, totals, pager and CSV export. Used by Portfolio › Trade
// history / Ledger and the account detail's History / Ledger tabs. CONTRACT — keep these names and parameters.
// The web's desktop tables are phone lists here: one row per deal / ledger entry with the same columns as
// label / value text. The CSV export (web downloadExport) opens the share sheet.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/account.dart';
import '../../../core/models/trading.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../portfolio_data.dart';
import '../portfolio_logic.dart';
import 'portfolio_bits.dart';
import 'share_sheet.dart';

/// Closed trades of `account` (`GET trading/accounts/{login}/history`). `title` replaces the card title.
class HistoryPanel extends ConsumerStatefulWidget {
  const HistoryPanel({super.key, required this.account, this.title});
  final EngineAccount account;
  final String? title;

  @override
  ConsumerState<HistoryPanel> createState() => _HistoryPanelState();
}

class _HistoryPanelState extends ConsumerState<HistoryPanel> {
  static const int _limit = 25;
  ActivityRange _range = const ActivityRange(RangePreset.d30);
  String _inst = 'all';
  int _page = 1;
  bool _exporting = false;
  HistoryPage? _last;

  @override
  void didUpdateWidget(HistoryPanel old) {
    super.didUpdateWidget(old);
    if (old.account.login != widget.account.login) {
      _page = 1;
      _last = null;
    }
  }

  HistoryArgs _args() {
    final q = rangeQuery(_range);
    return (login: widget.account.login, from: q.from, to: q.to, page: _page, limit: _limit, instrument: _inst);
  }

  Future<void> _export() async {
    final t = context.t;
    final login = widget.account.login;
    setState(() => _exporting = true);
    await ref.read(downloaderProvider)(
      path: 'trading/accounts/$login/export',
      query: exportQuery('history', _range, instrument: _inst),
      fallbackName: '$login-history.csv',
      ok: t('accounts.toast.exportStarted'),
      fail: t('accounts.toast.exportFailed'),
      description: t('accounts.toast.exportDesc', {'login': login, 'kind': t('accounts.export.trades')}),
    );
    if (mounted) setState(() => _exporting = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final a = widget.account;
    final cur = a.currencyPrefix;
    final invalid = _range.invalid;
    final args = _args();
    final value = invalid ? null : ref.watch(historyPageProvider(args));
    if (value != null && value.hasValue) _last = value.value;
    final data = value?.value ?? _last;
    final failed = value != null && value.hasError && !value.hasValue;
    final loading = data == null && !failed;
    final net = data == null ? 0.0 : historyNet(data);
    final hasOptions = data?.deals.any((d) => d.isOption) ?? false;
    final q = rangeQuery(_range);
    final now = DateTime.now();

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.title ?? t('accountDetail.history.title'), style: context.text.title2),
          const SizedBox(height: 3),
          if (data != null)
            KRichText(
              t('accountDetail.history.summary', {
                'count': data.total,
                'net': fmtAmount(net, cur, signed: true),
                'profit': fmtAmount(data.profit, cur, signed: true),
                'swap': fmtAmount(data.swap, cur, signed: true),
                'commission': fmtAmount(-data.commission.abs(), cur, signed: true),
              }),
              tags: {
                'net': KTag(
                  style: TextStyle(color: net == 0 ? k.fg : signColor(k, net), fontWeight: FontWeight.w600, fontFeatures: kTabular),
                ),
              },
              style: context.text.footnote.copyWith(color: k.fg3),
            )
          else
            Text(t('accountDetail.history.subtitle'), style: context.text.footnote.copyWith(color: k.fg3)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (data != null && data.total > 0 && !invalid && tradeSharingOn(ref.watch(configProvider)))
                SharePeriodButton(
                  login: a.login,
                  from: q.from ?? isoDay(now.subtract(const Duration(days: 5 * 365))),
                  to: q.to ?? isoDay(now.add(const Duration(days: 1))),
                ),
              KButton(
                label: 'CSV',
                icon: LucideIcons.download,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                loading: _exporting,
                onPressed: invalid ? null : _export,
              ),
            ],
          ),
          const SizedBox(height: 14),
          InstrumentPicker(
            value: _inst,
            onChanged: (v) => setState(() {
              _inst = v;
              _page = 1;
            }),
          ),
          const SizedBox(height: 8),
          RangePicker(
            value: _range,
            onChanged: (r) => setState(() {
              _range = r;
              _page = 1;
            }),
          ),
          const SizedBox(height: 10),
          if (loading) const _ListSkeleton(),
          if (failed)
            KEmptyState(
              compact: true,
              art: KIllustrationName.connectionLost,
              title: t('accountDetail.history.loadError'),
              text: errorText(value.error, t),
              action: KButton(
                label: t('common.retry'),
                icon: LucideIcons.rotateCw,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: () => ref.invalidate(historyPageProvider(args)),
              ),
            ),
          if (data != null && data.deals.isEmpty)
            KEmptyState(
              compact: true,
              art: KIllustrationName.emptyHistory,
              title: _inst == 'option' ? t('accounts.opt.emptyOptions') : (_inst == 'cfd' ? t('accounts.opt.emptyCfd') : t('accountDetail.history.emptyTitle')),
              text: _inst == 'option' ? t('accounts.opt.emptyOptionsText') : t('accountDetail.history.emptyText'),
            ),
          if (data != null && data.deals.isNotEmpty) ...[
            AnimatedOpacity(
              duration: const Duration(milliseconds: 150),
              opacity: value != null && value.isLoading && !value.hasValue ? 0.6 : 1,
              child: DealsList(deals: data.deals, account: a),
            ),
            if (hasOptions) ...[const SizedBox(height: 8), Text(t('accounts.opt.premiumHint'), style: context.text.caption.copyWith(color: k.fg3))],
            if (data.truncated) ...[
              const SizedBox(height: 8),
              Text(t('accounts.opt.truncated', {'count': data.total}), style: context.text.caption.copyWith(color: k.warn)),
            ],
            Pager(page: data.page, limit: data.limit, total: data.total, onPage: (p) => setState(() => _page = p)),
          ],
        ],
      ),
    );
  }
}

/// Balance movements of `account` (`GET trading/accounts/{login}/ledger`). `title` replaces the card title.
class LedgerPanel extends ConsumerStatefulWidget {
  const LedgerPanel({super.key, required this.account, this.title});
  final EngineAccount account;
  final String? title;

  @override
  ConsumerState<LedgerPanel> createState() => _LedgerPanelState();
}

class _LedgerPanelState extends ConsumerState<LedgerPanel> {
  static const int _limit = 25;
  ActivityRange _range = const ActivityRange(RangePreset.all);
  int _page = 1;
  bool _exporting = false;
  LedgerPage? _last;

  @override
  void didUpdateWidget(LedgerPanel old) {
    super.didUpdateWidget(old);
    if (old.account.login != widget.account.login) {
      _page = 1;
      _last = null;
    }
  }

  Future<void> _export() async {
    final t = context.t;
    final login = widget.account.login;
    setState(() => _exporting = true);
    await ref.read(downloaderProvider)(
      path: 'trading/accounts/$login/export',
      query: exportQuery('ledger', _range),
      fallbackName: '$login-ledger.csv',
      ok: t('accounts.toast.exportStarted'),
      fail: t('accounts.toast.exportFailed'),
      description: t('accounts.toast.exportDesc', {'login': login, 'kind': t('accounts.export.ledger')}),
    );
    if (mounted) setState(() => _exporting = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final a = widget.account;
    final invalid = _range.invalid;
    final q = rangeQuery(_range);
    final LedgerArgs args = (login: a.login, from: q.from, to: q.to, page: _page, limit: _limit);
    final value = invalid ? null : ref.watch(ledgerPageProvider(args));
    if (value != null && value.hasValue) _last = value.value;
    final data = value?.value ?? _last;
    final failed = value != null && value.hasError && !value.hasValue;
    final loading = data == null && !failed;

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.title ?? t('accountDetail.ledger.title'), style: context.text.title2),
                    const SizedBox(height: 3),
                    KRichText(
                      t('accountDetail.ledger.subtitle', {'balance': fmtAmount(a.balance, a.currencyPrefix)}),
                      tags: {
                        'bal': KTag(
                          style: TextStyle(color: k.fg, fontWeight: FontWeight.w600, fontFeatures: kTabular),
                        ),
                      },
                      style: context.text.footnote.copyWith(color: k.fg3),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              KButton(
                label: 'CSV',
                icon: LucideIcons.download,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                loading: _exporting,
                onPressed: invalid ? null : _export,
              ),
            ],
          ),
          const SizedBox(height: 14),
          RangePicker(
            value: _range,
            onChanged: (r) => setState(() {
              _range = r;
              _page = 1;
            }),
          ),
          const SizedBox(height: 10),
          if (loading) const _ListSkeleton(),
          if (failed)
            KEmptyState(
              compact: true,
              art: KIllustrationName.connectionLost,
              title: t('accountDetail.ledger.loadError'),
              text: errorText(value.error, t),
              action: KButton(
                label: t('common.retry'),
                icon: LucideIcons.rotateCw,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: () => ref.invalidate(ledgerPageProvider(args)),
              ),
            ),
          if (data != null && data.items.isEmpty)
            KEmptyState(
              compact: true,
              art: KIllustrationName.emptyHistory,
              title: t('accountDetail.ledger.emptyTitle'),
              text: t('accountDetail.ledger.emptyText'),
            ),
          if (data != null && data.items.isNotEmpty) ...[
            AnimatedOpacity(
              duration: const Duration(milliseconds: 150),
              opacity: value != null && value.isLoading && !value.hasValue ? 0.6 : 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < data.items.length; i++) ...[if (i > 0) const KDivider(), LedgerRow(item: data.items[i])],
                ],
              ),
            ),
            Pager(page: data.page, limit: data.limit, total: data.total, onPage: (p) => setState(() => _page = p)),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ filters, pager */

/// 7D / 30D / 90D / All / Custom, with the two days of a custom range (web RangePicker).
class RangePicker extends StatelessWidget {
  const RangePicker({super.key, required this.value, required this.onChanged});
  final ActivityRange value;
  final ValueChanged<ActivityRange> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final today = isoDay(DateTime.now());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        KChoiceChips<RangePreset>(
          values: RangePreset.values,
          labels: [t('accountDetail.range.7d'), t('accountDetail.range.30d'), t('accountDetail.range.90d'), t('common.all'), t('accountDetail.range.custom')],
          selected: value.preset,
          onChanged: (p) => onChanged(selectPreset(p, value)),
        ),
        if (value.preset == RangePreset.custom) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: DateInput(
                  height: 36,
                  value: value.from ?? '',
                  semanticLabel: t('accountDetail.range.from'),
                  onTap: () async {
                    final d = await pickDay(context, title: t('accountDetail.range.from'), value: value.from ?? today, max: value.to ?? today);
                    if (d != null) onChanged(value.copyWith(from: d));
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Text('–', style: context.text.callout.copyWith(color: k.fg3)),
              ),
              Expanded(
                child: DateInput(
                  height: 36,
                  value: value.to ?? '',
                  semanticLabel: t('accountDetail.range.to'),
                  onTap: () async {
                    final d = await pickDay(context, title: t('accountDetail.range.to'), value: value.to ?? today, min: value.from);
                    if (d != null) onChanged(value.copyWith(to: d));
                  },
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// All / CFD / Options: which deals the history lists and exports (web InstrumentPicker).
class InstrumentPicker extends StatelessWidget {
  const InstrumentPicker({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KSegmented<String>(
      values: const ['all', 'cfd', 'option'],
      labels: [t('accounts.opt.filter.all'), t('accounts.opt.filter.cfd'), t('accounts.opt.filter.options')],
      selected: value,
      onChanged: onChanged,
    );
  }
}

/// "1–25 of 80" with previous / next (web Pager); hidden on a single page.
class Pager extends StatelessWidget {
  const Pager({super.key, required this.page, required this.limit, required this.total, required this.onPage});
  final int page, limit, total;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    if (total <= limit) return const SizedBox.shrink();
    final t = context.t;
    final k = context.k;
    final pages = pageCount(total, limit);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    Widget button(IconData icon, String label, int to, bool enabled) => Opacity(
      opacity: enabled ? 1 : 0.4,
      child: KIconButton(icon: icon, size: 34, filled: true, semanticLabel: label, onPressed: enabled ? () => onPage(to) : null),
    );
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              t('accountDetail.pager.range', {'from': (page - 1) * limit + 1, 'to': page * limit < total ? page * limit : total, 'total': total}),
              style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
            ),
          ),
          button(rtl ? LucideIcons.chevronRight : LucideIcons.chevronLeft, t('accountDetail.pager.prev'), page - 1, page > 1),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              '$page / $pages',
              textDirection: TextDirection.ltr,
              style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
            ),
          ),
          button(rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight, t('accountDetail.pager.next'), page + 1, page < pages),
        ],
      ),
    );
  }
}

class _ListSkeleton extends StatelessWidget {
  const _ListSkeleton();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < 5; i++) ...[if (i > 0) const SizedBox(height: 8), const KSkeleton(height: 44, radius: 12)],
    ],
  );
}

/* ------------------------------------------------------------------ rows */

/// Deals as phone rows (web DealsTable): symbol, side, option tag, position and deal tickets, direction and close
/// reason, volume, price (option premiums per contract), time, commission, swap, profit and the share button.
class DealsList extends StatelessWidget {
  const DealsList({super.key, required this.deals, required this.account});
  final List<EngineDeal> deals;
  final EngineAccount account;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (var i = 0; i < deals.length; i++) ...[if (i > 0) const KDivider(), DealRow(deal: deals[i], account: account)],
    ],
  );
}

class DealRow extends ConsumerWidget {
  const DealRow({super.key, required this.deal, required this.account});
  final EngineDeal deal;
  final EngineAccount account;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final sharing = tradeSharingOn(ref.watch(configProvider));
    final d = deal;
    final cur = account.currencyPrefix;
    final exit = d.entry != 'in';
    final isOpt = d.isOption;
    final opt = isOpt ? optionTerms(d.symbol, d.option) : null;
    final name = opt != null ? optionLabel(t, opt) : d.symbol;
    final prem = isOpt ? dealPremiumsUsd(d, usdFactorOf(account)) : null;
    // an option exit always says how it ended; a CFD exit only when the client didn't close it
    final reason = exit && (isOpt || d.reason != 'client') ? reasonLabel(t, d.reason) : null;
    final reasonColor = d.reason == 'stop_out' || d.reason == 'knock_out' ? k.down : (d.reason == 'expiry' ? k.gold : k.fg3);
    final small = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400);
    final figure = context.text.mono(12, color: k.fg2);

    Widget kv(String label, Widget value) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: small),
        const SizedBox(width: 4),
        value,
      ],
    );
    Text fig(String s, {Color? color}) => Text(
      s,
      textDirection: TextDirection.ltr,
      style: color == null ? figure : figure.copyWith(color: color),
    );

    final String price;
    String? openAt;
    if (prem != null) {
      price = prem.own != null
          ? '${fmtAmount(prem.own!, r'$')} ${t('accounts.opt.perContract')}'
          : '${fmtPrice(d.price)} ${opt?.quoteCurrency != null ? t('accounts.opt.perUnit', {'currency': opt!.quoteCurrency}) : t('accounts.opt.perUnitPlain')}';
      if (exit && (prem.open != null || d.openPrice != null)) {
        openAt = t('accounts.opt.openAt', {
          'amount': prem.open != null ? fmtAmount(prem.open!, r'$') : '${fmtPrice(d.openPrice)}${opt?.quoteCurrency != null ? ' ${opt!.quoteCurrency}' : ''}',
        });
      }
    } else {
      price = fmtPrice(d.price);
    }

    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: TradeSymbolAvatar(symbol: opt?.series ?? d.symbol, size: 26),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(name, style: context.text.headline.copyWith(fontSize: 14)),
                    SideChip(buy: d.side == 'buy', label: d.side == 'buy' ? t('accountDetail.side.buy') : t('accountDetail.side.sell')),
                    if (isOpt) const OptionTag(),
                    if (d.reversed) KChip(label: t('accountDetail.deal.reversed'), small: true),
                  ],
                ),
                const SizedBox(height: 3),
                Text('#${d.id} · ${t('accountDetail.deal.position', {'ticket': d.positionTicket})}', style: context.text.mono(11, color: k.fg3)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: exit ? t('accountDetail.deal.out') : t('accountDetail.deal.in')),
                          if (reason != null)
                            TextSpan(
                              text: ' · $reason',
                              style: TextStyle(color: reasonColor),
                            ),
                        ],
                      ),
                      style: context.text.caption.copyWith(color: k.fg2),
                    ),
                    kv(
                      t('accountDetail.col.volume'),
                      fig(isOpt ? t('accounts.opt.contracts', {'count': fmtContracts(d.volume)}) : d.volume.toStringAsFixed(2)),
                    ),
                    kv(t('accountDetail.col.price'), fig(price)),
                    if (openAt != null) Text(openAt, style: small),
                    kv(t('common.time'), fig(serverTimeLabel(d.time, t.locale))),
                    kv(t('accountDetail.col.comm'), fig(d.commission != 0 ? fmtAmount(-d.commission.abs(), '') : '—', color: k.fg3)),
                    kv(t('accountDetail.col.swap'), fig(d.swap != 0 ? fmtAmount(d.swap, '') : '—', color: k.fg3)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                exit ? fmtAmount(d.profit, cur, signed: true) : '—',
                textDirection: TextDirection.ltr,
                style: context.text.figure.copyWith(fontSize: 14, color: !exit ? k.fg3 : signColor(k, d.profit, zero: k.fg)),
              ),
              if (exit && !d.reversed && sharing) ...[
                const SizedBox(height: 4),
                ShareTradeButton(login: d.login == 0 ? account.login : d.login, dealId: d.id, symbol: name),
              ],
            ],
          ),
        ],
      ),
    );
    return d.reversed ? Opacity(opacity: 0.5, child: row) : row;
  }
}

KChipTone _tone(String tone) => switch (tone) {
  'up' => KChipTone.up,
  'down' => KChipTone.down,
  'ember' => KChipTone.ember,
  'info' => KChipTone.info,
  'gold' => KChipTone.gold,
  'warn' => KChipTone.warn,
  _ => KChipTone.neutral,
};

/// A ledger entry as a phone row (web LedgerPanel table): type, sub-ledger, reference, date and the signed amount.
class LedgerRow extends StatelessWidget {
  const LedgerRow({super.key, required this.item});
  final LedgerItem item;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final e = item;
    final kind = ledgerKind(e.kind);
    final c = e.currency == 'USC' ? 'USC ' : (e.currency == 'USD' ? r'$' : '${e.currency} ');
    final ref = e.note?.isNotEmpty == true ? ' · ${e.note}' : (e.reference?.isNotEmpty == true ? ' · ${e.reference}' : '');
    final color = signColor(k, e.amount);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    KChip(
                      label: t.dyn('accounts.ledgerKind.${e.kind}', fallback: kind.label),
                      tone: _tone(kind.tone),
                      small: true,
                    ),
                    Text(
                      t.dyn('accountDetail.subLedger.${e.subLedger}', fallback: e.subLedger),
                      style: context.text.caption.copyWith(color: k.fg2),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '#${e.txn}',
                        style: context.text.mono(11.5, color: k.fg3),
                      ),
                      TextSpan(text: ref),
                    ],
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
                const SizedBox(height: 2),
                Text(
                  serverTimeLabel(e.at, t.locale),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (e.amount != 0) Icon(e.amount > 0 ? LucideIcons.arrowDownLeft : LucideIcons.arrowUpRight, size: 14, color: color),
              const SizedBox(width: 3),
              Text(
                fmtAmount(e.amount, c, signed: true),
                textDirection: TextDirection.ltr,
                style: context.text.figure.copyWith(fontSize: 14, color: color),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
