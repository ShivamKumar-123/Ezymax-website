// API & Algo › Webhooks (/developer/webhooks): port of apps/crm/components/algo/webhooks-page.tsx (LiveWebhooksPage).
// Phone order (xl grid collapsed): header (New webhook) · the URL shown once · your webhooks (select) · alert format ·
// the selected webhook (active switch, ⋯ rotate / passphrase / delete, accounts & sizing, send a test alert) ·
// activity (alerts and per-account results). Create sheet: name, passphrase, accounts & sizing.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'developer_api.dart';
import 'widgets/algo_widgets.dart';

const _sample = '''{
  "passphrase": "your-passphrase",
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "volume": {{strategy.order.contracts}},
  "sl_pips": 20,
  "tp_pips": 40,
  "id": "{{strategy.order.id}}-{{timenow}}",
  "timestamp": "{{timenow}}"
}''';

const _sizingModes = ['fixed', 'alert', 'multiplier', 'risk'];

KChipTone _eventTone(String s) => switch (s) {
  'accepted' => KChipTone.up,
  'partial' => KChipTone.warn,
  'received' => KChipTone.neutral,
  _ => KChipTone.down,
};

class DeveloperWebhooksScreen extends ConsumerStatefulWidget {
  const DeveloperWebhooksScreen({super.key});

  @override
  ConsumerState<DeveloperWebhooksScreen> createState() => _DeveloperWebhooksScreenState();
}

class _DeveloperWebhooksScreenState extends ConsumerState<DeveloperWebhooksScreen> {
  final _detailKey = GlobalKey();
  final _test = TextEditingController(text: '{"action": "buy", "symbol": "BTCUSD", "volume": 0.01}');
  String? _shown;
  int? _selected;
  int? _routesFor;
  List<HookRoute>? _routes;
  bool _busy = false;

  @override
  void dispose() {
    _test.dispose();
    super.dispose();
  }

  Future<void> _refresh(int? sel) async {
    ref
      ..invalidate(webhooksProvider)
      ..invalidate(algoAccountsProvider);
    if (sel != null) ref.invalidate(webhookDetailProvider(sel));
    await ref.read(webhooksProvider.future).then((_) {}, onError: (Object _) {});
  }

  Future<void> _create(List<AlgoAccount> accounts) async {
    final url = await showKSheet<String>(
      context,
      title: context.t('developer.hooks.new'),
      builder: (_) => _CreateHookSheet(accounts: accounts),
    );
    if (url == null || !mounted) return;
    setState(() => _shown = url);
    ref.invalidate(webhooksProvider);
  }

  Future<void> _patch(int sel, Map<String, Object?> body) async {
    final t = context.t;
    try {
      await ref.read(apiProvider).algoPatch('webhooks/$sel', body);
      ref
        ..invalidate(webhookDetailProvider(sel))
        ..invalidate(webhooksProvider);
    } on Object catch (e) {
      algoFail(ref, t, t('developer.hooks.updateFailed'), e);
    }
  }

  Future<void> _saveRoutes(int sel, List<HookRoute> routes) async {
    final t = context.t;
    try {
      await ref.read(apiProvider).algoPut('webhooks/$sel/routes', {
        'routes': [for (final r in routes) r.toJson()],
      });
      algoOk(ref, t('developer.hooks.accountsSaved'));
      setState(() => _routes = null);
      ref.invalidate(webhookDetailProvider(sel));
    } on Object catch (e) {
      algoFail(ref, t, t('developer.hooks.accountsFailed'), e);
    }
  }

  Future<void> _menu(HookDetail d) async {
    final t = context.t;
    final sel = d.hook.id;
    final pick = await showKActionSheet<String>(
      context,
      title: d.hook.name,
      actions: [
        KAction(label: t('developer.hooks.rotate'), value: 'rotate', icon: LucideIcons.refreshCcw),
        KAction(label: d.hook.passphrase ? t('developer.hooks.removePass') : t('developer.hooks.setPass'), value: 'pass'),
        KAction(label: t('developer.hooks.delete'), value: 'delete', icon: LucideIcons.trash2, destructive: true),
      ],
    );
    if (!mounted || pick == null) return;
    final api = ref.read(apiProvider);
    switch (pick) {
      case 'rotate':
        try {
          final r = await api.algoPost('webhooks/$sel/rotate');
          setState(() => _shown = jS(r['url']));
          algoOk(ref, t('developer.hooks.rotated'), description: t('developer.hooks.rotatedText'));
          ref.invalidate(webhooksProvider);
        } on Object catch (e) {
          algoFail(ref, t, t('developer.hooks.rotateFailed'), e);
        }
      case 'pass':
        if (d.hook.passphrase) {
          await _patch(sel, {'passphrase': null});
        } else {
          final pass = await showKSheet<String>(context, title: t('developer.hooks.setPass'), builder: (_) => const _PassphraseSheet());
          if (pass != null && mounted) await _patch(sel, {'passphrase': pass});
        }
      case 'delete':
        try {
          await api.algoDelete('webhooks/$sel');
          algoOk(ref, t('developer.hooks.deleted'));
          setState(() => _selected = null);
          ref.invalidate(webhooksProvider);
        } on Object catch (e) {
          algoFail(ref, t, t('developer.hooks.deleteFailed'), e);
        }
    }
  }

  Future<void> _sendTest(int sel) async {
    final t = context.t;
    Object? payload;
    try {
      payload = jsonDecode(_test.text);
    } on FormatException {
      ref.read(notificationsProvider.notifier).toast(NotificationKind.error, t('developer.hooks.invalidJson'));
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).algoPost('webhooks/$sel/test', {'payload': payload});
      String st(Object? s) => t.dyn('developer.hookStatus.$s', fallback: '$s');
      final results = jList(r['results'])
          .map((x) => '#${x['login']}: ${st(x['status'])}${x['ticket'] != null ? ' #${x['ticket']}' : ''}${x['error'] != null ? ' (${x['error']})' : ''}')
          .join(' · ');
      algoOk(ref, t('developer.hooks.alertStatus', {'status': st(r['status'])}), description: results);
      ref.invalidate(webhookDetailProvider(sel));
    } on Object catch (e) {
      algoFail(ref, t, t('developer.hooks.testFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final list = ref.watch(webhooksProvider);
    final accounts = ref.watch(algoAccountsProvider).value ?? const <AlgoAccount>[];
    final hooks = list.value?.items ?? const <Hook>[];
    final sel = _selected ?? (hooks.isEmpty ? null : hooks.first.id);
    if (_routesFor != sel) {
      _routesFor = sel;
      _routes = null;
    }
    final detail = sel == null ? null : ref.watch(webhookDetailProvider(sel));

    return KPageScroll(
      onRefresh: () => _refresh(sel),
      children: [
        KPageHeader(title: t('developer.hooks.title'), subtitle: Text(t('developer.hooks.subtitle'))),
        if (!readOnly) ...[
          const SizedBox(height: 14),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KButton(
              label: t('developer.hooks.new'),
              icon: LucideIcons.plus,
              onPressed: accounts.isEmpty ? null : () => _create(accounts.where((a) => a.active).toList()),
            ),
          ),
        ],
        const SizedBox(height: 20),
        if (_shown != null) ...[_UrlOnceCard(url: _shown!, onDone: () => setState(() => _shown = null)), const SizedBox(height: 16)],
        // your webhooks
        KCard(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(icon: LucideIcons.webhook, title: t('developer.hooks.yours'), subtitle: t('developer.hooks.nOf', {'n': hooks.length, 'max': 20})),
              const SizedBox(height: 8),
              KAsync(
                value: list,
                onRetry: () => ref.invalidate(webhooksProvider),
                loading: const Padding(padding: EdgeInsets.only(bottom: 8), child: KSkeleton(height: 72, radius: 14)),
                error: (e) => KLoadError(error: e, card: false, onRetry: () => ref.invalidate(webhooksProvider)),
                builder: (d) => d.items.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
                        child: Text(t('developer.hooks.none'), style: context.text.footnote.copyWith(color: k.fg3)),
                      )
                    : Column(
                        children: [
                          for (final h in d.items)
                            _HookRow(
                              h: h,
                              selected: h.id == sel,
                              onTap: () {
                                setState(() => _selected = h.id);
                                revealLater(_detailKey);
                              },
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // alert format
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.hooks.alertFormat'), subtitle: t('developer.hooks.alertFormatSub')),
              const SizedBox(height: 12),
              const CodeBlock(_sample),
              const SizedBox(height: 10),
              KRichText(
                t('developer.hooks.formatNote'),
                style: context.text.footnote.copyWith(color: k.fg3),
                tags: {
                  'b': KTag(
                    style: TextStyle(color: k.fg2, fontWeight: FontWeight.w600),
                  ),
                  'code': KTag(style: context.text.mono(11.5, color: k.fg2)),
                },
              ),
              const SizedBox(height: 8),
              KRichText(
                t('developer.hooks.replayNote'),
                style: context.text.footnote.copyWith(color: k.fg3),
                tags: {'code': KTag(style: context.text.mono(11.5, color: k.fg2))},
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // the selected webhook
        KeyedSubtree(
          key: _detailKey,
          child: sel == null
              ? (list.hasValue
                    ? KCard(
                        child: KEmptyState(icon: LucideIcons.webhook, title: t('developer.hooks.emptyTitle'), text: t('developer.hooks.emptyText')),
                      )
                    : const SizedBox.shrink())
              : KAsync(
                  value: detail!,
                  skeletonHeight: 420,
                  onRetry: () => ref.invalidate(webhookDetailProvider(sel)),
                  builder: (d) => _detail(context, d, accounts, readOnly),
                ),
        ),
      ],
    );
  }

  Widget _detail(BuildContext context, HookDetail d, List<AlgoAccount> accounts, bool readOnly) {
    final t = context.t;
    final k = context.k;
    final h = d.hook;
    final routes = _routes ?? d.routes;
    final subtitle =
        '${t('developer.hooks.urlEnding', {'hint': h.tokenHint})} · ${h.passphrase ? t('developer.hooks.passRequired') : t('developer.hooks.noPass')} · ${t('developer.hooks.createdAt', {'at': fmtDateTime(h.createdAt)})}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(
                title: h.name,
                subtitle: subtitle,
                action: readOnly
                    ? null
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          KSwitch(
                            value: h.status == 'active',
                            semanticLabel: t('common.active'),
                            onChanged: (on) => _patch(h.id, {'status': on ? 'active' : 'disabled'}),
                          ),
                          KIconButton(icon: LucideIcons.ellipsis, size: 34, semanticLabel: t('developer.hooks.actions'), onPressed: () => _menu(d)),
                        ],
                      ),
              ),
              const SizedBox(height: 14),
              Text(t('developer.hooks.routesLabel'), style: context.text.footnote.copyWith(color: k.fg3)),
              const SizedBox(height: 8),
              RoutesEditor(routes: routes, accounts: accounts, readOnly: readOnly, onChanged: (r) => setState(() => _routes = r)),
              if (_routes != null && !readOnly) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    KButton(label: t('developer.hooks.saveAccounts'), size: KButtonSize.sm, onPressed: () => _saveRoutes(h.id, _routes!)),
                    const SizedBox(width: 8),
                    KButton(
                      label: t('developer.hooks.discard'),
                      variant: KButtonVariant.surface,
                      size: KButtonSize.sm,
                      onPressed: () => setState(() => _routes = null),
                    ),
                  ],
                ),
              ],
              if (!readOnly) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: k.surface2.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: k.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: '${t('developer.hooks.sendTest')} '),
                            TextSpan(
                              text: t('developer.hooks.realOrders'),
                              style: TextStyle(color: k.warn),
                            ),
                          ],
                        ),
                        style: context.text.footnote.copyWith(color: k.fg3),
                      ),
                      const SizedBox(height: 8),
                      CodeField(controller: _test, maxLines: 5, semanticLabel: t('developer.hooks.testJson')),
                      const SizedBox(height: 8),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: KButton(
                          label: t('developer.hooks.sendTestShort'),
                          icon: LucideIcons.send,
                          variant: KButtonVariant.surface,
                          size: KButtonSize.sm,
                          loading: _busy,
                          onPressed: () => _sendTest(h.id),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        // activity
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.keys.activity'), subtitle: t('developer.hooks.activitySub')),
              const SizedBox(height: 6),
              if (d.events.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text(
                    t('developer.hooks.noAlerts'),
                    textAlign: TextAlign.center,
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ),
              for (var i = 0; i < d.events.length; i++) ...[if (i > 0) const KDivider(), _EventRow(e: d.events[i])],
            ],
          ),
        ),
      ],
    );
  }
}

class _HookRow extends StatelessWidget {
  const _HookRow({required this.h, required this.selected, required this.onTap});
  final Hook h;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KPressable(
      onTap: onTap,
      pressedScale: 0.99,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(color: selected ? k.surface3 : Colors.transparent, borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(h.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.headline.copyWith(fontSize: 14)),
                ),
                KChip(
                  label: t.dyn('developer.hookState.${h.status}', fallback: h.status),
                  tone: h.status == 'active' ? KChipTone.up : KChipTone.neutral,
                  small: true,
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              '…${h.tokenHint} · ${t('developer.hooks.nAccounts', {'count': h.routeCount})} · ${t('developer.hooks.alertsToday', {'count': h.events24h})} · ${t('developer.hooks.used', {'ago': algoAgo(t, h.lastUsedAt)})}',
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ],
        ),
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.e});
  final HookEvent e;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = e.payload;
    final alert = '${p?['action'] ?? '?'} ${p?['symbol'] ?? ''}${p?['volume'] != null ? ' · ${p!['volume']}' : ''}';
    String st(Object? s) => t.dyn('developer.hookStatus.$s', fallback: '$s');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  alert,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(12.5, color: k.fg),
                ),
              ),
              KChip(label: st(e.status), tone: _eventTone(e.status), small: true),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            '${fmtDateTime(e.receivedAt)}${e.ip != null ? ' · ${e.ip}' : ''}',
            textDirection: TextDirection.ltr,
            style: context.text.mono(11, color: k.fg3),
          ),
          if (e.error != null) ...[
            const SizedBox(height: 3),
            Text(
              e.error!,
              style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w400),
            ),
          ],
          for (final r in e.results)
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                '#${r['login']} ${st(r['status'])}${r['ticket'] != null ? ' #${r['ticket']}' : ''}${r['volume'] != null && r['volume'] != 0 ? ' ${r['volume']} ${t('developer.unit.lot')}' : ''}${r['error'] != null ? ' · ${r['error']}' : ''}',
                style: context.text.caption.copyWith(color: r['status'] == 'rejected' ? k.down : k.fg2, fontWeight: FontWeight.w400),
              ),
            ),
        ],
      ),
    );
  }
}

/// The webhook URL, shown once after creating or rotating (web border-ember card).
class _UrlOnceCard extends StatelessWidget {
  const _UrlOnceCard({required this.url, required this.onDone});
  final String url;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(k.cardRadius),
        border: Border.all(color: k.ember.withValues(alpha: 0.4)),
      ),
      child: KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(t('developer.hooks.urlOnce'), style: context.text.headline.copyWith(fontSize: 14)),
            const SizedBox(height: 2),
            Text(t('developer.hooks.urlOnceText'), style: context.text.footnote.copyWith(color: k.fg3)),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsetsDirectional.only(start: 12, end: 2),
              decoration: BoxDecoration(color: k.dark ? Colors.black.withValues(alpha: 0.3) : k.surface2, borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      url,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(12, color: k.ember),
                    ),
                  ),
                  CopyIcon(url, label: t('developer.hooks.webhookUrl')),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KButton(label: t('common.done'), variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: onDone),
            ),
          ],
        ),
      ),
    );
  }
}

/// Accounts & sizing of a webhook (web RoutesEditor): one row per account, + Add account.
class RoutesEditor extends StatelessWidget {
  const RoutesEditor({super.key, required this.routes, required this.onChanged, required this.accounts, this.readOnly = false});
  final List<HookRoute> routes;
  final ValueChanged<List<HookRoute>> onChanged;
  final List<AlgoAccount> accounts;
  final bool readOnly;

  String _unit(T t, String mode) => switch (mode) {
    'fixed' => t('developer.unit.lot'),
    'multiplier' => '×',
    'risk' => '%',
    _ => '',
  };

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final free = accounts.where((a) => a.active && !routes.any((r) => r.login == a.login)).toList();
    void set(int i, void Function(HookRoute r) change) {
      final next = [for (final r in routes) r.copy()];
      change(next[i]);
      onChanged(next);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < routes.length; i++)
          Builder(
            builder: (context) {
              final r = routes[i];
              final a = accounts.where((x) => x.login == r.login).firstOrNull;
              final type = a?.type ?? r.accountType ?? 'demo';
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.fromLTRB(12, 8, 6, 10),
                decoration: BoxDecoration(
                  color: k.surface2.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: k.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        KChip(label: accountTypeLabel(t, type).toUpperCase(), tone: type == 'live' ? KChipTone.ember : KChipTone.gold, small: true),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text('#${r.login}', style: context.text.mono(13, color: k.fg)),
                        ),
                        KSwitch(value: r.enabled, semanticLabel: t('common.enabled'), onChanged: readOnly ? null : (v) => set(i, (x) => x.enabled = v)),
                        if (!readOnly)
                          KPressable(
                            semanticLabel: t('developer.hooks.removeAccount'),
                            minSize: 40,
                            onTap: () => onChanged([
                              for (var j = 0; j < routes.length; j++)
                                if (j != i) routes[j],
                            ]),
                            child: Icon(LucideIcons.trash2, size: 16, color: k.fg3),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        MenuChip(
                          label: t('developer.hooks.sizing.${r.mode}'),
                          onTap: readOnly
                              ? null
                              : () async {
                                  final m = await showKPicker<String>(
                                    context,
                                    title: t('developer.hooks.sizing'),
                                    selected: r.mode,
                                    options: [for (final s in _sizingModes) KPickOption(s, t('developer.hooks.sizing.$s'))],
                                  );
                                  if (m == null) return;
                                  set(i, (x) {
                                    x.mode = m;
                                    x.value = switch (m) {
                                      'fixed' => 0.01,
                                      'risk' || 'multiplier' => 1,
                                      _ => 0,
                                    };
                                  });
                                },
                        ),
                        if (r.mode != 'alert')
                          NumField(
                            value: r.value,
                            min: 0,
                            suffix: _unit(t, r.mode),
                            semanticLabel: t('developer.hooks.sizingValue'),
                            onChanged: (v) => set(i, (x) => x.value = v),
                          ),
                        Text(t('developer.hooks.max'), style: context.text.footnote.copyWith(color: k.fg3)),
                        NumField(
                          value: r.maxLots ?? 0,
                          min: 0,
                          suffix: t('developer.unit.lot'),
                          semanticLabel: t('developer.builder.maxLots'),
                          onChanged: (v) => set(i, (x) => x.maxLots = v == 0 ? null : v),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        if (!readOnly && free.isNotEmpty && routes.length < 10)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: DashedPill(
              label: t('developer.hooks.addAccount'),
              onTap: () async {
                final login = await showKPicker<int>(
                  context,
                  title: t('developer.hooks.addAccount'),
                  options: [for (final a in free) KPickOption(a.login, '${accountTypeLabel(t, a.type)} #${a.login}', subtitle: a.groupName)],
                );
                if (login == null) return;
                onChanged([...routes, HookRoute(login: login, mode: 'fixed', value: 0.01)]);
              },
            ),
          ),
      ],
    );
  }
}

/// New webhook (web CreateDialog).
class _CreateHookSheet extends ConsumerStatefulWidget {
  const _CreateHookSheet({required this.accounts});
  final List<AlgoAccount> accounts;

  @override
  ConsumerState<_CreateHookSheet> createState() => _CreateHookSheetState();
}

class _CreateHookSheetState extends ConsumerState<_CreateHookSheet> {
  late final TextEditingController _name = TextEditingController(text: context.t('developer.hooks.defaultName'));
  final TextEditingController _pass = TextEditingController();
  List<HookRoute> _routes = [];
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.accounts.isNotEmpty) {
      final a = widget.accounts.where((x) => x.type == 'demo' && x.active).firstOrNull ?? widget.accounts.first;
      _routes = [HookRoute(login: a.login, mode: 'fixed', value: 0.01)];
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).algoPost('webhooks', {
        'name': _name.text,
        if (_pass.text.isNotEmpty) 'passphrase': _pass.text,
        'routes': [for (final x in _routes) x.toJson()],
      });
      if (!mounted) return;
      KHaptics.success();
      Navigator.of(context).pop(jS(r['url']));
    } on Object catch (e) {
      algoFail(ref, t, t('developer.hooks.createFailed'), e);
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KSheetContent(
      footer: KButton(
        label: t('developer.hooks.create'),
        icon: LucideIcons.webhook,
        expand: true,
        size: KButtonSize.lg,
        loading: _busy,
        onPressed: _routes.isEmpty ? null : _create,
      ),
      children: [
        Text(
          t('developer.hooks.newText'),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: context.k.fg3),
        ),
        const SizedBox(height: 16),
        KTextField(label: t('common.name'), controller: _name),
        const SizedBox(height: 14),
        KTextField(label: t('developer.hooks.passphraseLabel'), placeholder: t('developer.hooks.passphrasePlaceholder'), controller: _pass),
        const SizedBox(height: 16),
        FieldLabel(t('developer.hooks.accountsSizing')),
        RoutesEditor(routes: _routes, accounts: widget.accounts, onChanged: (r) => setState(() => _routes = r)),
      ],
    );
  }
}

/// A new passphrase (web window.prompt).
class _PassphraseSheet extends StatefulWidget {
  const _PassphraseSheet();

  @override
  State<_PassphraseSheet> createState() => _PassphraseSheetState();
}

class _PassphraseSheetState extends State<_PassphraseSheet> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KSheetContent(
      footer: KButton(label: t('common.save'), expand: true, size: KButtonSize.lg, onPressed: () => Navigator.of(context).pop(_c.text)),
      children: [KTextField(label: t('developer.hooks.newPass'), controller: _c, autofocus: true)],
    );
  }
}
