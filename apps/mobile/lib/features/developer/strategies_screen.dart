// API & Algo › Strategy builder (/developer/strategies): port of apps/crm/components/algo/strategies-page.tsx
// (LiveStrategiesPage). Phone order (the web's order-1/2/3): header (Running strategies, Backtest, New strategy) ·
// the editor (name, version / validity chips, Visual / Code, ⋯ archive, Save; symbol + timeframe, signals, rules,
// risk & session — or the code with its errors and the reference) · my strategies · templates · AI assistant ·
// deploy 24/7 · recent backtests. Validation on the server (POST validate, debounced), immutable versions.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'deployments_screen.dart' show SignalSummary;
import 'developer_api.dart';
import 'strategy_spec.dart';
import 'widgets/ai_chat.dart';
import 'widgets/algo_widgets.dart';
import 'widgets/builder.dart';

class DeveloperStrategiesScreen extends ConsumerStatefulWidget {
  const DeveloperStrategiesScreen({super.key, this.query = const {}});
  final Map<String, String> query;

  @override
  ConsumerState<DeveloperStrategiesScreen> createState() => _DeveloperStrategiesScreenState();
}

class _DeveloperStrategiesScreenState extends ConsumerState<DeveloperStrategiesScreen> {
  final _editorKey = GlobalKey();
  final _name = TextEditingController();
  final _code = TextEditingController();
  int? _selected;
  StrategyDetail? _detail;
  String _mode = 'visual';
  Json _spec = {};
  bool _codeEdited = false;
  Built? _built;
  bool _validating = false;
  bool _dirty = false;
  bool _saving = false;
  String? _prompt;
  String _origin = 'template';
  bool _inited = false;
  bool _autoPicked = false;
  Timer? _debounce;
  int _seq = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_inited) return;
    _inited = true;
    final t = context.t;
    _spec = kTemplates.first.make(t);
    _name.text = t('developer.tpl.ema.name');
    final id = int.tryParse(widget.query['id'] ?? '');
    if (id != null) {
      _selected = id;
      _autoPicked = true;
      unawaited(_load(id));
    } else {
      _validate();
    }
  }

  @override
  void didUpdateWidget(DeveloperStrategiesScreen old) {
    super.didUpdateWidget(old);
    final id = int.tryParse(widget.query['id'] ?? '');
    if (id != null && widget.query['id'] != old.query['id'] && id != _selected) {
      setState(() => _selected = id);
      unawaited(_load(id));
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  Map<String, Object?> get _payload => _mode == 'code'
      ? {'kind': 'code', 'source': _code.text, 'symbol': _spec['symbol'], 'timeframe': _spec['timeframe']}
      : {
          'kind': 'visual',
          'spec': {..._spec, 'name': _name.text},
        };

  /// Server-side validation, debounced (web: useDebounced 350 ms + POST validate).
  void _validate() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      final seq = ++_seq;
      final mode = _mode;
      if (mounted) setState(() => _validating = true);
      try {
        final b = Built(await ref.read(apiProvider).algoPost('validate', _payload));
        if (!mounted || seq != _seq) return;
        setState(() {
          _built = b;
          if (mode == 'visual' && !_codeEdited) _code.text = b.code;
          if (mode == 'code' && RegExp(r'\bname\(').hasMatch(_code.text)) _name.text = jS(b.spec['name']);
        });
      } on Object catch (_) {
        // the editor keeps the last result
      } finally {
        if (mounted && seq == _seq) setState(() => _validating = false);
      }
    });
  }

  Future<void> _load(int id) async {
    final t = context.t;
    try {
      final d = StrategyDetail(await ref.read(apiProvider).algoGet('strategies/$id'));
      if (!mounted) return;
      setState(() {
        _detail = d;
        _name.text = d.name;
        if (d.current.kind == 'code') {
          _mode = 'code';
          _code.text = d.current.source ?? d.current.code;
          _codeEdited = true;
          _spec = {..._spec, 'symbol': d.symbol, 'timeframe': d.timeframe};
        } else {
          _mode = 'visual';
          _spec = jClone(d.current.spec);
          _code.text = d.current.code;
          _codeEdited = false;
        }
        _built = d.current;
        _dirty = false;
        _prompt = null;
      });
    } on Object catch (e) {
      algoFail(ref, t, t('developer.strat.openFailed'), e);
    }
  }

  void _editSpec(Json s) {
    setState(() {
      _spec = s;
      _dirty = true;
    });
    _validate();
  }

  void _editCode(String _) {
    setState(() {
      _codeEdited = true;
      _dirty = true;
    });
    _validate();
  }

  void _switchMode(String m) {
    if (m == _mode) return;
    final t = context.t;
    if (m == 'code') {
      setState(() {
        _code.text = _built?.code ?? _code.text;
        _mode = 'code';
      });
      _validate();
      return;
    }
    final notes = ref.read(notificationsProvider.notifier);
    if (_codeEdited && _detail?.current.kind == 'code') {
      notes.toast(NotificationKind.error, t('developer.strat.codeStays'), description: t('developer.strat.codeStaysText'));
      return;
    }
    if (_codeEdited) {
      notes.toast(NotificationKind.neutral, t('developer.strat.codeDiscarded'), description: t('developer.strat.codeDiscardedText'));
      _codeEdited = false;
    }
    setState(() => _mode = 'visual');
    _validate();
  }

  void _newFrom(StrategyTemplate? tpl) {
    final t = context.t;
    final s = tpl != null
        ? tpl.make(t)
        : {...defaultSpec(t, symbol: jS(_spec['symbol']), timeframe: jS(_spec['timeframe'])), 'name': t('developer.strat.untitled')};
    setState(() {
      _selected = null;
      _detail = null;
      _spec = s;
      _name.text = jS(s['name']);
      _mode = 'visual';
      _codeEdited = false;
      _dirty = true;
      _origin = tpl != null ? 'template' : 'manual';
      _prompt = null;
    });
    _validate();
    revealLater(_editorKey);
  }

  Future<void> _save() async {
    final t = context.t;
    setState(() => _saving = true);
    try {
      final body = {..._payload, 'name': _name.text, if (!_dirty) 'note': 'resave', 'origin': _origin, 'prompt': ?_prompt};
      final api = ref.read(apiProvider);
      final r = _detail != null ? await api.algoPost('strategies/${_detail!.id}/versions', body) : await api.algoPost('strategies', body);
      algoOk(
        ref,
        _detail != null ? t('developer.strat.savedAs', {'version': jI(r['version'])}) : t('developer.strat.saved', {'name': _name.text}),
        description: r['valid'] == true ? t('developer.strat.readyText') : t('developer.strat.draftText'),
      );
      ref.invalidate(strategiesProvider);
      final id = jI(r['id']);
      setState(() {
        _dirty = false;
        _selected = id;
      });
      await _load(id);
    } on Object catch (e) {
      algoFail(ref, t, t('developer.strat.saveFailed'), e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _archive() async {
    final d = _detail;
    if (d == null) return;
    final t = context.t;
    try {
      await ref.read(apiProvider).algoPatch('strategies/${d.id}', {'status': 'archived'});
      algoOk(ref, t('developer.strat.archived', {'name': d.name}));
      ref.invalidate(strategiesProvider);
      _newFrom(kTemplates.first);
    } on Object catch (e) {
      algoFail(ref, t, t('developer.strat.archiveFailed'), e);
    }
  }

  void _applyAi(Built b, String p) {
    final t = context.t;
    setState(() {
      _prompt = p;
      _origin = 'ai';
      if (b.kind == 'code') {
        _mode = 'code';
        _code.text = b.source ?? b.code;
        _codeEdited = true;
        _spec = {..._spec, 'symbol': b.spec['symbol'], 'timeframe': b.spec['timeframe']};
      } else {
        _mode = 'visual';
        _spec = jClone(b.spec);
        _codeEdited = false;
      }
      _name.text = jS(b.spec['name']);
      _dirty = true;
    });
    _validate();
    algoOk(ref, t('developer.strat.applied'), description: t('developer.strat.appliedText'));
    revealLater(_editorKey);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final meta = ref.watch(algoMetaProvider);
    final list = ref.watch(strategiesProvider);
    final items = list.value ?? const <StrategyItem>[];

    // first load only: open the newest strategy when no id is given
    if (!_autoPicked && list.hasValue) {
      _autoPicked = true;
      if (_selected == null && items.isNotEmpty) {
        final id = items.first.id;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          setState(() => _selected = id);
          unawaited(_load(id));
        });
      }
    }

    final detail = _detail;
    final built = _built;
    final errors = built?.errors ?? const <BuildError>[];

    return KPageScroll(
      onRefresh: () async {
        ref
          ..invalidate(strategiesProvider)
          ..invalidate(algoAccountsProvider);
        if (detail != null) await _load(detail.id);
      },
      children: [
        KPageHeader(title: t('developer.bt.strategyBuilder'), subtitle: Text(t('developer.strat.subtitle'))),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            KButton(
              label: t('developer.dep.title'),
              icon: LucideIcons.workflow,
              variant: KButtonVariant.surface,
              size: KButtonSize.sm,
              onPressed: () => context.go('/developer/deployments'),
            ),
            KButton(
              label: t('developer.strat.backtest'),
              icon: LucideIcons.flaskConical,
              variant: KButtonVariant.surface,
              size: KButtonSize.sm,
              onPressed: () => context.go(detail != null ? '/developer/backtests?strategy=${detail.id}' : '/developer/backtests'),
            ),
            if (!readOnly)
              KButton(
                label: t('developer.strat.new'),
                icon: LucideIcons.plus,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: () => _newFrom(null),
              ),
          ],
        ),
        const SizedBox(height: 20),
        // 1. the editor
        KeyedSubtree(
          key: _editorKey,
          child: KCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _name,
                  readOnly: readOnly,
                  inputFormatters: [LengthLimitingTextInputFormatter(60)],
                  onChanged: (_) {
                    setState(() => _dirty = true);
                    _validate();
                  },
                  style: context.text.title1,
                  cursorColor: k.ember,
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: t('developer.strat.nameAria'),
                    contentPadding: const EdgeInsets.symmetric(vertical: 4),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (detail != null)
                      KChip(label: 'v${detail.current.version}${_dirty ? ' · ${t('developer.strat.edited')}' : ''}', small: true)
                    else
                      KChip(label: t('common.new'), tone: KChipTone.gold, small: true),
                    if (built != null)
                      built.valid
                          ? KChip(label: t('developer.strat.valid'), tone: KChipTone.up, small: true)
                          : KChip(label: t('developer.code.errors', {'count': built.errors.length}), tone: KChipTone.down, small: true),
                    if (detail?.deployments.any((d) => d.status == 'running') ?? false)
                      KChip(label: t('developer.bt.running'), tone: KChipTone.ember, dot: true, small: true),
                    if (detail != null)
                      Text(
                        t('developer.strat.savedAgo', {'ago': algoAgo(t, detail.current.createdAt)}),
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: KSegmented<String>(
                        values: const ['visual', 'code'],
                        labels: [t('developer.strat.visual'), t('developer.mode.code')],
                        selected: _mode,
                        plain: true,
                        height: 34,
                        onChanged: _switchMode,
                      ),
                    ),
                    if (detail != null && !readOnly)
                      KIconButton(
                        icon: LucideIcons.ellipsis,
                        size: 36,
                        semanticLabel: t('common.more'),
                        onPressed: () async {
                          final a = await showKActionSheet<String>(
                            context,
                            title: detail.name,
                            actions: [KAction(label: t('developer.strat.archive'), value: 'archive', icon: LucideIcons.archive, destructive: true)],
                          );
                          if (a == 'archive') await _archive();
                        },
                      ),
                    if (!readOnly) ...[
                      const SizedBox(width: 6),
                      KButton(
                        label: detail != null ? t('developer.strat.saveVersion') : t('common.save'),
                        icon: LucideIcons.save,
                        size: KButtonSize.sm,
                        loading: _saving,
                        onPressed: !_dirty && detail != null ? null : _save,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 14),
                KAsync(
                  value: meta,
                  onRetry: () => ref.invalidate(algoMetaProvider),
                  loading: const Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [KSkeleton(height: 40, radius: 12), SizedBox(height: 12), KSkeleton(height: 160, radius: 14)],
                  ),
                  error: (e) => KLoadError(error: e, card: false, onRetry: () => ref.invalidate(algoMetaProvider)),
                  builder: (m) => Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_mode == 'visual') ...[SymbolPicker(spec: _spec, meta: m, onChanged: _editSpec), const SizedBox(height: 10)],
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: k.surface2.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: k.line),
                        ),
                        child: built == null ? const KSkeleton(height: 36) : SignalSummary(summary: built.summary),
                      ),
                      const SizedBox(height: 14),
                      if (_mode == 'visual') ...[
                        VisualEditor(spec: _spec, meta: m, onChanged: _editSpec),
                        if (errors.isNotEmpty) ...[const SizedBox(height: 4), KNotice(text: errors.map((e) => e.message).join('\n'), tone: KChipTone.down)],
                        if (built?.warnings.isNotEmpty ?? false) ...[
                          const SizedBox(height: 6),
                          Text(
                            built!.warnings.join(' · '),
                            style: context.text.caption.copyWith(color: k.warn, fontWeight: FontWeight.w400),
                          ),
                        ],
                        const SizedBox(height: 16),
                        SmallLabel(t('developer.strat.riskSession')),
                        const SizedBox(height: 2),
                        SettingsEditor(spec: _spec, meta: m, onChanged: _editSpec),
                      ] else ...[
                        StrategyCodeEditor(
                          controller: _code,
                          onChanged: _editCode,
                          errors: errors,
                          warnings: built?.warnings ?? const [],
                          validating: _validating,
                        ),
                        const SizedBox(height: 12),
                        DslReference(meta: m),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        // 2. my strategies + templates
        KCard(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.strat.mine'), subtitle: t('developer.strat.nSaved', {'count': items.length})),
              const SizedBox(height: 8),
              KAsync(
                value: list,
                onRetry: () => ref.invalidate(strategiesProvider),
                loading: const Padding(padding: EdgeInsets.only(bottom: 8), child: KSkeleton(height: 96, radius: 14)),
                error: (e) => KLoadError(error: e, card: false, onRetry: () => ref.invalidate(strategiesProvider)),
                builder: (_) => items.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                        child: Text(t('developer.strat.none'), style: context.text.footnote.copyWith(color: k.fg3)),
                      )
                    : Column(
                        children: [
                          for (final s in items)
                            _StrategyRow(
                              s: s,
                              selected: s.id == _selected,
                              onTap: () {
                                setState(() => _selected = s.id);
                                unawaited(_load(s.id));
                                revealLater(_editorKey);
                              },
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
        if (!readOnly) ...[
          const SizedBox(height: 16),
          KCard(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KCardHeader(title: t('developer.strat.templates'), subtitle: t('developer.strat.templatesSub')),
                const SizedBox(height: 8),
                for (final tpl in kTemplates)
                  KPressable(
                    pressedScale: 0.99,
                    onTap: () => _newFrom(tpl),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 9),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(tpl.name(t), style: context.text.headline.copyWith(fontSize: 14)),
                          const SizedBox(height: 2),
                          Text(
                            tpl.text(t),
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        // 3. AI assistant · deploy · recent backtests
        AiAssistant(
          configured: meta.value?.aiConfigured ?? false,
          readOnly: readOnly,
          mode: _mode,
          symbol: jS(_spec['symbol']),
          timeframe: jS(_spec['timeframe']),
          current: () => _mode == 'code' ? _code.text : {..._spec, 'name': _name.text},
          onApply: _applyAi,
        ),
        const SizedBox(height: 16),
        _DeployCard(
          strategy: _dirty ? null : detail,
          readOnly: readOnly,
          onDeployed: () {
            if (detail != null) unawaited(_load(detail.id));
          },
        ),
        if (detail != null && detail.backtests.isNotEmpty) ...[
          const SizedBox(height: 16),
          KCard(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KCardHeader(icon: LucideIcons.flaskConical, title: t('developer.strat.recentBacktests')),
                const SizedBox(height: 8),
                for (final b in detail.backtests.take(4))
                  KPressable(
                    pressedScale: 0.99,
                    onTap: () => context.go('/developer/backtests?id=${b.id}'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 9),
                      child: Row(
                        children: [
                          Text('#${b.id}', style: context.text.mono(12, color: k.fg3)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              t.dyn('developer.btStatus.${b.status}', fallback: b.status),
                              style: context.text.callout.copyWith(color: k.fg2),
                            ),
                          ),
                          if (b.summary != null)
                            Text(
                              fmtPct(b.summary!.returnPct),
                              textDirection: TextDirection.ltr,
                              style: context.text.mono(12.5, color: b.summary!.returnPct >= 0 ? k.up : k.down, weight: FontWeight.w600),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _StrategyRow extends StatelessWidget {
  const _StrategyRow({required this.s, required this.selected, required this.onTap});
  final StrategyItem s;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final bt = s.lastBacktest;
    return KPressable(
      pressedScale: 0.99,
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(color: selected ? k.surface3 : Colors.transparent, borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                SymbolAvatar(s.symbol, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.headline.copyWith(fontSize: 14)),
                ),
                if (s.running > 0)
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 26),
              child: Row(
                children: [
                  Text(
                    '${s.symbol} · ${s.timeframe}',
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(11, color: k.fg3),
                  ),
                  Text(
                    ' · v${s.version}',
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                  if (s.kind == 'code') ...[const SizedBox(width: 4), Icon(LucideIcons.codeXml, size: 12, color: k.fg3)],
                  if (!s.valid)
                    Text(
                      ' · ${t('developer.draft')}',
                      style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w400),
                    ),
                  const Spacer(),
                  if (bt != null)
                    Text(
                      fmtPct(bt.returnPct),
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(11.5, color: bt.returnPct >= 0 ? k.up : k.down, weight: FontWeight.w600),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Deploy 24/7 (web DeployCard): account, risk overrides, live warning, Deploy vN, this strategy's deployments.
class _DeployCard extends ConsumerStatefulWidget {
  const _DeployCard({required this.strategy, required this.readOnly, required this.onDeployed});
  final StrategyDetail? strategy;
  final bool readOnly;
  final VoidCallback onDeployed;

  @override
  ConsumerState<_DeployCard> createState() => _DeployCardState();
}

class _DeployCardState extends ConsumerState<_DeployCard> {
  int? _login;
  double _mult = 1, _maxOpen = 0, _maxLoss = 0;
  bool _busy = false;

  Future<void> _deploy(StrategyDetail s, int login) async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).algoPost('deployments', {
        'strategyId': s.id,
        'versionId': s.current.id,
        'login': login,
        'risk': {if (_mult != 1) 'lotMultiplier': _mult, if (_maxOpen > 0) 'maxOpenPositions': _maxOpen.round(), if (_maxLoss > 0) 'maxDailyLoss': _maxLoss},
      });
      algoOk(ref, t('developer.strat.runningOn', {'version': s.current.version, 'login': login}), description: t('developer.strat.runningText'));
      ref.invalidate(deploymentsProvider);
      widget.onDeployed();
    } on Object catch (e) {
      algoFail(ref, t, t('developer.strat.deployFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final accounts = ref.watch(algoAccountsProvider);
    final list = (accounts.value ?? const <AlgoAccount>[]).where((a) => a.active).toList();
    if (_login == null && list.isNotEmpty) _login = (list.where((a) => a.type == 'demo').firstOrNull ?? list.first).login;
    final acct = list.where((a) => a.login == _login).firstOrNull;
    final s = widget.strategy;
    final valid = s?.current.valid ?? false;
    Widget box(String label, Widget child) => Expanded(
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(color: k.surface2.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(10)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
            const SizedBox(height: 4),
            child,
          ],
        ),
      ),
    );
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.rocket, title: t('developer.strat.deployTitle'), subtitle: t('developer.strat.deploySub')),
          const SizedBox(height: 14),
          if (accounts.isLoading && !accounts.hasValue)
            const KSkeleton(height: 44, radius: 14)
          else if (list.isEmpty)
            KRichText(
              '${t('developer.strat.openAccountFirst')} <link>${t('developer.strat.openAccount')}</link>',
              style: context.text.footnote.copyWith(color: k.fg3),
              tags: {'link': KTag.link(() => context.go('/accounts/new'))},
            )
          else
            KPickerField(
              value: acct == null ? null : '${accountTypeLabel(t, acct.type).toUpperCase()} #${acct.login} · ${acct.groupName} · ${fmtMoney(acct.equity)}',
              onTap: () async {
                final l = await showKPicker<int>(
                  context,
                  title: t('common.account'),
                  selected: _login,
                  options: [
                    for (final a in list) KPickOption(a.login, '${accountTypeLabel(t, a.type)} #${a.login} · ${a.groupName}', subtitle: fmtMoney(a.equity, 0)),
                  ],
                );
                if (l != null) setState(() => _login = l);
              },
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              box(
                t('developer.strat.lotX'),
                NumField(value: _mult, min: 0.01, width: 64, semanticLabel: t('developer.dep.lotMultiplier'), onChanged: (v) => _mult = v),
              ),
              const SizedBox(width: 6),
              box(
                t('developer.strat.maxOpen'),
                NumField(value: _maxOpen, min: 0, integer: true, width: 64, semanticLabel: t('developer.dep.maxOpenPositions'), onChanged: (v) => _maxOpen = v),
              ),
              const SizedBox(width: 6),
              box(
                t('developer.strat.dayLoss'),
                NumField(value: _maxLoss, min: 0, width: 64, semanticLabel: t('developer.builder.maxDailyLoss'), onChanged: (v) => _maxLoss = v),
              ),
            ],
          ),
          if (acct?.live ?? false) ...[const SizedBox(height: 10), KNotice(text: t('developer.strat.liveWarning'), tone: KChipTone.warn)],
          if (!widget.readOnly) ...[
            const SizedBox(height: 12),
            KButton(
              label: s != null ? t('developer.strat.deployVersion', {'version': s.current.version}) : t('developer.strat.saveFirst'),
              icon: LucideIcons.play,
              variant: KButtonVariant.ink,
              expand: true,
              loading: _busy,
              onPressed: s == null || !valid || _login == null ? null : () => _deploy(s, _login!),
            ),
          ],
          if (s != null && !valid) ...[
            const SizedBox(height: 6),
            Text(
              t('developer.strat.fixBeforeDeploy'),
              style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w400),
            ),
          ],
          if (s != null && s.deployments.isNotEmpty) ...[
            const SizedBox(height: 12),
            const KDivider(),
            const SizedBox(height: 6),
            for (final d in s.deployments.take(5))
              KPressable(
                pressedScale: 0.99,
                onTap: () => context.go('/developer/deployments?id=${d.id}'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(
                    children: [
                      DepStatusChip(d.status),
                      const SizedBox(width: 8),
                      Text('#${d.login}', style: context.text.mono(12, color: k.fg2)),
                      const SizedBox(width: 6),
                      Text('v${d.version}', style: context.text.caption.copyWith(color: k.fg3)),
                      const Spacer(),
                      Text(t('developer.market.nTrades', {'count': d.trades}), style: context.text.caption.copyWith(color: k.fg2)),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
