// Biometric unlock of a stored session (cold start, or back from the background after a minute). The system
// prompt opens at once; "Sign in with password" forgets the stored session.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';

class UnlockScreen extends ConsumerStatefulWidget {
  const UnlockScreen({super.key});

  @override
  ConsumerState<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends ConsumerState<UnlockScreen> {
  bool _busy = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  Future<void> _unlock() async {
    if (_busy || !mounted) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    final ok = await ref.read(authProvider.notifier).unlock(context.t('app.unlock.reason'));
    if (!mounted) return;
    if (ok) KHaptics.success();
    setState(() {
      _busy = false;
      _failed = !ok;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final user = ref.watch(authProvider).user;
    return Scaffold(
      backgroundColor: k.bg,
      body: Stack(
        children: [
          const Positioned.fill(child: KBackdrop()),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                children: [
                  const Spacer(flex: 3),
                  const KBrandAvatar(size: 72),
                  const SizedBox(height: 22),
                  Text(t('app.unlock.title'), textAlign: TextAlign.center, style: context.text.largeTitle.copyWith(fontSize: 26)),
                  if (user != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      user.name,
                      textAlign: TextAlign.center,
                      style: context.text.headline.copyWith(color: k.fg2),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Text(
                    t('app.unlock.text'),
                    textAlign: TextAlign.center,
                    style: context.text.callout.copyWith(color: k.fg3),
                  ),
                  if (_failed) ...[const SizedBox(height: 16), KFormError(t('app.unlock.failed'))],
                  const Spacer(flex: 4),
                  KButton(label: t('app.unlock.button'), icon: LucideIcons.fingerprint, size: KButtonSize.lg, expand: true, loading: _busy, onPressed: _unlock),
                  const SizedBox(height: 8),
                  KTextButton(label: t('app.unlock.usePassword'), color: k.fg2, onPressed: () => ref.read(authProvider.notifier).forgetLocked()),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
