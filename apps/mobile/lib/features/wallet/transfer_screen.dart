// Wallet › Transfer: port of apps/crm/components/wallet-live/transfer-page.tsx (LiveTransferPage), phone order:
//   header (Transfer + Move to another account (two or more live accounts) + ← Wallet)
//   new transfer: direction (Wallet → account / Account → wallet), the wallet, the live account picker (prop
//   challenges excluded), amount (Max), Transfer -> POST wallet/transfers/to-trading | from-trading
//   {login, amount, idempotency_key}
//   recent transfers
// `?to=<login>` / `?from=<login>` preselect the account and the direction (the web's search params).
// Data: overview every 10 s, transfers?limit=15 every 10 s, accounts every 10 s.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/format.dart';
import '../../core/models/account.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import '../accounts/account_actions.dart';
import 'wallet_api.dart';
import 'widgets/wallet_ui.dart';

class TransferScreen extends ConsumerStatefulWidget {
  const TransferScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  ConsumerState<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends ConsumerState<TransferScreen> {
  static const int _ms = 10000;

  late String _dir = widget.query['from'] != null ? 'from' : 'to';
  late int? _login = int.tryParse(widget.query['to'] ?? widget.query['from'] ?? '');
  final _amount = TextEditingController();
  bool _busy = false;
  String? _err;
  String _key = requestId();

  @override
  void didUpdateWidget(TransferScreen old) {
    super.didUpdateWidget(old);
    if (old.query['to'] != widget.query['to'] || old.query['from'] != widget.query['from']) {
      _dir = widget.query['from'] != null ? 'from' : 'to';
      _login = int.tryParse(widget.query['to'] ?? widget.query['from'] ?? '');
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit(EngineAccount account, double max) async {
    final amt = _amount.text.trim();
    if (!transferAmountOk(amt, max) || _busy) return;
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    final to = _dir == 'to';
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final r = await ref
          .read(apiProvider)
          .post<Map<String, dynamic>>(
            to ? 'wallet/transfers/to-trading' : 'wallet/transfers/from-trading',
            body: {'login': account.login, 'amount': amt, 'idempotency_key': _key},
          );
      final x = TradingTransfer.fromJson((r['transfer'] as Map).cast<String, dynamic>());
      if (x.status == 'completed') {
        notes.toast(
          NotificationKind.success,
          t('wallet.transferCompleted'),
          description: to
              ? t('wallet.transfer.movedToAccount', {'amount': fmt(amt), 'login': account.login})
              : t('wallet.transfer.movedToWallet', {'amount': fmt(amt)}),
        );
      } else {
        notes.toast(NotificationKind.info, t('wallet.transfer.processing'), description: t('wallet.transfer.processingText'));
      }
      _amount.clear();
      _key = requestId();
      refreshWalletData(ref);
    } catch (e) {
      if (mounted) setState(() => _err = walletErrorText(e, t, fallback: t('wallet.transfer.failed')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _between() async {
    final moved = await showTransferBetweenSheet(context);
    if (moved && mounted) ref.invalidate(walletAccountsProvider(_ms));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final o = ref.watch(walletOverviewEveryProvider(_ms));
    final list = ref.watch(tradingTransfersProvider);
    final acc = ref.watch(walletAccountsProvider(_ms));
    final accounts = acc.value;
    // prop-challenge accounts take no wallet transfers (simulated capital), so they are not offered here
    final live = (accounts ?? const <EngineAccount>[]).where(isTransferable).toList();
    final login = _login ?? (live.length == 1 ? live.first.login : null);
    final account = live.where((a) => a.login == login).firstOrNull;
    final walletAvail = double.tryParse(o.value?.usdt.available ?? '') ?? 0;
    final max = _dir == 'to' ? walletAvail : (account == null ? 0.0 : withdrawableUsd(account));
    final valid = account != null && transferAmountOk(_amount.text, max);
    final between = (accounts ?? const <EngineAccount>[]).where(isBetweenEligible).length >= 2;

    return KPageScroll(
      onRefresh: () async {
        refreshWalletData(ref);
        await ref.read(walletOverviewEveryProvider(_ms).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        WalletHeader(
          title: t('common.transfer'),
          subtitle: t('wallet.transfer.subtitle'),
          actions: [
            // B9: live -> live between the client's own accounts (two idempotent legs through the wallet)
            if (between) KButton(label: t('accounts.between.menu'), icon: LucideIcons.arrowLeftRight, variant: KButtonVariant.surface, onPressed: _between),
            const BackToWallet(),
          ],
        ),
        if (o.hasError && !o.hasValue)
          WalletUnavailable(onRetry: () => ref.invalidate(walletOverviewEveryProvider(_ms)))
        else ...[
          KCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KCardHeader(title: t('wallet.newTransfer')),
                const SizedBox(height: 12),
                KSegmented<String>(
                  values: const ['to', 'from'],
                  labels: [t('wallet.transfer.walletToAccount'), t('wallet.transfer.accountToWallet')],
                  selected: _dir,
                  onChanged: (v) => setState(() {
                    _dir = v;
                    _err = null;
                  }),
                ),
                const SizedBox(height: 16),
                WalletRow(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _dir == 'to' ? t('wallet.from') : t('wallet.to'),
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                            ),
                            Text(t('wallet.transfer.walletUsdt'), style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                      Text(
                        o.hasValue ? '${fmt(walletAvail)} USDT' : '—',
                        textDirection: TextDirection.ltr,
                        style: context.text.headline.copyWith(fontSize: 14, fontFeatures: kTabular),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Center(
                  child: AnimatedRotation(
                    turns: _dir == 'from' ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(LucideIcons.arrowDown, size: 16, color: k.fg3),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _dir == 'to' ? t('wallet.transfer.toTradingAccount') : t('wallet.transfer.fromTradingAccount'),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                ),
                const SizedBox(height: 8),
                if (accounts == null && !acc.hasError) const KSkeleton(height: 64, radius: 14),
                if (accounts != null && live.isEmpty)
                  KEmptyState(
                    compact: true,
                    icon: LucideIcons.rocket,
                    title: t('wallet.transfer.noLiveTitle'),
                    text: t('wallet.transfer.noLiveText'),
                    action: KButton(label: t('wallet.transfer.openLive'), onPressed: () => context.go('/accounts/new?type=live')),
                  ),
                for (var i = 0; i < live.length; i++) ...[
                  if (i > 0) const SizedBox(height: 8),
                  _AccountOption(a: live[i], selected: live[i].login == login, onTap: () => setState(() => _login = live[i].login)),
                ],
                const SizedBox(height: 16),
                KTextField(
                  label: t('common.amount'),
                  controller: _amount,
                  placeholder: '0.00',
                  ltr: true,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [amountFormatter],
                  onChanged: (_) => setState(() {}),
                  trailing: KTextButton(label: t('wallet.max'), onPressed: () => setState(() => _amount.text = maxAmount(max))),
                ),
                FieldHint(
                  account != null
                      ? '${t('wallet.transfer.upTo', {'amount': fmt(max), 'currency': _dir == 'to' ? 'USDT' : 'USD'})}${account.cent || account.currency == 'USC' ? t('wallet.transfer.centNote') : ''}'
                      : t('wallet.transfer.creditedNote'),
                ),
                WalletInlineError(_err, top: 14),
                const SizedBox(height: 18),
                KButton(
                  label: t('common.transfer'),
                  icon: LucideIcons.arrowLeftRight,
                  size: KButtonSize.lg,
                  expand: true,
                  loading: _busy,
                  onPressed: valid ? () => _submit(account, max) : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: kWalletGap),
          _RecentTransfers(list: list.value),
        ],
      ],
    );
  }
}

/// A live account of the picker (web AccountPicker button).
class _AccountOption extends StatelessWidget {
  const _AccountOption({required this.a, required this.selected, required this.onTap});
  final EngineAccount a;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cent = a.cent || a.currency == 'USC';
    return Semantics(
      selected: selected,
      button: true,
      child: WalletRow(
        key: ValueKey('account-${a.login}'),
        selected: selected,
        onTap: onTap,
        child: Row(
          children: [
            const LiveBadge(),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${a.groupName} '),
                        TextSpan(
                          text: '#${a.login}',
                          style: context.text.mono(12, color: k.fg3),
                        ),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500),
                  ),
                  Text(
                    '${t('common.balance')} ${cent ? 'USC ' : r'$'}${fmt(a.balance)} · ${t('wallet.transfer.withdrawable', {'amount': fmt(withdrawableUsd(a))})}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentTransfers extends StatelessWidget {
  const _RecentTransfers({required this.list});
  final WalletPage<TradingTransfer>? list;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = LocaleFormat(t.locale);
    final data = list;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('wallet.recentTransfers')),
          const SizedBox(height: 12),
          if (data == null) const KSkeleton(height: 64, radius: 14),
          if (data != null && data.items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
              child: Text(t('wallet.transfer.none'), style: context.text.callout.copyWith(color: k.fg3, fontSize: 13)),
            ),
          if (data != null)
            for (var i = 0; i < data.items.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              Builder(
                builder: (context) {
                  final x = data.items[i];
                  final failed = x.status == 'failed';
                  final toTrading = x.direction == 'to_trading';
                  return WalletRow(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(
                                    toTrading ? t('wallet.transfer.toLogin', {'login': x.login}) : t('wallet.transfer.fromLogin', {'login': x.login}),
                                    style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500),
                                  ),
                                  if (x.status != 'completed')
                                    WalletStatusChip((tone: failed ? KChipTone.down : KChipTone.warn, label: failed ? 'common.failed' : 'common.processing')),
                                ],
                              ),
                              Text(
                                '${f.dateTime(x.createdAt)}${failed && x.errorMessage != null ? ' · ${x.errorMessage}' : ''}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${toTrading ? '−' : '+'}${fmt(x.amount)}',
                          textDirection: TextDirection.ltr,
                          style: context.text.label.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            fontFeatures: kTabular,
                            color: failed ? k.fg3 : (!toTrading ? k.up : k.fg),
                            decoration: failed ? TextDecoration.lineThrough : null,
                            decorationColor: k.fg3,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
        ],
      ),
    );
  }
}
