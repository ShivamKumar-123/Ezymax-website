// The account detail's Overview and Positions tabs, the health card and the closure banner (web
// components/trading/account-detail.tsx OverviewPanel / PositionsPanel / PositionsTable / OrdersTable, activity.tsx
// DealsTable for the recent deals, extras.tsx HealthCard, closure.tsx ClosureBanner). Desktop tables become phone
// lists with the same columns as label / value text.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/account.dart';
import '../../../core/models/trading.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../account_actions.dart';
import '../accounts_data.dart';
import 'account_bits.dart';
import 'account_sheets.dart';

const Map<String, String> _orderType = {
  'market': 'accountDetail.orderType.market',
  'limit': 'accountDetail.orderType.limit',
  'stop': 'accountDetail.orderType.stop',
  'stop_limit': 'accountDetail.orderType.stopLimit',
};

/// An option premium in USD per contract, or the per-unit price with its quote currency (web OptionPremium).
String optionPremiumText(T t, double? usd, double? unit, String? currency) => usd != null
    ? '${fmtAmount(usd, r'$')} ${t('accounts.opt.perContract')}'
    : '${fmtPrice(unit)} ${currency != null ? t('accounts.opt.perUnit', {'currency': currency}) : t('accounts.opt.perUnitPlain')}';

/// Open premium and value now of an option position, in USD per contract (web positionPremiumsUsd).
({double? open, double? now}) positionPremiumsUsd(EnginePosition p, int usdFactor) {
  final n = p.volume.abs();
  final k = usdFactor > 0 ? usdFactor : 1;
  return (open: n > 0 && p.premium != null ? p.premium!.abs() / n / k : null, now: n > 0 && p.markValue != null ? p.markValue!.abs() / n / k : null);
}

/// Premiums of an option deal in USD per contract (web dealPremiumsUsd).
({double? own, double? open}) dealPremiumsUsd(EngineDeal d, int usdFactor) {
  final o = d.option;
  final n = d.volume.abs();
  final k = usdFactor > 0 ? usdFactor : 1;
  final size = o?['contractSize'], rate = o?['usdPerQuote'], cashV = o?['cash'];
  final perUnitUsd = size is num && rate is num && size > 0 && rate > 0 ? size * rate : null;
  final cash = cashV is num ? cashV.toDouble() : null;
  double? own;
  if (perUnitUsd != null) {
    own = d.price.abs() * perUnitUsd;
  } else if (cash != null && n > 0) {
    own = cash.abs() / n / k;
  }
  double? open;
  if (d.entry != 'in') {
    if (cash != null && n > 0) {
      open = (d.profit - cash).abs() / n / k;
    } else if (perUnitUsd != null && d.openPrice != null) {
      open = d.openPrice!.abs() * perUnitUsd;
    }
  }
  return (own: own, open: open);
}

String _volume(T t, num v, bool option) => option ? t('accounts.opt.contracts', {'count': fmtContracts(v)}) : v.toStringAsFixed(2);

/// A label / value cell of a trade row.
class _Cell extends StatelessWidget {
  const _Cell(this.label, this.value, {this.color, this.mono = true});
  final String label, value;
  final Color? color;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textDirection: TextDirection.ltr,
          style: (mono ? context.text.mono(12.5) : context.text.footnote).copyWith(color: color ?? k.fg2),
        ),
      ],
    );
  }
}

/// Cells three per row.
class _Cells extends StatelessWidget {
  const _Cells(this.cells);
  final List<Widget> cells;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 0; i < cells.length; i += 3) ...[
        if (i > 0) const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var j = i; j < i + 3; j++) ...[if (j > i) const SizedBox(width: 10), Expanded(child: j < cells.length ? cells[j] : const SizedBox.shrink())],
          ],
        ),
      ],
    ],
  );
}

/// A trade row's frame (web table row: surface-2 with a hairline).
class _TradeBox extends StatelessWidget {
  const _TradeBox({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children),
    );
  }
}

/// Side chip: BUY green / SELL red (web accountDetail.side).
class _SideChip extends StatelessWidget {
  const _SideChip(this.side, {this.text});
  final String side;
  final String? text;

  @override
  Widget build(BuildContext context) => KChip(
    label: text ?? (side == 'buy' ? context.t('accountDetail.side.buy') : context.t('accountDetail.side.sell')),
    tone: side == 'buy' ? KChipTone.up : KChipTone.down,
    small: true,
  );
}

/// The card frame of the detail tabs: header, then content.
class DetailCard extends StatelessWidget {
  const DetailCard({super.key, required this.title, this.subtitle, this.subtitleWidget, this.action, this.icon, required this.child});
  final String title;
  final String? subtitle;
  final Widget? subtitleWidget;
  final Widget? action;
  final IconData? icon;
  final Widget child;

  @override
  Widget build(BuildContext context) => KCard(
    padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (subtitleWidget == null)
          KCardHeader(title: title, subtitle: subtitle, action: action, icon: icon)
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: context.text.title2),
                    const SizedBox(height: 3),
                    DefaultTextStyle.merge(
                      style: context.text.footnote.copyWith(color: context.k.fg3),
                      child: subtitleWidget!,
                    ),
                  ],
                ),
              ),
              if (action != null) ...[const SizedBox(width: 10), action!],
            ],
          ),
        const SizedBox(height: 14),
        child,
      ],
    ),
  );
}

/* ------------------------------------------------------------------ Overview */

class OverviewPanel extends ConsumerWidget {
  const OverviewPanel({super.key, required this.account, required this.positions, required this.onTab});
  final EngineAccount account;
  final List<EnginePosition> positions;
  final ValueChanged<String> onTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final a = account;
    final cur = a.cent ? 'USC' : a.currency;
    final tone = levelTone(a.marginLevel);
    final usdFactor = usdFactorOf(a);
    final recent = ref.watch(recentDealsProvider(a.login));
    final (chipLabel, chipTone) = a.margin > 0
        ? (a.marginCall
              ? (t('accountDetail.margin.call'), KChipTone.down)
              : switch (tone) {
                  'up' => (t('accountDetail.health.healthy'), KChipTone.up),
                  'warn' => (t('accountDetail.health.watch'), KChipTone.warn),
                  _ => (t('accountDetail.health.atRisk'), KChipTone.down),
                })
        : (t('accountDetail.margin.noneUsed'), KChipTone.neutral);
    Widget money(double v) => KMoney(v, currency: cur, style: context.text.figure);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // margin
        DetailCard(
          title: t('accountDetail.stat.margin'),
          subtitle: t('accountDetail.margin.subtitle', {'call': a.marginCallLevel, 'stopOut': a.stopOutLevel}),
          action: KChip(label: chipLabel, tone: chipTone, dot: a.margin > 0, small: true),
          child: Column(
            children: [
              Center(
                child: KGauge(
                  value: a.margin > 0 ? (a.marginLevel ?? 0).clamp(0, 3000).toDouble() : 0,
                  max: 3000,
                  display: fmtLevel(a.margin > 0 ? a.marginLevel : null),
                  label: t('accountDetail.stat.marginLevel'),
                ),
              ),
              const SizedBox(height: 10),
              TileGrid(
                children: [
                  StatTile(label: t('common.balance'), child: money(a.balance)),
                  StatTile(label: t('common.equity'), child: money(a.equity)),
                  StatTile(label: t('accountDetail.stat.margin'), child: money(a.margin)),
                  StatTile(label: t('accountDetail.stat.freeMargin'), child: money(a.freeMargin)),
                  StatTile(label: t('accountDetail.stat.credit'), child: money(a.credit + a.bonus)),
                  StatTile(
                    label: t('accountDetail.stat.floatingPnl'),
                    tone: pnlColor(context, a.profit),
                    child: Text(fmtAmount(a.profit, a.currencyPrefix, signed: true), textDirection: TextDirection.ltr),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // open positions (first five)
        DetailCard(
          title: t('accountDetail.overview.openPositions'),
          subtitle: t('accountDetail.overview.positionsSubtitle', {'open': a.positions, 'pending': a.orders}),
          action: KButton(
            label: t('accountDetail.overview.allPositions'),
            variant: KButtonVariant.surface,
            size: KButtonSize.sm,
            onPressed: () => onTab('positions'),
          ),
          child: positions.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text(
                    t('accountDetail.overview.noPositions'),
                    textAlign: TextAlign.center,
                    style: context.text.callout.copyWith(color: k.fg3),
                  ),
                )
              : Column(
                  children: [
                    for (final p in positions.take(5)) ...[_PositionLine(p: p, account: a, usdFactor: usdFactor), const SizedBox(height: 8)],
                  ],
                ),
        ),
        const SizedBox(height: 16),
        // recent deals
        DetailCard(
          title: t('accountDetail.overview.recentDeals'),
          subtitle: recent.hasValue
              ? t('accountDetail.overview.dealsCount', {'count': recent.requireValue.total})
              : t('accountDetail.overview.recentDealsSubtitle'),
          action: KButton(
            label: t('accountDetail.overview.fullHistory'),
            variant: KButtonVariant.surface,
            size: KButtonSize.sm,
            onPressed: () => onTab('history'),
          ),
          child: () {
            if (recent.hasValue) {
              final deals = recent.requireValue.deals;
              if (deals.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text(
                    t('accountDetail.overview.noDeals'),
                    textAlign: TextAlign.center,
                    style: context.text.callout.copyWith(color: k.fg3),
                  ),
                );
              }
              return Column(
                children: [
                  for (final d in deals) ...[DealRow(deal: d, account: a), const SizedBox(height: 8)],
                ],
              );
            }
            if (recent.hasError) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text(
                  errorText(recent.error, t),
                  textAlign: TextAlign.center,
                  style: context.text.callout.copyWith(color: k.fg3),
                ),
              );
            }
            return const KSkeleton(height: 160, radius: 14);
          }(),
        ),
        const SizedBox(height: 16),
        // account information
        DetailCard(
          title: t('accountDetail.info.title'),
          child: KKeyValues([
            KKV(t('common.type'), '${a.live ? t('common.live') : t('common.demo')} · ${a.groupName}'),
            KKV(t('accountDetail.info.positionMode'), t.dyn('accounts.mode.${a.mode}', fallback: modeLabel(a.mode))),
            KKV(t('common.currency'), a.cent ? t('accountDetail.info.uscCents') : a.currency),
            KKV(t('accountDetail.info.leverage'), levLabel(a.leverage), mono: true),
            KKV(t('accountDetail.info.server'), a.server, mono: true),
            KKV(t('common.status'), null, valueWidget: StatusChip(status: a.status)),
            KKV(t('accountDetail.info.opened'), fmtDate(t, a.createdAt)),
          ]),
        ),
        if (!a.archived) ...[const SizedBox(height: 16), HealthCard(account: a)],
      ],
    );
  }
}

/// A position in the Overview list: symbol, side and size, open -> current, ticket, P&L.
class _PositionLine extends StatelessWidget {
  const _PositionLine({required this.p, required this.account, required this.usdFactor});
  final EnginePosition p;
  final EngineAccount account;
  final int usdFactor;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final isOpt = p.isOption;
    final prem = isOpt ? positionPremiumsUsd(p, usdFactor) : null;
    final path = prem != null && prem.open != null && prem.now != null
        ? '${fmtAmount(prem.open!, r'$')} → ${fmtAmount(prem.now!, r'$')} ${t('accounts.opt.perContract')}'
        : '${fmtPrice(p.openPrice)} → ${fmtPrice(p.currentPrice)}';
    return _TradeBox(
      children: [
        Row(
          children: [
            TradeSymbolAvatar(symbol: p.symbol, size: 24),
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
                      Text(
                        symbolLabel(t, p.symbol, p.option),
                        style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600, fontSize: 13.5),
                      ),
                      _SideChip(
                        p.side,
                        text:
                            '${p.side == 'buy' ? t('accountDetail.side.buy') : t('accountDetail.side.sell')} ${isOpt ? t('accounts.opt.contracts', {'count': fmtContracts(p.volume)}) : _trimVol(p.volume)}',
                      ),
                      if (isOpt) const OptionTag(),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '$path · #${p.ticket}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(11, color: k.fg3),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              fmtAmount(p.profit, account.currencyPrefix, signed: true),
              textDirection: TextDirection.ltr,
              style: context.text.figure.copyWith(fontSize: 14, color: pnlColor(context, p.profit)),
            ),
          ],
        ),
      ],
    );
  }
}

/// The web shows the raw volume (0.5, 1, 0.25).
String _trimVol(double v) {
  final s = v.toStringAsFixed(2);
  return s.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
}

/// A deal (web DealsTable row): symbol, side, deal id, direction and reason, volume, price, time, commission, swap,
/// profit (exits).
class DealRow extends StatelessWidget {
  const DealRow({super.key, required this.deal, required this.account});
  final EngineDeal deal;
  final EngineAccount account;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final d = deal;
    final exit = d.entry != 'in';
    final isOpt = d.isOption;
    final opt = isOpt ? optionTerms(d.symbol, d.option) : null;
    final name = opt != null ? optionLabel(t, opt) : d.symbol;
    final prem = isOpt ? dealPremiumsUsd(d, usdFactorOf(account)) : null;
    final reason = exit && (isOpt || d.reason != 'client') ? t.dyn('accounts.reason.${d.reason}', fallback: d.reason.replaceAll('_', ' ')) : null;
    final reasonColor = d.reason == 'stop_out' || d.reason == 'knock_out' ? k.down : (d.reason == 'expiry' ? k.gold : k.fg3);
    var price = fmtPrice(d.price);
    if (prem != null) {
      price = optionPremiumText(t, prem.own, d.price, opt?.underlying.length == 6 ? opt!.underlying.substring(3) : null);
    }
    return Opacity(
      opacity: d.reversed ? 0.5 : 1,
      child: _TradeBox(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TradeSymbolAvatar(symbol: opt?.series ?? d.symbol, size: 24),
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
                        Text(
                          name,
                          style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600, fontSize: 13.5),
                        ),
                        _SideChip(d.side),
                        if (isOpt) const OptionTag(),
                        if (d.reversed) KChip(label: t('accountDetail.deal.reversed'), small: true),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text.rich(
                      TextSpan(
                        text: exit ? t('accountDetail.deal.out') : t('accountDetail.deal.in'),
                        children: [
                          if (reason != null)
                            TextSpan(
                              text: ' · $reason',
                              style: TextStyle(color: reasonColor),
                            ),
                          TextSpan(text: ' · ${t('accountDetail.deal.position', {'ticket': d.positionTicket})}'),
                        ],
                      ),
                      style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                exit ? fmtAmount(d.profit, account.currencyPrefix, signed: true) : '—',
                textDirection: TextDirection.ltr,
                style: context.text.figure.copyWith(fontSize: 14, color: exit ? pnlColor(context, d.profit) : k.fg3),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _Cells([
            _Cell(t('accountDetail.col.deal'), '#${d.id}'),
            _Cell(t('accountDetail.col.volume'), _volume(t, d.volume, isOpt)),
            _Cell(t('accountDetail.col.price'), price),
            _Cell(t('common.time'), serverTimeText(t, d.time), mono: false),
            _Cell(t('accountDetail.col.commission'), d.commission != 0 ? fmtAmount(-d.commission.abs(), '') : '—'),
            _Cell(t('accountDetail.col.swap'), d.swap != 0 ? fmtAmount(d.swap, '') : '—'),
          ]),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ Positions */

class PositionsPanel extends StatelessWidget {
  const PositionsPanel({super.key, required this.account, required this.positions, required this.orders});
  final EngineAccount account;
  final List<EnginePosition> positions;
  final List<EngineOrder> orders;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final a = account;
    if (positions.isEmpty && orders.isEmpty) {
      return KCard(
        child: KEmptyState(
          art: KIllustrationName.emptyPosition,
          title: t('accountDetail.positions.emptyTitle'),
          text: t('accountDetail.positions.emptyText'),
          action: TradeButton(account: a, label: t('accountDetail.positions.openTrader')),
        ),
      );
    }
    final usdFactor = usdFactorOf(a);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DetailCard(
          title: t('accountDetail.overview.openPositions'),
          subtitleWidget: KRichText(
            t('accountDetail.positions.subtitleTrader', {'count': positions.length, 'amount': fmtAmount(a.profit, a.currencyPrefix, signed: true)}),
            tags: {
              'pnl': KTag(
                style: TextStyle(color: pnlColor(context, a.profit), fontWeight: FontWeight.w600),
              ),
            },
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TradeButton(account: a, size: KButtonSize.sm, label: t('accountDetail.positions.manageInTrader')),
              ),
              const SizedBox(height: 12),
              if (positions.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text(
                    t('accountDetail.positions.none'),
                    textAlign: TextAlign.center,
                    style: context.text.callout.copyWith(color: k.fg3),
                  ),
                ),
              for (final p in positions) ...[PositionRow(p: p, account: a, usdFactor: usdFactor), const SizedBox(height: 8)],
              if (positions.any((p) => p.isOption))
                Text(
                  t('accounts.opt.premiumHint'),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
            ],
          ),
        ),
        if (orders.isNotEmpty) ...[
          const SizedBox(height: 16),
          DetailCard(
            title: t('accountDetail.orders.title'),
            subtitle: t('accountDetail.orders.subtitle', {'count': orders.length}),
            child: Column(
              children: [
                for (final o in orders) ...[OrderRow(o: o), const SizedBox(height: 8)],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// An open position (web PositionsTable row): symbol, side, open time, then ticket, volume, open, current, SL / TP,
/// swap; P&L at the end.
class PositionRow extends StatelessWidget {
  const PositionRow({super.key, required this.p, required this.account, required this.usdFactor});
  final EnginePosition p;
  final EngineAccount account;
  final int usdFactor;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final digits = p.openPrice >= 1000 ? 2 : (p.openPrice >= 50 ? 3 : 5);
    final isOpt = p.isOption;
    final opt = isOpt ? optionTerms(p.symbol, p.option) : null;
    final prem = isOpt ? positionPremiumsUsd(p, usdFactor) : null;
    final quote = opt == null ? null : ((p.option?['quoteCurrency'] as String?) ?? (opt.underlying.length == 6 ? opt.underlying.substring(3) : null));
    return _TradeBox(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TradeSymbolAvatar(symbol: opt?.series ?? p.symbol, size: 26),
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
                      Text(
                        symbolLabel(t, p.symbol, p.option),
                        style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600, fontSize: 13.5),
                      ),
                      _SideChip(p.side),
                      if (isOpt) const OptionTag(),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    serverTimeText(t, p.openTime),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              fmtAmount(p.profit, account.currencyPrefix, signed: true),
              textDirection: TextDirection.ltr,
              style: context.text.figure.copyWith(fontSize: 14.5, color: pnlColor(context, p.profit)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _Cells([
          _Cell(t('accountDetail.col.ticket'), '#${p.ticket}'),
          _Cell(t('accountDetail.col.volume'), _volume(t, p.volume, isOpt)),
          _Cell(t('accountDetail.col.open'), prem != null ? optionPremiumText(t, prem.open, p.openPrice, quote) : fmtPrice(p.openPrice, digits)),
          _Cell(t('accountDetail.col.current'), prem != null ? optionPremiumText(t, prem.now, p.currentPrice, quote) : fmtPrice(p.currentPrice, digits)),
          _Cell(
            t('accountDetail.col.slTp'),
            isOpt ? '—' : '${p.sl != null && p.sl != 0 ? fmtPrice(p.sl, digits) : '—'} / ${p.tp != null && p.tp != 0 ? fmtPrice(p.tp, digits) : '—'}',
          ),
          _Cell(t('accountDetail.col.swap'), isOpt && p.swap == 0 ? '—' : fmtAmount(p.swap, ''), color: p.swap < 0 ? k.down : null),
        ]),
      ],
    );
  }
}

/// A pending order (web OrdersTable row): symbol (+ legs), ticket, type, volume, price, placed.
class OrderRow extends StatelessWidget {
  const OrderRow({super.key, required this.o});
  final EngineOrder o;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final legs = [
      for (final l in (o.option?['legs'] is List ? o.option!['legs'] as List : const []))
        if (l is Map) l.cast<String, dynamic>(),
    ];
    final first = legs.isEmpty ? null : legs.first;
    final firstOpt = first?['option'] is Map ? (first!['option'] as Map).cast<String, dynamic>() : null;
    final isOpt = o.option != null || isOptionSymbol(o.symbol);
    final symbol = '${first?['series'] ?? o.symbol}';
    final opt = isOpt ? optionTerms(symbol, firstOpt) : null;
    final limitPremium = o.option?['limitPremium'];
    final typeLabel = t(_orderType[o.type] ?? 'accountDetail.orderType.market');
    final price = isOpt
        ? (limitPremium is num
              ? optionPremiumText(t, null, limitPremium.toDouble(), opt?.underlying.length == 6 ? opt!.underlying.substring(3) : null)
              : t('accountDetail.orderType.market'))
        : fmtPrice(o.price);
    final contracts = first?['contracts'];
    return _TradeBox(
      children: [
        Row(
          children: [
            TradeSymbolAvatar(symbol: opt?.series ?? o.symbol, size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    symbolLabel(t, symbol, firstOpt),
                    style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600, fontSize: 13.5),
                  ),
                  if (legs.length > 1) Text(t('accounts.opt.moreLegs', {'count': legs.length - 1}), style: context.text.caption.copyWith(color: k.fg3)),
                  if (isOpt) const OptionTag(),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _SideChip(o.side, text: t('accountDetail.order.label', {'side': o.side == 'buy' ? t('common.buy') : t('common.sell'), 'type': typeLabel})),
          ],
        ),
        const SizedBox(height: 10),
        _Cells([
          _Cell(t('accountDetail.col.ticket'), '#${o.ticket}'),
          _Cell(t('accountDetail.col.volume'), _volume(t, contracts is num ? contracts : o.volume, isOpt)),
          _Cell(t('accountDetail.col.price'), price),
          _Cell(t('accountDetail.col.placed'), serverTimeText(t, o.placedAt), mono: false),
        ]),
      ],
    );
  }
}

/* ------------------------------------------------------------------ Health (extras.tsx HealthCard) */

class HealthCard extends ConsumerWidget {
  const HealthCard({super.key, required this.account});
  final EngineAccount account;

  String _detail(T t, HealthItem i) {
    final v = i.value;
    num n(String k) => v[k] ?? 0;
    switch (i.key) {
      case 'margin_level':
        return v['level'] == null
            ? t('accounts.health.noMargin')
            : t('accounts.health.marginLevelValue', {'level': n('level').round(), 'call': n('marginCall')});
      case 'stop_loss':
        return n('positions') == 0 ? t('accounts.health.noPositions') : t('accounts.health.stopLossValue', {'with': n('withSl'), 'total': n('positions')});
      case 'margin_use':
        return t('accounts.health.pct', {'pct': n('pct').toStringAsFixed(1)});
      case 'floating':
        return t('accounts.health.floatingValue', {'pct': n('pctOfBalance').toStringAsFixed(1)});
      case 'results_30d':
        return n('trades') == 0 ? t('accounts.health.noTrades') : t('accounts.health.resultsValue', {'trades': n('trades'), 'rate': n('winRate')});
    }
    return '';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final h = ref.watch(accountHealthProvider(account.login)).value;
    return DetailCard(
      title: t('accounts.health.title'),
      subtitle: t('accounts.health.subtitle'),
      action: h == null ? null : KChip(label: '${h.score}/100', tone: healthScoreTone(h.score), icon: LucideIcons.heartPulse),
      child: h == null
          ? const KSkeleton(height: 150, radius: 14)
          : Column(
              children: [
                for (final i in h.items) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: k.line),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t.dyn('accounts.health.${i.key}', fallback: i.key),
                                style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 2),
                              Text(_detail(t, i), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        KChip(
                          label: t.dyn('accounts.health.status.${i.status}', fallback: i.status),
                          tone: healthStatusTone(i.status),
                          small: true,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }
}

/* ------------------------------------------------------------------ Closure banner (closure.tsx ClosureBanner) */

/// The closure request banner under the header, loaded only when the account says there is one.
class ClosureBanner extends ConsumerStatefulWidget {
  const ClosureBanner({super.key, required this.account, this.onChanged});
  final EngineAccount account;
  final VoidCallback? onChanged;

  @override
  ConsumerState<ClosureBanner> createState() => _ClosureBannerState();
}

class _ClosureBannerState extends ConsumerState<ClosureBanner> {
  ClosureStatus? _st;
  String? _loadedFor;

  @override
  void initState() {
    super.initState();
    _maybeLoad();
  }

  @override
  void didUpdateWidget(ClosureBanner old) {
    super.didUpdateWidget(old);
    _maybeLoad();
  }

  void _maybeLoad() {
    final status = widget.account.closureStatus;
    final key = '${widget.account.login}:$status';
    if (status == null || status == 'cancelled' || key == _loadedFor) return;
    _loadedFor = key;
    unawaited(() async {
      try {
        final j = await apiOf(context).get<Map<String, dynamic>>('trading/accounts/${widget.account.login}/closure');
        if (mounted) setState(() => _st = ClosureStatus.fromJson(j));
      } catch (_) {
        // the banner is extra information: no error state (web .catch(() => {}))
      }
    }());
  }

  @override
  Widget build(BuildContext context) {
    final r = _st?.request;
    final a = widget.account;
    if (r == null || r.status == 'cancelled' || (r.status == 'approved' && a.status != 'closed')) return const SizedBox.shrink();
    final at = r.decidedAt ?? r.createdAt;
    final stale = r.status == 'rejected' && at != null && DateTime.now().difference(at).inDays > 30;
    if (stale) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: ClosureNotice(request: r, login: a.login, onChanged: widget.onChanged),
    );
  }
}
