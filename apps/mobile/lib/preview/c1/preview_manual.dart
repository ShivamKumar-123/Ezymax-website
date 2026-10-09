// Sample answers for manual payments (Wallet › Deposit › Bank / UPI, Crypto; development previews, the in-app demo
// and widget tests only). The broker's methods and the client's requests are the Client Area demo's
// (packages/mock/src/manual-payments.ts), in the wallet service's shapes (services/wallet README "Manual payments");
// decided requests are older here, so the wallet's recent activity stays the sample's. Requests can be sent (with
// the service's checks: limits, a used reference, 5 waiting at most, the idempotency key) and cancelled; a
// screenshot upload answers a media id whose image is a small PNG. Writes are logged by preview_wallet.dart.
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

String _iso(DateTime t) => t.toUtc().toIso8601String();
DateTime _ago(double hours) => DateTime.now().subtract(Duration(minutes: (hours * 60).round()));

Map<String, dynamic> _err(String code, String message, [String? field]) => {
  'error': {'code': code, 'message': message, 'field': ?field},
};

/// A 1×1 PNG: the sample image of a QR code or a screenshot.
final Uint8List previewManualPng = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

/// The broker's payment methods (all active).
List<Map<String, dynamic>> _methods() => [
  {
    'id': 1,
    'kind': 'bank',
    'name': 'HDFC Bank · UPI',
    'status': 'active',
    'sort_order': 0,
    'currency': 'INR',
    'rate': '88',
    'min_amount': '500',
    'max_amount': '200000',
    'details': {
      'account_name': 'Ezymex Markets Pvt Ltd',
      'bank_name': 'HDFC Bank',
      'account_number': '50200071234567',
      'ifsc': 'HDFC0001234',
      'branch': 'Bandra Kurla Complex, Mumbai',
      'upi_id': 'ezymex@hdfcbank',
    },
    'evm': null,
    'qr_media_id': null,
    'qr_url': null,
    'instructions': 'Pay from a bank account or UPI app in your own name. Third-party payments are returned.',
    'updated_at': _iso(_ago(72)),
  },
  {
    'id': 2,
    'kind': 'bank',
    'name': 'Emirates NBD · AED transfer',
    'status': 'active',
    'sort_order': 1,
    'currency': 'AED',
    'rate': '3.67',
    'min_amount': '100',
    'max_amount': null,
    'details': {
      'account_name': 'Ezymex Markets FZE',
      'bank_name': 'Emirates NBD',
      'account_number': '1015 4987 6543 01',
      'iban': 'AE070260001015498765401',
      'swift': 'EBILAEAD',
      'branch': 'Business Bay, Dubai',
    },
    'evm': null,
    'qr_media_id': null,
    'qr_url': null,
    'instructions': 'Use your client number as the payment reference.',
    'updated_at': _iso(_ago(120)),
  },
  {
    'id': 3,
    'kind': 'crypto',
    'name': 'USDT · TRC20',
    'status': 'active',
    'sort_order': 2,
    'currency': 'USDT',
    'rate': '1',
    'min_amount': '20',
    'max_amount': null,
    'details': {'network': 'TRC20', 'token': 'USDT', 'address': 'TXYZ7r8Lw3q2pHn9KbT1cV4mZs6UeJfRgA'},
    'evm': null,
    'qr_media_id': null,
    'qr_url': null,
    'instructions': '',
    'updated_at': _iso(_ago(96)),
  },
  {
    'id': 4,
    'kind': 'crypto',
    'name': 'USDT · BEP20',
    'status': 'active',
    'sort_order': 3,
    'currency': 'USDT',
    'rate': '1',
    'min_amount': '10',
    'max_amount': '100000',
    'details': {'network': 'BEP20', 'token': 'USDT', 'address': '0x8F3a6c2B1d9E4f7A0b5C3e6D2a1F9c8B7e4D3a21'},
    'evm': {'chain_id': 56, 'token_contract': '0x55d398326f99059fF775485246999027B3197955', 'token_decimals': 18},
    'qr_media_id': null,
    'qr_url': null,
    'instructions': '',
    'updated_at': _iso(_ago(30)),
  },
  {
    'id': 5,
    'kind': 'crypto',
    'name': 'Bitcoin',
    'status': 'active',
    'sort_order': 4,
    'currency': 'BTC',
    'rate': '0.0000158',
    'min_amount': '0.0005',
    'max_amount': null,
    'details': {'network': 'BTC', 'token': 'BTC', 'address': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'},
    'evm': null,
    'qr_media_id': null,
    'qr_url': null,
    'instructions': 'Credited after 2 network confirmations and the broker\'s check.',
    'updated_at': _iso(_ago(200)),
  },
];

/// amount / rate floored to 6 decimals (decimal strings, no floating point), as the service computes expected_credit.
String previewCreditOf(String amount, String rate) {
  ({BigInt n, int d}) parts(String v) {
    final p = v.trim().split('.');
    final f = p.length > 1 ? p[1] : '';
    return (n: BigInt.parse('${p[0]}$f'), d: f.length);
  }

  final a = parts(amount), r = parts(rate);
  if (r.n == BigInt.zero) return '0';
  final units = (a.n * BigInt.from(10).pow(r.d) * BigInt.from(1000000)) ~/ (r.n * BigInt.from(10).pow(a.d));
  final s = units.toString().padLeft(7, '0');
  final out = '${s.substring(0, s.length - 6)}.${s.substring(s.length - 6)}'.replaceFirst(RegExp(r'\.?0+$'), '');
  return out.isEmpty ? '0' : out;
}

/// The method as a request keeps it.
Map<String, dynamic> _snap(Map<String, dynamic> m) {
  final d = (m['details'] as Map).cast<String, dynamic>();
  final base = {'kind': m['kind'], 'name': m['name'], 'currency': m['currency'], 'rate': m['rate']};
  if (m['kind'] == 'crypto') return {...base, 'network': d['network'], 'token': d['token'], 'destination': d['address']};
  return {
    ...base,
    'bank_name': d['bank_name'] ?? '',
    'account_name': d['account_name'] ?? '',
    'account_number': ?d['account_number'],
    'ifsc': ?d['ifsc'],
    'upi_id': ?d['upi_id'],
    'destination': d['account_number'] ?? d['upi_id'] ?? '',
  };
}

class _ManualState {
  _ManualState() {
    Map<String, dynamic> req(int id, int methodId, String amount, String reference, String status, double hours, {String? reason}) {
      final m = methods.firstWhere((x) => x['id'] == methodId);
      final expected = previewCreditOf(amount, '${m['rate']}');
      return {
        'id': id,
        'method_id': methodId,
        'kind': m['kind'],
        'method': _snap(m),
        'currency': m['currency'],
        'amount': amount,
        'rate': m['rate'],
        'expected_credit': expected,
        'credit_amount': status == 'approved' ? expected : null,
        'reference': reference,
        'proof_url': null,
        'client_note': null,
        'status': status,
        'reason': reason,
        'decided_at': status == 'pending' ? null : _iso(_ago(hours - 2)),
        'created_at': _iso(_ago(hours)),
        'updated_at': _iso(_ago(status == 'pending' ? hours : hours - 2)),
      };
    }

    deposits.addAll([
      req(1042, 1, '25000', '412398765012', 'pending', 1.5),
      req(1039, 4, '750', '0x6c1f0b2e9d4a7c3b8e5f1a2d4c6b8e0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b', 'pending', 5),
      req(1031, 1, '44000', '412377712345', 'approved', 312),
      req(1027, 3, '1200', '9f4e2c7a1b3d5f7e9a0c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d0f2a4c6e8b0d1f', 'approved', 408),
      req(1019, 1, '8800', '412300012399', 'rejected', 504, reason: 'No payment with this UTR reached our account. Check the UTR and send a new request.'),
      req(1012, 2, '3670', 'FT26261XK0QZ', 'cancelled', 624),
    ]);
  }

  final List<Map<String, dynamic>> methods = _methods();

  /// Newest first.
  final List<Map<String, dynamic>> deposits = [];
  final Map<String, Map<String, dynamic>> byKey = {};
  int nextId = 2000;
  int nextMedia = 1;
}

_ManualState _m = _ManualState();

/// Back to the starting sample (preview_wallet.dart's reset calls it).
void resetPreviewManual() => _m = _ManualState();

/// The broker's methods as the sample serves them (tests may change them: hide one, add a QR image …).
List<Map<String, dynamic>> get previewManualMethods => _m.methods;

/// The client's requests, newest first (tests may change them).
List<Map<String, dynamic>> get previewManualDeposits => _m.deposits;

/// Approved requests as wallet activity rows (ledger kinds bank_deposit / crypto_deposit, "other" rows).
List<Map<String, dynamic>> previewManualActivity() => [
  for (final d in _m.deposits)
    if (d['status'] == 'approved')
      {
        'type': 'other',
        'id': 'm${d['id']}',
        'status': 'completed',
        'amount': d['credit_amount'] ?? d['expected_credit'],
        'currency': 'USDT',
        'direction': 'in',
        'kind': d['kind'] == 'crypto' ? 'crypto_deposit' : 'bank_deposit',
        'note': '${(d['method'] as Map)['name']} · ${d['amount']} ${d['currency']}',
        'created_at': d['decided_at'],
        'updated_at': d['decided_at'],
      },
];

String _normalRef(String kind, String r) => kind == 'bank' ? r.replaceAll(RegExp(r'\s+'), '').toLowerCase() : r.trim().toLowerCase().replaceFirst(RegExp(r'^0x'), '');

int _cmp(String a, String b) {
  final da = a.contains('.') ? a.split('.')[1].length : 0, db = b.contains('.') ? b.split('.')[1].length : 0;
  final d = math.max(da, db);
  BigInt units(String v, int dv) => BigInt.parse(v.replaceAll('.', '')) * BigInt.from(10).pow(d - dv);
  return units(a, da).compareTo(units(b, db));
}

/// `wallet/manual/…` (route without the `wallet/` prefix), or null for other routes.
(int, Object)? previewManual(String method, String route, Map<String, dynamic> body, Map<String, String> query) {
  if (!route.startsWith('manual/')) return null;
  final r = route.substring('manual/'.length);
  if (method == 'GET') {
    if (r == 'methods') {
      return (
        200,
        {
          'methods': [
            for (final m in _m.methods)
              if (m['status'] == 'active') m,
          ],
          'max_pending': 5,
        },
      );
    }
    if (r == 'deposits') {
      final limit = (int.tryParse(query['limit'] ?? '') ?? 20).clamp(1, 100);
      final page = math.max(1, int.tryParse(query['page'] ?? '') ?? 1);
      final all = _m.deposits;
      final from = math.min((page - 1) * limit, all.length);
      return (
        200,
        {
          'items': all.sublist(from, math.min(from + limit, all.length)),
          'page': page,
          'limit': limit,
          'total': all.length,
          'pending': all.where((d) => d['status'] == 'pending').length,
          'max_pending': 5,
        },
      );
    }
    final one = RegExp(r'^deposits/(\d+)$').firstMatch(r);
    if (one != null) {
      final d = _m.deposits.where((x) => '${x['id']}' == one.group(1)).firstOrNull;
      return d == null ? (404, _err('not_found', 'Not found.')) : (200, {'deposit': d});
    }
    if (RegExp(r'^media/[0-9a-f]{24}$').hasMatch(r)) return (200, previewManualPng);
    return (404, _err('not_found', 'Not found.'));
  }

  // writes
  if (r == 'proofs') {
    // multipart: the sample adapter passes no fields, any upload is accepted
    final id = (_m.nextMedia++).toRadixString(16).padLeft(24, 'a');
    return (
      200,
      {
        'media': {'id': id, 'url': '/api/wallet/manual/media/$id', 'mime': 'image/png', 'size': 48213},
      },
    );
  }
  if (r == 'deposits') {
    final methodId = body['method_id'];
    if (methodId is! int || methodId <= 0) return (422, _err('validation', 'Choose a payment method.', 'method_id'));
    final amount = '${body['amount'] ?? ''}'.trim();
    if (!RegExp(r'^\d{1,12}(\.\d{1,6})?$').hasMatch(amount) || _cmp(amount, '0') <= 0) {
      return (422, _err('validation', 'Enter the amount you paid (up to 6 decimals).', 'amount'));
    }
    final reference = '${body['reference'] ?? ''}'.trim();
    if (reference.length < 4 || reference.length > 128) return (422, _err('validation', 'Enter the reference of your payment.', 'reference'));
    final key = '${body['idempotency_key'] ?? ''}';
    if (!RegExp(r'^[A-Za-z0-9:_-]{8,128}$').hasMatch(key)) return (422, _err('validation', 'Missing request id.', 'idempotency_key'));
    final replay = _m.byKey[key];
    if (replay != null) return (200, {'deposit': replay, 'replayed': true});
    final m = _m.methods.where((x) => x['id'] == methodId && x['status'] == 'active').firstOrNull;
    if (m == null) return (422, _err('method_unavailable', 'This payment method is no longer available.'));
    if (_cmp(amount, '${m['min_amount']}') < 0) {
      return (422, _err('below_minimum', 'The minimum for this method is ${m['min_amount']} ${m['currency']}.', 'amount'));
    }
    if (m['max_amount'] != null && _cmp(amount, '${m['max_amount']}') > 0) {
      return (422, _err('above_maximum', 'The maximum for this method is ${m['max_amount']} ${m['currency']}.', 'amount'));
    }
    final kind = '${m['kind']}';
    final normal = _normalRef(kind, reference);
    if (_m.deposits.any((d) => d['kind'] == kind && (d['status'] == 'pending' || d['status'] == 'approved') && _normalRef(kind, '${d['reference']}') == normal)) {
      return (409, _err('reference_used', 'A request with this reference was already sent.', 'reference'));
    }
    if (_m.deposits.where((d) => d['status'] == 'pending').length >= 5) {
      return (429, _err('too_many_pending', 'You already have 5 requests waiting for review.'));
    }
    final proof = body['proof_media_id'];
    final now = _iso(DateTime.now());
    final d = <String, dynamic>{
      'id': _m.nextId++,
      'method_id': methodId,
      'kind': kind,
      'method': _snap(m),
      'currency': m['currency'],
      'amount': amount,
      'rate': m['rate'],
      'expected_credit': previewCreditOf(amount, '${m['rate']}'),
      'credit_amount': null,
      'reference': reference,
      'proof_url': proof is String ? '/api/wallet/manual/media/$proof' : null,
      'client_note': body['note'],
      'status': 'pending',
      'reason': null,
      'decided_at': null,
      'created_at': now,
      'updated_at': now,
    };
    _m.deposits.insert(0, d);
    _m.byKey[key] = d;
    return (200, {'deposit': d});
  }
  final cancel = RegExp(r'^deposits/(\d+)/cancel$').firstMatch(r);
  if (cancel != null) {
    final d = _m.deposits.where((x) => '${x['id']}' == cancel.group(1)).firstOrNull;
    if (d == null) return (404, _err('not_found', 'Not found.'));
    if (d['status'] != 'pending') return (409, _err('invalid_state', 'Only a request waiting for review can be cancelled.'));
    final now = _iso(DateTime.now());
    d
      ..['status'] = 'cancelled'
      ..['decided_at'] = now
      ..['updated_at'] = now;
    return (200, {'deposit': d});
  }
  return (404, _err('not_found', 'Not found.'));
}
