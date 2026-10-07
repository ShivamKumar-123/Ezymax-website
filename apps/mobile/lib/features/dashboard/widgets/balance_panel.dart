// Total balance with the money actions (web components/dashboard/home/balance-panel.tsx BalancePanel): the figure
// in large type, the change chip, then Deposit / Withdraw (near-black ink) and Transfer funds under them.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

class BalancePanel extends StatelessWidget {
  const BalancePanel({super.key, required this.total, required this.loading, this.changePct, this.readOnly = false, this.hidden = false});

  /// Live accounts' equity + wallet (USD); null when unknown.
  final double? total;
  final bool loading;

  /// Today's change in percent (from the reports curve).
  final double? changePct;
  final bool readOnly;
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Column(
      children: [
        Text(
          t('dashboard.home.totalBalance'),
          style: context.text.headline.copyWith(fontWeight: FontWeight.w500, color: k.fg2),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 44,
          child: Center(
            child: total == null
                ? (loading ? const KSkeleton(width: 220, height: 38, radius: 12) : Text('—', style: context.text.moneyXL))
                : FittedBox(
                    fit: BoxFit.scaleDown,
                    child: KMoney(total!, style: context.text.moneyXL, hidden: hidden),
                  ),
          ),
        ),
        if (changePct != null) ...[
          const SizedBox(height: 14),
          KChangeChip('${changePct! >= 0 ? '+' : ''}${changePct!.toStringAsFixed(2)}%', up: changePct! >= 0),
        ],
        const SizedBox(height: 8),
        Text(
          t('dashboard.home.totalBalanceSub'),
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
        ),
        if (!readOnly) ...[
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: KButton(
                  label: t('common.deposit'),
                  trailingIcon: LucideIcons.arrowDownToLine,
                  variant: KButtonVariant.ink,
                  size: KButtonSize.lg,
                  expand: true,
                  onPressed: () => context.go('/wallet/deposit'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: KButton(
                  label: t('common.withdraw'),
                  trailingIcon: LucideIcons.arrowUpFromLine,
                  variant: KButtonVariant.ink,
                  size: KButtonSize.lg,
                  expand: true,
                  onPressed: () => context.go('/wallet/withdraw'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          KButton(
            label: t('dashboard.home.transferFunds'),
            icon: rtl ? LucideIcons.arrowRightLeft : LucideIcons.arrowLeftRight,
            variant: KButtonVariant.surface,
            expand: true,
            onPressed: () => context.go('/wallet/transfer'),
          ),
        ],
      ],
    );
  }
}

/// Round pastel shortcuts and the dashed "+" to open an account (web QuickActions).
class QuickActions extends StatelessWidget {
  const QuickActions({super.key, required this.items});
  final List<({String label, IconData icon, KTone tone, VoidCallback onTap})> items;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    Widget cell({required Widget circle, required String label, required VoidCallback onTap}) => Expanded(
      child: KPressable(
        onTap: onTap,
        child: Column(
          children: [
            circle,
            const SizedBox(height: 8),
            Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w600, height: 1.2),
            ),
          ],
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KSectionTitle(t('dashboard.home.quickActions')),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final q in items.take(4))
              cell(
                circle: KIconTile(icon: q.icon, tone: q.tone, size: 52, circle: true, iconSize: 21),
                label: q.label,
                onTap: q.onTap,
              ),
            cell(
              circle: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: k.fg3.withValues(alpha: 0.4), width: 2),
                ),
                child: Icon(LucideIcons.plus, size: 20, color: k.fg3),
              ),
              label: t('dashboard.accounts.open'),
              onTap: () => GoRouter.of(context).go('/accounts/new'),
            ),
          ],
        ),
      ],
    );
  }
}
