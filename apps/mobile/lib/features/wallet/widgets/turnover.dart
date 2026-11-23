// Deposit turnover on the phone: port of apps/crm/components/wallet-live/turnover.tsx.
//
// Two faces of one fact. On the wallet and the dashboard it is a quiet panel showing how far along the client
// is. On Withdraw it is the gate: tapping Withdraw while volume is owed opens this sheet instead of the payout
// form, with the deposit holding things up and a way back to the terminal.
//
// It only ever explains the broker's answer. The block itself is enforced in the wallet service
// (services/wallet/src/ops/turnover.rs), on the same path a direct API call takes, so the phone cannot talk
// its way past it and does not have to try. Where the broker has the policy switched off, every client reads
// as eligible and none of this renders.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/format/format.dart';
import '../../../env.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../wallet_api.dart';

/// `$1,234.56`, the figures the service sends as decimal strings.
String _usd(String v) => Fmt.money(double.tryParse(v) ?? 0);

/// A volume figure in the unit the service counted it in: "0.30 lots", or dollars for the older notional rule.
String _vol(BuildContext context, String v, String unit) =>
    unit == 'lots' ? context.t('wallet.turnover.lots', {'n': (double.tryParse(v) ?? 0).toStringAsFixed(2)}) : _usd(v);

/// The amounts, the bar and the sentence — shared by the panel and the sheet.
class _Body extends StatelessWidget {
  const _Body({required this.d, this.compact = false});

  final Turnover d;

  /// The panel drops the per-deposit breakdown; the sheet keeps it.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pending = d.rows.where((r) => r.status == 'pending').toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _Figure(label: t('wallet.turnover.deposited'), value: _usd(d.deposits)),
            _Figure(label: t('wallet.turnover.required'), value: _vol(context, d.required_, d.unit)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _Figure(label: t('wallet.turnover.completed'), value: _vol(context, d.completed, d.unit)),
            _Figure(label: t('wallet.turnover.remaining'), value: _vol(context, d.remaining, d.unit), strong: true),
          ],
        ),
        const SizedBox(height: 14),
        KProgressBar(value: d.percent / 100),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(t('wallet.turnover.percentDone', {'pct': d.percent}), style: context.text.caption.copyWith(color: k.fg3)),
            Text(t('wallet.turnover.left', {'amount': _vol(context, d.remaining, d.unit)}), style: context.text.caption.copyWith(color: k.ember, fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          t('wallet.turnover.explain', {'deposited': _usd(d.deposits), 'completed': _vol(context, d.completed, d.unit), 'remaining': _vol(context, d.remaining, d.unit)}),
          style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12.5, height: 1.4),
        ),
        // deposit by deposit, for a client who has funded more than once and wants to know which one is holding up
        if (!compact && pending.length > 1) ...[
          const SizedBox(height: 14),
          Divider(height: 1, color: k.line),
          const SizedBox(height: 12),
          Text(t('wallet.turnover.perDeposit', {'count': pending.length}), style: context.text.footnote.copyWith(color: k.fg2, fontWeight: FontWeight.w600)),
          for (final r in pending) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(t('wallet.turnover.depositOf', {'amount': _usd(r.deposit)}), style: context.text.caption.copyWith(color: k.fg2)),
                Text('${_vol(context, r.completed, r.unit)} / ${_vol(context, r.required_, r.unit)}', style: context.text.caption.copyWith(color: k.fg3)),
              ],
            ),
            const SizedBox(height: 5),
            KProgressBar(value: r.percent / 100, height: 4),
          ],
        ],
      ],
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value, this.strong = false});

  final String label, value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: context.text.caption.copyWith(color: k.fg3), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(
            value,
            style: context.text.headline.copyWith(fontSize: 15, fontWeight: strong ? FontWeight.w700 : FontWeight.w600, color: strong ? k.ember : k.fg),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

/// The panel on the wallet and the dashboard, so a trading requirement is known long before anyone taps
/// Withdraw. A client who first meets it on the way out has been dealt with badly, whatever the terms said.
class TurnoverPanel extends ConsumerWidget {
  const TurnoverPanel({super.key, this.bottom = 0});

  /// Space under the panel when it shows.
  final double bottom;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    // the sample client has no deposits of their own, and asking would only fail
    if (Env.preview || ref.watch(demoModeProvider)) return const SizedBox.shrink();
    final d = ref.watch(turnoverProvider).value;
    if (d == null || !d.owes) return const SizedBox.shrink();
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: k.emberSoft),
                  child: Icon(LucideIcons.target, size: 18, color: k.ember),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('wallet.turnover.panelTitle'), style: context.text.headline.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(t('wallet.turnover.panelSub'), style: context.text.caption.copyWith(color: k.fg3)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _Body(d: d, compact: true),
          ],
        ),
      ),
    );
  }
}

/// The gate on Withdraw. Resolves to true when the client chose to go and trade, so the screen can send them
/// to the terminal rather than back to the wallet. The payout form stays off either way.
Future<bool> showTurnoverGate(BuildContext context, Turnover d) async {
  final t = context.t;
  final trade = await showKSheet<bool>(
    context,
    title: t('wallet.turnover.gateTitle'),
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t('wallet.turnover.gateSub'), style: ctx.text.footnote.copyWith(color: ctx.k.fg3, height: 1.35)),
        const SizedBox(height: 16),
        _Body(d: d),
        const SizedBox(height: 18),
        KButton(
          label: t('wallet.turnover.continueTrading'),
          icon: LucideIcons.trendingUp,
          expand: true,
          onPressed: () => Navigator.of(ctx).pop(true),
        ),
        const SizedBox(height: 8),
        KButton(label: t('common.close'), variant: KButtonVariant.ghost, expand: true, onPressed: () => Navigator.of(ctx).pop(false)),
      ],
    ),
  );
  return trade == true;
}

/// Shown on Withdraw once the volume is there, so the client knows why the form opened this time.
class TurnoverCleared extends ConsumerWidget {
  const TurnoverCleared({super.key, this.bottom = 0});

  final double bottom;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    if (Env.preview || ref.watch(demoModeProvider)) return const SizedBox.shrink();
    final d = ref.watch(turnoverProvider).value;
    if (d == null || !d.enforced || !d.eligible || (double.tryParse(d.required_) ?? 0) <= 0) return const SizedBox.shrink();
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: k.upSoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: k.up.withValues(alpha: 0.3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(LucideIcons.badgeCheck, size: 17, color: k.up),
            const SizedBox(width: 10),
            Expanded(child: Text(t('wallet.turnover.cleared'), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12.5, height: 1.35))),
          ],
        ),
      ),
    );
  }
}
