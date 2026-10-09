// Staking › History (/staking/history): subscriptions, monthly returns (month · rate · days), principal returned and
// failed payments, newest first, 20 a page with the pager; amounts signed as the wallet saw them (a subscription
// out, a return or the principal in, a failed payment moved nothing). Polls every 60 s.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'staking_api.dart';
import 'widgets/position_sheet.dart';
import 'widgets/staking_ui.dart';

class StakingHistoryScreen extends ConsumerStatefulWidget {
  const StakingHistoryScreen({super.key});

  @override
  ConsumerState<StakingHistoryScreen> createState() => _StakingHistoryScreenState();
}

class _StakingHistoryScreenState extends ConsumerState<StakingHistoryScreen> {
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final async = ref.watch(stakingHistoryProvider(_page));
    final data = async.value;
    final pages = data?.pages ?? 1;

    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(stakingHistoryProvider(_page));
        await ref.read(stakingHistoryProvider(_page).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('staking.history.title'), subtitle: Text(t('staking.history.subtitle'))),
        const SizedBox(height: 20),
        if (async.hasError && data == null)
          StakingLoadError(error: async.error, onRetry: () => ref.invalidate(stakingHistoryProvider(_page)))
        else
          KCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (data == null) KSkeleton.lines(8, height: 40, gap: 10),
                if (data != null && data.items.isEmpty) KEmptyState(compact: true, art: KIllustrationName.emptyHistory, title: t('staking.history.empty')),
                if (data != null)
                  for (var i = 0; i < data.items.length; i++) ...[if (i > 0) const KDivider(indent: 52), StakingEventRow(e: data.items[i])],
                if (data != null && pages > 1) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _PageButton(
                        icon: rtl ? LucideIcons.chevronRight : LucideIcons.chevronLeft,
                        label: t('staking.history.prev'),
                        onPressed: _page <= 1 ? null : () => setState(() => _page--),
                      ),
                      Expanded(
                        child: Text(
                          t('staking.history.page', {'page': _page, 'pages': pages}),
                          textAlign: TextAlign.center,
                          style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
                        ),
                      ),
                      _PageButton(
                        icon: rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
                        label: t('staking.history.next'),
                        onPressed: _page >= pages ? null : () => setState(() => _page++),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

/// One event: what happened, the plan (and for a return its month, rate and days), when, and the signed amount.
class StakingEventRow extends StatelessWidget {
  const StakingEventRow({super.key, required this.e});
  final StakingEvent e;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final detail = e.kind == 'reward'
        ? t('staking.history.rewardDetail', {
            'month': stakingMonth(t, e.period),
            'rate': e.ratePct == null ? '—' : stakingRate(t, e.ratePct!),
            'days': t('staking.history.days', {'count': e.days ?? 0}),
          })
        : null;
    final tone = switch (e.sign) {
      1 => k.up,
      -1 => k.fg,
      _ => k.fg3,
    };
    return KPressable(
      onTap: e.positionId > 0 ? () => showPositionSheet(context, id: e.positionId) : null,
      pressedScale: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            KIconTile(icon: stakingEventIcon(e.kind), tone: stakingEventTone(e.kind)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.dyn('staking.history.kind.${e.kind}', fallback: e.kind.replaceAll('_', ' ')),
                    style: context.text.label.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [e.planName, ?detail].join(' · '),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    stakingDate(t, e.at),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              stakingSigned(e.amount, e.currency, e.sign),
              textDirection: TextDirection.ltr,
              style: context.text.figure.copyWith(fontSize: 14, color: tone),
            ),
          ],
        ),
      ),
    );
  }
}

/// The pager's round previous / next button, dimmed when there is no page that way.
class _PageButton extends StatelessWidget {
  const _PageButton({required this.icon, required this.label, required this.onPressed});
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: onPressed == null ? 0.4 : 1,
    child: KIconButton(icon: icon, size: 32, filled: true, semanticLabel: label, onPressed: onPressed),
  );
}
