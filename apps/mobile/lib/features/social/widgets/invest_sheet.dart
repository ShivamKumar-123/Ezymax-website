// Invest in a PAMM fund: the wallet is debited now, units are issued at the next rollover NAV.
// Port of apps/crm/components/social-live/invest-dialog.tsx (GET funds/{id}, POST funds/{id}/invest).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../data/client_data.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../social_api.dart';
import 'bits.dart';
import 'follow_sheet.dart';

Future<void> showInvestSheet(BuildContext context, {required int fundId, VoidCallback? onDone}) => showKSheet<void>(
  context,
  expand: true,
  builder: (_) => InvestSheet(fundId: fundId, onDone: onDone),
);

class InvestSheet extends ConsumerStatefulWidget {
  const InvestSheet({super.key, required this.fundId, this.onDone});
  final int fundId;
  final VoidCallback? onDone;

  @override
  ConsumerState<InvestSheet> createState() => _InvestSheetState();
}

class _InvestSheetState extends ConsumerState<InvestSheet> {
  final _amount = TextEditingController();
  bool _seeded = false;
  bool _slOn = false;
  double _sl = 20;
  bool _agree = false;
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  String? _err(T t, FundView f, double? available) {
    final a = parseAmount(_amount.text) ?? 0;
    if (!(a > 0)) return t('social.follow.err.enterAmount');
    if (a < f.minInvestment) return t('social.invest.err.min', {'amount': usd(f.minInvestment, 0)});
    if (available != null && a > available) return t('social.follow.err.overBalance', {'balance': fmtUsdt(available)});
    return null;
  }

  Future<void> _confirm(FundView f, String next) async {
    final t = context.t;
    final amt = parseAmount(_amount.text) ?? 0;
    setState(() => _busy = true);
    try {
      await socialPost(ref, 'funds/${f.id}/invest', {'amount': amt, if (_slOn) 'stopLossPct': _sl.round()});
      okToast(ref, t('social.invest.toast.queued'), t('social.invest.toast.queuedDesc', {'amount': usd(amt), 'next': next}));
      ref
        ..invalidate(investmentsProvider)
        ..invalidate(walletOverviewProvider);
      widget.onDone?.call();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.invest.toast.failed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final q = ref.watch(fundDetailProvider(widget.fundId));
    final f = q.value?.fund;
    final available = walletAvailable(ref);
    if (f != null && !_seeded) {
      _seeded = true;
      _amount.text = inputText(f.minInvestment > 100 ? f.minInvestment : 100);
    }
    final err = f == null ? null : _err(t, f, available);
    final frozen = f != null && f.status != 'active';
    final next = f?.nextRolloverAt != null ? serverTime(t, f!.nextRolloverAt) : t('social.invest.theNextRollover');
    final amt = parseAmount(_amount.text) ?? 0;
    return KSheetContent(
      footer: Row(
        children: [
          KButton(label: t('common.cancel'), variant: KButtonVariant.ghost, size: KButtonSize.lg, onPressed: _busy ? null : () => Navigator.of(context).pop()),
          const SizedBox(width: 8),
          Expanded(
            child: KButton(
              label: t('social.invest.queue'),
              size: KButtonSize.lg,
              expand: true,
              loading: _busy,
              onPressed: f == null || err != null || !_agree || frozen ? null : () => _confirm(f, next),
            ),
          ),
        ],
      ),
      children: [
        SheetTitle(title: f != null ? t('social.invest.title', {'name': f.name}) : t('social.invest'), description: t('social.invest.description')),
        if (f == null)
          q.hasError
              ? InfoBox(tone: KChipTone.down, text: socialError(q.error, t))
              : const Column(
                  children: [
                    KSkeleton(height: 64, radius: 16),
                    SizedBox(height: 12),
                    KSkeleton(height: 44, radius: 14),
                    SizedBox(height: 12),
                    KSkeleton(height: 96, radius: 16),
                  ],
                )
        else ...[
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MasterIdentity(
                  nickname: f.masterName,
                  size: 38,
                  subText: t('social.invest.navSub', {'nav': nav4(f.nav), 'period': periodLabel(t, f.period).toLowerCase()}),
                ),
                const SizedBox(height: 6),
                Text(t('social.minAmount', {'amount': usd(f.minInvestment, 0)}), style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ),
          ),
          if (frozen) ...[
            const SizedBox(height: 12),
            InfoBox(
              tone: KChipTone.warn,
              icon: LucideIcons.snowflake,
              text: t('social.invest.frozen', {'status': t.dyn('social.fundStatus.${f.status}', fallback: f.status).toLowerCase()}),
            ),
          ],
          const SizedBox(height: 14),
          NumberField(
            controller: _amount,
            label: t('common.amount'),
            hint: available != null
                ? '${t('social.invest.usdFromWallet')} · ${t('social.follow.walletAvailable', {'balance': fmtUsdt(available)})}'
                : t('social.invest.usdFromWallet'),
            dollar: true,
            unit: 'USD',
            error: _amount.text.isNotEmpty ? err : null,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final v in <double>{
                f.minInvestment,
                500,
                1000,
                2500,
                5000,
              }.where((v) => v >= f.minInvestment && v > 0 && (available == null || v <= available)))
                ToggleChip(label: usd(v, 0), on: amt == v, onTap: () => setState(() => _amount.text = inputText(v))),
            ],
          ),
          const SizedBox(height: 14),
          TileGrid(
            tiles: [
              Tile(
                label: t('social.invest.unitsEstimate'),
                value: Num(f.nav > 0 ? units4(amt / f.nav) : '—'),
                sub: t('social.invest.atNav', {'nav': nav4(f.nav)}),
              ),
              Tile(
                label: t('social.invest.executesAt'),
                value: Row(
                  children: [
                    Icon(LucideIcons.calendarClock, size: 14, color: k.ember),
                    const SizedBox(width: 5),
                    Expanded(child: Text(next, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ],
                ),
                sub: t('social.invest.rolloverServerTime', {'period': periodLabel(t, f.period)}),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SwitchBox(
            title: t('social.invest.sl'),
            hint: t('social.invest.slHint'),
            on: _slOn,
            onChanged: (v) => setState(() => _slOn = v),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TriggerLine(value: '-${_sl.round()}%${amt > 0 ? ' · ${t('social.invest.atValue', {'amount': usd(amt * (1 - _sl / 100), 0)})}' : ''}'),
                SocialSlider(
                  value: _sl,
                  min: 5,
                  max: 90,
                  ticks: const [5, 10, 20, 50, 90],
                  format: (v) => '${v.round()}%',
                  enabled: _slOn,
                  onChanged: (v) => setState(() => _sl = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          KKeyValues([
            KKV(t('social.performanceFee'), t('social.invest.feeAboveHwm', {'fee': numText(f.perfFeePct)})),
            KKV(
              t('social.lockIn'),
              null,
              valueWidget: f.lockInDays > 0
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(LucideIcons.lock, size: 13, color: k.warn),
                        const SizedBox(width: 5),
                        Text(t('social.invest.lockDays', {'count': f.lockInDays}), style: context.text.callout.copyWith(fontWeight: FontWeight.w600)),
                      ],
                    )
                  : Text(t('common.none'), style: context.text.callout.copyWith(fontWeight: FontWeight.w600)),
            ),
            KKV(t('social.invest.ddFreeze'), t('social.invest.ddFreezeValue', {'dd': numText(f.maxDdPct)})),
          ]),
          const SizedBox(height: 8),
          InfoBox(text: t('social.invest.note', {'next': next})),
          const SizedBox(height: 10),
          KCheckRow(value: _agree, onChanged: (v) => setState(() => _agree = v), child: Text(t('social.invest.agree'))),
        ],
      ],
    );
  }
}
