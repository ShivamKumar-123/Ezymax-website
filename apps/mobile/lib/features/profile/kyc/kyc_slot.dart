// One document slot (web components/verification/capture.tsx DocSlot / PoaSlot / CheckList): take a photo (the
// phone's camera) or choose a file -> instant checks -> "Use this photo" uploads it -> "Received and encrypted".
// The web's in-page camera with its on-screen guide and live hints becomes the system camera (image_picker).
import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../widgets/profile_ui.dart';
import 'kyc_checks.dart';
import 'kyc_models.dart';
import 'kyc_upload.dart';

enum _Mode { idle, checking, review, uploading, done, error }

/// A captured or chosen file waiting for "Use this photo" (web Captured).
class _Captured {
  const _Captured(this.bytes, this.mime, this.name, this.checks);
  final Uint8List bytes;
  final String mime, name;
  final ClientChecks checks;
}

bool _isImage(String mime) => mime.startsWith('image/') && !mime.contains('hei');

/// The check list (web CheckList): an icon per state, the label and the detail.
class KycCheckList extends StatelessWidget {
  const KycCheckList({super.key, required this.rows});
  final List<CheckRow> rows;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      label: context.t('kyc.check.listAria'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final r in rows)
            Padding(
              key: ValueKey('check-${r.key}-${r.state.name}'),
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: switch (r.state) {
                      CheckState.ok => Icon(LucideIcons.circleCheck, size: 16, color: k.up),
                      CheckState.warn => Icon(LucideIcons.triangleAlert, size: 16, color: k.warn),
                      CheckState.fail => Icon(LucideIcons.x, size: 16, color: k.down),
                      CheckState.info => Icon(LucideIcons.info, size: 16, color: k.info),
                    },
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: r.label,
                            style: TextStyle(color: k.fg, fontWeight: FontWeight.w600),
                          ),
                          const TextSpan(text: '  '),
                          TextSpan(
                            text: r.detail,
                            style: TextStyle(
                              color: switch (r.state) {
                                CheckState.fail => k.down,
                                CheckState.warn => k.warn,
                                _ => k.fg3,
                              },
                            ),
                          ),
                        ],
                      ),
                      style: context.text.footnote.copyWith(fontSize: 13),
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

class DocSlot extends ConsumerStatefulWidget {
  const DocSlot({
    super.key,
    required this.slot,
    required this.label,
    required this.hint,
    required this.purpose,
    required this.onUploaded,
    this.passport = false,
    this.doc,
    this.requested = false,
    this.issueDate,
    this.docType,
    this.blocked,
    this.preferCamera = false,
  });

  final KycSlot slot;
  final String label, hint;
  final KycPurpose purpose;
  final bool passport;
  final KycDocument? doc;
  final bool requested;

  /// The proof of address's issue date (yyyy-mm-dd) once it is valid; checked and sent with the upload.
  final String? issueDate;
  final String? docType;

  /// Why the slot can't be used yet (e.g. "Enter the issue date first").
  final String? blocked;
  final bool preferCamera;
  final ValueChanged<KycState> onUploaded;

  @override
  ConsumerState<DocSlot> createState() => _DocSlotState();
}

class _DocSlotState extends ConsumerState<DocSlot> {
  late _Mode _mode = _current != null ? _Mode.done : _Mode.idle;
  _Captured? _cap;
  String? _msg, _note;

  KycDocument? get _current => widget.doc != null && widget.doc!.current ? widget.doc : null;
  bool get _selfie => widget.purpose == KycPurpose.selfie;
  String get _testId => widget.slot.key.replaceAll(':', '-');

  @override
  void didUpdateWidget(DocSlot old) {
    super.didUpdateWidget(old);
    if (_current != null && _mode == _Mode.idle) _mode = _Mode.done;
  }

  void _fail(String m) => setState(() {
    _msg = m;
    _mode = _Mode.error;
  });

  Future<void> _camera() async {
    final t = context.t;
    KycPicked? p;
    try {
      p = await ref.read(kycPickerProvider).camera(selfie: _selfie);
    } on KycCameraUnavailable catch (e) {
      if (mounted) {
        setState(() {
          _note = e.blocked ? t('app.profile.cameraBlocked') : t('kyc.camera.none');
          _mode = _current != null ? _Mode.done : _Mode.idle;
        });
      }
      return;
    }
    final shot = p;
    if (shot == null || !mounted) return;
    setState(() {
      _msg = null;
      _mode = _Mode.checking;
    });
    final checks =
        await analyzeImage(shot.bytes, widget.purpose, passport: widget.passport, origin: 'camera') ??
        (ClientChecks(source: 'camera')..skipped = kSkippedFormat);
    if (widget.issueDate != null) checks.withIssueDate(widget.issueDate!);
    if (!mounted) return;
    setState(() {
      _cap = _Captured(shot.bytes, shot.mime.startsWith('image/') ? shot.mime : 'image/jpeg', shot.name, checks);
      _mode = _Mode.review;
    });
  }

  Future<void> _file() async {
    final t = context.t;
    final p = await ref.read(kycPickerProvider).file(allowPdf: !_selfie);
    if (p == null || !mounted) return;
    await pick(p, t);
  }

  /// The web's pickFile: size, type, the checks.
  Future<void> pick(KycPicked f, T t) async {
    setState(() => _msg = null);
    if (f.bytes.length > kKycMaxBytes) {
      _fail(t('kyc.slot.error.tooLarge'));
      return;
    }
    setState(() => _mode = _Mode.checking);
    final mime = f.mime;
    var checks = ClientChecks(source: f.origin);
    if (mime.startsWith('image/') && mime != 'image/heic' && mime != 'image/heif') {
      final c = await analyzeImage(f.bytes, widget.purpose, passport: widget.passport, origin: f.origin);
      if (c != null) {
        checks = c;
      } else {
        checks.skipped = kSkippedFormat; // stored in English for the reviewer; translated in checkRows
      }
    } else if (mime == 'application/pdf') {
      if (_selfie) {
        _fail(t('kyc.slot.error.selfiePhoto'));
        return;
      }
      checks.skipped = kSkippedPdf;
    } else if (mime == 'image/heic' || mime == 'image/heif') {
      checks.skipped = kSkippedHeic;
    } else {
      _fail(t('kyc.slot.error.format'));
      return;
    }
    if (widget.issueDate != null) checks.withIssueDate(widget.issueDate!);
    if (!mounted) return;
    setState(() {
      _cap = _Captured(f.bytes, mime, f.name.isEmpty ? 'document' : f.name, checks);
      _mode = _Mode.review;
    });
  }

  Future<void> _send() async {
    final cap = _cap;
    if (cap == null) return;
    final t = context.t;
    setState(() => _mode = _Mode.uploading);
    try {
      final state = await uploadKycDocument(
        ref.read(apiProvider),
        widget.slot,
        cap.bytes,
        name: cap.name,
        mime: cap.mime,
        checks: cap.checks,
        issueDate: widget.issueDate,
        docType: widget.docType,
      );
      kycPreviews[widget.slot.key] = (bytes: cap.bytes, mime: cap.mime);
      if (!mounted) return;
      setState(() => _mode = _Mode.done);
      widget.onUploaded(state);
    } on ApiException catch (e) {
      if (mounted) _fail(localizeError(e, t));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cap = _cap;
    final rows = cap == null ? const <CheckRow>[] : checkRows(cap.checks, widget.purpose, t, passport: widget.passport);
    final hardFail = rows.any((r) => r.state == CheckState.fail);
    final warns = rows.where((r) => r.state == CheckState.warn).length;
    final local = kycPreviews[widget.slot.key];
    final current = _current;
    final done = _mode == _Mode.done;

    Widget body;
    switch (_mode) {
      case _Mode.checking:
        body = SizedBox(
          height: 120,
          child: Center(
            child: Text(t('kyc.slot.checkingPhoto'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
          ),
        );
      case _Mode.review || _Mode.uploading when cap != null:
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Preview(bytes: cap.bytes, image: _isImage(cap.mime)),
            const SizedBox(height: 14),
            KycCheckList(rows: rows),
            const SizedBox(height: 10),
            if (_mode == _Mode.uploading) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(t('kyc.slot.uploading'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const _IndeterminateBar(),
            ] else ...[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  KButton(
                    key: ValueKey('use-$_testId'),
                    label: warns > 0 ? t('kyc.slot.useAnyway') : (_selfie ? t('kyc.slot.useSelfie') : t('kyc.slot.usePhoto')),
                    icon: LucideIcons.check,
                    size: KButtonSize.sm,
                    onPressed: hardFail ? null : () => unawaited(_send()),
                  ),
                  KButton(
                    label: cap.checks.source == 'camera' ? t('kyc.slot.retake') : t('kyc.slot.chooseAnother'),
                    icon: LucideIcons.refreshCw,
                    size: KButtonSize.sm,
                    variant: KButtonVariant.surface,
                    onPressed: () {
                      if (cap.checks.source == 'camera') {
                        unawaited(_camera());
                      } else {
                        setState(() => _mode = _Mode.idle);
                      }
                    },
                  ),
                ],
              ),
              if (warns > 0) ...[
                const SizedBox(height: 8),
                Text(
                  t('kyc.slot.clearerFaster'),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ],
          ],
        );
      case _Mode.done:
        final res = current?.resolution;
        final dims = res?['width'] != null ? '${res!['width']} × ${res['height']} px · ' : '';
        final size = current == null ? '' : '${(current.sizeBytes / 1024 / 1024).toStringAsFixed(2)} MB';
        body = Row(
          children: [
            if (local != null && _isImage(local.mime))
              ClipRRect(
                borderRadius: BorderRadius.circular(_selfie ? 32 : 12),
                child: Image.memory(local.bytes, width: 64, height: 64, fit: BoxFit.cover, gaplessPlayback: true),
              )
            else
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: k.surface3,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: k.line),
                ),
                child: Icon(LucideIcons.fileText, size: 24, color: k.fg3),
              ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.circleCheck, size: 16, color: k.up),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          t('kyc.slot.received'),
                          style: context.text.footnote.copyWith(color: k.up, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$dims$size',
                    textDirection: TextDirection.ltr,
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ],
              ),
            ),
            KButton(
              label: t('kyc.slot.replace'),
              size: KButtonSize.sm,
              variant: KButtonVariant.ghost,
              onPressed: widget.blocked != null ? null : () => unawaited(widget.preferCamera || widget.purpose != KycPurpose.poa ? _camera() : _file()),
            ),
          ],
        );
      default:
        final camera = _note == null;
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_mode == _Mode.error && _msg != null) ...[_Banner(text: _msg!, tone: KChipTone.down), const SizedBox(height: 10)],
            if (_note != null) ...[_Banner(text: _note!, tone: KChipTone.neutral), const SizedBox(height: 10)],
            if (widget.blocked != null)
              _Dashed(text: widget.blocked!)
            else ...[
              if (camera)
                _Choice(
                  key: ValueKey('camera-$_testId'),
                  icon: LucideIcons.camera,
                  title: _selfie ? t('kyc.slot.takeSelfie') : t('kyc.slot.takePhoto'),
                  text: t('kyc.slot.instantCheck'),
                  strong: !(widget.purpose == KycPurpose.poa && !widget.preferCamera),
                  onTap: () => unawaited(_camera()),
                ),
              if (camera) const SizedBox(height: 8),
              _Choice(
                key: ValueKey('file-$_testId'),
                icon: LucideIcons.upload,
                title: t('kyc.slot.uploadFile'),
                text: _selfie ? t('kyc.slot.formatsSelfie') : t('kyc.slot.formats'),
                onTap: () => unawaited(_file()),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              t('kyc.slot.minSide', {'min': kMinSide[widget.purpose]}),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
            ),
          ],
        );
    }

    return Container(
      key: ValueKey('slot-$_testId'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: done
              ? k.up.withValues(alpha: 0.3)
              : widget.requested
              ? k.warn.withValues(alpha: 0.5)
              : k.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(widget.label, style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                        if (widget.requested && !done) KChip(label: t('kyc.slot.requested'), tone: KChipTone.warn, dot: true, small: true),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(widget.hint, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                  ],
                ),
              ),
              if (done) ...[const SizedBox(width: 8), KChip(label: t('kyc.slot.uploaded'), tone: KChipTone.up, icon: LucideIcons.check, small: true)],
            ],
          ),
          const SizedBox(height: 12),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: KeyedSubtree(key: ValueKey(_mode), child: body),
          ),
        ],
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({super.key, required this.icon, required this.title, required this.text, required this.onTap, this.strong = false});
  final IconData icon;
  final String title, text;
  final VoidCallback onTap;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      semanticLabel: title,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: strong ? k.emberSoft.withValues(alpha: 0.4) : k.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: strong ? k.ember.withValues(alpha: 0.4) : k.line),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: strong ? k.ember : k.fg2),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
                  Text(
                    text,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.tone});
  final String text;
  final KChipTone tone;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final down = tone == KChipTone.down;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: down ? k.downSoft : k.surface3,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: down ? k.down.withValues(alpha: 0.3) : k.line),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(down ? LucideIcons.triangleAlert : LucideIcons.info, size: 16, color: down ? k.down : k.fg2),
            const SizedBox(width: 8),
            Expanded(
              child: Text(text, style: context.text.footnote.copyWith(color: down ? k.down : k.fg2)),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dashed extends StatelessWidget {
  const _Dashed({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return CustomPaint(
      painter: _DashPainter(k.line),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3),
        ),
      ),
    );
  }
}

class _DashPainter extends CustomPainter {
  _DashPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(14)));
    for (final m in path.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 9) {
        canvas.drawPath(m.extractPath(d, d + 5), p);
      }
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}

class _Preview extends StatelessWidget {
  const _Preview({required this.bytes, required this.image});
  final Uint8List bytes;
  final bool image;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return AspectRatio(
      aspectRatio: 4 / 3,
      child: Container(
        decoration: BoxDecoration(
          color: image ? Colors.black : k.surface3,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: k.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: image
            ? Image.memory(bytes, fit: BoxFit.contain, semanticLabel: context.t('kyc.slot.previewAlt'), gaplessPlayback: true)
            : Icon(LucideIcons.fileText, size: 40, color: k.fg3),
      ),
    );
  }
}

/// The upload bar: the API client has no upload progress, so it runs without a percentage.
class _IndeterminateBar extends StatefulWidget {
  const _IndeterminateBar();

  @override
  State<_IndeterminateBar> createState() => _IndeterminateBarState();
}

class _IndeterminateBarState extends State<_IndeterminateBar> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return ClipRRect(
      borderRadius: BorderRadius.circular(3),
      child: SizedBox(
        height: 6,
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => Stack(
            children: [
              Positioned.fill(child: ColoredBox(color: k.surface3)),
              FractionallySizedBox(
                alignment: AlignmentDirectional(-1 + 2.6 * _c.value - 0.3, 0),
                widthFactor: 0.35,
                child: Container(color: k.ember),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ proof of address */

/// "yyyy-mm-dd" of today (web todayIso).
String todayIso() => isoDate(DateTime.now());

/// Proof of address: the document type and its issue date (≤ 3 months, checked at once), then the slot (web PoaSlot).
class PoaSlot extends StatefulWidget {
  const PoaSlot({super.key, required this.slot, required this.label, required this.onUploaded, this.doc, this.requested = false, this.company = false});
  final KycSlot slot;
  final String label;
  final KycDocument? doc;
  final bool requested;
  final bool company;
  final ValueChanged<KycState> onUploaded;

  @override
  State<PoaSlot> createState() => _PoaSlotState();
}

class _PoaSlotState extends State<PoaSlot> {
  late String _type = widget.doc?.docType ?? 'utility_bill';
  late String _date = widget.doc?.issueDate ?? '';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final age = _date.isEmpty ? null : ageDays(_date);
    final ok = age != null && age >= 0 && age <= 92;
    final poaType = kPoaTypes.where((o) => o.$1 == _type).firstOrNull;
    final typeLabel = poaType != null ? t(poaType.$2).toLowerCase() : t('kyc.poa.document');
    final now = DateTime.now();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KPickerField(
          label: t('kyc.poa.documentType'),
          value: poaType == null ? null : t(poaType.$2),
          onTap: () async {
            final v = await showKPicker<String>(
              context,
              title: t('kyc.poa.documentType'),
              selected: _type,
              options: [for (final o in kPoaTypes) KPickOption(o.$1, t(o.$2))],
            );
            if (v != null) setState(() => _type = v);
          },
        ),
        const SizedBox(height: 12),
        PDateField(
          key: ValueKey('issue-${widget.slot.kind}'),
          label: t('kyc.poa.issueDateLabel'),
          value: _date,
          max: DateTime(now.year, now.month, now.day),
          onChanged: (v) => setState(() => _date = v),
          hint: age == null
              ? null
              : ok
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.check, size: 13, color: k.up),
                    const SizedBox(width: 4),
                    Text(age == 0 ? t('kyc.poa.issuedToday') : t('kyc.check.issuedDaysAgo', {'count': age}), style: TextStyle(color: k.up)),
                  ],
                )
              : Text(age < 0 ? t('kyc.poa.future') : t('kyc.poa.tooOldShort'), style: TextStyle(color: k.down)),
        ),
        if (age != null && !ok && age > 92) ...[
          const SizedBox(height: 10),
          _Banner(text: t(widget.company ? 'kyc.poa.tooOldCompany' : 'kyc.poa.tooOld', {'type': typeLabel}), tone: KChipTone.down),
        ],
        const SizedBox(height: 12),
        DocSlot(
          slot: widget.slot,
          label: widget.label,
          hint: widget.company ? t('kyc.poa.hintCompany') : t('kyc.poa.hint'),
          purpose: KycPurpose.poa,
          doc: widget.doc,
          requested: widget.requested,
          issueDate: ok ? _date : null,
          docType: _type,
          blocked: ok ? null : t('kyc.poa.blocked'),
          onUploaded: widget.onUploaded,
        ),
      ],
    );
  }
}
