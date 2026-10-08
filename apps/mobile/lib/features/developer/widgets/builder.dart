// The strategy editor on phones: port of apps/crm/components/algo/builder.tsx (visual rules + risk & session
// settings + symbol picker) and code-editor.tsx (code field with the compiler's errors, the language reference).
// Conditions show as chips; tapping an operand opens a sheet to pick the source and its periods.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../developer_api.dart';
import '../strategy_spec.dart';
import 'algo_widgets.dart';

const _days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const _assetGroups = ['forex', 'metals', 'indices', 'energies', 'crypto', 'stocks'];

/* ------------------------------------------------------------------ symbol + timeframe */

class SymbolPicker extends StatelessWidget {
  const SymbolPicker({super.key, required this.spec, required this.onChanged, required this.meta});
  final Json spec;
  final ValueChanged<Json> onChanged;
  final AlgoMeta meta;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final symbol = jS(spec['symbol']);
    final tf = jS(spec['timeframe']);
    final tfs = meta.timeframes.where((x) => x != 'MN').toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: MenuChip(
            label: symbol,
            mono: true,
            leading: SymbolAvatar(symbol, size: 18),
            onTap: () async {
              final sorted = [
                for (final g in _assetGroups) ...meta.symbols.where((s) => s.assetClass == g),
                ...meta.symbols.where((s) => !_assetGroups.contains(s.assetClass)),
              ];
              final v = await showKPicker<String>(
                context,
                title: t('developer.builder.symbol'),
                selected: symbol,
                options: [
                  for (final s in sorted)
                    KPickOption(
                      s.symbol,
                      s.symbol,
                      subtitle: t.dyn('developer.assetClass.${s.assetClass}', fallback: s.assetClass),
                      leading: SymbolAvatar(s.symbol, size: 22),
                    ),
                ],
              );
              if (v != null) onChanged({...spec, 'symbol': v});
            },
          ),
        ),
        const SizedBox(height: 4),
        KChoiceChips<String>(values: tfs, labels: tfs, selected: tf, onChanged: (v) => onChanged({...spec, 'timeframe': v})),
      ],
    );
  }
}

/* ------------------------------------------------------------------ rule sets */

class VisualEditor extends StatelessWidget {
  const VisualEditor({super.key, required this.spec, required this.onChanged, required this.meta});
  final Json spec;
  final ValueChanged<Json> onChanged;
  final AlgoMeta meta;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final tf = jS(spec['timeframe']);
    Widget rs(String key, String title, String sub, Color tone) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: RuleSetEditor(title: title, sub: sub, tone: tone, rs: jMap(spec[key]), meta: meta, baseTf: tf, onChanged: (v) => onChanged({...spec, key: v})),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        rs('long', t('developer.builder.buyWhen'), t('developer.builder.entryLong'), k.up),
        rs('short', t('developer.builder.sellWhen'), t('developer.builder.entryShort'), k.down),
        rs('exitLong', t('developer.builder.exitBuys'), t('developer.builder.besidesSlTp'), k.gold),
        rs('exitShort', t('developer.builder.exitSells'), t('developer.builder.besidesSlTp'), k.gold),
      ],
    );
  }
}

Future<Json?> _pickPreset(BuildContext context) async {
  final t = context.t;
  final i = await showKPicker<int>(
    context,
    title: t('developer.builder.addCondition'),
    options: [for (var i = 0; i < kPresets.length; i++) KPickOption(i, kPresets[i].key != null ? t(kPresets[i].key!) : kPresets[i].label)],
  );
  return i == null ? null : kPresets[i].make();
}

class RuleSetEditor extends StatelessWidget {
  const RuleSetEditor({
    super.key,
    required this.title,
    required this.sub,
    required this.tone,
    required this.rs,
    required this.onChanged,
    required this.meta,
    required this.baseTf,
  });
  final String title, sub, baseTf;
  final Color tone;
  final Json rs;
  final ValueChanged<Json> onChanged;
  final AlgoMeta meta;

  List<Json> get _groups => jList(rs['groups']);

  void _setGroup(int gi, Json g) {
    final groups = [for (final x in _groups) jClone(x)];
    groups[gi] = g;
    onChanged({...rs, 'groups': groups});
  }

  void _add(int? gi, Json c) {
    final groups = [for (final x in _groups) jClone(x)];
    if (gi == null || gi >= groups.length) {
      groups.add({
        'logic': 'all',
        'conditions': [c],
      });
    } else {
      groups[gi] = {
        ...groups[gi],
        'conditions': [...jList(groups[gi]['conditions']), c],
      };
    }
    onChanged({...rs, 'groups': groups});
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final groups = _groups;
    Widget addPill(int? gi, String label) => DashedPill(
      label: label,
      onTap: () async {
        final c = await _pickPreset(context);
        if (c != null) _add(gi, c);
      },
    );
    Widget logicPill(String label, VoidCallback onTap) => KPressable(
      onTap: onTap,
      minSize: 32,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: k.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: context.text.mono(10, color: k.fg2, weight: FontWeight.w700),
            ),
            const SizedBox(width: 4),
            Icon(LucideIcons.repeat2, size: 11, color: k.fg2),
          ],
        ),
      ),
    );

    return Container(
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 3, color: tone),
            Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 8, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(title.toUpperCase(), style: context.text.micro.copyWith(color: tone, letterSpacing: 0.8)),
                        Text(
                          sub,
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        ),
                        if (groups.length > 1)
                          logicPill(
                            rs['logic'] == 'any' ? t('developer.builder.groupsAny') : t('developer.builder.groupsAll'),
                            () => onChanged({...rs, 'logic': rs['logic'] == 'any' ? 'all' : 'any'}),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (groups.isEmpty)
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(t('developer.builder.noRule'), style: context.text.footnote.copyWith(color: k.fg3)),
                          addPill(null, t('developer.builder.addCondition')),
                        ],
                      )
                    else ...[
                      for (var gi = 0; gi < groups.length; gi++)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: k.surface.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: k.line.withValues(alpha: 0.7)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (groups.length > 1)
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        t('developer.builder.group', {'n': gi + 1}).toUpperCase(),
                                        style: context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.6),
                                      ),
                                    ),
                                    KPressable(
                                      minSize: 32,
                                      semanticLabel: t('developer.builder.removeGroup'),
                                      onTap: () => onChanged({
                                        ...rs,
                                        'groups': [
                                          for (var i = 0; i < groups.length; i++)
                                            if (i != gi) groups[i],
                                        ],
                                      }),
                                      child: Icon(LucideIcons.x, size: 14, color: k.fg3),
                                    ),
                                  ],
                                ),
                              for (final (ci, c) in jList(groups[gi]['conditions']).indexed) ...[
                                if (ci > 0)
                                  Align(
                                    alignment: AlignmentDirectional.centerStart,
                                    child: Padding(
                                      padding: const EdgeInsetsDirectional.only(start: 8),
                                      child: logicPill(
                                        groups[gi]['logic'] == 'any' ? t('developer.builder.or') : t('developer.builder.and'),
                                        () => _setGroup(gi, {...groups[gi], 'logic': groups[gi]['logic'] == 'any' ? 'all' : 'any'}),
                                      ),
                                    ),
                                  ),
                                ConditionRow(
                                  c: c,
                                  meta: meta,
                                  tone: tone,
                                  baseTf: baseTf,
                                  onChanged: (nc) {
                                    final conds = [for (final x in jList(groups[gi]['conditions'])) x];
                                    conds[ci] = nc;
                                    _setGroup(gi, {...groups[gi], 'conditions': conds});
                                  },
                                  onRemove: () {
                                    final conds = [
                                      for (final (i, x) in jList(groups[gi]['conditions']).indexed)
                                        if (i != ci) x,
                                    ];
                                    if (conds.isNotEmpty) {
                                      _setGroup(gi, {...groups[gi], 'conditions': conds});
                                    } else {
                                      onChanged({
                                        ...rs,
                                        'groups': [
                                          for (var i = 0; i < groups.length; i++)
                                            if (i != gi) groups[i],
                                        ],
                                      });
                                    }
                                  },
                                ),
                              ],
                              const SizedBox(height: 4),
                              Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: addPill(gi, groups[gi]['logic'] == 'any' ? t('developer.builder.orMore') : t('developer.builder.andMore')),
                              ),
                            ],
                          ),
                        ),
                      Align(alignment: AlignmentDirectional.centerStart, child: addPill(null, t('developer.builder.addOrGroup'))),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ConditionRow extends StatelessWidget {
  const ConditionRow({
    super.key,
    required this.c,
    required this.onChanged,
    required this.onRemove,
    required this.tone,
    required this.meta,
    required this.baseTf,
  });
  final Json c;
  final ValueChanged<Json> onChanged;
  final VoidCallback onRemove;
  final Color tone;
  final AlgoMeta meta;
  final String baseTf;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final left = jMap(c['left']);
    final right = jMap(c['right']);
    final tf = jS(c['timeframe']);
    String ind(String key) => meta.indicator(key)?.label ?? key;
    final higher = !meta.timeframes.contains(baseTf) ? <String>[] : meta.timeframes.sublist(meta.timeframes.indexOf(baseTf) + 1);
    final toneChip = tone == k.up ? KChipTone.up : (tone == k.down ? KChipTone.down : KChipTone.gold);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                MenuChip(
                  label: operandText(t, left, ind),
                  tone: toneChip,
                  onTap: () async {
                    final o = await editOperand(context, left, meta, side: 'left');
                    if (o != null) onChanged({...c, 'left': o});
                  },
                ),
                if (left['kind'] == 'candle')
                  Text(t('developer.builder.isPresent'), style: context.text.footnote.copyWith(color: k.fg3))
                else ...[
                  MenuChip(
                    label: opLabel(t, jS(c['op'])),
                    onTap: () async {
                      final op = await showKPicker<String>(
                        context,
                        title: t('developer.builder.operator'),
                        selected: jS(c['op']),
                        options: [for (final o in meta.operators) KPickOption(o, opLabel(t, o))],
                      );
                      if (op != null) onChanged({...c, 'op': op});
                    },
                  ),
                  MenuChip(
                    label: operandText(t, right, ind),
                    onTap: () async {
                      final o = await editOperand(context, right, meta, side: 'right');
                      if (o != null) onChanged({...c, 'right': o});
                    },
                  ),
                ],
                MenuChip(
                  label: tf == 'same' ? baseTf : tf,
                  mono: true,
                  tone: tf == 'same' ? KChipTone.neutral : KChipTone.info,
                  onTap: () async {
                    final v = await showKPicker<String>(
                      context,
                      title: t('developer.builder.timeframe'),
                      selected: tf,
                      options: [
                        KPickOption('same', t('developer.builder.thisTimeframe', {'tf': baseTf})),
                        for (final h in higher) KPickOption(h, t('developer.builder.onTimeframe', {'tf': h}), subtitle: t('developer.builder.higherTimeframe')),
                      ],
                    );
                    if (v != null) onChanged({...c, 'timeframe': v});
                  },
                ),
              ],
            ),
          ),
          KPressable(
            minSize: 36,
            semanticLabel: t('developer.builder.removeCondition'),
            onTap: onRemove,
            child: Icon(LucideIcons.trash2, size: 15, color: k.fg3),
          ),
        ],
      ),
    );
  }
}

/// Picks an operand's source and its parameters in a sheet (web OperandChip menu + inline NumInputs).
Future<Json?> editOperand(BuildContext context, Json o, AlgoMeta meta, {required String side}) => showKSheet<Json>(
  context,
  title: context.t(side == 'left' ? 'developer.builder.leftOperand' : 'developer.builder.rightOperand'),
  builder: (_) => _OperandSheet(o: o, meta: meta, side: side),
);

class _OperandSheet extends StatefulWidget {
  const _OperandSheet({required this.o, required this.meta, required this.side});
  final Json o;
  final AlgoMeta meta;
  final String side;

  @override
  State<_OperandSheet> createState() => _OperandSheetState();
}

class _OperandSheetState extends State<_OperandSheet> {
  late Json _o = jClone(widget.o);

  String _sourceKey(Json o) => switch (o['kind']) {
    'price' => 'price:${o['field']}',
    'value' => 'value',
    'candle' => 'candle:${o['pattern']}',
    _ => 'ind:${o['indicator']}',
  };

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final meta = widget.meta;
    final options = <KPickOption<String>>[
      for (final f in meta.priceFields) KPickOption('price:$f', '${t('developer.builder.price')} · ${fieldLabel(t, f)}'),
      for (final d in meta.indicators) KPickOption('ind:${d.key}', d.label, subtitle: d.description),
      KPickOption('value', t('developer.builder.value')),
      if (widget.side == 'left')
        for (final p in meta.patterns) KPickOption('candle:$p', '${t('developer.builder.candle')} · ${patternLabel(t, p)}'),
    ];
    final cur = options.where((x) => x.value == _sourceKey(_o)).firstOrNull;
    final ind = jS(_o['indicator']);
    Widget num(String label, String key, {double? min, bool integer = true}) => SettingRow(
      label: label,
      child: NumField(
        value: jD(_o[key]),
        min: min,
        integer: integer,
        width: 90,
        semanticLabel: label,
        onChanged: (v) => setState(() => _o = {..._o, key: integer ? v.round() : v}),
      ),
    );
    return KSheetContent(
      footer: KButton(label: t('common.done'), expand: true, size: KButtonSize.lg, onPressed: () => Navigator.of(context).pop(_o)),
      children: [
        KPickerField(
          value: cur?.label,
          onTap: () async {
            final v = await showKPicker<String>(context, title: cur?.label ?? '', selected: cur?.value, options: options);
            if (v == null) return;
            setState(() {
              if (v.startsWith('price:')) {
                _o = operand('price', field: v.substring(6));
              } else if (v == 'value') {
                _o = operand('value', value: _o['kind'] == 'value' ? jD(_o['value']) : 50);
              } else if (v.startsWith('candle:')) {
                _o = operand('candle', pattern: v.substring(7));
              } else {
                final d = meta.indicator(v.substring(4));
                _o = operand(
                  'indicator',
                  indicator: v.substring(4),
                  period: d?.period ?? 14,
                  period2: d?.period2 ?? 0,
                  period3: d?.period3 ?? 0,
                  mult: d?.mult ?? 0,
                );
              }
            });
          },
        ),
        const SizedBox(height: 8),
        if (_o['kind'] == 'value') num(t('developer.builder.constant'), 'value', integer: false),
        if (_o['kind'] == 'indicator') ...[
          num(t('developer.builder.period'), 'period', min: 1),
          if (kTwoPeriods.containsKey(ind)) num(t.dyn('developer.period2.${kTwoPeriods[ind]}', fallback: kTwoPeriods[ind]), 'period2', min: 1),
          if (ind.startsWith('macd')) num(t('developer.builder.signal'), 'period3', min: 1),
          if (ind.startsWith('bb_')) num(t('developer.builder.deviations'), 'mult', min: 0.1, integer: false),
          if (!kNoSource.contains(ind) && _o['field'] != 'close')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(t('developer.builder.ofField', {'field': fieldLabel(t, jS(_o['field']))}), style: context.text.footnote.copyWith(color: k.fg3)),
            ),
        ],
        const SizedBox(height: 4),
        Text(
          operandText(t, _o, (key) => meta.indicator(key)?.label ?? key),
          textAlign: TextAlign.center,
          textDirection: TextDirection.ltr,
          style: context.text.mono(14, color: k.fg),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ settings */

class SettingsEditor extends StatelessWidget {
  const SettingsEditor({super.key, required this.spec, required this.onChanged, required this.meta});
  final Json spec;
  final ValueChanged<Json> onChanged;
  final AlgoMeta meta;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    void set(Map<String, Object?> p) => onChanged({...spec, ...p});
    final sizing = jMap(spec['sizing']);
    final trailing = jMap(spec['trailing']);
    final sessions = jList(spec['sessions']);
    final days = [for (final d in (spec['days'] as List? ?? const [])) jI(d)];

    Widget dist(String key) {
      final d = jMap(spec[key]);
      final mode = jS(d['mode']);
      final modes = meta.distanceModes.where((m) => key == 'tp' || m != 'rr').toList();
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          MenuChip(
            label: distLabel(t, mode),
            tone: mode == 'none' ? KChipTone.neutral : (key == 'sl' ? KChipTone.down : KChipTone.up),
            onTap: () async {
              final v = await showKPicker<String>(
                context,
                title: key == 'sl' ? t('developer.builder.slMode') : t('developer.builder.tpMode'),
                selected: mode,
                options: [for (final m in modes) KPickOption(m, distLabel(t, m))],
              );
              if (v != null) {
                set({
                  key: {...d, 'mode': v},
                });
              }
            },
          ),
          if (mode != 'none')
            NumField(
              value: jD(d['value']),
              min: 0,
              semanticLabel: key == 'sl' ? t('developer.builder.slValue') : t('developer.builder.tpValue'),
              onChanged: (v) => set({
                key: {...d, 'value': v},
              }),
            ),
          if (mode == 'atr')
            NumField(
              value: jD(d['atrPeriod']),
              min: 1,
              integer: true,
              suffix: t('developer.unit.bars'),
              semanticLabel: t('developer.builder.atrPeriod'),
              onChanged: (v) => set({
                key: {...d, 'atrPeriod': v.round()},
              }),
            ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SettingRow(
          label: t('developer.builder.positionSize'),
          hint: sizing['mode'] == 'risk' ? t('developer.builder.riskHint') : t('developer.builder.lotsHint'),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 150,
                child: KSegmented<String>(
                  values: const ['lots', 'risk'],
                  labels: [t('developer.builder.lots'), t('developer.builder.riskPct')],
                  selected: sizing['mode'] == 'risk' ? 'risk' : 'lots',
                  plain: true,
                  height: 32,
                  onChanged: (v) => set({
                    'sizing': {...sizing, 'mode': v},
                  }),
                ),
              ),
              const SizedBox(width: 10),
              if (sizing['mode'] == 'risk')
                NumField(
                  value: jD(sizing['riskPct']),
                  min: 0,
                  suffix: '%',
                  semanticLabel: t('developer.builder.riskPct'),
                  onChanged: (v) => set({
                    'sizing': {...sizing, 'riskPct': v},
                  }),
                )
              else
                NumField(
                  value: jD(sizing['lots']),
                  min: 0,
                  suffix: t('developer.unit.lot'),
                  semanticLabel: t('developer.builder.lots'),
                  onChanged: (v) => set({
                    'sizing': {...sizing, 'lots': v},
                  }),
                ),
            ],
          ),
        ),
        SettingRow(
          label: t('developer.builder.maxLotsPerOrder'),
          hint: t('developer.builder.maxLotsHint'),
          child: NumField(
            value: jD(spec['maxLots']),
            min: 0,
            suffix: t('developer.unit.lot'),
            semanticLabel: t('developer.builder.maxLots'),
            onChanged: (v) => set({'maxLots': v}),
          ),
        ),
        SettingRow(label: t('developer.builder.stopLoss'), child: dist('sl')),
        SettingRow(label: t('developer.builder.takeProfit'), child: dist('tp')),
        SettingRow(
          label: t('developer.builder.trailingStop'),
          hint: t('developer.builder.trailingHint'),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              MenuChip(
                label: distLabel(t, jS(trailing['mode'])),
                tone: trailing['mode'] == 'none' ? KChipTone.neutral : KChipTone.gold,
                onTap: () async {
                  final v = await showKPicker<String>(
                    context,
                    title: t('developer.builder.trailingMode'),
                    selected: jS(trailing['mode']),
                    options: [for (final m in meta.trailModes) KPickOption(m, distLabel(t, m))],
                  );
                  if (v != null) {
                    set({
                      'trailing': {...trailing, 'mode': v},
                    });
                  }
                },
              ),
              if (trailing['mode'] != 'none')
                NumField(
                  value: jD(trailing['value']),
                  min: 0,
                  semanticLabel: t('developer.builder.trailingDistance'),
                  onChanged: (v) => set({
                    'trailing': {...trailing, 'value': v},
                  }),
                ),
            ],
          ),
        ),
        SettingRow(
          label: t('developer.builder.breakeven'),
          hint: t('developer.builder.breakevenHint'),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              NumField(
                value: jD(trailing['breakevenTrigger']),
                min: 0,
                suffix: t('developer.unit.pts'),
                semanticLabel: t('developer.builder.breakevenTrigger'),
                onChanged: (v) => set({
                  'trailing': {...trailing, 'breakevenTrigger': v},
                }),
              ),
              Text('+', style: context.text.callout.copyWith(color: k.fg3)),
              NumField(
                value: jD(trailing['breakevenOffset']),
                suffix: t('developer.unit.pts'),
                semanticLabel: t('developer.builder.breakevenOffset'),
                onChanged: (v) => set({
                  'trailing': {...trailing, 'breakevenOffset': v},
                }),
              ),
            ],
          ),
        ),
        SettingRow(
          label: t('developer.builder.tradingWindow'),
          hint: t('developer.builder.tradingWindowHint'),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (var i = 0; i < sessions.length; i++)
                _SessionChip(
                  key: ValueKey(i),
                  start: jS(sessions[i]['start']),
                  end: jS(sessions[i]['end']),
                  onChanged: (s, e) => set({
                    'sessions': [
                      for (var j = 0; j < sessions.length; j++) j == i ? {'start': s, 'end': e} : sessions[j],
                    ],
                  }),
                  onRemove: () => set({
                    'sessions': [
                      for (var j = 0; j < sessions.length; j++)
                        if (j != i) sessions[j],
                    ],
                  }),
                ),
              if (sessions.length < 4)
                DashedPill(
                  label: t('developer.builder.window'),
                  onTap: () => set({
                    'sessions': [
                      ...sessions,
                      {'start': '08:00', 'end': '17:00'},
                    ],
                  }),
                ),
            ],
          ),
        ),
        SettingRow(
          label: t('developer.builder.days'),
          hint: t('developer.builder.daysHint'),
          child: PillChoice<int>(
            values: const [0, 1, 2, 3, 4, 5, 6],
            labels: [for (final d in _days) t('developer.day.$d')],
            isSelected: days.contains,
            onTap: (i) => set({
              'days': days.contains(i) ? (days.where((x) => x != i).toList()) : ([...days, i]..sort()),
            }),
          ),
        ),
        _switchRow(
          context,
          t('developer.builder.closeOutside'),
          spec['closeOutsideSession'] == true,
          (v) => set({'closeOutsideSession': v}),
          t('developer.builder.closeOutsideAria'),
        ),
        SettingRow(
          label: t('developer.builder.maxTradesPerDay'),
          hint: t('developer.builder.maxTradesHint'),
          child: NumField(
            value: jD(spec['maxTradesPerDay']),
            min: 0,
            integer: true,
            semanticLabel: t('developer.builder.maxTradesPerDay'),
            onChanged: (v) => set({'maxTradesPerDay': v.round()}),
          ),
        ),
        SettingRow(
          label: t('developer.builder.maxDailyLoss'),
          hint: t('developer.builder.maxDailyLossHint'),
          child: NumField(
            value: jD(spec['maxDailyLoss']),
            min: 0,
            suffix: 'USD',
            semanticLabel: t('developer.builder.maxDailyLoss'),
            onChanged: (v) => set({'maxDailyLoss': v}),
          ),
        ),
        _switchRow(
          context,
          t('developer.builder.oneAtATime'),
          spec['oneAtATime'] == true,
          (v) => set({'oneAtATime': v}),
          t('developer.builder.oneAtATime'),
          last: true,
        ),
      ],
    );
  }

  Widget _switchRow(BuildContext context, String label, bool value, ValueChanged<bool> onChanged, String aria, {bool last = false}) => Container(
    padding: const EdgeInsets.symmetric(vertical: 6),
    decoration: BoxDecoration(
      border: last ? null : Border(bottom: BorderSide(color: context.k.line, width: 0.6)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(label, style: context.text.callout.copyWith(color: context.k.fg)),
        ),
        KSwitch(value: value, semanticLabel: aria, onChanged: onChanged),
      ],
    ),
  );
}

/// A trading window "08:00–17:00" with two small time fields and a remove button.
class _SessionChip extends StatefulWidget {
  const _SessionChip({super.key, required this.start, required this.end, required this.onChanged, required this.onRemove});
  final String start, end;
  final void Function(String start, String end) onChanged;
  final VoidCallback onRemove;

  @override
  State<_SessionChip> createState() => _SessionChipState();
}

class _SessionChipState extends State<_SessionChip> {
  late final _s = TextEditingController(text: widget.start);
  late final _e = TextEditingController(text: widget.end);

  @override
  void didUpdateWidget(_SessionChip old) {
    super.didUpdateWidget(old);
    // a window removed before this one shifts the rows: show this row's values
    if (_s.text != widget.start) _s.text = widget.start;
    if (_e.text != widget.end) _e.text = widget.end;
  }

  @override
  void dispose() {
    _s.dispose();
    _e.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final style = context.text.mono(12.5, color: k.fg2);
    Widget field(TextEditingController c, String label) => SizedBox(
      width: 46,
      child: Semantics(
        label: label,
        child: TextField(
          controller: c,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.datetime,
          style: style,
          cursorColor: k.ember,
          decoration: const InputDecoration(isCollapsed: true, border: InputBorder.none, contentPadding: EdgeInsets.symmetric(vertical: 8)),
          onChanged: (_) => widget.onChanged(_s.text, _e.text),
        ),
      ),
    );
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Container(
        padding: const EdgeInsets.only(left: 4),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: k.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            field(_s, t('developer.builder.sessionStart')),
            Text('–', style: style),
            field(_e, t('developer.builder.sessionEnd')),
            KPressable(
              minSize: 32,
              semanticLabel: t('developer.builder.removeWindow'),
              onTap: widget.onRemove,
              child: Icon(LucideIcons.x, size: 13, color: k.fg3),
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ code */

/// The code editor (web CodeEditor): file header with the compiler state, the code with line numbers, the errors.
class StrategyCodeEditor extends StatelessWidget {
  const StrategyCodeEditor({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.errors,
    required this.warnings,
    required this.validating,
  });
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final List<BuildError> errors;
  final List<String> warnings;
  final bool validating;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text('strategy.kst', style: context.text.mono(11.5, color: k.fg3)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '· ${t('developer.code.language')}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.caption.copyWith(color: k.fg3),
              ),
            ),
            if (validating) ...[
              const SizedBox.square(dimension: 12, child: CircularProgressIndicator.adaptive(strokeWidth: 1.6)),
              const SizedBox(width: 5),
              Text(t('developer.code.checking'), style: context.text.caption.copyWith(color: k.fg3)),
            ] else if (errors.isNotEmpty) ...[
              Icon(LucideIcons.triangleAlert, size: 13, color: k.down),
              const SizedBox(width: 4),
              Text(t('developer.code.errors', {'count': errors.length}), style: context.text.caption.copyWith(color: k.down)),
            ] else ...[
              Icon(LucideIcons.circleCheck, size: 13, color: k.up),
              const SizedBox(width: 4),
              Text(t('developer.code.compiles'), style: context.text.caption.copyWith(color: k.up)),
            ],
          ],
        ),
        const SizedBox(height: 8),
        CodeField(
          controller: controller,
          onChanged: onChanged,
          minLines: 14,
          maxLines: 28,
          lineNumbers: true,
          errorLines: {for (final e in errors) ?e.line},
          semanticLabel: t('developer.code.aria'),
        ),
        if (errors.isNotEmpty || warnings.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (final e in errors)
            KPressable(
              pressedScale: 1,
              onTap: e.line == null
                  ? null
                  : () {
                      final lines = controller.text.split('\n');
                      final before = lines.take(e.line! - 1).join('\n').length + (e.line! > 1 ? 1 : 0);
                      final idx = (before + (e.col ?? 1) - 1).clamp(0, controller.text.length);
                      controller.selection = TextSelection.collapsed(offset: idx);
                    },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Icon(LucideIcons.triangleAlert, size: 13, color: k.down),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${e.line != null ? '${t('developer.code.line', {'line': e.line, 'col': e.col ?? 1})} · ' : ''}${e.message}',
                        style: context.text.footnote.copyWith(color: k.down),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          for (final w in warnings)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Icon(LucideIcons.triangleAlert, size: 13, color: k.warn),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(w, style: context.text.footnote.copyWith(color: k.warn)),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }
}

/// The language reference (web DslReference, a `details` block).
class DslReference extends StatefulWidget {
  const DslReference({super.key, required this.meta});
  final AlgoMeta meta;

  @override
  State<DslReference> createState() => _DslReferenceState();
}

class _DslReferenceState extends State<DslReference> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final m = widget.meta;
    Widget item(DslLine l, Color color) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.syntax,
            textDirection: TextDirection.ltr,
            style: context.text.mono(11.5, color: color),
          ),
          Text(
            l.text,
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
        ],
      ),
    );
    return Container(
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KPressable(
            pressedScale: 1,
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(LucideIcons.bookOpen, size: 16, color: k.fg2),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(t('developer.code.reference'), style: context.text.callout.copyWith(color: k.fg2)),
                  ),
                  if (!_open) Text(t('developer.code.show'), style: context.text.caption.copyWith(color: k.fg3)),
                  Icon(_open ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 15, color: k.fg3),
                ],
              ),
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SmallLabel(t('developer.code.settings')),
                  for (final s in m.settings) item(s, const Color(0xFFC084FC)),
                  const SizedBox(height: 10),
                  SmallLabel(t('developer.code.functions')),
                  for (final s in m.functions) item(s, const Color(0xFF38BDF8)),
                  const SizedBox(height: 10),
                  KRichText(
                    t('developer.code.signalsNote', {
                      'chars': m.limits['sourceChars'] == null ? '' : fmtNum(m.limits['sourceChars'], 0),
                      'statements': m.limits['statements'],
                      'nodes': m.limits['nodes'] == null ? '' : fmtNum(m.limits['nodes'], 0),
                      'period': m.limits['period'],
                    }),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    tags: {'code': KTag(style: context.text.mono(11, color: k.ember))},
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
