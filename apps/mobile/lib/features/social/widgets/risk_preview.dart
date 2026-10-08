// A9 risk preview before following (GET masters/{id}/preview): the worst case the follower's own protection allows,
// what the master's worst drawdown so far would mean for this amount, the risk score and the last trades re-sized.
// Port of apps/crm/components/social-live/risk-preview.tsx.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../social_api.dart';
import 'bits.dart';

String _n2(double v) => numText((v * 100).round() / 100);

class RiskPreviewBox extends ConsumerStatefulWidget {
  const RiskPreviewBox({
    super.key,
    required this.masterId,
    required this.allocation,
    required this.equityStop,
    required this.maxDdPct,
    required this.mode,
    required this.value,
    this.invite,
    this.examples = true,
  });
  final int masterId;
  final double allocation;
  final double? equityStop;
  final double? maxDdPct;
  final String mode;
  final double value;
  final String? invite;
  final bool examples;

  @override
  ConsumerState<RiskPreviewBox> createState() => _RiskPreviewBoxState();
}

class _RiskPreviewBoxState extends ConsumerState<RiskPreviewBox> {
  String? _path;
  String? _want;
  Timer? _timer;

  String? _build() {
    final w = widget;
    if (!(w.allocation > 0) || w.allocation > 1e9) return null;
    final q = <String, String>{'allocation': _n2(w.allocation), 'sizing': w.mode};
    final es = w.equityStop;
    if (es != null && es > 0 && es < w.allocation) q['equityStop'] = _n2(es);
    final dd = w.maxDdPct;
    if (dd != null && dd >= 1 && dd <= 99) q['maxDdPct'] = _n2(dd);
    if (w.mode != 'equity' && w.value > 0 && w.value <= 1e9) q['value'] = _n2(w.value);
    if (w.invite != null) q['invite'] = w.invite!;
    return Uri(path: 'masters/${w.masterId}/preview', queryParameters: q).toString();
  }

  void _schedule() {
    _timer?.cancel();
    final next = _want = _build();
    if (next == null) {
      _path = null;
      return;
    }
    // debounced: a new preview only once the amount and limits stop changing
    _timer = Timer(const Duration(milliseconds: 400), () {
      if (mounted) setState(() => _path = next);
    });
  }

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didUpdateWidget(RiskPreviewBox old) {
    super.didUpdateWidget(old);
    if (_build() != _want) _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final path = _path;
    final q = path == null ? null : ref.watch(riskPreviewProvider(path));
    final p = q?.value;
    final (bg, _, border) = k.chip(KChipTone.down);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(LucideIcons.shieldAlert, size: 16, color: k.down),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  t('social.follow.preview.title'),
                  style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                ),
              ),
              if (p != null) RiskBadge(risk: numOf(p.master['riskScore']), showLabel: true),
            ],
          ),
          const SizedBox(height: 8),
          if (p == null)
            (q != null && q.hasError)
                ? Text(t('social.follow.preview.unavailable'), style: context.text.footnote.copyWith(color: k.fg3))
                : const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [KSkeleton(width: 240, height: 13), SizedBox(height: 6), KSkeleton(width: 170, height: 13)],
                  )
          else
            DefaultTextStyle.merge(
              style: context.text.footnote.copyWith(color: k.fg2, height: 1.5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KRichText(
                    t('social.follow.preview.worst', {
                      'loss': usd(-numOf(p.worstCase['loss'])),
                      'pct': numText((numOf(p.worstCase['pctOfAllocation']) * 10).round() / 10),
                    }),
                    style: context.text.callout,
                    tags: {
                      'b': KTag(
                        style: TextStyle(color: k.down, fontWeight: FontWeight.w700),
                      ),
                    },
                  ),
                  if (t.dyn('social.follow.preview.basis.${strOf(p.worstCase['basis'])}', fallback: '').isNotEmpty)
                    Text(
                      t.dyn('social.follow.preview.basis.${strOf(p.worstCase['basis'])}', fallback: ''),
                      style: TextStyle(color: k.fg3),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    numOf(p.master['maxDdPct']) > 0
                        ? t('social.follow.preview.masterDd', {
                            'dd': numText((numOf(p.master['maxDdPct']) * 10).round() / 10),
                            'loss': usd(-numOf(p.master['lossAtMaxDd'])),
                          })
                        : t('social.follow.preview.noDd'),
                  ),
                  if (widget.examples && p.example.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(t('social.follow.preview.examples').toUpperCase(), style: context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.4)),
                    const SizedBox(height: 4),
                    for (final x in p.example.take(5)) _ExampleLine(x),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    t('social.follow.preview.note'),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ExampleLine extends StatelessWidget {
  const _ExampleLine(this.x);
  final Map<String, dynamic> x;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final side = strOf(x['side']);
    final skipped = x['skipped'] == true || x['yourVolume'] == null;
    final yp = numOrNull(x['yourProfit']);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 74,
            child: Text(
              strOf(x['symbol']),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.text.footnote.copyWith(color: k.fg, fontWeight: FontWeight.w600),
            ),
          ),
          KChip(
            label: t.dyn('common.$side', fallback: side).toUpperCase(),
            tone: side == 'buy' ? KChipTone.up : KChipTone.down,
            small: true,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Num(
              '${numOf(x['masterVolume']).toStringAsFixed(2)} → ${skipped ? t('social.follow.preview.skipped') : numOf(x['yourVolume']).toStringAsFixed(2)}',
              color: k.fg3,
              style: context.text.footnote,
            ),
          ),
          Num(
            yp != null && !skipped ? usd(yp, 2, true) : '—',
            color: (yp ?? 0) > 0 ? k.up : ((yp ?? 0) < 0 ? k.down : k.fg3),
            style: context.text.footnote.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
