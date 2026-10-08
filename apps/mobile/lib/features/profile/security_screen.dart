// Profile & Security › Security: port of the web's live Security page (apps/crm/components/security/live-security.tsx
// + common.tsx). Phone order:
//   1 header (Security) with "View-only access" under it
//   2 Sign-in protection (password, email codes, idle sign-out, active sessions)
//   3 Change password (step-up `account_password`)
//   4 Active sessions (this device, sign out one / all others; every 30 s)
//   5 Sign-in history (90 days, CSV)
//   6 Your data and account (data export / closure requests, D94)
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'security_data.dart';
import 'widgets/change_password_card.dart';
import 'widgets/profile_ui.dart';
import 'widgets/security_cards.dart';

class SecurityScreen extends ConsumerWidget {
  const SecurityScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  Future<void> _refresh(WidgetRef ref) async {
    ref
      ..invalidate(securitySessionsProvider)
      ..invalidate(securityLoginsProvider)
      ..invalidate(securityRequestsProvider);
    await Future.wait<void>([
      ref.read(securitySessionsProvider.future).then((_) {}, onError: (Object _) {}),
      ref.read(securityLoginsProvider.future).then((_) {}, onError: (Object _) {}),
      ref.read(securityRequestsProvider.future).then((_) {}, onError: (Object _) {}),
    ]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    return KPageScroll(
      onRefresh: () => _refresh(ref),
      children: [
        PPageHeader(
          title: t('security.page.title'),
          subtitle: t('security.page.subtitle'),
          actions: [
            KButton(
              label: t('security.viewerBar.title'),
              icon: LucideIcons.eye,
              variant: KButtonVariant.surface,
              onPressed: () => context.go('/profile/viewers'),
            ),
          ],
        ),
        const ProtectCard(),
        if (!readOnly) ...[const SizedBox(height: 16), const ChangePasswordCard(forgotToastKey: 'security.resetSigningOut')],
        const SizedBox(height: 16),
        const SessionsCard(),
        const SizedBox(height: 16),
        const LoginHistoryCard(),
        const SizedBox(height: 16),
        const DataRequestsCard(),
      ],
    );
  }
}
