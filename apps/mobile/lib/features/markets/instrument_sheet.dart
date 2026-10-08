// The instrument sheet (web components/markets/instrument-drawer.tsx, live build): symbol, asset class, open/closed,
// favourite; Sell · bid / Buy · ask (each opens Ezymex Trader on that side); change, day range, spread; daily close
// chart (1M / 3M / 6M); contract specification (no swap rows in live builds); trading hours (server time) with today
// marked. Footer: Sell · Buy · Trade <symbol>.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format/format.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'instruments.dart';
import 'markets_feed.dart';

/// Opens Ezymex Trader on `symbol` (optionally on a side), like the web's `${TERMINAL_URL}/?symbol=…&side=…`.
void openTrader(BuildContext context, String symbol, {String? side}) =>
    GoRouter.of(context).push('/trader?symbol=${Uri.encodeQueryComponent(symbol)}${side == null ? '' : '&side=$side'}');

/// Toggles a favourite with the web's toast.
void toggleFavourite(WidgetRef ref, T t, String symbol) {
  final on = ref.read(marketFavouritesProvider.notifier).toggle(symbol);
  ref
      .read(notificationsProvider.notifier)
      .toast(NotificationKind.success, on ? t('news.markets.favAdded', {'symbol': symbol}) : t('news.markets.favRemoved', {'symbol': symbol}), keep: false);
}

Future<void> showInstrumentSheet(BuildContext context, String symbol) {
  final router = GoRouter.of(context);
  return showKSheet<void>(
    context,
    title: context.t('news.instrument.title'),
    expand: true,
    builder: (ctx) => _InstrumentBody(
      symbol: symbol,
      onTrade: (side) {
        Navigator.of(ctx).pop();
        router.push('/trader?symbol=${Uri.encodeQueryComponent(symbol)}${side == null ? '' : '&side=$side'}');
      },
    ),
  );
}

class _InstrumentBody extends ConsumerStatefulWidget {
  const _InstrumentBody({required this.symbol, required this.onTrade});
  final String symbol;
  final void Function(String? side) onTrade;

  @override
  ConsumerState<_InstrumentBody> createState() => _InstrumentBodyState();
}

class _InstrumentBodyState extends ConsumerState<_InstrumentBody> {
  String _range = '3M';
  static const _ranges = {'1M': 30, '3M': 90, '6M': 180};

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = widget.symbol;
    final inst = kInstrumentMap[s];
    if (inst == null) return const SizedBox.shrink();
    final spec = contractSpec(inst);
    final q = ref.watch(marketsFeedProvider)[s];
    final fav = ref.watch(marketFavouritesProvider).contains(s);
    final open = isMarketOpen(inst);
    final bars = ref.watch(dailyCandlesProvider(s)).value;
    final series = bars?.sublist((bars.length - _ranges[_range]!).clamp(0, bars.length));
    final hi = q?.high ?? bars?.last.high ?? q?.ask;
    final lo = q?.low ?? bars?.last.low ?? q?.bid;
    final todayIdx = serverNow().weekday - 1; // 0 = Monday
    String dayName(String d) => t.dyn('news.day.${d.toLowerCase()}', fallback: d);
    final spread = q == null
        ? '—'
        : inst.assetClass == AssetClass.forex
        ? t('news.instrument.pips', {'value': ((q.ask - q.bid) / inst.pipSize).toStringAsFixed(1)})
        : Fmt.number(q.ask - q.bid, inst.digits);

    Widget priceTile({required String label, required Color tone, required double? value, required String side, bool end = false}) => Expanded(
      child: KPressable(
        onTap: () => widget.onTrade(side),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(k.rowRadius),
            border: Border.all(color: k.line),
          ),
          child: Column(
            crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Text(label.toUpperCase(), style: context.text.micro.copyWith(color: tone, letterSpacing: 0.8, fontSize: 11)),
              const SizedBox(height: 4),
              Text(
                value == null ? '—' : Fmt.number(value, inst.digits),
                textDirection: TextDirection.ltr,
                style: context.text.mono(21, weight: FontWeight.w600, color: q?.dir == 1 ? k.up : (q?.dir == -1 ? k.down : k.fg)),
              ),
            ],
          ),
        ),
      ),
    );

    final specRows = <(String, String)>[
      (t('news.instrument.spec.digits'), '${spec.digits}'),
      (
        t('news.instrument.spec.contractSize'),
        '${Fmt.number(spec.contractSize, 0)} ${t.dyn('news.instrument.unit.${inst.assetClass.name}', fallback: spec.contractUnit)}',
      ),
      (t('news.instrument.spec.minMaxLot'), '${spec.minLot} / ${Fmt.number(spec.maxLot, 0)}'),
      (t('news.instrument.spec.lotStep'), '${spec.lotStep}'),
      (t('news.instrument.spec.maxLeverage'), '1:${spec.leverage}'),
      (t('news.instrument.spec.marginCurrency'), spec.marginCurrency),
    ];

    return KSheetContent(
      footer: Row(
        children: [
          Expanded(
            child: _ToneButton(label: t('common.sell'), color: k.down, onTap: () => widget.onTrade('sell')),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _ToneButton(label: t('common.buy'), color: k.up, onTap: () => widget.onTrade('buy')),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: KButton(
              label: t('news.instrument.trade', {'symbol': s}),
              icon: LucideIcons.candlestickChart,
              expand: true,
              onPressed: () => widget.onTrade(null),
            ),
          ),
        ],
      ),
      children: [
        Text(
          t('news.instrument.description', {'symbol': s}),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3),
        ),
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SymbolAvatar(s, size: 40),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(s, style: context.text.title2),
                      KChip(label: t.dyn('news.assetClass.${inst.assetClass.name}', fallback: kAssetClassLabel[inst.assetClass]), small: true),
                      KChip(
                        label: open ? t('news.markets.marketOpen') : t('news.markets.marketClosed'),
                        tone: open ? KChipTone.up : KChipTone.neutral,
                        dot: true,
                        small: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(inst.name, style: context.text.footnote.copyWith(color: k.fg3)),
                ],
              ),
            ),
            KIconButton(
              icon: LucideIcons.star,
              filled: true,
              size: 36,
              color: fav ? k.gold : k.fg3,
              semanticLabel: t('news.markets.favourite'),
              onPressed: () => toggleFavourite(ref, t, s),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            priceTile(label: t('news.instrument.sellBid'), tone: k.down, value: q?.bid, side: 'sell'),
            const SizedBox(width: 10),
            priceTile(label: t('news.instrument.buyAsk'), tone: k.up, value: q?.ask, side: 'buy', end: true),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 14,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _Fact(
              label: t('news.instrument.change'),
              value: q == null ? '—' : Fmt.percent(q.change, signed: true),
              color: (q?.change ?? 0) >= 0 ? k.up : k.down,
            ),
            _Fact(
              label: t('news.instrument.dayRange'),
              value: lo == null || hi == null ? '—' : '${Fmt.number(lo, inst.digits)} – ${Fmt.number(hi, inst.digits)}',
            ),
            _Fact(label: t('news.instrument.spread'), value: spread),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(k.rowRadius),
            border: Border.all(color: k.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(t('news.instrument.dailyClose'), style: context.text.label.copyWith(color: k.fg2)),
                  ),
                  SizedBox(
                    width: 150,
                    child: KSegmented<String>(
                      plain: true,
                      height: 30,
                      values: _ranges.keys.toList(),
                      labels: _ranges.keys.toList(),
                      selected: _range,
                      onChanged: (v) => setState(() => _range = v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (series != null && series.length > 1)
                KLineChart(
                  values: [for (final b in series) b.close],
                  height: 170,
                  color: (q?.change ?? 0) >= 0 ? k.gold : k.down,
                  format: (v) => Fmt.number(v, inst.digits),
                )
              else
                const SizedBox(height: 190),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text(t('news.instrument.contractSpec'), style: context.text.label.copyWith(color: k.fg2)),
        const SizedBox(height: 8),
        for (var r = 0; r < specRows.length; r += 2) ...[
          if (r > 0) const SizedBox(height: 8),
          Row(
            children: [
              for (var c = r; c < r + 2; c++) ...[
                if (c > r) const SizedBox(width: 8),
                Expanded(
                  child: c < specRows.length ? _SpecTile(label: specRows[c].$1, value: specRows[c].$2) : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ],
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: Text(t('news.instrument.tradingHours'), style: context.text.label.copyWith(color: k.fg2)),
            ),
            Text(
              t('news.instrument.serverTime'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: k.line),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < 7; i++) ...[
                if (i > 0) const KDivider(),
                Container(
                  color: i == todayIdx ? k.emberSoft.withValues(alpha: 0.6) : null,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  child: Row(
                    children: [
                      Text(
                        dayName(spec.hours[i].day),
                        style: context.text.footnote.copyWith(
                          color: i == todayIdx ? k.fg : k.fg2,
                          fontWeight: i == todayIdx ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                      if (i == todayIdx) ...[const SizedBox(width: 8), KChip(label: t('common.today'), tone: KChipTone.ember, small: true)],
                      const Spacer(),
                      Text(
                        spec.hours[i].sessions == 'Closed' ? t('news.sessionClosed') : spec.hours[i].sessions,
                        textDirection: TextDirection.ltr,
                        style: context.text.mono(12.5, color: spec.hours[i].sessions == 'Closed' ? k.fg3 : k.fg),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value, this.color});
  final String label, value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Text.rich(
      TextSpan(
        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
        children: [
          TextSpan(text: '$label '),
          TextSpan(
            text: value,
            style: context.text.mono(12, color: color ?? k.fg2),
          ),
        ],
      ),
    );
  }
}

class _SpecTile extends StatelessWidget {
  const _SpecTile({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.text.callout.copyWith(fontWeight: FontWeight.w600, fontSize: 13, fontFeatures: kTabular),
          ),
        ],
      ),
    );
  }
}

/// The web's down-outline / up-outline buttons: tinted text and border.
class _ToneButton extends StatelessWidget {
  const _ToneButton({required this.label, required this.color, required this.onTap});
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => KPressable(
    onTap: onTap,
    semanticLabel: label,
    child: Container(
      height: KSize.buttonMd,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(KSize.buttonMd / 2),
        border: Border.all(color: color.withValues(alpha: 0.45)),
        color: color.withValues(alpha: 0.06),
      ),
      child: Text(label, style: context.text.headline.copyWith(fontSize: 14, color: color)),
    ),
  );
}
