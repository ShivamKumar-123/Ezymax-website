// What it takes to actually get the bonus the dashboard is advertising. Port of the web's BonusSteps
// (apps/crm/components/growth/bonus-steps.tsx).
//
// A client reads "25% cashback on your first deposit" on the banner and has no way of knowing the rest: that
// a deposit campaign has to be claimed before the money arrives, that the bonus is paid onto a trading
// account rather than into the wallet, and that there is a minimum. The wording for all of it existed - but
// only inside the claim sheet, behind the very step nobody knew to take.
//
// So it is said in the two places a client is actually looking: under the banner that made the promise, and
// on the Deposit screen at the moment they are about to pay. It shows one of two things and otherwise
// nothing at all: a bonus already waiting for their deposit, or one that still has to be claimed first. When
// the broker turns on automatic granting the claim step disappears by itself, because this reads the
// client's own state rather than a script.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../env.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../rewards_api.dart';

/// Where this is being read, which decides the button: it points at the step still to do, and never at the
/// screen the client is already on.
enum BonusStepsOn { dashboard, deposit }

class BonusSteps extends ConsumerWidget {
  const BonusSteps({super.key, required this.on});
  final BonusStepsOn on;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    // the sample client has no campaigns of their own, and asking for some would only fail
    if (Env.preview || ref.watch(demoModeProvider)) return const SizedBox.shrink();
    final data = ref.watch(promotionsProvider).value;
    if (data == null) return const SizedBox.shrink();

    final deposits = data.campaigns.where((c) => c.kind == 'deposit').toList();
    final waiting = data.grants.where((g) => g.status == 'awaiting_deposit').firstOrNull;
    final campaign = waiting != null
        ? deposits.where((c) => c.id == waiting.campaignId).firstOrNull
        : deposits.where((c) => c.eligible && !c.claimed).firstOrNull;
    if (campaign == null) return const SizedBox.shrink();

    final f = GrowthFmt(t);
    final pct = '${GrowthFmt.plain(campaign.pct)}%';
    final min = f.usd0(campaign.minDeposit);
    final cap = f.usd0(campaign.cap);
    final claimed = waiting != null;

    // claim it, or - once that is done - go and deposit, unless that is this very screen
    final (String, String)? cta = !claimed
        ? ('/rewards/promotions', t('rewards.depositBonus.claimCta'))
        : on == BonusStepsOn.dashboard
        ? ('/wallet/deposit', t('rewards.depositBonus.depositCta'))
        : null;

    return KCard(
      color: k.emberSoft,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Icon(LucideIcons.badgePercent, size: 17, color: k.onEmber),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  claimed ? t('rewards.depositBonus.waitingTitle', {'pct': pct}) : t('rewards.depositBonus.offerTitle', {'pct': pct}),
                  style: context.text.headline.copyWith(fontWeight: FontWeight.w600, height: 1.2),
                ),
                const SizedBox(height: 2),
                Text(t('rewards.depositBonus.sub', {'pct': pct, 'min': min, 'cap': cap}), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12.5)),
                const SizedBox(height: 10),
                _Step(n: 1, done: claimed, text: t('rewards.depositBonus.stepClaim')),
                _Step(n: 2, text: t('rewards.depositBonus.stepDeposit', {'min': min})),
                // the step people miss: the bonus is paid onto a trading account, not into the wallet
                _Step(n: 3, text: t('rewards.depositBonus.stepTransfer')),
                _Step(n: 4, text: t('rewards.depositBonus.stepCredited', {'pct': pct})),
                const SizedBox(height: 8),
                Text(
                  t('rewards.depositBonus.release', {'amount': f.usd(campaign.releasePerLot), 'days': campaign.expiryDays}),
                  style: context.text.caption.copyWith(color: k.fg3, height: 1.35),
                ),
                if (cta != null) ...[
                  const SizedBox(height: 12),
                  KButton(
                    label: cta.$2,
                    size: KButtonSize.sm,
                    trailingIcon: Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight,
                    onPressed: () => context.go(cta.$1),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.text, this.done = false});
  final int n;
  final String text;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(color: done ? k.up : k.emberSoft, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: done
                ? const Icon(LucideIcons.check, size: 11, color: Colors.white)
                : Text(
                    '$n',
                    style: context.text.caption.copyWith(color: k.ember, fontSize: 10, fontWeight: FontWeight.w700, height: 1),
                  ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              text,
              style: context.text.footnote.copyWith(
                color: done ? k.fg3 : k.fg2,
                fontSize: 12.5,
                height: 1.35,
                decoration: done ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
