// The deposit request a client sends after paying a manual method (port of apps/crm/components/wallet-live/manual/
// form.tsx without MetaMask): the amount in the method currency with "You'll receive ≈ X USDT", the UTR / transaction
// hash, an optional screenshot (the gallery, uploaded at once with its progress) and note; one idempotency key per
// distinct request, kept while the same request is retried. Then "Request sent".
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../manual_api.dart';
import '../wallet_api.dart';
import 'wallet_ui.dart';

/// The request form of one method (web RequestForm). Keyed by the method, so another method starts empty.
class ManualRequestForm extends ConsumerStatefulWidget {
  const ManualRequestForm({super.key, required this.method, required this.maxPending, required this.onSent});
  final ManualMethod method;
  final int maxPending;
  final ValueChanged<ManualDeposit> onSent;

  /// The submit button (tests).
  static const submitKey = ValueKey('manual-submit');

  @override
  ConsumerState<ManualRequestForm> createState() => _ManualRequestFormState();
}

class _ManualRequestFormState extends ConsumerState<ManualRequestForm> {
  final _amount = TextEditingController();
  final _reference = TextEditingController();
  final _note = TextEditingController();
  final _amountFocus = FocusNode();

  /// The amount field was left (or a submit tried): its problems show.
  bool _touched = false;
  bool _busy = false;
  String? _err;

  /// One idempotency key per distinct request: the same body again (a retry) reuses it.
  ({String sig, String key})? _attempt;

  // the screenshot: chosen, uploading (with progress), uploaded (its media id goes in the request)
  ManualProof? _proof;
  ManualMedia? _media;
  double _progress = 0;
  CancelToken? _upload;

  ManualMethod get _m => widget.method;
  bool get _crypto => !_m.bank;
  bool get _uploading => _proof != null && _media == null && _upload != null;

  @override
  void initState() {
    super.initState();
    _amountFocus.addListener(() {
      if (mounted && !_amountFocus.hasFocus && _amount.text.trim().isNotEmpty && !_touched) setState(() => _touched = true);
    });
  }

  @override
  void dispose() {
    _upload?.cancel();
    _amount.dispose();
    _reference.dispose();
    _note.dispose();
    _amountFocus.dispose();
    super.dispose();
  }

  /// The amount's problem as the field shows it (after the field was left), or null.
  String? _amountError(T t) {
    final a = _amount.text.trim();
    if (!_touched || a.isEmpty) return null;
    return switch (manualAmountIssue(_m, a)) {
      ManualAmountIssue.empty || ManualAmountIssue.invalid => t('payments.form.invalidAmount'),
      ManualAmountIssue.belowMin => t('payments.form.min', {'amount': manualLtr(t, manualMoney(_m.minAmount, _m.currency))}),
      ManualAmountIssue.aboveMax => t('payments.form.max', {'amount': manualLtr(t, manualMoney(_m.maxAmount!, _m.currency))}),
      null => null,
    };
  }

  Future<void> _submit() async {
    final t = context.t;
    if (_busy || _uploading) return;
    setState(() => _touched = true);
    if (manualAmountIssue(_m, _amount.text) != null) {
      setState(() => _err = _amountError(t) ?? t('payments.form.invalidAmount'));
      return;
    }
    if (!manualReferenceOk(_reference.text)) {
      setState(() => _err = t('payments.form.invalidReference'));
      return;
    }
    final body = manualDepositBody(methodId: _m.id, amount: _amount.text, reference: _reference.text, proofMediaId: _media?.id, note: _note.text);
    final sig = jsonEncode(body);
    if (_attempt?.sig != sig) _attempt = (sig: sig, key: requestId());
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final d = await submitManualDeposit(ref.read(apiProvider), body, key: _attempt!.key);
      _attempt = null;
      KHaptics.success();
      if (!mounted) return;
      ref.invalidate(manualDepositsProvider);
      widget.onSent(d);
    } catch (e) {
      KHaptics.error();
      if (!mounted) return;
      if (e is ApiException) {
        // the method was hidden meanwhile, or the pending list changed: the page reads them again
        if (e.code == 'method_unavailable') ref.invalidate(manualMethodsProvider);
        if (e.code == 'too_many_pending' || e.code == 'reference_used') ref.invalidate(manualDepositsProvider);
      }
      setState(() => _err = manualErrorText(e, t, method: _m, maxPending: widget.maxPending));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Picks a screenshot from the gallery and uploads it at once (web pickFile).
  Future<void> _pickProof() async {
    final t = context.t;
    ManualProof? p;
    try {
      p = await ref.read(manualProofPickerProvider).pick();
    } catch (_) {
      if (mounted) setState(() => _err = t('payments.error.uploadFailed'));
      return;
    }
    if (p == null || !mounted) return;
    final issue = manualProofIssue(p, t);
    if (issue != null) {
      setState(() => _err = issue);
      return;
    }
    final cancel = CancelToken();
    setState(() {
      _err = null;
      _proof = p;
      _media = null;
      _progress = 0;
      _upload = cancel;
    });
    try {
      final media = await uploadManualProof(
        ref.read(apiProvider),
        p,
        cancel: cancel,
        onProgress: (sent, total) {
          if (mounted && total > 0 && identical(_upload, cancel)) setState(() => _progress = (sent / total).clamp(0.0, 1.0));
        },
      );
      if (!mounted || !identical(_upload, cancel)) return;
      setState(() {
        _media = media;
        _upload = null;
      });
    } catch (e) {
      if (!mounted || !identical(_upload, cancel)) return;
      setState(() {
        _proof = null;
        _upload = null;
        _err = manualErrorText(e, t, fallback: t('payments.error.uploadFailed'));
      });
    }
  }

  void _removeProof() {
    _upload?.cancel();
    setState(() {
      _upload = null;
      _proof = null;
      _media = null;
      _progress = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final m = _m;
    final amount = _amount.text.trim();
    final credit = manualAmountIssue(m, amount) == ManualAmountIssue.invalid ? null : manualReceive(amount, m.rate);
    final label = context.text.label.copyWith(color: k.fg2);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('payments.form.title'), subtitle: t('payments.form.subtitle')),
          const SizedBox(height: 16),
          KTextField(
            key: const ValueKey('manual-amount'),
            label: t('payments.form.amount'),
            controller: _amount,
            focusNode: _amountFocus,
            placeholder: _crypto ? '100' : '10000.00',
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [manualAmountFormatter(_crypto ? 6 : 2)],
            ltr: true,
            error: _amountError(t),
            onChanged: (_) => setState(() => _err = null),
            trailing: Padding(
              padding: const EdgeInsetsDirectional.only(end: 10),
              child: Text(m.currency, style: context.text.label.copyWith(color: k.fg2, fontSize: 12.5)),
            ),
          ),
          FieldHint(t('payments.form.amountHint', {'currency': m.currency})),
          const SizedBox(height: 12),
          // what the wallet receives at the method's rate
          Container(
            key: const ValueKey('manual-receive'),
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('payments.form.receive', {'amount': manualLtr(t, credit == null ? '0.00' : decimalDisplay(credit))}),
                  style: context.text.headline.copyWith(fontSize: 17, fontWeight: FontWeight.w600, fontFeatures: kTabular),
                ),
                const SizedBox(height: 2),
                Text(
                  t('payments.form.receiveNote', {'rate': manualLtr(t, manualRateText(m.rate)), 'currency': m.currency}),
                  style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          KTextField(
            key: const ValueKey('manual-reference'),
            label: _crypto ? t('payments.form.referenceCrypto') : t('payments.form.referenceBank'),
            controller: _reference,
            placeholder: ltrHint(_crypto ? t('payments.form.referenceCryptoPlaceholder') : t('payments.form.referenceBankPlaceholder')),
            ltr: true,
            inputFormatters: [LengthLimitingTextInputFormatter(128)],
            onChanged: (_) {
              if (_err != null) setState(() => _err = null);
            },
          ),
          FieldHint(_crypto ? t('payments.form.referenceCryptoHint') : t('payments.form.referenceBankHint')),
          const SizedBox(height: 16),
          // the screenshot
          Text(t('payments.form.proof'), style: label),
          const SizedBox(height: 6),
          if (_proof == null)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KButton(
                key: const ValueKey('manual-proof-choose'),
                label: t('payments.form.proofChoose'),
                icon: LucideIcons.imagePlus,
                variant: KButtonVariant.surface,
                onPressed: _busy ? null : _pickProof,
              ),
            )
          else
            _ProofRow(proof: _proof!, uploading: _uploading, progress: _progress, onRemove: _removeProof),
          FieldHint(t('payments.form.proofHint')),
          const SizedBox(height: 16),
          KTextField(
            key: const ValueKey('manual-note'),
            label: t('payments.form.note'),
            controller: _note,
            placeholder: t('payments.form.notePlaceholder'),
            inputFormatters: [LengthLimitingTextInputFormatter(500)],
            textCapitalization: TextCapitalization.sentences,
          ),
          WalletInlineError(_err, top: 14),
          const SizedBox(height: 18),
          KButton(
            key: ManualRequestForm.submitKey,
            label: _busy ? t('payments.form.sending') : t('payments.form.submit'),
            icon: LucideIcons.send,
            size: KButtonSize.lg,
            expand: true,
            loading: _busy,
            onPressed: _busy || _uploading ? null : _submit,
          ),
        ],
      ),
    );
  }
}

/// The chosen screenshot: a thumbnail, its name, the upload progress, and Remove.
class _ProofRow extends StatelessWidget {
  const _ProofRow({required this.proof, required this.uploading, required this.progress, required this.onRemove});
  final ManualProof proof;
  final bool uploading;
  final double progress;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return WalletRow(
      key: const ValueKey('manual-proof'),
      padding: const EdgeInsetsDirectional.fromSTEB(8, 8, 4, 8),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.memory(
              proof.bytes,
              width: 48,
              height: 48,
              fit: BoxFit.cover,
              gaplessPlayback: true,
              errorBuilder: (_, _, _) => Container(
                width: 48,
                height: 48,
                color: k.surface3,
                child: Icon(LucideIcons.image, size: 18, color: k.fg3),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  proof.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12.5),
                ),
                if (uploading) ...[
                  const SizedBox(height: 6),
                  KProgressBar(value: progress, height: 4),
                  const SizedBox(height: 4),
                  Text(
                    t('payments.form.proofProgress', {'percent': (progress * 100).round()}),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11, fontFeatures: kTabular),
                  ),
                ],
              ],
            ),
          ),
          KIconButton(icon: LucideIcons.x, size: 32, semanticLabel: t('payments.form.proofRemove'), onPressed: onRemove),
        ],
      ),
    );
  }
}

/// After sending (web RequestSent): the request is waiting for the broker; send another or see the list.
class ManualRequestSent extends StatelessWidget {
  const ManualRequestSent({super.key, required this.d, required this.onAnother, required this.onList});
  final ManualDeposit d;
  final VoidCallback onAnother, onList;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KCard(
      key: const ValueKey('manual-sent'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: k.upSoft,
                shape: BoxShape.circle,
                border: Border.all(color: k.up.withValues(alpha: 0.3)),
              ),
              child: Icon(LucideIcons.circleCheck, size: 28, color: k.up),
            ),
            const SizedBox(height: 12),
            Text(t('payments.success.title'), textAlign: TextAlign.center, style: context.text.title2),
            const SizedBox(height: 6),
            Text(
              t('payments.success.text'),
              textAlign: TextAlign.center,
              style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
            ),
            const SizedBox(height: 10),
            Text(
              '${manualMoney(d.amount, d.currency)} · ${t('payments.list.expected', {'amount': decimalDisplay(d.expectedCredit)})}',
              textAlign: TextAlign.center,
              textDirection: TextDirection.ltr,
              style: context.text.label.copyWith(color: k.fg2, fontFeatures: kTabular),
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                KButton(label: t('payments.success.another'), onPressed: onAnother),
                KButton(label: t('payments.success.viewRequests'), variant: KButtonVariant.surface, onPressed: onList),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
