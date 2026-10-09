// Manual payments (Wallet › Deposit › Bank / UPI, Crypto): the broker's bank accounts, UPI IDs and crypto addresses
// that clients pay outside the platform, then report with a deposit request the broker verifies (services/wallet
// README "Manual payments", the Client Area BFF apps/crm/app/api/wallet/[...path]/route.ts `manual/*`, here under
// /api/mobile/wallet/manual/*). Models, providers (the methods once per page, the requests every 20 s), the submit /
// cancel / screenshot-upload calls, the screenshot picker, the decimal maths of "You'll receive ≈ X USDT" (strings
// and BigInt, no float drift: the service floors amount / rate to 6 decimals), the UPI link of the QR code and the
// error texts. Amounts stay strings end to end, as in the rest of the wallet.
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_providers.dart';
import '../../core/lifecycle.dart';
import '../../i18n/t.dart';
import '../../ui/tokens.dart';
import 'wallet_api.dart';

/* ------------------------------------------------------------------ parsing */

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
String _str(Object? v, [String f = '']) => v == null ? f : '$v';
String? _sn(Object? v) => v == null || '$v'.trim().isEmpty ? null : '$v';
DateTime _date(Object? v) => DateTime.tryParse('${v ?? ''}') ?? DateTime.now();
DateTime? _dateOrNull(Object? v) => v == null ? null : DateTime.tryParse('$v');
Map<String, dynamic> _map(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};
List<Map<String, dynamic>> _list(Object? v) => [
  for (final x in (v is List ? v : const <Object?>[]))
    if (x is Map) x.cast<String, dynamic>(),
];

/* ------------------------------------------------------------------ methods */

/// The payment details of a method: a bank account / UPI ID (kind bank) or an address (kind crypto). Empty fields
/// are null.
class ManualDetails {
  const ManualDetails({
    this.accountName,
    this.bankName,
    this.accountNumber,
    this.ifsc,
    this.swift,
    this.iban,
    this.branch,
    this.upiId,
    this.network,
    this.token,
    this.address,
    this.memo,
  });

  // bank
  final String? accountName, bankName, accountNumber, ifsc, swift, iban, branch, upiId;
  // crypto
  final String? network, token, address, memo;

  static ManualDetails fromJson(Map<String, dynamic> j) => ManualDetails(
    accountName: _sn(j['account_name']),
    bankName: _sn(j['bank_name']),
    accountNumber: _sn(j['account_number']),
    ifsc: _sn(j['ifsc']),
    swift: _sn(j['swift']),
    iban: _sn(j['iban']),
    branch: _sn(j['branch']),
    upiId: _sn(j['upi_id']),
    network: _sn(j['network']),
    token: _sn(j['token']),
    address: _sn(j['address']),
    memo: _sn(j['memo']),
  );
}

/// A payment method of `GET wallet/manual/methods`.
class ManualMethod {
  const ManualMethod({
    required this.id,
    required this.kind,
    required this.name,
    required this.status,
    required this.sortOrder,
    required this.currency,
    required this.rate,
    required this.minAmount,
    required this.maxAmount,
    required this.details,
    required this.qrMediaId,
    required this.qrUrl,
    required this.instructions,
    required this.updatedAt,
  });

  final int id;

  /// bank | crypto
  final String kind;
  final String name;

  /// active | hidden (the client API lists active methods only)
  final String status;
  final int sortOrder;

  /// What the client pays in (INR, USD, USDT …).
  final String currency;

  /// Units of [currency] per 1 USDT ("88.00"; "1" for USDT).
  final String rate;

  /// In [currency]; [maxAmount] null = no maximum.
  final String minAmount;
  final String? maxAmount;
  final ManualDetails details;

  /// The broker's uploaded QR image (private: loaded with the session, see [manualMediaProvider]).
  final String? qrMediaId, qrUrl;
  final String instructions;
  final DateTime? updatedAt;

  bool get bank => kind == 'bank';
  bool get active => status == 'active';

  /// The token sent to a crypto method (USDT unless the broker says otherwise).
  String get token => details.token ?? 'USDT';

  static ManualMethod fromJson(Map<String, dynamic> j) => ManualMethod(
    id: _int(j['id']),
    kind: _str(j['kind'], 'bank'),
    name: _str(j['name']),
    status: _str(j['status'], 'active'),
    sortOrder: _int(j['sort_order']),
    currency: _str(j['currency'], 'USDT'),
    rate: _str(j['rate'], '1'),
    minAmount: _str(j['min_amount'], '0'),
    maxAmount: _sn(j['max_amount']),
    details: ManualDetails.fromJson(_map(j['details'])),
    qrMediaId: _sn(j['qr_media_id']),
    qrUrl: _sn(j['qr_url']),
    instructions: _str(j['instructions']).trim(),
    updatedAt: _dateOrNull(j['updated_at']),
  );
}

/// `GET wallet/manual/methods` -> {methods, max_pending}.
class ManualMethods {
  const ManualMethods({required this.methods, required this.maxPending});
  final List<ManualMethod> methods;

  /// Requests a client may have waiting for review at once.
  final int maxPending;

  /// The active methods of `kind` (bank | crypto) in the broker's order.
  List<ManualMethod> of(String kind) => [
    for (final m in methods)
      if (m.kind == kind && m.active) m,
  ]..sort((a, b) => a.sortOrder != b.sortOrder ? a.sortOrder.compareTo(b.sortOrder) : a.id.compareTo(b.id));

  bool get any => methods.any((m) => m.active && (m.kind == 'bank' || m.kind == 'crypto'));

  ManualMethod? byId(int id) => methods.where((m) => m.id == id).firstOrNull;

  static const ManualMethods none = ManualMethods(methods: [], maxPending: 5);

  static ManualMethods fromJson(Map<String, dynamic> j) => ManualMethods(
    methods: [for (final m in _list(j['methods'])) ManualMethod.fromJson(m)],
    maxPending: j['max_pending'] == null ? 5 : _int(j['max_pending']),
  );
}

/* ------------------------------------------------------------------ requests */

/// The method as the request saw it (a snapshot: the broker may edit or delete the method later).
class ManualDepositMethod {
  const ManualDepositMethod({
    required this.kind,
    required this.name,
    required this.currency,
    required this.rate,
    this.network,
    this.token,
    this.destination,
    this.memo,
    this.bankName,
    this.accountName,
    this.accountNumber,
    this.ifsc,
    this.upiId,
  });
  final String kind, name, currency, rate;
  final String? network, token, destination, memo, bankName, accountName, accountNumber, ifsc, upiId;

  static ManualDepositMethod fromJson(Map<String, dynamic> j) => ManualDepositMethod(
    kind: _str(j['kind'], 'bank'),
    name: _str(j['name']),
    currency: _str(j['currency'], 'USDT'),
    rate: _str(j['rate'], '1'),
    network: _sn(j['network']),
    token: _sn(j['token']),
    destination: _sn(j['destination']),
    memo: _sn(j['memo']),
    bankName: _sn(j['bank_name']),
    accountName: _sn(j['account_name']),
    accountNumber: _sn(j['account_number']),
    ifsc: _sn(j['ifsc']),
    upiId: _sn(j['upi_id']),
  );
}

/// A deposit request: pending -> approved (credited) | rejected (with the broker's reason) | cancelled (by the client).
class ManualDeposit {
  const ManualDeposit({
    required this.id,
    required this.methodId,
    required this.kind,
    required this.method,
    required this.currency,
    required this.amount,
    required this.rate,
    required this.expectedCredit,
    required this.creditAmount,
    required this.reference,
    required this.proofUrl,
    required this.clientNote,
    required this.status,
    required this.reason,
    required this.decidedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  final int id, methodId;

  /// bank | crypto
  final String kind;
  final ManualDepositMethod method;

  /// The amount paid, in [currency] (the method's), at [rate] units per USDT.
  final String currency, amount, rate;

  /// USDT the request credits when approved as sent (amount / rate floored to 6 decimals).
  final String expectedCredit;

  /// USDT actually credited (approved only; the broker may correct it).
  final String? creditAmount;

  /// The UTR / transaction id / hash.
  final String reference;
  final String? proofUrl, clientNote;

  /// pending | approved | rejected | cancelled
  final String status;

  /// The rejection reason.
  final String? reason;
  final DateTime? decidedAt;
  final DateTime createdAt;
  final DateTime? updatedAt;

  bool get pending => status == 'pending';

  /// The USDT credited (approved), else the expected credit.
  String get credited => creditAmount ?? expectedCredit;

  static ManualDeposit fromJson(Map<String, dynamic> j) {
    final method = ManualDepositMethod.fromJson(_map(j['method']));
    return ManualDeposit(
      id: _int(j['id']),
      methodId: _int(j['method_id']),
      kind: _str(j['kind'], method.kind),
      method: method,
      currency: _str(j['currency'], method.currency),
      amount: _str(j['amount'], '0'),
      rate: _str(j['rate'], method.rate),
      expectedCredit: _str(j['expected_credit'], '0'),
      creditAmount: _sn(j['credit_amount']),
      reference: _str(j['reference']),
      proofUrl: _sn(j['proof_url']),
      clientNote: _sn(j['client_note']),
      status: _str(j['status'], 'pending'),
      reason: _sn(j['reason']),
      decidedAt: _dateOrNull(j['decided_at']),
      createdAt: _date(j['created_at']),
      updatedAt: _dateOrNull(j['updated_at']),
    );
  }
}

/// `GET wallet/manual/deposits?page&limit` -> {items, page, limit, total, pending, max_pending}, newest first.
class ManualDepositsPage {
  const ManualDepositsPage({required this.items, required this.page, required this.limit, required this.total, required this.pending, required this.maxPending});
  final List<ManualDeposit> items;
  final int page, limit, total;

  /// Requests waiting for review, and how many may wait at once.
  final int pending, maxPending;

  static ManualDepositsPage fromJson(Map<String, dynamic> j) {
    final items = [for (final x in _list(j['items'])) ManualDeposit.fromJson(x)];
    return ManualDepositsPage(
      items: items,
      page: j['page'] == null ? 1 : _int(j['page']),
      limit: j['limit'] == null ? items.length : _int(j['limit']),
      total: j['total'] == null ? items.length : _int(j['total']),
      pending: j['pending'] == null ? items.where((d) => d.pending).length : _int(j['pending']),
      maxPending: j['max_pending'] == null ? 5 : _int(j['max_pending']),
    );
  }
}

/// An uploaded image (`POST wallet/manual/proofs` -> {media}).
class ManualMedia {
  const ManualMedia({required this.id, required this.url, required this.mime, required this.size});
  final String id, url, mime;
  final int size;

  static ManualMedia fromJson(Map<String, dynamic> j) =>
      ManualMedia(id: _str(j['id']), url: _str(j['url']), mime: _str(j['mime']), size: _int(j['size']));
}

/* ------------------------------------------------------------------ providers */

/// `GET wallet/manual/methods`, every 60 s while the deposit page is open (the web's useManualMethods).
final manualMethodsProvider = FutureProvider.autoDispose<ManualMethods>((ref) async {
  ref.pollEvery(const Duration(seconds: 60));
  return ManualMethods.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('wallet/manual/methods'));
});

/// Requests the list shows first; "Show more" shows this many more (web PER).
const int kManualPer = 10;

/// The most the service returns in one page.
const int kManualMaxLimit = 100;

/// `GET wallet/manual/deposits?page=1&limit=<n>` (the web's useManualRequests(limit)): the newest `n` requests,
/// polled every 20 s while shown (a request is approved or rejected).
final manualDepositsProvider = FutureProvider.autoDispose.family<ManualDepositsPage, int>((ref, limit) async {
  ref.pollEvery(const Duration(seconds: 20));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('wallet/manual/deposits', query: {'page': 1, 'limit': limit});
  return ManualDepositsPage.fromJson(j);
});

/// A QR code or the client's own screenshot: `GET wallet/manual/media/{id}` with the session (the images are
/// private: the web loads them same-origin with its cookie, the app with its bearer token).
final manualMediaProvider = FutureProvider.autoDispose.family<Uint8List, String>((ref, id) async {
  final file = await ref.watch(apiProvider).download('wallet/manual/media/$id');
  return file.bytes;
});

/// The image id of a media url ("/api/wallet/manual/media/<24 hex>", as the web links it), or null.
String? manualMediaId(String? url) => url == null ? null : RegExp(r'manual/media/([0-9a-f]{24})(?:[/?#]|$)').firstMatch(url)?.group(1);

/* ------------------------------------------------------------------ calls */

/// The body of `POST wallet/manual/deposits` without its idempotency key: what the client sends (amount and reference
/// trimmed; the screenshot and the note only when given). Two submits with the same body are the same request.
Map<String, Object?> manualDepositBody({required int methodId, required String amount, required String reference, String? proofMediaId, String? note}) {
  final n = note?.trim() ?? '';
  return {
    'method_id': methodId,
    'amount': amount.trim(),
    'reference': reference.trim(),
    'proof_media_id': ?proofMediaId,
    if (n.isNotEmpty) 'note': n,
  };
}

/// `POST wallet/manual/deposits` with `key` (8–128 of [A-Za-z0-9:_-], one per distinct request, kept while the same
/// request is retried: a retry after a lost answer returns the first request instead of filing it twice).
Future<ManualDeposit> submitManualDeposit(ApiClient api, Map<String, Object?> body, {required String key}) async {
  final j = await api.post<Map<String, dynamic>>('wallet/manual/deposits', body: {...body, 'idempotency_key': key});
  return ManualDeposit.fromJson(_map(j['deposit']));
}

/// `POST wallet/manual/deposits/{id}/cancel` (only while pending).
Future<ManualDeposit> cancelManualDeposit(ApiClient api, int id) async {
  final j = await api.post<Map<String, dynamic>>('wallet/manual/deposits/$id/cancel', body: const <String, Object?>{});
  return ManualDeposit.fromJson(_map(j['deposit']));
}

/* ------------------------------------------------------------------ the payment screenshot */

/// Screenshot limit (the BFF and the wallet refuse more: 413 too_large).
const int kManualProofMaxBytes = 5 * 1024 * 1024;

/// The image types the wallet keeps (sniffed from the bytes: 415 unsupported_type otherwise).
const Set<String> kManualProofTypes = {'image/png', 'image/jpeg', 'image/webp'};

/// A screenshot the client chose: its bytes, file name and type.
class ManualProof {
  const ManualProof({required this.bytes, required this.name, required this.mime});
  final Uint8List bytes;
  final String name;
  final String mime;
}

/// PNG / JPEG / WEBP from the first bytes (what the wallet sniffs), else null.
String? sniffImageType(Uint8List b) {
  if (b.length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return 'image/png';
  if (b.length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return 'image/jpeg';
  if (b.length >= 12 && String.fromCharCodes(b.sublist(0, 4)) == 'RIFF' && String.fromCharCodes(b.sublist(8, 12)) == 'WEBP') return 'image/webp';
  return null;
}

/// Where screenshots come from. Null = the person closed the gallery.
abstract class ManualProofPicker {
  Future<ManualProof?> pick();
}

/// The phone's gallery (image_picker), large photos scaled to at most 2560 px.
class DeviceProofPicker implements ManualProofPicker {
  const DeviceProofPicker();

  @override
  Future<ManualProof?> pick() async {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2560, maxHeight: 2560, imageQuality: 92, requestFullMetadata: false);
    if (x == null) return null;
    final bytes = await x.readAsBytes();
    final name = x.name.isEmpty ? 'payment-${DateTime.now().millisecondsSinceEpoch}.jpg' : x.name;
    return ManualProof(bytes: bytes, name: name, mime: sniffImageType(bytes) ?? x.mimeType ?? 'application/octet-stream');
  }
}

/// The picker in use (tests and previews replace it).
final manualProofPickerProvider = Provider<ManualProofPicker>((ref) => const DeviceProofPicker());

/// What is wrong with a chosen screenshot before it is sent (size, type), or null.
String? manualProofIssue(ManualProof p, T t) {
  if (p.bytes.length > kManualProofMaxBytes) return t('payments.error.uploadTooLarge');
  if (!kManualProofTypes.contains(p.mime)) return t('payments.error.uploadType');
  return null;
}

/// `POST wallet/manual/proofs`: multipart/form-data with `file` -> {media}; its id goes in the request as
/// `proof_media_id`.
Future<ManualMedia> uploadManualProof(ApiClient api, ManualProof p, {ProgressCallback? onProgress, CancelToken? cancel}) async {
  final form = FormData();
  form.files.add(MapEntry('file', MultipartFile.fromBytes(p.bytes, filename: p.name, contentType: DioMediaType.parse(p.mime))));
  final j = await api.upload<Map<String, dynamic>>('wallet/manual/proofs', data: form, contentType: 'multipart/form-data', onSendProgress: onProgress, cancel: cancel);
  return ManualMedia.fromJson(_map(j['media']));
}

/* ------------------------------------------------------------------ decimals (no float drift) */

final RegExp _plainDecimal = RegExp(r'^\d+(\.\d+)?$');
final RegExp _manualAmount = RegExp(r'^\d{1,12}(\.\d{1,6})?$');

/// A plain decimal string ("88", "88.50") as an integer of `scale` decimals, rounded down; null when it isn't one.
BigInt? decimalUnits(String s, int scale) {
  final v = s.trim();
  if (!_plainDecimal.hasMatch(v)) return null;
  final dot = v.indexOf('.');
  final whole = dot < 0 ? v : v.substring(0, dot);
  var frac = dot < 0 ? '' : v.substring(dot + 1);
  frac = frac.length > scale ? frac.substring(0, scale) : frac.padRight(scale, '0');
  return BigInt.parse('$whole$frac');
}

/// The number of decimals written in `s`.
int _decimals(String s) {
  final dot = s.trim().indexOf('.');
  return dot < 0 ? 0 : s.trim().length - dot - 1;
}

/// Compares two plain decimal strings (-1, 0, 1); null when either isn't one.
int? compareDecimal(String a, String b) {
  final scale = max(_decimals(a), _decimals(b));
  final x = decimalUnits(a, scale), y = decimalUnits(b, scale);
  if (x == null || y == null) return null;
  return x.compareTo(y);
}

/// `units` / 10^scale as a plain decimal string ("56.818181").
String _unitsToString(BigInt units, int scale) {
  if (scale == 0) return units.toString();
  final s = units.toString().padLeft(scale + 1, '0');
  return '${s.substring(0, s.length - scale)}.${s.substring(s.length - scale)}';
}

/// USDT received for `amount` paid at `rate` units per USDT: amount / rate floored to 6 decimals, as the wallet
/// computes `expected_credit` ("56.818181"); null when either isn't a positive decimal.
String? manualReceive(String amount, String rate) {
  final rs = _decimals(rate);
  final a = decimalUnits(amount, 6);
  final r = decimalUnits(rate, rs);
  if (a == null || r == null || r == BigInt.zero || a <= BigInt.zero) return null;
  // (a / 10^6) / (r / 10^rs) * 10^6 = a * 10^rs / r
  final q = (a * BigInt.from(10).pow(rs)) ~/ r;
  return _unitsToString(q, 6);
}

/// A plain decimal string for display: en-US grouping, at least `minDp` decimals and at most `maxDp` (cut, never
/// rounded up): "56818.181818" -> "56,818.181818", "500" -> "500.00". Not a decimal: as given.
String decimalDisplay(String s, {int minDp = 2, int maxDp = 6}) {
  final v = s.trim();
  if (!_plainDecimal.hasMatch(v)) return v.isEmpty ? '—' : v;
  final dot = v.indexOf('.');
  var whole = (dot < 0 ? v : v.substring(0, dot)).replaceFirst(RegExp(r'^0+(?=\d)'), '');
  var frac = dot < 0 ? '' : v.substring(dot + 1);
  if (frac.length > maxDp) frac = frac.substring(0, maxDp);
  frac = frac.replaceFirst(RegExp(r'0+$'), '');
  if (frac.length < minDp) frac = frac.padRight(minDp, '0');
  whole = whole.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  return frac.isEmpty ? whole : '$whole.$frac';
}

/// An amount with its currency, as the payments texts take {amount} / {min} / {max} (web money): fiat and USDT with
/// at least 2 decimals ("200,000.00 INR"), other coins with their own ("0.0005 BTC").
String manualMoney(String amount, String currency) {
  final fiat = RegExp(r'^[A-Z]{3}$').hasMatch(currency) && !const {'BTC', 'ETH', 'BNB'}.contains(currency);
  return '${decimalDisplay(amount, minDp: fiat || currency == 'USDT' ? 2 : 0)} $currency';
}

/// The rate as shown (web rateText): "88.00", "3.67", and small rates as written ("0.0000158").
String manualRateText(String rate) => (compareDecimal(rate, '1') ?? 0) >= 0 ? decimalDisplay(rate) : rate.trim();

/// Amount fields of manual payments (web cleanDecimal): what [cleanAmount] keeps, with `dp` decimals (2 for bank
/// methods, 6 for crypto: the wallet's limit).
TextInputFormatter manualAmountFormatter(int dp) => TextInputFormatter.withFunction((old, next) {
  final c = cleanAmount(next.text, dp);
  if (c == next.text) return next;
  return TextEditingValue(
    text: c,
    selection: TextSelection.collapsed(offset: c.length),
  );
});

/// What is wrong with an amount for a method.
enum ManualAmountIssue { empty, invalid, belowMin, aboveMax }

/// The amount check of the form (the wallet checks again): up to 12 digits and 6 decimals, above zero, within the
/// method's limits.
ManualAmountIssue? manualAmountIssue(ManualMethod m, String raw) {
  final a = raw.trim();
  if (a.isEmpty) return ManualAmountIssue.empty;
  if (!_manualAmount.hasMatch(a) || (decimalUnits(a, 6) ?? BigInt.zero) <= BigInt.zero) return ManualAmountIssue.invalid;
  if ((compareDecimal(a, m.minAmount) ?? 0) < 0) return ManualAmountIssue.belowMin;
  final mx = m.maxAmount;
  if (mx != null && (compareDecimal(a, mx) ?? 0) > 0) return ManualAmountIssue.aboveMax;
  return null;
}

/// A reference the BFF takes: 4–128 characters once trimmed.
bool manualReferenceOk(String raw) {
  final r = raw.trim();
  return r.length >= 4 && r.length <= 128;
}

/* ------------------------------------------------------------------ QR codes, labels */

/// The UPI payment link of a UPI ID (what any UPI app scans; web qrPayload): `upi://pay?pa=<id>&pn=<name>&cu=INR`,
/// URI-encoded with the `@` of the ID kept.
String upiLink(String upiId, {String? name}) {
  final n = name?.trim() ?? '';
  return 'upi://pay?pa=${Uri.encodeComponent(upiId.trim()).replaceAll('%40', '@')}${n.isEmpty ? '' : '&pn=${Uri.encodeComponent(n)}'}&cu=INR';
}

/// What the generated QR code holds: the UPI link of a bank method with a UPI ID, a crypto method's address; null
/// for a bank account without UPI (only an uploaded QR then).
String? manualQrData(ManualMethod m) {
  if (m.bank) return m.details.upiId == null ? null : upiLink(m.details.upiId!, name: m.details.accountName);
  return m.details.address;
}

/// The method shows a QR code: the broker's uploaded image, or one generated from the UPI ID / address.
bool manualHasQr(ManualMethod m) => m.qrUrl != null || manualQrData(m) != null;

/// "Min 500.00 INR · Max 5,00,000 INR" / "Min 500.00 INR".
String manualLimits(ManualMethod m, T t) {
  final min = manualLtr(t, manualMoney(m.minAmount, m.currency));
  final mx = m.maxAmount;
  if (mx == null) return t('payments.picker.minOnly', {'min': min});
  return t('payments.picker.limits', {'min': min, 'max': manualLtr(t, manualMoney(mx, m.currency))});
}

/// "1 USDT = 88.00 INR".
String manualRate(String rate, String currency, T t) => t('payments.card.rateValue', {'rate': manualLtr(t, manualRateText(rate)), 'currency': currency});

/// Figures stay left to right inside right-to-left text (an LTR isolate in Arabic, Urdu and Persian).
String manualLtr(T t, String s) => t.rtl ? '\u2066$s\u2069' : s;

/// A request's status chip.
const Map<String, WalletStatus> kManualStatus = {
  'pending': (tone: KChipTone.warn, label: 'payments.status.pending'),
  'approved': (tone: KChipTone.up, label: 'payments.status.approved'),
  'rejected': (tone: KChipTone.down, label: 'payments.status.rejected'),
  'cancelled': (tone: KChipTone.neutral, label: 'payments.status.cancelled'),
};

/* ------------------------------------------------------------------ errors */

/// The text of a failed manual-payment call: the codes the payments catalog words (with the method's limits and the
/// pending cap filled in), else the wallet's texts (outages, network) and the server's own message.
String manualErrorText(Object? e, T t, {ManualMethod? method, int maxPending = 5, String? fallback}) {
  if (e is! ApiException) return fallback ?? t('payments.error.submitFailed');
  if (e.isNetwork) return t('common.networkError');
  switch (e.code) {
    case 'reference_used':
      return t('payments.error.referenceUsed');
    case 'too_many_pending':
      final n = e.data?['max_pending'];
      return t('payments.error.tooManyPending', {'max': n is num ? n.toInt() : maxPending});
    case 'method_unavailable':
      return t('payments.error.methodUnavailable');
    case 'restricted':
      return t('payments.error.restricted');
    case 'below_minimum':
      if (method != null) return t('payments.error.belowMin', {'amount': manualLtr(t, manualMoney(method.minAmount, method.currency))});
    case 'above_maximum':
      if (method?.maxAmount != null) return t('payments.error.aboveMax', {'amount': manualLtr(t, manualMoney(method!.maxAmount!, method.currency))});
    case 'too_large':
      return t('payments.error.uploadTooLarge');
    case 'unsupported_type':
      return t('payments.error.uploadType');
  }
  return walletErrorText(e, t, fallback: fallback);
}
