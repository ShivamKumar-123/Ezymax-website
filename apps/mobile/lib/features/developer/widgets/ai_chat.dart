// AI assistant of the strategy builder (port of apps/crm/components/algo/ai-chat.tsx, D87): describe a strategy in
// plain language; the service returns visual rules or code, validated. Follow-ups can edit the current strategy.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../developer_api.dart';
import 'algo_widgets.dart';

class _AiReply {
  _AiReply(Map<String, dynamic> j)
    : model = jS(j['model']),
      target = jS(j['target']),
      status = jS(j['status']),
      questions = jStrs(j['questions']),
      assumptions = jStrs(j['assumptions']),
      result = Built(jMap(j['result']));
  final String model, target, status;
  final List<String> questions, assumptions;
  final Built result;
}

class _Msg {
  _Msg.user(this.text) : reply = null;
  _Msg.ai(this.reply) : text = null;
  final String? text;
  final _AiReply? reply;
  bool applied = false;
  bool open = false;
}

class AiAssistant extends ConsumerStatefulWidget {
  const AiAssistant({
    super.key,
    required this.configured,
    required this.mode,
    required this.symbol,
    required this.timeframe,
    required this.current,
    required this.onApply,
    this.readOnly = false,
  });
  final bool configured, readOnly;
  final String mode, symbol, timeframe;

  /// The strategy in the editor (spec or code), sent when "edit the current strategy" is on.
  final Object? Function() current;
  final void Function(Built b, String prompt) onApply;

  @override
  ConsumerState<AiAssistant> createState() => _AiAssistantState();
}

class _AiAssistantState extends ConsumerState<AiAssistant> {
  final _msgs = <_Msg>[];
  final _text = TextEditingController();
  late String _target = widget.mode;
  bool _busy = false;
  bool _edit = false;

  @override
  void didUpdateWidget(AiAssistant old) {
    super.didUpdateWidget(old);
    if (old.mode != widget.mode) _target = widget.mode;
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send(String prompt) async {
    final p = prompt.trim();
    if (p.isEmpty || _busy) return;
    final t = context.t;
    setState(() {
      _msgs.add(_Msg.user(p));
      _text.clear();
      _busy = true;
    });
    try {
      final j = await ref.read(apiProvider).algoPost('ai/strategy', {
        'prompt': p,
        'symbol': widget.symbol,
        'timeframe': widget.timeframe,
        'target': _target,
        if (_edit) 'current': widget.current(),
      });
      if (mounted) setState(() => _msgs.add(_Msg.ai(_AiReply(j))));
    } on Object catch (e) {
      algoFail(ref, t, t('developer.ai.buildFailed'), e);
      if (mounted) {
        setState(() {
          _msgs.removeLast();
          _text.text = p;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final on = widget.configured && !widget.readOnly;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            icon: LucideIcons.bot,
            title: t('developer.ai.title'),
            subtitle: widget.configured ? t('developer.ai.subtitle') : t('developer.ai.notConfiguredServer'),
          ),
          const SizedBox(height: 10),
          KSegmented<String>(
            values: const ['visual', 'code'],
            labels: [t('developer.mode.rules'), t('developer.mode.code')],
            selected: _target,
            plain: true,
            height: 32,
            onChanged: (v) => setState(() => _target = v),
          ),
          const SizedBox(height: 12),
          if (_msgs.isEmpty) ...[
            Text(t('developer.ai.tryExamples'), style: context.text.footnote.copyWith(color: k.fg3)),
            const SizedBox(height: 8),
            for (final key in ['developer.ai.example1', 'developer.ai.example2', 'developer.ai.example3'])
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Opacity(
                  opacity: on && !_busy ? 1 : 0.5,
                  child: KPressable(
                    pressedScale: 0.99,
                    onTap: on && !_busy ? () => _send(t(key)) : null,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                      decoration: BoxDecoration(
                        color: k.surface2.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: k.line),
                      ),
                      child: Text(t(key), style: context.text.footnote.copyWith(color: k.fg2)),
                    ),
                  ),
                ),
              ),
          ],
          for (final (i, m) in _msgs.indexed)
            if (m.text != null)
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Container(
                  margin: const EdgeInsetsDirectional.only(start: 32, bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: k.emberSoft,
                    borderRadius: const BorderRadiusDirectional.only(
                      topStart: Radius.circular(14),
                      topEnd: Radius.circular(4),
                      bottomStart: Radius.circular(14),
                      bottomEnd: Radius.circular(14),
                    ),
                  ),
                  child: Text(m.text!, style: context.text.callout.copyWith(color: k.fg)),
                ),
              )
            else
              _reply(context, i, m),
          if (_busy)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  const SizedBox.square(dimension: 14, child: CircularProgressIndicator.adaptive(strokeWidth: 1.8)),
                  const SizedBox(width: 8),
                  Text(t('developer.ai.drafting'), style: context.text.footnote.copyWith(color: k.fg3)),
                ],
              ),
            ),
          const KDivider(),
          const SizedBox(height: 10),
          if (_msgs.isNotEmpty) KCheckRow(value: _edit, onChanged: (v) => setState(() => _edit = v), child: Text(t('developer.ai.editExisting'))),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: CodeField(
                  controller: _text,
                  mono: false,
                  ltr: false,
                  maxLines: 5,
                  maxLength: 4000,
                  placeholder: widget.configured ? t('developer.ai.placeholder') : t('developer.ai.notConfigured'),
                  semanticLabel: t('developer.ai.describeAria'),
                ),
              ),
              const SizedBox(width: 8),
              KIconButton(icon: LucideIcons.arrowUp, filled: true, semanticLabel: t('common.send'), onPressed: on && !_busy ? () => _send(_text.text) : null),
            ],
          ),
        ],
      ),
    );
  }

  Widget _reply(BuildContext context, int i, _Msg m) {
    final t = context.t;
    final k = context.k;
    final r = m.reply!;
    final b = r.result;
    return Container(
      margin: const EdgeInsetsDirectional.only(end: 16, bottom: 10),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.6),
        border: Border.all(color: k.line),
        borderRadius: const BorderRadiusDirectional.only(
          topStart: Radius.circular(4),
          topEnd: Radius.circular(14),
          bottomStart: Radius.circular(14),
          bottomEnd: Radius.circular(14),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(LucideIcons.sparkles, size: 14, color: k.gold),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  jS(b.spec['name']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.label.copyWith(color: k.fg),
                ),
              ),
              KChip(
                label: r.status == 'ok' ? t('developer.ai.ready') : t('developer.ai.needsInput'),
                tone: r.status == 'ok' ? KChipTone.up : KChipTone.warn,
                small: true,
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            '${jS(b.spec['symbol'])} · ${jS(b.spec['timeframe'])} · ${r.target == 'code' ? t('developer.ai.targetCode') : t('developer.ai.targetRules')}',
            style: context.text.mono(11, color: k.fg3),
          ),
          if (b.summary.isNotEmpty) ...[
            const SizedBox(height: 6),
            for (final e in b.summary.entries)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 64,
                      child: Text(
                        signalLabel(t, e.key).toUpperCase(),
                        style: context.text.micro.copyWith(color: e.key == 'buy' ? k.up : (e.key == 'sell' ? k.down : k.gold), height: 1.6),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        e.value,
                        textDirection: TextDirection.ltr,
                        style: context.text.mono(11.5, color: k.fg2),
                      ),
                    ),
                  ],
                ),
              ),
          ],
          for (final q in r.questions)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Icon(LucideIcons.circleHelp, size: 13, color: k.warn),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(q, style: context.text.footnote.copyWith(color: k.warn)),
                  ),
                ],
              ),
            ),
          if (r.assumptions.isNotEmpty) ...[
            const SizedBox(height: 6),
            KPressable(
              pressedScale: 1,
              minSize: 28,
              onTap: () => setState(() => m.open = !m.open),
              child: Text(t('developer.ai.assumptions', {'count': r.assumptions.length}), style: context.text.caption.copyWith(color: k.fg3)),
            ),
            if (m.open)
              for (final a in r.assumptions)
                Padding(
                  padding: const EdgeInsetsDirectional.only(start: 8, top: 2),
                  child: Text(
                    '• $a',
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              KButton(
                label: m.applied ? t('developer.ai.applied') : t('developer.ai.applyToEditor'),
                icon: m.applied ? LucideIcons.check : null,
                variant: m.applied ? KButtonVariant.surface : KButtonVariant.outline,
                size: KButtonSize.sm,
                onPressed: m.applied || widget.readOnly
                    ? null
                    : () {
                        final prompt = _msgs.take(i).lastWhere((x) => x.text != null, orElse: () => _Msg.user('')).text ?? '';
                        widget.onApply(b, prompt);
                        setState(() {
                          m.applied = true;
                          _edit = true;
                        });
                      },
              ),
              const SizedBox(width: 8),
              if (!b.valid)
                Expanded(
                  child: Text(t('developer.issuesToFix', {'count': b.errors.length}), style: context.text.caption.copyWith(color: k.down)),
                )
              else
                const Spacer(),
              Text(
                r.model,
                style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
