// Wallet › Deposit › Crypto checkout: the app's port of apps/crm/components/wallet-live/checkout.tsx.
//
//   start    amount in USD -> POST wallet/oxapay/invoices {amount} -> OxaPay's page opens in the phone's browser
//   open     the checkout in progress: amount, reference, "Continue to payment" (the same page again), Cancel;
//            polled every 6 s, so paying on the other site shows here by itself
//   credited "Payment received" and a new deposit
//   recent   the last six closed checkouts
//
// Leaving and coming back is the normal case here, because paying happens in the browser. OxaPay sends the
// payer to the Client Area's /wallet/deposit?checkout=<order_id> in that browser; the app's panel finds the open
// checkout on its own when the client returns to it.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_providers.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../checkout_api.dart';
import '../wallet_api.dart';
import 'wallet_ui.dart';

/// OxaPay's brand blue (web brand-logos.tsx OXAPAY_COLOR).
const Color kOxaPayBlue = Color(0xFF1C39BB);

/// PhonePe's brand purple (web PHONEPE_COLOR).
const Color kPhonePePurple = Color(0xFF5F259F);

/// The provider's mark on white, as the web shows every payment brand: the app has no logo asset for OxaPay, so
/// it is set in type on the brand colour rather than drawn from memory.
class OxaPayMark extends StatelessWidget {
  const OxaPayMark({super.key, this.size = 44});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: Colors.black.withValues(alpha: 0.06))),
    child: Container(
      width: size * 0.62,
      height: size * 0.62,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: kOxaPayBlue, shape: BoxShape.circle),
      child: Text('O', style: TextStyle(color: Colors.white, fontSize: size * 0.36, fontWeight: FontWeight.w800, height: 1)),
    ),
  );
}

/// PhonePe's mark, likewise (the bank / UPI route's brand on the deposit gate).
class PhonePeMark extends StatelessWidget {
  const PhonePeMark({super.key, this.size = 44});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: Colors.black.withValues(alpha: 0.06))),
    child: Container(
      width: size * 0.62,
      height: size * 0.62,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: kPhonePePurple, borderRadius: BorderRadius.circular(size * 0.16)),
      child: Text('पे', style: TextStyle(color: Colors.white, fontSize: size * 0.3, fontWeight: FontWeight.w700, height: 1)),
    ),
  );
}

/// The strip over a provider's card (web GatewayBanner): the mark, the name, "Secure payment".
class GatewayBanner extends StatelessWidget {
  const GatewayBanner({super.key, required this.mark, required this.name, required this.colour});
  final Widget mark;
  final String name;
  final Color colour;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [colour.withValues(alpha: 0.14), colour.withValues(alpha: 0.02)]),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          mark,
          const SizedBox(width: 10),
          Text(name, style: context.text.headline.copyWith(fontSize: 14.5, fontWeight: FontWeight.w600)),
          const Spacer(),
          Icon(LucideIcons.lock, size: 12, color: k.fg3),
          const SizedBox(width: 5),
          Text(t('payments.card.secure'), style: context.text.caption.copyWith(color: k.fg3, fontSize: 11.5, fontWeight: FontWeight.w400)),
        ],
      ),
    );
  }
}

/// The whole Crypto-checkout tab of the deposit page (web CheckoutPanel).
class CheckoutPanel extends ConsumerStatefulWidget {
  const CheckoutPanel({super.key, required this.list, required this.returning});
  final AsyncValue<CheckoutList> list;

  /// `?checkout=<order_id>`: the one the payer was sent back to.
  final String? returning;

  @override
  ConsumerState<CheckoutPanel> createState() => _CheckoutPanelState();
}

class _CheckoutPanelState extends ConsumerState<CheckoutPanel> {
  /// The checkout kept on screen after it closed (credited while the client watched): the web keeps the one the
  /// payer was sent back to; the app, where paying happens in the browser, keeps the one just paid until the
  /// client asks for a new deposit, so "Payment received" is not a flash.
  int? _keep;

  void _reload() => ref.invalidate(checkoutsProvider);

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final list = widget.list;
    if (list.hasError && !list.hasValue) return WalletUnavailable(onRetry: _reload);
    final data = list.value;
    if (data == null) return const KSkeletonCard(height: 420, lines: 6);
    if (!data.enabled) {
      return KCard(child: Text(t('payments.checkout.off'), style: context.text.callout.copyWith(color: k.fg2)));
    }
    final open = data.open(widget.returning) ?? (_keep == null ? null : data.items.where((c) => c.id == _keep).firstOrNull);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (open != null)
          _OpenCheckout(
            key: ValueKey('checkout-${open.id}'),
            c: open,
            onChanged: (c) {
              if (c.status == 'credited') _keep = c.id;
              _reload();
            },
            onDone: () => setState(() {
              _keep = null;
              _reload();
            }),
          )
        else
          _StartCheckout(list: data, onCreated: _reload),
        _Recent(items: data.items.where((c) => c.id != open?.id).toList()),
      ],
    );
  }
}

/// Opens OxaPay's page in the phone's browser. False when nothing could open it (a test, a phone with no browser).
Future<bool> openPaymentPage(String url) async {
  try {
    return await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ open */

class _OpenCheckout extends ConsumerStatefulWidget {
  const _OpenCheckout({super.key, required this.c, required this.onChanged, required this.onDone});
  final Checkout c;

  /// The checkout moved on (paid, cancelled, expired…): the list is behind it.
  final ValueChanged<Checkout> onChanged;

  /// "New deposit" after it was credited.
  final VoidCallback onDone;

  @override
  ConsumerState<_OpenCheckout> createState() => _OpenCheckoutState();
}

class _OpenCheckoutState extends ConsumerState<_OpenCheckout> {
  bool _busy = false;
  String? _err;

  Future<void> _cancel() async {
    if (_busy) return;
    final t = context.t;
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final r = await ref.read(apiProvider).post<Map<String, dynamic>>('wallet/oxapay/invoices/${widget.c.id}/cancel', body: const {});
      if (mounted) widget.onChanged(r['checkout'] is Map ? Checkout.fromJson((r['checkout'] as Map).cast<String, dynamic>()) : widget.c);
    } catch (e) {
      if (mounted) setState(() => _err = walletErrorText(e, t, fallback: t('payments.checkout.cancelFailed')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    // while it is open, keep asking: the list is behind the live row
    final live = ref.watch(checkoutLiveProvider(widget.c.id));
    final now = live.value ?? widget.c;
    ref.listen(checkoutLiveProvider(widget.c.id), (prev, next) {
      final c = next.value;
      if (c != null && !c.isOpen && c.status != prev?.value?.status) widget.onChanged(c);
    });

    if (now.status == 'credited') {
      return KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KCardHeader(title: t('payments.checkout.creditedTitle'), subtitle: t('payments.checkout.creditedText', {'amount': fmt(now.credited)})),
            const SizedBox(height: 16),
            KButton(label: t('payments.checkout.another'), icon: LucideIcons.wallet, expand: true, onPressed: widget.onDone),
          ],
        ),
      );
    }

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const GatewayBanner(mark: OxaPayMark(size: 28), name: 'OxaPay', colour: kOxaPayBlue),
          const SizedBox(height: 14),
          KCardHeader(title: t('payments.checkout.openTitle'), subtitle: t('payments.checkout.openText'), action: WalletStatusChip(checkoutStatus(now.status))),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(color: k.surface2, borderRadius: BorderRadius.circular(14), border: Border.all(color: k.line)),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('common.amount'), style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400)),
                      const SizedBox(height: 2),
                      Text('${fmt(now.amount)} USD', style: context.text.title2.copyWith(fontSize: 20, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(t('payments.checkout.reference'), style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400)),
                    const SizedBox(height: 2),
                    Text(now.orderId, style: context.text.label.copyWith(fontSize: 12.5, fontFamily: 'monospace', fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
              ],
            ),
          ),
          if (now.status == 'paying') ...[
            const SizedBox(height: 12),
            Text(t('payments.checkout.payingNote'), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12.5, height: 1.45)),
          ],
          WalletInlineError(_err, top: 12),
          const SizedBox(height: 16),
          if (now.paymentUrl != null)
            KButton(
              label: t('payments.checkout.continue'),
              icon: LucideIcons.arrowUpRight,
              size: KButtonSize.lg,
              expand: true,
              onPressed: () => openPaymentPage(now.paymentUrl!),
            ),
          if (now.status != 'paying') ...[
            const SizedBox(height: 8),
            KButton(label: t('common.cancel'), variant: KButtonVariant.surface, size: KButtonSize.lg, expand: true, loading: _busy, onPressed: _cancel),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ start */

class _StartCheckout extends ConsumerStatefulWidget {
  const _StartCheckout({required this.list, required this.onCreated});
  final CheckoutList list;
  final VoidCallback onCreated;

  @override
  ConsumerState<_StartCheckout> createState() => _StartCheckoutState();
}

class _StartCheckoutState extends ConsumerState<_StartCheckout> {
  final _amount = TextEditingController();
  bool _busy = false;
  String? _err;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  bool get _valid => checkoutAmountOk(_amount.text, widget.list.minAmount, widget.list.maxAmount);

  Future<void> _submit() async {
    if (!_valid || _busy) return;
    final t = context.t;
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final r = await ref.read(apiProvider).post<Map<String, dynamic>>('wallet/oxapay/invoices', body: {'amount': _amount.text.trim()});
      final c = Checkout.fromJson((r['checkout'] as Map).cast<String, dynamic>());
      // OxaPay's page, with their own choice of coins; the open checkout shows here meanwhile
      if (c.paymentUrl != null) await openPaymentPage(c.paymentUrl!);
      if (mounted) widget.onCreated();
    } catch (e) {
      if (mounted) setState(() => _err = walletErrorText(e, t, fallback: t('payments.checkout.startFailed')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const GatewayBanner(mark: OxaPayMark(size: 28), name: 'OxaPay', colour: kOxaPayBlue),
          const SizedBox(height: 14),
          KCardHeader(title: t('payments.checkout.title'), subtitle: t('payments.checkout.subtitle')),
          const SizedBox(height: 16),
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
              child: Text('USD', style: context.text.label.copyWith(color: k.fg2, fontSize: 12.5)),
            ),
          ),
          FieldHint(t('payments.checkout.amountHint', {'min': fmt(widget.list.minAmount), 'max': fmt(widget.list.maxAmount)})),
          WalletInlineError(_err, top: 14),
          const SizedBox(height: 18),
          KButton(
            label: t('payments.checkout.go'),
            icon: LucideIcons.arrowUpRight,
            size: KButtonSize.lg,
            expand: true,
            loading: _busy,
            onPressed: _valid ? _submit : null,
          ),
          const SizedBox(height: 12),
          Text(t('payments.checkout.note'), style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.45)),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ recent */

class _Recent extends StatelessWidget {
  const _Recent({required this.items});
  final List<Checkout> items;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final past = items.where((c) => !c.isOpen).take(6).toList();
    if (past.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: kWalletGap),
      child: KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KCardHeader(title: t('payments.checkout.recent')),
            const SizedBox(height: 6),
            for (var i = 0; i < past.length; i++) ...[
              if (i > 0) Container(height: 1, color: k.line),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 11),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${fmt(past[i].status == 'credited' ? past[i].credited : past[i].amount)} ${past[i].status == 'credited' ? 'USDT' : 'USD'}',
                            style: context.text.callout.copyWith(fontWeight: FontWeight.w500, fontFeatures: const [FontFeature.tabularFigures()]),
                          ),
                          const SizedBox(height: 2),
                          Text(past[i].orderId, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.label.copyWith(fontSize: 11.5, color: k.fg3, fontFamily: 'monospace')),
                        ],
                      ),
                    ),
                    WalletStatusChip(checkoutStatus(past[i].status)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
