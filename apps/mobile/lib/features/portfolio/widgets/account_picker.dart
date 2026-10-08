// The account picker pages (port of apps/crm/components/trading/portfolio.tsx AccountPicker, useSelectedAccount and
// PickerPage): Trade history, Ledger and Statements show one account at a time, chosen from a sideways row of
// account chips. `?account=` (or `?login=`) picks the first one; archived accounts stay selectable but are never
// the default.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/models/account.dart';
import '../../../data/client_data.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../portfolio_logic.dart';
import 'portfolio_bits.dart';

/// The sideways row of accounts (web AccountPicker).
class AccountPicker extends StatelessWidget {
  const AccountPicker({super.key, required this.accounts, required this.value, required this.onChanged});
  final List<EngineAccount> accounts;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return SizedBox(
      height: 58,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: accounts.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final a = accounts[i];
          final on = a.login == value;
          return KPressable(
            pressedScale: 0.97,
            semanticLabel: '#${a.login}',
            onTap: () {
              if (on) return;
              KHaptics.selection();
              onChanged(a.login);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: on ? k.emberSoft : k.cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: on ? k.ember.withValues(alpha: 0.5) : k.cardBorder),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  KindBadge(account: a),
                  const SizedBox(width: 10),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '#${a.login}',
                        textDirection: TextDirection.ltr,
                        style: context.text.mono(13, color: k.fg),
                      ),
                      Text(
                        accountTitle(t, a),
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A page over one chosen account (web PickerPage): header, loading / error / no accounts, the picker and the
/// account's content.
class PickerPage extends ConsumerStatefulWidget {
  const PickerPage({super.key, required this.query, required this.title, required this.subtitle, required this.builder, this.onRefresh});
  final Map<String, String> query;
  final String title, subtitle;
  final Widget Function(EngineAccount account) builder;

  /// Also reload the content's own data on pull to refresh.
  final void Function(WidgetRef ref)? onRefresh;

  @override
  ConsumerState<PickerPage> createState() => _PickerPageState();
}

class _PickerPageState extends ConsumerState<PickerPage> {
  late int? _wanted = wantedLogin(widget.query);

  @override
  void didUpdateWidget(PickerPage old) {
    super.didUpdateWidget(old);
    final w = wantedLogin(widget.query);
    if (w != wantedLogin(old.query) && w != null) _wanted = w;
  }

  Future<void> _refresh() async {
    widget.onRefresh?.call(ref);
    ref.invalidate(accountsProvider);
    await ref.read(accountsProvider.future).then((_) {}, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    final acc = ref.watch(accountsProvider);
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final accounts = acc.value ?? const <EngineAccount>[];
    final a = pickAccount(accounts, _wanted);
    return KPageScroll(
      onRefresh: _refresh,
      children: [
        KPageHeader(title: widget.title, subtitle: Text(widget.subtitle)),
        const SizedBox(height: 18),
        if (!acc.hasValue && !acc.hasError) const KSkeleton(height: 360, radius: 20),
        if (!acc.hasValue && acc.hasError) AccountsError(onRetry: () => ref.invalidate(accountsProvider)),
        if (acc.hasValue && accounts.isEmpty) NoAccounts(readOnly: readOnly),
        if (a != null) ...[
          AccountPicker(accounts: accounts, value: a.login, onChanged: (l) => setState(() => _wanted = l)),
          const SizedBox(height: 14),
          KeyedSubtree(key: ValueKey(a.login), child: widget.builder(a)),
        ],
      ],
    );
  }
}
