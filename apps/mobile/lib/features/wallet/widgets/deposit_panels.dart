// The deposit page's steps (apps/crm/components/wallet-live/deposit-page.tsx): StartForm (network + amount),
// PayPanel (the wallet app, or the address + QR + hash), DepositTracker (confirmations -> credited) and HowItWorks.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../wallet_api.dart';
import 'wallet_ui.dart';

/* ------------------------------------------------------------------ step 1: network + amount */

/// Step 1 (web StartForm): the network and the amount make a deposit request.
class StartForm extends ConsumerStatefulWidget {
  const StartForm({super.key, required this.cfg, required this.onCreated});
  final WalletConfig cfg;
  final ValueChanged<DepositIntent> onCreated;

  @override
  ConsumerState<StartForm> createState() => _StartFormState();
}

class _StartFormState extends ConsumerState<StartForm> {
  late String _chain = _defaultChain();
  final _amount = TextEditingController();
  bool _busy = false;
  String? _err;

  String _defaultChain() {
    final enabled = widget.cfg.chains.where((c) => c.depositsEnabled).toList();
    return enabled.where((c) => c.chain == 'bsc').firstOrNull?.chain ?? enabled.firstOrNull?.chain ?? 'tron';
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  bool get _valid => depositAmountOk(_amount.text, widget.cfg.chain(_chain)?.minDeposit);

  Future<void> _submit() async {
    if (!_valid || _busy) return;
    final t = context.t;
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final r = await ref.read(apiProvider).post<Map<String, dynamic>>('wallet/deposits/intents', body: {'chain': _chain, 'amount': _amount.text.trim()});
      final intent = DepositIntent.fromJson((r['intent'] as Map).cast<String, dynamic>());
      if (mounted) widget.onCreated(intent);
    } catch (e) {
      if (mounted) setState(() => _err = walletErrorText(e, t, fallback: t('wallet.deposit.startFailed')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final enabled = widget.cfg.chains.where((c) => c.depositsEnabled).toList();
    if (enabled.isEmpty) {
      return KCard(
        child: Text(t('wallet.deposit.paused'), style: context.text.callout.copyWith(color: k.fg2)),
      );
    }
    final c = widget.cfg.chain(_chain);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('wallet.newDeposit'), subtitle: t('wallet.deposit.newSubtitle')),
          const SizedBox(height: 16),
          for (final x in widget.cfg.chains) ...[
            _NetworkOption(chain: x, selected: x.chain == _chain, onTap: () => setState(() => _chain = x.chain)),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 10),
          KTextField(
            label: t('common.amount'),
            controller: _amount,
            placeholder: '100.00',
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [amountFormatter],
            ltr: true,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _submit(),
            trailing: Padding(
              padding: const EdgeInsetsDirectional.only(end: 10),
              child: Text('USDT', style: context.text.label.copyWith(color: k.fg2, fontSize: 12.5)),
            ),
          ),
          FieldHint(t('wallet.deposit.amountHint', {'min': fmt(c?.minDeposit)})),
          WalletInlineError(_err, top: 14),
          const SizedBox(height: 18),
          KButton(
            label: t('common.continue'),
            icon: LucideIcons.wallet,
            size: KButtonSize.lg,
            expand: true,
            loading: _busy,
            onPressed: _valid ? _submit : null,
          ),
        ],
      ),
    );
  }
}

/// A network of the picker (web NetworkPicker button).
class _NetworkOption extends StatelessWidget {
  const _NetworkOption({required this.chain, required this.selected, required this.onTap});
  final WalletChain chain;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final l = chainLabel(chain.chain);
    return Semantics(
      selected: selected,
      button: true,
      child: WalletRow(
        selected: selected,
        enabled: chain.depositsEnabled,
        onTap: onTap,
        child: Row(
          children: [
            ChainCoin(chain.chain),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('USDT', style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(6)),
                        child: Text(
                          l.short,
                          style: context.text.micro.copyWith(color: k.fg2, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    t('wallet.deposit.payWithShort', {'network': l.name, 'wallet': l.wallet}),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                  ),
                ],
              ),
            ),
            if (selected)
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                child: Icon(LucideIcons.check, size: 14, color: k.onEmber),
              ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ step 2: pay */

/// "12:34" until the request expires, then "expired" (web Countdown).
class _IntentCountdown extends StatefulWidget {
  const _IntentCountdown({required this.until, required this.style});
  final DateTime until;
  final TextStyle style;

  @override
  State<_IntentCountdown> createState() => _IntentCountdownState();
}

class _IntentCountdownState extends State<_IntentCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.until.difference(DateTime.now()).inSeconds;
    if (left <= 0) return Text(context.t('wallet.deposit.expired'), style: widget.style.copyWith(color: context.k.warn));
    return Text(
      '${left ~/ 60}:${(left % 60).toString().padLeft(2, '0')}',
      textDirection: TextDirection.ltr,
      style: widget.style.copyWith(fontFeatures: kTabular),
    );
  }
}

/// Step 2 (web PayPanel): open the deposit in the wallet app, or send manually and paste the hash.
class PayPanel extends ConsumerStatefulWidget {
  const PayPanel({super.key, required this.view, required this.onSubmitted});
  final IntentView view;
  final VoidCallback onSubmitted;

  @override
  ConsumerState<PayPanel> createState() => _PayPanelState();
}

class _PayPanelState extends ConsumerState<PayPanel> {
  final _hash = TextEditingController();
  bool _busy = false;
  String? _err;

  @override
  void dispose() {
    _hash.dispose();
    super.dispose();
  }

  DepositIntent get _it => widget.view.intent;

  /// The web on a phone has no injected wallet either: it opens this deposit in the wallet app's own browser.
  Future<void> _openWalletApp() async {
    final t = context.t;
    final l = chainLabel(_it.chain);
    final link = walletAppLink(_it.chain, appHost(ref.read(configProvider).appUrl), _it.id);
    setState(() => _err = null);
    var ok = false;
    try {
      ok = await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
    if (!ok && mounted) setState(() => _err = t('app.wallet.walletAppMissing', {'wallet': l.wallet}));
  }

  Future<void> _manual() async {
    final t = context.t;
    if (_busy || !txHashLooksValid(_hash.text)) return;
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      await ref.read(apiProvider).post<Object?>('wallet/deposits/submit', body: {'intent_id': _it.id, 'tx_hash': _hash.text.trim()});
      ref
          .read(notificationsProvider.notifier)
          .toast(NotificationKind.success, t('wallet.deposit.toastSubmitted'), description: t('wallet.deposit.toastSubmittedText'));
      widget.onSubmitted();
    } catch (e) {
      if (mounted) setState(() => _err = walletErrorText(e, t, fallback: t('wallet.deposit.submitFailed')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final it = _it;
    final l = chainLabel(it.chain);
    final expired = it.expiredAt(DateTime.now());
    final bsc = it.chain == 'bsc';
    final small = context.text.footnote.copyWith(color: k.fg3);
    final (before, after) = splitAtTag(t('wallet.deposit.expiresIn'), 'time');
    final metaStyle = context.text.footnote.copyWith(color: k.fg3);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('wallet.deposit.sendTitle', {'amount': fmt(it.amount)}),
            subtitle: t('wallet.deposit.sendSubtitle', {'network': l.name, 'short': l.short, 'id': it.id.length >= 12 ? it.id.substring(4, 12) : it.id}),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(LucideIcons.clock, size: 14, color: k.fg3),
              const SizedBox(width: 6),
              if (expired)
                Text(t('wallet.deposit.requestExpired'), style: metaStyle)
              else ...[
                Text(before, style: metaStyle),
                _IntentCountdown(until: it.expiresAt, style: metaStyle),
                Text(after, style: metaStyle),
              ],
            ],
          ),
          const SizedBox(height: 16),
          // pay with the wallet app
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t('wallet.deposit.payWith', {'wallet': l.wallet}), style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500)),
                const SizedBox(height: 4),
                Text(bsc ? t('wallet.deposit.metamaskText') : t('wallet.deposit.tronlinkText'), style: small),
                const SizedBox(height: 12),
                KButton(
                  label: bsc ? t('wallet.deposit.openMetaMask') : t('app.wallet.openTronLink'),
                  icon: LucideIcons.smartphone,
                  onPressed: expired ? null : _openWalletApp,
                ),
                const SizedBox(height: 8),
                Text(bsc ? t('wallet.deposit.metamaskApp') : t('app.wallet.tronlinkApp'), style: small.copyWith(fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // or send manually
          Text(t('wallet.deposit.orManual'), style: context.text.label.copyWith(color: k.fg2)),
          const SizedBox(height: 12),
          Center(child: KQrCode(it.address, size: 148)),
          const SizedBox(height: 8),
          Text(
            t('wallet.deposit.companyAddress', {'network': l.short}),
            textAlign: TextAlign.center,
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 16),
          Text(
            t('wallet.deposit.sendTo').toUpperCase(),
            style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.8, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 6),
          WalletRow(
            padding: const EdgeInsetsDirectional.fromSTEB(12, 6, 4, 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(it.address, textDirection: TextDirection.ltr, style: context.text.mono(12.5)),
                ),
                KIconButton(icon: LucideIcons.copy, size: 32, semanticLabel: t('wallet.address'), onPressed: () => kCopy(context, it.address)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: WalletRow(
                  padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 4, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              t('common.amount'),
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${fmt(it.amount)} USDT',
                              textDirection: TextDirection.ltr,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.label.copyWith(fontWeight: FontWeight.w600, fontFeatures: kTabular),
                            ),
                          ],
                        ),
                      ),
                      KIconButton(icon: LucideIcons.copy, size: 28, semanticLabel: t('common.amount'), onPressed: () => kCopy(context, it.amount)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: WalletTile(label: t('wallet.network'), value: l.name),
              ),
            ],
          ),
          const SizedBox(height: 10),
          KNotice(
            tone: KChipTone.warn,
            icon: LucideIcons.circleAlert,
            text: t('wallet.deposit.warning', {'network': l.name, 'short': l.short, 'amount': fmt(it.amount)}),
          ),
          const SizedBox(height: 16),
          KTextField(
            label: t('wallet.transactionHash'),
            controller: _hash,
            placeholder: bsc ? ltrHint('0x…') : t('wallet.deposit.hashPlaceholder'),
            ltr: true,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _manual(),
          ),
          FieldHint(t('wallet.deposit.hashHint')),
          const SizedBox(height: 12),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KButton(
              label: t('wallet.deposit.iSentIt'),
              variant: KButtonVariant.surface,
              loading: _busy,
              onPressed: !_busy && txHashLooksValid(_hash.text) ? _manual : null,
            ),
          ),
          WalletInlineError(_err, top: 14),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ step 3: tracker */

/// Step 3 (web Tracker): waiting -> confirmations -> credited.
class DepositTracker extends StatelessWidget {
  const DepositTracker({super.key, required this.view, required this.onNew});
  final IntentView view;
  final VoidCallback onNew;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final d = view.deposit!;
    final st = kDepositStatus[d.status];
    final credited = d.status == 'credited';
    final bad = d.status == 'failed' || d.status == 'rejected';
    final l = chainLabel(d.chain);
    final steps = [(t('wallet.deposit.stepSent'), true), (t('wallet.deposit.stepFound'), d.status != 'pending'), (t('wallet.deposit.stepCredited'), credited)];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: credited ? t('wallet.deposit.credited') : (bad ? t('wallet.deposit.notCredited') : t('wallet.deposit.onItsWay')),
            subtitle: '${l.name} · USDT ${l.short}',
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
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: AlignmentDirectional.centerStart,
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: '+${fmt(d.amount ?? d.expectedAmount)}'),
                            TextSpan(
                              text: ' USDT',
                              style: TextStyle(fontSize: 15, color: k.fg3, fontWeight: FontWeight.w500, letterSpacing: 0),
                            ),
                          ],
                        ),
                        textDirection: TextDirection.ltr,
                        style: context.text.moneyL.copyWith(fontSize: 30),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(t('wallet.deposit.transaction'), style: context.text.footnote.copyWith(color: k.fg3)),
                        HashLink(hash: d.txHash, url: d.explorerUrl),
                      ],
                    ),
                  ],
                ),
              ),
              if (credited) const KIllustration(KIllustrationName.depositCredited, width: 96, maxHeight: 110),
            ],
          ),
          if (!bad && d.status != 'review') ...[
            const SizedBox(height: 16),
            Confirmations(confirmations: d.confirmations, required: d.requiredConfirmations, status: d.status),
          ],
          const SizedBox(height: 16),
          for (var i = 0; i < steps.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            WalletRow(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Row(
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: steps[i].$2 ? k.upSoft : null,
                      border: Border.all(color: steps[i].$2 ? k.up.withValues(alpha: 0.4) : k.line),
                    ),
                    child: steps[i].$2
                        ? Icon(LucideIcons.check, size: 12, color: k.up)
                        : Text(
                            '${i + 1}',
                            style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
                          ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(steps[i].$1, style: context.text.footnote.copyWith(color: steps[i].$2 ? k.fg : k.fg3)),
                  ),
                ],
              ),
            ),
          ],
          if (d.status == 'review') ...[
            const SizedBox(height: 14),
            KNotice(
              tone: KChipTone.warn,
              text: d.reviewReason != null ? t('wallet.deposit.reviewReason', {'reason': d.reviewReason}) : t('wallet.deposit.review'),
            ),
          ],
          if (bad) WalletInlineError(d.failureReason ?? t('wallet.deposit.couldNotCredit'), top: 14),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (credited) KButton(label: t('wallet.fundTradingAccount'), icon: LucideIcons.arrowLeftRight, onPressed: () => context.go('/wallet/transfer')),
              KButton(label: t('wallet.newDeposit'), variant: KButtonVariant.surface, onPressed: onNew),
              KButton(label: t('wallet.backToWallet'), variant: KButtonVariant.ghost, onPressed: () => context.go('/wallet')),
            ],
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ how deposits work */

/// The four steps of a deposit (web HowItWorks), with the networks' confirmation counts.
class HowItWorks extends StatelessWidget {
  const HowItWorks({super.key, required this.cfg});
  final WalletConfig cfg;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final steps = [
      (t('wallet.deposit.how1Title'), t('wallet.deposit.how1Text')),
      (t('wallet.deposit.how2Title'), t('wallet.deposit.how2Text')),
      (
        t('wallet.deposit.how3Title'),
        t('wallet.deposit.how3Text', {'bsc': cfg.chain('bsc')?.confirmations ?? 15, 'tron': cfg.chain('tron')?.confirmations ?? 20}),
      ),
      (t('wallet.deposit.how4Title'), t('wallet.deposit.how4Text')),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('wallet.howDepositsWork')),
          const SizedBox(height: 14),
          for (var i = 0; i < steps.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: k.line),
                    ),
                    child: Text('${i + 1}', style: context.text.caption.copyWith(color: k.fg2, fontSize: 11)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(steps[i].$1, style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(steps[i].$2, style: context.text.footnote.copyWith(color: k.fg3)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
