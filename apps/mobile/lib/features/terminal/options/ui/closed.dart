// Positions › Closed and › Settled (web: components/options/closed-tab.tsx ClosedList, settlements-tab.tsx, the share
// button of components/share/option-share.tsx).
// Closed: every exit deal of an option position in plain words ("Bought at $16.25 · sold at $14.10" per contract,
// "Settled at 1.1712 → you received $120.00" for an expiry), the net P&L (commission included) and its % of the
// premium, why it closed, when, and Share (a public card at <app>/s/<code> created by `growth/shares`, shared through
// the phone's share sheet).
// Settled: how expired options settled (received / paid / expired worthless), the position's P&L, the run (a re-fix is
// run 2+, a reversed run is struck through and left out of the totals).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/api/api_providers.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/notifications/notifications.dart';
import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/terminal_controller.dart';
import '../../core/trade_math.dart';
import '../core/data.dart';
import '../core/errors.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/pricer.dart';
import 'actions.dart';
import 'bits.dart';

/// "Settled at 1.1712 → you received $120.00" (amounts in USD).
String settledText(T t, {required double? fixing, required double payout, required String side, required int digits}) {
  if (fixing == null || !fixing.isFinite) return t('trader.opt.set.pending');
  final price = px(fixing, digits);
  if (payout > 0.004) return t('trader.opt.set.received', iso({'price': price, 'amount': money(payout)}));
  if (payout < -0.004) return t('trader.opt.set.paid', iso({'price': price, 'amount': money(-payout)}));
  return side == 'sell' ? t('trader.opt.set.kept', iso({'price': price})) : t('trader.opt.set.worthless', iso({'price': price}));
}

/// The closed trade in one plain sentence.
String closedText(T t, OptClosed o) {
  final open = o.usdPerUnit > 0 ? money(o.openPrice * o.usdPerUnit) : '—';
  final close = o.usdPerUnit > 0 ? money(o.closePrice * o.usdPerUnit) : '—';
  if (o.reason == OptCloseReason.expired) {
    final k = o.side == 'buy' ? 1 : -1;
    final payout = o.usdPerUnit > 0 ? k * o.closePrice * o.usdPerUnit * o.contracts : 0.0;
    return settledText(t, fixing: o.fixing, payout: payout, side: o.side, digits: digitsOf(o.option.underlying));
  }
  if (o.reason == OptCloseReason.bust) return t('trader.opt.hist.closedBust', iso({'close': close}));
  if (o.reason == OptCloseReason.liquidation && o.fillKind == 'backstop') return t('trader.opt.hist.closedBackstop', iso({'close': close}));
  if (o.reason == OptCloseReason.liquidation || o.reason == OptCloseReason.stopOut) return t('trader.opt.hist.closedRisk', iso({'close': close}));
  return o.side == 'buy'
      ? t('trader.opt.hist.boughtSold', iso({'open': open, 'close': close}))
      : t('trader.opt.hist.soldBought', iso({'open': open, 'close': close}));
}

class _Reason extends StatelessWidget {
  const _Reason(this.o);
  final OptClosed o;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final (Color bg, Color fg) = switch (o.reason) {
      OptCloseReason.closed => (k.surface3, k.fg2),
      OptCloseReason.expired => (k.infoSoft, k.info),
      OptCloseReason.knockedOut || OptCloseReason.bust => (k.warnSoft, k.warn),
      OptCloseReason.stopOut || OptCloseReason.liquidation || OptCloseReason.sl => (k.downSoft, k.down),
      OptCloseReason.tp => (k.upSoft, k.up),
      OptCloseReason.dealer => (k.goldSoft, k.gold),
      OptCloseReason.other => (k.surface3, k.fg3),
    };
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(5)),
      child: Text(
        context.t.dyn('trader.opt.hist.reason.${o.reason.key}', fallback: o.rawReason.isNotEmpty ? o.rawReason : o.reason.key),
        style: context.text.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}

class _SmallChip extends StatelessWidget {
  const _SmallChip({required this.text, required this.up});
  final String text;
  final bool up;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(color: up ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(4)),
      child: Text(
        text,
        style: context.text.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w600, color: up ? k.up : k.down),
      ),
    );
  }
}

class ClosedList extends ConsumerWidget {
  const ClosedList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final rows = ref.watch(optClosedProvider);
    final loading = ref.watch(optHistoryProvider).isLoading;
    if (rows.isEmpty) {
      if (loading) return const OptSkeletonList(count: 4, height: 72);
      return _Empty(icon: LucideIcons.history, title: t('trader.opt.hist.empty'), text: t('trader.opt.hist.emptySub'));
    }
    return RefreshIndicator(
      onRefresh: () async => ref.refresh(optHistoryProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(8),
        children: [
          for (final o in rows.take(200))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _ClosedRow(o: o),
            ),
        ],
      ),
    );
  }
}

class _ClosedRow extends ConsumerWidget {
  const _ClosedRow({required this.o});
  final OptClosed o;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final u = o.option.underlying;
    final basis = o.usdPerUnit > 0 ? o.openPrice * o.usdPerUnit * o.contracts : 0.0;
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    final login = ref.watch(terminalProvider.select((s) => s.login));
    // share cards switched off by the broker (flag trade_sharing)
    final sharing = ref.watch(configProvider.select((c) => c.flag('trade_sharing', fallback: true)));
    final closeAt = DateTime.tryParse(o.closeTime);
    final small = context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400);
    return OptCard(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OptAvatar(u, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 3,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(u, style: context.text.label.copyWith(fontSize: 12.5, fontWeight: FontWeight.w600)),
                        _SmallChip(text: o.option.right == 'call' ? t('trader.opt.call') : t('trader.opt.put'), up: o.option.right == 'call'),
                        Text(
                          strikeOf(o.option.series, o.option.strike, digitsOf(u)),
                          textDirection: TextDirection.ltr,
                          style: context.text.mono(12, weight: FontWeight.w600),
                        ),
                        _SmallChip(
                          text: '${o.side == 'buy' ? t('trader.opt.pos.bought') : t('trader.opt.pos.sold')} ×${qty(o.contracts)}',
                          up: o.side == 'buy',
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text('${o.option.expiry.isNotEmpty ? expiryLabel(o.option.expiry, t.locale) : ''} · #${o.ticket}', style: small),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _MoneyPnl(o.profit, size: 13.5),
                  if (basis > 0)
                    Text(
                      pctSigned(o.profit / basis),
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(10.5, color: o.profit > 0 ? k.up : (o.profit < 0 ? k.down : k.fg3)),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: closedText(t, o)),
                if (o.commission > 0)
                  TextSpan(
                    text: ' · ${t('trader.opt.hist.fee', iso({'amount': money(o.commission)}))}',
                    style: TextStyle(color: k.fg3),
                  ),
              ],
            ),
            style: context.text.caption.copyWith(fontSize: 12, color: k.fg2, fontWeight: FontWeight.w400, height: 1.4),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _Reason(o),
              const SizedBox(width: 8),
              Text(closeAt != null ? fmtServer(closeAt, seconds: false) : '—', style: context.text.mono(10.5, color: k.fg3)),
              const Spacer(),
              if (!readOnly && sharing && login != null && int.tryParse(o.deal) != null)
                KIconButton(icon: LucideIcons.share2, size: 32, semanticLabel: t('trader.opt.share.aria'), onPressed: () => showOptionShare(context, o, login)),
            ],
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.text});
  final IconData icon;
  final String title, text;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: k.surface2,
                  border: Border.all(color: k.line),
                ),
                child: Icon(icon, size: 16, color: k.fg3),
              ),
              const SizedBox(height: 10),
              Text(
                title,
                textAlign: TextAlign.center,
                style: context.text.label.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                text,
                textAlign: TextAlign.center,
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/* ---------------- share ---------------- */

/// "EURUSD 1.1650 Call": the strike as the series code writes it.
String contractLabel(OptClosed o, String call, String put) {
  final m = RegExp(r'^[A-Za-z0-9]+-\d{8}-(\d+(?:\.\d+)?)-[CPcp]$').firstMatch(o.option.series);
  final strike = m != null ? m[1]! : strikeText(o.option.strike, 6);
  return '${o.option.underlying} $strike ${o.option.right == 'put' ? put : call}'.replaceAll(RegExp(r'\s+'), ' ').trim();
}

Future<void> showOptionShare(BuildContext context, OptClosed o, String login) {
  final t = context.t;
  return showKSheet<void>(
    context,
    title: t('trader.opt.share.title', {'contract': contractLabel(o, t('trader.opt.call'), t('trader.opt.put'))}),
    builder: (_) => _ShareBody(o: o, login: login),
  );
}

class _ShareBody extends ConsumerStatefulWidget {
  const _ShareBody({required this.o, required this.login});
  final OptClosed o;
  final String login;

  @override
  ConsumerState<_ShareBody> createState() => _ShareBodyState();
}

class _ShareBodyState extends ConsumerState<_ShareBody> {
  bool _showAmounts = false;
  bool _busy = false;
  String? _code;

  Future<void> _create() async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      final r = await ref
          .read(apiProvider)
          .post<Map<String, dynamic>>(
            'growth/shares',
            body: {'kind': 'trade', 'login': int.tryParse(widget.login) ?? widget.login, 'dealId': int.tryParse(widget.o.deal), 'showAmounts': _showAmounts},
          );
      final share = r['share'] is Map ? (r['share'] as Map).cast<String, dynamic>() : null;
      if (!mounted) return;
      setState(() => _code = share == null ? null : '${share['code']}');
      if (share == null) optToast(ref, NotificationKind.error, t('trader.opt.share.error'));
    } on ApiException catch (e) {
      if (!mounted) return;
      optToast(ref, NotificationKind.error, t('trader.opt.share.error'), description: e.message.isNotEmpty ? e.message : null);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _open(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      // nothing to open it with: the link stays in the sheet
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final code = _code;
    if (code == null) {
      return KSheetContent(
        footer: Row(
          children: [
            Expanded(
              child: KButton(label: t('common.cancel'), variant: KButtonVariant.ghost, onPressed: () => Navigator.of(context).pop()),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: KButton(
                label: t('trader.opt.share.create'),
                icon: LucideIcons.share2,
                loading: _busy,
                expand: true,
                onPressed: () => unawaited(_create()),
              ),
            ),
          ],
        ),
        children: [
          Text(t('trader.opt.share.description'), style: context.text.footnote.copyWith(color: k.fg3)),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                      Text(t('trader.opt.share.showAmounts'), style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(
                        _showAmounts ? t('trader.opt.share.amountsOn') : t('trader.opt.share.amountsOff'),
                        style: context.text.footnote.copyWith(color: k.fg3),
                      ),
                    ],
                  ),
                ),
                KSwitch(value: _showAmounts, semanticLabel: t('trader.opt.share.showAmounts'), onChanged: (v) => setState(() => _showAmounts = v)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(t('trader.opt.share.privacy'), style: context.text.footnote.copyWith(color: k.fg3, height: 1.5)),
        ],
      );
    }
    final base = ref.watch(configProvider).appUrl.replaceAll(RegExp(r'/+$'), '');
    final url = '$base/s/$code';
    final text = t('trader.opt.share.text', {'contract': contractLabel(widget.o, t('trader.opt.call'), t('trader.opt.put'))});
    return KSheetContent(
      footer: Row(
        children: [
          Expanded(
            child: KButton(label: t('trader.opt.share.changeOptions'), variant: KButtonVariant.ghost, onPressed: () => setState(() => _code = null)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: KButton(
              label: t('trader.opt.share.shareTo'),
              icon: LucideIcons.share2,
              expand: true,
              onPressed: () => unawaited(SharePlus.instance.share(ShareParams(text: '$text $url', subject: text))),
            ),
          ),
        ],
      ),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: AspectRatio(
            aspectRatio: 1200 / 630,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: k.surface2,
                border: Border.all(color: k.line),
              ),
              child: Image.network(
                '$base/s/$code/image',
                fit: BoxFit.cover,
                semanticLabel: t('trader.opt.share.preview'),
                loadingBuilder: (context, child, p) => p == null ? child : const KSkeleton(radius: 0),
                errorBuilder: (context, _, _) => Center(child: Icon(LucideIcons.image, color: k.fg3)),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 4, 4, 4),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: k.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  url.replaceFirst(RegExp('^https?://'), ''),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(12.5),
                ),
              ),
              KIconButton(
                icon: LucideIcons.copy,
                size: 34,
                semanticLabel: t('trader.opt.share.copy'),
                onPressed: () async {
                  await kCopy(context, url);
                },
              ),
              KIconButton(icon: LucideIcons.externalLink, size: 34, semanticLabel: t('trader.opt.share.open'), onPressed: () => unawaited(_open(url))),
              KIconButton(
                icon: LucideIcons.download,
                size: 34,
                semanticLabel: t('trader.opt.share.download'),
                onPressed: () => unawaited(_open('$base/s/$code/image?download=1')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/* ---------------- settlements ---------------- */

class SettlementsList extends ConsumerWidget {
  const SettlementsList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final v = ref.watch(optSettlementsProvider);
    final err = v.error;
    if (err is ApiException && isLaunchingSoon(err)) {
      return OptionsUnavailable(soon: true, compact: true, onRetry: () => ref.invalidate(optSettlementsProvider));
    }
    final items = v.value;
    final live = (items ?? const <Settlement>[]).where((x) => !x.reversed).toList();
    final total = live.fold<double>(0, (s, x) => s + x.payout);
    final pnl = live.any((x) => x.profit != null) ? live.fold<double>(0, (s, x) => s + (x.profit ?? 0)) : null;
    final small = context.text.caption.copyWith(fontSize: 11.5, color: k.fg3, fontWeight: FontWeight.w400);
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 10,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(t('trader.opt.set.twapShort'), maxLines: 1, overflow: TextOverflow.ellipsis, style: small),
                        ),
                        const Explain('expiry', size: 11),
                      ],
                    ),
                    if (live.isNotEmpty) ...[
                      Text(t('trader.opt.set.summary', {'count': live.length}), style: small),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('${t('trader.opt.set.payout')} ', style: small),
                          Text(
                            moneySigned(total),
                            style: context.text.mono(11.5, weight: FontWeight.w600, color: total > 0.004 ? k.up : (total < -0.004 ? k.down : k.fg2)),
                          ),
                        ],
                      ),
                      if (pnl != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('${t('trader.opt.col.pnl')} ', style: small),
                            Text(
                              moneySigned(pnl),
                              style: context.text.mono(11.5, weight: FontWeight.w600, color: pnl > 0.004 ? k.up : (pnl < -0.004 ? k.down : k.fg2)),
                            ),
                          ],
                        ),
                    ],
                  ],
                ),
              ),
              KIconButton(
                icon: LucideIcons.refreshCw,
                size: 32,
                semanticLabel: t('trader.opt.set.refresh'),
                onPressed: () => ref.invalidate(optSettlementsProvider),
              ),
            ],
          ),
        ),
        Expanded(
          child: items == null
              ? (err != null
                    ? Padding(
                        padding: const EdgeInsets.all(10),
                        child: ErrorNote(code: err is ApiException ? optCode(err) : 'unavailable', message: err is ApiException ? err.message : null),
                      )
                    : const OptSkeletonList(count: 3, height: 58))
              : items.isEmpty
              ? _Empty(icon: LucideIcons.calendarCheck2, title: t('trader.opt.set.empty'), text: t('trader.opt.set.emptyHint'))
              : ListView(
                  padding: const EdgeInsets.all(8),
                  children: [
                    for (final x in items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: _SettlementRow(x: x),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _SettlementRow extends StatelessWidget {
  const _SettlementRow({required this.x});
  final Settlement x;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = parseSeriesCode(x.series);
    final digits = s == null ? 5 : (optionSpecs[s.underlying]?.digits ?? 5);
    final tone = x.payout > 0.004 ? 1 : (x.payout < -0.004 ? -1 : 0);
    final toneColor = tone > 0 ? k.up : (tone < 0 ? k.down : k.fg3);
    final at = DateTime.tryParse(x.at);
    return Opacity(
      opacity: x.reversed ? 0.55 : 1,
      child: OptCard(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: tone > 0 ? k.upSoft : (tone < 0 ? k.downSoft : k.surface3)),
                  child: Icon(LucideIcons.calendarCheck2, size: 16, color: toneColor),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 3,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (s != null) OptAvatar(s.underlying, size: 14),
                          Text(s?.underlying ?? x.series, style: context.text.label.copyWith(fontSize: 12.5, fontWeight: FontWeight.w600)),
                          if (s != null) ...[
                            _SmallChip(text: s.right == 'call' ? t('trader.opt.call') : t('trader.opt.put'), up: s.right == 'call'),
                            Text(
                              s.strikeLabel,
                              textDirection: TextDirection.ltr,
                              style: context.text.mono(12, weight: FontWeight.w600),
                            ),
                          ],
                          _SmallChip(
                            text: '${x.side == 'buy' ? t('trader.opt.pos.bought') : t('trader.opt.pos.sold')} ×${qty(x.contracts)}',
                            up: x.side == 'buy',
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${s != null ? expiryLabel(s.date, t.locale) : ''} · #${x.ticket}',
                        style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
                if (x.profit != null)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(t('trader.opt.col.pnl').toUpperCase(), style: context.text.micro.copyWith(fontSize: 9.5, color: k.fg3)),
                      _MoneyPnl(x.profit!),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              settledText(t, fixing: x.fixing, payout: x.payout, side: x.side, digits: digits),
              style: context.text.caption.copyWith(
                fontSize: 12.5,
                fontWeight: FontWeight.w400,
                color: x.reversed ? k.fg3 : (tone == 0 ? k.fg2 : toneColor),
                decoration: x.reversed ? TextDecoration.lineThrough : null,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                if (x.reversed)
                  _Tag(text: t('trader.opt.set.reversed'), bg: k.surface3, fg: k.fg3)
                else if (x.run > 1)
                  _Tag(text: t('trader.opt.set.rerun', {'n': x.run}), bg: k.warnSoft, fg: k.warn),
                const Spacer(),
                Text(at != null ? fmtServer(at, seconds: false) : '—', style: context.text.mono(10.5, color: k.fg3)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// "+$12.30" in green / red.
class _MoneyPnl extends StatelessWidget {
  const _MoneyPnl(this.v, {this.size = 13});
  final double v;
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Text(
      moneySigned(v),
      textDirection: TextDirection.ltr,
      style: context.text.mono(size, weight: FontWeight.w600, color: v > 0.004 ? k.up : (v < -0.004 ? k.down : k.fg2)),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.text, required this.bg, required this.fg});
  final String text;
  final Color bg, fg;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
    child: Text(
      text,
      style: context.text.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w600, color: fg),
    ),
  );
}
