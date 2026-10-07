// The USDT wallet (apps/crm/components/wallet-live/api.ts). Amounts stay strings end to end (display with
// Fmt.amount); only totals are computed.

class WalletBalance {
  const WalletBalance({required this.currency, required this.available, required this.locked});
  final String currency;
  final String available;
  final String locked;

  double get total => (double.tryParse(available) ?? 0) + (double.tryParse(locked) ?? 0);

  static WalletBalance fromJson(Map<String, dynamic> j) =>
      WalletBalance(currency: '${j['currency']}', available: '${j['available'] ?? '0'}', locked: '${j['locked'] ?? '0'}');
}

/// `GET wallet/overview`.
class WalletOverview {
  const WalletOverview({required this.balances, required this.pendingDeposits, required this.openWithdrawals, required this.raw});
  final List<WalletBalance> balances;
  final List<Map<String, dynamic>> pendingDeposits;
  final List<Map<String, dynamic>> openWithdrawals;
  final Map<String, dynamic> raw;

  WalletBalance get usdt => balances.firstWhere(
    (b) => b.currency == 'USDT',
    orElse: () => const WalletBalance(currency: 'USDT', available: '0', locked: '0'),
  );

  static WalletOverview fromJson(Map<String, dynamic> j) => WalletOverview(
    balances: [for (final b in (j['balances'] as List? ?? const [])) WalletBalance.fromJson((b as Map).cast<String, dynamic>())],
    pendingDeposits: [for (final d in (j['pending_deposits'] as List? ?? const [])) (d as Map).cast<String, dynamic>()],
    openWithdrawals: [for (final w in (j['open_withdrawals'] as List? ?? const [])) (w as Map).cast<String, dynamic>()],
    raw: j,
  );
}

/// A row of `GET wallet/activity?limit=`.
class WalletActivity {
  const WalletActivity({
    required this.type,
    required this.id,
    required this.status,
    required this.amount,
    required this.currency,
    required this.direction,
    required this.createdAt,
    this.network,
    this.login,
    this.kind,
  });

  /// deposit | withdrawal | transfer | other
  final String type;
  final String id;
  final String status;
  final String? amount;
  final String currency;

  /// in | out
  final String direction;
  final String? network;
  final int? login;
  final String? kind;
  final DateTime createdAt;

  static WalletActivity fromJson(Map<String, dynamic> j) => WalletActivity(
    type: '${j['type'] ?? 'other'}',
    id: '${j['id']}',
    status: '${j['status'] ?? ''}',
    amount: j['amount']?.toString(),
    currency: '${j['currency'] ?? 'USDT'}',
    direction: '${j['direction'] ?? 'in'}',
    network: j['network'] as String?,
    login: (j['login'] as num?)?.toInt(),
    kind: j['kind'] as String?,
    createdAt: DateTime.tryParse('${j['created_at']}') ?? DateTime.now(),
  );
}

/// A deposit network of `GET wallet/config`.
class ChainConfig {
  const ChainConfig({
    required this.chain,
    required this.network,
    required this.token,
    required this.minDeposit,
    required this.depositsEnabled,
    required this.withdrawalsEnabled,
  });

  /// bsc | tron
  final String chain;
  final String network;
  final String token;
  final String minDeposit;
  final bool depositsEnabled;
  final bool withdrawalsEnabled;

  static ChainConfig fromJson(Map<String, dynamic> j) => ChainConfig(
    chain: '${j['chain']}',
    network: '${j['network'] ?? ''}',
    token: '${j['token'] ?? 'USDT'}',
    minDeposit: '${j['min_deposit'] ?? '0'}',
    depositsEnabled: j['deposits_enabled'] == true,
    withdrawalsEnabled: j['withdrawals_enabled'] == true,
  );
}
