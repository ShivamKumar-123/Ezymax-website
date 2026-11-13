// Wallet › Deposit: the entry gate, the app's port of apps/crm/components/wallet-live/deposit-gate.tsx.
//
// Opening Deposit shows a sheet with the two payment brands the broker has on - OxaPay (the crypto checkout,
// any coin, credited by itself) and PhonePe (UPI or bank transfer in rupees, verified by staff). Choosing one
// shows the deposit terms; agreeing runs the short secure-handoff animation and returns the route, which the
// screen then opens. Dismissing the sheet without a choice goes back to the wallet, as the web does.
//
// The pieces (the tile, the terms step, the handoff) are the withdraw gate's, so both gates move alike.
import 'package:flutter/material.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import 'checkout_panels.dart';
import 'manual_panels.dart';
import 'withdraw_gate.dart';

/// Opens the gate. Returns the route the client picked (`checkout` or `bank`), or null if they backed out.
Future<DepositVia?> showDepositGate(BuildContext context, {required bool hasCheckout, required bool hasBank}) => showKSheet<DepositVia>(
  context,
  title: context.t('payments.gate.title'),
  builder: (ctx) => _Gate(hasCheckout: hasCheckout, hasBank: hasBank),
);

class _Gate extends StatefulWidget {
  const _Gate({required this.hasCheckout, required this.hasBank});
  final bool hasCheckout, hasBank;

  @override
  State<_Gate> createState() => _GateState();
}

class _GateState extends State<_Gate> {
  /// pick → terms → handoff
  String _step = 'pick';
  DepositVia? _sel;
  bool _agreed = false;

  bool get _isCheckout => _sel == DepositVia.checkout;
  Color get _colour => _isCheckout ? kOxaPayBlue : kPhonePePurple;
  String get _name => _isCheckout ? 'OxaPay' : 'PhonePe';
  Widget _mark(double size) => _isCheckout ? OxaPayMark(size: size) : PhonePeMark(size: size);

  void _pick(DepositVia via) {
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
        'handoff' => GateHandoff(
          colour: _colour,
          mark: _mark(44),
          steps: [t('payments.gate.step1'), t('payments.gate.step2', {'brand': _name}), t('payments.gate.step3')],
          secure: t('payments.gate.secure'),
          onDone: () => Navigator.of(context).pop(_sel),
        ),
        'terms' => GateTerms(
          colour: _colour,
          name: _name,
          mark: _mark(30),
          body: t('payments.gate.termsBody', {'brand': _name}),
          agreeLabel: t('payments.gate.agree'),
          continueLabel: t('payments.gate.continueTo', {'brand': _name}),
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
            Text(t('payments.gate.subtitle'), style: context.text.footnote.copyWith(color: k.fg3)),
            const SizedBox(height: 16),
            if (widget.hasCheckout) ...[
              GateTile(
                colour: kOxaPayBlue,
                mark: const OxaPayMark(),
                name: 'OxaPay',
                sub: t('payments.gate.oxapaySub'),
                badges: const [],
                onTap: () => _pick(DepositVia.checkout),
              ),
              const SizedBox(height: 10),
            ],
            if (widget.hasBank) ...[
              GateTile(
                colour: kPhonePePurple,
                mark: const PhonePeMark(),
                name: 'PhonePe',
                sub: t('payments.gate.phonepeSub'),
                badges: const [],
                onTap: () => _pick(DepositVia.bank),
              ),
              const SizedBox(height: 10),
            ],
            if (!widget.hasCheckout && !widget.hasBank)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text(t('payments.gate.none'), textAlign: TextAlign.center, style: context.text.footnote.copyWith(color: k.fg3)),
              ),
          ],
        ),
      },
    );
  }
}
