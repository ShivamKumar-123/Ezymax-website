// Wallet › Deposit: port of apps/crm/components/wallet-live/deposit-page.tsx (LiveDepositPage), phone order:
//   header (Deposit USDT + ← Wallet; "Deposit" when the broker also takes bank / crypto payments)
//   chooser: USDT · automatic | Bank / UPI | Crypto (only with manual payment methods; ?via=bank|crypto keeps it)
//   USDT · automatic:
//     step 1  network + amount            -> POST wallet/deposits/intents {chain, amount}
//     step 2  pay: open the deposit in MetaMask / TronLink (deep link: the app has no injected wallet, as the web on a
//             phone), or send manually to the address (copy, QR) and submit the hash -> POST wallet/deposits/submit
//     step 3  tracker: waiting -> confirmations -> credited (GET wallet/deposits/intents/{id} every 5 s)
//     how deposits work
//   Bank / UPI, Crypto (manual payments the broker verifies, widgets/manual_panels.dart):
//     method picker, payment details + QR, the request form (or "Request sent"), the requests, how it works
// `?intent=dep_…` resumes a deposit (the overview's in-progress rows link here; the page keeps it in the location)
// and selects USDT · automatic. With no manual methods the page is the USDT deposit alone.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'manual_api.dart';
import 'wallet_api.dart';
import 'widgets/deposit_panels.dart';
import 'widgets/manual_panels.dart';
import 'widgets/wallet_ui.dart';

class DepositScreen extends ConsumerStatefulWidget {
  const DepositScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  ConsumerState<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends ConsumerState<DepositScreen> {
  // the request id lives in state (the web mirrors it into ?intent=… so a reload resumes the same deposit)
  late String? _intentId = widget.query['intent'];

  // the way to pay the client chose (the web keeps it in ?via=…); null: the page's default
  late DepositVia? _picked = depositViaOf(widget.query['via']);

  @override
  void didUpdateWidget(DepositScreen old) {
    super.didUpdateWidget(old);
    if (old.query['intent'] != widget.query['intent']) _intentId = widget.query['intent'];
    if (old.query['via'] != widget.query['via']) _picked = depositViaOf(widget.query['via']) ?? _picked;
  }

  /// The request id is mirrored into the location (?intent=…), like the web's URL, so coming back to the Wallet
  /// tab resumes the same deposit.
  void _setIntent(String? id) {
    setState(() => _intentId = id);
    context.go(id == null ? '/wallet/deposit' : '/wallet/deposit?intent=$id');
  }

  /// Another way to pay: kept in the location too (?via=bank|crypto).
  void _choose(DepositVia v) {
    setState(() {
      _picked = v;
      _intentId = null;
    });
    context.go(v == DepositVia.usdt ? '/wallet/deposit' : '/wallet/deposit?via=${v.name}');
  }

  Future<void> _refresh() async {
    ref
      ..invalidate(walletCfgProvider)
      ..invalidate(manualMethodsProvider)
      ..invalidate(manualDepositsProvider);
    final id = _intentId;
    if (intentIdValid(id)) ref.invalidate(depositIntentProvider(id!));
    await Future.wait([
      ref.read(walletCfgProvider.future).then((_) {}, onError: (Object _) {}),
      ref.read(manualMethodsProvider.future).then((_) {}, onError: (Object _) {}),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final cfg = ref.watch(walletCfgProvider);
    final manual = ref.watch(manualMethodsProvider);
    final id = _intentId;
    final valid = intentIdValid(id);
    final view = valid ? ref.watch(depositIntentProvider(id!)) : null;

    // manual payment methods (none when the service has none, or this Client Area doesn't serve them yet)
    final methods = manual.value ?? ManualMethods.none;
    final bank = methods.of('bank');
    final crypto = methods.of('crypto');
    final hasManual = bank.isNotEmpty || crypto.isNotEmpty;
    final cfgPending = !cfg.hasValue && !cfg.hasError;
    final manualPending = !manual.hasValue && !manual.hasError;
    final autoOn = cfg.value?.chains.any((c) => c.depositsEnabled) ?? false;
    bool offered(DepositVia? v) => v == DepositVia.usdt || (v == DepositVia.bank && bank.isNotEmpty) || (v == DepositVia.crypto && crypto.isNotEmpty);
    final via = valid
        ? DepositVia.usdt
        : offered(_picked)
        ? _picked!
        : (autoOn || !hasManual || cfgPending ? DepositVia.usdt : (bank.isNotEmpty ? DepositVia.bank : DepositVia.crypto));
    final manualFailed = manual.hasError && !manual.hasValue && !_notServed(manual.error);

    Widget main;
    if (via != DepositVia.usdt) {
      main = ManualDepositPanel(
        key: ValueKey('manual-panel-${via.name}'),
        kind: via.name,
        methods: via == DepositVia.bank ? bank : crypto,
        maxPending: methods.maxPending,
        initialMethod: int.tryParse(widget.query['method'] ?? ''),
      );
    } else if (cfg.hasError && !cfg.hasValue) {
      main = WalletUnavailable(onRetry: () => ref.invalidate(walletCfgProvider));
    } else if (!cfg.hasValue || (view != null && !view.hasValue && !view.hasError) || (!autoOn && manualPending)) {
      main = const KSkeletonCard(height: 420, lines: 6);
    } else if (view == null && !autoOn && manualFailed) {
      // no automatic deposits, and the bank / crypto methods couldn't be read
      main = WalletUnavailable(onRetry: () => ref.invalidate(manualMethodsProvider), message: t('payments.error.loadFailed'));
    } else if (view != null && !view.hasValue) {
      final e = view.error;
      main = WalletUnavailable(
        onRetry: () => ref.invalidate(depositIntentProvider(id!)),
        message: e is ApiException && e.status == 404 ? t('wallet.deposit.notFound') : null,
      );
    } else if (view != null && view.requireValue.deposit != null) {
      main = DepositTracker(view: view.requireValue, onNew: () => _setIntent(null));
    } else if (view != null) {
      main = PayPanel(view: view.requireValue, onSubmitted: () => ref.invalidate(depositIntentProvider(id!)));
    } else {
      main = StartForm(cfg: cfg.requireValue, onCreated: (i) => _setIntent(i.id));
    }

    return KPageScroll(
      onRefresh: _refresh,
      children: [
        WalletHeader(
          title: hasManual ? t('payments.page.title') : t('wallet.depositUsdt'),
          subtitle: hasManual ? t('payments.page.subtitle') : t('wallet.deposit.subtitle'),
          actions: const [BackToWallet()],
        ),
        if (!valid && !cfgPending) DepositChooser(value: via, onChanged: _choose, usdt: autoOn, bank: bank.isNotEmpty, crypto: crypto.isNotEmpty),
        main,
        if (via != DepositVia.usdt)
          ...[const SizedBox(height: kWalletGap), const ManualHowItWorks()]
        else if (cfg.hasValue)
          ...[const SizedBox(height: kWalletGap), HowItWorks(cfg: cfg.requireValue)],
      ],
    );
  }

  /// The Client Area doesn't serve manual payments (an older server, or the module is off): the page stays the USDT
  /// deposit, without an error.
  static bool _notServed(Object? e) => e is ApiException && (e.status == 404 || e.isModuleDisabled);
}
