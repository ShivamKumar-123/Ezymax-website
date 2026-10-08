// Accounts data: the web's hooks for the Accounts pages (apps/crm/components/trading/api.ts usePoll / useAccounts /
// useGroups, same paths under /api/mobile/trading/… and the same poll intervals), the small answer shapes of the
// account dialogs (archive-check, closure, group-options, health), and the web's account rules (ui.tsx refillsLeft /
// demoTarget, archive.tsx accountFlavor / copyingName, ui.tsx LIVE_PASSWORD_RULES, extras.tsx newKey, the ⋯ menu
// entries of AccountActions).
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/format.dart';
import '../../core/lifecycle.dart';
import '../../core/models/account.dart';
import '../../core/models/trading.dart';
import '../../data/client_data.dart';
import '../../ui/ui.dart';

double _d(Object? v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
Map<String, dynamic>? _map(Object? v) => v is Map ? v.cast<String, dynamic>() : null;
List<Map<String, dynamic>> _maps(Object? v) => [
  for (final x in (v is List ? v : const []))
    if (x is Map) x.cast<String, dynamic>(),
];

List<EngineAccount> _accounts(Map<String, dynamic> j) => [for (final a in _maps(j['accounts'])) EngineAccount.fromJson(a)];

/* ------------------------------------------------------------------ providers (one per web hook) */

/// `GET trading/accounts` on the Accounts page (web useAccounts(): every 5 s).
final accountsPageProvider = FutureProvider.autoDispose<List<EngineAccount>>((ref) async {
  ref.pollEvery(const Duration(seconds: 5));
  return _accounts(await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/accounts'));
});

/// `GET trading/accounts` once (web useAccounts(0): the open-account wizard and the transfer between accounts).
final accountsOnceProvider = FutureProvider.autoDispose<List<EngineAccount>>((ref) async {
  return _accounts(await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/accounts'));
});

/// `GET trading/groups` (web useGroups(): no polling).
final groupsProvider = FutureProvider.autoDispose<List<EngineGroup>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/groups');
  return [for (final g in _maps(j['groups'])) EngineGroup.fromJson(g)];
});

/// `GET trading/accounts/{login}` (web account-detail usePoll: every 3 s).
final accountDetailProvider = FutureProvider.autoDispose.family<AccountDetail, int>((ref, login) async {
  ref.pollEvery(const Duration(seconds: 3));
  return AccountDetail.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/accounts/$login'));
});

/// `GET trading/accounts/{login}/history?limit=6` (web OverviewPanel recent deals: every 15 s).
final recentDealsProvider = FutureProvider.autoDispose.family<HistoryPage, int>((ref, login) async {
  ref.pollEvery(const Duration(seconds: 15));
  return HistoryPage.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/accounts/$login/history', query: {'limit': 6}));
});

/// `GET trading/accounts/{login}/health` (web HealthCard: every 30 s).
final accountHealthProvider = FutureProvider.autoDispose.family<AccountHealth, int>((ref, login) async {
  ref.pollEvery(const Duration(seconds: 30));
  return AccountHealth.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/accounts/$login/health'));
});

/// After a change (rename, archive, refill, …): every account list and detail refetches at once (web reload()).
void refreshAccountData(ProviderContainer c) {
  c
    ..invalidate(accountsProvider)
    ..invalidate(accountsPageProvider)
    ..invalidate(accountsOnceProvider)
    ..invalidate(accountDetailProvider);
}

/* ------------------------------------------------------------------ account fields the shared model keeps in `raw` */

extension AccountExtras on EngineAccount {
  /// The leverages the account's group allows.
  List<int> get leverages => [for (final l in (raw['leverages'] is List ? raw['leverages'] as List : const [])) _i(l)];
  int get marginCallLevel => _i(raw['marginCallLevel']);
  int get stopOutLevel => _i(raw['stopOutLevel']);

  /// The engine flags the account in margin call.
  bool get marginCall => raw['marginCall'] == true;

  /// Free funds that can leave the account (account currency).
  double get withdrawable => _d(raw['withdrawable']);
  DateTime? get archivedAt => DateTime.tryParse('${raw['archivedAt'] ?? ''}');
  DateTime? get closedAt => DateTime.tryParse('${raw['closedAt'] ?? ''}');
  DateTime? get updatedAt => DateTime.tryParse('${raw['updatedAt'] ?? ''}');

  /// The latest close-permanently request's status: pending | approved | rejected | cancelled (null: none).
  String? get closureStatus => _map(raw['closureRequest'])?['status'] as String?;

  /// Flagged dormant (no activity for the broker's dormancy period).
  bool get dormant => raw['dormantSince'] != null;
}

/* ------------------------------------------------------------------ the web's account rules */

/// Demo refills left today (web refillsLeft).
int refillsLeft(EngineAccount a) {
  final d = a.demo;
  if (d == null) return 0;
  return math.max(0, _i(d['refillsPerDay']) - _i(d['refillsUsedToday']));
}

/// The demo starting balance in the account currency (web demoTarget), null without demo terms.
double? demoTarget(EngineAccount a) => a.demo == null ? null : _d(a.demo!['initialBalance']);

/// The balance is at (or above) its starting amount: nothing to refill.
bool demoFull(EngineAccount a) {
  final target = demoTarget(a);
  return target != null && a.balance >= target;
}

/// Refill is off: busy elsewhere, none left today, balance full or the account expired (web RefillButton).
bool refillDisabled(EngineAccount a) => refillsLeft(a) == 0 || demoFull(a) || a.status == 'expired';

/// COPY / PAMM / MAM accounts by engine group code (web accountFlavor): copy | pamm | mam, or null.
String? accountFlavor(EngineAccount a) {
  final g = a.group.toLowerCase();
  bool isG(String code) => g == code || g.startsWith('$code-');
  if (isG('copy')) return 'copy';
  if (isG('pamm')) return 'pamm';
  if (isG('mam')) return 'mam';
  return null;
}

/// "Copy · Atlas FX" -> "Atlas FX": the strategy a copy account follows (web copyingName).
String? copyingName(EngineAccount a) {
  final m = RegExp(r'^\s*copy\s*[·:\-–]\s*(.+)$', caseSensitive: false).firstMatch(a.name);
  return m?.group(1)!.trim();
}

/// A live account that is the client's own money (prop challenges are simulated capital).
bool isOwnLive(EngineAccount a) => a.live && !a.prop;

/// The web's chip tones by name ('up' | 'down' | 'warn' | 'info' | 'gold' | 'ember' | anything -> neutral).
KChipTone chipToneOf(String? tone) => switch (tone) {
  'up' => KChipTone.up,
  'down' => KChipTone.down,
  'warn' => KChipTone.warn,
  'info' => KChipTone.info,
  'gold' => KChipTone.gold,
  'ember' => KChipTone.ember,
  _ => KChipTone.neutral,
};

/// Status chip tone (web STATUS_LABEL tones).
KChipTone statusTone(String status) => chipToneOf(kAccountStatus[status]?.tone ?? 'neutral');

/// "1:500" (en-US grouping).
String levLabel(int l) => '1:${Fmt.number(l, 0)}';

/* ------------------------------------------------------------------ passwords (engine: 8–64 characters, letters, digits) */

/// The trading-password rules (web LIVE_PASSWORD_RULES): key and catalog label.
const List<(String key, String labelKey)> kLivePasswordRules = [
  ('len', 'accounts.password.len'),
  ('letter', 'accounts.password.letter'),
  ('digit', 'accounts.password.digit'),
];

final RegExp _letter = RegExp(r'\p{L}', unicode: true);
final RegExp _digit = RegExp(r'\d');

/// Whether `p` passes the rule `key`.
bool livePasswordRule(String key, String p) => switch (key) {
  'len' => p.length >= 8 && p.length <= 64,
  'letter' => _letter.hasMatch(p),
  'digit' => _digit.hasMatch(p),
  _ => false,
};

/// Every rule passes (web livePasswordOk).
bool livePasswordOk(String p) => kLivePasswordRules.every((r) => livePasswordRule(r.$1, p));

/// A strong random password (web generatePassword): one of each set, then any, shuffled.
String generatePassword([int len = 12, math.Random? random]) {
  final r = random ?? math.Random.secure();
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#\$%&*?'];
  final all = sets.join();
  String pick(String s) => s[r.nextInt(s.length)];
  final chars = [for (final s in sets) pick(s)];
  while (chars.length < len) {
    chars.add(pick(all));
  }
  chars.shuffle(r);
  return chars.join();
}

/// A request id for money moves (web newKey: 32 hex characters).
String newIdempotencyKey() => const Uuid().v4().replaceAll('-', '').substring(0, 32);

/// A whole amount with up to two decimals, as the transfer between accounts accepts it.
bool isTwoDecimalAmount(String s) => RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(s);

/// The transfer between accounts can be sent (web TransferBetweenDialog `ok`): two different accounts and an amount
/// above zero, within the source's free funds (USD) and with at most two decimals.
bool transferBetweenOk({required int? from, required int? to, required String amount, required double availableUsd}) {
  final n = double.tryParse(amount);
  return from != null && to != null && to != from && n != null && n > 0 && n <= availableUsd + 1e-9 && isTwoDecimalAmount(amount);
}

/// The demo balance of your choice: 100 – 1,000,000 (web DemoBalanceDialog).
bool demoBalanceOk(String amount) {
  final n = double.tryParse(amount);
  return n != null && n.isFinite && n >= 100 && n <= 1000000;
}

/* ------------------------------------------------------------------ the ⋯ menu (web AccountActions) */

enum AccountMenuItem { details, defaultStar, leverage, changeType, moveBetween, demoBalance, passwords, statements, historyZip, rename, delete, close, restore }

/// What the ⋯ menu offers for this account, in the web's order. Live / demo / prop / copy-PAMM-MAM follow
/// AccountActions; an Options account has no leverage to change (option margin ignores it); archived and closed
/// accounts get the Archived row's actions (statements, the history ZIP and, for an archived one, Restore); a
/// view-only or read-only staff session gets nothing that changes the account.
List<AccountMenuItem> accountMenuItems(EngineAccount a, {bool readOnly = false}) {
  if (a.archived) {
    return [AccountMenuItem.details, AccountMenuItem.statements, AccountMenuItem.historyZip, if (!readOnly && a.status == 'archived') AccountMenuItem.restore];
  }
  if (readOnly) return const [];
  final special = a.prop || accountFlavor(a) != null;
  return [
    AccountMenuItem.details,
    AccountMenuItem.defaultStar,
    if (!a.isOptions) AccountMenuItem.leverage,
    if (!special) AccountMenuItem.changeType,
    if (a.live && !a.prop) AccountMenuItem.moveBetween,
    if (!a.live) AccountMenuItem.demoBalance,
    AccountMenuItem.passwords,
    AccountMenuItem.statements,
    AccountMenuItem.historyZip,
    AccountMenuItem.rename,
    if (!a.prop) AccountMenuItem.delete,
    if (!a.prop && a.live) AccountMenuItem.close,
  ];
}

/* ------------------------------------------------------------------ answers of the account dialogs */

/// A reason an action can't run (`{code, message}`), translated through `accounts.blocker.<code>` where known.
class Blocker {
  const Blocker(this.code, this.message);
  final String code, message;
  static List<Blocker> list(Object? v) => [for (final b in _maps(v)) Blocker('${b['code'] ?? ''}', '${b['message'] ?? ''}')];
}

/// One step of an archive / closure run.
class RunStep {
  const RunStep(this.step, this.ok, this.detail);
  final String step;
  final bool ok;
  final String? detail;
  static List<RunStep> list(Object? v) => [for (final s in _maps(v)) RunStep('${s['step'] ?? ''}', s['ok'] == true, s['detail'] as String?)];
}

/// `GET trading/accounts/{login}/archive-check`.
class ArchiveCheck {
  const ArchiveCheck({
    required this.kind,
    required this.positions,
    required this.orders,
    required this.balance,
    required this.credit,
    required this.bonus,
    required this.canArchive,
    required this.needsEmpty,
    required this.blockers,
  });
  final String kind;
  final int positions, orders;
  final double balance, credit, bonus;
  final bool canArchive, needsEmpty;
  final List<Blocker> blockers;

  int get trades => positions + orders;
  double get forfeit => credit + bonus;
  bool get blocked => blockers.isNotEmpty || !canArchive;

  static ArchiveCheck fromJson(Map<String, dynamic> j) => ArchiveCheck(
    kind: '${j['kind'] ?? 'live'}',
    positions: _i(j['positions']),
    orders: _i(j['orders']),
    balance: _d(j['balance']),
    credit: _d(j['credit']),
    bonus: _d(j['bonus']),
    canArchive: j['canArchive'] != false,
    needsEmpty: j['needsEmpty'] == true,
    blockers: Blocker.list(j['blockers']),
  );
}

/// `{ok, status?, steps?, request?}` of `archive` and `closure`.
class RunResult {
  const RunResult({required this.ok, required this.steps});
  final bool ok;
  final List<RunStep> steps;
  static RunResult fromJson(Map<String, dynamic> j) => RunResult(ok: j['ok'] == true, steps: RunStep.list(j['steps']));
}

/// A close-permanently request.
class ClosureRequest {
  const ClosureRequest({required this.id, required this.status, required this.createdAt, required this.decidedAt, required this.message, required this.source});
  final int id;

  /// pending | approved | rejected | cancelled
  final String status;
  final DateTime? createdAt, decidedAt;
  final String? message;

  /// client | staff
  final String source;

  static ClosureRequest? fromJson(Object? v) {
    final j = _map(v);
    if (j == null) return null;
    return ClosureRequest(
      id: _i(j['id']),
      status: '${j['status'] ?? 'pending'}',
      createdAt: DateTime.tryParse('${j['createdAt'] ?? ''}'),
      decidedAt: DateTime.tryParse('${j['decidedAt'] ?? ''}'),
      message: j['message'] as String?,
      source: '${j['source'] ?? 'client'}',
    );
  }
}

/// `GET trading/accounts/{login}/closure`.
class ClosureStatus {
  const ClosureStatus({
    required this.positions,
    required this.orders,
    required this.balance,
    required this.credit,
    required this.bonus,
    required this.needsEmpty,
    required this.canRequest,
    required this.blockers,
    required this.request,
  });
  final int positions, orders;
  final double balance, credit, bonus;
  final bool needsEmpty, canRequest;
  final List<Blocker> blockers;
  final ClosureRequest? request;

  int get trades => positions + orders;
  double get forfeit => credit + bonus;
  bool get blocked => blockers.isNotEmpty;
  bool get pending => request?.status == 'pending';

  static ClosureStatus fromJson(Map<String, dynamic> j) => ClosureStatus(
    positions: _i(j['positions']),
    orders: _i(j['orders']),
    balance: _d(j['balance']),
    credit: _d(j['credit']),
    bonus: _d(j['bonus']),
    needsEmpty: j['needsEmpty'] == true,
    canRequest: j['canRequest'] != false,
    blockers: Blocker.list(j['blockers']),
    request: ClosureRequest.fromJson(j['request']),
  );
}

/// The exit survey's reasons (web closure.tsx REASONS).
const List<String> kClosureReasons = ['costs', 'platform', 'performance', 'other_broker', 'stop_trading', 'too_many_accounts', 'service', 'other'];

/// An account type the account can move to (`GET trading/accounts/{login}/group-options`).
class GroupOption {
  const GroupOption({
    required this.code,
    required this.name,
    required this.mode,
    required this.minDeposit,
    required this.commissionPerLot,
    required this.allowed,
    required this.blocker,
    this.product = 'cfd',
  });
  final String code, name, mode;
  final double minDeposit, commissionPerLot;
  final bool allowed;
  final Blocker? blocker;

  /// cfd | options: an account never moves between the two (the engine's `product_mismatch`).
  final String product;

  static GroupOption fromJson(Map<String, dynamic> j) {
    final b = _map(j['blocker']);
    return GroupOption(
      code: '${j['code'] ?? ''}',
      name: '${j['name'] ?? j['code'] ?? ''}',
      mode: '${j['mode'] ?? 'hedging'}',
      minDeposit: _d(j['minDeposit']),
      commissionPerLot: _d(j['commissionPerLot']),
      allowed: j['allowed'] == true,
      blocker: b == null ? null : Blocker('${b['code'] ?? ''}', '${b['message'] ?? ''}'),
      product: EngineAccount.productOf(j['product']),
    );
  }
}

/// One line of the health card.
class HealthItem {
  const HealthItem(this.key, this.status, this.value);

  /// margin_level | stop_loss | margin_use | floating | results_30d
  final String key;

  /// good | warn | bad
  final String status;
  final Map<String, num?> value;
}

/// `GET trading/accounts/{login}/health`.
class AccountHealth {
  const AccountHealth({required this.score, required this.items});
  final int score;
  final List<HealthItem> items;

  static AccountHealth fromJson(Map<String, dynamic> j) => AccountHealth(
    score: _i(j['score']),
    items: [
      for (final i in _maps(j['items']))
        HealthItem('${i['key'] ?? ''}', '${i['status'] ?? 'good'}', {
          for (final e in (_map(i['value']) ?? const <String, dynamic>{}).entries) e.key: e.value is num ? e.value as num : null,
        }),
    ],
  );
}

/// Score tone: 75+ good, 45+ watch, else at risk (web HealthCard).
KChipTone healthScoreTone(int score) => score >= 75 ? KChipTone.up : (score >= 45 ? KChipTone.warn : KChipTone.down);

/// Line tone by status (web TONE).
KChipTone healthStatusTone(String status) => switch (status) {
  'good' => KChipTone.up,
  'warn' => KChipTone.warn,
  _ => KChipTone.down,
};
