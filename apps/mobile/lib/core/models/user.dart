// The signed-in client (gateway `GET /v1/auth/me`, the web's GatewayUser in apps/crm/lib/gateway.ts).

/// KYC states (users.kyc_status).
enum KycStatus { unverified, pending, verified, rejected }

class ViewerScope {
  const ViewerScope({required this.id, required this.label, required this.sections});
  final int id;
  final String label;

  /// Sections the view-only login was given (wallet, accounts, …); empty = everything read-only.
  final List<String> sections;

  static ViewerScope? fromJson(Object? j) {
    if (j is! Map) return null;
    return ViewerScope(
      id: (j['id'] as num?)?.toInt() ?? 0,
      label: '${j['label'] ?? j['name'] ?? ''}',
      sections: (j['sections'] ?? j['scope'] ?? const []) is List ? [for (final s in (j['sections'] ?? j['scope'] ?? const []) as List) '$s'] : const [],
    );
  }
}

class SessionUser {
  const SessionUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.name,
    required this.kycStatus,
    required this.emailVerified,
    required this.createdAt,
    this.phoneDial = '',
    this.phone = '',
    this.country = '',
    this.dateOfBirth = '',
    this.kycCaseStatus,
    this.referralCode = '',
    this.tenantName = 'Ezymex',
    this.viewer,
    this.idleMinutes,
    this.readOnlyStaff = false,
    this.raw = const {},
  });

  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String name;
  final String phoneDial;
  final String phone;
  final String country;
  final String dateOfBirth;
  final KycStatus kycStatus;

  /// Latest KYC case: draft | submitted | in_review | more_info | approved | rejected (null before it starts).
  final String? kycCaseStatus;
  final bool emailVerified;
  final String referralCode;
  final DateTime createdAt;
  final String tenantName;

  /// A view-only session (D90): read-only, limited to the scope.
  final ViewerScope? viewer;

  /// The broker's idle sign-out time.
  final int? idleMinutes;

  /// A Back Office "log in as client" session in read-only mode.
  final bool readOnlyStaff;

  /// The whole answer, for fields later screens need.
  final Map<String, dynamic> raw;

  /// Pages hide their account actions (the servers refuse them anyway): web useReadOnly().
  bool get readOnly => viewer != null || readOnlyStaff;

  /// "KL-000123" (the dashboard's client id).
  String get clientId => 'KL-${id.toString().padLeft(6, '0')}';

  /// Parses `me` ({user, viewer, session, impersonation, …}) or the bare user object of a sign-in answer.
  static SessionUser fromJson(Map<String, dynamic> j) {
    final u = j['user'] is Map ? (j['user'] as Map).cast<String, dynamic>() : j;
    final session = j['session'] is Map ? j['session'] as Map : (u['session'] is Map ? u['session'] as Map : null);
    final imp = j['impersonation'] is Map ? j['impersonation'] as Map : null;
    final first = '${u['first_name'] ?? ''}';
    final last = '${u['last_name'] ?? ''}';
    return SessionUser(
      id: (u['id'] as num?)?.toInt() ?? 0,
      email: '${u['email'] ?? ''}',
      firstName: first,
      lastName: last,
      name: '${u['name'] ?? '$first $last'.trim()}',
      phoneDial: '${u['phone_dial'] ?? ''}',
      phone: '${u['phone'] ?? ''}',
      country: '${u['country'] ?? ''}',
      dateOfBirth: '${u['date_of_birth'] ?? ''}',
      kycStatus: KycStatus.values.firstWhere((s) => s.name == u['kyc_status'], orElse: () => KycStatus.unverified),
      kycCaseStatus: u['kyc_case_status'] as String?,
      emailVerified: u['email_verified'] == true,
      referralCode: '${u['referral_code'] ?? ''}',
      createdAt: DateTime.tryParse('${u['created_at']}') ?? DateTime.now(),
      tenantName: u['tenant'] is Map ? '${(u['tenant'] as Map)['name'] ?? 'Ezymex'}' : 'Ezymex',
      viewer: ViewerScope.fromJson(j['viewer'] ?? u['viewer']),
      idleMinutes: (session?['idle_minutes'] as num?)?.toInt(),
      readOnlyStaff: imp?['mode'] == 'read_only',
      raw: j,
    );
  }
}
