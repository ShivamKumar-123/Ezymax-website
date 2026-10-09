// Manual payments (Wallet › Deposit › Bank / UPI, Crypto; lib/features/wallet/manual_api.dart and
// widgets/manual_*.dart): parsing of the methods and the requests, the "≈ X USDT" decimal maths (no float drift), the
// limits, the UPI QR link, the private images (loaded with the bearer), the screenshot upload, the error texts, the
// ledger kinds; widget tests on the sample-data API: the chooser only with manual methods, a bank request sent with
// the right JSON (and its idempotency key kept on a retry), the screenshot, crypto, the requests list with cancel and
// Show more. Texts are the exported English catalog's, so the tests read like the app.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:ezymex/core/api/api_providers.dart';
import 'package:ezymex/features/wallet/deposit_screen.dart';
import 'package:ezymex/features/wallet/manual_api.dart';
import 'package:ezymex/features/wallet/wallet_api.dart';
import 'package:ezymex/features/wallet/widgets/manual_form.dart';
import 'package:ezymex/i18n/t.dart';
import 'package:ezymex/preview/c1/preview_manual.dart';
import 'package:ezymex/preview/c1/preview_wallet.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/test_app.dart';

final T _t = T('en', null, (jsonDecode(File('assets/i18n/en.json').readAsStringSync()) as Map).cast<String, Object?>());

Map<String, dynamic> _bankJson({Map<String, dynamic> details = const {}, Object? qrUrl, Object? max = '200000'}) => {
  'id': 1,
  'kind': 'bank',
  'name': 'HDFC Bank · UPI',
  'status': 'active',
  'sort_order': 0,
  'currency': 'INR',
  'rate': '88',
  'min_amount': '500',
  'max_amount': max,
  'details': {'account_name': 'Ezymex Markets Pvt Ltd', 'account_number': '50200071234567', 'ifsc': 'HDFC0001234', 'upi_id': 'ezymex@hdfcbank', ...details},
  'evm': null,
  'qr_media_id': null,
  'qr_url': qrUrl,
  'instructions': '  Pay from your own account.  ',
  'updated_at': '2026-10-01T10:00:00Z',
};

ManualMethod _bank({Map<String, dynamic> details = const {}, Object? qrUrl, Object? max = '200000'}) =>
    ManualMethod.fromJson(_bankJson(details: details, qrUrl: qrUrl, max: max));

ManualMethod _crypto({String network = 'TRC20', String token = 'USDT', String rate = '1', String min = '20', String? memo}) => ManualMethod.fromJson({
  'id': 3,
  'kind': 'crypto',
  'name': 'USDT · $network',
  'status': 'active',
  'sort_order': 2,
  'currency': token,
  'rate': rate,
  'min_amount': min,
  'max_amount': null,
  'details': {'network': network, 'token': token, 'address': 'TXYZ7r8Lw3q2pHn9KbT1cV4mZs6UeJfRgA', 'memo': ?memo},
  'evm': null,
  'qr_media_id': null,
  'qr_url': null,
  'instructions': '',
  'updated_at': '2026-10-01T10:00:00Z',
});

/// Records the requests and answers with fixed bytes / JSON (the API client's transport).
class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final ResponseBody Function(RequestOptions o) respond;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(o);
    return respond(o);
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _client(_Adapter adapter) => ApiClient(
  baseUrl: 'https://app.ezymex.com/api/mobile',
  adapter: adapter,
  context: ApiContext(
    token: () => 't' * 43,
    deviceId: () async => 'device-1234567890abcdef',
    locale: () => 'en',
    appVersion: '1.0.0+1',
    userAgent: 'EzymexApp/1.0.0 (Android 15; Pixel 8)',
  ),
);

/// A screenshot picker that hands over fixed bytes.
class _FakePicker implements ManualProofPicker {
  _FakePicker(this.proof);
  ManualProof? proof;
  int picks = 0;

  @override
  Future<ManualProof?> pick() async {
    picks++;
    return proof;
  }
}

List<({String method, String path, Map<String, dynamic> body})> _writes(String path) => previewWalletCalls.where((c) => c.path == path).toList();

Future<void> _center(WidgetTester tester, Finder f) async {
  await tester.runAsync(() => Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await tester.pump(const Duration(milliseconds: 300));
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await _center(tester, f);
  await tester.tap(f.first);
  await settle(tester, frames: 6);
}

/// The text input inside a KTextField found by its key.
Finder _field(String key) => find.descendant(of: find.byKey(ValueKey(key)), matching: find.byType(TextField));

Future<void> _enter(WidgetTester tester, String key, String text) async {
  await _center(tester, _field(key));
  await tester.enterText(_field(key), text);
  await tester.pump();
}

Future<ProviderContainer> _open(WidgetTester tester, String location, {ManualProofPicker? picker}) async {
  final c = await pumpApp(tester, signedIn: true, overrides: [if (picker != null) manualProofPickerProvider.overrideWithValue(picker)]);
  c.read(routerProvider).go(location);
  await settle(tester);
  return c;
}

void main() {
  setUp(resetPreviewWallet);

  group('service shapes', () {
    test('methods: details, limits, QR, active methods of a kind in the broker\'s order', () {
      final list = ManualMethods.fromJson({
        'methods': [
          _bankJson(),
          {..._bankJson(details: {'upi_id': null}), 'id': 2, 'name': 'Second', 'sort_order': -1, 'max_amount': null},
          {..._bankJson(), 'id': 9, 'status': 'hidden'},
          {
            'id': 3,
            'kind': 'crypto',
            'name': 'Bitcoin',
            'currency': 'BTC',
            'rate': '0.0000158',
            'min_amount': '0.0005',
            'max_amount': null,
            'details': {'network': 'BTC', 'token': 'BTC', 'address': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'memo': ''},
            'evm': null,
            'qr_media_id': 'abcdefabcdefabcdefabcdef',
            'qr_url': '/api/wallet/manual/media/abcdefabcdefabcdefabcdef',
            'instructions': '',
          },
        ],
        'max_pending': 5,
      });
      expect(list.maxPending, 5);
      expect(list.any, isTrue);
      expect(list.of('bank').map((m) => m.id), [2, 1]);
      expect(list.of('crypto').single.name, 'Bitcoin');
      final b = list.byId(1)!;
      expect(b.bank, isTrue);
      expect(b.rate, '88');
      expect(b.minAmount, '500');
      expect(b.maxAmount, '200000');
      expect(b.details.upiId, 'ezymex@hdfcbank');
      expect(b.details.swift, isNull);
      expect(b.instructions, 'Pay from your own account.');
      expect(list.byId(2)!.maxAmount, isNull);
      expect(list.byId(2)!.details.upiId, isNull);
      final c = list.byId(3)!;
      expect(c.details.memo, isNull, reason: 'an empty memo is no memo');
      expect(c.token, 'BTC');
      expect(c.qrUrl, '/api/wallet/manual/media/abcdefabcdefabcdefabcdef');
      expect(ManualMethods.fromJson(const {}).any, isFalse);
    });

    test('requests: the method snapshot, credited or expected USDT, reason, the page counts', () {
      final page = ManualDepositsPage.fromJson({
        'items': [
          {
            'id': 1031,
            'method_id': 1,
            'kind': 'bank',
            'method': {'kind': 'bank', 'name': 'HDFC Bank · UPI', 'currency': 'INR', 'rate': '88', 'destination': '50200071234567', 'upi_id': 'ezymex@hdfcbank'},
            'currency': 'INR',
            'amount': '44000',
            'rate': '88',
            'expected_credit': '500',
            'credit_amount': '499.5',
            'reference': '412377712345',
            'proof_url': '/api/wallet/manual/media/0123456789abcdef01234567',
            'client_note': null,
            'status': 'approved',
            'reason': null,
            'decided_at': '2026-10-02T10:00:00Z',
            'created_at': '2026-10-02T08:00:00Z',
            'updated_at': '2026-10-02T10:00:00Z',
          },
          {
            'id': 1019,
            'method_id': 1,
            'kind': 'bank',
            'method': {'kind': 'bank', 'name': 'HDFC Bank · UPI', 'currency': 'INR', 'rate': '88'},
            'currency': 'INR',
            'amount': '8800',
            'rate': '88',
            'expected_credit': '100',
            'credit_amount': null,
            'reference': '412300012399',
            'proof_url': null,
            'client_note': 'From my HDFC account',
            'status': 'rejected',
            'reason': 'No payment with this UTR.',
            'decided_at': '2026-10-01T10:00:00Z',
            'created_at': '2026-10-01T08:00:00Z',
            'updated_at': '2026-10-01T10:00:00Z',
          },
        ],
        'page': 1,
        'limit': 10,
        'total': 12,
        'pending': 2,
        'max_pending': 5,
      });
      expect((page.page, page.limit, page.total, page.pending, page.maxPending), (1, 10, 12, 2, 5));
      final a = page.items.first;
      expect(a.method.name, 'HDFC Bank · UPI');
      expect(a.method.upiId, 'ezymex@hdfcbank');
      expect(a.credited, '499.5');
      expect(a.pending, isFalse);
      expect(manualMediaId(a.proofUrl), '0123456789abcdef01234567');
      expect(a.createdAt, DateTime.utc(2026, 10, 2, 8));
      final r = page.items.last;
      expect(r.status, 'rejected');
      expect(r.reason, 'No payment with this UTR.');
      expect(r.clientNote, 'From my HDFC account');
      expect(r.credited, '100');
      // missing counts fall back to the items
      final bare = ManualDepositsPage.fromJson({
        'items': [
          {'id': 1, 'status': 'pending', 'amount': '1', 'expected_credit': '1', 'created_at': '2026-10-01T08:00:00Z'},
        ],
      });
      expect((bare.total, bare.pending, bare.maxPending), (1, 1, 5));
    });

    test('the request body: trimmed, the screenshot and note only when given', () {
      expect(manualDepositBody(methodId: 1, amount: ' 5000 ', reference: ' 412398765099 ', note: '  '), {
        'method_id': 1,
        'amount': '5000',
        'reference': '412398765099',
      });
      expect(manualDepositBody(methodId: 3, amount: '20', reference: 'ab' * 32, proofMediaId: 'a' * 24, note: ' thanks '), {
        'method_id': 3,
        'amount': '20',
        'reference': 'ab' * 32,
        'proof_media_id': 'a' * 24,
        'note': 'thanks',
      });
    });
  });

  group('amounts (decimal strings, no float drift)', () {
    test('≈ USDT is amount / rate floored to 6 decimals, as the service computes it', () {
      expect(manualReceive('5000', '88'), '56.818181');
      expect(manualReceive('44000', '88'), '500.000000');
      expect(manualReceive('3670', '3.67'), '1000.000000');
      expect(manualReceive('0.01', '0.0000158'), '632.911392');
      // 0.3 / 0.1 is 2.9999999999999996 in floating point
      expect(manualReceive('0.3', '0.1'), '3.000000');
      expect(manualReceive('999999999999.999999', '1'), '999999999999.999999');
      expect(manualReceive('100', '3'), '33.333333');
      // the sample API's own rule agrees
      for (final (a, r) in [('5000', '88'), ('0.01', '0.0000158'), ('750', '1'), ('123.45', '83.27')]) {
        expect(decimalUnits(manualReceive(a, r)!, 6), decimalUnits(previewCreditOf(a, r), 6), reason: '$a / $r');
      }
      expect(manualReceive('', '88'), isNull);
      expect(manualReceive('0', '88'), isNull);
      expect(manualReceive('5', '0'), isNull);
      expect(manualReceive('abc', '88'), isNull);
    });

    test('display: grouping, 2 to 6 decimals cut (never rounded up), currencies as the web shows them', () {
      expect(decimalDisplay('56.818181'), '56.818181');
      expect(decimalDisplay('1000.000000'), '1,000.00');
      expect(decimalDisplay('1234567.5'), '1,234,567.50');
      expect(decimalDisplay('0.12345678'), '0.123456');
      expect(decimalDisplay('007'), '7.00');
      expect(decimalDisplay('0.0005', minDp: 0), '0.0005');
      expect(decimalDisplay(''), '—');
      expect(manualMoney('200000', 'INR'), '200,000.00 INR');
      expect(manualMoney('750', 'USDT'), '750.00 USDT');
      expect(manualMoney('0.0005', 'BTC'), '0.0005 BTC');
      expect(manualMoney('25000', 'BTC'), '25,000 BTC');
      expect(manualRateText('88'), '88.00');
      expect(manualRateText('3.67'), '3.67');
      expect(manualRateText('0.0000158'), '0.0000158');
      expect(manualRate('88', 'INR', _t), '1 USDT = 88.00 INR');
    });

    test('compare, limits and the amount check', () {
      expect(compareDecimal('500', '500.00'), 0);
      expect(compareDecimal('499.999999', '500'), -1);
      expect(compareDecimal('200000.000001', '200000'), 1);
      expect(compareDecimal('x', '1'), isNull);
      final m = _bank();
      expect(manualAmountIssue(m, ''), ManualAmountIssue.empty);
      expect(manualAmountIssue(m, '0'), ManualAmountIssue.invalid);
      expect(manualAmountIssue(m, '1.1234567'), ManualAmountIssue.invalid);
      expect(manualAmountIssue(m, '1234567890123'), ManualAmountIssue.invalid);
      expect(manualAmountIssue(m, '499.99'), ManualAmountIssue.belowMin);
      expect(manualAmountIssue(m, '500'), isNull);
      expect(manualAmountIssue(m, '200000'), isNull);
      expect(manualAmountIssue(m, '200000.01'), ManualAmountIssue.aboveMax);
      expect(manualAmountIssue(_bank(max: null), '99999999'), isNull);
      expect(manualLimits(m, _t), 'Min 500.00 INR · Max 200,000.00 INR');
      expect(manualLimits(_bank(max: null), _t), 'Min 500.00 INR');
      expect(manualReferenceOk(' 412 '), isFalse);
      expect(manualReferenceOk('4123'), isTrue);
      expect(manualReferenceOk('x' * 129), isFalse);
      // the amount field keeps 2 decimals for banks, 6 for crypto
      expect(cleanAmount('1,23456789', 6), '1.234567');
      expect(cleanAmount('1,23456789'), '1.23');
    });
  });

  group('QR codes and images', () {
    test('a UPI link for bank methods with a UPI ID, the address for crypto, nothing for a plain account', () {
      expect(manualQrData(_bank()), 'upi://pay?pa=ezymex@hdfcbank&pn=Ezymex%20Markets%20Pvt%20Ltd&cu=INR');
      expect(upiLink('shop@okaxis'), 'upi://pay?pa=shop@okaxis&cu=INR');
      expect(upiLink('a b@x', name: 'R&D Ltd'), 'upi://pay?pa=a%20b@x&pn=R%26D%20Ltd&cu=INR');
      expect(manualQrData(_bank(details: {'upi_id': null})), isNull);
      expect(manualHasQr(_bank(details: {'upi_id': null})), isFalse);
      expect(manualHasQr(_bank(details: {'upi_id': null}, qrUrl: '/api/wallet/manual/media/${'a' * 24}')), isTrue);
      expect(manualQrData(_crypto()), 'TXYZ7r8Lw3q2pHn9KbT1cV4mZs6UeJfRgA');
      expect(manualMediaId('/api/wallet/manual/media/${'0a' * 12}'), '0a' * 12);
      expect(manualMediaId('/api/wallet/manual/media/${'0a' * 12}?v=2'), '0a' * 12);
      expect(manualMediaId('/api/wallet/manual/media/xyz'), isNull);
      expect(manualMediaId(null), isNull);
    });

    test('a private image loads from /api/mobile/wallet/manual/media/<id> with the bearer', () async {
      final png = previewManualPng;
      final adapter = _Adapter((o) => ResponseBody.fromBytes(png, 200, headers: {'content-type': ['image/png']}));
      final c = ProviderContainer(overrides: [apiProvider.overrideWithValue(_client(adapter))]);
      addTearDown(c.dispose);
      final id = manualMediaId('/api/wallet/manual/media/${'ab' * 12}')!;
      final sub = c.listen(manualMediaProvider(id), (_, _) {});
      addTearDown(sub.close);
      final bytes = await c.read(manualMediaProvider(id).future);
      expect(bytes, png);
      final o = adapter.requests.single;
      expect(o.method, 'GET');
      expect(o.uri.toString(), 'https://app.ezymex.com/api/mobile/wallet/manual/media/${'ab' * 12}');
      expect(o.headers['Authorization'], 'Bearer ${'t' * 43}');
    });

    test('the screenshot: type sniffed from the bytes, 5 MB at most, uploaded as multipart `file`', () async {
      final png = previewManualPng;
      expect(sniffImageType(png), 'image/png');
      expect(sniffImageType(Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0])), 'image/jpeg');
      expect(sniffImageType(Uint8List.fromList([...'RIFF'.codeUnits, 0, 0, 0, 0, ...'WEBP'.codeUnits])), 'image/webp');
      expect(sniffImageType(Uint8List.fromList('GIF89a'.codeUnits)), isNull);
      expect(manualProofIssue(ManualProof(bytes: png, name: 'a.png', mime: 'image/png'), _t), isNull);
      expect(manualProofIssue(ManualProof(bytes: Uint8List(kManualProofMaxBytes + 1), name: 'a.png', mime: 'image/png'), _t), 'The image is larger than 5 MB.');
      expect(manualProofIssue(ManualProof(bytes: png, name: 'a.gif', mime: 'image/gif'), _t), 'Upload a PNG, JPG or WEBP image.');

      final adapter = _Adapter(
        (o) => ResponseBody.fromString(
          jsonEncode({
            'media': {'id': 'c' * 24, 'url': '/api/wallet/manual/media/${'c' * 24}', 'mime': 'image/png', 'size': png.length},
          }),
          200,
          headers: {
            'content-type': ['application/json'],
          },
        ),
      );
      final media = await uploadManualProof(_client(adapter), ManualProof(bytes: png, name: 'utr.png', mime: 'image/png'));
      expect(media.id, 'c' * 24);
      expect(media.size, png.length);
      final o = adapter.requests.single;
      expect(o.method, 'POST');
      expect(o.uri.path, '/api/mobile/wallet/manual/proofs');
      expect(o.headers['Authorization'], 'Bearer ${'t' * 43}');
      final form = o.data as FormData;
      expect(form.files.single.key, 'file');
      expect(form.files.single.value.filename, 'utr.png');
      expect(form.files.single.value.contentType.toString(), 'image/png');
      expect(form.files.single.value.length, png.length);
    });
  });

  group('error texts and labels', () {
    ApiException e(String code, [int status = 422, Map<String, dynamic>? data]) => ApiException(status: status, code: code, message: 'Server says $code.', data: data);

    test('codes map to the payments texts, with the method\'s limits and the pending cap', () {
      final m = _bank();
      expect(manualErrorText(e('reference_used', 409), _t, method: m), 'A request with this reference was already sent.');
      expect(manualErrorText(e('too_many_pending', 429), _t, method: m, maxPending: 4), "You already have 4 requests waiting for review. Please wait until they're checked.");
      expect(manualErrorText(e('too_many_pending', 429, {'max_pending': 3}), _t), "You already have 3 requests waiting for review. Please wait until they're checked.");
      expect(manualErrorText(e('method_unavailable'), _t), 'This payment method is no longer available. Choose another one.');
      expect(manualErrorText(e('restricted', 403), _t), 'Deposits are disabled on your account. Contact support.');
      expect(manualErrorText(e('below_minimum'), _t, method: m), 'The minimum for this method is 500.00 INR.');
      expect(manualErrorText(e('above_maximum'), _t, method: m), 'The maximum for this method is 200,000.00 INR.');
      // without the method (or without a maximum) the server's own words
      expect(manualErrorText(e('below_minimum'), _t), 'Server says below_minimum.');
      expect(manualErrorText(e('above_maximum'), _t, method: _bank(max: null)), 'Server says above_maximum.');
      expect(manualErrorText(e('too_large', 413), _t), 'The image is larger than 5 MB.');
      expect(manualErrorText(e('unsupported_type', 415), _t), 'Upload a PNG, JPG or WEBP image.');
      expect(manualErrorText(e('validation'), _t), 'Server says validation.');
      expect(manualErrorText(ApiException.network, _t), 'Network error. Check your connection and try again.');
      expect(manualErrorText(StateError('x'), _t), 'Your request couldn\'t be sent. Try again.');
      expect(manualErrorText(StateError('x'), _t, fallback: _t('payments.error.uploadFailed')), "The screenshot couldn't be uploaded. Try again.");
    });

    test('status chips and the ledger kinds of approved requests', () {
      expect(kManualStatus['pending'], (tone: KChipTone.warn, label: 'payments.status.pending'));
      expect(kManualStatus['approved']!.tone, KChipTone.up);
      expect(kManualStatus['rejected']!.tone, KChipTone.down);
      expect(kManualStatus['cancelled']!.tone, KChipTone.neutral);
      ActivityItem row(String kind) => ActivityItem.fromJson({'id': 'm1', 'type': 'other', 'kind': kind, 'direction': 'in', 'created_at': '2026-10-01T10:00:00Z'});
      expect(activityTitle(row('bank_deposit'), _t), 'Bank deposit');
      expect(activityTitle(row('crypto_deposit'), _t), 'Crypto deposit');
    });
  });

  group('deposit page', () {
    testWidgets('with manual methods: the chooser, "Deposit" header, USDT · automatic first', (tester) async {
      await _open(tester, '/wallet/deposit');
      expect(find.byType(DepositScreen), findsOneWidget);
      expect(find.text('Deposit'), findsWidgets);
      expect(find.text('HOW DO YOU WANT TO PAY?'), findsOneWidget);
      for (final v in ['usdt', 'bank', 'crypto']) {
        expect(find.byKey(ValueKey('deposit-via-$v')), findsOneWidget, reason: v);
      }
      expect(find.text('USDT · automatic'), findsOneWidget);
      // the automatic deposit is the default, as before
      expect(find.text('New deposit'), findsOneWidget);
      final page = find.descendant(of: find.byType(DepositScreen), matching: find.byType(Scrollable)).first;
      await tester.scrollUntilVisible(find.text('How deposits work'), 300, scrollable: page);
      expect(find.text('How deposits work'), findsOneWidget);
      expect(find.text('Deposit requests'), findsNothing);
      expect(find.text('How bank and crypto deposits work'), findsNothing);
      await unmount(tester);
    });

    testWidgets('without manual methods the page stays the USDT deposit (no chooser, no requests)', (tester) async {
      previewManualMethods.clear();
      await _open(tester, '/wallet/deposit');
      expect(find.text('HOW DO YOU WANT TO PAY?'), findsNothing);
      expect(find.byKey(const ValueKey('deposit-via-bank')), findsNothing);
      expect(find.text('Deposit USDT'), findsOneWidget);
      expect(find.text('New deposit'), findsOneWidget);
      final page = find.descendant(of: find.byType(DepositScreen), matching: find.byType(Scrollable)).first;
      await tester.scrollUntilVisible(find.text('How deposits work'), 300, scrollable: page);
      expect(find.text('How deposits work'), findsOneWidget);
      expect(previewWalletReads.where((r) => r.startsWith('wallet/manual/deposits')), isEmpty);
      await unmount(tester);
    });

    testWidgets('only bank methods: Bank / UPI next to USDT, no Crypto', (tester) async {
      previewManualMethods.removeWhere((m) => m['kind'] == 'crypto');
      await _open(tester, '/wallet/deposit');
      expect(find.byKey(const ValueKey('deposit-via-usdt')), findsOneWidget);
      expect(find.byKey(const ValueKey('deposit-via-bank')), findsOneWidget);
      expect(find.byKey(const ValueKey('deposit-via-crypto')), findsNothing);
      await unmount(tester);
    });

    testWidgets('resuming a deposit (?intent=…) shows the USDT tracker without the chooser', (tester) async {
      await _open(tester, '/wallet/deposit?via=bank&intent=dep_4c1d9e2f7a8b6c5d3e2f1a0b');
      expect(find.text('HOW DO YOU WANT TO PAY?'), findsNothing);
      expect(find.text('Deposit on its way'), findsOneWidget);
      expect(find.text('Send your deposit request'), findsNothing);
      await unmount(tester);
    });

    testWidgets('bank: details with copy + UPI QR, ≈ USDT, the request JSON, sent, see my requests', (tester) async {
      await _open(tester, '/wallet/deposit');
      await _tap(tester, find.byKey(const ValueKey('deposit-via-bank')));
      // two bank methods: the picker, HDFC first
      expect(find.text('CHOOSE AN ACCOUNT'), findsOneWidget);
      expect(find.byKey(const ValueKey('manual-method-1')), findsOneWidget);
      expect(find.byKey(const ValueKey('manual-method-2')), findsOneWidget);
      expect(find.text('INR · Min 500.00 INR · Max 200,000.00 INR'), findsOneWidget);
      expect(find.text('Pay to this account'), findsOneWidget);
      expect(find.text('50200071234567'), findsOneWidget);
      expect(find.text('HDFC0001234'), findsOneWidget);
      expect(find.text('ezymex@hdfcbank'), findsOneWidget);
      expect(find.text('1 USDT = 88.00 INR'), findsOneWidget);
      expect(find.text('Scan with any UPI app'), findsOneWidget);
      final qr = tester.widget<KQrCode>(find.byType(KQrCode));
      expect(qr.data, 'upi://pay?pa=ezymex@hdfcbank&pn=Ezymex%20Markets%20Pvt%20Ltd&cu=INR');
      expect(find.text('Pay from a bank account or UPI app in your own name. Third-party payments are returned.'), findsOneWidget);
      // copy the UPI ID
      final copy = find.byWidgetPredicate((w) => w is KIconButton && w.semanticLabel == 'Copy UPI ID');
      await _tap(tester, copy);
      expect(find.text('Copied to clipboard'), findsWidgets);
      // the form: ≈ USDT at 88 INR per USDT
      expect(find.text("You'll receive ≈ 0.00 USDT"), findsOneWidget);
      await _enter(tester, 'manual-amount', '5000');
      expect(find.text("You'll receive ≈ 56.818181 USDT"), findsOneWidget);
      expect(find.text('At 1 USDT = 88.00 INR. The final amount is confirmed by the broker.'), findsOneWidget);
      await _enter(tester, 'manual-reference', ' 412398765099 ');
      await _enter(tester, 'manual-note', 'From my own account');
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      final sent = _writes('wallet/manual/deposits');
      expect(sent, hasLength(1));
      final body = Map.of(sent.single.body);
      expect(body.remove('idempotency_key'), matches(RegExp(r'^[0-9a-f]{24}$')));
      expect(body, {'method_id': 1, 'amount': '5000', 'reference': '412398765099', 'note': 'From my own account'});
      // sent: the request waits for the broker
      expect(find.text('Request sent'), findsOneWidget);
      expect(find.text('5,000.00 INR · ≈ 56.818181 USDT'), findsOneWidget);
      await _tap(tester, find.text('See my requests'));
      expect(find.text('Deposit requests'), findsOneWidget);
      expect(find.text('3 of 5 waiting for review'), findsOneWidget);
      final first = find.byKey(const ValueKey('manual-request-2000'));
      expect(first, findsOneWidget);
      expect(find.descendant(of: first, matching: find.text('Waiting for review')), findsOneWidget);
      expect(find.descendant(of: first, matching: find.text('≈ 56.818181 USDT')), findsOneWidget);
      // another request starts empty
      await _tap(tester, find.text('Send another request'));
      expect(find.text('Send your deposit request'), findsOneWidget);
      expect(tester.widget<TextField>(_field('manual-amount')).controller!.text, isEmpty);
      await unmount(tester);
    });

    testWidgets('the broker\'s uploaded QR image is shown (loaded with the session) instead of a generated one', (tester) async {
      final id = 'f' * 24;
      previewManualMethods.first
        ..['qr_media_id'] = id
        ..['qr_url'] = '/api/wallet/manual/media/$id';
      await _open(tester, '/wallet/deposit?via=bank');
      expect(previewWalletReads, contains('wallet/manual/media/$id'));
      expect(find.byKey(const ValueKey('manual-qr-image')), findsOneWidget);
      expect(find.byType(KQrCode), findsNothing);
      // an uploaded QR of a bank method reads "Scan to pay"
      expect(find.text('Scan to pay'), findsOneWidget);
      // a bank account without UPI and without a QR shows none
      await _tap(tester, find.byKey(const ValueKey('manual-method-2')));
      expect(find.byKey(const ValueKey('manual-qr-image')), findsNothing);
      expect(find.byType(KQrCode), findsNothing);
      expect(find.text('AE070260001015498765401'), findsOneWidget);
      expect(find.text('EBILAEAD'), findsOneWidget);
      await unmount(tester);
    });

    testWidgets('form checks: invalid, below the minimum, a short reference; nothing is sent', (tester) async {
      await _open(tester, '/wallet/deposit?via=bank');
      expect(find.text('Send your deposit request'), findsOneWidget);
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      expect(find.text('Enter the amount you paid'), findsWidgets);
      await _enter(tester, 'manual-amount', '100');
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      expect(find.text('The minimum is 500.00 INR'), findsWidgets);
      await _enter(tester, 'manual-amount', '250000');
      expect(find.text('The maximum is 200,000.00 INR'), findsOneWidget);
      await _enter(tester, 'manual-amount', '1000');
      expect(find.text('The maximum is 200,000.00 INR'), findsNothing);
      await _enter(tester, 'manual-reference', '412');
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      expect(find.text('Enter the reference of your payment'), findsOneWidget);
      expect(_writes('wallet/manual/deposits'), isEmpty);
      await unmount(tester);
    });

    testWidgets('a refused request shows the payments text; a retry keeps its key, a change gets a new one', (tester) async {
      await _open(tester, '/wallet/deposit?via=bank');
      await _enter(tester, 'manual-amount', '25000');
      // the UTR of a request already waiting (1042)
      await _enter(tester, 'manual-reference', '412398765012');
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      expect(find.text('A request with this reference was already sent.'), findsOneWidget);
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      final tries = _writes('wallet/manual/deposits');
      expect(tries, hasLength(2));
      expect(tries[1].body['idempotency_key'], tries[0].body['idempotency_key']);
      await _enter(tester, 'manual-reference', '412398765013');
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      final all = _writes('wallet/manual/deposits');
      expect(all, hasLength(3));
      expect(all[2].body['idempotency_key'], isNot(all[0].body['idempotency_key']));
      expect(find.text('Request sent'), findsOneWidget);
      await unmount(tester);
    });

    testWidgets('screenshot: picked, uploaded at once, sent as proof_media_id; too large is refused; remove', (tester) async {
      final picker = _FakePicker(ManualProof(bytes: previewManualPng, name: 'utr.png', mime: 'image/png'));
      await _open(tester, '/wallet/deposit?via=bank', picker: picker);
      await _tap(tester, find.byKey(const ValueKey('manual-proof-choose')));
      expect(picker.picks, 1);
      expect(_writes('wallet/manual/proofs'), hasLength(1));
      expect(find.byKey(const ValueKey('manual-proof')), findsOneWidget);
      expect(find.text('utr.png'), findsOneWidget);
      // remove, then a file over 5 MB
      await _tap(tester, find.byWidgetPredicate((w) => w is KIconButton && w.semanticLabel == 'Remove screenshot'));
      expect(find.byKey(const ValueKey('manual-proof')), findsNothing);
      picker.proof = ManualProof(bytes: Uint8List(kManualProofMaxBytes + 1), name: 'big.png', mime: 'image/png');
      await _tap(tester, find.byKey(const ValueKey('manual-proof-choose')));
      expect(find.text('The image is larger than 5 MB.'), findsOneWidget);
      expect(_writes('wallet/manual/proofs'), hasLength(1));
      // a good one again, then the request
      picker.proof = ManualProof(bytes: previewManualPng, name: 'utr.png', mime: 'image/png');
      await _tap(tester, find.byKey(const ValueKey('manual-proof-choose')));
      expect(_writes('wallet/manual/proofs'), hasLength(2));
      await _enter(tester, 'manual-amount', '880');
      await _enter(tester, 'manual-reference', '412398765100');
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      final body = _writes('wallet/manual/deposits').single.body;
      expect(body['proof_media_id'], matches(RegExp(r'^[0-9a-f]{24}$')));
      expect(find.text('Request sent'), findsOneWidget);
      // the new request links its screenshot, loaded with the session into a sheet
      final row = find.byKey(const ValueKey('manual-request-2000'));
      await _tap(tester, find.descendant(of: row, matching: find.text('Screenshot')));
      expect(previewWalletReads, contains('wallet/manual/media/${body['proof_media_id']}'));
      expect(find.bySemanticsLabel('Screenshot'), findsWidgets);
      await unmount(tester);
    });

    testWidgets('crypto: networks, address + QR, warnings, ≈ USDT of a BTC amount', (tester) async {
      await _open(tester, '/wallet/deposit');
      await _tap(tester, find.byKey(const ValueKey('deposit-via-crypto')));
      expect(find.text('CHOOSE A NETWORK'), findsOneWidget);
      expect(find.text('Send to this address'), findsOneWidget);
      expect(find.text('TXYZ7r8Lw3q2pHn9KbT1cV4mZs6UeJfRgA'), findsOneWidget);
      expect(tester.widget<KQrCode>(find.byType(KQrCode)).data, 'TXYZ7r8Lw3q2pHn9KbT1cV4mZs6UeJfRgA');
      expect(find.text('Scan with your wallet app'), findsOneWidget);
      expect(find.text('Send only USDT on the TRC20 network to this address. Other tokens or networks can be lost.'), findsOneWidget);
      expect(find.text('Transaction hash / ID'), findsOneWidget);
      // Bitcoin
      await _tap(tester, find.byKey(const ValueKey('manual-method-5')));
      expect(find.text('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'), findsOneWidget);
      expect(find.text('1 USDT = 0.0000158 BTC'), findsOneWidget);
      expect(find.text('Min 0.0005 BTC'), findsOneWidget);
      await _enter(tester, 'manual-amount', '0.01');
      expect(find.text("You'll receive ≈ 632.911392 USDT"), findsOneWidget);
      await _enter(tester, 'manual-reference', 'ab' * 32);
      await _tap(tester, find.byKey(ManualRequestForm.submitKey));
      final body = _writes('wallet/manual/deposits').single.body;
      expect(body['method_id'], 5);
      expect(body['amount'], '0.01');
      expect(body['reference'], 'ab' * 32);
      await unmount(tester);
    });

    testWidgets('requests: statuses, credited / reason, cancel with a confirmation, Show more', (tester) async {
      // 12 requests: Show more brings the last two
      for (var i = 0; i < 6; i++) {
        previewManualDeposits.add({
          ...previewManualDeposits.last,
          'id': 900 - i,
          'reference': 'OLD${1000 + i}',
          'created_at': DateTime.now().subtract(Duration(days: 40 + i)).toUtc().toIso8601String(),
        });
      }
      await _open(tester, '/wallet/deposit?via=bank');
      final page = find.descendant(of: find.byType(DepositScreen), matching: find.byType(Scrollable)).first;
      await tester.scrollUntilVisible(find.text('Deposit requests'), 300, scrollable: page);
      expect(find.text('2 of 5 waiting for review'), findsOneWidget);
      final approved = find.byKey(const ValueKey('manual-request-1031'));
      await tester.scrollUntilVisible(approved, 200, scrollable: page);
      expect(find.descendant(of: approved, matching: find.text('Credited 500.00 USDT')), findsOneWidget);
      expect(find.descendant(of: approved, matching: find.text('Credited')), findsOneWidget);
      final rejected = find.byKey(const ValueKey('manual-request-1019'));
      await tester.scrollUntilVisible(rejected, 200, scrollable: page);
      expect(find.descendant(of: rejected, matching: find.text('Reason: No payment with this UTR reached our account. Check the UTR and send a new request.')), findsOneWidget);
      // cancel 1042 (waiting): asked first, kept on "Keep it"
      final row = find.byKey(const ValueKey('manual-request-1042'));
      await tester.scrollUntilVisible(row, -200, scrollable: page);
      await _tap(tester, find.descendant(of: row, matching: find.text('Cancel request')));
      expect(find.descendant(of: row, matching: find.text('Cancel this request?')), findsOneWidget);
      await _tap(tester, find.descendant(of: row, matching: find.text('Keep it')));
      expect(_writes('wallet/manual/deposits/1042/cancel'), isEmpty);
      await _tap(tester, find.descendant(of: row, matching: find.text('Cancel request')));
      await _tap(tester, find.descendant(of: row, matching: find.text('Yes, cancel')));
      expect(_writes('wallet/manual/deposits/1042/cancel'), hasLength(1));
      expect(find.text('Request cancelled'), findsWidgets);
      await settle(tester);
      expect(find.descendant(of: row, matching: find.text('Cancelled')), findsOneWidget);
      expect(find.text('1 of 5 waiting for review'), findsOneWidget);
      // 10 shown of 12
      expect(find.byKey(const ValueKey('manual-request-895'), skipOffstage: false), findsNothing);
      final more = find.text('Show more');
      await tester.scrollUntilVisible(more, 300, scrollable: page);
      await _tap(tester, more);
      await settle(tester);
      expect(find.byKey(const ValueKey('manual-request-895'), skipOffstage: false), findsOneWidget);
      expect(find.text('Show more'), findsNothing);
      expect(previewWalletReads.where((r) => r == 'wallet/manual/deposits'), isNotEmpty);
      await unmount(tester);
    });

    testWidgets('requests are polled every 20 s while shown', (tester) async {
      await _open(tester, '/wallet/deposit?via=crypto');
      int reads() => previewWalletReads.where((r) => r == 'wallet/manual/deposits').length;
      final n = reads();
      expect(n, greaterThan(0));
      var waited = Duration.zero;
      while (reads() == n && waited < const Duration(seconds: 30)) {
        await tester.pump(const Duration(milliseconds: 500));
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 2)));
        waited += const Duration(milliseconds: 500);
      }
      expect(reads(), n + 1);
      // (the first read happened while the page settled, a couple of seconds earlier)
      expect(waited.inMilliseconds, inInclusiveRange(15000, 20500));
      await unmount(tester);
    });
  });

  test('the sample API: a hidden method is refused and gone from the list; approved requests are wallet history', () {
    previewManualMethods.firstWhere((m) => m['id'] == 2)['status'] = 'hidden';
    final (status, body) = previewWallet('POST', 'wallet/manual/deposits', {
      'method_id': 2,
      'amount': '500',
      'reference': 'FT26261XK0QA',
      'idempotency_key': 'abcdef123456',
    }, const {})!;
    expect(status, 422);
    final err = ApiException.fromResponse(status, body);
    expect(err.code, 'method_unavailable');
    expect(manualErrorText(err, _t), 'This payment method is no longer available. Choose another one.');
    final (_, methods) = previewWallet('GET', 'wallet/manual/methods', const {}, const {})!;
    expect(ManualMethods.fromJson(methods as Map<String, dynamic>).of('bank').map((m) => m.id), [1]);
    // the approved requests are wallet history rows
    final (_, activity) = previewWallet('GET', 'wallet/activity', const {}, const {'type': 'deposit', 'limit': '200'})!;
    final kinds = [for (final r in ((activity as Map)['items'] as List).cast<Map<String, dynamic>>()) r['kind']];
    expect(kinds, containsAll(['bank_deposit', 'crypto_deposit']));
  });
}
