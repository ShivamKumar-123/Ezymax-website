// Profile & Security › Verification: port of the web's live KYC flow (apps/crm/components/verification/
// live-verification.tsx + capture.tsx + checks.ts + tracker.tsx + api.ts). Phone order (the web's order-1 / order-2):
//   1 header (Verification) with the case reference chip under it
//   2 the main card: Start (individual / company) › the wizard (details, identity document, proof of address,
//     selfie, review; or company, people, documents, selfie, review) › "Checking your documents…" › the status
//     tracker; or "We need a little more from you" with only the requested documents
//   3 Verification levels (what each level unlocks, earlier cases)
// The state is `GET kyc`, refreshed every 15 s while a review runs; every answer of start / details / documents /
// submit replaces it. Photos come from the phone's camera or a file (kyc/kyc_upload.dart), are checked on the
// phone (kyc/kyc_checks.dart) and uploaded as multipart/form-data exactly as the web does.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'kyc/kyc_models.dart';
import 'kyc/kyc_steps.dart';
import 'kyc/kyc_tracker.dart';
import 'kyc/kyc_upload.dart';
import 'widgets/profile_ui.dart';

int? _previewsOwner;

class VerificationScreen extends ConsumerStatefulWidget {
  const VerificationScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  ConsumerState<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends ConsumerState<VerificationScreen> {
  KycState? _data;
  Object? _error;
  bool _justSubmitted = false;
  bool _restart = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    final me = ref.read(meProvider);
    if (me != null && _previewsOwner != me.id) {
      kycPreviews.clear();
      _previewsOwner = me.id;
    }
    unawaited(_load());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final s = KycState.fromJson(await ref.read(apiProvider).get<Map<String, dynamic>>('kyc'));
      if (mounted) _set(s);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  /// web setData: the new state; the poll runs while the case is submitted or in review; `me` follows status changes.
  void _set(KycState s) {
    final before = _data;
    setState(() {
      _data = s;
      _error = null;
    });
    final status = s.kase?.status;
    _poll?.cancel();
    if (status == 'submitted' || status == 'in_review') {
      _poll = Timer(const Duration(seconds: 15), () {
        if (mounted) unawaited(_load());
      });
    }
    if (before != null && (before.kase?.status != status || before.kycStatus != s.kycStatus)) unawaited(ref.read(authProvider.notifier).refreshMe());
  }

  void _toast(String title, {String? description}) => ref.read(notificationsProvider.notifier).toast(NotificationKind.success, title, description: description);

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final me = ref.watch(meProvider);
    final readOnly = me?.readOnly ?? false;
    final data = _data;
    final mode = kycModeOf(data, restart: _restart);
    final kase = data?.kase;

    Widget main;
    if (_error != null && data == null) {
      main = KLoadError(
        error: _error,
        card: false,
        onRetry: () {
          setState(() => _error = null);
          unawaited(_load());
        },
      );
    } else if (mode == KycMode.loading) {
      main = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const FractionallySizedBox(widthFactor: 0.66, child: KSkeleton(height: 32)),
          const SizedBox(height: 12),
          KSkeleton(height: 112, radius: k.rowRadius),
          const SizedBox(height: 12),
          KSkeleton(height: 112, radius: k.rowRadius),
        ],
      );
    } else if (readOnly && mode != KycMode.tracker) {
      main = KNotice(text: t('security.staff.refused'), tone: KChipTone.warn);
    } else {
      main = switch (mode) {
        KycMode.start => KycStartPanel(
          state: data!,
          onStarted: (s) {
            setState(() => _restart = false);
            _set(s);
          },
        ),
        KycMode.wizard => KycWizard(
          key: ValueKey('wizard-${kase!.id}'),
          state: data!,
          setState: _set,
          onSubmitted: (s) {
            setState(() => _justSubmitted = true);
            _set(s);
            _toast(t('kyc.toast.submitted'), description: t('kyc.toast.submittedDesc', {'hours': hoursLabel(t, s.typicalHours)}));
          },
        ),
        KycMode.moreInfo => KycMoreInfo(
          key: ValueKey('more-${kase!.id}'),
          state: data!,
          setState: _set,
          onSubmitted: (s) {
            setState(() => _justSubmitted = true);
            _set(s);
            _toast(t('kyc.toast.sentToTeam'));
          },
        ),
        _ => KycStatusTracker(state: data!, justSubmitted: _justSubmitted, onRestart: readOnly ? null : () => setState(() => _restart = true)),
      };
    }

    final tone = data?.kycStatus == 'verified' ? KChipTone.up : (data?.kycStatus == 'rejected' ? KChipTone.down : KChipTone.neutral);
    return KPageScroll(
      onRefresh: _load,
      children: [
        PPageHeader(
          title: t('kyc.page.title'),
          subtitle: t('kyc.page.subtitle'),
          actions: [
            if (kase != null)
              Container(
                height: 24,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: context.k.chip(tone).$1,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: context.k.chip(tone).$3),
                ),
                // centred without filling the row (an aligned Container would take the whole width)
                child: Center(
                  widthFactor: 1,
                  child: Text(
                    kase.reference,
                    style: context.text.mono(11.5, weight: FontWeight.w600).copyWith(color: context.k.chip(tone).$2),
                  ),
                ),
              ),
          ],
        ),
        KCard(
          key: ValueKey('kyc-main-${mode.name}'),
          padding: const EdgeInsets.all(20),
          child: AnimatedSize(duration: const Duration(milliseconds: 200), alignment: Alignment.topCenter, child: main),
        ),
        const SizedBox(height: 16),
        KycLevelsCard(state: data, emailVerified: me?.emailVerified ?? false),
      ],
    );
  }
}
