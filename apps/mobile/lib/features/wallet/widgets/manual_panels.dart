// Manual payments on the deposit page (port of apps/crm/components/wallet-live/manual/index.tsx and details.tsx):
// the chooser (USDT · automatic, Bank / UPI, Crypto), then for Bank / Crypto the method picker, the broker's payment
// details (every field with a copy button, the QR code, rate, limits, warnings, instructions), the request form (or
// the "Request sent" state), the client's requests and how it works. No MetaMask in the app.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../manual_api.dart';
import 'manual_form.dart';
import 'manual_requests.dart';
import 'wallet_ui.dart';

/// How the client pays (web Via): the automatic USDT deposit, or a method the broker verifies.
enum DepositVia { usdt, bank, crypto }

/// `?via=bank|crypto|usdt` -> the choice (null for anything else).
DepositVia? depositViaOf(String? v) => switch (v) {
  'usdt' => DepositVia.usdt,
  'bank' => DepositVia.bank,
  'crypto' => DepositVia.crypto,
  _ => null,
};

/* ------------------------------------------------------------------ chooser */

/// "How do you want to pay?" (web DepositChooser): the ways the broker offers; nothing with fewer than two.
class DepositChooser extends StatelessWidget {
  const DepositChooser({super.key, required this.value, required this.onChanged, required this.usdt, required this.bank, required this.crypto});
  final DepositVia value;
  final ValueChanged<DepositVia> onChanged;
  final bool usdt, bank, crypto;

  /// The choices shown, in order.
  static List<DepositVia> offered({required bool usdt, required bool bank, required bool crypto}) => [
    if (usdt) DepositVia.usdt,
    if (bank) DepositVia.bank,
    if (crypto) DepositVia.crypto,
  ];

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final options = offered(usdt: usdt, bank: bank, crypto: crypto);
    if (options.length < 2) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: kWalletGap),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('payments.chooser.title').toUpperCase(),
            style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.8, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          for (var i = 0; i < options.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _ChoiceRow(
              key: ValueKey('deposit-via-${options[i].name}'),
              selected: options[i] == value,
              onTap: () => onChanged(options[i]),
              icon: switch (options[i]) {
                DepositVia.usdt => const _UsdtAuto(),
                DepositVia.bank => const _RoundIcon(LucideIcons.landmark),
                DepositVia.crypto => const _RoundIcon(LucideIcons.wallet),
              },
              title: switch (options[i]) {
                DepositVia.usdt => t('payments.chooser.usdt'),
                DepositVia.bank => t('payments.chooser.bank'),
                DepositVia.crypto => t('payments.chooser.crypto'),
              },
              text: switch (options[i]) {
                DepositVia.usdt => t('payments.chooser.usdtText'),
                DepositVia.bank => t('payments.chooser.bankText'),
                DepositVia.crypto => t('payments.chooser.cryptoText'),
              },
            ),
          ],
        ],
      ),
    );
  }
}

/// A row of the chooser and the method picker: icon, title, a line under it, the ember check when chosen.
class _ChoiceRow extends StatelessWidget {
  const _ChoiceRow({super.key, required this.selected, required this.onTap, required this.icon, required this.title, required this.text});
  final bool selected;
  final VoidCallback onTap;
  final Widget icon;
  final String title, text;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      selected: selected,
      button: true,
      inMutuallyExclusiveGroup: true,
      child: WalletRow(
        selected: selected,
        onTap: onTap,
        child: Row(
          children: [
            icon,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 2),
                  Text(
                    text,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                  ),
                ],
              ),
            ),
            if (selected) ...[
              const SizedBox(width: 8),
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                child: Icon(LucideIcons.check, size: 14, color: k.onEmber),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// USDT with a lightning bolt (automatic).
class _UsdtAuto extends StatelessWidget {
  const _UsdtAuto();

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return SizedBox(
      width: 33,
      height: 32,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          const KCoinIcon('usdt', size: 30),
          PositionedDirectional(
            bottom: -2,
            end: -1,
            child: Container(
              width: 15,
              height: 15,
              decoration: BoxDecoration(
                color: k.ember,
                shape: BoxShape.circle,
                border: Border.all(color: k.surface2, width: 1.5),
              ),
              child: Icon(LucideIcons.zap, size: 8, color: k.onEmber),
            ),
          ),
        ],
      ),
    );
  }
}

/// An icon in a soft circle (bank, wallet).
class _RoundIcon extends StatelessWidget {
  const _RoundIcon(this.icon, {this.size = 30});
  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: k.surface3,
        shape: BoxShape.circle,
        border: Border.all(color: k.line),
      ),
      child: Icon(icon, size: size * 0.53, color: k.fg2),
    );
  }
}

/// A method's icon: a bank, or the token's coin with the network's in the corner (web MethodIcon).
class ManualMethodIcon extends StatelessWidget {
  const ManualMethodIcon(this.m, {super.key, this.size = 32});
  final ManualMethod m;
  final double size;

  static const Map<String, String> _chainCoin = {'TRC20': 'trx', 'BEP20': 'bnb', 'ERC20': 'eth', 'Polygon': 'matic', 'BTC': 'btc', 'Solana': 'sol'};

  @override
  Widget build(BuildContext context) {
    if (m.bank) return _RoundIcon(LucideIcons.landmark, size: size);
    final token = m.token.toLowerCase();
    final coin = const {'usdt', 'btc', 'eth'}.contains(token) ? token : 'usdt';
    final chain = _chainCoin[m.details.network ?? ''];
    return SizedBox(
      width: size + 3,
      height: size + 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          KCoinIcon(coin, size: size),
          if (chain != null && chain != coin)
            PositionedDirectional(
              bottom: -1,
              end: -1,
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: context.k.surface2, width: 2),
                ),
                child: KCoinIcon(chain, size: (size * 0.47).roundToDouble()),
              ),
            ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ the panel */

/// Bank / UPI or Crypto (web ManualDepositPanel): pick a method of `kind`, see its details, send the request; the
/// client's requests underneath.
class ManualDepositPanel extends StatefulWidget {
  const ManualDepositPanel({super.key, required this.kind, required this.methods, required this.maxPending, this.initialMethod});

  /// bank | crypto
  final String kind;

  /// The active methods of `kind`, in the broker's order.
  final List<ManualMethod> methods;
  final int maxPending;

  /// The method to show first (`?method=<id>`).
  final int? initialMethod;

  @override
  State<ManualDepositPanel> createState() => _ManualDepositPanelState();
}

class _ManualDepositPanelState extends State<ManualDepositPanel> {
  late int? _id = _valid(widget.initialMethod) ?? widget.methods.firstOrNull?.id;
  ManualDeposit? _sent;
  final GlobalKey _requests = GlobalKey();

  int? _valid(int? id) => id != null && widget.methods.any((m) => m.id == id) ? id : null;

  @override
  void didUpdateWidget(ManualDepositPanel old) {
    super.didUpdateWidget(old);
    if (old.kind != widget.kind) _sent = null;
    if (_valid(_id) == null) {
      _id = _valid(widget.initialMethod) ?? widget.methods.firstOrNull?.id;
      _sent = null;
    }
  }

  void _pick(int id) {
    if (id == _id) return;
    setState(() {
      _id = id;
      _sent = null;
    });
  }

  void _toRequests() {
    final c = _requests.currentContext;
    if (c != null) Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic, alignment: 0.05);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final m = widget.methods.where((x) => x.id == _id).firstOrNull;
    if (m == null) {
      return KCard(
        child: KEmptyState(art: KIllustrationName.emptyHistory, title: t('payments.empty.title'), text: t('payments.empty.text')),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.methods.length > 1) ...[
          ManualMethodPicker(methods: widget.methods, value: m.id, onChanged: _pick),
          const SizedBox(height: kWalletGap),
        ],
        ManualMethodDetails(m: m),
        const SizedBox(height: kWalletGap),
        if (_sent != null)
          ManualRequestSent(d: _sent!, onAnother: () => setState(() => _sent = null), onList: _toRequests)
        else
          ManualRequestForm(key: ValueKey('manual-form-${m.id}'), method: m, maxPending: widget.maxPending, onSent: (d) => setState(() => _sent = d)),
        const SizedBox(height: kWalletGap),
        ManualRequestsList(key: _requests),
      ],
    );
  }
}

/* ------------------------------------------------------------------ method picker */

/// Choose between several methods of one kind (web MethodPicker): name, token · network or currency, limits.
class ManualMethodPicker extends StatelessWidget {
  const ManualMethodPicker({super.key, required this.methods, required this.value, required this.onChanged});
  final List<ManualMethod> methods;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    if (methods.length < 2) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          (methods.first.bank ? t('payments.picker.bank') : t('payments.picker.crypto')).toUpperCase(),
          style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.8, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < methods.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          _ChoiceRow(
            key: ValueKey('manual-method-${methods[i].id}'),
            selected: methods[i].id == value,
            onTap: () => onChanged(methods[i].id),
            icon: ManualMethodIcon(methods[i]),
            title: methods[i].name,
            text:
                '${methods[i].bank ? methods[i].currency : '${methods[i].token} · ${methods[i].details.network ?? ''}'} · '
                '${manualLimits(methods[i], t)}',
          ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ payment details */

/// The broker's payment details for one method (web MethodDetails).
class ManualMethodDetails extends StatelessWidget {
  const ManualMethodDetails({super.key, required this.m});
  final ManualMethod m;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final d = m.details;
    final crypto = !m.bank;
    final rows = <Widget>[
      if (crypto) ...[
        Row(
          children: [
            Expanded(
              child: WalletTile(label: t('payments.card.network'), value: d.network ?? '—'),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: WalletTile(label: t('payments.card.token'), value: d.token ?? '—'),
            ),
          ],
        ),
        ?_detail(t('payments.card.address'), d.address, mono: true),
        ?_detail(t('payments.card.memo'), d.memo, mono: true),
      ] else ...[
        ?_detail(t('payments.card.accountName'), d.accountName),
        ?_detail(t('payments.card.bankName'), d.bankName),
        ?_detail(t('payments.card.accountNumber'), d.accountNumber, mono: true),
        ?_detail(t('payments.card.ifsc'), d.ifsc, mono: true),
        ?_detail(t('payments.card.swift'), d.swift, mono: true),
        ?_detail(t('payments.card.iban'), d.iban, mono: true),
        ?_detail(t('payments.card.branch'), d.branch),
        ?_detail(t('payments.card.upiId'), d.upiId, mono: true),
      ],
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _InfoTile(label: t('payments.card.rate'), value: manualRate(m.rate, m.currency, t)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _InfoTile(label: t('payments.card.limits'), value: manualLimits(m, t)),
          ),
        ],
      ),
      if (crypto)
        KNotice(
          tone: KChipTone.warn,
          icon: LucideIcons.circleAlert,
          text: '${t('payments.card.networkWarning', {'token': d.token ?? '', 'network': d.network ?? ''})}${d.memo != null ? ' ${t('payments.card.memoWarning')}' : ''}',
        ),
      if (m.instructions.isNotEmpty)
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: k.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t('payments.card.instructions').toUpperCase(),
                style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.8, fontWeight: FontWeight.w500, fontSize: 11),
              ),
              const SizedBox(height: 4),
              Text(m.instructions, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12.5)),
            ],
          ),
        ),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: crypto ? t('payments.card.payToAddress') : t('payments.card.payTo'),
            subtitle: m.name,
            icon: crypto ? LucideIcons.wallet : LucideIcons.landmark,
          ),
          if (manualHasQr(m)) ...[const SizedBox(height: 18), ManualQr(m: m)],
          const SizedBox(height: 16),
          for (var i = 0; i < rows.length; i++) ...[if (i > 0) const SizedBox(height: 8), rows[i]],
        ],
      ),
    );
  }

  Widget? _detail(String label, String? value, {bool mono = false}) => value == null ? null : ManualDetailRow(label: label, value: value, mono: mono);
}

/// One payment detail with its copy button (web DetailRow).
class ManualDetailRow extends StatelessWidget {
  const ManualDetailRow({super.key, required this.label, required this.value, this.mono = false});
  final String label, value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return WalletRow(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.8, fontWeight: FontWeight.w500, fontSize: 11),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  textDirection: TextDirection.ltr,
                  style: mono ? context.text.mono(12.5) : context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          KIconButton(
            icon: LucideIcons.copy,
            size: 32,
            semanticLabel: t('payments.card.copy', {'label': label}),
            onPressed: () => kCopy(context, value),
          ),
        ],
      ),
    );
  }
}

/// A label with a value that may wrap (rate, limits: translated text, so not forced left to right).
class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return WalletRow(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: context.text.label.copyWith(fontWeight: FontWeight.w600, fontSize: 13, fontFeatures: kTabular),
          ),
        ],
      ),
    );
  }
}

/// The QR to scan (web MethodQr): the broker's uploaded image (loaded with the session), else one generated from the
/// UPI ID or the address; with what to scan it with under it.
class ManualQr extends ConsumerWidget {
  const ManualQr({super.key, required this.m, this.size = 168});
  final ManualMethod m;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final payload = manualQrData(m);
    final caption = !m.bank
        ? t('payments.card.qrCrypto')
        : (m.details.upiId != null && m.qrUrl == null ? t('payments.card.qrUpi') : t('payments.card.qrBank'));
    Widget withCaption(Widget code) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(child: code),
        const SizedBox(height: 8),
        Text(
          caption,
          textAlign: TextAlign.center,
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11.5),
        ),
      ],
    );
    final generated = payload == null ? null : KQrCode(payload, size: size);
    if (m.qrUrl == null) return generated == null ? const SizedBox.shrink() : withCaption(generated);
    final id = manualMediaId(m.qrUrl) ?? m.qrMediaId;
    if (id == null) return generated == null ? const SizedBox.shrink() : withCaption(generated);
    final image = ref.watch(manualMediaProvider(id));
    return image.when(
      skipLoadingOnReload: true,
      loading: () => withCaption(KSkeleton(width: size + 20, height: size + 20, radius: 18)),
      error: (_, _) => generated == null ? const SizedBox.shrink() : withCaption(generated),
      data: (bytes) => withCaption(
        Container(
          key: const ValueKey('manual-qr-image'),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: k.line),
          ),
          child: Image.memory(
            bytes,
            width: size,
            height: size,
            fit: BoxFit.contain,
            gaplessPlayback: true,
            errorBuilder: (_, _, _) => generated == null ? SizedBox(width: size, height: size) : KQrCode(payload!, size: size - 20),
          ),
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ how it works */

/// The four steps of a bank / crypto deposit (web ManualHowItWorks).
class ManualHowItWorks extends StatelessWidget {
  const ManualHowItWorks({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('payments.how.title')),
          const SizedBox(height: 14),
          for (var i = 1; i <= 4; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 1 ? 0 : 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: k.line),
                    ),
                    child: Text('$i', style: context.text.caption.copyWith(color: k.fg2, fontSize: 11)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t('payments.how.step$i.title'), style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(t('payments.how.step$i.text'), style: context.text.footnote.copyWith(color: k.fg3)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
