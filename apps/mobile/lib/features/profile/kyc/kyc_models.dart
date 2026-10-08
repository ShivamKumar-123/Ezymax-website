// The KYC BFF (`kyc`, `kyc/start`, `kyc/details`, `kyc/documents`, `kyc/submit`; web components/verification/api.ts,
// shapes = services/gateway/src/kyc.rs): the state, its slots and documents, the wizard's rules (firstIncomplete,
// docFor) and the checking sequence's summary (tracker.tsx submissionChecks).
import '../../../core/api/api_providers.dart';
import '../../../i18n/i18n.dart';
import '../widgets/profile_ui.dart';

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
String? _str(Object? v) => v is String && v.isNotEmpty ? v : null;
Map<String, dynamic> _map(Object? v) => v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};
List<Map<String, dynamic>> _list(Object? v) => v is List
    ? [
        for (final x in v)
          if (x is Map) x.cast<String, dynamic>(),
      ]
    : const [];

/// The id document types (web ID_TYPES: label and hint keys).
const List<(String value, String label, String hint)> kIdTypes = [
  ('passport', 'kyc.idType.passport', 'kyc.idType.passportHint'),
  ('national_id', 'kyc.idType.nationalId', 'kyc.idType.frontAndBack'),
  ('driving_licence', 'kyc.idType.drivingLicence', 'kyc.idType.frontAndBack'),
];

/// Proof-of-address document types (web POA_TYPES).
const List<(String value, String label)> kPoaTypes = [
  ('utility_bill', 'kyc.poaType.utilityBill'),
  ('bank_statement', 'kyc.poaType.bankStatement'),
  ('government_letter', 'kyc.poaType.governmentLetter'),
  ('tax_statement', 'kyc.poaType.taxStatement'),
];

/// One document position: (kind, side, party).
class KycSlot {
  const KycSlot(this.kind, this.side, [this.party]);

  /// id_document | proof_of_address | selfie | incorporation | company_address | party_id
  final String kind;

  /// front | back | single
  final String side;
  final String? party;

  bool same(KycSlot o) => kind == o.kind && side == o.side && (party ?? '') == (o.party ?? '');

  /// web slotKey.
  String get key => '$kind:$side:${party ?? ''}';

  @override
  bool operator ==(Object other) => other is KycSlot && same(other);

  @override
  int get hashCode => key.hashCode;
}

class KycAddress {
  KycAddress({this.line1 = '', this.line2 = '', this.city = '', this.postcode = '', this.country = ''});
  String line1, line2, city, postcode, country;

  static KycAddress? fromJson(Object? v) {
    if (v is! Map) return null;
    final j = v.cast<String, dynamic>();
    return KycAddress(
      line1: '${j['line1'] ?? ''}',
      line2: '${j['line2'] ?? ''}',
      city: '${j['city'] ?? ''}',
      postcode: '${j['postcode'] ?? ''}',
      country: '${j['country'] ?? ''}',
    );
  }

  Map<String, Object?> toJson() => {'line1': line1, 'line2': line2, 'city': city, 'postcode': postcode, 'country': country};

  KycAddress copy() => KycAddress(line1: line1, line2: line2, city: city, postcode: postcode, country: country);
}

class KycCompany {
  KycCompany({this.name = '', this.regNumber = '', this.country = '', this.incorporatedOn = '', this.business = '', KycAddress? address})
    : address = address ?? KycAddress();
  String name, regNumber, country, incorporatedOn, business;
  KycAddress address;

  static KycCompany? fromJson(Object? v) {
    if (v is! Map) return null;
    final j = v.cast<String, dynamic>();
    return KycCompany(
      name: '${j['name'] ?? ''}',
      regNumber: '${j['reg_number'] ?? ''}',
      country: '${j['country'] ?? ''}',
      incorporatedOn: '${j['incorporated_on'] ?? ''}',
      business: '${j['business'] ?? ''}',
      address: KycAddress.fromJson(j['address']) ?? KycAddress(),
    );
  }

  Map<String, Object?> toJson() => {
    'name': name,
    'reg_number': regNumber,
    'country': country,
    'incorporated_on': incorporatedOn,
    'business': business,
    'address': address.toJson(),
  };
}

/// A director or owner of a company (web Party).
class KycParty {
  KycParty({
    this.key,
    this.firstName = '',
    this.lastName = '',
    this.dateOfBirth = '',
    this.nationality = '',
    List<String>? roles,
    this.ownership,
    this.idType = 'passport',
  }) : roles = roles ?? ['director'];
  String? key;
  String firstName, lastName, dateOfBirth, nationality;
  List<String> roles;
  double? ownership;
  String idType;

  static KycParty fromJson(Map<String, dynamic> j) => KycParty(
    key: _str(j['key']),
    firstName: '${j['first_name'] ?? ''}',
    lastName: '${j['last_name'] ?? ''}',
    dateOfBirth: '${j['date_of_birth'] ?? ''}',
    nationality: '${j['nationality'] ?? ''}',
    roles: j['roles'] is List ? [for (final r in j['roles'] as List) '$r'] : ['director'],
    ownership: (j['ownership'] as num?)?.toDouble(),
    idType: '${j['id_type'] ?? 'passport'}',
  );

  Map<String, Object?> toJson() => {
    'key': ?key,
    'first_name': firstName,
    'last_name': lastName,
    'date_of_birth': dateOfBirth,
    'nationality': nationality,
    'roles': roles,
    'ownership': ownership,
    'id_type': idType,
  };
}

/// An uploaded file (web KycDocument). `checks` keeps the server's checks as JSON (`client` = what the app saw).
class KycDocument {
  const KycDocument({
    required this.id,
    required this.slot,
    required this.status,
    required this.mime,
    required this.sizeBytes,
    required this.checks,
    this.docType,
    this.issueDate,
    this.width,
    this.height,
  });
  final int id;
  final KycSlot slot;

  /// uploaded | accepted | rejected | superseded
  final String status;
  final String mime;
  final int sizeBytes;
  final String? docType, issueDate;
  final int? width, height;
  final Map<String, dynamic> checks;

  bool get current => status == 'uploaded' || status == 'accepted';
  Map<String, dynamic>? get client => checks['client'] is Map ? (checks['client'] as Map).cast<String, dynamic>() : null;
  Map<String, dynamic>? get resolution => checks['resolution'] is Map ? (checks['resolution'] as Map).cast<String, dynamic>() : null;

  static KycDocument fromJson(Map<String, dynamic> j) => KycDocument(
    id: _int(j['id']),
    slot: KycSlot('${j['kind'] ?? ''}', '${j['side'] ?? 'single'}', _str(j['party'])),
    status: '${j['status'] ?? 'uploaded'}',
    mime: '${j['mime'] ?? ''}',
    sizeBytes: _int(j['size_bytes']),
    docType: _str(j['doc_type']),
    issueDate: _str(j['issue_date']),
    width: j['width'] == null ? null : _int(j['width']),
    height: j['height'] == null ? null : _int(j['height']),
    checks: _map(j['checks']),
  );
}

/// One required document of the case (web Requirement).
class KycRequirement {
  const KycRequirement({required this.slot, required this.label, required this.uploaded, required this.requested, this.documentId, this.lastStatus});
  final KycSlot slot;
  final String label;
  final bool uploaded;
  final bool requested;
  final int? documentId;
  final String? lastStatus;

  static KycRequirement fromJson(Map<String, dynamic> j) => KycRequirement(
    slot: KycSlot('${j['kind'] ?? ''}', '${j['side'] ?? 'single'}', _str(j['party'])),
    label: '${j['label'] ?? ''}',
    uploaded: j['uploaded'] == true,
    requested: j['requested'] == true,
    documentId: j['document_id'] == null ? null : _int(j['document_id']),
    lastStatus: _str(j['last_status']),
  );
}

class KycEvent {
  const KycEvent({required this.id, required this.kind, this.at});
  final int id;
  final String kind;
  final DateTime? at;

  static KycEvent fromJson(Map<String, dynamic> j) => KycEvent(id: _int(j['id']), kind: '${j['kind'] ?? ''}', at: parseIso(j['at']));
}

/// The open (or last) case (web KycCase).
class KycCase {
  const KycCase({
    required this.id,
    required this.reference,
    required this.kind,
    required this.status,
    required this.level,
    required this.submissions,
    required this.allowResubmit,
    this.idDocType,
    this.address,
    this.company,
    this.parties = const [],
    this.requested = const [],
    this.requestMessage,
    this.decisionLabel,
    this.decisionMessage,
    this.decisionCode,
    this.submittedAt,
    this.reviewStartedAt,
    this.decidedAt,
    this.createdAt,
  });
  final int id;
  final String reference;

  /// individual | corporate
  final String kind;

  /// draft | submitted | in_review | more_info | approved | rejected
  final String status;
  final int level;
  final String? idDocType;
  final KycAddress? address;
  final KycCompany? company;
  final List<KycParty> parties;
  final List<KycSlot> requested;
  final String? requestMessage;
  final String? decisionCode, decisionLabel, decisionMessage;
  final bool allowResubmit;
  final int submissions;
  final DateTime? submittedAt, reviewStartedAt, decidedAt, createdAt;

  bool get corporate => kind == 'corporate';

  static KycCase fromJson(Map<String, dynamic> j) {
    final details = _map(j['details']);
    final decision = j['decision'] is Map ? (j['decision'] as Map).cast<String, dynamic>() : null;
    return KycCase(
      id: _int(j['id']),
      reference: '${j['reference'] ?? ''}',
      kind: '${j['kind'] ?? 'individual'}',
      status: '${j['status'] ?? 'draft'}',
      level: _int(j['level']),
      idDocType: _str(j['id_doc_type']),
      address: KycAddress.fromJson(details['address']),
      company: KycCompany.fromJson(details['company']),
      parties: [for (final p in _list(details['parties'])) KycParty.fromJson(p)],
      requested: [for (final s in _list(j['requested'])) KycSlot('${s['kind'] ?? ''}', '${s['side'] ?? 'single'}', _str(s['party']))],
      requestMessage: _str(j['request_message']),
      decisionCode: decision == null ? null : _str(decision['code']),
      decisionLabel: decision == null ? null : _str(decision['label']),
      decisionMessage: decision == null ? null : _str(decision['message']),
      allowResubmit: j['allow_resubmit'] == true,
      submissions: _int(j['submissions']),
      submittedAt: parseIso(j['submitted_at']),
      reviewStartedAt: parseIso(j['review_started_at']),
      decidedAt: parseIso(j['decided_at']),
      createdAt: parseIso(j['created_at']),
    );
  }
}

/// `GET kyc` (web KycState).
class KycState {
  const KycState({
    required this.kycStatus,
    required this.identityLocked,
    required this.profile,
    required this.kase,
    required this.editable,
    required this.canStart,
    required this.documents,
    required this.required,
    required this.timeline,
    required this.history,
    required this.typicalHours,
    required this.slaHours,
    required this.maxBytes,
    required this.poaMaxAgeDays,
    required this.raw,
  });

  /// unverified | pending | verified | rejected
  final String kycStatus;
  final bool identityLocked;

  /// {first_name, last_name, date_of_birth, country, email}
  final Map<String, dynamic> profile;
  final KycCase? kase;
  final bool editable, canStart;
  final List<KycDocument> documents;
  final List<KycRequirement> required;
  final List<KycEvent> timeline;

  /// Earlier cases: {reference, kind, status, decision_label, decided_at, created_at}.
  final List<Map<String, dynamic>> history;
  final int typicalHours, slaHours;
  final int maxBytes, poaMaxAgeDays;
  final Map<String, dynamic> raw;

  String p(String k) => '${profile[k] ?? ''}';

  static KycState fromJson(Map<String, dynamic> j) {
    final review = _map(j['review']);
    final limits = _map(j['limits']);
    return KycState(
      kycStatus: '${j['kyc_status'] ?? 'unverified'}',
      identityLocked: j['identity_locked'] == true,
      profile: _map(j['profile']),
      kase: j['case'] is Map ? KycCase.fromJson((j['case'] as Map).cast<String, dynamic>()) : null,
      editable: j['editable'] == true,
      canStart: j['can_start'] == true,
      documents: [for (final d in _list(j['documents'])) KycDocument.fromJson(d)],
      required: [for (final r in _list(j['required'])) KycRequirement.fromJson(r)],
      timeline: [for (final e in _list(j['timeline'])) KycEvent.fromJson(e)],
      history: _list(j['history']),
      typicalHours: review['typical_hours'] == null ? 24 : _int(review['typical_hours']),
      slaHours: review['sla_hours'] == null ? 24 : _int(review['sla_hours']),
      maxBytes: limits['max_bytes'] == null ? 10 * 1024 * 1024 : _int(limits['max_bytes']),
      poaMaxAgeDays: limits['poa_max_age_days'] == null ? 92 : _int(limits['poa_max_age_days']),
      raw: j,
    );
  }
}

/* ------------------------------------------------------------------ rules */

/// The slot's current document (uploaded or accepted), the latest one (web docFor).
KycDocument? docFor(KycState s, KycSlot slot) {
  KycDocument? hit;
  for (final d in s.documents) {
    if (d.slot.same(slot) && d.current) hit = d;
  }
  return hit;
}

/// The wizard's first unfinished step (web firstIncomplete): 0..4.
int firstIncomplete(KycState s) {
  final c = s.kase!;
  bool missing(bool Function(KycRequirement r) where) => s.required.any((r) => where(r) && !r.uploaded);
  if (c.corporate) {
    if (c.company == null) return 0;
    if (c.parties.isEmpty) return 1;
    if (missing((r) => r.slot.kind != 'selfie')) return 2;
    if (missing((r) => r.slot.kind == 'selfie')) return 3;
    return 4;
  }
  if (c.address == null) return 0;
  if (c.idDocType == null || missing((r) => r.slot.kind == 'id_document')) return 1;
  if (missing((r) => r.slot.kind == 'proof_of_address')) return 2;
  if (missing((r) => r.slot.kind == 'selfie')) return 3;
  return 4;
}

/// What the page shows (web LiveVerification mode).
enum KycMode { loading, start, wizard, moreInfo, tracker }

KycMode kycModeOf(KycState? s, {bool restart = false}) {
  if (s == null) return KycMode.loading;
  final c = s.kase;
  if (c == null || (restart && s.canStart)) return KycMode.start;
  if (c.status == 'draft') return KycMode.wizard;
  if (c.status == 'more_info') return KycMode.moreInfo;
  return KycMode.tracker;
}

/// "24 hours" (web hoursLabel).
String hoursLabel(T t, int h) => t('kyc.hours', {'count': h <= 1 ? 1 : h});

/// One line of the checking sequence (web CheckStep).
class KycCheckStep {
  const KycCheckStep(this.key, this.label, this.detail, {this.warn = false});
  final String key, label, detail;
  final bool warn;
}

/// The automatic checks across every current document (web submissionChecks).
List<KycCheckStep> submissionChecks(KycState s, T t) {
  final docs = s.documents.where((d) => d.current).toList();
  final client = [for (final d in docs) ?d.client];
  bool okOf(Object? v, String k) => v is Map && v[k] == true;
  bool all(String k, String flag) => client.where((c) => c[k] != null).every((c) => okOf(c[k], flag));
  bool any(String k) => client.any((c) => c[k] != null);
  final quality = all('blur', 'ok') && all('brightness', 'ok');
  final resolutionBad = docs.any((d) => d.resolution?['ok'] == false);
  return [
    KycCheckStep('received', t('kyc.checking.received'), t('kyc.checking.receivedDetail', {'count': docs.length})),
    KycCheckStep('quality', t('kyc.checking.quality'), quality ? t('kyc.checking.qualityOk') : t('kyc.checking.qualityWarn'), warn: !quality),
    KycCheckStep(
      'resolution',
      t('kyc.checking.resolution'),
      resolutionBad ? t('kyc.checking.resolutionWarn') : t('kyc.checking.resolutionOk'),
      warn: resolutionBad,
    ),
    if (any('glare'))
      KycCheckStep('glare', t('kyc.checking.glare'), all('glare', 'ok') ? t('kyc.checking.glareOk') : t('kyc.checking.glareWarn'), warn: !all('glare', 'ok')),
    if (any('fill'))
      KycCheckStep(
        'framing',
        t('kyc.checking.framing'),
        all('fill', 'ok') ? t('kyc.checking.framingOk') : t('kyc.checking.framingWarn'),
        warn: !all('fill', 'ok'),
      ),
    if (any('mrz'))
      KycCheckStep('mrz', t('kyc.checking.mrz'), all('mrz', 'found') ? t('kyc.checking.mrzOk') : t('kyc.checking.mrzWarn'), warn: !all('mrz', 'found')),
    if (docs.any((d) => d.slot.kind == 'proof_of_address' || d.slot.kind == 'company_address'))
      KycCheckStep('poa', t('kyc.checking.poa'), t('kyc.checking.poaDetail')),
    if (any('face'))
      KycCheckStep('face', t('kyc.checking.face'), all('face', 'found') ? t('kyc.checking.faceOk') : t('kyc.checking.faceWarn'), warn: !all('face', 'found')),
    KycCheckStep('send', t('kyc.checking.send'), t('kyc.checking.sendDetail')),
  ];
}

/// A document's client checks flag something (web ReviewList `warn`): any `{ok: false}` or `{found: false}`.
bool clientChecksFlagged(KycDocument? d) {
  final c = d?.client;
  if (c == null) return false;
  return c.values.any((v) => v is Map && (v.containsKey('ok') ? v['ok'] == false : (v.containsKey('found') ? v['found'] == false : false)));
}

/* ------------------------------------------------------------------ data */

/// `POST kyc/<start|details|submit>` -> the new state.
Future<KycState> kycPost(ApiClient api, String action, Map<String, Object?> body) async =>
    KycState.fromJson(await api.post<Map<String, dynamic>>('kyc/$action', body: body));
