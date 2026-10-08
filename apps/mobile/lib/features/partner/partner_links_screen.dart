// Partner › Links (web components/partner/live/links.tsx LivePartnerLinks), in the phone order: header (Create
// link) · KPI cards (clicks, sign-ups, first deposits, first-deposit volume) · your links (search, CSV, the funnel,
// the ⋯ actions: copy, QR, share, pause / resume) · website snippet · QR code (theme, size, mark, SVG / PNG) · the
// create sheet (POST campaigns, the new link is copied).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/format/format.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'partner_api.dart';
import 'widgets/partner_widgets.dart';

const int _pageSize = 10;

String _esc(String s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

String _fileBase(String code, String slug) => 'ezymex-$code${slug.isNotEmpty ? '-$slug' : ''}-qr';

class PartnerLinksScreen extends ConsumerStatefulWidget {
  const PartnerLinksScreen({super.key});

  @override
  ConsumerState<PartnerLinksScreen> createState() => _PartnerLinksScreenState();
}

class _PartnerLinksScreenState extends ConsumerState<PartnerLinksScreen> {
  final Map<String, bool> _busy = {};
  final Map<int, bool> _active = {};
  String _selected = 'default';
  String _q = '';
  int _page = 0;

  Future<void> _toggleActive(PCampaign c) async {
    final id = c.id;
    if (id == null) return;
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    setState(() => _busy[c.key] = true);
    try {
      await setCampaignActive(ref.read(apiProvider), id, !c.active);
      if (!mounted) return;
      setState(() => _active[id] = !c.active);
      KHaptics.success();
      notes.toast(
        NotificationKind.success,
        c.active ? t('partner.links.pausedToast') : t('partner.links.resumedToast'),
        description: c.active ? t('partner.links.pausedToastText') : t('partner.links.resumedToastText'),
      );
    } on ApiException catch (e) {
      notes.toast(NotificationKind.error, c.active ? t('partner.links.pauseFailed') : t('partner.links.resumeFailed'), description: partnerError(e, t));
    } finally {
      if (mounted) setState(() => _busy[c.key] = false);
    }
  }

  void _create(String code, String base) {
    showKSheet<void>(
      context,
      title: context.t('partner.links.createTitle'),
      builder: (_) => _CreateLinkSheet(code: code, base: base),
    );
  }

  Future<void> _actions(PCampaign c, String link, String code, bool readOnly) async {
    final t = context.t;
    final v = await showKActionSheet<String>(
      context,
      title: c.name,
      message: shortUrl(link),
      actions: [
        KAction(label: t('partner.links.copyLink'), icon: LucideIcons.copy, value: 'copy'),
        KAction(label: t('partner.links.qrCode'), icon: LucideIcons.qrCode, value: 'qr'),
        KAction(label: t('partner.dash.share'), icon: LucideIcons.share2, value: 'share'),
        if (c.id != null && !readOnly)
          KAction(
            label: c.active ? t('partner.links.pause') : t('partner.links.resume'),
            icon: c.active ? LucideIcons.pause : LucideIcons.play,
            value: 'toggle',
          ),
      ],
    );
    if (!mounted) return;
    switch (v) {
      case 'copy':
        await partnerCopy(context, link, t('partner.links.copied'), description: shortUrl(link));
      case 'qr':
        await showPartnerQrSheet(context, value: link, title: '${t('partner.links.qrCode')} · ${c.name}', fileBase: _fileBase(code, c.slug));
      case 'share':
        await kShare(context, link);
      case 'toggle':
        await _toggleActive(c);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = LocaleFormat(t.locale);
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final async = ref.watch(partnerCampaignsProvider);
    final data = async.value;
    if (data == null) {
      return PartnerPageFallback(
        title: t('partner.links.title'),
        subtitle: t('partner.links.subtitle'),
        error: async.hasError ? async.error : null,
        onRetry: () => ref.invalidate(partnerCampaignsProvider),
        skeleton: const [150, 320, 300],
      );
    }

    final code = data.code;
    final base = data.linkBase;
    // default link first, then the newest campaigns
    final campaigns = [
      for (final c in [...data.items.where((c) => c.id == null), ...data.items.where((c) => c.id != null)])
        c.id != null && _active.containsKey(c.id) ? c.withActive(_active[c.id]!) : c,
    ];
    final clicks = campaigns.fold<int>(0, (s, c) => s + c.uniqueClicks);
    final rawClicks = campaigns.fold<int>(0, (s, c) => s + c.clicks);
    final signups = campaigns.fold<int>(0, (s, c) => s + c.signups);
    final ftds = campaigns.fold<int>(0, (s, c) => s + c.ftds);
    final deposits = campaigns.fold<double>(0, (s, c) => s + c.deposits);
    final own = campaigns.where((c) => c.id != null).length;
    final q = _q.trim().toLowerCase();
    final shown = own > 3 && q.isNotEmpty
        ? campaigns.where((c) => '${c.name} ${c.slug} ${c.utmSource ?? ''} ${c.utmCampaign ?? ''}'.toLowerCase().contains(q)).toList()
        : campaigns;
    final pages = math.max(1, (shown.length / _pageSize).ceil());
    final page = _page.clamp(0, pages - 1);
    final view = shown.skip(page * _pageSize).take(_pageSize).toList();
    final kpiWidth = (MediaQuery.sizeOf(context).width - 2 * KSpace.page) * 0.78;
    final sel = campaigns.where((c) => c.key == _selected).firstOrNull ?? campaigns.first;

    return KPageScroll(
      onRefresh: () async {
        setState(_active.clear);
        ref.invalidate(partnerCampaignsProvider);
        await ref.read(partnerCampaignsProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('partner.links.title'), subtitle: Text(t('partner.links.subtitle'))),
        if (!readOnly) ...[
          const SizedBox(height: 14),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KButton(label: t('partner.links.create'), icon: LucideIcons.plus, onPressed: () => _create(code, base)),
          ),
        ],
        const SizedBox(height: 20),
        SizedBox(
          height: 186,
          child: ListView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            physics: const PageScrollPhysics(parent: BouncingScrollPhysics()),
            children: [
              KKpiCard(
                width: kpiWidth,
                label: t('partner.clicks'),
                icon: LucideIcons.mousePointerClick,
                value: Text(f.number(clicks, 0)),
                chip: KChip(label: t('partner.links.uniqueVisitors', {'n': f.number(rawClicks, 0)})),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('partner.signups'),
                icon: LucideIcons.userPlus,
                value: Text(f.number(signups, 0)),
                chip: KChip(
                  label: clicks > 0 ? t('partner.links.pctOfClicks', {'pct': (signups / clicks * 100).toStringAsFixed(1)}) : t('partner.links.fromLinks'),
                  tone: KChipTone.gold,
                ),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('partner.firstDeposits'),
                icon: LucideIcons.wallet,
                value: Text(f.number(ftds, 0)),
                chip: KChip(
                  label: signups > 0 ? t('partner.links.pctOfSignups', {'pct': (ftds / signups * 100).toStringAsFixed(1)}) : t('partner.links.clientsFunded'),
                  tone: KChipTone.ember,
                ),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('partner.links.ftdVolume'),
                icon: LucideIcons.banknote,
                value: Text(money0(deposits)),
                chip: KChip(label: ftds > 0 ? t('partner.links.average', {'amount': money0(deposits / ftds)}) : t('partner.links.sumFtd'), tone: KChipTone.up),
              ),
            ],
          ),
        ),
        kGap,
        KCard(
          padding: const EdgeInsets.fromLTRB(14, 18, 14, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const KIconTile(icon: LucideIcons.link2, size: 36),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t('partner.links.yourLinks'), style: context.text.title2),
                          const SizedBox(height: 3),
                          KRichText(
                            t('partner.links.yourLinksSubtitle', {'code': code}),
                            style: context.text.footnote.copyWith(color: k.fg3),
                            tags: {'code': KTag(style: context.text.mono(12, color: k.fg2))},
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  KChip(label: t('partner.links.ofLimit', {'n': own, 'max': 100})),
                  const Spacer(),
                  if (own > 0)
                    CsvButton(
                      onPressed: () => exportCsv(
                        context,
                        ref,
                        name: 'ezymex-campaign-links',
                        headers: [t('partner.links.link'), t('partner.links.colFunnel'), t('partner.firstDeposits'), t('partner.lots')],
                        rows: [
                          for (final c in shown) [c.name, '${c.uniqueClicks}/${c.signups}/${c.ftds}', c.deposits, c.lots],
                        ],
                      ),
                    ),
                ],
              ),
              if (own > 3) ...[
                const SizedBox(height: 10),
                KSearchField(
                  placeholder: t('partner.links.search'),
                  onChanged: (v) => setState(() {
                    _q = v;
                    _page = 0;
                  }),
                ),
              ],
              const SizedBox(height: 6),
              for (final (i, c) in view.indexed) ...[
                if (i > 0) const KDivider(),
                _LinkRow(
                  c: c,
                  link: campaignLink(base, code, c.slug),
                  busy: _busy[c.key] ?? false,
                  onActions: () => _actions(c, campaignLink(base, code, c.slug), code, readOnly),
                ),
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
              if (own == 0) ...[
                const SizedBox(height: 14),
                CardEmpty(
                  title: t('partner.links.emptyTitle'),
                  text: t('partner.links.emptyText'),
                  child: readOnly
                      ? null
                      : KButton(
                          label: t('partner.links.create'),
                          icon: LucideIcons.plus,
                          variant: KButtonVariant.surface,
                          size: KButtonSize.sm,
                          onPressed: () => _create(code, base),
                        ),
                ),
              ],
            ],
          ),
        ),
        kGap,
        _SnippetCard(campaigns: campaigns, selected: sel, link: campaignLink(base, code, sel.slug), onSelect: (key) => setState(() => _selected = key)),
        kGap,
        _QrCard(
          campaigns: campaigns,
          selected: sel,
          link: campaignLink(base, code, sel.slug),
          fileBase: _fileBase(code, sel.slug),
          onSelect: (key) => setState(() => _selected = key),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ list */

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.c, required this.link, required this.busy, required this.onActions});
  final PCampaign c;
  final String link;
  final bool busy;
  final VoidCallback onActions;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(c.name, style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
                    if (c.id == null) KChip(label: t('partner.links.default'), small: true),
                    if (!c.active) KChip(label: t('partner.links.paused'), tone: KChipTone.warn, small: true),
                  ],
                ),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        shortUrl(link),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textDirection: TextDirection.ltr,
                        style: context.text.mono(11.5, color: k.fg3),
                      ),
                    ),
                    PartnerCopyButton(value: link, size: 30, iconSize: 13),
                  ],
                ),
                if (c.uniqueClicks > 0 || c.signups > 0)
                  _Funnel(c: c)
                else
                  Text(
                    t('partner.links.noClicks'),
                    style: context.text.caption.copyWith(fontSize: 12, color: k.fg3, fontWeight: FontWeight.w400),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          busy
              ? const SizedBox.square(dimension: 40, child: Center(child: CircularProgressIndicator.adaptive(strokeWidth: 2)))
              : KIconButton(icon: LucideIcons.ellipsis, onPressed: onActions, semanticLabel: t('partner.links.actions'), size: 36),
        ],
      ),
    );
  }
}

/// Clicks -> sign-ups -> FTDs bars with the two conversion rates (web Funnel).
class _Funnel extends StatelessWidget {
  const _Funnel({required this.c});
  final PCampaign c;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final steps = [(c.uniqueClicks, k.fg3), (c.signups, k.gold), (c.ftds, k.ember)];
    final top = math.max(math.max(c.uniqueClicks, c.signups), 1);
    final small = context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: SizedBox(
        width: 210,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final (v, color) in steps)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Row(
                  children: [
                    Expanded(
                      child: KProgressBar(value: v == 0 ? 0 : math.max(4, math.sqrt(v / top) * 100) / 100, color: color),
                    ),
                    SizedBox(
                      width: 44,
                      child: Text(
                        Fmt.compact(v),
                        textAlign: TextAlign.end,
                        style: context.text.caption.copyWith(fontSize: 11, color: k.fg2, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                      ),
                    ),
                  ],
                ),
              ),
            Wrap(
              spacing: 8,
              children: [
                if (c.uniqueClicks > 0)
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${t('partner.links.signupRate')} '),
                        TextSpan(
                          text: '${(c.signups / c.uniqueClicks * 100).toStringAsFixed(1)}%',
                          style: TextStyle(color: k.gold),
                        ),
                      ],
                    ),
                    style: small,
                  ),
                if (c.signups > 0)
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${t('partner.links.ftdRate')} '),
                        TextSpan(
                          text: '${(c.ftds / c.signups * 100).toStringAsFixed(1)}%',
                          style: TextStyle(color: k.ember),
                        ),
                      ],
                    ),
                    style: small,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The campaign picker of the snippet and QR cards (web Menu of campaign names).
Future<void> _pickCampaign(BuildContext context, List<PCampaign> campaigns, PCampaign selected, ValueChanged<String> onSelect) async {
  final v = await showKPicker<String>(
    context,
    title: context.t('partner.links.link'),
    selected: selected.key,
    options: [for (final c in campaigns) KPickOption(c.key, c.name, subtitle: c.key == selected.key ? context.t('partner.links.selected') : null)],
  );
  if (v != null) onSelect(v);
}

/* ------------------------------------------------------------------ snippet */

class _SnippetCard extends StatefulWidget {
  const _SnippetCard({required this.campaigns, required this.selected, required this.link, required this.onSelect});
  final List<PCampaign> campaigns;
  final PCampaign selected;
  final String link;
  final ValueChanged<String> onSelect;

  @override
  State<_SnippetCard> createState() => _SnippetCardState();
}

class _SnippetCardState extends State<_SnippetCard> {
  TextEditingController? _text;
  String _style = 'button';

  @override
  void dispose() {
    _text?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final ctl = _text ??= TextEditingController(text: t('partner.links.snippetDefault'));
    final label = ctl.text.trim().isEmpty ? t('partner.links.snippetFallback') : ctl.text.trim();
    final link = widget.link;
    final html = _style == 'link'
        ? '<a href="${_esc(link)}" target="_blank" rel="noopener">${_esc(label)}</a>'
        : '<a href="${_esc(link)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#ff5a1f;'
              'color:#ffffff;font:600 15px/1.2 system-ui,sans-serif;text-decoration:none">${_esc(label)}</a>';
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('partner.links.snippetTitle'), subtitle: t('partner.links.snippetSubtitle'), icon: LucideIcons.code),
          const SizedBox(height: 16),
          KPickerField(
            label: t('partner.links.link'),
            value: widget.selected.name,
            onTap: () => _pickCampaign(context, widget.campaigns, widget.selected, widget.onSelect),
          ),
          const SizedBox(height: 12),
          KTextField(
            label: t('partner.links.text'),
            controller: ctl,
            inputFormatters: [LengthLimitingTextInputFormatter(80)],
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              SizedBox(
                width: 200,
                child: KSegmented<String>(
                  values: const ['button', 'link'],
                  labels: [t('partner.links.button'), t('partner.links.textLink')],
                  selected: _style,
                  plain: true,
                  height: 32,
                  onChanged: (v) => setState(() => _style = v),
                ),
              ),
              const Spacer(),
              Text(
                t('partner.links.preview'),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // a static preview of the snippet (not a live link, so previews never count as clicks)
          Container(
            constraints: const BoxConstraints(minHeight: 84),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.line),
            ),
            child: _style == 'button'
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                    decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(999)),
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white, height: 1.2),
                    ),
                  )
                : Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15, color: Color(0xFF1A0DAB), decoration: TextDecoration.underline, decorationColor: Color(0xFF1A0DAB)),
                  ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            child: Stack(
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 160),
                  child: SingleChildScrollView(
                    padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 44, 12),
                    child: SelectableText(
                      html,
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(11.5, color: k.fg2).copyWith(height: 1.6),
                    ),
                  ),
                ),
                PositionedDirectional(end: 4, top: 4, child: PartnerCopyButton(value: html, size: 36)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ QR */

class _QrCard extends ConsumerStatefulWidget {
  const _QrCard({required this.campaigns, required this.selected, required this.link, required this.fileBase, required this.onSelect});
  final List<PCampaign> campaigns;
  final PCampaign selected;
  final String link, fileBase;
  final ValueChanged<String> onSelect;

  @override
  ConsumerState<_QrCard> createState() => _QrCardState();
}

class _QrCardState extends ConsumerState<_QrCard> {
  final _key = GlobalKey();
  String _theme = 'light';
  String _size = 'M';
  bool _logo = true;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final px = const {'S': 140.0, 'M': 180.0, 'L': 220.0}[_size]!;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('partner.links.qrCode'), subtitle: t('partner.links.qrSubtitle'), icon: LucideIcons.qrCode),
          const SizedBox(height: 16),
          KPickerField(
            value: widget.selected.name,
            leading: Icon(LucideIcons.link2, size: 16, color: k.fg3),
            onTap: () => _pickCampaign(context, widget.campaigns, widget.selected, widget.onSelect),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 22),
            decoration: BoxDecoration(
              color: k.surface2.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: k.line),
            ),
            child: Column(
              children: [
                SizedBox(
                  height: 248,
                  child: Center(
                    child: PartnerQr(value: widget.link, size: px, dark: _theme == 'dark', logo: _logo, boundaryKey: _key),
                  ),
                ),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Text(
                    shortUrl(widget.link),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(11.5, color: k.fg2),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: KSegmented<String>(
                  values: const ['light', 'dark'],
                  labels: [t('partner.links.light'), t('partner.links.dark')],
                  selected: _theme,
                  plain: true,
                  height: 32,
                  onChanged: (v) => setState(() => _theme = v),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: KSegmented<String>(
                  values: const ['S', 'M', 'L'],
                  labels: const ['S', 'M', 'L'],
                  selected: _size,
                  plain: true,
                  height: 32,
                  onChanged: (v) => setState(() => _size = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(t('partner.links.markInCentre'), style: context.text.callout.copyWith(color: k.fg2)),
              ),
              KSwitch(value: _logo, semanticLabel: t('partner.links.logo'), onChanged: (v) => setState(() => _logo = v)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: KButton(
                  label: 'SVG',
                  icon: LucideIcons.download,
                  variant: KButtonVariant.surface,
                  size: KButtonSize.sm,
                  expand: true,
                  onPressed: () => saveQrSvg(context, ref, value: widget.link, fileBase: widget.fileBase, dark: _theme == 'dark', logo: _logo),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: KButton(
                  label: 'PNG',
                  icon: LucideIcons.download,
                  variant: KButtonVariant.surface,
                  size: KButtonSize.sm,
                  expand: true,
                  onPressed: () => saveQrPng(context, ref, boundary: _key, fileBase: widget.fileBase),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ create */

class _CreateLinkSheet extends ConsumerStatefulWidget {
  const _CreateLinkSheet({required this.code, required this.base});
  final String code, base;

  @override
  ConsumerState<_CreateLinkSheet> createState() => _CreateLinkSheetState();
}

class _CreateLinkSheetState extends ConsumerState<_CreateLinkSheet> {
  final _name = TextEditingController();
  final _slug = TextEditingController();
  final _src = TextEditingController();
  final _medium = TextEditingController();
  final _camp = TextEditingController();
  bool _busy = false;
  ({String? field, String message})? _err;

  @override
  void dispose() {
    for (final c in [_name, _slug, _src, _medium, _camp]) {
      c.dispose();
    }
    super.dispose();
  }

  String get _effSlug => _slug.text.trim().isNotEmpty ? _slug.text.trim().toLowerCase() : slugPreview(_name.text);
  bool get _slugOk => _slug.text.trim().isEmpty || RegExp(r'^[a-z0-9_-]{1,40}$', caseSensitive: false).hasMatch(_slug.text.trim());
  bool get _valid => _name.text.trim().isNotEmpty && _effSlug.isNotEmpty && _slugOk && !_busy;

  String? _fieldErr(String f) => _err?.field == f ? _err!.message : null;

  Future<void> _submit() async {
    if (!_valid) return;
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final r = await createCampaign(
        ref.read(apiProvider),
        name: _name.text.trim(),
        slug: _slug.text.trim(),
        utmSource: _src.text.trim(),
        utmMedium: _medium.text.trim(),
        utmCampaign: _camp.text.trim(),
      );
      final link = campaignLink(widget.base, widget.code, r.slug);
      await Clipboard.setData(ClipboardData(text: link));
      KHaptics.success();
      notes.toast(NotificationKind.success, t('partner.links.createdToast'), description: shortUrl(link));
      ref.invalidate(partnerCampaignsProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.field != null || e.code == 'exists' || e.code == 'limit') {
        setState(() => _err = (field: e.field ?? (e.code == 'exists' ? 'slug' : null), message: localizeError(e, t)));
      } else {
        notes.toast(NotificationKind.error, t('partner.links.createFailed'), description: partnerError(e, t));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final eff = _effSlug;
    final url = eff.isNotEmpty ? campaignLink(widget.base, widget.code, eff) : null;
    final optional = Text(
      t('partner.optional'),
      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
    );
    void changed(String _) => setState(() {});
    return KSheetContent(
      footer: KButton(
        label: _busy ? t('partner.links.creating') : t('partner.links.create'),
        icon: LucideIcons.plus,
        size: KButtonSize.lg,
        expand: true,
        loading: _busy,
        onPressed: _valid ? _submit : null,
      ),
      children: [
        Text(
          t('partner.links.createDescription'),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3),
        ),
        const SizedBox(height: 16),
        KTextField(
          label: t('common.name'),
          placeholder: t('partner.links.namePlaceholder'),
          controller: _name,
          autofocus: true,
          error: _fieldErr('name'),
          textInputAction: TextInputAction.next,
          inputFormatters: [LengthLimitingTextInputFormatter(60)],
          onChanged: changed,
        ),
        const SizedBox(height: 12),
        KTextField(
          label: t('partner.links.slugLabel'),
          hint: optional,
          placeholder: slugPreview(_name.text).isNotEmpty ? slugPreview(_name.text) : t('partner.links.slugPlaceholder'),
          controller: _slug,
          ltr: true,
          error: _fieldErr('slug') ?? (_slugOk ? null : t('partner.links.slugInvalid')),
          textInputAction: TextInputAction.next,
          inputFormatters: [LengthLimitingTextInputFormatter(40)],
          onChanged: changed,
        ),
        for (final (key, label, ctl, hint) in [
          ('utmSource', 'utm_source', _src, 'youtube'),
          ('utmMedium', 'utm_medium', _medium, 'video'),
          ('utmCampaign', 'utm_campaign', _camp, 'gold-webinar'),
        ]) ...[
          const SizedBox(height: 12),
          KTextField(
            label: label,
            hint: optional,
            placeholder: hint,
            controller: ctl,
            ltr: true,
            error: _fieldErr(key),
            textInputAction: key == 'utmCampaign' ? TextInputAction.done : TextInputAction.next,
            inputFormatters: [LengthLimitingTextInputFormatter(60)],
            onSubmitted: key == 'utmCampaign' ? (_) => _submit() : null,
          ),
        ],
        if (_err != null && _err!.field == null) ...[const SizedBox(height: 12), KFormError(_err!.message)],
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: k.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                t('partner.links.yourLink'),
                style: context.text.caption.copyWith(fontSize: 12, color: k.fg3, fontWeight: FontWeight.w400),
              ),
              const SizedBox(height: 4),
              Text(
                url != null ? shortUrl(url) : t('partner.links.enterName'),
                textDirection: url != null ? TextDirection.ltr : null,
                textAlign: Directionality.of(context) == TextDirection.rtl && url != null ? TextAlign.right : TextAlign.start,
                style: context.text.mono(12.5, color: k.fg),
              ),
              const SizedBox(height: 4),
              Text(
                t('partner.links.yourLinkHint'),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
