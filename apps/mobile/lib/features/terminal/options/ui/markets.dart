// Markets tab of the options mode (web: components/options/instruments.tsx, phone variant): every underlying of
// Kalks FX Options with its spot and daily change (and the ATM implied vol with the Pro columns), grouped by asset
// class; underlyings not open here yet are listed as "soon". Picking one sets the underlying of the chain, the chart
// and the ticket.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../core/format.dart';
import '../core/math.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'bits.dart';
import 'header.dart';

const List<String> _classes = ['forex', 'metals', 'energies'];

class OptionsMarkets extends ConsumerStatefulWidget {
  const OptionsMarkets({super.key, required this.onPick});
  final ValueChanged<String> onPick;

  @override
  ConsumerState<OptionsMarkets> createState() => _OptionsMarketsState();
}

class _OptionsMarketsState extends ConsumerState<OptionsMarkets> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final list = ref.watch(optionsProvider.select((s) => s.underlyings));
    final u = ref.watch(optionsProvider.select((s) => s.u));
    final avail = ref.watch(optionsProvider.select((s) => s.avail));
    final liveIv = ref.watch(
      optionsProvider.select(
        (s) => s.chain != null && s.chain!.underlying == s.u && s.chain!.rows.isNotEmpty ? s.chain!.rows[atmIndex(s.chain!)].call?.iv : null,
      ),
    );
    final showIv = ref.watch(optionsProvider.select((s) => s.prefs.colPreset == 'pro' || s.prefs.cols.contains('iv')));
    final listed = {for (final x in list) x.symbol};
    final items = [
      for (final x in list) (symbol: x.symbol, name: x.name, cls: x.assetClass, atmVol: x.atmVol, listed: true),
      for (final x in optionUnderlyings.where((x) => !listed.contains(x.symbol)))
        (symbol: x.symbol, name: x.name, cls: x.assetClass, atmVol: null, listed: false),
    ];
    final q = _q.toLowerCase();
    final shown = items.where((x) => q.isEmpty || x.symbol.toLowerCase().contains(q) || x.name.toLowerCase().contains(q)).toList();
    Widget head(String text) => Container(
      height: 28,
      alignment: AlignmentDirectional.centerStart,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.5),
        border: Border(bottom: BorderSide(color: k.line.withValues(alpha: 0.5))),
      ),
      child: Text(text.toUpperCase(), style: context.text.micro.copyWith(fontSize: 9.5, color: k.fg3, letterSpacing: 0.8)),
    );
    Widget row(({String symbol, String name, String cls, double? atmVol, bool listed}) it) {
      final active = it.symbol == u && it.listed;
      final iv = active && liveIv != null ? liveIv : it.atmVol;
      return Opacity(
        opacity: it.listed ? 1 : 0.55,
        child: KPressable(
          minSize: 52,
          pressedScale: 1,
          onTap: it.listed
              ? () {
                  ref.read(optionsProvider.notifier).selectUnderlying(it.symbol);
                  widget.onPick(it.symbol);
                }
              : null,
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              color: active ? k.emberSoft.withValues(alpha: 0.55) : null,
              border: Border(bottom: BorderSide(color: k.line.withValues(alpha: 0.5))),
            ),
            child: Row(
              children: [
                Container(width: 2, height: 40, color: active ? k.ember : Colors.transparent),
                const SizedBox(width: 10),
                OptAvatar(it.symbol, size: 22),
                const SizedBox(width: 9),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(it.symbol, style: context.text.label.copyWith(fontWeight: FontWeight.w500)),
                      Text(
                        it.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
                if (!it.listed)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(4)),
                    child: Text(t('trader.opt.soonBadge').toUpperCase(), style: context.text.micro.copyWith(fontSize: 9, color: k.fg3)),
                  ),
                SizedBox(
                  width: 92,
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: it.listed ? SpotPrice(it.symbol, size: 12.5) : Text('—', style: context.text.mono(11, color: k.fg3)),
                  ),
                ),
                SizedBox(
                  width: 64,
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: it.listed ? FeedChange(it.symbol) : Text('—', style: context.text.mono(10.5, color: k.fg3)),
                  ),
                ),
                if (showIv)
                  SizedBox(
                    width: 52,
                    child: Text(
                      it.listed ? pct(iv) : '—',
                      textAlign: TextAlign.end,
                      style: context.text.mono(11, color: k.fg2),
                    ),
                  ),
                const SizedBox(width: 10),
              ],
            ),
          ),
        ),
      );
    }

    final th = context.text.micro.copyWith(fontSize: 10, color: k.fg3, letterSpacing: 0.5);
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
          ),
          child: KSearchField(placeholder: t('trader.opt.searchUnderlying'), onChanged: (v) => setState(() => _q = v)),
        ),
        Container(
          height: 24,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: k.surface,
            border: Border(bottom: BorderSide(color: k.line)),
          ),
          child: Row(
            children: [
              Expanded(child: Text(t('market.col.symbol').toUpperCase(), style: th)),
              SizedBox(
                width: 92,
                child: Text(t('trader.opt.spot').toUpperCase(), textAlign: TextAlign.end, style: th),
              ),
              SizedBox(
                width: 64,
                child: Text(t('market.col.change').toUpperCase(), textAlign: TextAlign.end, style: th),
              ),
              if (showIv)
                SizedBox(
                  width: 52,
                  child: Text(t('trader.opt.col.iv').toUpperCase(), textAlign: TextAlign.end, style: th),
                ),
            ],
          ),
        ),
        Expanded(
          child: avail == OptAvail.loading && list.isEmpty
              ? const OptSkeletonList(count: 8, height: 44)
              : ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    for (final c in _classes)
                      if (shown.any((x) => x.listed && x.cls == c)) ...[
                        head(t('trader.opt.class.$c')),
                        for (final x in shown.where((x) => x.listed && x.cls == c)) row(x),
                      ],
                    if (shown.any((x) => !x.listed)) ...[head(t('trader.opt.comingSoon')), for (final x in shown.where((x) => !x.listed)) row(x)],
                  ],
                ),
        ),
      ],
    );
  }
}
