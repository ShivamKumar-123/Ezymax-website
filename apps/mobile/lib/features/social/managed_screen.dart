// Copy & PAMM › Managed accounts (/social/managed): the client side of MAM — find a MAM programme, link one of your
// live accounts with an explicit consent to the manager's terms, watch it, set limits and revoke. The account and the
// money stay yours: the manager only trades it. Port of the phone layout of apps/crm/components/social-live/mam.tsx
// (LiveManagedPage: GET mam/links every 10 s, GET mam/managers; the connect, details, limits and revoke dialogs).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'mam_api.dart';
import 'social_api.dart';
import 'widgets/bits.dart';
import 'widgets/copy_sheets.dart';
import 'widgets/follow_sheet.dart' show SheetTitle;

/// The numbered paragraphs of a terms text ("1. … 2. …").
List<String> termsParagraphs(String text) => [
  for (final p in text.split(RegExp(r'(?=\d\. )')))
    if (p.trim().isNotEmpty) p.trim(),
];

/// "20%" or "20% + 2%/y".
String _feeShort(double perf, double mgmt) => '${numText(perf)}%${mgmt > 0 ? ' + ${numText(mgmt)}%/y' : ''}';

class ManagedScreen extends ConsumerWidget {
  const ManagedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final links = ref.watch(mamLinksProvider);
    final managers = ref.watch(mamManagersProvider);
    final items = links.value ?? const <LinkView>[];
    final active = items.where((l) => l.status == 'active').toList();
    final ended = items.where((l) => l.status != 'active').toList();
    final linkedTo = {for (final l in active) l.managerId};
    final rtl = Directionality.of(context) == TextDirection.rtl;

    void reload() => ref.invalidate(mamLinksProvider);

    return KPageScroll(
      onRefresh: () async {
        ref
          ..invalidate(mamLinksProvider)
          ..invalidate(mamManagersProvider);
        await ref.read(mamLinksProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('social.mam.page.title'), subtitle: Text(t('social.mam.page.subtitle'))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KButton(
            label: t('social.mam.page.run'),
            icon: LucideIcons.briefcase,
            trailingIcon: rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
            variant: KButtonVariant.surface,
            onPressed: () => context.go('/social/mam'),
          ),
        ),
        const SizedBox(height: 18),
        InfoBox(icon: LucideIcons.shieldCheck, text: t('social.mam.page.info')),
        const SizedBox(height: 16),
        SectionCard(
          title: t('social.mam.page.yours'),
          subtitle: active.isNotEmpty ? t('social.mam.page.activeLinks', {'count': active.length}) : t('social.mam.page.noneManaged'),
          icon: LucideIcons.users,
          child: links.hasError && links.value == null
              ? SocialErrorCard(error: links.error, title: t('social.mam.page.unavailable'), card: false, onRetry: reload)
              : links.value == null
              ? const BlockSkeleton(n: 1)
              : items.isEmpty
              ? EmptyRow(t('social.mam.page.connectHint'))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final l in active) ...[_LinkCard(l: l, readOnly: readOnly, onChanged: reload), const SizedBox(height: 10)],
                    if (ended.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4, bottom: 8),
                        child: Text(t('social.mam.page.ended').toUpperCase(), style: context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.8)),
                      ),
                    for (final l in ended) ...[_LinkCard(l: l, readOnly: true, onChanged: reload), const SizedBox(height: 10)],
                  ],
                ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: t('social.mam.page.programmes'),
          subtitle: t('social.mam.page.programmesSub'),
          icon: LucideIcons.briefcase,
          child: managers.hasError && managers.value == null
              ? SocialErrorCard(
                  error: managers.error,
                  title: t('social.mam.page.programmesUnavailable'),
                  card: false,
                  onRetry: () => ref.invalidate(mamManagersProvider),
                )
              : managers.value == null
              ? const BlockSkeleton(n: 2, h: 60)
              : managers.value!.isEmpty
              ? KEmptyState(
                  compact: true,
                  art: KIllustrationName.copyTrading,
                  title: t('social.mam.page.noProgrammes'),
                  text: t('social.mam.page.noProgrammesText'),
                )
              : RowsBox(
                  boxed: false,
                  children: [
                    for (final m in managers.value!)
                      DataLine(
                        leading: KAvatar(name: m.nickname ?? m.name, size: 34),
                        title: Text(m.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text(m.nickname ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                        trailing: linkedTo.contains(m.id)
                            ? KChip(label: t('social.mam.linked'), tone: KChipTone.up, small: true)
                            : readOnly
                            ? null
                            : KButton(
                                label: t('social.mam.connect'),
                                variant: KButtonVariant.outline,
                                size: KButtonSize.sm,
                                onPressed: () => showConnectSheet(context, managerId: m.id, onLinked: reload),
                              ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ a linked account */

class _LinkCard extends StatelessWidget {
  const _LinkCard({required this.l, required this.readOnly, required this.onChanged});
  final LinkView l;
  final bool readOnly;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final active = l.status == 'active';
    final statusLabel = active ? t('common.active') : (l.status == 'revoked' ? t('social.mam.revoked') : mamStopReason(t, l.stopReason));
    final buttons = <Widget>[
      KButton(
        label: t('common.details'),
        icon: LucideIcons.listChecks,
        variant: KButtonVariant.surface,
        size: KButtonSize.sm,
        expand: true,
        onPressed: () => showLinkDetailSheet(context, l.id),
      ),
      if (active && !readOnly) ...[
        KButton(
          label: t('social.mam.limits'),
          icon: LucideIcons.settings2,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          expand: true,
          onPressed: () => showLimitsSheet(context, l, onSaved: onChanged),
        ),
        KButton(
          label: t('social.mam.revoke'),
          icon: LucideIcons.unlink,
          variant: KButtonVariant.danger,
          size: KButtonSize.sm,
          expand: true,
          onPressed: () => showRevokeSheet(context, l, onDone: onChanged),
        ),
      ],
      TraderButton(login: int.tryParse(l.login), expand: true),
    ];
    return Opacity(
      opacity: active ? 1 : 0.75,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: k.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                KAvatar(name: l.managerNickname ?? 'MAM', size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(l.managerName ?? t('social.mam.programme'), style: context.text.headline.copyWith(fontSize: 14.5)),
                          StatusChip(status: l.status, label: statusLabel),
                        ],
                      ),
                      const SizedBox(height: 2),
                      KRichText(
                        '${l.managerNickname ?? ''} · ${t('social.mam.linkSub', {'login': l.login, 'date': fmtDate(t, l.createdAt)})}',
                        tags: {'acc': KTag(style: context.text.mono(12, color: k.fg2))},
                        style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TileGrid(
              tiles: [
                Tile(label: t('common.equity'), value: Num(usd(l.equity))),
                Tile(
                  label: t('social.mam.result'),
                  value: Num(usd(l.mamResult, 2, true), color: toneColor(context, l.mamResult)),
                ),
                Tile(
                  label: t('social.mam.openTrades'),
                  value: Num('${l.mamPositions}${l.mamOrders > 0 ? ' ${t('social.mam.plusPending', {'n': l.mamOrders})}' : ''}'),
                ),
                Tile(label: t('social.fees'), value: Num(_feeShort(l.perfFeePct, l.mgmtFeePct))),
                Tile(
                  label: t('social.mam.maxLotEquityStop'),
                  value: Num('${l.maxLot != null ? numText(l.maxLot!) : '—'} · ${l.equityStop != null && l.equityStop! > 0 ? usd(l.equityStop, 0) : '—'}'),
                ),
                Tile(label: t('social.inv.kpi.feesPaid'), value: Num(usd(l.feesPaid))),
              ],
            ),
            const SizedBox(height: 12),
            TileGrid(tiles: buttons),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ connect (consent) */

/// The consent sheet: choose the account, optional limits, read the terms and grant trading authority.
Future<void> showConnectSheet(BuildContext context, {required int managerId, required VoidCallback onLinked}) => showKSheet<void>(
  context,
  expand: true,
  builder: (_) => _ConnectSheet(managerId: managerId, onLinked: onLinked),
);

class _ConnectSheet extends ConsumerStatefulWidget {
  const _ConnectSheet({required this.managerId, required this.onLinked});
  final int managerId;
  final VoidCallback onLinked;

  @override
  ConsumerState<_ConnectSheet> createState() => _ConnectSheetState();
}

class _ConnectSheetState extends ConsumerState<_ConnectSheet> {
  int? _login;
  bool _accept = false;
  bool _busy = false;
  final _maxLot = TextEditingController();
  final _equityStop = TextEditingController();

  @override
  void dispose() {
    _maxLot.dispose();
    _equityStop.dispose();
    super.dispose();
  }

  String? _maxLotErr(T t) {
    if (_maxLot.text.trim().isEmpty) return null;
    final v = parseAmount(_maxLot.text);
    return v == null || v < 0.01 || v > 100 ? t('social.mam.err.maxLot') : null;
  }

  String? _stopErr(T t, Map<String, dynamic>? chosen) {
    if (_equityStop.text.trim().isEmpty || chosen == null) return null;
    final v = parseAmount(_equityStop.text);
    return v == null || v <= 0 || v >= numOf(chosen['equity']) ? t('social.mam.err.equityStopRange') : null;
  }

  Future<void> _submit(Map<String, dynamic> data, ManagerView m) async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      await socialPost(ref, 'mam/links', {
        'managerId': widget.managerId,
        'login': _login,
        'termsHash': strOf(mapOf(data['terms'])['hash']),
        'accept': true,
        'maxLot': ?parseAmount(_maxLot.text),
        'equityStop': ?parseAmount(_equityStop.text),
      });
      okToast(ref, t('social.mam.toast.linked', {'login': _login ?? '', 'name': m.name}), t('social.mam.toast.linkedDesc'));
      widget.onLinked();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.mam.toast.linkFailed'), e);
      if (e.code == 'terms_changed') ref.invalidate(mamManagerDetailProvider(widget.managerId));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final q = ref.watch(mamManagerDetailProvider(widget.managerId));
    final data = q.value;
    final m = data == null ? null : ManagerView(mapOf(data['manager']));
    final accounts = listOf(data?['accounts']);
    if (data != null && _login == null) _login = intOrNull(accounts.where((a) => a['eligible'] == true).firstOrNull?['login']);
    final chosen = accounts.where((a) => intOf(a['login']) == _login).firstOrNull;
    final err = chosen == null
        ? t('social.mam.err.chooseAccount')
        : _maxLotErr(t) ?? _stopErr(t, chosen) ?? (!_accept ? t('social.mam.err.acceptTerms') : null);

    return KSheetContent(
      footer: SheetFooter(
        label: t('social.mam.connect.grant'),
        icon: LucideIcons.shieldCheck,
        busy: _busy,
        onPressed: data == null || m == null || err != null ? null : () => _submit(data, m),
      ),
      children: [
        SheetTitle(
          title: m != null ? t('social.mam.connect.title', {'name': m.name}) : t('social.mam.connect.titleEmpty'),
          description: m != null
              ? '${m.nickname ?? t('social.mam.manager')} · ${methodLabel(t, m.method)} · ${mamFeesText(t, m.perfFeePct, m.mgmtFeePct, m.feePeriod)}'
              : null,
        ),
        if (q.hasError && data == null)
          SocialErrorCard(
            error: q.error,
            title: t('social.mam.programmeUnavailable'),
            card: false,
            onRetry: () => ref.invalidate(mamManagerDetailProvider(widget.managerId)),
          )
        else if (data == null || m == null)
          const BlockSkeleton(n: 2, h: 90)
        else ...[
          GroupLabel(t('social.mam.connect.accountToLink')),
          if (accounts.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
              decoration: BoxDecoration(
                color: k.surface2,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: k.line),
              ),
              child: KRichText(
                t('social.mam.connect.noLive'),
                tags: {
                  'link': KTag(
                    style: TextStyle(color: k.ember, fontWeight: FontWeight.w600),
                    onTap: () {
                      final router = GoRouter.of(context);
                      Navigator.of(context).pop();
                      router.go('/accounts/new');
                    },
                  ),
                },
                style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
              ),
            )
          else
            for (final a in accounts) ...[
              _AccountChoice(a: a, selected: intOf(a['login']) == _login, onSelect: () => setState(() => _login = intOf(a['login']))),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 8),
          NumberField(
            controller: _maxLot,
            label: t('social.mam.maxLotPerTrade'),
            hint: t('social.subs.settings.emptyNoCap'),
            placeholder: t('social.noCap'),
            unit: t('social.lotsUnit'),
            error: _maxLotErr(t),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          NumberField(
            controller: _equityStop,
            label: t('social.equityStop'),
            hint: t('social.subs.settings.emptyOff'),
            placeholder: t('common.off'),
            dollar: true,
            error: _stopErr(t, chosen),
            onChanged: (_) => setState(() {}),
          ),
          Hint(t('social.mam.connect.stopNote'), top: 8),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(LucideIcons.fileText, size: 15, color: k.fg3),
              const SizedBox(width: 6),
              Expanded(
                child: Text(t('social.mam.connect.terms'), style: context.text.label.copyWith(color: k.fg2, fontSize: 12.5)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _TermsBox(text: strOf(mapOf(data['terms'])['text']), maxHeight: 224),
          const SizedBox(height: 12),
          KCheckRow(
            value: _accept,
            onChanged: (v) => setState(() => _accept = v),
            child: Text(
              t('social.mam.connect.consent', {
                'name': m.nickname ?? t('social.mam.theManager'),
                'account': _login != null ? '#$_login' : t('social.mam.theAccountIChose'),
              }),
              style: context.text.footnote.copyWith(color: k.fg2, height: 1.45),
            ),
          ),
        ],
      ],
    );
  }
}

class _AccountChoice extends StatelessWidget {
  const _AccountChoice({required this.a, required this.selected, required this.onSelect});
  final Map<String, dynamic> a;
  final bool selected;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final eligible = a['eligible'] == true;
    return Opacity(
      opacity: eligible ? 1 : 0.6,
      child: Semantics(
        selected: selected,
        enabled: eligible,
        child: KPressable(
          pressedScale: 0.99,
          onTap: eligible ? onSelect : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: selected ? k.emberSoft : k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: selected ? k.ember.withValues(alpha: 0.6) : k.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: selected ? k.ember : k.fg3, width: 1.5),
                  ),
                  child: selected
                      ? Center(
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: k.ember),
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Num('#${strOf(a['login'])}', style: context.text.mono(13.5, color: k.fg)),
                      Text(
                        eligible ? '${strOf(a['group'])} · ${t('social.mam.openPositions', {'count': intOf(a['positions'])})}' : strOf(a['reason']),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Num(usd(numOf(a['equity'])), style: context.text.figure.copyWith(fontSize: 13.5)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The terms in a bordered, scrollable box (numbered paragraphs).
class _TermsBox extends StatelessWidget {
  const _TermsBox({required this.text, this.maxHeight = 192, this.dim = false});
  final String text;
  final double maxHeight;
  final bool dim;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final paras = termsParagraphs(text);
    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < paras.length; i++)
              Padding(
                padding: EdgeInsets.only(top: i > 0 ? 8 : 0),
                child: Text(paras[i], style: context.text.footnote.copyWith(color: dim ? k.fg3 : k.fg2, fontSize: 12.5, height: 1.5)),
              ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ details */

/// The link's MAM trades, history, fees, activity and the consent text (GET mam/links/{id}, 5 s).
Future<void> showLinkDetailSheet(BuildContext context, int id) => showKSheet<void>(context, expand: true, builder: (_) => _LinkDetailSheet(id: id));

class _LinkDetailSheet extends ConsumerWidget {
  const _LinkDetailSheet({required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final q = ref.watch(mamLinkDetailProvider(id));
    final data = q.value;
    final l = data == null ? null : LinkView(mapOf(data['link']));
    final positions = listOf(data?['positions']);
    final deals = listOf(data?['deals']);
    final log = listOf(data?['log']);
    final fees = [for (final f in listOf(data?['fees'])) FeeView(f)];
    final terms = strOrNull(data?['terms']);
    Widget label(String s) => Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 8),
      child: Text(s, style: context.text.label.copyWith(color: k.fg2, fontSize: 12.5)),
    );
    String side(Object? s) => t.dyn('common.${strOf(s)}', fallback: strOf(s)).toLowerCase();

    return KSheetContent(
      children: [
        SheetTitle(
          title: l != null ? '${l.managerName ?? 'MAM'} · #${l.login}' : t('social.mam.managedAccount'),
          description: l != null
              ? '${t('social.mam.linkedOn', {'date': fmtDate(t, l.createdAt)})} · ${l.managerMethod != null ? methodLabel(t, l.managerMethod!) : ''}'
              : null,
        ),
        if (q.hasError && data == null)
          SocialErrorCard(error: q.error, title: t('social.mam.linkUnavailable'), card: false, onRetry: () => ref.invalidate(mamLinkDetailProvider(id)))
        else if (l == null)
          const BlockSkeleton(h: 100)
        else ...[
          TileGrid(
            tiles: [
              Tile(label: t('common.equity'), value: Num(usd(l.equity))),
              Tile(
                label: t('social.mam.result'),
                value: Num(usd(l.mamResult, 2, true), color: toneColor(context, l.mamResult)),
              ),
              Tile(label: t('social.funds.explain.hwmT'), value: Num(usd(l.hwm))),
              Tile(label: t('social.mam.feesPaidPending'), value: Num('${usd(l.feesPaid)} / ${usd(l.feesPending)}')),
            ],
          ),
          label(t('social.mam.openTrades')),
          if (positions.isEmpty)
            EmptyRow(t('social.mam.noOpenTrades'))
          else
            RowsBox(
              pageSize: 8,
              children: [
                for (final p in positions)
                  DataLine(
                    title: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${strOf(p['symbol'])} '),
                          TextSpan(
                            text: side(p['side']),
                            style: TextStyle(color: p['side'] == 'buy' ? k.up : k.down),
                          ),
                        ],
                      ),
                    ),
                    subtitle: Num('#${strOf(p['ticket'])} · ${lots(numOrNull(p['volume']))} ${t('social.lotsUnit')}'),
                    trailing: Num(usd(numOf(p['profit']), 2, true), color: toneColor(context, numOf(p['profit']))),
                  ),
              ],
            ),
          label(t('social.mam.tradeHistory')),
          if (deals.isEmpty)
            EmptyRow(t('social.mam.noTrades'))
          else
            RowsBox(
              pageSize: 8,
              children: [
                for (final d in deals)
                  DataLine(
                    title: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${strOf(d['symbol'])} '),
                          TextSpan(
                            text: '${d['entry'] == 'in' ? t('social.mam.dealOpen') : t('social.mam.dealClose')} ${side(d['side'])}',
                            style: TextStyle(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                    subtitle: Text(serverTime(t, strOrNull(d['time']))),
                    trailing: d['entry'] == 'in'
                        ? Num(numOf(d['commission']) != 0 ? usd(-numOf(d['commission']), 2, true) : '—', color: k.fg3)
                        : Num(usd(numOf(d['profit']) + numOf(d['swap']), 2, true), color: toneColor(context, numOf(d['profit']) + numOf(d['swap']))),
                    trailingSub: Num('${lots(numOrNull(d['volume']))} ${t('social.lotsUnit')}'),
                  ),
              ],
            ),
          label(t('social.fees')),
          FeesRows(fees: fees, empty: t('social.mam.noFees')),
          label(t('social.mam.activity')),
          if (log.isEmpty)
            EmptyRow(t('social.mam.nothingYet'))
          else
            RowsBox(
              pageSize: 20,
              children: [
                for (final e in log.take(20))
                  DataLine(
                    title: Text(
                      '${t.dyn('social.logAction.${strOf(e['action'])}', fallback: strOf(e['action']).replaceAll('_', ' '))}'
                      '${strOf(e['message']).isNotEmpty ? ' · ${strOf(e['message'])}' : ''}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(serverTime(t, strOrNull(e['at']), withYear: false)),
                    trailing: KChip(
                      label: t.dyn('social.logStatus.${strOf(e['status'])}', fallback: strOf(e['status'])),
                      tone: e['status'] == 'done' ? KChipTone.up : (e['status'] == 'failed' ? KChipTone.down : KChipTone.neutral),
                      small: true,
                    ),
                  ),
              ],
            ),
          if (terms != null && terms.isNotEmpty) ...[
            label(t('social.mam.yourConsent', {'date': fmtDate(t, l.consentAt)})),
            _TermsBox(text: terms, dim: true),
          ],
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ limits */

/// Max lot and equity stop of a link (PATCH mam/links/{id}; an empty field clears the limit).
Future<void> showLimitsSheet(BuildContext context, LinkView link, {required VoidCallback onSaved}) => showKSheet<void>(
  context,
  builder: (_) => _LimitsSheet(link: link, onSaved: onSaved),
);

class _LimitsSheet extends ConsumerStatefulWidget {
  const _LimitsSheet({required this.link, required this.onSaved});
  final LinkView link;
  final VoidCallback onSaved;

  @override
  ConsumerState<_LimitsSheet> createState() => _LimitsSheetState();
}

class _LimitsSheetState extends ConsumerState<_LimitsSheet> {
  late final _maxLot = TextEditingController(text: inputText(widget.link.maxLot));
  late final _equityStop = TextEditingController(text: inputText(widget.link.equityStop));
  bool _busy = false;

  @override
  void dispose() {
    _maxLot.dispose();
    _equityStop.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      await socialPatch(ref, 'mam/links/${widget.link.id}', {'maxLot': parseAmount(_maxLot.text), 'equityStop': parseAmount(_equityStop.text)});
      okToast(ref, t('social.mam.toast.limitsSaved'), t('social.mam.toast.limitsSavedDesc'));
      widget.onSaved();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.mam.toast.limitsFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final l = widget.link;
    final maxV = parseAmount(_maxLot.text);
    final stopV = parseAmount(_equityStop.text);
    final maxErr = _maxLot.text.trim().isNotEmpty && (maxV == null || maxV < 0.01 || maxV > 100) ? t('social.mam.err.maxLot') : null;
    final stopErr = _equityStop.text.trim().isNotEmpty && (stopV == null || stopV <= 0 || stopV >= l.equity) ? t('social.mam.err.equityStopBelow') : null;
    return KSheetContent(
      footer: SheetFooter(label: t('social.mam.limits.save'), busy: _busy, onPressed: maxErr != null || stopErr != null ? null : _save),
      children: [
        SheetTitle(title: t('social.mam.limits.title'), description: '${t('social.mam.accountNo', {'login': l.login})} · ${l.managerName ?? ''}'),
        NumberField(
          controller: _maxLot,
          label: t('social.mam.maxLotPerTrade'),
          hint: t('social.subs.settings.emptyNoCap'),
          placeholder: t('social.noCap'),
          unit: t('social.lotsUnit'),
          error: maxErr,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        NumberField(
          controller: _equityStop,
          label: t('social.equityStop'),
          hint: t('social.mam.equityHint', {'amount': usd(l.equity)}),
          placeholder: t('common.off'),
          dollar: true,
          error: stopErr,
          onChanged: (_) => setState(() {}),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ revoke */

/// Ends the trading authority (POST mam/links/{id}/revoke), optionally closing the open MAM trades.
Future<void> showRevokeSheet(BuildContext context, LinkView link, {required VoidCallback onDone}) => showKSheet<void>(
  context,
  builder: (_) => _RevokeSheet(link: link, onDone: onDone),
);

class _RevokeSheet extends ConsumerStatefulWidget {
  const _RevokeSheet({required this.link, required this.onDone});
  final LinkView link;
  final VoidCallback onDone;

  @override
  ConsumerState<_RevokeSheet> createState() => _RevokeSheetState();
}

class _RevokeSheetState extends ConsumerState<_RevokeSheet> {
  bool _close = false;
  bool _busy = false;

  Future<void> _revoke() async {
    final t = context.t;
    final l = widget.link;
    setState(() => _busy = true);
    try {
      final r = await socialPost(ref, 'mam/links/${l.id}/revoke', {'closePositions': _close});
      final closed = r['closed'] is List ? (r['closed'] as List).length : 0;
      final fee = numOrNull(r['fee']);
      okToast(
        ref,
        t('social.mam.toast.revoked'),
        '${t('social.mam.toast.revokedDesc', {'name': l.managerName ?? t('social.mam.theManagerCap'), 'login': l.login})}'
        '${_close ? ' ${t('social.mam.toast.tradesClosed', {'count': closed})}' : ''}'
        '${fee != null && fee > 0 ? ' ${t('social.mam.toast.feesSettled', {'amount': usd(fee)})}' : ''}',
      );
      widget.onDone();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.mam.toast.revokeFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final l = widget.link;
    final open = l.mamPositions + l.mamOrders;
    return KSheetContent(
      footer: SheetFooter(label: t('social.mam.revoke.now'), icon: LucideIcons.unlink, variant: KButtonVariant.danger, busy: _busy, onPressed: _revoke),
      children: [
        SheetTitle(title: t('social.mam.revoke.title'), description: '${l.managerName ?? 'MAM'} · ${t('social.mam.accountLower', {'login': l.login})}'),
        Text(t('social.mam.revoke.text'), style: context.text.callout.copyWith(color: k.fg2)),
        const SizedBox(height: 14),
        if (open > 0) ...[
          KCheckRow(
            value: _close,
            onChanged: (v) => setState(() => _close = v),
            child: Text(t('social.mam.revoke.closeTrades', {'count': open}), style: context.text.callout),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 34, top: 4),
            child: Text(t('social.mam.revoke.keepNote'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
          ),
        ] else
          Text(t('social.mam.revoke.noTrades'), style: context.text.callout.copyWith(color: k.fg3)),
      ],
    );
  }
}
