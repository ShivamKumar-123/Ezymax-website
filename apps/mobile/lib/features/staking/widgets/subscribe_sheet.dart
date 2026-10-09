// The subscribe flow: the amount (+ Max) within the plan's limits, the wallet balance or what is missing (Deposit),
// the summary (starts once paid, the maturity date, returns set each month, no early withdrawal), the lock warning,
// the plan's disclosure and the two acceptances (the terms, the risk acknowledgement with the date); Subscribe stays
// off until both are ticked and the amount is valid. Then the outcome, with a way to My staking.
// One idempotency key per sheet: a retry after a network error (or while the wallet is still confirming) sends the
// same key and the same amount (the field locks), so it never subscribes twice. Only when the wallet refused the
// payment (the position ended as payment_failed, nothing charged) does the next attempt take a new key. Nothing is
// ever retried on its own.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/wallet.dart';
import '../../../data/client_data.dart';
import '../../../i18n/i18n.dart';
import '../../../shell/nav.dart';
import '../../../ui/ui.dart';
import '../staking_api.dart';
import 'staking_ui.dart';

/// Opens the subscribe sheet. Not dismissible by a swipe: a payment in flight must not be lost.
Future<void> showSubscribeSheet(BuildContext context, {required StakingPlan plan}) =>
    showKSheet<void>(context, dismissible: false, builder: (_) => StakingSubscribeSheet(plan: plan));

/// The wallet balance in the plan's currency (null while the wallet loads).
double? walletAvailable(WalletOverview? w, String currency) {
  if (w == null) return null;
  final b = w.balances.where((x) => x.currency == currency).firstOrNull;
  return double.tryParse(b?.available ?? '0') ?? 0;
}

class StakingSubscribeSheet extends ConsumerStatefulWidget {
  const StakingSubscribeSheet({super.key, required this.plan});
  final StakingPlan plan;

  /// The confirm button (tests).
  static const confirmKey = ValueKey('staking-subscribe-confirm');

  @override
  ConsumerState<StakingSubscribeSheet> createState() => _StakingSubscribeSheetState();
}

class _StakingSubscribeSheetState extends ConsumerState<StakingSubscribeSheet> {
  String _key = newStakingKey();
  final TextEditingController _amount = TextEditingController();
  bool _terms = false;
  bool _risk = false;
  bool _busy = false;

  /// The last attempt may have reached the service: the amount can't change (same key, same amount).
  bool _locked = false;
  Object? _err;
  StakingPositionDetail? _done;

  /// The maturity if paid today (the service fixes the real one when the payment goes through).
  late final DateTime _matures = stakingMaturity(DateTime.now(), widget.plan.termMonths);

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit(double amount) async {
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final r = await subscribeStaking(ref.read(apiProvider), planId: widget.plan.id, amount: stakingAmountString(amount), key: _key);
      KHaptics.success();
      _refreshPages();
      if (mounted) setState(() => _done = r);
    } on Object catch (e) {
      KHaptics.error();
      // a pending payment already shows as a position; a refused one in the history
      if (e is ApiException && !e.isNetwork) _refreshPages();
      if (mounted) {
        setState(() {
          _err = e;
          if (stakingOutcomeUnknown(e)) _locked = true;
          if (stakingPaymentRefused(e)) {
            _key = newStakingKey();
            _locked = false;
          }
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _refreshPages() => ref
    ..invalidate(stakingPlansProvider)
    ..invalidate(stakingPortfolioProvider)
    ..invalidate(stakingHistoryProvider)
    ..invalidate(walletOverviewProvider);

  void _close() => Navigator.of(context).pop();

  void _go(String href) {
    final router = GoRouter.of(context);
    _close();
    router.go(href);
  }

  @override
  Widget build(BuildContext context) => _done != null ? _outcome(context, _done!) : _form(context);

  Widget _header(BuildContext context, String title, String description) {
    final k = context.k;
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 8, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: context.text.title2),
                const SizedBox(height: 3),
                Text(description, style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ),
          ),
          KIconButton(icon: LucideIcons.x, size: 36, semanticLabel: context.t('common.close'), onPressed: _busy ? null : _close),
        ],
      ),
    );
  }

  Widget _form(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final plan = widget.plan;
    final cur = plan.currency;
    final available = walletAvailable(ref.watch(walletOverviewProvider).value, cur);
    final amount = parseStakingAmount(_amount.text);
    final issue = stakingAmountIssue(plan, amount);
    final cap = stakingCap(plan);
    final typed = _amount.text.trim().isNotEmpty;
    final short = available != null && amount != null && amount > available + 1e-9;
    final ready = issue == null && !short && _terms && _risk;
    final date = stakingDate(t, _matures);
    final amountText = amount != null && issue == null ? stakingAmount(t, amount, cur) : null;
    final problem = !typed
        ? null
        : switch (issue) {
            StakingAmountIssue.empty => t('staking.subscribe.enterAmount'),
            StakingAmountIssue.belowMin => t('staking.subscribe.belowMin', {'min': stakingAmount(t, plan.minAmount, cur)}),
            StakingAmountIssue.aboveMax => t('staking.subscribe.aboveMax', {'max': stakingAmount(t, cap ?? 0, cur)}),
            null => null,
          };
    final maxFill = stakingMaxFill(plan, available);
    final depositOn = pageOn(ref.watch(configProvider), '/wallet/deposit');

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _header(
          context,
          t('staking.subscribe.title', {'plan': plan.name}),
          t('staking.subscribe.description', {'term': stakingTerm(t, plan.termMonths), 'currency': cur}),
        ),
        Flexible(
          child: KSheetContent(
            footer: Row(
              children: [
                KButton(label: t('common.cancel'), variant: KButtonVariant.surface, size: KButtonSize.lg, onPressed: _busy ? null : _close),
                const SizedBox(width: 10),
                Expanded(
                  child: KButton(
                    key: StakingSubscribeSheet.confirmKey,
                    label: _err != null
                        ? t('staking.subscribe.retry')
                        : (amountText != null ? t('staking.subscribe.confirm', {'amount': amountText}) : t('staking.plan.subscribe')),
                    icon: LucideIcons.lock,
                    size: KButtonSize.lg,
                    expand: true,
                    loading: _busy,
                    onPressed: ready ? () => _submit(amount!) : null,
                  ),
                ),
              ],
            ),
            children: [
              KTextField(
                label: t('staking.subscribe.amount'),
                controller: _amount,
                placeholder: '0.00',
                leading: LucideIcons.wallet,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                textInputAction: TextInputAction.done,
                ltr: true,
                readOnly: _busy || _locked,
                error: problem,
                onChanged: (_) => setState(() {}),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(cur, style: context.text.footnote.copyWith(color: k.fg3)),
                    const SizedBox(width: 6),
                    KTextButton(
                      label: t('staking.subscribe.max'),
                      onPressed: maxFill == null || _busy || _locked
                          ? null
                          : () => setState(() {
                              _amount.text = stakingAmountString(maxFill);
                              _amount.selection = TextSelection.collapsed(offset: _amount.text.length);
                            }),
                    ),
                    const SizedBox(width: 6),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsetsDirectional.only(start: 4),
                child: Text(
                  cap != null
                      ? t('staking.subscribe.limits', {'min': stakingAmount(t, plan.minAmount, cur), 'max': stakingAmount(t, cap, cur)})
                      : t('staking.subscribe.limitsMin', {'min': stakingAmount(t, plan.minAmount, cur)}),
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
              ),
              if (available != null) ...[
                const SizedBox(height: 10),
                if (short)
                  KNotice(
                    tone: KChipTone.warn,
                    text: t('staking.subscribe.short', {'balance': stakingAmount(t, available, cur)}),
                    action: depositOn
                        ? KButton(
                            label: t('staking.subscribe.deposit'),
                            trailingIcon: stakingArrowEnd(context),
                            variant: KButtonVariant.surface,
                            size: KButtonSize.sm,
                            onPressed: () => _go('/wallet/deposit'),
                          )
                        : null,
                  )
                else
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 4),
                    child: Text(
                      t('staking.subscribe.walletBalance', {'balance': stakingAmount(t, available, cur)}),
                      style: context.text.footnote.copyWith(color: k.fg3),
                    ),
                  ),
              ],
              const SizedBox(height: 18),
              StakingLabel(t('staking.subscribe.summary')),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: k.line),
                ),
                child: KKeyValues([
                  KKV(t('staking.subscribe.starts'), t('staking.subscribe.startsValue')),
                  KKV(t('staking.subscribe.matures'), date),
                  KKV(t('staking.subscribe.returns'), t('staking.subscribe.returnsValue')),
                  KKV(t('staking.subscribe.earlyWithdrawal'), t('staking.subscribe.notAvailable'), tone: k.down),
                ], dense: true),
              ),
              // what gets locked, once there is an amount to lock
              if (amountText != null) ...[
                const SizedBox(height: 12),
                KNotice(tone: KChipTone.warn, icon: LucideIcons.lock, text: t('staking.subscribe.lockWarning', {'amount': amountText, 'date': date})),
              ],
              const SizedBox(height: 12),
              StakingDisclosure(riskText: plan.riskText),
              const SizedBox(height: 10),
              KCheckRow(
                value: _terms,
                onChanged: _busy ? (_) {} : (v) => setState(() => _terms = v),
                child: Text(t('staking.subscribe.acceptTerms'), style: context.text.footnote.copyWith(color: k.fg2, height: 1.4)),
              ),
              KCheckRow(
                value: _risk,
                onChanged: _busy ? (_) {} : (v) => setState(() => _risk = v),
                child: Text(t('staking.subscribe.acceptRisk', {'date': date}), style: context.text.footnote.copyWith(color: k.fg2, height: 1.4)),
              ),
              if (_err != null) ...[const SizedBox(height: 12), StakingErrorNote(error: _err, onNavigate: _go)],
            ],
          ),
        ),
      ],
    );
  }

  Widget _outcome(BuildContext context, StakingPositionDetail done) {
    final t = context.t;
    final p = done.position;
    final cur = p.currency;
    final date = stakingDate(t, p.maturesAt ?? _matures);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _header(context, t('staking.subscribe.doneTitle'), '${p.planName} · ${stakingTerm(t, p.termMonths)}'),
        Flexible(
          child: KSheetContent(
            footer: Row(
              children: [
                KButton(label: t('common.close'), variant: KButtonVariant.surface, size: KButtonSize.lg, onPressed: _close),
                const SizedBox(width: 10),
                Expanded(
                  child: KButton(
                    label: t('staking.subscribe.viewStaking'),
                    trailingIcon: stakingArrowEnd(context),
                    size: KButtonSize.lg,
                    expand: true,
                    onPressed: () => _go('/staking/portfolio'),
                  ),
                ),
              ],
            ),
            children: [
              KNotice(
                tone: KChipTone.up,
                icon: LucideIcons.check,
                text: t('staking.subscribe.doneText', {'amount': stakingAmount(t, p.principal, cur), 'plan': p.planName, 'date': date}),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: context.k.line),
                ),
                child: KKeyValues([
                  KKV(t('staking.col.principal'), stakingAmount(t, p.principal, cur)),
                  KKV(t('staking.position.started'), stakingDate(t, p.startedAt)),
                  KKV(t('staking.position.matures'), date),
                  KKV(t('staking.subscribe.earlyWithdrawal'), t('staking.subscribe.notAvailable')),
                ], dense: true),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
