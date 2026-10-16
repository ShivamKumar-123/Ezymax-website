// Wallet › Withdraw: port of apps/crm/components/wallet-live/withdraw-page.tsx (LiveWithdrawPage), phone order:
//   header (Withdraw + ← Wallet)
//   the gate (widgets/withdraw_gate.dart) when there is more than one rail: pick, agree, handoff
//   KYC notice
//   the form: destination (a chain, or UPI where the broker has it open), the address or UPI ID, amount (Max),
//   the fee quote (POST wallet/withdrawals/quote, 400 ms after typing), Withdraw -> the emailed code first
//   (step-up `withdrawal`, target "<rail>-<amount>", as the web's StepUpDialog)
//   -> POST wallet/withdrawals {method, chain?, amount, to_address, idempotency_key, stepup_token}
//   -> the tracker: requested -> reviewed -> paid, followed through `withdrawals?limit=20`
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
import 'widgets/withdraw_gate.dart';

class WithdrawScreen extends ConsumerStatefulWidget {
  const WithdrawScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  ConsumerState<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends ConsumerState<WithdrawScreen> {
  static const int _overviewMs = 15000;

  /// The rail the client chose, from `?via=` or from the gate. Null until they have chosen and there is a
  /// choice to make.
  late String? _picked = switch (widget.query['via']) {
    'usdt' => 'usdt',
    'upi' => 'upi',
    _ => null,
  };
  bool _gateAsked = false;

  void _reload(WidgetRef ref) {
    refreshWalletData(ref);
  }

  /// Ask once, after the frame, when the broker really offers a choice. Dismissing it goes back to the wallet,
  /// as closing the deposit gate does.
  void _askGate(List<WalletChain> chains, WithdrawMethod upi) {
    if (_gateAsked) return;
    _gateAsked = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final picked = await showWithdrawGate(context, chains: chains, upi: upi);
      if (!mounted) return;
      if (picked == null) {
        context.go('/wallet');
        return;
      }
      setState(() => _picked = picked);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final kyc = ref.watch(meProvider)?.kycStatus ?? KycStatus.unverified;
    final cfg = ref.watch(walletCfgProvider);
    final o = ref.watch(walletOverviewEveryProvider(_overviewMs));
    final list = ref.watch(withdrawalsProvider);
    final failed = (cfg.hasError && !cfg.hasValue) || (o.hasError && !o.hasValue);

    final chains = cfg.value?.chains.where((c) => c.withdrawalsEnabled).toList() ?? const <WalletChain>[];
    final upi = cfg.value?.upi;
    // a choice only exists when both rails are open; otherwise the one rail is the answer
    final needsGate = _picked == null && chains.isNotEmpty && upi != null;
    if (needsGate) _askGate(chains, upi);
    final via = _picked ?? (chains.isNotEmpty ? 'usdt' : 'upi');

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
          if (cfg.hasValue && o.hasValue && !needsGate)
            WithdrawForm(cfg: cfg.requireValue, o: o.requireValue, kyc: kyc, via: via, onDone: () => _reload(ref))
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
  const WithdrawForm({super.key, required this.cfg, required this.o, required this.kyc, required this.via, required this.onDone});
  final WalletConfig cfg;
  final WalletOverviewData o;
  final KycStatus kyc;

  /// The rail the gate (or `?via=`) settled on: `usdt` or `upi`.
  final String via;
  final VoidCallback onDone;

  @override
  ConsumerState<WithdrawForm> createState() => _WithdrawFormState();
}

class _WithdrawFormState extends ConsumerState<WithdrawForm> {
  // the open chains, then UPI: `_chain` is null when the client is being paid off chain
  late final List<WalletChain> _chains = widget.cfg.chains.where((c) => c.withdrawalsEnabled).toList();
  late final WithdrawMethod? _upi = widget.cfg.upi;
  late String? _chain = widget.via == 'upi' && _upi != null ? null : (_chains.firstOrNull?.chain ?? (_upi == null ? 'tron' : null));
  final _to = TextEditingController();
  final _amount = TextEditingController();
  String? _err;
  String _key = requestId();

  /// The withdrawal just asked for. The id is what the tracker follows; the snapshot stands in until the
  /// polled list has caught up.
  Withdrawal? _requested;

  // the quote (web useQuote): every check of the request, 400 ms after the last change
  WithdrawQuote? _quote;
  Object? _quoteErr;
  bool _quoting = false;
  Timer? _debounce;
  int _seq = 0;

  bool get _verified => widget.kyc == KycStatus.verified;
  String get _amt => _amount.text.trim();
  bool get _isUpi => _chain == null;

  /// What identifies this rail in a step-up target and in the body.
  String get _rail => _chain ?? 'upi';
  bool get _toOk => _isUpi ? upiLooksValid(_to.text) : addressLooksValid(_chain!, _to.text);
  bool get _offered => _chains.isNotEmpty || _upi != null;

  @override
  void dispose() {
    _debounce?.cancel();
    _to.dispose();
    _amount.dispose();
    super.dispose();
  }

  /// A destination for one rail is never valid for another, so the field starts again.
  void _pick(String? chain) {
    if (chain == _chain) return;
    _to.clear();
    setState(() {
      _chain = chain;
      _err = null;
    });
    _changed();
  }

  void _changed() {
    _debounce?.cancel();
    final seq = ++_seq;
    setState(() {
      _quote = null;
      _quoteErr = null;
      _quoting = _verified && _offered && amountOk(_amt) && _toOk;
    });
    if (!_quoting) return;
    final body = {..._rails, 'amount': _amt, 'to_address': _to.text.trim()};
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

  /// The two fields that say where the money goes. A chain is named only when there is one.
  Map<String, Object?> get _rails => _isUpi ? {'method': 'upi'} : {'method': 'crypto', 'chain': _chain};

  Future<void> _confirm() async {
    final t = context.t;
    final q = _quote;
    if (q == null) return;
    setState(() => _err = null);
    await showStepUpSheet(
      context,
      action: 'withdrawal',
      target: '$_rail-$_amt',
      title: t('wallet.withdraw.confirmTitle'),
      description: _isUpi
          ? t('wallet.withdraw.confirmUpi', {'payout': q.receives, 'upi': _to.text.trim()})
          : t('wallet.withdraw.confirmDescription', {'amount': fmt(q.amount), 'address': shortHash(_to.text.trim(), 8, 6), 'network': chainLabel(_chain).name}),
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
            body: {..._rails, 'amount': _amt, 'to_address': _to.text.trim(), 'idempotency_key': _key, 'stepup_token': token},
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
    final snapshot = _requested;
    // the request is in: follow it through review and payment. The list already polls, so the tracked row comes
    // from there, with the snapshot standing in until the first refresh.
    if (snapshot != null) {
      final fresh = ref.watch(withdrawalsProvider).value?.items.where((w) => w.id == snapshot.id).firstOrNull;
      return _Tracker(
        w: fresh ?? snapshot,
        onNew: () => setState(() => _requested = null),
        onChanged: widget.onDone,
      );
    }

    final available = widget.o.usdt.available;
    final limits = widget.cfg.limits;
    // read once into a local: a `late final` field is never promoted, so `_upi.currency` would not compile
    final upi = _upi;
    final q = _quote;
    final addrError = _to.text.isEmpty || _toOk
        ? null
        : _isUpi
        ? t('wallet.withdraw.upiError')
        : _chain == 'bsc'
        ? t('wallet.withdraw.bscAddressError')
        : t('wallet.withdraw.tronAddressError');
    final shownErr = _quoteErr != null ? walletErrorText(_quoteErr, t, fallback: t('wallet.withdraw.checkFailed')) : _err;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: _isUpi ? t('wallet.withdraw.titleUpi') : t('wallet.withdrawUsdt'), subtitle: t('wallet.withdraw.formSubtitle')),
          const SizedBox(height: 16),
          if (!_offered) WalletInlineError(t('wallet.withdraw.noneAvailable'), top: 0),
          for (final c in _chains) ...[
            WalletRow(
              selected: c.chain == _chain,
              enabled: _verified,
              onTap: () => _pick(c.chain),
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
          if (upi != null) ...[
            WalletRow(
              selected: _isUpi,
              enabled: _verified,
              onTap: () => _pick(null),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: k.info.withValues(alpha: 0.15), shape: BoxShape.circle),
                    child: Icon(LucideIcons.smartphone, size: 15, color: k.info),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t('wallet.withdraw.methodUpi'), style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500)),
                        Text(
                          t('wallet.withdraw.methodUpiSub', {'currency': upi.currency}),
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
            label: _isUpi ? t('wallet.withdraw.upiDestination') : t('wallet.withdraw.destination'),
            controller: _to,
            placeholder: ltrHint(
              _isUpi
                  ? 'name@bank'
                  : _chain == 'bsc'
                  ? '0x…'
                  : 'T…',
            ),
            enabled: _verified && _offered,
            ltr: true,
            error: addrError,
            onChanged: (_) => _changed(),
          ),
          const SizedBox(height: 16),
          KTextField(
            label: t('common.amount'),
            controller: _amount,
            placeholder: '0.00',
            enabled: _verified && _offered,
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
                  child: WalletTile(label: t('wallet.youReceive'), value: q.receives, valueColor: k.up),
                ),
              ],
            ),
            if (q.payoutAmount != null) ...[
              const SizedBox(height: 8),
              Text(
                t('wallet.withdraw.rateNote', {'net': fmt(q.netAmount)}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
              ),
            ],
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
            _isUpi ? (upi?.instructions ?? t('wallet.withdraw.upiNote')) : t('wallet.withdraw.emailNote', {'network': chainLabel(_chain).name}),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ the tracker */

/// Where the withdrawal has got to (web Tracker). Cancel stays while it can still be cancelled.
class _Tracker extends ConsumerStatefulWidget {
  const _Tracker({required this.w, required this.onNew, required this.onChanged});
  final Withdrawal w;
  final VoidCallback onNew, onChanged;

  @override
  ConsumerState<_Tracker> createState() => _TrackerState();
}

class _TrackerState extends ConsumerState<_Tracker> {
  bool _busy = false;

  Future<void> _cancel() async {
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).post<Object?>('wallet/withdrawals/${widget.w.id}/cancel', body: const <String, Object?>{});
      notes.toast(NotificationKind.success, t('wallet.withdrawalCancelled'), description: t('wallet.withdraw.cancelledText'));
      widget.onChanged();
    } catch (e) {
      notes.toast(NotificationKind.error, t('wallet.withdraw.cancelFailed'), description: walletErrorText(e, t));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final w = widget.w;
    final done = w.status == 'completed';
    final bad = w.status == 'rejected' || w.status == 'cancelled';
    final reviewed = w.status != 'requested';
    final sent = w.status == 'paid' || done;
    final isUpi = w.method == 'upi';
    final receives = w.payoutAmount != null && w.payoutCurrency != null ? '${fmt(w.payoutAmount)} ${w.payoutCurrency}' : '${fmt(w.netAmount)} USDT';
    final reference = w.payoutReference ?? w.payoutTxHash;
    final st = kWithdrawalStatus[w.status];

    return KCard(
      key: const ValueKey('withdrawal-requested'),
      child: Semantics(
        liveRegion: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KCardHeader(
              title: done
                  ? t('wallet.withdraw.trackDone')
                  : bad
                  ? t('wallet.withdraw.trackStopped')
                  : t('wallet.withdraw.trackOnItsWay'),
              subtitle: isUpi ? t('wallet.withdraw.toUpi', {'upi': w.toAddress}) : '${chainLabel(w.chain).name} · USDT ${w.rail}',
              action: st == null ? null : WalletStatusChip(st),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('−${fmt(w.amount)} USDT', style: context.text.title1.copyWith(fontFeatures: kTabular)),
                      const SizedBox(height: 6),
                      Text(
                        '${t('wallet.youReceive')} $receives',
                        style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12.5),
                      ),
                      if (reference != null) ...[
                        const SizedBox(height: 2),
                        Text(reference, style: context.text.caption.copyWith(color: k.fg3, fontSize: 11.5, fontWeight: FontWeight.w400)),
                      ],
                    ],
                  ),
                ),
                if (done) const KIllustration(KIllustrationName.withdrawalProcessing, width: 120, maxHeight: 110),
              ],
            ),
            if (!bad) ...[
              const SizedBox(height: 18),
              for (final step in <({String label, bool ok, int n})>[
                (label: t('wallet.withdraw.stepRequested'), ok: true, n: 1),
                (label: t('wallet.withdraw.stepApproved'), ok: reviewed, n: 2),
                (label: isUpi ? t('wallet.withdraw.stepPaidUpi') : t('wallet.withdraw.stepPaidChain'), ok: sent, n: 3),
              ]) ...[
                Row(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 240),
                      width: 20,
                      height: 20,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: step.ok ? k.upSoft : Colors.transparent,
                        shape: BoxShape.circle,
                        border: Border.all(color: step.ok ? k.up.withValues(alpha: 0.4) : k.line),
                      ),
                      child: step.ok
                          ? Icon(LucideIcons.check, size: 12, color: k.up)
                          : Text('${step.n}', style: context.text.caption.copyWith(color: k.fg3, fontSize: 10, fontWeight: FontWeight.w400)),
                    ),
                    const SizedBox(width: 10),
                    Text(step.label, style: context.text.footnote.copyWith(color: step.ok ? k.fg : k.fg3, fontSize: 12.5)),
                  ],
                ),
                const SizedBox(height: 10),
              ],
            ],
            if (w.status == 'requested') _Note(text: t('wallet.withdraw.trackReview'), tint: k.warnSoft, edge: k.warn),
            if (w.status == 'paid' && !isUpi) _Note(text: t('wallet.withdraw.trackConfirming', {'n': w.payoutConfirmations}), tint: k.infoSoft, edge: k.info),
            if (bad) WalletInlineError(w.reason ?? t('wallet.withdraw.cancelledText'), top: 8),
            const SizedBox(height: 18),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (w.status == 'requested')
                  KButton(label: t('common.cancel'), variant: KButtonVariant.surface, loading: _busy, onPressed: _busy ? null : _cancel),
                KButton(label: t('wallet.withdraw.newOne'), variant: done ? KButtonVariant.surface : KButtonVariant.ghost, onPressed: widget.onNew),
                KButton(label: t('wallet.backToWallet'), variant: KButtonVariant.ghost, onPressed: () => context.go('/wallet')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A one-line tinted note, the shape the KYC notice uses.
class _Note extends StatelessWidget {
  const _Note({required this.text, required this.tint, required this.edge});
  final String text;
  final Color tint, edge;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 4),
    padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
    decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(14), border: Border.all(color: edge.withValues(alpha: 0.3))),
    child: Text(text, style: context.text.footnote.copyWith(color: context.k.fg2, fontSize: 12.5)),
  );
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
                                  '${fmt(w.amount)} USDT · ${w.rail}',
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
