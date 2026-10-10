// Partner › Clients (web components/partner/live/clients.tsx LivePartnerClients): header (Invite a client), the five
// mini stats, the privacy note (masked visibility), the clients list with tier / status filters, search, CSV and
// pages, the legend; tapping a client (full visibility) opens the details sheet with their closed trades.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/format/format.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'partner_api.dart';
import 'widgets/partner_widgets.dart';

const int _pageSize = 12;

const Map<String, (String, KChipTone)> _kyc = {
  'verified': ('Verified', KChipTone.up),
  'approved': ('Verified', KChipTone.up),
  'pending': ('In review', KChipTone.warn),
  'rejected': ('Rejected', KChipTone.down),
  'unverified': ('Not started', KChipTone.neutral),
};

const Map<String, String> _notQualified = {
  'short_duration': 'Held too briefly',
  'excluded_group': 'Excluded account group',
  'mam_master': 'MAM master account (counted on the managed accounts)',
  'pamm_fund': 'PAMM fund account (counted per investor)',
  'self_referral': 'Self-referral check',
  'demo': 'Not a live account',
  'reversed': 'Reversed',
  'price_correction': 'Price correction',
  'no_volume': 'No volume',
  'no_symbol_group': 'Symbol not in rate card',
  'no_referrer': 'No referrer',
};

String _reasonLabel(T t, String? r) =>
    r == null ? t('partner.reason.notEligible') : t.dyn('partner.reason.$r', fallback: _notQualified[r] ?? r.replaceAll('_', ' '));

/// "2h 5m" (web fmtDuration).
String _duration(T t, int ms) {
  final s = math.max(0, (ms / 1000).round());
  if (s < 60) return t('partner.dur.s', {'s': s});
  if (s < 3600) return t('partner.dur.m', {'m': (s / 60).round()});
  final h = s ~/ 3600;
  return h < 24 ? t('partner.dur.hm', {'h': h, 'm': ((s % 3600) / 60).round()}) : t('partner.dur.dh', {'d': h ~/ 24, 'h': h % 24});
}

class PartnerClientsScreen extends ConsumerStatefulWidget {
  const PartnerClientsScreen({super.key});

  @override
  ConsumerState<PartnerClientsScreen> createState() => _PartnerClientsScreenState();
}

class _PartnerClientsScreenState extends ConsumerState<PartnerClientsScreen> {
  String _tier = 'all';
  String _status = 'all';
  String _q = '';
  int _page = 0;

  Future<void> _refresh() async {
    ref
      ..invalidate(partnerClientsProvider)
      ..invalidate(partnerCampaignsProvider);
    await ref.read(partnerClientsProvider.future).then((_) {}, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final async = ref.watch(partnerClientsProvider);
    final camp = ref.watch(partnerCampaignsProvider).value;
    final prog = ref.watch(partnerProgrammeProvider).value;
    final data = async.value;
    final tiers = data?.tiers ?? 3;
    final subtitle = t('partner.clients.subtitle', {'count': tiers});
    if (data == null) {
      return PartnerPageFallback(
        title: t('partner.clients.title'),
        subtitle: subtitle,
        error: async.hasError ? async.error : null,
        onRetry: () => ref.invalidate(partnerClientsProvider),
        skeleton: const [92, 92, 92, 420],
      );
    }

    final all = data.items;
    final byId = {for (final c in all) c.id: c};
    String? viaName(PClient c) => c.parentId == null ? null : byId[c.parentId]?.name;
    final rows = all.where((c) => (_tier == 'all' || '${c.tier}' == _tier) && (_status == 'all' || c.status == _status)).toList();
    final q = _q.trim().toLowerCase();
    final shown = q.isEmpty ? rows : rows.where((c) => '${c.name} ${c.email ?? ''} ${clientIdOf(c.id)} ${c.country} ${c.campaign ?? ''}'.toLowerCase().contains(q)).toList();
    final pages = math.max(1, (shown.length / _pageSize).ceil());
    final page = _page.clamp(0, pages - 1);
    final view = shown.skip(page * _pageSize).take(_pageSize).toList();

    final full = data.full;
    final code = camp?.code;
    final link = code == null || code.isEmpty ? null : referralLink(camp!.linkBase, code);
    final direct = all.where((c) => c.tier == 1).length;
    final lotsMonth = all.fold<double>(0, (s, c) => s + c.lotsMonth);
    final earned = all.fold<double>(0, (s, c) => s + c.earned);
    final funded = all.where((c) => c.firstDepositAt != null).length;
    final subIbs = all.where((c) => c.referrals > 0).length;
    final filtered = _tier != 'all' || _status != 'all';

    void copyLink() => partnerCopy(context, link!, t('partner.toast.linkCopied'), description: shortUrl(link));

    return KPageScroll(
      onRefresh: _refresh,
      children: [
        KPageHeader(title: t('partner.clients.title'), subtitle: Text(subtitle)),
        if (link != null) ...[
          const SizedBox(height: 14),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KButton(label: t('partner.clients.invite'), icon: LucideIcons.userPlus, onPressed: copyLink),
          ),
        ],
        if (ref.watch(meProvider)?.referralLinkInactive ?? false) ...[const SizedBox(height: 14), const PartnerInactiveLinkNote()],
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: MiniStat(
                label: t('partner.clients.referred'),
                value: Text('${all.length}'),
                sub: t('partner.clients.directVia', {'direct': direct, 'via': all.length - direct}),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MiniStat(
                label: t('partner.clients.activeMonth'),
                value: Text('${all.where((c) => c.status == 'active').length}'),
                sub: t('partner.tradedThisMonth'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MiniStat(
                label: t('partner.clientStatus.funded'),
                value: Text('$funded'),
                sub: all.isNotEmpty ? t('partner.clients.pctOfReferrals', {'pct': (funded / all.length * 100).round()}) : t('partner.clients.firstDepositMade'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MiniStat(label: t('partner.lotsThisMonth'), value: Text(pf.lots(lotsMonth, 1)), sub: t('partner.subIbCount', {'count': subIbs})),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MiniStat(
          label: t('partner.clients.earnedFrom'),
          value: KMoney(earned, style: context.text.figure.copyWith(fontSize: 21, height: 1.05)),
          sub: t('partner.clients.lifetimeAllTiers'),
        ),
        if (!full) ...[
          kGap,
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.line),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Icon(LucideIcons.eyeOff, size: 16, color: k.fg3),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(t('partner.clients.privacyNote'), style: context.text.footnote.copyWith(color: k.fg2)),
                ),
              ],
            ),
          ),
        ],
        kGap,
        KCard(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KSegmented<String>(
                values: ['all', for (var i = 1; i <= math.min(tiers, 3); i++) '$i'],
                labels: [t('partner.allTiers'), for (var i = 1; i <= math.min(tiers, 3); i++) 'L$i'],
                selected: _tier,
                height: 34,
                onChanged: (v) => setState(() {
                  _tier = v;
                  _page = 0;
                }),
              ),
              const SizedBox(height: 8),
              KChoiceChips<String>(
                values: const ['all', 'active', 'funded', 'registered'],
                labels: [t('common.all'), t('partner.clientStatus.active'), t('partner.clientStatus.funded'), t('partner.clientStatus.registered')],
                selected: _status,
                onChanged: (v) => setState(() {
                  _status = v;
                  _page = 0;
                }),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  if (filtered)
                    KButton(
                      label: t('partner.clear'),
                      icon: LucideIcons.funnel,
                      variant: KButtonVariant.ghost,
                      size: KButtonSize.sm,
                      onPressed: () => setState(() {
                        _tier = 'all';
                        _status = 'all';
                        _page = 0;
                      }),
                    ),
                  Expanded(
                    child: Text(
                      t('partner.clients.count', {'count': rows.length}),
                      style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
                    ),
                  ),
                  if (all.isNotEmpty)
                    CsvButton(
                      onPressed: () => exportCsv(
                        context,
                        ref,
                        name: 'ezymex-referred-clients',
                        headers: [
                          t('partner.client'),
                          t('partner.tier'),
                          t('partner.clients.joined'),
                          t('partner.clients.source'),
                          t('partner.lotsMonth'),
                          t('partner.clients.earned'),
                          t('common.status'),
                        ],
                        rows: [
                          // masked (the default): initials plus the client id, never a name
                          for (final c in shown) [full ? c.name : '${c.name} ${clientIdOf(c.id)}', c.tier, c.joinedAt, c.campaign ?? '', c.lotsMonth, c.earned, c.status],
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              KSearchField(
                placeholder: full ? t('partner.clients.searchFull') : t('partner.clients.searchLimited'),
                onChanged: (v) => setState(() {
                  _q = v;
                  _page = 0;
                }),
              ),
              const SizedBox(height: 8),
              if (view.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: all.isEmpty
                      ? CardEmpty(
                          art: KIllustrationName.partnerIb,
                          title: t('partner.clients.emptyTitle'),
                          text: t('partner.clients.emptyText'),
                          child: link == null
                              ? null
                              : KButton(label: t('partner.copyReferralLink'), variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: copyLink),
                        )
                      : CardEmpty(title: t('partner.clients.noMatch'), text: t('partner.clients.noMatchText')),
                )
              else
                for (final (i, c) in view.indexed) ...[
                  if (i > 0) const KDivider(),
                  _ClientRow(c: c, via: viaName(c), onTap: full ? () => _openClient(context, c, viaName(c), prog?.minTradeSeconds) : null),
                ],
              if (pages > 1) ...[
                const SizedBox(height: 10),
                PartnerPager(
                  from: page * _pageSize + 1,
                  to: math.min(shown.length, (page + 1) * _pageSize),
                  total: shown.length,
                  page: page + 1,
                  pages: pages,
                  onPrev: page == 0 ? null : () => setState(() => _page = page - 1),
                  onNext: page >= pages - 1 ? null : () => setState(() => _page = page + 1),
                ),
              ],
              const SizedBox(height: 12),
              Text(
                '${t('partner.clients.legend')}${full ? ' ${t('partner.clients.selectHint')}' : ''}',
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _openClient(BuildContext context, PClient c, String? via, int? minSeconds) {
    showKSheet<void>(
      context,
      title: context.t('partner.clients.details'),
      builder: (_) => _ClientSheet(c: c, via: via, minSeconds: minSeconds),
    );
  }
}

/// "KL-000123": the client id partners keep when the broker masks names (the web's clientId, SessionUser.clientId).
String clientIdOf(int id) => 'KL-${id.toString().padLeft(6, '0')}';

class _ClientRow extends StatelessWidget {
  const _ClientRow({required this.c, this.via, this.onTap});
  final PClient c;
  final String? via;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final sub = [
      c.email ?? clientIdOf(c.id),
      if (c.tier > 1 && via != null) t('partner.clients.via', {'name': via}),
    ].join(' · ');
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PartnerAvatar(name: c.name, country: c.country, size: 34),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.label.copyWith(fontSize: 13.5, color: k.fg),
                      ),
                    ),
                    const SizedBox(width: 6),
                    TierChip(c.tier),
                  ],
                ),
                if (sub.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
                const SizedBox(height: 3),
                Text(
                  '${c.lotsMonth != 0 ? t('partner.lotsN', {'lots': pf.lots(c.lotsMonth)}) : '—'} · ${t('partner.clients.lotsTotal', {'lots': pf.lots(c.lotsTotal, 1)})}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (c.earned != 0)
                KMoney(
                  c.earned,
                  style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: k.up),
                  dimDecimals: false,
                )
              else
                Text('—', style: context.text.label.copyWith(color: k.fg3)),
              const SizedBox(height: 4),
              ClientStatusChip(c.status),
              const SizedBox(height: 3),
              Text(
                c.lastTradeAt != null ? pf.rel(c.lastTradeAt) : t('partner.noTrades'),
                style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
              ),
            ],
          ),
        ],
      ),
    );
    return onTap == null ? row : KPressable(onTap: onTap, pressedScale: 1, child: row);
  }
}

/* ------------------------------------------------------------------ details */

class _ClientSheet extends StatelessWidget {
  const _ClientSheet({required this.c, this.via, this.minSeconds});
  final PClient c;
  final String? via;
  final int? minSeconds;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final kyc = _kyc[c.kycStatus] ?? (c.kycStatus.replaceAll('_', ' '), KChipTone.neutral);
    final rel = c.tier == 1
        ? t('partner.clients.yourDirect')
        : (via != null ? t('partner.clients.via', {'name': via}) : t('partner.clients.tierN', {'n': c.tier}));
    final valueStyle = context.text.label.copyWith(fontSize: 13.5, color: k.fg, fontFeatures: kTabular);
    final stats = <(String, Widget)>[
      (
        'KYC',
        KChip(
          label: t.dyn('partner.kyc.${c.kycStatus}', fallback: kyc.$1),
          tone: kyc.$2,
          small: true,
        ),
      ),
      (
        t('partner.clients.firstDeposit'),
        c.firstDepositAt != null
            ? (c.firstDepositAmount != null ? KMoney(c.firstDepositAmount!, style: valueStyle) : Text(pf.date(c.firstDepositAt)))
            : Text(t('partner.clients.notYet')),
      ),
      (t('partner.clients.firstTrade'), Text(c.firstTradeAt != null ? pf.date(c.firstTradeAt) : t('partner.clients.notYet'))),
      (t('partner.lotsThisMonth'), Text(pf.lots(c.lotsMonth))),
      (t('partner.clients.lotsLifetime'), Text(pf.lots(c.lotsTotal))),
      (t('partner.clients.yourCommission'), KMoney(c.earned, style: valueStyle.copyWith(color: k.up))),
      (t('partner.clients.source'), Text(c.campaign ?? t('partner.referralLink'))),
      (t('partner.clients.theirReferrals'), Text('${c.referrals}')),
      (t('partner.clients.lastTrade'), Text(pf.rel(c.lastTradeAt))),
    ];
    return KSheetContent(
      children: [
        Text(
          '${t('partner.clients.joinedOn', {'date': pf.date(c.joinedAt)})} · $rel',
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: PersonCell(name: c.name, country: c.country, size: 52),
            ),
            TierChip(c.tier),
            const SizedBox(width: 6),
            ClientStatusChip(c.status),
          ],
        ),
        if (c.email != null) ...[
          const SizedBox(height: 14),
          PartnerRow(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 4, 4, 4),
            child: Row(
              children: [
                Icon(LucideIcons.mail, size: 16, color: k.fg3),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(c.email!, maxLines: 1, overflow: TextOverflow.ellipsis, textDirection: TextDirection.ltr, style: context.text.callout),
                ),
                PartnerCopyButton(value: c.email!, size: 40),
              ],
            ),
          ),
        ],
        const SizedBox(height: 14),
        for (var i = 0; i < stats.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 8),
          Row(
            children: [
              for (var j = i; j < i + 2; j++) ...[
                if (j > i) const SizedBox(width: 8),
                Expanded(
                  child: j < stats.length
                      ? PartnerRow(
                          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                stats[j].$1,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                              ),
                              const SizedBox(height: 4),
                              DefaultTextStyle.merge(style: valueStyle, maxLines: 1, overflow: TextOverflow.ellipsis, child: stats[j].$2),
                            ],
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ],
        const SizedBox(height: 20),
        Text(t('partner.clients.closedTrades'), style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        _TradesList(id: c.id, minSeconds: minSeconds),
      ],
    );
  }
}

class _TradesList extends ConsumerWidget {
  const _TradesList({required this.id, this.minSeconds});
  final int id;
  final int? minSeconds;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final async = ref.watch(partnerClientTradesProvider(id));
    if (async.hasError && !async.hasValue) {
      final e = async.error;
      if (e is ApiException && e.status == 403) return CardEmpty(title: t('partner.clients.tradesNotShared'), text: e.message);
      return PartnerLoadProblem(error: e!, onRetry: () => ref.invalidate(partnerClientTradesProvider(id)));
    }
    final items = async.value;
    if (items == null) {
      return Column(
        children: [
          for (var i = 0; i < 4; i++) ...[if (i > 0) const SizedBox(height: 6), const KSkeleton(height: 52, radius: 14)],
        ],
      );
    }
    if (items.isEmpty) return CardEmpty(title: t('partner.clients.noTrades'), text: t('partner.clients.noTradesText'));
    final min = minSeconds;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, x) in items.indexed) ...[if (i > 0) const SizedBox(height: 6), _TradeRow(x: x, pf: pf)],
        if (min != null) ...[
          const SizedBox(height: 8),
          Text(
            t('partner.clients.minHoldNote', {
              'duration': min >= 60 ? t('partner.unit.min', {'n': (min / 60).round()}) : t('partner.unit.sec', {'n': min}),
            }),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
        ],
      ],
    );
  }
}

class _TradeRow extends StatelessWidget {
  const _TradeRow({required this.x, required this.pf});
  final PTrade x;
  final PartnerFmt pf;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final ok = x.qualified && !x.reversed;
    final option = isOptionLine(contracts: x.contracts, instrument: x.instrument, symbol: x.symbol);
    final side = x.side == 'buy'
        ? t('common.buy').toUpperCase()
        : x.side == 'sell'
        ? t('common.sell').toUpperCase()
        : x.side.toUpperCase();
    final held = (DateTime.tryParse(x.closeTime)?.millisecondsSinceEpoch ?? 0) - (DateTime.tryParse(x.openTime)?.millisecondsSinceEpoch ?? 0);
    return Opacity(
      opacity: ok ? 1 : 0.75,
      child: PartnerRow(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Row(
          children: [
            TradeSymbolAvatar(x.symbol, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 5,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(symbolLabel(t, x.symbol), style: context.text.label.copyWith(color: k.fg)),
                      KChip(label: option ? side : '$side ${pf.lots(x.lots)}', tone: x.side == 'buy' ? KChipTone.up : KChipTone.down, small: true),
                      if (option) KChip(label: optionsLabel(t, x.contracts), small: true),
                      if (x.source != 'engine')
                        KChip(
                          label: x.source == 'pamm'
                              ? 'PAMM'
                              : x.source == 'copy'
                              ? t('partner.clients.copy')
                              : x.source,
                          small: true,
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '#${x.dealId} · ${t('partner.clients.held', {'duration': _duration(t, held)})} · ${pf.rel(x.closeTime)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.mono(10.5, color: k.fg3),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: Text(
                x.reversed
                    ? t('partner.reason.reversed')
                    : ok
                    ? t('partner.clients.toYou', {'amount': '+${Fmt.money(x.earned)}'})
                    : _reasonLabel(t, x.reason),
                textAlign: TextAlign.end,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.text.caption.copyWith(
                  fontSize: 12,
                  fontWeight: ok ? FontWeight.w600 : FontWeight.w400,
                  color: x.reversed
                      ? k.fg3
                      : ok
                      ? k.up
                      : k.down,
                  fontFeatures: kTabular,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
