// Kalks Trader, full screen (its own route above the Client Area; back returns to it). PLACEHOLDER for the terminal
// agent: the frame is final (terminal theme, header: back · CFD|Options · account pill · bell; bottom bar Watchlist ·
// Chart · Trade · History · Account, Options mode: Markets · Chart · Chain · Trade · Positions), the tab bodies are
// not. Build them from apps/terminal (components/mobile/mobile-terminal.tsx and the options components) 1:1, with
// the trade API (lib/core/api, `trade/*`) and the streams in lib/core/realtime (MarketStream, EngineStream,
// OptionsStream). `login` is the account the Trade button was pressed on (null: the default account).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/config/app_config.dart';
import '../../core/notifications/notifications.dart';
import '../../core/theme_controller.dart';
import '../../i18n/i18n.dart';
import '../../shell/menus.dart';
import '../../ui/ui.dart';

class TraderScreen extends ConsumerStatefulWidget {
  const TraderScreen({super.key, this.login});
  final String? login;

  @override
  ConsumerState<TraderScreen> createState() => _TraderScreenState();
}

class _TraderScreenState extends ConsumerState<TraderScreen> {
  String _mode = 'cfd';
  int _tab = 1;

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(traderThemeModeProvider);
    final brand = ref.watch(configProvider).brand;
    final platform = MediaQuery.platformBrightnessOf(context);
    final b = mode == ThemeMode.system ? platform : (mode == ThemeMode.dark ? Brightness.dark : Brightness.light);
    return Theme(
      data: KTheme.trader(b, brand: brand),
      child: Builder(builder: _build),
    );
  }

  Widget _build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final unread = ref.watch(notificationsProvider.select((s) => s.unread));
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final cfdTabs = [
      (LucideIcons.list, t('trader.mobile.tab.watch')),
      (LucideIcons.candlestickChart, t('trader.mobile.tab.chart')),
      (LucideIcons.arrowLeftRight, t('trader.mobile.tab.trade')),
      (LucideIcons.history, t('trader.mobile.tab.history')),
      (LucideIcons.userRound, t('trader.mobile.tab.account')),
    ];
    final mq = MediaQuery.of(context);
    return Scaffold(
      backgroundColor: k.bg,
      body: Stack(
        children: [
          const Positioned.fill(child: KBackdrop()),
          Column(
            children: [
              KFrosted(
                color: k.bar,
                border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
                child: SafeArea(
                  bottom: false,
                  child: SizedBox(
                    height: 56,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Row(
                        children: [
                          KIconButton(
                            icon: rtl ? LucideIcons.chevronRight : LucideIcons.chevronLeft,
                            semanticLabel: t('common.back'),
                            onPressed: () => context.canPop() ? context.pop() : context.go('/'),
                          ),
                          SizedBox(
                            width: 150,
                            child: KSegmented<String>(
                              height: 34,
                              values: const ['cfd', 'options'],
                              labels: [t('trader.opt.mode.cfd'), t('trader.opt.mode.options')],
                              selected: _mode,
                              onChanged: (v) => setState(() => _mode = v),
                            ),
                          ),
                          const Spacer(),
                          Container(
                            height: 34,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: k.surface2,
                              borderRadius: BorderRadius.circular(17),
                              border: Border.all(color: k.line),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              widget.login == null ? t('shell.kalksTrader') : '#${widget.login}',
                              textDirection: widget.login == null ? null : TextDirection.ltr,
                              style: widget.login == null
                                  ? context.text.label.copyWith(fontWeight: FontWeight.w600)
                                  : context.text.mono(12.5, weight: FontWeight.w600),
                            ),
                          ),
                          KIconButton(
                            icon: LucideIcons.bell,
                            badge: unread,
                            semanticLabel: t('dashboard.notifications.title'),
                            onPressed: () => showBellSheet(context),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: KEmptyState(icon: cfdTabs[_tab].$1, title: '${t('shell.kalksTrader')} · ${cfdTabs[_tab].$2}', text: t('app.trader.placeholder')),
                  ),
                ),
              ),
              KFrosted(
                color: k.bar,
                border: Border(top: BorderSide(color: k.line, width: 0.6)),
                child: Padding(
                  padding: EdgeInsets.only(bottom: mq.padding.bottom),
                  child: SizedBox(
                    height: 56,
                    child: Row(
                      children: [
                        for (var i = 0; i < cfdTabs.length; i++)
                          Expanded(
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () {
                                KHaptics.selection();
                                setState(() => _tab = i);
                              },
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(cfdTabs[i].$1, size: 21, color: i == _tab ? k.ember : k.fg3),
                                  const SizedBox(height: 3),
                                  Text(
                                    cfdTabs[i].$2,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: context.text.micro.copyWith(color: i == _tab ? k.ember : k.fg3),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
