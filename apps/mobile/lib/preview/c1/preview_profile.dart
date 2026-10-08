// Sample answers for the Profile & Security pages (development previews and widget tests only; never in a shipped build).
// Shapes are the real API's (the web's /api/<family>/... BFF routes: apps/crm/app/api/security/[...path],
// api/kyc/[[...path]] = services/gateway/src/kyc.rs, api/notifications/prefs = services/support notify.rs,
// api/auth/[action] password, api/auth/marketing); values are made up. Return null for paths this file doesn't answer.
//
// A small in-memory account so the flows work:
//   security/sessions (+ revoke, revoke-others), security/logins, security/requests (+ create, cancel, export),
//   security/viewers (+ create, edit, new password, revoke): writes that need a code (viewer create, viewer
//   password) answer 403 stepup_required without `stepup_token`, like the gateway;
//   kyc: GET, start, details, documents (multipart: the adapter passes no fields, so the upload fills the slot in
//   `PreviewProfile.uploadSlot` when a test set it, else the case's first missing one), submit;
//   notifications/prefs GET / PUT, auth/marketing GET / PUT, auth/password (step-up protected; "wrong-password" as
//   the current password answers the field error).
// `PreviewProfile.kyc` picks the starting KYC case (tests and screenshots set it, then call `reset()`):
//   approved (default; the sample client is verified), none (no case yet), draft (a started individual case),
//   in_review, more_info, rejected.

abstract final class PreviewProfile {
  static String kyc = 'approved';

  /// Every write this file answered: (method, path, body). Tests read it.
  static final List<(String, String, Map<String, dynamic>)> calls = [];

  /// The slot the next `kyc/documents` upload fills ({kind, side, party?}); tests set it from the multipart fields.
  static Map<String, String>? uploadSlot;

  static bool _ready = false;
  static final List<Map<String, dynamic>> _sessions = [];
  static final List<Map<String, dynamic>> _requests = [];
  static final List<Map<String, dynamic>> _viewers = [];
  static final List<Map<String, dynamic>> _activity = [];
  static final Map<String, Map<String, bool>> _prefs = {};
  static bool _marketing = true;
  static int _nextId = 7300;

  // KYC
  static String _kycStatus = 'verified';
  static bool _identityLocked = true;
  static Map<String, dynamic>? _case;
  static final List<Map<String, dynamic>> _docs = [];
  static final List<Map<String, dynamic>> _events = [];
  static final List<Map<String, dynamic>> _history = [];

  /// Starts the account again (KYC in `kyc`); tests call it in setUp.
  static void reset([String? kycScenario]) {
    if (kycScenario != null) kyc = kycScenario;
    _ready = false;
    calls.clear();
    uploadSlot = null;
  }

  static String _ago(Duration d) => DateTime.now().toUtc().subtract(d).toIso8601String();
  static String _ahead(Duration d) => DateTime.now().toUtc().add(d).toIso8601String();

  static void _init() {
    if (_ready) return;
    _ready = true;
    _nextId = 7300;
    _sessions
      ..clear()
      ..addAll([
        {
          'id': 1,
          'current': true,
          'ip': '49.36.112.18',
          'user_agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
          'country': 'IN',
          'created_at': _ago(const Duration(days: 2, hours: 3)),
          'last_seen_at': _ago(const Duration(seconds: 20)),
          'expires_at': _ahead(const Duration(days: 5)),
          'viewer': null,
        },
        {
          'id': 2,
          'current': false,
          'ip': '103.21.58.4',
          'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'country': 'IN',
          'created_at': _ago(const Duration(days: 4)),
          'last_seen_at': _ago(const Duration(hours: 3)),
          'expires_at': _ahead(const Duration(days: 3)),
          'viewer': null,
        },
        {
          'id': 3,
          'current': false,
          'ip': '94.204.11.70',
          'user_agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
          'country': 'AE',
          'created_at': _ago(const Duration(days: 1, hours: 6)),
          'last_seen_at': _ago(const Duration(minutes: 42)),
          'expires_at': _ahead(const Duration(days: 6)),
          'viewer': null,
        },
        {
          'id': 4,
          'current': false,
          'ip': '81.2.69.160',
          'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
          'country': 'GB',
          'created_at': _ago(const Duration(hours: 20)),
          'last_seen_at': _ago(const Duration(hours: 1)),
          'expires_at': _ahead(const Duration(hours: 4)),
          'viewer': {'id': 11, 'label': 'Accountant (Priya)'},
        },
      ]);
    _requests
      ..clear()
      ..add({
        'id': 52,
        'kind': 'data_export',
        'status': 'completed',
        'reason': null,
        'staff_note': 'Your data is ready to download.',
        'created_at': _ago(const Duration(days: 40)),
        'closed_at': _ago(const Duration(days: 38)),
      });
    _viewers
      ..clear()
      ..addAll([
        {
          'id': 11,
          'label': 'Accountant (Priya)',
          'username': 'priya.tax',
          'accounts': ['10042817'],
          'sections': ['dashboard', 'accounts', 'history'],
          'status': 'active',
          'expires_at': _ahead(const Duration(days: 60)),
          'revoked_at': null,
          'last_login_at': _ago(const Duration(hours: 1)),
          'created_at': _ago(const Duration(days: 21)),
        },
        {
          'id': 9,
          'label': 'Family office',
          'username': 'mehta.family',
          'accounts': <String>[],
          'sections': ['dashboard', 'wallet'],
          'status': 'revoked',
          'expires_at': null,
          'revoked_at': _ago(const Duration(days: 12)),
          'last_login_at': _ago(const Duration(days: 15)),
          'created_at': _ago(const Duration(days: 90)),
        },
      ]);
    _activity
      ..clear()
      ..addAll([
        {
          'id': 905,
          'action': 'viewer.page_view',
          'label': 'Accountant (Priya)',
          'path': '/portfolio/statements',
          'ip': '81.2.69.160',
          'user_agent': _sessions[3]['user_agent'],
          'at': _ago(const Duration(minutes: 58)),
        },
        {
          'id': 904,
          'action': 'viewer.page_view',
          'label': 'Accountant (Priya)',
          'path': '/accounts/10042817',
          'ip': '81.2.69.160',
          'user_agent': _sessions[3]['user_agent'],
          'at': _ago(const Duration(hours: 1)),
        },
        {
          'id': 903,
          'action': 'viewer.login',
          'label': 'Accountant (Priya)',
          'path': null,
          'ip': '81.2.69.160',
          'user_agent': _sessions[3]['user_agent'],
          'at': _ago(const Duration(hours: 1, minutes: 2)),
        },
        {
          'id': 880,
          'action': 'viewer.revoked',
          'label': 'Family office',
          'path': null,
          'ip': '49.36.112.18',
          'user_agent': _sessions[0]['user_agent'],
          'at': _ago(const Duration(days: 12)),
        },
      ]);
    _prefs.clear();
    for (final c in _catalog) {
      final d = c['defaults'] as Map<String, bool>;
      _prefs[c['key'] as String] = {'inApp': d['inApp']!, 'email': d['email']!};
    }
    _marketing = true;
    _initKyc();
  }

  /* ------------------------------------------------------------------ notifications (services/support notify.rs) */

  static const List<Map<String, Object>> _catalog = [
    {
      'key': 'security',
      'label': 'Security',
      'hint': 'Sign-ins from new devices, password and email changes',
      'locked': true,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'trading_alerts',
      'label': 'Margin call and stop-out',
      'hint': 'When an account reaches its margin call or stop-out level',
      'locked': false,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'trading_fills',
      'label': 'Order fills and closes',
      'hint': 'Stop loss, take profit and dealer closes',
      'locked': false,
      'defaults': {'inApp': true, 'email': false},
    },
    {
      'key': 'wallet',
      'label': 'Deposits and withdrawals',
      'hint': 'Deposits credited, withdrawals approved, rejected or paid',
      'locked': false,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'kyc',
      'label': 'Identity verification',
      'hint': 'Verification decisions and requests for documents',
      'locked': false,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'ib',
      'label': 'Partner commissions',
      'hint': 'IB commissions, payouts and level changes',
      'locked': false,
      'defaults': {'inApp': true, 'email': false},
    },
    {
      'key': 'copy',
      'label': 'Copy trading and PAMM',
      'hint': 'Copied trades, skipped trades, protection stops, new terms, fees and fund rollovers',
      'locked': false,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'prop',
      'label': 'Prop challenges',
      'hint': 'Phase passed or failed, funded account and payouts',
      'locked': false,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'support',
      'label': 'Support replies',
      'hint': 'Replies from our support team',
      'locked': false,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'system',
      'label': 'Platform notices',
      'hint': 'Maintenance and service announcements',
      'locked': false,
      'defaults': {'inApp': true, 'email': true},
    },
    {
      'key': 'marketing',
      'label': 'News and offers',
      'hint': 'Promotions, contests and product news',
      'locked': false,
      'defaults': {'inApp': true, 'email': false},
    },
  ];

  static Map<String, dynamic> _prefsJson() => {
    'catalog': _catalog,
    'prefs': {
      for (final e in _prefs.entries) e.key: {...e.value},
    },
  };

  /* ------------------------------------------------------------------ KYC (services/gateway/src/kyc.rs state()) */

  static Map<String, dynamic> _profile() => {
    'first_name': 'Arjun',
    'last_name': 'Mehta',
    'date_of_birth': '1991-04-12',
    'country': 'in',
    'email': 'arjun.mehta@example.com',
  };

  static const Map<String, String> _address = {'line1': '14 Marine Drive', 'line2': 'Flat 702', 'city': 'Mumbai', 'postcode': '400020', 'country': 'in'};

  static Map<String, dynamic> _clientChecks(String kind) => {
    'source': 'camera',
    'width': kind == 'selfie' ? 1080 : 2400,
    'height': kind == 'selfie' ? 1440 : 1600,
    'blur': {'score': kind == 'selfie' ? 64.2 : 182.5, 'ok': true},
    if (kind != 'proof_of_address') 'glare': {'pct': 0.8, 'ok': true},
    'brightness': {'mean': 142, 'ok': true},
    'resolution': {'ok': true, 'min': kind == 'selfie' ? 480 : 600},
    if (kind != 'selfie') 'fill': {'ratio': 0.71, 'ok': true},
    if (kind == 'selfie') 'face': {'found': true, 'method': 'heuristic', 'centered': true},
  };

  static Map<String, dynamic> _doc(String kind, String side, {String status = 'uploaded', String? party, Duration age = Duration.zero}) {
    final id = _nextId++;
    final selfie = kind == 'selfie';
    return {
      'id': id,
      'kind': kind,
      'side': side,
      'party': party,
      'doc_type': kind == 'proof_of_address' ? 'utility_bill' : null,
      'mime': 'image/jpeg',
      'size_bytes': selfie ? 412870 : 1284113,
      'width': selfie ? 1080 : 2400,
      'height': selfie ? 1440 : 1600,
      'issue_date': kind == 'proof_of_address' ? _day(const Duration(days: 21)) : null,
      'status': status,
      'created_at': _ago(age),
      'checks': {
        'format': {'detected': 'image/jpeg', 'ok': true},
        'resolution': {'ok': true, 'width': selfie ? 1080 : 2400, 'height': selfie ? 1440 : 1600},
        'size': {'ok': true, 'bytes': selfie ? 412870 : 1284113},
        'issue_date': kind == 'proof_of_address' ? {'ok': true, 'age_days': 21} : null,
        'client': _clientChecks(kind),
      },
    };
  }

  static String _day(Duration back) {
    final d = DateTime.now().subtract(back);
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  static Map<String, dynamic> _newCase(int id, String kind, String status, {Duration age = Duration.zero}) => {
    'id': id,
    'reference': 'KYC-${id.toString().padLeft(6, '0')}',
    'kind': kind,
    'status': status,
    'level': 0,
    'id_doc_type': null,
    'details': <String, dynamic>{},
    'requested': <Map<String, dynamic>>[],
    'requested_labels': <String>[],
    'request_message': null,
    'decision': null,
    'allow_resubmit': false,
    'submissions': 0,
    'submitted_at': null,
    'review_started_at': null,
    'decided_at': null,
    'created_at': _ago(age),
  };

  static void _event(String kind, {Duration age = Duration.zero, Map<String, dynamic> meta = const {}}) => _events.add({
    'id': 400 + _events.length,
    'kind': kind,
    'actor_kind': kind == 'approved' || kind == 'rejected' || kind == 'more_info' || kind == 'review_started' ? 'staff' : 'user',
    'actor_id': null,
    'meta': meta,
    'at': _ago(age),
  });

  /// An individual case with every document in, in `status`.
  static void _fullCase(String status) {
    final c = _newCase(1288, 'individual', status, age: const Duration(days: 9));
    c['id_doc_type'] = 'national_id';
    c['details'] = {'address': _address};
    c['submissions'] = 1;
    c['submitted_at'] = _ago(const Duration(days: 8, hours: 20));
    _case = c;
    _docs.addAll([
      _doc('id_document', 'front', age: const Duration(days: 8, hours: 21)),
      _doc('id_document', 'back', age: const Duration(days: 8, hours: 21)),
      _doc('proof_of_address', 'single', age: const Duration(days: 8, hours: 21)),
      _doc('selfie', 'single', age: const Duration(days: 8, hours: 20)),
    ]);
    _event('started', age: const Duration(days: 9));
    _event('details_saved', age: const Duration(days: 8, hours: 22));
    for (final d in _docs) {
      _event('document_uploaded', age: const Duration(days: 8, hours: 21), meta: {'kind': d['kind'], 'side': d['side']});
    }
    _event('submitted', age: const Duration(days: 8, hours: 20), meta: {'documents': 4, 'typical_hours': 6});
    if (status == 'in_review') {
      // just sent: the team picked it up
      c['submitted_at'] = _ago(const Duration(hours: 2));
      c['review_started_at'] = _ago(const Duration(minutes: 40));
      _event('review_started', age: const Duration(minutes: 40));
      return;
    }
    c['review_started_at'] = _ago(const Duration(days: 8, hours: 16));
    _event('review_started', age: const Duration(days: 8, hours: 16));
    if (status == 'approved') {
      c['level'] = 2;
      c['decided_at'] = _ago(const Duration(days: 8, hours: 14));
      for (final d in _docs) {
        d['status'] = 'accepted';
      }
      _event('approved', age: const Duration(days: 8, hours: 14));
    } else if (status == 'more_info') {
      c['requested'] = [
        {'kind': 'proof_of_address', 'side': 'single', 'party': null},
      ];
      c['requested_labels'] = ['Proof of address'];
      c['request_message'] = 'The bill is older than 3 months. Please upload one from the last 3 months that shows your full name.';
      _docs[2]['status'] = 'rejected';
      _event('more_info', age: const Duration(days: 8, hours: 14));
    } else if (status == 'rejected') {
      c['decided_at'] = _ago(const Duration(days: 8, hours: 14));
      c['decision'] = {'code': 'document_unreadable', 'label': 'Document unreadable', 'message': 'The photo of your ID card is blurred. Please start again.'};
      c['allow_resubmit'] = true;
      _event('rejected', age: const Duration(days: 8, hours: 14));
    }
  }

  static void _initKyc() {
    _case = null;
    _docs.clear();
    _events.clear();
    _history.clear();
    _identityLocked = false;
    switch (kyc) {
      case 'none':
        _kycStatus = 'unverified';
      case 'draft':
        _kycStatus = 'unverified';
        _case = _newCase(1288, 'individual', 'draft', age: const Duration(minutes: 5));
        _event('started', age: const Duration(minutes: 5));
      case 'in_review':
        _kycStatus = 'pending';
        _fullCase('in_review');
      case 'more_info':
        _kycStatus = 'pending';
        _fullCase('more_info');
      case 'rejected':
        _kycStatus = 'rejected';
        _fullCase('rejected');
      default:
        _kycStatus = 'verified';
        _identityLocked = true;
        _fullCase('approved');
    }
    final c = _case;
    if (c != null) {
      _history.add({
        'reference': c['reference'],
        'kind': c['kind'],
        'status': c['status'],
        'decision_label': (c['decision'] as Map?)?['label'],
        'decided_at': c['decided_at'],
        'created_at': c['created_at'],
      });
    }
  }

  static String _slotLabel(Map<String, dynamic> s, String? idType) {
    String side(String t) => t == 'passport'
        ? 'Passport photo page'
        : '${t == 'driving_licence' ? 'Driving licence' : 'National ID card'} (${s['side'] == 'back' ? 'back' : 'front'})';
    return switch (s['kind']) {
      'id_document' => side(idType ?? ''),
      'proof_of_address' => 'Proof of address',
      'selfie' => 'Selfie',
      'incorporation' => 'Certificate of incorporation',
      'company_address' => 'Company proof of address',
      'party_id' => 'Director / owner ID',
      _ => '${s['kind']}',
    };
  }

  /// gateway required_slots().
  static List<Map<String, dynamic>> _requiredSlots(Map<String, dynamic> c) {
    final details = (c['details'] as Map?)?.cast<String, dynamic>() ?? const {};
    if (c['kind'] == 'corporate') {
      return [
        {'kind': 'incorporation', 'side': 'single', 'party': null},
        {'kind': 'company_address', 'side': 'single', 'party': null},
        for (final p in (details['parties'] as List?) ?? const []) ...[
          {'kind': 'party_id', 'side': 'front', 'party': (p as Map)['key']},
          if (p['id_type'] != 'passport') {'kind': 'party_id', 'side': 'back', 'party': p['key']},
        ],
        {'kind': 'selfie', 'side': 'single', 'party': null},
      ];
    }
    return [
      {'kind': 'id_document', 'side': 'front', 'party': null},
      if (c['id_doc_type'] != 'passport') {'kind': 'id_document', 'side': 'back', 'party': null},
      {'kind': 'proof_of_address', 'side': 'single', 'party': null},
      {'kind': 'selfie', 'side': 'single', 'party': null},
    ];
  }

  static bool _same(Map<String, dynamic> a, Map<String, dynamic> b) =>
      a['kind'] == b['kind'] && a['side'] == b['side'] && (a['party'] ?? '') == (b['party'] ?? '');
  static bool _current(Map<String, dynamic> d) => d['status'] == 'uploaded' || d['status'] == 'accepted';

  static List<Map<String, dynamic>> _requirements(Map<String, dynamic> c) => [
    for (final s in _requiredSlots(c))
      () {
        final cur = _docs.reversed.where((d) => _same(d, s) && _current(d)).firstOrNull;
        final last = _docs.reversed.where((d) => _same(d, s)).firstOrNull;
        return {
          ...s,
          'label': _slotLabel(s, c['id_doc_type'] as String?),
          'uploaded': cur != null,
          'document_id': cur?['id'],
          'requested': ((c['requested'] as List?) ?? const []).any((r) => _same((r as Map).cast<String, dynamic>(), s)),
          'last_status': last?['status'],
        };
      }(),
  ];

  static Map<String, dynamic> _kycState() {
    final c = _case;
    final status = c?['status'] as String?;
    return {
      'kyc_status': _kycStatus,
      'identity_locked': _identityLocked,
      'profile': _profile(),
      'case': c,
      'editable': status == 'draft' || status == 'more_info',
      'can_start': (c == null || (status == 'rejected' && c['allow_resubmit'] == true)) && _kycStatus != 'verified',
      'documents': [
        for (final d in _docs)
          if (d['status'] != 'superseded') d,
      ],
      'required': c == null ? const <Map<String, dynamic>>[] : _requirements(c),
      'timeline': _events,
      'history': _history,
      'review': {'sla_hours': 24, 'typical_hours': 6},
      'limits': {'max_bytes': 10 * 1024 * 1024, 'min_bytes': 20 * 1024, 'poa_max_age_days': 92},
      'reasons': const [
        {'code': 'document_unreadable', 'label': 'Document unreadable'},
        {'code': 'document_expired', 'label': 'Document expired'},
        {'code': 'name_mismatch', 'label': 'Name does not match'},
        {'code': 'poa_too_old', 'label': 'Proof of address too old'},
      ],
    };
  }

  static (int, Object) _err(int status, String code, String message, {String? field}) => (
    status,
    {
      'error': {'code': code, 'message': message, 'field': ?field},
    },
  );

  static (int, Object) _stepUp() => _err(403, 'stepup_required', 'Confirm with the code we emailed you.');

  static (int, Object)? _kycAnswer(String method, String path, Map<String, dynamic> body) {
    if (path == 'kyc' && method == 'GET') return (200, _kycState());
    if (method != 'POST') return null;
    final c = _case;
    switch (path) {
      case 'kyc/start':
        final open = c != null && c['status'] != 'rejected' && c['status'] != 'approved';
        if (open) return _err(409, 'case_open', 'You already have a verification in progress.');
        if (_kycStatus == 'verified') return _err(409, 'already_verified', 'Your identity is already verified.');
        final kind = body['kind'] == 'corporate' ? 'corporate' : 'individual';
        _docs.clear();
        _events.clear();
        _case = _newCase(1288 + _history.length, kind, 'draft');
        _event('started');
        _kycStatus = _kycStatus == 'rejected' ? 'unverified' : _kycStatus;
        return (200, _kycState());
      case 'kyc/details':
        if (c == null || (c['status'] != 'draft' && c['status'] != 'more_info')) return _err(409, 'not_editable', 'This verification was already submitted.');
        final details = Map<String, dynamic>.from((c['details'] as Map?) ?? const {});
        if (body['address'] is Map) {
          final a = (body['address'] as Map).cast<String, dynamic>();
          if ('${a['line1'] ?? ''}'.trim().isEmpty) return _err(422, 'validation', 'Enter your street address.', field: 'address.line1');
          if ('${a['city'] ?? ''}'.trim().isEmpty) return _err(422, 'validation', 'Enter your city.', field: 'address.city');
          details['address'] = a;
        }
        if (body['company'] is Map) details['company'] = body['company'];
        if (body['parties'] is List) {
          var n = 0;
          details['parties'] = [
            for (final p in body['parties'] as List)
              if (p is Map) {...p.cast<String, dynamic>(), 'key': p['key'] ?? 'p${++n}'},
          ];
        }
        if (body['id_doc_type'] is String) {
          c['id_doc_type'] = body['id_doc_type'];
          // a new id type supersedes the id photos already in (gateway: other sides no longer match)
          for (final d in _docs) {
            if (d['kind'] == 'id_document' && _current(d)) d['status'] = 'superseded';
          }
        }
        c['details'] = details;
        _event('details_saved');
        return (200, _kycState());
      case 'kyc/documents':
        if (c == null || (c['status'] != 'draft' && c['status'] != 'more_info')) return _err(409, 'not_editable', 'This verification was already submitted.');
        final req = _requirements(c);
        final want = uploadSlot;
        final Map<String, dynamic>? slot = want != null
            ? {'kind': want['kind'], 'side': want['side'] ?? 'single', 'party': want['party']}
            : req.where((r) => r['uploaded'] != true).map((r) => {'kind': r['kind'], 'side': r['side'], 'party': r['party']}).firstOrNull ??
                  (req.isEmpty ? null : {'kind': req.first['kind'], 'side': req.first['side'], 'party': req.first['party']});
        if (slot == null) return _err(422, 'validation', 'Choose what this document is.', field: 'kind');
        uploadSlot = null;
        for (final d in _docs) {
          if (_same(d, slot) && _current(d)) d['status'] = 'superseded';
        }
        final doc = _doc(slot['kind'] as String, slot['side'] as String, party: slot['party'] as String?);
        _docs.add(doc);
        _event('document_uploaded', meta: {'kind': slot['kind'], 'side': slot['side']});
        return (200, {'status': 'ok', 'document': doc, 'state': _kycState()});
      case 'kyc/submit':
        if (c == null || (c['status'] != 'draft' && c['status'] != 'more_info')) return _err(409, 'not_editable', 'This verification was already submitted.');
        if (body['confirm'] != true) return _err(422, 'validation', 'Confirm that the documents are yours.', field: 'confirm');
        final missing = _requirements(c).where((r) => r['uploaded'] != true).toList();
        if (missing.isNotEmpty) return _err(422, 'missing_documents', 'Add ${missing.first['label']} before sending.');
        final resubmission = c['status'] == 'more_info';
        c['status'] = 'submitted';
        c['submissions'] = ((c['submissions'] as int?) ?? 0) + 1;
        c['submitted_at'] = _ago(Duration.zero);
        c['requested'] = <Map<String, dynamic>>[];
        c['requested_labels'] = <String>[];
        if (_kycStatus != 'verified') _kycStatus = 'pending';
        _event(resubmission ? 'resubmitted' : 'submitted', meta: {'documents': _docs.where(_current).length, 'typical_hours': 6});
        return (200, _kycState());
    }
    return null;
  }

  /* ------------------------------------------------------------------ security (gateway /v1/auth/...) */

  static Map<String, dynamic>? _viewer(String id) => _viewers.where((v) => '${v['id']}' == id).firstOrNull;

  static (int, Object)? _viewerAnswer(String method, String path, Map<String, dynamic> body) {
    final p = path.split('/');
    if (path == 'security/viewers' && method == 'GET') {
      return (200, {'items': _viewers, 'activity': _activity, 'max': 10});
    }
    if (path == 'security/viewers' && method == 'POST') {
      if (body['stepup_token'] == null) return _stepUp();
      final label = '${body['label'] ?? ''}'.trim();
      if (label.isEmpty) return _err(422, 'validation', 'Give this login a name.', field: 'label');
      final sections = body['sections'] is List ? [for (final s in body['sections'] as List) '$s'] : <String>[];
      if (sections.isEmpty) return _err(422, 'validation', 'Choose at least one section.', field: 'sections');
      var username = '${body['username'] ?? ''}'.trim();
      if (username.isNotEmpty && _viewers.any((v) => v['username'] == username)) {
        return _err(409, 'username_taken', 'That viewer ID is taken. Try another.', field: 'username');
      }
      if (username.isEmpty) username = 'arjun.view${_viewers.length + 1}';
      if (_viewers.where((v) => v['status'] == 'active').length >= 10) return _err(409, 'limit', 'You can have up to 10 view-only logins.');
      final v = {
        'id': _nextId++,
        'label': label,
        'username': username,
        'accounts': body['accounts'] is List ? [for (final a in body['accounts'] as List) '$a'] : <String>[],
        'sections': sections,
        'status': 'active',
        'expires_at': body['expires_at'],
        'revoked_at': null,
        'last_login_at': null,
        'created_at': _ago(Duration.zero),
      };
      _viewers.insert(0, v);
      _activity.insert(0, {
        'id': _nextId++,
        'action': 'viewer.created',
        'label': label,
        'path': null,
        'ip': '49.36.112.18',
        'user_agent': _sessions.first['user_agent'],
        'at': _ago(Duration.zero),
      });
      return (200, {'status': 'ok', 'viewer': v, 'password': 'Kx7-mPq4-Wz9r'});
    }
    if (p.length == 3 && p[1] == 'viewers' && method == 'PATCH') {
      final v = _viewer(p[2]);
      if (v == null) return _err(404, 'not_found', 'Not found.');
      if (v['status'] != 'active') return _err(409, 'revoked', 'This login was revoked.');
      if (body.containsKey('label')) {
        final label = '${body['label'] ?? ''}'.trim();
        if (label.isEmpty) return _err(422, 'validation', 'Give this login a name.', field: 'label');
        v['label'] = label;
      }
      if (body['accounts'] is List) v['accounts'] = [for (final a in body['accounts'] as List) '$a'];
      if (body['sections'] is List) {
        final s = [for (final x in body['sections'] as List) '$x'];
        if (s.isEmpty) return _err(422, 'validation', 'Choose at least one section.', field: 'sections');
        v['sections'] = s;
      }
      if (body.containsKey('expires_at')) v['expires_at'] = body['expires_at'];
      return (200, {'status': 'ok', 'viewer': v});
    }
    if (p.length == 4 && p[1] == 'viewers' && method == 'POST') {
      final v = _viewer(p[2]);
      if (v == null) return _err(404, 'not_found', 'Not found.');
      if (p[3] == 'password') {
        if (body['stepup_token'] == null) return _stepUp();
        if (v['status'] != 'active') return _err(409, 'revoked', 'This login was revoked.');
        return (200, {'status': 'ok', 'username': v['username'], 'password': 'Rt5-hNv8-Qa2k'});
      }
      if (p[3] == 'revoke') {
        v['status'] = 'revoked';
        v['revoked_at'] = _ago(Duration.zero);
        _sessions.removeWhere((s) => (s['viewer'] as Map?)?['id'] == v['id']);
        return (200, {'status': 'ok'});
      }
    }
    return null;
  }

  static (int, Object)? _securityAnswer(String method, String path, Map<String, dynamic> body) {
    final p = path.split('/');
    switch ((method, path)) {
      case ('GET', 'security/sessions'):
        return (200, {'items': _sessions, 'idle_minutes': 60, 'max_days': 7});
      case ('POST', 'security/sessions/revoke-others'):
        final n = _sessions.where((s) => s['current'] != true).length;
        _sessions.removeWhere((s) => s['current'] != true);
        return (200, {'status': 'ok', 'revoked': n});
      case ('GET', 'security/logins'):
        return (
          200,
          {
            'items': [
              {
                'id': 3310,
                'at': _ago(const Duration(days: 2, hours: 3)),
                'result': 'new_device',
                'ip': '49.36.112.18',
                'user_agent': _sessions.first['user_agent'],
                'country': 'IN',
              },
              {
                'id': 3302,
                'at': _ago(const Duration(days: 1, hours: 6)),
                'result': 'success',
                'ip': '94.204.11.70',
                'user_agent': _ua('iphone'),
                'country': 'AE',
              },
              {
                'id': 3297,
                'at': _ago(const Duration(days: 1, hours: 7)),
                'result': 'failed',
                'ip': '94.204.11.70',
                'user_agent': _ua('iphone'),
                'country': 'AE',
              },
              {'id': 3281, 'at': _ago(const Duration(days: 4)), 'result': 'success', 'ip': '103.21.58.4', 'user_agent': _ua('windows'), 'country': 'IN'},
              {
                'id': 3270,
                'at': _ago(const Duration(days: 4, minutes: 3)),
                'result': 'code_sent',
                'ip': '103.21.58.4',
                'user_agent': _ua('windows'),
                'country': 'IN',
              },
              {
                'id': 3204,
                'at': _ago(const Duration(days: 11)),
                'result': 'password_reset',
                'ip': '49.36.112.18',
                'user_agent': _ua('android'),
                'country': 'IN',
              },
              {'id': 3166, 'at': _ago(const Duration(days: 19)), 'result': 'logout', 'ip': '103.21.58.4', 'user_agent': _ua('windows'), 'country': 'IN'},
              {'id': 3120, 'at': _ago(const Duration(days: 26)), 'result': 'google', 'ip': '103.21.58.4', 'user_agent': _ua('mac'), 'country': 'IN'},
            ],
          },
        );
      case ('GET', 'security/requests'):
        return (200, {'items': _requests});
      case ('POST', 'security/requests'):
        final kind = body['kind'];
        if (kind != 'closure' && kind != 'data_export') return _err(422, 'validation', 'Choose a request type.', field: 'kind');
        if (_requests.any((r) => r['kind'] == kind && (r['status'] == 'open' || r['status'] == 'in_progress'))) {
          return _err(409, 'request_open', 'You already have an open request of this kind.');
        }
        final r = {
          'id': _nextId++,
          'kind': kind,
          'status': 'open',
          'reason': (body['reason'] as String?)?.trim().isEmpty ?? true ? null : body['reason'],
          'staff_note': null,
          'created_at': _ago(Duration.zero),
          'closed_at': null,
        };
        _requests.insert(0, r);
        return (200, {'status': 'ok', 'request': r});
    }
    if (p.length == 4 && p[1] == 'sessions' && p[3] == 'revoke' && method == 'POST') {
      final s = _sessions.where((s) => '${s['id']}' == p[2]).firstOrNull;
      if (s == null) return _err(404, 'not_found', 'This session has already ended.');
      if (s['current'] == true) return _err(409, 'current_session', 'Use Sign out to end this session.');
      _sessions.remove(s);
      return (200, {'status': 'ok'});
    }
    if (p.length == 4 && p[1] == 'requests') {
      final r = _requests.where((r) => '${r['id']}' == p[2]).firstOrNull;
      if (r == null) return _err(404, 'not_found', 'Not found.');
      if (p[3] == 'cancel' && method == 'POST') {
        if (r['status'] != 'open') return _err(409, 'not_open', 'This request can no longer be cancelled.');
        r['status'] = 'cancelled';
        r['closed_at'] = _ago(Duration.zero);
        return (200, {'status': 'ok'});
      }
      if (p[3] == 'export' && method == 'GET') {
        if (r['kind'] != 'data_export' || r['status'] != 'completed') return _err(409, 'not_ready', 'The export is not ready yet.');
        return (
          200,
          {
            'generated_at': _ago(const Duration(days: 38)),
            'user': {'email': 'arjun.mehta@example.com', 'first_name': 'Arjun', 'last_name': 'Mehta', 'country': 'in'},
            'sessions': _sessions.length,
            'logins': 8,
          },
        );
      }
    }
    return _viewerAnswer(method, path, body);
  }

  static String _ua(String k) => switch (k) {
    'iphone' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'windows' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'mac' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    _ => 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  };

  static (int, Object)? answer(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
    final mine =
        path.startsWith('security/') ||
        path == 'kyc' ||
        path.startsWith('kyc/') ||
        path == 'notifications/prefs' ||
        path == 'auth/password' ||
        path == 'auth/marketing';
    if (!mine) return null;
    _init();
    if (method != 'GET') calls.add((method, path, Map<String, dynamic>.from(body)));
    switch ((method, path)) {
      case ('GET', 'notifications/prefs'):
        return (200, _prefsJson());
      case ('PUT', 'notifications/prefs'):
        final next = body['prefs'];
        if (next is! Map) return _err(400, 'bad_request', 'prefs must be an object.');
        for (final e in next.entries) {
          final cat = _catalog.where((c) => c['key'] == e.key).firstOrNull;
          if (cat == null || e.value is! Map) continue;
          final cur = _prefs[e.key]!;
          final v = (e.value as Map).cast<String, dynamic>();
          if (v['inApp'] is bool && cat['locked'] != true) cur['inApp'] = v['inApp'] as bool;
          if (v['email'] is bool && cat['locked'] != true) cur['email'] = v['email'] as bool;
        }
        return (200, _prefsJson());
      case ('GET', 'auth/marketing'):
        return (200, {'marketing_consent': _marketing, 'marketing_consent_at': _ago(const Duration(days: 220)), 'marketing_unsubscribed_at': null});
      case ('PUT', 'auth/marketing'):
        if (body['consent'] is! bool) return _err(400, 'bad_request', 'consent must be true or false.');
        _marketing = body['consent'] as bool;
        return (200, {'status': 'ok', 'marketing_consent': _marketing});
      case ('POST', 'auth/password'):
        if (body['stepup_token'] == null) return _stepUp();
        if (body['current'] == 'wrong-password') return _err(400, 'invalid_credentials', 'Your current password is not right.', field: 'current');
        final next = '${body['new'] ?? ''}';
        if (next.length < 8) return _err(422, 'weak_password', 'Use at least 8 characters.', field: 'new');
        if (next == body['current']) return _err(422, 'same_password', 'Choose a password you have not used here.', field: 'new');
        var n = 0;
        if (body['sign_out_others'] == true) {
          n = _sessions.where((s) => s['current'] != true && s['viewer'] == null).length;
          _sessions.removeWhere((s) => s['current'] != true && s['viewer'] == null);
        }
        return (200, {'status': 'ok', 'sessions_revoked': n});
    }
    if (path == 'kyc' || path.startsWith('kyc/')) return _kycAnswer(method, path, body);
    return _securityAnswer(method, path, body);
  }
}

(int, Object)? previewProfile(String method, String path, Map<String, dynamic> body, Map<String, String> query) =>
    PreviewProfile.answer(method, path, body, query);
