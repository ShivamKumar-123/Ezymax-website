// Wallet › Withdraw: port of apps/crm/components/wallet-live/withdraw-page.tsx (LiveWithdrawPage), phone order:
//   header (Withdraw + ← Wallet)
//   KYC notice
//   the form: network, destination address, amount (Max), the fee quote (POST wallet/withdrawals/quote, 400 ms after
//   typing), Withdraw -> the emailed code first (step-up `withdrawal`, target "<chain>-<amount>", as the web's
//   StepUpDialog) -> POST wallet/withdrawals {chain, amount, to_address, idempotency_key, stepup_token}
//   -> "Withdrawal requested"
//   limits and fees (today's use, min / max, fee, wait after a deposit)
//   your withdrawals (Cancel while waiting for review: POST wallet/withdrawals/{id}/cancel)
// Data: config once, overview every 15 s, withdrawals?limit=20 every 15 s.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/format/format.dart';
import '../../core/models/user.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'wallet_api.dart';
import 'widgets/wallet_ui.dart';

class WithdrawScreen extends ConsumerWidget {
  const WithdrawScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  static const int _overviewMs = 15000;

  void _reload(WidgetRef ref) {
    refreshWalletData(ref);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final kyc = ref.watch(meProvider)?.kycStatus ?? KycStatus.unverified;
    final cfg = ref.watch(walletCfgProvider);
    final o = ref.watch(walletOverviewEveryProvider(_overviewMs));
    final list = ref.watch(withdrawalsProvider);
    final failed = (cfg.hasError && !cfg.hasValue) || (o.hasError && !o.hasValue);

    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(walletCfgProvider);
        _reload(ref);
        await ref.read(walletOverviewEveryProvider(_overviewMs).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        WalletHeader(title: t('common.withdraw'), subtitle: t('wallet.withdraw.subtitle'), actions: const [BackToWallet()]),
        if (failed)
          WalletUnavailable(
            onRetry: () {
              ref
                ..invalidate(walletCfgProvider)
                ..invalidate(walletOverviewEveryProvider(_overviewMs));
            },
          )
        else ...[
          KycNotice(status: kyc),
          if (kycNoticeTitle(kyc) != null) const SizedBox(height: kWalletGap),
          if (cfg.hasValue && o.hasValue)
            WithdrawForm(cfg: cfg.requireValue, o: o.requireValue, kyc: kyc, onDone: () => _reload(ref))
          else
            const KSkeletonCard(height: 420, lines: 6),
          if (cfg.hasValue && o.hasValue) ...[const SizedBox(height: kWalletGap), _LimitsCard(cfg: cfg.requireValue, o: o.requireValue)],
          const SizedBox(height: kWalletGap),
          _MyWithdrawals(list: list.value, onChange: () => _reload(ref)),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ the form */

/// The withdrawal form (web WithdrawForm), with its debounced quote and the step-up confirmation.
class WithdrawForm extends ConsumerStatefulWidget {
  const WithdrawForm({super.key, required this.cfg, required this.o, required this.kyc, required this.onDone});
  final WalletConfig cfg;
  final WalletOverviewData o;
  final KycStatus kyc;
  final VoidCallback onDone;

  @override
  ConsumerState<WithdrawForm> createState() => _WithdrawFormState();
}

class _WithdrawFormState extends ConsumerState<WithdrawForm> {
  late String _chain = widget.cfg.chains.where((c) => c.withdrawalsEnabled).firstOrNull?.chain ?? 'tron';
  final _to = TextEditingController();
  final _amount = TextEditingController();
  String? _err;
  String _key = requestId();
  Withdrawal? _requested;

  // the quote (web useQuote): every check of the request, 400 ms after the last change
  WithdrawQuote? _quote;
  Object? _quoteErr;
  bool _quoting = false;
  Timer? _debounce;
  int _seq = 0;

  bool get _verified => widget.kyc == KycStatus.verified;
  String get _amt => _amount.text.trim();
  bool get _addrOk => addressLooksValid(_chain, _to.text);

  @override
  void dispose() {
    _debounce?.cancel();
    _to.dispose();
    _amount.dispose();
    super.dispose();
  }

  void _changed() {
    _debounce?.cancel();
    final seq = ++_seq;
    setState(() {
      _quote = null;
      _quoteErr = null;
      _quoting = _verified && amountOk(_amt) && _addrOk;
    });
    if (!_quoting) return;
    final body = {'chain': _chain, 'amount': _amt, 'to_address': _to.text.trim()};
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      try {
        final r = await ref.read(apiProvider).post<Map<String, dynamic>>('wallet/withdrawals/quote', body: body);
        if (!mounted || seq != _seq) return;
        setState(() => _quote = WithdrawQuote.fromJson((r['quote'] as Map).cast<String, dynamic>()));
      } catch (e) {
        if (!mounted || seq != _seq) return;
        setState(() => _quoteErr = e);
      } finally {
        if (mounted && seq == _seq) setState(() => _quoting = false);
      }
    });
  }

  Future<void> _confirm() async {
    final t = context.t;
    final q = _quote;
    if (q == null) return;
    setState(() => _err = null);
    final l = chainLabel(_chain);
    await showStepUpSheet(
      context,
      action: 'withdrawal',
      target: '$_chain-$_amt',
      title: t('wallet.withdraw.confirmTitle'),
      description: t('wallet.withdraw.confirmDescription', {'amount': fmt(q.amount), 'address': shortHash(_to.text.trim(), 8, 6), 'network': l.name}),
      what: t('wallet.withdraw.stepUpWhat'),
      confirmLabel: t('wallet.confirmWithdrawal'),
      onConfirmed: _send,
    );
  }

  /// The request itself, once, with the step-up token (never retried on its own).
  Future<void> _send(String token) async {
    final t = context.t;
    try {
      final r = await ref
          .read(apiProvider)
          .post<Map<String, dynamic>>(
            'wallet/withdrawals',
            body: {'chain': _chain, 'amount': _amt, 'to_address': _to.text.trim(), 'idempotency_key': _key, 'stepup_token': token},
          );
      if (!mounted) return;
      _amount.clear();
      setState(() {
        _key = requestId();
        _requested = Withdrawal.fromJson((r['withdrawal'] as Map).cast<String, dynamic>());
      });
      _changed();
      widget.onDone();
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _err = e is ApiException && e.isStepUp ? t('wallet.withdraw.confirmationExpired') : walletErrorText(e, t, fallback: t('wallet.withdraw.failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final requested = _requested;
    // the request is in: the team reviews it, then it is sent (the form comes back with Done)
    if (requested != null) {
      return KCard(
        key: const ValueKey('withdrawal-requested'),
        padding: const EdgeInsets.fromLTRB(20, 32, 20, 32),
        child: Semantics(
          liveRegion: true,
          child: Column(
            children: [
              const KIllustration(KIllustrationName.withdrawalProcessing, width: 210, maxHeight: 140),
              const SizedBox(height: 20),
              Text(t('wallet.withdraw.toastRequested'), textAlign: TextAlign.center, style: context.text.title1),
              const SizedBox(height: 6),
              Text(
                t('wallet.withdraw.toastRequestedText', {'amount': fmt(requested.amount), 'net': fmt(requested.netAmount)}),
                textAlign: TextAlign.center,
                style: context.text.callout.copyWith(color: k.fg2),
              ),
              const SizedBox(height: 4),
              Text(
                t('wallet.withdraw.formSubtitle'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
              const SizedBox(height: 20),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  KButton(label: t('common.done'), variant: KButtonVariant.surface, onPressed: () => setState(() => _requested = null)),
                  KButton(label: t('wallet.backToWallet'), variant: KButtonVariant.ghost, onPressed: () => context.go('/wallet')),
                ],
              ),
            ],
          ),
        ),
      );
    }

    final available = widget.o.usdt.available;
    final limits = widget.cfg.limits;
    final q = _quote;
    final addrError = _to.text.isNotEmpty && !_addrOk ? (_chain == 'bsc' ? t('wallet.withdraw.bscAddressError') : t('wallet.withdraw.tronAddressError')) : null;
    final shownErr = _quoteErr != null ? walletErrorText(_quoteErr, t, fallback: t('wallet.withdraw.checkFailed')) : _err;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('wallet.withdrawUsdt'), subtitle: t('wallet.withdraw.formSubtitle')),
          const SizedBox(height: 16),
          for (final c in widget.cfg.chains) ...[
            WalletRow(
              selected: c.chain == _chain,
              enabled: c.withdrawalsEnabled && _verified,
              onTap: () {
                if (_chain == c.chain) return;
                _chain = c.chain;
                _changed();
              },
              child: Row(
                children: [
                  ChainCoin(c.chain, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('USDT · ${chainLabel(c.chain).short}', style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500)),
                        Text(
                          chainLabel(c.chain).name,
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 10),
          KTextField(
            label: t('wallet.withdraw.destination'),
            controller: _to,
            placeholder: ltrHint(_chain == 'bsc' ? '0x…' : 'T…'),
            enabled: _verified,
            ltr: true,
            error: addrError,
            onChanged: (_) => _changed(),
          ),
          const SizedBox(height: 16),
          KTextField(
            label: t('common.amount'),
            controller: _amount,
            placeholder: '0.00',
            enabled: _verified,
            ltr: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [amountFormatter],
            onChanged: (_) => _changed(),
            trailing: KTextButton(
              label: t('wallet.max'),
              onPressed: _verified
                  ? () {
                      _amount.text = maxAmount(available);
                      _changed();
                    }
                  : null,
            ),
          ),
          FieldHint(t('wallet.withdraw.amountHint', {'available': fmt(available), 'min': fmt(limits.withdrawMin), 'max': fmt(limits.withdrawMax)})),
          if (q != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: WalletTile(label: t('wallet.withdraw.youSend'), value: '${fmt(q.amount)} USDT'),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: WalletTile(label: t('wallet.fee'), value: '${fmt(q.fee)} USDT'),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: WalletTile(label: t('wallet.youReceive'), value: '${fmt(q.netAmount)} USDT', valueColor: k.up),
                ),
              ],
            ),
          ],
          if (_quoting && q == null) ...[
            const SizedBox(height: 12),
            Text(
              t('wallet.withdraw.checkingLimits'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
            ),
          ],
          WalletInlineError(shownErr, top: 14),
          const SizedBox(height: 18),
          KButton(
            label: t('common.withdraw'),
            icon: LucideIcons.arrowUpFromLine,
            variant: KButtonVariant.ink,
            size: KButtonSize.lg,
            expand: true,
            onPressed: _verified && q != null ? _confirm : null,
          ),
          const SizedBox(height: 12),
          Text(
            t('wallet.withdraw.emailNote', {'network': chainLabel(_chain).name}),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ limits and fees */

class _LimitsCard extends StatelessWidget {
  const _LimitsCard({required this.cfg, required this.o});
  final WalletConfig cfg;
  final WalletOverviewData o;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final l = cfg.limits;
    final used = limitUsed(o.usedToday, o.dailyMax);
    final cooldown = o.cooldownUntil;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('wallet.withdraw.limitsTitle'), subtitle: t('wallet.withdraw.limitsSubtitle')),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text(t('wallet.withdraw.withdrawnToday'), style: context.text.footnote.copyWith(color: k.fg2)),
              ),
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: fmt(o.usedToday),
                      style: TextStyle(color: k.fg),
                    ),
                    TextSpan(text: ' / ${fmt(o.dailyMax)} USDT'),
                  ],
                ),
                textDirection: TextDirection.ltr,
                style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
              ),
            ],
          ),
          const SizedBox(height: 6),
          KProgressBar(value: used, color: used > 0.8 ? k.warn : k.gold),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: WalletTile(label: t('wallet.minimum'), value: '${fmt(l.withdrawMin)} USDT'),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: WalletTile(label: t('wallet.maximum'), value: '${fmt(l.withdrawMax)} USDT'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: WalletTile(label: t('wallet.fee'), value: feeLabel(l)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: WalletTile(
                  label: t('wallet.withdraw.afterDeposit'),
                  value: l.depositCooldownHours > 0 ? t('wallet.withdraw.hoursWait', {'hours': l.depositCooldownHours}) : t('wallet.withdraw.noWait'),
                ),
              ),
            ],
          ),
          if (cooldown != null) ...[
            const SizedBox(height: 12),
            Text(
              t('wallet.withdraw.cooldown', {'date': LocaleFormat(t.locale).dateTime(cooldown)}),
              style: context.text.caption.copyWith(color: k.warn, fontWeight: FontWeight.w400, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ your withdrawals */

class _MyWithdrawals extends ConsumerStatefulWidget {
  const _MyWithdrawals({required this.list, required this.onChange});
  final WalletPage<Withdrawal>? list;
  final VoidCallback onChange;

  @override
  ConsumerState<_MyWithdrawals> createState() => _MyWithdrawalsState();
}

class _MyWithdrawalsState extends ConsumerState<_MyWithdrawals> {
  int? _busy;

  Future<void> _cancel(Withdrawal w) async {
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    setState(() => _busy = w.id);
    try {
      await ref.read(apiProvider).post<Object?>('wallet/withdrawals/${w.id}/cancel', body: const <String, Object?>{});
      notes.toast(NotificationKind.success, t('wallet.withdrawalCancelled'), description: t('wallet.withdraw.cancelledText'));
      widget.onChange();
    } catch (e) {
      notes.toast(NotificationKind.error, t('wallet.withdraw.cancelFailed'), description: walletErrorText(e, t));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.list;
    if (list == null) return const KSkeletonCard();
    final t = context.t;
    final k = context.k;
    final f = LocaleFormat(t.locale);
    final small = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('wallet.withdraw.yours'), subtitle: t('wallet.withdraw.inTotal', {'count': list.total})),
          const SizedBox(height: 12),
          if (list.items.isEmpty) KEmptyState(compact: true, icon: LucideIcons.banknote, title: t('wallet.withdraw.none')),
          for (var i = 0; i < list.items.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            Builder(
              builder: (context) {
                final w = list.items[i];
                final st = kWithdrawalStatus[w.status];
                return WalletRow(
                  key: ValueKey('withdrawal-${w.id}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  '${fmt(w.amount)} USDT · ${chainLabel(w.chain).short}',
                                  textDirection: TextDirection.ltr,
                                  style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500, fontFeatures: kTabular),
                                ),
                                if (st != null) WalletStatusChip(st),
                              ],
                            ),
                          ),
                          if (w.status == 'requested')
                            KButton(
                              label: t('common.cancel'),
                              variant: KButtonVariant.ghost,
                              size: KButtonSize.sm,
                              loading: _busy == w.id,
                              onPressed: _busy == w.id ? null : () => _cancel(w),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          KRichText(
                            '${f.dateTime(w.createdAt)} · ${t('wallet.withdraw.rowDetail', {'address': shortHash(w.toAddress, 8, 6), 'net': fmt(w.netAmount)})}',
                            style: small,
                            tags: {'addr': KTag(style: context.text.mono(11.5, color: k.fg3))},
                          ),
                          if (w.payoutTxHash != null) ...[Text(' · ', style: small), HashLink(hash: w.payoutTxHash, url: w.explorerUrl, size: 11.5)],
                        ],
                      ),
                      if (w.status == 'rejected' && w.reason != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          w.reason!,
                          style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w400, fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
