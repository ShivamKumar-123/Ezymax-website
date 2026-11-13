// Wallet › Deposit › Crypto checkout (OxaPay): the data of apps/crm/components/wallet-live/checkout.tsx.
//
// The third way to deposit: the client names an amount in USD, the Client Area opens an invoice with OxaPay, and
// they pay whichever coin they like on OxaPay's own page (opened in the phone's browser). Paying credits the
// wallet by itself: no hash to paste and no staff approval, unlike the USDT and the bank / crypto paths.
//
//   GET  wallet/oxapay/invoices              the client's checkouts, with enabled / min_amount / max_amount
//   GET  wallet/oxapay/invoices/{id}?poll=1  one checkout; the poll asks OxaPay first (credits it if the webhook
//                                            has not arrived yet)
//   POST wallet/oxapay/invoices {amount}     -> {checkout} with payment_url
//   POST wallet/oxapay/invoices/{id}/cancel  only while nothing has been paid
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/lifecycle.dart';
import '../../ui/tokens.dart';
import 'wallet_api.dart';

/// One OxaPay invoice (web Checkout).
class Checkout {
  const Checkout({
    required this.id,
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.status,
    required this.paymentUrl,
    required this.credited,
    required this.txHash,
    required this.network,
    required this.paidCurrency,
    required this.expiresAt,
    required this.creditedAt,
    required this.createdAt,
  });

  final int id;
  final String orderId;
  final String amount;
  final String currency;

  /// `new` | `waiting` | `paying` | `credited` | `expired` | `failed` | `cancelled`
  final String status;
  final String? paymentUrl;
  final String? credited;
  final String? txHash;
  final String? network;
  final String? paidCurrency;
  final DateTime? expiresAt;
  final DateTime? creditedAt;
  final DateTime? createdAt;

  /// Still worth waiting on: the client can pay it, or has and we are waiting for the chain (web isOpen).
  bool get isOpen => status == 'new' || status == 'waiting' || status == 'paying';

  factory Checkout.fromJson(Map<String, dynamic> j) => Checkout(
    id: j['id'] is num ? (j['id'] as num).toInt() : int.tryParse('${j['id']}') ?? 0,
    orderId: '${j['order_id'] ?? ''}',
    amount: '${j['amount'] ?? '0'}',
    currency: '${j['currency'] ?? 'USD'}',
    status: '${j['status'] ?? 'new'}',
    paymentUrl: j['payment_url'] as String?,
    credited: j['credited'] == null ? null : '${j['credited']}',
    txHash: j['tx_hash'] as String?,
    network: j['network'] as String?,
    paidCurrency: j['paid_currency'] as String?,
    expiresAt: DateTime.tryParse('${j['expires_at'] ?? ''}'),
    creditedAt: DateTime.tryParse('${j['credited_at'] ?? ''}'),
    createdAt: DateTime.tryParse('${j['created_at'] ?? ''}'),
  );
}

/// `GET wallet/oxapay/invoices` (web CheckoutList): the checkouts and whether the broker has the checkout on.
class CheckoutList {
  const CheckoutList({required this.items, required this.total, required this.enabled, required this.minAmount, required this.maxAmount});
  final List<Checkout> items;
  final int total;
  final bool enabled;
  final String minAmount, maxAmount;

  static const CheckoutList none = CheckoutList(items: [], total: 0, enabled: false, minAmount: '0', maxAmount: '0');

  factory CheckoutList.fromJson(Map<String, dynamic> j) => CheckoutList(
    items: [for (final x in (j['items'] as List? ?? const [])) Checkout.fromJson((x as Map).cast<String, dynamic>())],
    total: j['total'] is num ? (j['total'] as num).toInt() : 0,
    enabled: j['enabled'] == true,
    minAmount: '${j['min_amount'] ?? '0'}',
    maxAmount: '${j['max_amount'] ?? '0'}',
  );

  /// The checkout the client is in the middle of: the one they were just sent back from (`?checkout=<order_id>`)
  /// wins, so the page they land on is the one they just paid; else the first still open.
  Checkout? open(String? returning) {
    final back = returning == null ? null : items.where((c) => c.orderId == returning).firstOrNull;
    return back ?? items.where((c) => c.isOpen).firstOrNull;
  }
}

/// `useCheckouts()`: the list, polled every 20 s while the deposit page shows it.
final checkoutsProvider = FutureProvider.autoDispose<CheckoutList>((ref) async {
  ref.pollEvery(const Duration(seconds: 20));
  return CheckoutList.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('wallet/oxapay/invoices'));
});

/// `useWallet("oxapay/invoices/<id>?poll=1", 6000)`: the open checkout, asked again every 6 s. The webhook usually
/// wins, but a poll credits it even if that never lands.
final checkoutLiveProvider = FutureProvider.autoDispose.family<Checkout, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 6));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('wallet/oxapay/invoices/$id', query: {'poll': 1});
  return Checkout.fromJson((j['checkout'] as Map).cast<String, dynamic>());
});

/// The status chip of a checkout (web Status).
WalletStatus checkoutStatus(String status) => switch (status) {
  'credited' => (tone: KChipTone.up, label: 'payments.checkout.statusCredited'),
  'paying' => (tone: KChipTone.ember, label: 'payments.checkout.statusPaying'),
  'expired' => (tone: KChipTone.neutral, label: 'payments.checkout.statusExpired'),
  'failed' => (tone: KChipTone.down, label: 'payments.checkout.statusFailed'),
  'cancelled' => (tone: KChipTone.neutral, label: 'payments.checkout.statusCancelled'),
  _ => (tone: KChipTone.neutral, label: 'payments.checkout.statusWaiting'),
};

/// The amount a checkout takes (web StartCheckout `valid`): up to 9 digits and 2 decimals, within the limits.
bool checkoutAmountOk(String amount, String min, String max) {
  final v = amount.trim();
  if (!RegExp(r'^\d{1,9}(\.\d{1,2})?$').hasMatch(v)) return false;
  final n = double.parse(v);
  return n >= (double.tryParse(min) ?? 0) && n <= (double.tryParse(max) ?? double.infinity);
}
