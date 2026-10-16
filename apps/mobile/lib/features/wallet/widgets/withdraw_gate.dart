// Wallet › Withdraw: the entry gate, the app's port of apps/crm/components/wallet-live/withdraw-gate.tsx.
//
// Opening Withdraw with more than one way out shows a sheet with the rails the broker has open - USDT to the
// client's own wallet, UPI to their own ID. Choosing one shows what the client is agreeing to; agreeing runs a
// short handoff animation and returns the rail, which the screen preselects.
//
// The consent step is not decoration. A payout is irreversible and goes to an address or an ID the client types
// themselves, so the line they tick is the one thing standing between a typo and lost money.
//
// `MediaQuery.disableAnimations` (the OS "reduce motion" setting) skips the handoff: agreeing then returns at
// once, as the web gate does.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../wallet_api.dart';

/// `usdt` | `upi`, or null when the client dismissed the sheet without choosing.
typedef WithdrawVia = String;

const Color _usdtGreen = Color(0xFF26A17B);
const Color _upiPurple = Color(0xFF5F259F);

/// Opens the gate. Returns the rail the client picked, or null if they backed out.
Future<WithdrawVia?> showWithdrawGate(BuildContext context, {required List<WalletChain> chains, required WithdrawMethod? upi}) =>
    showKSheet<WithdrawVia>(
      context,
      title: context.t('wallet.withdrawGate.title'),
      builder: (ctx) => _Gate(chains: chains, upi: upi),
    );

class _Gate extends StatefulWidget {
  const _Gate({required this.chains, required this.upi});
  final List<WalletChain> chains;
  final WithdrawMethod? upi;

  @override
  State<_Gate> createState() => _GateState();
}

class _GateState extends State<_Gate> {
  /// pick → terms → handoff
  String _step = 'pick';
  WithdrawVia? _sel;
  bool _agreed = false;

  bool get _isUpi => _sel == 'upi';
  Color get _colour => _isUpi ? _upiPurple : _usdtGreen;
  String get _name => _isUpi ? 'UPI' : 'USDT';

  void _pick(WithdrawVia via) {
    KHaptics.tap();
    setState(() {
      _sel = via;
      _agreed = false;
      _step = 'terms';
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return AnimatedSize(
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: switch (_step) {
        'handoff' => _Handoff(
          colour: _colour,
          mark: _mark(44),
          steps: [t('wallet.withdrawGate.step1'), t('wallet.withdrawGate.step2', {'rail': _name}), t('wallet.withdrawGate.step3')],
          secure: t('wallet.withdrawGate.secure'),
          onDone: () => Navigator.of(context).pop(_sel),
        ),
        'terms' => _Terms(
          colour: _colour,
          name: _name,
          mark: _mark(30),
          body: _isUpi ? t('wallet.withdrawGate.termsUpi', {'currency': widget.upi?.currency ?? 'INR'}) : t('wallet.withdrawGate.termsUsdt'),
          agreeLabel: _isUpi ? t('wallet.withdrawGate.agreeUpi') : t('wallet.withdrawGate.agreeUsdt'),
          agreed: _agreed,
          onToggle: () {
            KHaptics.tap();
            setState(() => _agreed = !_agreed);
          },
          onBack: () => setState(() => _step = 'pick'),
          onContinue: _agreed ? () => setState(() => _step = 'handoff') : null,
        ),
        _ => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              t('wallet.withdrawGate.subtitle'),
              style: context.text.footnote.copyWith(color: k.fg3),
            ),
            const SizedBox(height: 16),
            if (widget.chains.isNotEmpty) ...[
              _RailTile(
                colour: _usdtGreen,
                mark: const KCoinIcon('usdt', size: 44),
                name: 'USDT',
                sub: t('wallet.withdrawGate.usdtSub'),
                // the networks the payout can go out on, each with its own coin
                badges: [for (final c in widget.chains) (coin: c.chain == 'bsc' ? 'bnb' : 'trx', label: chainLabel(c.chain).short)],
                onTap: () => _pick('usdt'),
              ),
              const SizedBox(height: 10),
            ],
            if (widget.upi != null) ...[
              _RailTile(
                colour: _upiPurple,
                mark: const _UpiMark(size: 44),
                name: 'UPI',
                sub: t('wallet.withdrawGate.upiSub', {'currency': widget.upi!.currency}),
                badges: const [],
                onTap: () => _pick('upi'),
              ),
              const SizedBox(height: 10),
            ],
          ],
        ),
      },
    );
  }

  Widget _mark(double size) => _isUpi ? _UpiMark(size: size) : KCoinIcon('usdt', size: size);
}

/* ------------------------------------------------------------------ pieces */

/// UPI has no logo in the asset set, so it is set in type on its brand colour rather than drawn from memory.
class _UpiMark extends StatelessWidget {
  const _UpiMark({this.size = 44});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(color: _upiPurple.withValues(alpha: 0.12), shape: BoxShape.circle),
    child: Icon(LucideIcons.smartphone, size: size * 0.5, color: _upiPurple),
  );
}

typedef _Badge = ({String coin, String label});

class _RailTile extends StatelessWidget {
  const _RailTile({required this.colour, required this.mark, required this.name, required this.sub, required this.badges, required this.onTap});
  final Color colour;
  final Widget mark;
  final String name, sub;
  final List<_Badge> badges;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      semanticLabel: name,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: k.line),
        ),
        child: Row(
          children: [
            mark,
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: context.text.headline.copyWith(fontSize: 15.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(sub, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12.5)),
                  if (badges.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        for (final b in badges) ...[
                          KCoinIcon(b.coin, size: 15),
                          const SizedBox(width: 5),
                          Text(b.label, style: context.text.caption.copyWith(color: k.fg3, fontSize: 11.5, fontWeight: FontWeight.w400)),
                          const SizedBox(width: 12),
                        ],
                      ],
                    ),
                  ],
                ],
              ),
            ),
            Icon(LucideIcons.arrowRight, size: 16, color: k.fg3),
          ],
        ),
      ),
    );
  }
}

class _Terms extends StatelessWidget {
  const _Terms({
    required this.colour,
    required this.name,
    required this.mark,
    required this.body,
    required this.agreeLabel,
    required this.agreed,
    required this.onToggle,
    required this.onBack,
    required this.onContinue,
  });
  final Color colour;
  final String name, body, agreeLabel;
  final Widget mark;
  final bool agreed;
  final VoidCallback onToggle, onBack;
  final VoidCallback? onContinue;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(color: k.surface2, borderRadius: BorderRadius.circular(14), border: Border.all(color: k.line)),
          child: Row(
            children: [
              mark,
              const SizedBox(width: 12),
              Text(name, style: context.text.headline.copyWith(fontSize: 15, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(color: k.surface2, borderRadius: BorderRadius.circular(14), border: Border.all(color: k.line)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.shieldCheck, size: 16, color: k.ember),
              const SizedBox(width: 10),
              Expanded(
                child: Text(body, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12.5, height: 1.5)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        KPressable(
          onTap: onToggle,
          semanticLabel: agreeLabel,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: agreed ? k.ember : k.surface2,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: agreed ? k.ember : k.line),
                ),
                child: agreed ? const Icon(LucideIcons.check, size: 13, color: Colors.white) : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(agreeLabel, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13, height: 1.45)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            KButton(label: t('common.back'), variant: KButtonVariant.ghost, onPressed: onBack),
            const Spacer(),
            KButton(
              label: t('wallet.withdrawGate.continueTo', {'rail': name}),
              trailingIcon: LucideIcons.arrowRight,
              onPressed: onContinue,
            ),
          ],
        ),
      ],
    );
  }
}

/// The handoff: the rail's mark inside a sweeping halo, one status line at a time, a segment per step. Each
/// line names something the screen is really about to do, so the pause is a handoff and not a loader.
class _Handoff extends StatefulWidget {
  const _Handoff({required this.colour, required this.mark, required this.steps, required this.secure, required this.onDone});
  final Color colour;
  final Widget mark;
  final List<String> steps;
  final String secure;
  final VoidCallback onDone;

  @override
  State<_Handoff> createState() => _HandoffState();
}

class _HandoffState extends State<_Handoff> with SingleTickerProviderStateMixin {
  static const _stepMs = 850;
  late final AnimationController _spin = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..repeat();
  final List<Timer> _timers = [];
  int _at = 0;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // "reduce motion": no theatre, straight through
    if (MediaQuery.of(context).disableAnimations) {
      _timers.add(Timer(Duration.zero, widget.onDone));
      return;
    }
    for (var i = 1; i < widget.steps.length; i++) {
      _timers.add(Timer(Duration(milliseconds: _stepMs * i), () => mounted ? setState(() => _at = i) : null));
    }
    _timers.add(Timer(Duration(milliseconds: _stepMs * widget.steps.length), widget.onDone));
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    if (MediaQuery.of(context).disableAnimations) return const SizedBox(height: 8);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          SizedBox(
            width: 112,
            height: 112,
            child: Stack(
              alignment: Alignment.center,
              children: [
                RotationTransition(
                  turns: _spin,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: SweepGradient(colors: [widget.colour.withValues(alpha: 0), widget.colour, widget.colour.withValues(alpha: 0)], stops: const [0, 0.3, 0.6]),
                    ),
                  ),
                ),
                Container(
                  margin: const EdgeInsets.all(3),
                  decoration: BoxDecoration(color: k.surface, shape: BoxShape.circle, border: Border.all(color: k.line)),
                ),
                widget.mark,
              ],
            ),
          ),
          const SizedBox(height: 22),
          SizedBox(
            height: 24,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              child: Text(
                widget.steps[_at],
                key: ValueKey(_at),
                textAlign: TextAlign.center,
                style: context.text.callout.copyWith(fontWeight: FontWeight.w500),
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: 220,
            child: Row(
              children: [
                for (var i = 0; i < widget.steps.length; i++) ...[
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: Stack(
                        children: [
                          Container(height: 3, color: k.surface3),
                          AnimatedFractionallySizedBox(
                            duration: Duration(milliseconds: i == _at ? _stepMs : 200),
                            widthFactor: i <= _at ? 1 : 0,
                            child: Container(height: 3, color: widget.colour),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (i < widget.steps.length - 1) const SizedBox(width: 6),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.lock, size: 12, color: k.fg3),
              const SizedBox(width: 6),
              Text(widget.secure, style: context.text.caption.copyWith(color: k.fg3, fontSize: 11.5, fontWeight: FontWeight.w400)),
            ],
          ),
        ],
      ),
    );
  }
}
