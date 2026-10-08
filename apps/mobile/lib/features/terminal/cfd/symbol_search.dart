// Symbol search (web Ctrl+K search dialog on phones): the markets the account may trade, by segment and text. Picks
// the chart's market, or calls `onPick` (the order sheet's symbol).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/terminal_controller.dart';
import '../core/workspace.dart';
import '../widgets/kit.dart';
import 'watchlist_tab.dart';

Future<void> showSymbolSearch(BuildContext context, {ValueChanged<String>? onPick}) => showKSheet<void>(
  context,
  expand: true,
  title: context.t('trader.searchSymbols'),
  builder: (_) => _SymbolSearch(onPick: onPick),
);

class _SymbolSearch extends ConsumerStatefulWidget {
  const _SymbolSearch({this.onPick});
  final ValueChanged<String>? onPick;

  @override
  ConsumerState<_SymbolSearch> createState() => _SymbolSearchState();
}

class _SymbolSearchState extends ConsumerState<_SymbolSearch> {
  String _q = '';
  String _seg = 'all';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final book = ref.watch(symbolBookProvider);
    final ws = ref.watch(workspaceProvider);
    final live = ref.watch(terminalProvider.select((s) => s.account?.live ?? true));
    final visible = book.visible(live: live);
    final q = _q.trim().toLowerCase();
    final list = visible
        .where((i) => inSegment(i, _seg, ws.favourites))
        .where((i) => q.isEmpty || i.symbol.toLowerCase().contains(q) || i.name.toLowerCase().contains(q))
        .take(q.isEmpty ? 200 : 60)
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
          child: Column(
            children: [
              KTextField(leading: LucideIcons.search, placeholder: t('trader.searchSymbols'), autofocus: true, onChanged: (v) => setState(() => _q = v)),
              const SizedBox(height: 8),
              SegmentChips(instruments: visible, value: _seg, favourites: ws.favourites, onChanged: (s) => setState(() => _seg = s)),
            ],
          ),
        ),
        Expanded(
          child: list.isEmpty
              ? TEmptyLine(t('trader.mobile.noSymbols'))
              : ListView.builder(
                  itemCount: list.length,
                  itemBuilder: (context, i) {
                    final s = list[i];
                    return KPressable(
                      pressedScale: 1,
                      onTap: () {
                        Navigator.of(context).pop();
                        if (widget.onPick != null) {
                          widget.onPick!(s.symbol);
                        } else {
                          ref.read(workspaceProvider.notifier).update((w) => w.copyWith(symbol: s.symbol));
                        }
                      },
                      child: Container(
                        height: 50,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 34,
                              child: Align(alignment: AlignmentDirectional.centerStart, child: SymbolAvatar(s.symbol)),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    s.symbol,
                                    style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                                  ),
                                  Text(
                                    s.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: context.text.footnote.copyWith(color: k.fg3, fontSize: 11.5),
                                  ),
                                ],
                              ),
                            ),
                            Text(segmentLabel(t, s.assetClass), style: context.text.caption.copyWith(color: k.fg3)),
                            KIconButton(
                              icon: ws.favourites.contains(s.symbol) ? Icons.star_rounded : Icons.star_outline_rounded,
                              size: 34,
                              color: ws.favourites.contains(s.symbol) ? k.gold : k.fg3,
                              semanticLabel: t('market.segment.favourites'),
                              onPressed: () => ref.read(workspaceProvider.notifier).toggleFavourite(s.symbol),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
