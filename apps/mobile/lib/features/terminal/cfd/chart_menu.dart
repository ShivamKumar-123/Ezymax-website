// The chart's menu on the phone (web: the chart toolbar's chart type, Indicators and Templates, the indicators list
// components/chart/indicators/dialogs.tsx and the legend's eye / settings / remove), as iOS sheets: the chart type,
// the indicators on this chart (show / hide, settings, remove), the indicators list (search, favourites, categories,
// on this chart), an indicator's settings (inputs, style, levels) and the built-in templates. Saved per symbol in the
// workspace; the chart page draws them with the web's own indicator code.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../chart/indicators.dart';
import '../core/workspace.dart';
import '../widgets/kit.dart';

/// A colour token (or a #rrggbb colour) of the indicator registry in the terminal theme.
Color indicatorColor(KTokens k, String token) => switch (token) {
  'ember' => k.ember,
  'gold' => k.gold,
  'up' => k.up,
  'down' => k.down,
  'warn' => k.warn,
  'info' => k.info,
  'fg' => k.fg,
  'fg2' => k.fg2,
  'fg3' => k.fg3,
  _ when token.startsWith('#') && token.length == 7 => Color(0xFF000000 | (int.tryParse(token.substring(1), radix: 16) ?? 0)),
  _ => k.fg2,
};

/// The first plotted colour of an instance (its legend colour).
String instanceColor(IndRegistry? r, IndInstance i) {
  final d = r?[i.type];
  if (d == null || d.outputs.isEmpty) return 'fg2';
  final o = d.outputs.firstWhere((o) => o.kind != 'hist', orElse: () => d.outputs.first);
  return i.style[o.key]?.color ?? o.color;
}

String _categoryLabel(T t, String c) {
  final key = c.replaceAll(RegExp(r'\s+'), '');
  return t.dyn('market.nav.category.${key[0].toLowerCase()}${key.substring(1)}', fallback: c);
}

/// What the menus change: one symbol's chart in the workspace (`read`: a WidgetRef's or a container's).
class ChartEdits {
  ChartEdits(this.read, this.symbol);
  ChartEdits.of(WidgetRef ref, String symbol) : this(ref.read, symbol);
  final R Function<R>(ProviderListenable<R> provider) read;
  final String symbol;

  WorkspaceController get _ws => read(workspaceProvider.notifier);
  IndRegistry? get _reg => read(indicatorRegistryProvider).value;
  ChartSettings get chart => read(workspaceProvider).chartOf(symbol);

  void setType(String type) => _ws.updateChart(symbol, (c) => c.copyWith(type: type));

  IndInstance? add(String type) {
    final r = _reg;
    if (r?[type] == null) return null;
    final inst = makeInstance(r!, type, chart.indicators);
    _ws.updateChart(symbol, (c) => c.copyWith(indicators: [...c.indicators, inst]));
    return inst;
  }

  void remove(String uid) => _ws.updateChart(symbol, (c) => c.copyWith(indicators: c.indicators.where((i) => i.uid != uid).toList()));

  void removeAll() => _ws.updateChart(symbol, (c) => c.copyWith(indicators: const []));

  void toggle(String uid) => replace(uid, (i) => i.copyWith(visible: !i.visible));

  void replace(String uid, IndInstance Function(IndInstance i) f) =>
      _ws.updateChart(symbol, (c) => c.copyWith(indicators: [for (final i in c.indicators) i.uid == uid ? f(i) : i]));

  void applyTemplate(ChartTemplate tpl) => _ws.updateChart(symbol, (c) => ChartSettings(type: tpl.type, indicators: tpl.instances(_reg)));
}

/* ---------------- toolbar button ---------------- */

/// The chart toolbar's menu button (web: the Indicators button with its count).
class ChartMenuButton extends ConsumerWidget {
  const ChartMenuButton({super.key, required this.symbol});
  final String symbol;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.k;
    final n = ref.watch(workspaceProvider.select((w) => w.chartOf(symbol).indicators.length));
    return KPressable(
      key: const ValueKey('chart-menu'),
      minSize: 36,
      pressedScale: 0.94,
      semanticLabel: context.t('chart.toolbar.indicators'),
      onTap: () => unawaited(showChartMenu(context, symbol)),
      child: SizedBox(
        width: 38,
        height: 34,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(LucideIcons.spline, size: 17, color: k.fg2),
            if (n > 0)
              PositionedDirectional(
                top: 3,
                end: 2,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 14),
                  height: 14,
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(7)),
                  child: Text(
                    '$n',
                    style: context.text.mono(9, weight: FontWeight.w700, color: Colors.white),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/* ---------------- the menu ---------------- */

Future<void> showChartMenu(BuildContext context, String symbol) => showKSheet<void>(
  context,
  title: context.t('chart.toolbar.indicators'),
  builder: (_) => ChartMenu(symbol: symbol),
);

const _typeIcons = {'candles': LucideIcons.chartCandlestick, 'bars': LucideIcons.chartColumn, 'line': LucideIcons.chartLine, 'area': LucideIcons.chartArea};

/// Chart type · the indicators on this chart · the indicators list · templates.
class ChartMenu extends ConsumerWidget {
  const ChartMenu({super.key, required this.symbol});
  final String symbol;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final chart = ref.watch(workspaceProvider.select((w) => w.chartOf(symbol)));
    final reg = ref.watch(indicatorRegistryProvider).value;
    final edits = ChartEdits.of(ref, symbol);
    final tpl = kBuiltinTemplates.where((x) => x.matches(reg, chart.type, chart.indicators)).firstOrNull;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TSectionLabel(t('chart.menu.chartType'), padding: const EdgeInsets.fromLTRB(2, 4, 2, 8)),
          Row(
            children: [
              for (final type in kChartTypes) ...[
                if (type != kChartTypes.first) const SizedBox(width: 6),
                Expanded(
                  child: _TypeTile(
                    key: ValueKey('chart-type-$type'),
                    icon: _typeIcons[type]!,
                    label: t('trader.chartType.$type'),
                    selected: chart.type == type,
                    onTap: () {
                      KHaptics.selection();
                      edits.setType(type);
                    },
                  ),
                ),
              ],
            ],
          ),
          TSectionLabel(
            t('chart.ind.onChart'),
            padding: const EdgeInsets.fromLTRB(2, 18, 2, 6),
            trailing: chart.indicators.isEmpty
                ? null
                : KPressable(
                    minSize: 30,
                    onTap: () {
                      KHaptics.medium();
                      edits.removeAll();
                    },
                    child: Text(t('chart.ind.removeAll'), style: context.text.label.copyWith(fontSize: 12.5, color: k.down)),
                  ),
          ),
          _Group(
            children: [
              if (chart.indicators.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                  child: Text(
                    t('chart.ind.noneOnChart'),
                    textAlign: TextAlign.center,
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ),
              for (final i in chart.indicators) InstanceRow(symbol: symbol, inst: i, reg: reg),
            ],
          ),
          const SizedBox(height: 10),
          KButton(
            key: const ValueKey('chart-add-indicator'),
            label: t('chart.menu.indicatorsList'),
            icon: LucideIcons.plus,
            variant: KButtonVariant.surface,
            expand: true,
            onPressed: () => unawaited(showIndicatorList(context, symbol)),
          ),
          TSectionLabel(t('chart.toolbar.templates'), padding: const EdgeInsets.fromLTRB(2, 18, 2, 6)),
          _Group(
            children: [
              _MenuRow(
                key: const ValueKey('chart-templates'),
                icon: LucideIcons.fileStack,
                label: tpl == null ? t('chart.toolbar.builtIn') : t.dyn('chart.template.${tpl.id}', fallback: tpl.id),
                onTap: () => unawaited(showChartTemplates(context, ref, symbol)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TypeTile extends StatelessWidget {
  const _TypeTile({super.key, required this.icon, required this.label, required this.selected, required this.onTap});
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      selected: selected,
      button: true,
      child: KPressable(
        minSize: 56,
        pressedScale: 0.96,
        onTap: onTap,
        child: Container(
          width: double.infinity,
          height: 58,
          decoration: BoxDecoration(
            color: selected ? k.emberSoft : k.surface2,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? k.ember.withValues(alpha: 0.45) : k.line),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: selected ? k.ember : k.fg2),
              const SizedBox(height: 4),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.label.copyWith(fontSize: 11.5, color: selected ? k.ember : k.fg2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A rounded group of rows (iOS inset list).
class _Group extends StatelessWidget {
  const _Group({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) Divider(height: 0.6, thickness: 0.6, indent: 14, color: k.line), children[i]],
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({super.key, required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      pressedScale: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Icon(icon, size: 17, color: k.fg2),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.body.copyWith(fontSize: 14.5)),
            ),
            Icon(LucideIcons.chevronRight, size: 16, color: k.fg3),
          ],
        ),
      ),
    );
  }
}

/// One indicator on the chart: colour, label, the indicator's name, and eye / settings / remove (web legend row).
class InstanceRow extends ConsumerWidget {
  const InstanceRow({super.key, required this.symbol, required this.inst, required this.reg});
  final String symbol;
  final IndInstance inst;
  final IndRegistry? reg;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final label = instanceLabel(reg, inst);
    final def = reg?[inst.type];
    final edits = ChartEdits.of(ref, symbol);
    Widget icon(IconData i, String semantics, VoidCallback onTap, {Color? color, Key? key}) => KPressable(
      key: key,
      minSize: 40,
      pressedScale: 0.9,
      semanticLabel: semantics,
      onTap: onTap,
      child: SizedBox(width: 36, height: 40, child: Icon(i, size: 17, color: color ?? k.fg2)),
    );
    return Padding(
      key: ValueKey('ind-row-${inst.uid}'),
      padding: const EdgeInsetsDirectional.only(start: 14, end: 4),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: indicatorColor(k, instanceColor(reg, inst)), borderRadius: BorderRadius.circular(3)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: KPressable(
              pressedScale: 1,
              onTap: () => unawaited(showIndicatorSettings(context, symbol, inst.uid)),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text
                          .mono(13, weight: FontWeight.w600, color: inst.visible ? k.fg : k.fg3)
                          .copyWith(decoration: inst.visible ? null : TextDecoration.lineThrough),
                    ),
                    if (def != null)
                      Text(
                        '${def.name} · ${t(def.separate ? 'chart.ind.subWindow' : 'chart.ind.overlay')}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.caption.copyWith(color: k.fg3),
                      ),
                  ],
                ),
              ),
            ),
          ),
          icon(inst.visible ? LucideIcons.eye : LucideIcons.eyeOff, t(inst.visible ? 'chart.legend.hide' : 'chart.legend.show', {'label': label}), () {
            KHaptics.selection();
            edits.toggle(inst.uid);
          }, key: ValueKey('ind-eye-${inst.uid}')),
          icon(LucideIcons.settings2, t('chart.legend.settings', {'label': label}), () => unawaited(showIndicatorSettings(context, symbol, inst.uid))),
          icon(
            LucideIcons.x,
            t('chart.legend.remove', {'label': label}),
            () {
              KHaptics.medium();
              edits.remove(inst.uid);
            },
            color: k.down,
            key: ValueKey('ind-remove-${inst.uid}'),
          ),
        ],
      ),
    );
  }
}

/// A tapped legend row on the chart: show / hide, settings, remove.
Future<void> showIndicatorActions(BuildContext context, WidgetRef ref, String symbol, String uid) async {
  final t = context.t;
  final inst = ref.read(workspaceProvider).chartOf(symbol).indicators.where((i) => i.uid == uid).firstOrNull;
  if (inst == null) return;
  final reg = ref.read(indicatorRegistryProvider).value;
  final edits = ChartEdits.of(ref, symbol);
  await showKActionSheet<void>(
    context,
    title: instanceLabel(reg, inst),
    message: reg?[inst.type]?.name,
    actions: [
      KAction(
        label: t(inst.visible ? 'chart.ind.hide' : 'chart.ind.show'),
        icon: inst.visible ? LucideIcons.eyeOff : LucideIcons.eye,
        onTap: () => edits.toggle(uid),
      ),
      KAction(label: t('chart.ind.settings'), icon: LucideIcons.settings2, onTap: () => unawaited(showIndicatorSettings(context, symbol, uid))),
      KAction(label: t('chart.ind.remove'), icon: LucideIcons.trash2, destructive: true, onTap: () => edits.remove(uid)),
    ],
  );
}

/// The built-in templates (web Templates menu): the chart type and indicators of each, the current one checked.
Future<void> showChartTemplates(BuildContext context, WidgetRef ref, String symbol) {
  final t = context.t;
  final reg = ref.read(indicatorRegistryProvider).value;
  final chart = ref.read(workspaceProvider).chartOf(symbol);
  final edits = ChartEdits.of(ref, symbol);
  return showKActionSheet<void>(
    context,
    title: t('chart.toolbar.templates'),
    message: t('chart.toolbar.builtIn'),
    actions: [
      for (final tpl in kBuiltinTemplates)
        KAction(
          label: t.dyn('chart.template.${tpl.id}', fallback: tpl.id),
          icon: tpl.matches(reg, chart.type, chart.indicators) ? LucideIcons.check : null,
          onTap: () => edits.applyTemplate(tpl),
        ),
    ],
  );
}

/* ---------------- the indicators list ---------------- */

Future<void> showIndicatorList(BuildContext context, String symbol) => showKSheet<void>(
  context,
  expand: true,
  title: context.t('chart.ind.title'),
  builder: (_) => IndicatorList(symbol: symbol),
);

/// Search, All · Favourites · categories · On this chart (web IndicatorsDialog). Tap adds; the star pins.
class IndicatorList extends ConsumerStatefulWidget {
  const IndicatorList({super.key, required this.symbol});
  final String symbol;

  @override
  ConsumerState<IndicatorList> createState() => _IndicatorListState();
}

class _IndicatorListState extends ConsumerState<IndicatorList> {
  String _q = '';
  String _view = 'all';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final regAsync = ref.watch(indicatorRegistryProvider);
    final reg = regAsync.value;
    final chart = ref.watch(workspaceProvider.select((w) => w.chartOf(widget.symbol)));
    final favs = ref.watch(workspaceProvider.select((w) => w.indicatorFavourites));
    if (reg == null) {
      return ListView(
        children: [for (var i = 0; i < 6; i++) const Padding(padding: EdgeInsets.all(14), child: KSkeleton())],
      );
    }
    final q = _q.trim().toLowerCase();
    final views = <(String, String)>[
      ('all', t('chart.ind.all')),
      ('fav', t('chart.ind.favourites')),
      for (final c in reg.categories) ('cat:$c', _categoryLabel(t, c)),
      ('on', '${t('chart.ind.onChart')} ${chart.indicators.length}'),
    ];
    final defs = reg.list.where((d) {
      if (q.isNotEmpty) return d.name.toLowerCase().contains(q) || d.short.toLowerCase().contains(q) || d.description.toLowerCase().contains(q);
      if (_view == 'fav') return favs.contains(d.type);
      if (_view.startsWith('cat:')) return d.category == _view.substring(4);
      return true;
    }).toList();
    final showOn = q.isEmpty && _view == 'on';
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
          child: KTextField(
            leading: LucideIcons.search,
            placeholder: t('chart.ind.search', {'count': reg.list.length}),
            onChanged: (v) => setState(() => _q = v),
          ),
        ),
        SizedBox(
          height: 32,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            children: [
              for (final (v, label) in views)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 5),
                  child: KPressable(
                    key: ValueKey('ind-view-$v'),
                    minSize: 32,
                    pressedScale: 0.97,
                    onTap: () {
                      KHaptics.selection();
                      setState(() => _view = v);
                    },
                    child: Container(
                      height: 30,
                      padding: const EdgeInsets.symmetric(horizontal: 11),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: v == _view && q.isEmpty ? k.emberSoft : Colors.transparent,
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(color: v == _view && q.isEmpty ? k.ember.withValues(alpha: 0.45) : k.line),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (v == 'fav') ...[Icon(LucideIcons.star, size: 12, color: v == _view && q.isEmpty ? k.ember : k.fg2), const SizedBox(width: 4)],
                          Text(label, style: context.text.label.copyWith(fontSize: 12.5, color: v == _view && q.isEmpty ? k.ember : k.fg2)),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: showOn
              ? (chart.indicators.isEmpty
                    ? TEmptyLine(t('chart.ind.noneOnChart'))
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(14, 4, 14, 16),
                        children: [
                          _Group(
                            children: [for (final i in chart.indicators) InstanceRow(symbol: widget.symbol, inst: i, reg: reg)],
                          ),
                        ],
                      ))
              : defs.isEmpty
              ? TEmptyLine(q.isNotEmpty ? t('chart.ind.noMatch', {'query': _q.trim()}) : t('chart.ind.noFavourites'))
              : ListView.builder(
                  padding: const EdgeInsets.only(bottom: 16),
                  itemCount: defs.length,
                  itemBuilder: (context, i) => _DefRow(
                    def: defs[i],
                    count: chart.indicators.where((x) => x.type == defs[i].type).length,
                    fav: favs.contains(defs[i].type),
                    showCategory: _view == 'all' || _view == 'fav' || q.isNotEmpty,
                    symbol: widget.symbol,
                  ),
                ),
        ),
      ],
    );
  }
}

class _DefRow extends ConsumerWidget {
  const _DefRow({required this.def, required this.count, required this.fav, required this.showCategory, required this.symbol});
  final IndDef def;
  final int count;
  final bool fav, showCategory;
  final String symbol;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final edits = ChartEdits.of(ref, symbol);
    final meta = [def.short, t(def.separate ? 'chart.ind.subWindow' : 'chart.ind.overlay'), if (showCategory) _categoryLabel(t, def.category)].join(' · ');
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      padding: const EdgeInsetsDirectional.only(start: 14, end: 4),
      child: Row(
        children: [
          Expanded(
            child: KPressable(
              key: ValueKey('ind-add-${def.type}'),
              minSize: 52,
              pressedScale: 1,
              semanticLabel: '${def.name} · ${t('chart.ind.add')}',
              onTap: () {
                KHaptics.tap();
                edits.add(def.type);
              },
              onLongPress: () {
                final inst = edits.add(def.type);
                if (inst != null) unawaited(showIndicatorSettings(context, symbol, inst.uid));
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            def.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.body.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                        ),
                        if (count > 0) ...[
                          const SizedBox(width: 6),
                          TBadge(t('chart.ind.countOnChart', {'count': count}), tone: TBadgeTone.ember),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      meta,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.mono(10.5, color: k.fg3),
                    ),
                    if (def.description.isNotEmpty)
                      Text(
                        def.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.caption.copyWith(color: k.fg3),
                      ),
                  ],
                ),
              ),
            ),
          ),
          KPressable(
            key: ValueKey('ind-fav-${def.type}'),
            pressedScale: 0.9,
            semanticLabel: t(fav ? 'chart.ind.favRemoveAria' : 'chart.ind.favAddAria', {'name': def.name}),
            onTap: () {
              KHaptics.selection();
              ref.read(workspaceProvider.notifier).toggleIndicatorFavourite(def.type);
            },
            child: SizedBox(
              width: 40,
              height: 44,
              child: Icon(fav ? Icons.star_rounded : LucideIcons.star, size: fav ? 20 : 17, color: fav ? k.gold : k.fg3),
            ),
          ),
          KPressable(
            pressedScale: 0.9,
            semanticLabel: t('chart.ind.addConfigureAria', {'name': def.name}),
            onTap: () {
              final inst = edits.add(def.type);
              if (inst != null) unawaited(showIndicatorSettings(context, symbol, inst.uid));
            },
            child: SizedBox(width: 36, height: 44, child: Icon(LucideIcons.settings2, size: 16, color: k.fg3)),
          ),
        ],
      ),
    );
  }
}

/* ---------------- settings ---------------- */

Future<void> showIndicatorSettings(BuildContext context, String symbol, String uid) => showKSheet<void>(
  context,
  builder: (_) => IndicatorSettings(symbol: symbol, uid: uid),
);

/// Inputs · Style · Levels of one indicator (web SettingsBody): a draft committed with OK.
class IndicatorSettings extends ConsumerStatefulWidget {
  const IndicatorSettings({super.key, required this.symbol, required this.uid});
  final String symbol, uid;

  @override
  ConsumerState<IndicatorSettings> createState() => _IndicatorSettingsState();
}

class _IndicatorSettingsState extends ConsumerState<IndicatorSettings> {
  Map<String, Object>? _params;
  Map<String, IndStyle> _style = {};
  List<String> _levels = [];
  bool _visible = true;
  String? _pane;
  final Map<int, TextEditingController> _levelCtl = {};

  void _draftFrom(IndDef d, IndInstance i) {
    _params = normalizeParams(d, i.params);
    _style = {...i.style};
    _levels = (i.levels ?? d.levels).map(_fmtLevel).toList();
    _visible = i.visible;
    _pane ??= d.params.isNotEmpty ? 'inputs' : 'style';
    for (final c in _levelCtl.values) {
      c.dispose();
    }
    _levelCtl.clear();
  }

  static String _fmtLevel(double v) => v == v.roundToDouble() ? v.toInt().toString() : '$v';

  @override
  void dispose() {
    for (final c in _levelCtl.values) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _levelsOk => _levels.every((l) => double.tryParse(l.trim()) != null);

  void _commit(IndDef d) {
    if (!_levelsOk) return;
    final params = normalizeParams(d, _params);
    final lv = _levels.map((l) => double.parse(l.trim())).toList();
    final custom = d.separate && !listEqualsD(lv, d.levels);
    ref
        .read(workspaceProvider.notifier)
        .updateChart(
          widget.symbol,
          (c) => c.copyWith(
            indicators: [
              for (final x in c.indicators)
                x.uid == widget.uid
                    ? IndInstance(
                        uid: x.uid,
                        type: x.type,
                        params: params,
                        visible: _visible,
                        style: {
                          for (final e in _style.entries)
                            if (!e.value.isEmpty) e.key: e.value,
                        },
                        levels: custom ? lv : null,
                      )
                    : x,
            ],
          ),
        );
    Navigator.of(context).maybePop();
  }

  void _defaults(IndDef d) => setState(() {
    _params = normalizeParams(d, const {});
    _style = {};
    _levels = d.levels.map(_fmtLevel).toList();
    _visible = true;
    for (final c in _levelCtl.values) {
      c.dispose();
    }
    _levelCtl.clear();
  });

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final reg = ref.watch(indicatorRegistryProvider).value;
    final inst = ref.watch(workspaceProvider.select((w) => w.chartOf(widget.symbol).indicators.where((i) => i.uid == widget.uid).firstOrNull));
    final d = inst == null ? null : reg?[inst.type];
    if (inst == null || d == null) return const SizedBox(height: 120);
    if (_params == null) _draftFrom(d, inst);
    final panes = <(String, String)>[
      if (d.params.isNotEmpty) ('inputs', t('chart.ind.tabInputs')),
      ('style', t('chart.ind.tabStyle')),
      if (d.separate) ('levels', t('chart.ind.tabLevels')),
    ];
    final pane = panes.any((p) => p.$1 == _pane) ? _pane! : panes.first.$1;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 2, 20, 0),
          child: Column(
            children: [
              Text(d.name, textAlign: TextAlign.center, style: context.text.headline),
              const SizedBox(height: 2),
              Text(
                indicatorLabel(d, normalizeParams(d, _params)),
                textAlign: TextAlign.center,
                style: context.text.mono(12, color: k.fg3),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: KSegmented<String>(
                  values: [for (final p in panes) p.$1],
                  labels: [for (final p in panes) p.$2],
                  selected: pane,
                  height: 32,
                  onChanged: (v) => setState(() => _pane = v),
                ),
              ),
              const SizedBox(width: 12),
              Text(t('chart.ind.visible'), style: context.text.footnote.copyWith(color: k.fg3)),
              const SizedBox(width: 6),
              TSmallSwitch(value: _visible, semanticLabel: t('chart.ind.visibleOnChart'), onChanged: (v) => setState(() => _visible = v)),
            ],
          ),
        ),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: switch (pane) {
              'inputs' => _inputs(d),
              'levels' => _levelsPane(),
              _ => _stylePane(d, reg!),
            },
          ),
        ),
        if (!_levelsOk) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 6), child: KFormError(t('chart.ind.levelsNumbers'))),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
          child: Row(
            children: [
              KButton(
                label: t('chart.ind.remove'),
                icon: LucideIcons.trash2,
                variant: KButtonVariant.ghost,
                size: KButtonSize.sm,
                onPressed: () {
                  KHaptics.medium();
                  ChartEdits.of(ref, widget.symbol).remove(widget.uid);
                  Navigator.of(context).maybePop();
                },
              ),
              const Spacer(),
              KButton(label: t('chart.ind.defaults'), variant: KButtonVariant.ghost, size: KButtonSize.sm, onPressed: () => _defaults(d)),
              const SizedBox(width: 6),
              KButton(key: const ValueKey('ind-settings-ok'), label: t('chart.ind.ok'), size: KButtonSize.sm, onPressed: _levelsOk ? () => _commit(d) : null),
            ],
          ),
        ),
      ],
    );
  }

  Widget _inputs(IndDef d) {
    final k = context.k;
    final reg = ref.read(indicatorRegistryProvider).value;
    return Column(
      children: [
        for (final p in d.params)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: p.label, style: context.text.body.copyWith(fontSize: 14)),
                        if (p.numeric)
                          TextSpan(
                            text: '  ${_fmtLevel(p.min)}–${_fmtLevel(p.max)}',
                            style: context.text.mono(10.5, color: k.fg3),
                          ),
                      ],
                    ),
                  ),
                ),
                SizedBox(
                  width: 168,
                  child: p.numeric
                      ? TStepper(
                          key: ValueKey('ind-param-${p.key}'),
                          value: _fmtLevel((_params![p.key] as num).toDouble()),
                          step: p.kind == 'int' ? 1 : p.step,
                          min: p.min,
                          max: p.max,
                          decimals: p.kind == 'int' ? 0 : _decimals(p.step),
                          semanticLabel: p.label,
                          onChanged: (v) {
                            final n = double.tryParse(v);
                            if (n == null) return;
                            setState(() => _params = {..._params!, p.key: p.kind == 'int' ? n.round() : n});
                          },
                        )
                      : _Picker(
                          label: p.kind == 'source'
                              ? (reg?.sources.where((s) => s.value == _params![p.key]).firstOrNull?.label ?? '${_params![p.key]}')
                              : (p.options.where((o) => o.value == _params![p.key]).firstOrNull?.label ?? '${_params![p.key]}'),
                          onTap: () async {
                            final opts = p.kind == 'source' ? (reg?.sources ?? const []) : p.options;
                            final v = await showKActionSheet<String>(
                              context,
                              title: p.label,
                              actions: [
                                for (final o in opts) KAction(label: o.label, value: o.value, icon: o.value == _params![p.key] ? LucideIcons.check : null),
                              ],
                            );
                            if (v != null && mounted) setState(() => _params = {..._params!, p.key: v});
                          },
                        ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  static int _decimals(double step) {
    final s = step.toString();
    return s.contains('.') ? s.split('.').last.replaceAll(RegExp(r'0+$'), '').length : 0;
  }

  Widget _stylePane(IndDef d, IndRegistry reg) {
    final t = context.t;
    final k = context.k;
    return Column(
      children: [
        for (final o in d.outputs)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    TSmallSwitch(
                      value: _style[o.key]?.visible != false,
                      semanticLabel: o.label,
                      onChanged: (v) => setState(() => _style = {..._style, o.key: _with(o.key, visible: v)}),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(o.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.body.copyWith(fontSize: 14)),
                    ),
                    if (o.kind == 'hist')
                      Text(
                        t(o.histColor == 'sign' ? 'chart.ind.histSign' : (o.histColor == 'trend' ? 'chart.ind.histTrend' : 'chart.ind.histogram')),
                        style: context.text.caption.copyWith(color: k.fg3),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    for (final c in reg.colors)
                      Semantics(
                        selected: (_style[o.key]?.color ?? o.color) == c,
                        label: c,
                        button: true,
                        child: KPressable(
                          minSize: 30,
                          pressedScale: 0.9,
                          onTap: () => setState(() => _style = {..._style, o.key: _with(o.key, color: c)}),
                          child: Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: indicatorColor(k, c),
                              borderRadius: BorderRadius.circular(7),
                              border: Border.all(color: (_style[o.key]?.color ?? o.color) == c ? k.fg : Colors.transparent, width: 2),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                if (o.kind != 'hist' && o.kind != 'markers') ...[
                  const SizedBox(height: 8),
                  KSegmented<int>(
                    values: const [1, 2, 3, 4],
                    labels: [
                      for (final w in const [1, 2, 3, 4]) t(o.kind == 'dots' ? 'chart.ind.size' : 'chart.ind.width', {'value': w}),
                    ],
                    selected: _style[o.key]?.width ?? o.width ?? 1,
                    height: 30,
                    onChanged: (w) => setState(() => _style = {..._style, o.key: _with(o.key, width: w)}),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }

  IndStyle _with(String key, {String? color, int? width, bool? visible}) {
    final s = _style[key] ?? const IndStyle();
    return IndStyle(color: color ?? s.color, width: width ?? s.width, visible: visible == null ? s.visible : (visible ? null : false));
  }

  Widget _levelsPane() {
    final t = context.t;
    final k = context.k;
    TextEditingController ctl(int i) => _levelCtl.putIfAbsent(i, () => TextEditingController(text: _levels[i]));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < _levels.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                SizedBox(
                  width: 72,
                  child: Text(t('chart.ind.level', {'n': i + 1}), style: context.text.footnote.copyWith(color: k.fg3)),
                ),
                Expanded(
                  child: KTextField(
                    key: ValueKey('ind-level-$i-${_levels.length}'),
                    controller: ctl(i),
                    ltr: true,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                    onChanged: (v) => setState(() => _levels = [for (var j = 0; j < _levels.length; j++) j == i ? v : _levels[j]]),
                  ),
                ),
                KPressable(
                  minSize: 40,
                  semanticLabel: t('chart.ind.removeLevel', {'n': i + 1}),
                  onTap: () => setState(() {
                    _levels = [..._levels]..removeAt(i);
                    for (final c in _levelCtl.values) {
                      c.dispose();
                    }
                    _levelCtl.clear();
                  }),
                  child: SizedBox(width: 40, height: 40, child: Icon(LucideIcons.x, size: 16, color: k.fg3)),
                ),
              ],
            ),
          ),
        if (_levels.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(t('chart.ind.noLevels'), style: context.text.footnote.copyWith(color: k.fg3)),
          ),
        const SizedBox(height: 6),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KButton(
            label: t('chart.ind.addLevel'),
            icon: LucideIcons.plus,
            size: KButtonSize.sm,
            variant: KButtonVariant.surface,
            onPressed: _levels.length >= 8 ? null : () => setState(() => _levels = [..._levels, '0']),
          ),
        ),
      ],
    );
  }
}

bool listEqualsD(List<double> a, List<double> b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

class _Picker extends StatelessWidget {
  const _Picker({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      minSize: 36,
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: k.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.body.copyWith(fontSize: 13.5)),
            ),
            Icon(LucideIcons.chevronsUpDown, size: 14, color: k.fg3),
          ],
        ),
      ),
    );
  }
}
