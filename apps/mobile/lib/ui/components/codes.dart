import 'dart:async';

import 'package:flutter/material.dart';

import '../../i18n/i18n.dart';
import '../tokens.dart';
import '../typography.dart';
import 'buttons.dart';
import 'rich_text.dart';

/// "Resend in 0:30" countdown that turns into a "Resend code" link (web ResendLink). `onResend` may return the
/// server's retry_after seconds to wait instead of the default.
class KResendLink extends StatefulWidget {
  const KResendLink({super.key, required this.seconds, required this.onResend});
  final int seconds;
  final Future<int?> Function() onResend;

  @override
  State<KResendLink> createState() => _KResendLinkState();
}

class _KResendLinkState extends State<KResendLink> {
  late int _left = widget.seconds;
  bool _busy = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _tick();
  }

  void _tick() {
    _timer?.cancel();
    if (_left <= 0) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _left--);
      if (_left <= 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final label = _left > 0
        ? t('auth.otp.resendIn', {'seconds': _left.toString().padLeft(2, '0')})
        : (_busy ? t('auth.otp.sending') : t('auth.otp.resendCode'));
    return KTextButton(
      label: label,
      color: _left > 0 || _busy ? context.k.fg3 : null,
      onPressed: _left > 0 || _busy
          ? null
          : () async {
              setState(() => _busy = true);
              final wait = await widget.onResend();
              if (!mounted) return;
              setState(() {
                _busy = false;
                _left = wait ?? widget.seconds;
              });
              _tick();
            },
    );
  }
}

/// Development stacks without e-mail: the code the gateway returned (web DevCodeHint).
class KDevCodeHint extends StatelessWidget {
  const KDevCodeHint(this.code, {super.key});
  final String? code;

  @override
  Widget build(BuildContext context) {
    if (code == null || code!.isEmpty) return const SizedBox.shrink();
    final k = context.k;
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: KRichText(
        context.t('auth.otp.devHint', {'code': code}),
        style: context.text.footnote.copyWith(color: k.fg3),
        tags: {'code': KTag(style: context.text.mono(12.5, color: k.fg))},
      ),
    );
  }
}
