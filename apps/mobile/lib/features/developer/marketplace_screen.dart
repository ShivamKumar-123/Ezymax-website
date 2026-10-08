// API & Algo › Marketplace (/developer/marketplace): port of apps/crm/components/algo/marketplace-page.tsx
// (LiveMarketplacePage, D83). Header (Publish a strategy) · Browse / My subscriptions / My listings. Browse: search,
// price and sort filters, listing cards, disclaimer. Listing sheet: track record, house backtest, risk settings,
// subscribe (copy onto an account or clone; one idempotency key per attempt), subscription, reviews. Publish sheet.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'developer_api.dart';
import 'widgets/algo_widgets.dart';

/// An idempotency key for one subscribe attempt (32 hex characters).
String _attemptKey() {
  final r = math.Random.secure();
  return List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
}

/// Whether a failed subscribe attempt is over: the service refused it (a 4xx, except a setup still in progress). No
/// answer, a timeout or a server error may have gone through: a retry sends the same key.
bool _attemptOver(Object e) => e is ApiException && e.status >= 400 && e.status < 500 && e.status != 408 && e.status != 429 && e.code != 'in_progress';

String _acctType(T t, String type) => t.dyn('developer.acctType.$type', fallback: type);

class DeveloperMarketplaceScreen extends ConsumerStatefulWidget {
  const DeveloperMarketplaceScreen({super.key});

  @override
  ConsumerState<DeveloperMarketplaceScreen> createState() => _DeveloperMarketplaceScreenState();
}

class _DeveloperMarketplaceScreenState extends ConsumerState<DeveloperMarketplaceScreen> {
  String _q = '';
  String _price = '';
  String _sort = 'updated';
  String _tab = 'browse';
  Timer? _debounce;

  ({String q, String price, String sort}) get _filter => (q: _q, price: _price, sort: _sort);

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _changed() {
    ref
      ..invalidate(listingsProvider)
      ..invalidate(marketSubsProvider)
      ..invalidate(marketMineProvider);
  }

  Future<void> _open(int id) async {
    await showKSheet<void>(
      context,
      expand: true,
      builder: (_) => _ListingSheet(id: id, onChanged: _changed),
    );
  }

  Future<void> _publish() async {
    final ok = await showKSheet<bool>(context, title: context.t('developer.market.publish'), builder: (_) => const _PublishSheet());
    if (ok == true && mounted) {
      setState(() => _tab = 'mine');
      ref.invalidate(marketMineProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final browse = ref.watch(listingsProvider(_filter));
    final count = browse.value?.items.length;
    return KPageScroll(
      onRefresh: () async {
        _changed();
        await ref.read(listingsProvider(_filter).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('developer.market.title'), subtitle: Text(t('developer.market.subtitle'))),
        if (!readOnly) ...[
          const SizedBox(height: 14),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KButton(label: t('developer.market.publish'), icon: LucideIcons.upload, onPressed: _publish),
          ),
        ],
        const SizedBox(height: 20),
        KSegmented<String>(
          values: const ['browse', 'subs', 'mine'],
          labels: ['${t('developer.market.browse')}${count != null ? ' $count' : ''}', t('developer.market.mySubs'), t('developer.market.myListings')],
          selected: _tab,
          onChanged: (v) => setState(() => _tab = v),
        ),
        const SizedBox(height: 16),
        if (_tab == 'browse') ..._browse(context, browse),
        if (_tab == 'subs') _subs(context),
        if (_tab == 'mine') ..._mine(context, readOnly),
      ],
    );
  }

  List<Widget> _browse(BuildContext context, AsyncValue<ListingsPage> browse) {
    final t = context.t;
    final k = context.k;
    return [
      KSearchField(
        placeholder: t('developer.market.searchPlaceholder'),
        initial: _q,
        onChanged: (v) {
          _debounce?.cancel();
          _debounce = Timer(const Duration(milliseconds: 300), () {
            if (mounted) setState(() => _q = v.trim());
          });
        },
      ),
      const SizedBox(height: 10),
      KSegmented<String>(
        values: const ['all', 'free', 'paid'],
        labels: [t('common.all'), t('developer.market.free'), t('developer.market.paid')],
        selected: _price.isEmpty ? 'all' : _price,
        plain: true,
        height: 34,
        onChanged: (v) => setState(() => _price = v == 'all' ? '' : v),
      ),
      const SizedBox(height: 8),
      KSegmented<String>(
        values: const ['updated', 'rating', 'subscribers'],
        labels: [t('developer.market.newest'), t('developer.market.topRated'), t('developer.market.popular')],
        selected: _sort,
        plain: true,
        height: 34,
        onChanged: (v) => setState(() => _sort = v),
      ),
      const SizedBox(height: 14),
      KAsync(
        value: browse,
        onRetry: () => ref.invalidate(listingsProvider(_filter)),
        loading: const Column(children: [KSkeletonCard(height: 240), SizedBox(height: 12), KSkeletonCard(height: 240)]),
        builder: (d) => d.items.isEmpty
            ? KCard(
                child: KEmptyState(icon: LucideIcons.store, title: t('developer.market.emptyTitle'), text: t('developer.market.emptyText')),
              )
            : Column(
                children: [
                  for (final l in d.items) ...[
                    _ListingCard(l: l, subscribed: d.subscribed.contains(l.id), onOpen: () => _open(l.id)),
                    const SizedBox(height: 12),
                  ],
                ],
              ),
      ),
      const SizedBox(height: 4),
      Text(
        t('developer.market.disclaimer', {'pct': browse.value?.platformCutPct ?? 20}),
        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
      ),
    ];
  }

  Widget _subs(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final subs = ref.watch(marketSubsProvider);
    return KCard(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.store, title: t('developer.market.mySubs')),
          const SizedBox(height: 8),
          KAsync(
            value: subs,
            onRetry: () => ref.invalidate(marketSubsProvider),
            loading: KSkeleton.lines(3),
            error: (e) => KLoadError(error: e, card: false, onRetry: () => ref.invalidate(marketSubsProvider)),
            builder: (items) => items.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    child: Text(
                      t('developer.market.noSubs'),
                      textAlign: TextAlign.center,
                      style: context.text.footnote.copyWith(color: k.fg3),
                    ),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < items.length; i++) ...[
                        if (i > 0) const KDivider(),
                        Builder(
                          builder: (context) {
                            final s = items[i];
                            return KPressable(
                              pressedScale: 0.99,
                              onTap: () => _open(s.listingId),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 11),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            s.title,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: context.text.headline.copyWith(fontSize: 14),
                                          ),
                                        ),
                                        KChip(
                                          label: t.dyn('developer.subStatus.${s.status}', fallback: s.status),
                                          tone: s.status == 'active' ? KChipTone.up : KChipTone.neutral,
                                          small: true,
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      '${s.symbol} ${s.timeframe} · ${t('developer.market.by', {'author': s.author})}',
                                      style: context.text.mono(11, color: k.fg3),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      [
                                        s.mode == 'copy' ? t('developer.market.copyOn', {'login': s.login ?? ''}) : t('developer.market.clone'),
                                        if (s.deploymentStatus != null) t.dyn('developer.depStatus.${s.deploymentStatus}', fallback: s.deploymentStatus),
                                        s.price > 0 ? '${numText(s.price)} USDT' : t('developer.market.free'),
                                        if (s.periodEnd != null)
                                          s.autoRenew
                                              ? '${t('developer.market.renews')} ${fmtDay(s.periodEnd)}'
                                              : t('developer.market.endsLower', {'date': fmtDay(s.periodEnd)}),
                                      ].join(' · '),
                                      style: context.text.footnote.copyWith(color: k.fg2),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  List<Widget> _mine(BuildContext context, bool readOnly) {
    final t = context.t;
    final k = context.k;
    final mine = ref.watch(marketMineProvider);
    final d = mine.value;
    return [
      TileGrid(
        columns: 3,
        children: [
          MiniTile(label: t('developer.market.earned'), value: '${(d?.earned ?? 0).toStringAsFixed(2)} USDT'),
          MiniTile(label: t('developer.market.platformFees'), value: '${(d?.platformFees ?? 0).toStringAsFixed(2)} USDT'),
          MiniTile(label: t('developer.market.payments'), value: '${d?.payments ?? 0}'),
        ],
      ),
      const SizedBox(height: 14),
      KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KCardHeader(
              title: t('developer.market.myListings'),
              action: readOnly
                  ? null
                  : KButton(
                      label: t('developer.market.publishShort'),
                      icon: LucideIcons.plus,
                      variant: KButtonVariant.surface,
                      size: KButtonSize.sm,
                      onPressed: _publish,
                    ),
            ),
            const SizedBox(height: 10),
            KAsync(
              value: mine,
              onRetry: () => ref.invalidate(marketMineProvider),
              loading: KSkeleton.lines(3),
              error: (e) => KLoadError(error: e, card: false, onRetry: () => ref.invalidate(marketMineProvider)),
              builder: (m) => m.items.isEmpty
                  ? Text(t('developer.market.noListings'), style: context.text.footnote.copyWith(color: k.fg3))
                  : Column(
                      children: [
                        for (final l in m.items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: KPressable(
                              pressedScale: 0.99,
                              onTap: () => _open(l.id),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: k.line),
                                ),
                                child: Row(
                                  children: [
                                    SymbolAvatar(l.symbol, size: 22),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            l.title,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: context.text.callout.copyWith(color: k.fg),
                                          ),
                                          Text(
                                            '${t('developer.market.subscribers', {'count': l.subscribers})} · ${l.priceMonthly > 0 ? t('developer.market.pricePerMonth', {'price': l.price}) : t('developer.market.freeLower')}${l.moderationNote != null ? ' · ${t('developer.market.moderator', {'note': l.moderationNote})}' : ''}',
                                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    KChip(
                                      label: t.dyn('developer.listingStatus.${l.status}', fallback: l.status),
                                      tone: l.status == 'approved' ? KChipTone.up : (l.status == 'pending' ? KChipTone.warn : KChipTone.down),
                                      small: true,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    ];
  }
}

class Stars extends StatelessWidget {
  const Stars(this.v, {super.key, this.size = 13});
  final double v;
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [for (var i = 1; i <= 5; i++) Icon(Icons.star_rounded, size: size, color: i <= v.round() ? k.gold : k.fg3.withValues(alpha: 0.35))],
    );
  }
}

class _HouseChip extends StatelessWidget {
  const _HouseChip();

  @override
  Widget build(BuildContext context) => KChip(label: context.t('developer.market.houseChip'), tone: KChipTone.info, icon: LucideIcons.building2, small: true);
}

class _ListingCard extends StatelessWidget {
  const _ListingCard({required this.l, required this.subscribed, required this.onOpen});
  final Listing l;
  final bool subscribed;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final up = l.track.returnPct >= 0;
    return KCard(
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SymbolAvatar(l.symbol, size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.headline),
                    const SizedBox(height: 2),
                    Text(
                      '${t('developer.market.by', {'author': l.author})} · ${l.symbol} ${l.timeframe}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                    if (l.house) ...[const SizedBox(height: 6), const _HouseChip()],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              KChip(
                label: l.priceMonthly > 0 ? t('developer.market.pricePerMo', {'price': l.price}) : t('developer.market.free'),
                tone: l.priceMonthly > 0 ? KChipTone.gold : KChipTone.up,
                small: true,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fmtPct(l.track.returnPct, 2),
                      textDirection: TextDirection.ltr,
                      style: context.text.moneyL.copyWith(fontSize: 24, color: up ? k.up : k.down),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      t('developer.market.verifiedDays', {'type': _acctType(t, l.track.accountType), 'days': l.track.days.toStringAsFixed(1)}),
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                  ],
                ),
              ),
              if (l.track.sparkline.length > 1) KSparkline(l.track.sparkline, width: 110, height: 36, color: up ? k.gold : k.down),
            ],
          ),
          const SizedBox(height: 12),
          TileGrid(
            columns: 3,
            gap: 6,
            children: [
              MiniTile(label: t('developer.dep.winRate'), value: '${l.track.winRate.toStringAsFixed(1)}%'),
              MiniTile(label: t('developer.market.maxDd'), value: '${l.track.maxDrawdownPct.toStringAsFixed(1)}%', color: k.down),
              MiniTile(label: t('developer.market.trades'), value: '${l.track.trades}'),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Stars(l.rating),
              const SizedBox(width: 4),
              Text('(${l.ratings})', style: context.text.caption.copyWith(color: k.fg3)),
              const SizedBox(width: 12),
              Icon(LucideIcons.users, size: 14, color: k.fg3),
              const SizedBox(width: 4),
              Text('${l.subscribers}', style: context.text.caption.copyWith(color: k.fg3)),
              const Spacer(),
              if (subscribed) KChip(label: t('developer.market.subscribed'), tone: KChipTone.ember, small: true),
            ],
          ),
        ],
      ),
    );
  }
}

/// A listing's detail (web ListingDialog, a right-side drawer): a tall sheet on phones.
class _ListingSheet extends ConsumerStatefulWidget {
  const _ListingSheet({required this.id, required this.onChanged});
  final int id;
  final VoidCallback onChanged;

  @override
  ConsumerState<_ListingSheet> createState() => _ListingSheetState();
}

class _ListingSheetState extends ConsumerState<_ListingSheet> {
  String _mode = 'copy';
  int? _login;
  double _mult = 1;
  bool _busy = false;
  int _rating = 5;
  final _comment = TextEditingController();
  bool _inFlight = false;
  String? _attempt;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _subscribe(ListingDetail l) async {
    if (_inFlight) return;
    final t = context.t;
    _inFlight = true;
    _attempt ??= _attemptKey();
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).algoPost('market/listings/${l.id}/subscribe', {
        'mode': _mode,
        if (_mode == 'copy') 'login': _login,
        if (_mult != 1) 'risk': {'lotMultiplier': _mult},
        'idempotencyKey': _attempt,
      });
      _attempt = null;
      final charged = jD(r['charged']);
      algoOk(
        ref,
        _mode == 'copy' ? t('developer.market.copyingToast', {'title': l.title, 'login': _login ?? ''}) : t('developer.market.clonedToast', {'title': l.title}),
        description: charged > 0 ? t('developer.market.charged', {'amount': numText(charged)}) : t('developer.market.freeSubscription'),
      );
      ref.invalidate(listingDetailProvider(widget.id));
      widget.onChanged();
    } on Object catch (e) {
      if (_attemptOver(e)) _attempt = null;
      algoFail(ref, t, t('developer.market.subscribeFailed'), e);
      // the listing shows a subscription that went through meanwhile
      ref.invalidate(listingDetailProvider(widget.id));
    } finally {
      _inFlight = false;
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(ListingSub s) async {
    final t = context.t;
    try {
      final r = await ref.read(apiProvider).algoPost('market/subscriptions/${s.id}/cancel');
      final st = jS(r['status']);
      algoOk(ref, t('developer.market.subscriptionStatus', {'status': t.dyn('developer.subStatus.$st', fallback: st)}));
      ref.invalidate(listingDetailProvider(widget.id));
      widget.onChanged();
    } on Object catch (e) {
      algoFail(ref, t, t('developer.bt.cancelFailed'), e);
    }
  }

  Future<void> _review(ListingDetail l) async {
    final t = context.t;
    try {
      await ref.read(apiProvider).algoPost('market/listings/${l.id}/reviews', {'rating': _rating, 'comment': _comment.text});
      algoOk(ref, t('developer.market.reviewSaved'));
      _comment.clear();
      ref.invalidate(listingDetailProvider(widget.id));
      widget.onChanged();
    } on Object catch (e) {
      algoFail(ref, t, t('developer.market.reviewFailed'), e);
    }
  }

  void _go(String path) {
    Navigator.of(context).pop();
    context.go(path);
  }

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(listingDetailProvider(widget.id));
    final accounts = (ref.watch(algoAccountsProvider).value ?? const <AlgoAccount>[]).where((a) => a.active).toList();
    if (_login == null && accounts.isNotEmpty) _login = (accounts.where((a) => a.type == 'demo').firstOrNull ?? accounts.first).login;
    return KAsync(
      value: d,
      loading: const Padding(padding: EdgeInsets.all(20), child: KSkeleton(height: 380, radius: 18)),
      onRetry: () => ref.invalidate(listingDetailProvider(widget.id)),
      builder: (l) => _body(context, l, accounts),
    );
  }

  Widget _body(BuildContext context, ListingDetail l, List<AlgoAccount> accounts) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final sub = l.subscription;
    final active = sub?.status == 'active';
    final curve = l.track.equity;
    final risk = l.risk;
    String dist(Object? d) {
      final m = jMap(d);
      final mode = jS(m['mode']);
      return mode == 'none' ? t('developer.market.none') : '${numText(jD(m['value']))} ${t.dyn('developer.dist.$mode', fallback: mode)}';
    }

    return KSheetContent(
      children: [
        Text(l.title, style: context.text.title1),
        const SizedBox(height: 2),
        Text('${t('developer.market.by', {'author': l.author})} · ${l.symbol} ${l.timeframe}', style: context.text.footnote.copyWith(color: k.fg3)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            if (l.house) const _HouseChip(),
            KChip(label: t('developer.market.verifiedTrack', {'type': _acctType(t, l.track.accountType)}), tone: KChipTone.up, icon: LucideIcons.badgeCheck),
            KChip(
              label: l.priceMonthly > 0 ? t('developer.market.pricePerMonth', {'price': l.price}) : t('developer.market.free'),
              tone: l.priceMonthly > 0 ? KChipTone.gold : KChipTone.up,
            ),
            if (l.status != 'approved')
              KChip(
                label: t.dyn('developer.listingStatus.${l.status}', fallback: l.status),
                tone: KChipTone.warn,
              ),
          ],
        ),
        const SizedBox(height: 14),
        Text(l.description, style: context.text.callout.copyWith(color: k.fg2)),
        if (l.house) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: k.surface2.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: k.line),
            ),
            child: Text(t('developer.market.houseNote'), style: context.text.footnote.copyWith(color: k.fg2)),
          ),
        ],
        const SizedBox(height: 14),
        TileGrid(
          children: [
            MiniTile(label: t('developer.market.return'), value: fmtPct(l.track.returnPct, 2), color: l.track.returnPct >= 0 ? k.up : k.down, big: true),
            MiniTile(label: t('developer.dep.winRate'), value: '${l.track.winRate.toStringAsFixed(1)}%', big: true),
            MiniTile(label: t('developer.market.maxDd'), value: '${l.track.maxDrawdownPct.toStringAsFixed(2)}%', color: k.down, big: true),
            MiniTile(label: t('developer.market.trades'), value: '${l.track.trades}', big: true),
          ],
        ),
        if (curve.length > 1) ...[
          const SizedBox(height: 14),
          KLineChart(values: [for (final p in curve) p.equity], labels: [for (final p in curve) p.day], height: 150, color: k.gold, format: fmtMoney),
        ],
        const SizedBox(height: 10),
        Text(
          t('developer.market.trackNote', {'since': fmtDay(l.track.since), 'days': l.track.days.toStringAsFixed(1), 'net': fmtMoney(l.track.netProfit)}),
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
        ),
        if (l.house && l.backtest != null) ...[const SizedBox(height: 14), _BacktestBlock(b: l.backtest!)],
        if (risk != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SmallLabel(t('developer.market.riskSettings')),
                const SizedBox(height: 6),
                Text(
                  t('developer.market.riskLine', {
                    'size': jMap(risk['sizing'])['mode'] == 'risk'
                        ? t('developer.market.riskPct', {'pct': numText(jD(jMap(risk['sizing'])['riskPct']))})
                        : t('developer.market.lotSize', {'lots': numText(jD(jMap(risk['sizing'])['lots']))}),
                    'stop': dist(risk['sl']),
                    'target': dist(risk['tp']),
                  }),
                  style: context.text.footnote.copyWith(color: k.fg2),
                ),
                const SizedBox(height: 6),
                if (l.summary != null)
                  for (final e in l.summary!.entries)
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '${e.key} = ',
                            style: TextStyle(color: k.fg3),
                          ),
                          TextSpan(text: e.value),
                        ],
                      ),
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(11.5, color: k.fg2),
                    )
                else
                  Text(
                    t('developer.market.rulesPrivate'),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
              ],
            ),
          ),
        ],
        if (!l.isAuthor && !readOnly) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: k.emberSoft.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.ember.withValues(alpha: 0.3)),
            ),
            child: active
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        '${t('developer.market.subscribed')} · ${sub!.mode == 'copy' ? t('developer.market.copyingOn', {'login': sub.login ?? ''}) : t('developer.market.clonedToStrategies')}',
                        style: context.text.headline.copyWith(fontSize: 14),
                      ),
                      if (sub.periodEnd != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          sub.autoRenew
                              ? t('developer.market.renewsOn', {'date': fmtDay(sub.periodEnd)})
                              : t('developer.market.endsOn', {'date': fmtDay(sub.periodEnd)}),
                          style: context.text.footnote.copyWith(color: k.fg3),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (sub.deploymentId != null)
                            KButton(
                              label: t('developer.market.openDeployment'),
                              variant: KButtonVariant.surface,
                              size: KButtonSize.sm,
                              onPressed: () => _go('/developer/deployments?id=${sub.deploymentId}'),
                            ),
                          if (sub.clonedStrategyId != null)
                            KButton(
                              label: t('developer.market.openStrategy'),
                              variant: KButtonVariant.surface,
                              size: KButtonSize.sm,
                              onPressed: () => _go('/developer/strategies?id=${sub.clonedStrategyId}'),
                            ),
                          if (sub.autoRenew)
                            KButton(
                              label: t('developer.market.cancelSubscription'),
                              variant: KButtonVariant.ghost,
                              size: KButtonSize.sm,
                              onPressed: () => _cancel(sub),
                            ),
                        ],
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      KSegmented<String>(
                        values: ['copy', if (l.allowClone) 'clone'],
                        labels: [t('developer.market.copyToAccount'), if (l.allowClone) t('developer.market.cloneRules')],
                        selected: _mode,
                        plain: true,
                        height: 34,
                        onChanged: (v) => setState(() => _mode = v),
                      ),
                      if (_mode == 'copy') ...[
                        const SizedBox(height: 12),
                        PillChoice<int>(
                          values: [for (final a in accounts) a.login],
                          labels: [for (final a in accounts) '${accountTypeLabel(t, a.type)} #${a.login}'],
                          isSelected: (v) => v == _login,
                          onTap: (v) => setState(() => _login = v),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Text(t('developer.dep.lotMultiplier'), style: context.text.footnote.copyWith(color: k.fg3)),
                            const SizedBox(width: 8),
                            NumField(value: _mult, min: 0.01, suffix: '×', semanticLabel: t('developer.dep.lotMultiplier'), onChanged: (v) => _mult = v),
                          ],
                        ),
                      ],
                      const SizedBox(height: 12),
                      KButton(
                        label: l.priceMonthly > 0 ? t('developer.market.subscribePaid', {'price': l.price}) : t('developer.market.subscribeFree'),
                        expand: true,
                        size: KButtonSize.lg,
                        loading: _busy,
                        onPressed: _mode == 'copy' && _login == null ? null : () => _subscribe(l),
                      ),
                      if (l.priceMonthly > 0) ...[
                        const SizedBox(height: 6),
                        Text(
                          t('developer.market.paidNote'),
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        ),
                      ],
                    ],
                  ),
          ),
        ],
        const SizedBox(height: 18),
        SmallLabel(t('developer.market.reviews', {'n': l.ratings})),
        const SizedBox(height: 8),
        if (sub != null && !l.isAuthor && !readOnly)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    for (var i = 1; i <= 5; i++)
                      KPressable(
                        minSize: 36,
                        semanticLabel: t('developer.market.stars', {'count': i}),
                        onTap: () => setState(() => _rating = i),
                        child: Icon(Icons.star_rounded, size: 22, color: i <= _rating ? k.gold : k.fg3.withValues(alpha: 0.35)),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                CodeField(controller: _comment, mono: false, ltr: false, placeholder: t('developer.market.reviewPlaceholder'), maxLines: 4),
                const SizedBox(height: 8),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: KButton(label: t('developer.market.postReview'), variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: () => _review(l)),
                ),
              ],
            ),
          ),
        for (final r in l.reviews)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 9),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Stars(r.rating),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(r.user, style: context.text.footnote.copyWith(color: k.fg2)),
                    ),
                    Text(fmtDay(r.createdAt), style: context.text.caption.copyWith(color: k.fg3)),
                  ],
                ),
                if (r.comment.isNotEmpty) ...[const SizedBox(height: 4), Text(r.comment, style: context.text.footnote.copyWith(color: k.fg2))],
              ],
            ),
          ),
        if (l.reviews.isEmpty) Text(t('developer.market.noReviews'), style: context.text.footnote.copyWith(color: k.fg3)),
      ],
    );
  }
}

/// A house listing's backtest: simulated on history, never live results.
class _BacktestBlock extends StatelessWidget {
  const _BacktestBlock({required this.b});
  final Map<String, dynamic> b;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = jMap(b['summary']);
    final curve = [for (final p in jList(b['curve'])) jD(p['equity'])];
    final first = jDn(s['firstBar']), last = jDn(s['lastBar']);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: k.warnSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.warn.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              KChip(label: t('developer.market.backtestSimulated'), tone: KChipTone.warn, small: true),
              if (first != null && last != null)
                Text(t('developer.market.range', {'from': fmtDate(first), 'to': fmtDate(last)}), style: context.text.caption.copyWith(color: k.fg3)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${jS(b['label'])}. ${t('developer.market.backtestNote')}',
            style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 8),
          TileGrid(
            gap: 6,
            children: [
              MiniTile(label: t('developer.market.return'), value: jDn(s['returnPct']) != null ? fmtPct(jD(s['returnPct']), 2) : '—'),
              MiniTile(label: t('developer.dep.winRate'), value: jDn(s['winRate']) != null ? '${jD(s['winRate']).toStringAsFixed(1)}%' : '—'),
              MiniTile(label: t('developer.market.maxDd'), value: jDn(s['maxDrawdownPct']) != null ? '${jD(s['maxDrawdownPct']).toStringAsFixed(2)}%' : '—'),
              MiniTile(label: t('developer.market.trades'), value: jIn(s['trades']) != null ? '${jI(s['trades'])}' : '—'),
            ],
          ),
          if (curve.length > 1) ...[const SizedBox(height: 8), KLineChart(values: curve, height: 110, color: k.ember)],
        ],
      ),
    );
  }
}

/// Publish a strategy (web PublishDialog).
class _PublishSheet extends ConsumerStatefulWidget {
  const _PublishSheet();

  @override
  ConsumerState<_PublishSheet> createState() => _PublishSheetState();
}

class _PublishSheetState extends ConsumerState<_PublishSheet> {
  int? _sid;
  int? _dep;
  final _title = TextEditingController();
  final _desc = TextEditingController();
  double _price = 0;
  bool _clone = false;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).algoPost('market/listings', {
        'strategyId': _sid,
        'deploymentId': _dep,
        'title': _title.text,
        'description': _desc.text,
        'priceMonthly': _price,
        'allowClone': _clone,
      });
      algoOk(ref, t('developer.market.submitted'), description: t('developer.market.submittedText'));
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (e) {
      algoFail(ref, t, t('developer.market.publishFailed'), e);
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final strategies = (ref.watch(strategiesProvider).value ?? const <StrategyItem>[]).where((s) => s.valid).toList();
    final deps = ref.watch(deploymentsProvider).value ?? const <Deployment>[];
    final mine = deps.where((d) => d.strategyId == _sid && d.subscriptionId == null).toList();
    if (_dep != null && !mine.any((d) => d.id == _dep)) _dep = null;
    _dep ??= mine.firstOrNull?.id;
    return KSheetContent(
      footer: KButton(
        label: t('developer.market.submit'),
        icon: LucideIcons.upload,
        expand: true,
        size: KButtonSize.lg,
        loading: _busy,
        onPressed: _sid == null || _dep == null || _desc.text.trim().length < 20 ? null : _submit,
      ),
      children: [
        Text(
          t('developer.market.publishText'),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3),
        ),
        const SizedBox(height: 16),
        FieldLabel(t('developer.bt.strategy')),
        PillChoice<int>(
          values: [for (final s in strategies) s.id],
          labels: [for (final s in strategies) '${s.name} · v${s.version}'],
          isSelected: (v) => v == _sid,
          onTap: (v) => setState(() {
            _sid = v;
            if (_title.text.isEmpty) _title.text = strategies.firstWhere((s) => s.id == v).name;
          }),
        ),
        if (_sid != null) ...[
          const SizedBox(height: 14),
          FieldLabel(t('developer.market.trackFrom')),
          if (mine.isEmpty)
            Text(t('developer.market.deployFirst'), style: context.text.footnote.copyWith(color: k.warn))
          else
            PillChoice<int>(
              values: [for (final d in mine) d.id],
              labels: [
                for (final d in mine) '#${d.login} · ${_acctType(t, d.accountType)} · ${t('developer.market.nTrades', {'count': d.trades})}',
              ],
              isSelected: (v) => v == _dep,
              onTap: (v) => setState(() => _dep = v),
            ),
        ],
        const SizedBox(height: 14),
        KTextField(label: t('developer.market.titleLabel'), controller: _title, inputFormatters: [LengthLimitingTextInputFormatter(80)]),
        const SizedBox(height: 14),
        CodeField(
          controller: _desc,
          label: t('developer.market.descLabel'),
          mono: false,
          ltr: false,
          minLines: 4,
          maxLength: 4000,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Text(t('developer.market.price'), style: context.text.callout.copyWith(color: k.fg3)),
            const SizedBox(width: 10),
            NumField(
              value: _price,
              min: 0,
              suffix: t('developer.market.usdtPerMonth'),
              semanticLabel: t('developer.market.monthlyPrice'),
              onChanged: (v) => setState(() => _price = v),
            ),
            const SizedBox(width: 8),
            if (_price <= 0) Text(t('developer.market.freeLower'), style: context.text.caption.copyWith(color: k.fg3)),
          ],
        ),
        const SizedBox(height: 8),
        KListSection(
          margin: EdgeInsets.zero,
          children: [
            KListRow(
              title: t('developer.market.allowCloning'),
              trailing: KSwitch(value: _clone, semanticLabel: t('developer.market.allowCloningAria'), onChanged: (v) => setState(() => _clone = v)),
            ),
          ],
        ),
      ],
    );
  }
}
