// The client's bank / UPI / crypto deposit requests (port of apps/crm/components/wallet-live/manual/requests.tsx):
// newest first, 10 more per "Show more", polled every 20 s; the status, the amount paid, the USDT credited (or
// expected), the rejection reason, the screenshot, and Cancel (with a confirmation) while a request waits for review.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/format/format.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../manual_api.dart';
import '../wallet_api.dart';
import 'wallet_ui.dart';

/// "Deposit requests" (web RequestsList).
class ManualRequestsList extends ConsumerStatefulWidget {
  const ManualRequestsList({super.key});

  @override
  ConsumerState<ManualRequestsList> createState() => _ManualRequestsListState();
}

class _ManualRequestsListState extends ConsumerState<ManualRequestsList> {
  int _limit = kManualPer;

  /// The last answer, kept on screen while a longer list loads.
  ManualDepositsPage? _last;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final async = ref.watch(manualDepositsProvider(_limit));
    if (async.hasValue) _last = async.value;
    final data = async.value ?? _last;
    final more = data != null && data.total > data.items.length && _limit < kManualMaxLimit;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('payments.list.title'), subtitle: t('payments.list.subtitle')),
          if (data != null && data.pending > 0) ...[
            const SizedBox(height: 6),
            Text(
              t('payments.list.pendingCount', {'count': data.pending, 'max': data.maxPending}),
              key: const ValueKey('manual-pending-count'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
            ),
          ],
          const SizedBox(height: 14),
          if (data == null && !async.hasError) const KSkeleton(height: 112, radius: 14),
          if (data == null && async.hasError) ...[
            WalletInlineError(manualErrorText(async.error, t, fallback: t('wallet.error.generic'))),
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KButton(
                label: t('common.retry'),
                icon: LucideIcons.rotateCw,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: () => ref.invalidate(manualDepositsProvider(_limit)),
              ),
            ),
          ],
          if (data != null && data.items.isEmpty)
            KEmptyState(compact: true, art: KIllustrationName.emptyHistory, title: t('payments.list.empty'), text: t('payments.list.emptyText')),
          if (data != null)
            for (var i = 0; i < data.items.length; i++) ...[if (i > 0) const SizedBox(height: 8), ManualRequestRow(key: ValueKey('manual-request-${data.items[i].id}'), d: data.items[i])],
          if (more) ...[
            const SizedBox(height: 10),
            Center(
              child: KButton(
                label: t('payments.list.more'),
                variant: KButtonVariant.ghost,
                size: KButtonSize.sm,
                loading: !async.hasValue,
                onPressed: !async.hasValue ? null : () => setState(() => _limit = (_limit + kManualPer).clamp(kManualPer, kManualMaxLimit)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// One request (web RequestRow).
class ManualRequestRow extends ConsumerStatefulWidget {
  const ManualRequestRow({super.key, required this.d});
  final ManualDeposit d;

  @override
  ConsumerState<ManualRequestRow> createState() => _ManualRequestRowState();
}

class _ManualRequestRowState extends ConsumerState<ManualRequestRow> {
  bool _confirm = false;
  bool _busy = false;
  String? _err;

  Future<void> _cancel() async {
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      await cancelManualDeposit(ref.read(apiProvider), widget.d.id);
      notes.toast(NotificationKind.success, t('payments.list.cancelled'));
      if (mounted) ref.invalidate(manualDepositsProvider);
    } catch (e) {
      if (mounted) setState(() => _err = manualErrorText(e, t, fallback: t('wallet.error.generic')));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _confirm = false;
        });
      }
    }
  }

  void _showProof(String id) => showKSheet<void>(
    context,
    title: context.t('payments.list.screenshot'),
    builder: (_) => _ProofView(id: id),
  );

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final d = widget.d;
    final st = kManualStatus[d.status];
    final dim = d.status == 'rejected' || d.status == 'cancelled';
    final small = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11.5);
    final ref0 = d.reference.length > 24 ? shortHash(d.reference, 10, 8) : d.reference;
    final proof = manualMediaId(d.proofUrl);
    final (Color bg, Color border, Color fg) = dim ? (k.surface3, k.line, k.fg3) : (k.upSoft, k.up.withValues(alpha: 0.25), k.up);
    return WalletRow(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: bg,
                  shape: BoxShape.circle,
                  border: Border.all(color: border),
                ),
                child: Icon(d.kind == 'bank' ? LucideIcons.landmark : LucideIcons.wallet, size: 16, color: fg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(d.method.name, style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500)),
                        if (st != null) WalletStatusChip(st),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${LocaleFormat(t.locale).dateTime(d.createdAt)} · ${t('payments.list.ref', {'ref': manualLtr(t, ref0)})}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: small,
                    ),
                    if (d.status == 'rejected' && d.reason != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        t('payments.list.reason', {'reason': d.reason}),
                        style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w400, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    manualMoney(d.amount, d.currency),
                    textDirection: TextDirection.ltr,
                    style: context.text.label.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      fontFeatures: kTabular,
                      color: dim ? k.fg3 : k.fg,
                      decoration: dim ? TextDecoration.lineThrough : null,
                      decorationColor: k.fg3,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    d.status == 'approved' && d.creditAmount != null
                        ? t('payments.list.credited', {'amount': manualLtr(t, decimalDisplay(d.creditAmount!))})
                        : t('payments.list.expected', {'amount': manualLtr(t, decimalDisplay(d.expectedCredit))}),
                    style: small.copyWith(color: d.status == 'approved' ? k.up : k.fg3, fontFeatures: kTabular),
                  ),
                ],
              ),
            ],
          ),
          if (proof != null || d.pending) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                if (proof != null)
                  KTextButton(
                    label: t('payments.list.screenshot'),
                    onPressed: () => _showProof(proof),
                    style: context.text.footnote.copyWith(fontSize: 12.5, fontWeight: FontWeight.w500),
                  ),
                const Spacer(),
                if (d.pending && !_confirm)
                  KButton(label: t('payments.list.cancel'), variant: KButtonVariant.ghost, size: KButtonSize.sm, onPressed: () => setState(() => _confirm = true)),
              ],
            ),
          ],
          if (d.pending && _confirm) ...[
            const SizedBox(height: 6),
            Wrap(
              alignment: WrapAlignment.end,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 6,
              children: [
                Text(t('payments.list.cancelConfirm'), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12)),
                KButton(
                  label: t('payments.list.cancelNo'),
                  variant: KButtonVariant.ghost,
                  size: KButtonSize.sm,
                  onPressed: _busy ? null : () => setState(() => _confirm = false),
                ),
                KButton(label: t('payments.list.cancelYes'), variant: KButtonVariant.danger, size: KButtonSize.sm, loading: _busy, onPressed: _busy ? null : _cancel),
              ],
            ),
          ],
          WalletInlineError(_err, top: 8),
        ],
      ),
    );
  }
}

/// The client's own payment screenshot (private: loaded with the session).
class _ProofView extends ConsumerWidget {
  const _ProofView({required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final image = ref.watch(manualMediaProvider(id));
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: image.when(
        loading: () => const KSkeleton(height: 280, radius: 14),
        error: (e, _) => WalletInlineError(manualErrorText(e, t, fallback: t('wallet.error.generic'))),
        data: (bytes) => ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.6),
            child: Image.memory(
              bytes,
              fit: BoxFit.contain,
              gaplessPlayback: true,
              semanticLabel: t('payments.list.screenshot'),
              errorBuilder: (_, _, _) => WalletInlineError(t('wallet.error.generic')),
            ),
          ),
        ),
      ),
    );
  }
}
