// The KYC forms (web components/verification/live-verification.tsx): Start (individual / company), the wizard
// (individual: details › identity document › proof of address › selfie › review; company: company › people ›
// documents › selfie › review) with the checking sequence on submit, and "We need a little more from you".
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../../auth/auth_widgets.dart' show kCountries, maxDob;
import '../widgets/profile_ui.dart';
import 'kyc_checks.dart';
import 'kyc_models.dart';
import 'kyc_slot.dart';
import 'kyc_tracker.dart';
import 'kyc_upload.dart';

bool _rtl(BuildContext c) => Directionality.of(c) == TextDirection.rtl;

void _toastError(WidgetRef ref, String message) => ref.read(notificationsProvider.notifier).toast(NotificationKind.error, message);

/// The step's title and line (web StepTitle).
class KycStepTitle extends StatelessWidget {
  const KycStepTitle({super.key, required this.title, required this.text});
  final String title, text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: context.text.title2.copyWith(fontSize: 18, fontWeight: FontWeight.w500)),
        const SizedBox(height: 2),
        Text(text, style: context.text.footnote.copyWith(color: context.k.fg3, fontSize: 13)),
      ],
    ),
  );
}

/// Back (ghost) and the step's primary action (web StepNav).
class KycStepNav extends StatelessWidget {
  const KycStepNav({super.key, required this.onNext, this.onBack, this.nextLabel, this.disabled = false, this.busy = false});
  final VoidCallback? onBack;
  final VoidCallback onNext;
  final String? nextLabel;
  final bool disabled, busy;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final rtl = _rtl(context);
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Row(
        children: [
          if (onBack != null)
            KButton(label: t('common.back'), icon: rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft, variant: KButtonVariant.ghost, onPressed: onBack),
          const Spacer(),
          Flexible(
            flex: 3,
            child: KButton(
              key: const ValueKey('step-next'),
              label: busy ? t('kyc.wizard.saving') : (nextLabel ?? t('common.continue')),
              trailingIcon: busy ? null : (rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight),
              onPressed: disabled || busy ? null : onNext,
            ),
          ),
        ],
      ),
    );
  }
}

/// A selectable card of a radio group (web `role="radio"` buttons: ID type, verification type).
class KycRadioCard extends StatelessWidget {
  const KycRadioCard({super.key, required this.icon, required this.title, required this.text, required this.selected, required this.onTap});
  final IconData icon;
  final String title, text;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      child: KPressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          decoration: BoxDecoration(
            color: selected ? k.emberSoft.withValues(alpha: 0.5) : k.surface2,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? k.ember.withValues(alpha: 0.6) : k.line),
          ),
          child: Row(
            children: [
              Icon(icon, size: 20, color: selected ? k.ember : k.fg3),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: context.text.label.copyWith(fontSize: 14, color: k.fg)),
                    Text(text, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A bordered row with an icon and a line (web `.k-row` items: what you'll need, selfie tips).
class KycInfoRow extends StatelessWidget {
  const KycInfoRow({super.key, required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(k.rowRadius),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: k.fg3),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

/// The web's CountrySelect: the sign-up countries plus the current value when it isn't one of them.
class KycCountryField extends StatelessWidget {
  const KycCountryField({super.key, required this.label, required this.value, required this.onChanged, this.extra, this.error});
  final String label;
  final String value;
  final String? extra;
  final String? error;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final codes = {for (final c in kCountries) c.$1};
    final list = [
      for (final c in kCountries) (c.$1, c.$2),
      for (final x in {?extra, value})
        if (x.isNotEmpty && !codes.contains(x.toLowerCase())) (x, countryLabel(t, x)),
    ];
    return KPickerField(
      label: label,
      value: value.isEmpty ? null : countryLabel(t, value),
      placeholder: t('kyc.wizard.choose'),
      error: error,
      leading: value.isEmpty ? null : KFlag(value.toLowerCase(), size: 18),
      onTap: () async {
        final v = await showKPicker<String>(
          context,
          title: label,
          selected: value,
          options: [for (final c in list) KPickOption(c.$1, c.$2, leading: KFlag(c.$1))],
        );
        if (v != null) onChanged(v);
      },
    );
  }
}

/// A checkbox with a label (consent, roles).
class KycCheck extends StatelessWidget {
  const KycCheck({super.key, required this.value, required this.onChanged, required this.label});
  final bool value;
  final ValueChanged<bool> onChanged;
  final String label;

  @override
  Widget build(BuildContext context) => KCheckRow(value: value, onChanged: onChanged, child: Text(label));
}

/// web useSave: `POST kyc/details`, the field error (and a toast) when refused.
mixin _KycSave<W extends ConsumerStatefulWidget> on ConsumerState<W> {
  bool busy = false;
  ({String? field, String message})? err;

  Future<bool> save(Map<String, Object?> body, ValueChanged<KycState> apply) async {
    setState(() {
      busy = true;
      err = null;
    });
    try {
      final s = await kycPost(ref.read(apiProvider), 'details', body);
      if (!mounted) return false;
      setState(() => busy = false);
      apply(s);
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      final msg = localizeError(e, context.t);
      setState(() {
        busy = false;
        err = (field: e.field, message: msg);
      });
      _toastError(ref, msg);
      return false;
    }
  }

  String? fieldErr(String f) => err?.field == f ? err!.message : null;
}

/* ------------------------------------------------------------------ start */

class KycStartPanel extends ConsumerStatefulWidget {
  const KycStartPanel({super.key, required this.state, required this.onStarted});
  final KycState state;
  final ValueChanged<KycState> onStarted;

  @override
  ConsumerState<KycStartPanel> createState() => _KycStartPanelState();
}

class _KycStartPanelState extends ConsumerState<KycStartPanel> {
  String _kind = 'individual';
  bool _busy = false;

  Future<void> _go() async {
    setState(() => _busy = true);
    try {
      final s = await kycPost(ref.read(apiProvider), 'start', {'kind': _kind});
      if (!mounted) return;
      setState(() => _busy = false);
      widget.onStarted(s);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toastError(ref, localizeError(e, context.t));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final again = widget.state.kase?.status == 'rejected';
    final individual = _kind == 'individual';
    final need = individual
        ? [(LucideIcons.idCard, t('kyc.start.need.idDoc')), (LucideIcons.fileText, t('kyc.start.need.poa')), (LucideIcons.scanFace, t('kyc.start.need.selfie'))]
        : [
            (LucideIcons.building2, t('kyc.start.need.companyDocs')),
            (LucideIcons.userRound, t('kyc.start.need.people')),
            (LucideIcons.scanFace, t('kyc.start.need.directorSelfie')),
          ];
    final rtl = _rtl(context);
    return Column(
      key: const ValueKey('kyc-start'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycStepTitle(
          title: again ? t('kyc.start.titleAgain') : t('kyc.start.title'),
          text: t('kyc.start.text', {'minutes': individual ? '3' : '10', 'hours': hoursLabel(t, widget.state.typicalHours)}),
        ),
        Semantics(
          label: t('kyc.start.typeLabel'),
          child: Column(
            children: [
              KycRadioCard(
                icon: LucideIcons.userRound,
                title: t('kyc.start.individual'),
                text: t('kyc.start.individualText'),
                selected: individual,
                onTap: () => setState(() => _kind = 'individual'),
              ),
              KycRadioCard(
                icon: LucideIcons.building2,
                title: t('kyc.start.company'),
                text: t('kyc.start.companyText'),
                selected: !individual,
                onTap: () => setState(() => _kind = 'corporate'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(t('kyc.start.needTitle'), style: context.text.label.copyWith(fontSize: 13, color: context.k.fg)),
        const SizedBox(height: 8),
        for (final (icon, text) in need) KycInfoRow(icon: icon, text: text),
        const SizedBox(height: 16),
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: KButton(
            key: const ValueKey('kyc-start-button'),
            label: _busy ? t('kyc.start.starting') : t('kyc.start.button'),
            size: KButtonSize.lg,
            trailingIcon: rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight,
            onPressed: _busy ? null : () => unawaited(_go()),
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ the wizard */

/// The web Stepper on phones: numbered circles (done = check) joined by lines, labels hidden.
class KycPhoneStepper extends StatelessWidget {
  const KycPhoneStepper({super.key, required this.steps, required this.current});
  final List<String> steps;
  final int current;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      label: steps[current.clamp(0, steps.length - 1)],
      child: Row(
        children: [
          for (var i = 0; i < steps.length; i++) ...[
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: i < current ? k.upSoft : (i == current ? k.ember : k.surface3),
                boxShadow: i == current
                    ? [BoxShadow(color: k.ember.withValues(alpha: 0.5), offset: const Offset(0, 8), blurRadius: 20, spreadRadius: -8)]
                    : null,
              ),
              child: i < current
                  ? Icon(LucideIcons.check, size: 14, color: k.up)
                  : Text(
                      '${i + 1}',
                      style: context.text.caption.copyWith(color: i == current ? k.onEmber : k.fg3, fontWeight: FontWeight.w700, fontFeatures: kTabular),
                    ),
            ),
            if (i < steps.length - 1)
              Expanded(
                child: Container(
                  height: 2,
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  decoration: BoxDecoration(color: i < current ? k.up.withValues(alpha: 0.4) : k.surface3, borderRadius: BorderRadius.circular(1)),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class KycWizard extends ConsumerStatefulWidget {
  const KycWizard({super.key, required this.state, required this.setState, required this.onSubmitted, this.initialStep});
  final KycState state;
  final ValueChanged<KycState> setState;
  final ValueChanged<KycState> onSubmitted;

  /// Opens at this step (default: the first unfinished one).
  final int? initialStep;

  @override
  ConsumerState<KycWizard> createState() => _KycWizardState();
}

class _KycWizardState extends ConsumerState<KycWizard> {
  late int _step = widget.initialStep ?? firstIncomplete(widget.state);
  bool _consent = false;
  bool _checking = false;
  KycState? _result;
  late List<KycCheckStep> _checkSteps;

  KycState get s => widget.state;

  ValueChanged<KycState> _saved(int? next) => (st) {
    widget.setState(st);
    if (next != null) setState(() => _step = next);
  };

  Future<void> _submit() async {
    final t = context.t;
    setState(() {
      _checkSteps = submissionChecks(s, t);
      _checking = true;
      _result = null;
    });
    try {
      final r = await kycPost(ref.read(apiProvider), 'submit', {'confirm': true});
      if (mounted) setState(() => _result = r);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _checking = false);
      _toastError(ref, localizeError(e, t));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    if (_checking) {
      return KycCheckingSequence(
        steps: _checkSteps,
        serverDone: _result != null,
        onFinish: () {
          final r = _result;
          if (r != null) widget.onSubmitted(r);
        },
      );
    }
    final corporate = s.kase!.corporate;
    final steps = corporate
        ? [t('kyc.steps.company'), t('kyc.steps.people'), t('kyc.steps.documents'), t('kyc.steps.selfie'), t('kyc.steps.review')]
        : [t('kyc.steps.yourDetails'), t('kyc.steps.identityDocument'), t('kyc.steps.proofOfAddress'), t('kyc.steps.selfie'), t('kyc.steps.review')];
    const poa = KycSlot('proof_of_address', 'single');
    final Widget body = switch ((corporate, _step)) {
      (true, 0) => _CompanyStep(key: const ValueKey('c0'), state: s, onSaved: _saved(1)),
      (true, 1) => _PartiesStep(key: const ValueKey('c1'), state: s, onSaved: _saved(2), onBack: () => setState(() => _step = 0)),
      (true, 2) => _CorpDocsStep(
        key: const ValueKey('c2'),
        state: s,
        onSaved: _saved(null),
        onBack: () => setState(() => _step = 1),
        onNext: () => setState(() => _step = 3),
      ),
      (false, 0) => _DetailsStep(key: const ValueKey('i0'), state: s, onSaved: _saved(1)),
      (false, 1) => _IdStep(
        key: const ValueKey('i1'),
        state: s,
        onSaved: _saved(null),
        onBack: () => setState(() => _step = 0),
        onNext: () => setState(() => _step = 2),
      ),
      (false, 2) => Column(
        key: const ValueKey('i2'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KycStepTitle(title: t('kyc.poa.title'), text: t('kyc.poa.text')),
          if (s.kase!.address != null) ...[_AddressOnFile(address: s.kase!.address!), const SizedBox(height: 16)],
          PoaSlot(slot: poa, label: t('kyc.poa.title'), doc: docFor(s, poa), onUploaded: _saved(null)),
          KycStepNav(onBack: () => setState(() => _step = 1), onNext: () => setState(() => _step = 3), disabled: docFor(s, poa) == null),
        ],
      ),
      (_, 3) => _SelfieStep(
        key: ValueKey('${corporate ? 'c' : 'i'}3'),
        state: s,
        onSaved: _saved(null),
        onBack: () => setState(() => _step = 2),
        onNext: () => setState(() => _step = 4),
      ),
      _ => Column(
        key: const ValueKey('review'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KycStepTitle(title: t('kyc.review.title'), text: t('kyc.review.text')),
          KycReviewList(state: s),
          const SizedBox(height: 16),
          KycCheck(value: _consent, onChanged: (v) => setState(() => _consent = v), label: t('kyc.review.consent')),
          KycStepNav(
            onBack: () => setState(() => _step = 3),
            onNext: () => unawaited(_submit()),
            nextLabel: t('kyc.wizard.submitForVerification'),
            disabled: !_consent || s.required.any((r) => !r.uploaded),
          ),
        ],
      ),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycPhoneStepper(steps: steps, current: _step),
        const SizedBox(height: 24),
        AnimatedSwitcher(duration: const Duration(milliseconds: 180), child: body),
      ],
    );
  }
}

class _AddressOnFile extends StatelessWidget {
  const _AddressOnFile({required this.address});
  final KycAddress address;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final a = [
      address.line1,
      address.line2,
      address.city,
      address.postcode,
      if (address.country.isNotEmpty) countryLabel(t, address.country),
    ].where((x) => x.isNotEmpty).join(', ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.userRound, size: 16, color: k.fg3),
          const SizedBox(width: 8),
          Expanded(
            child: Text(t('kyc.poa.addressOnFile', {'address': a}), style: context.text.footnote.copyWith(color: k.fg2)),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ step: personal details */

class _DetailsStep extends ConsumerStatefulWidget {
  const _DetailsStep({super.key, required this.state, required this.onSaved});
  final KycState state;
  final ValueChanged<KycState> onSaved;

  @override
  ConsumerState<_DetailsStep> createState() => _DetailsStepState();
}

class _DetailsStepState extends ConsumerState<_DetailsStep> with _KycSave {
  late final KycState s = widget.state;
  late final _first = TextEditingController(text: s.p('first_name'));
  late final _last = TextEditingController(text: s.p('last_name'));
  late String _dob = s.p('date_of_birth');
  late final KycAddress _addr = s.kase?.address?.copy() ?? KycAddress(country: s.p('country'));
  late final _line1 = TextEditingController(text: _addr.line1);
  late final _line2 = TextEditingController(text: _addr.line2);
  late final _city = TextEditingController(text: _addr.city);
  late final _post = TextEditingController(text: _addr.postcode);

  @override
  void dispose() {
    for (final c in [_first, _last, _line1, _line2, _city, _post]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final locked = s.identityLocked;
    void sync() => setState(() {
      _addr
        ..line1 = _line1.text
        ..line2 = _line2.text
        ..city = _city.text
        ..postcode = _post.text;
    });
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycStepTitle(title: t('kyc.details.title'), text: t('kyc.details.text')),
        KTextField(
          label: t('kyc.details.firstNames'),
          controller: _first,
          enabled: !locked,
          error: fieldErr('first_name'),
          autofillHints: const [AutofillHints.givenName],
        ),
        const SizedBox(height: 14),
        KTextField(
          label: t('kyc.details.lastName'),
          controller: _last,
          enabled: !locked,
          error: fieldErr('last_name'),
          autofillHints: const [AutofillHints.familyName],
        ),
        const SizedBox(height: 14),
        PDateField(
          label: t('kyc.details.dob'),
          value: _dob,
          max: maxDob(),
          enabled: !locked,
          error: fieldErr('date_of_birth'),
          onChanged: (v) => setState(() => _dob = v),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Icon(LucideIcons.lock, size: 14, color: k.fg3),
            const SizedBox(width: 8),
            Expanded(
              child: Text(t('kyc.details.lockedNote'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text(t('kyc.details.residentialAddress'), style: context.text.label.copyWith(fontSize: 14, color: k.fg)),
        const SizedBox(height: 12),
        KTextField(
          label: t('kyc.details.street'),
          controller: _line1,
          placeholder: t('kyc.details.streetPlaceholder'),
          error: fieldErr('address.line1'),
          autofillHints: const [AutofillHints.streetAddressLine1],
          onChanged: (_) => sync(),
        ),
        const SizedBox(height: 14),
        KTextField(label: t('kyc.details.apartment'), controller: _line2, autofillHints: const [AutofillHints.streetAddressLine2], onChanged: (_) => sync()),
        const SizedBox(height: 14),
        KTextField(
          label: t('kyc.details.city'),
          controller: _city,
          error: fieldErr('address.city'),
          autofillHints: const [AutofillHints.addressCity],
          onChanged: (_) => sync(),
        ),
        const SizedBox(height: 14),
        KTextField(label: t('kyc.details.postcode'), controller: _post, autofillHints: const [AutofillHints.postalCode], onChanged: (_) => sync()),
        const SizedBox(height: 14),
        KycCountryField(
          label: t('kyc.details.countryOfResidence'),
          value: _addr.country,
          extra: s.p('country'),
          error: fieldErr('address.country'),
          onChanged: (v) => setState(() => _addr.country = v),
        ),
        KycStepNav(
          busy: busy,
          disabled: _addr.line1.trim().isEmpty || _addr.city.trim().isEmpty || _addr.country.isEmpty,
          onNext: () => unawaited(
            save({
              if (!locked) 'identity': {'first_name': _first.text, 'last_name': _last.text, 'date_of_birth': _dob},
              'address': _addr.toJson(),
            }, widget.onSaved),
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ step: identity document */

class _IdStep extends ConsumerStatefulWidget {
  const _IdStep({super.key, required this.state, required this.onSaved, required this.onBack, required this.onNext});
  final KycState state;
  final ValueChanged<KycState> onSaved;
  final VoidCallback onBack, onNext;

  @override
  ConsumerState<_IdStep> createState() => _IdStepState();
}

class _IdStepState extends ConsumerState<_IdStep> with _KycSave {
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final s = widget.state;
    final type = s.kase?.idDocType;
    const front = KycSlot('id_document', 'front');
    const back = KycSlot('id_document', 'back');
    final passport = type == 'passport';
    final done = type != null && docFor(s, front) != null && (passport || docFor(s, back) != null);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycStepTitle(title: t('kyc.id.title'), text: t('kyc.id.text')),
        Semantics(
          label: t('kyc.id.documentType'),
          child: Column(
            children: [
              for (final o in kIdTypes)
                KycRadioCard(
                  key: ValueKey('idtype-${o.$1}'),
                  icon: LucideIcons.idCard,
                  title: t(o.$2),
                  text: t(o.$3),
                  selected: type == o.$1,
                  onTap: busy || type == o.$1 ? null : () => unawaited(save({'id_doc_type': o.$1}, widget.onSaved)),
                ),
            ],
          ),
        ),
        if (type != null) ...[
          const SizedBox(height: 12),
          DocSlot(
            key: ValueKey('front-$type'),
            slot: front,
            label: passport ? t('kyc.id.passportPage') : t('kyc.id.frontSide'),
            hint: passport ? t('kyc.id.passportPageHint') : t('kyc.id.frontSideHint'),
            purpose: KycPurpose.id,
            passport: passport,
            doc: docFor(s, front),
            onUploaded: widget.onSaved,
          ),
          if (!passport) ...[
            const SizedBox(height: 12),
            DocSlot(
              key: ValueKey('back-$type'),
              slot: back,
              label: t('kyc.id.backSide'),
              hint: t('kyc.id.backSideHint'),
              purpose: KycPurpose.id,
              doc: docFor(s, back),
              onUploaded: widget.onSaved,
            ),
          ],
        ],
        KycStepNav(onBack: widget.onBack, onNext: widget.onNext, disabled: !done),
      ],
    );
  }
}

/* ------------------------------------------------------------------ step: selfie */

class _SelfieStep extends StatelessWidget {
  const _SelfieStep({super.key, required this.state, required this.onSaved, required this.onBack, required this.onNext});
  final KycState state;
  final ValueChanged<KycState> onSaved;
  final VoidCallback onBack, onNext;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    const slot = KycSlot('selfie', 'single');
    final doc = docFor(state, slot);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycStepTitle(title: t('kyc.selfie.title'), text: t('kyc.selfie.text')),
        DocSlot(
          slot: slot,
          label: t('kyc.selfie.label'),
          hint: t('kyc.selfie.hint'),
          purpose: KycPurpose.selfie,
          doc: doc,
          preferCamera: true,
          onUploaded: onSaved,
        ),
        const SizedBox(height: 16),
        for (final key in const ['kyc.selfie.tip.centre', 'kyc.selfie.tip.remove', 'kyc.selfie.tip.light', 'kyc.selfie.tip.neutral'])
          KycInfoRow(icon: LucideIcons.scanFace, text: t(key)),
        KycStepNav(onBack: onBack, onNext: onNext, disabled: doc == null),
      ],
    );
  }
}

/* ------------------------------------------------------------------ review */

class KycReviewList extends StatelessWidget {
  const KycReviewList({super.key, required this.state});
  final KycState state;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final r in state.required)
          Builder(
            builder: (context) {
              final doc = docFor(state, r.slot);
              final local = kycPreviews[r.slot.key];
              final warn = clientChecksFlagged(doc);
              final selfie = r.slot.kind == 'selfie';
              return Container(
                key: const ValueKey('review-row'),
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(k.rowRadius),
                  border: Border.all(color: k.line),
                ),
                child: Row(
                  children: [
                    if (local != null && local.mime.startsWith('image/') && !local.mime.contains('hei'))
                      ClipRRect(
                        borderRadius: BorderRadius.circular(selfie ? 20 : 8),
                        child: Image.memory(local.bytes, width: 40, height: 40, fit: BoxFit.cover, gaplessPlayback: true),
                      )
                    else
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: k.surface3,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: k.line),
                        ),
                        child: Icon(LucideIcons.fileText, size: 16, color: k.fg3),
                      ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            r.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.label.copyWith(fontSize: 13.5, color: k.fg),
                          ),
                          Text(
                            doc != null
                                ? '${doc.mime.replaceAll('image/', '').replaceAll('application/', '').toUpperCase()} · ${(doc.sizeBytes / 1024 / 1024).toStringAsFixed(2)} MB'
                                : t('kyc.review.missing'),
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (doc != null)
                      KChip(label: warn ? t('kyc.review.flagged') : t('kyc.review.passed'), tone: warn ? KChipTone.warn : KChipTone.up, small: true)
                    else
                      KChip(label: t('kyc.review.missing'), tone: KChipTone.down, small: true),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ corporate: company, people, documents */

class _CompanyStep extends ConsumerStatefulWidget {
  const _CompanyStep({super.key, required this.state, required this.onSaved});
  final KycState state;
  final ValueChanged<KycState> onSaved;

  @override
  ConsumerState<_CompanyStep> createState() => _CompanyStepState();
}

class _CompanyStepState extends ConsumerState<_CompanyStep> with _KycSave {
  late final KycCompany c =
      widget.state.kase?.company ??
      KycCompany(
        country: widget.state.p('country'),
        address: KycAddress(country: widget.state.p('country')),
      );
  late final _name = TextEditingController(text: c.name);
  late final _reg = TextEditingController(text: c.regNumber);
  late final _business = TextEditingController(text: c.business);
  late final _line1 = TextEditingController(text: c.address.line1);
  late final _city = TextEditingController(text: c.address.city);
  late final _post = TextEditingController(text: c.address.postcode);

  @override
  void dispose() {
    for (final x in [_name, _reg, _business, _line1, _city, _post]) {
      x.dispose();
    }
    super.dispose();
  }

  void _sync() => setState(() {
    c
      ..name = _name.text
      ..regNumber = _reg.text
      ..business = _business.text;
    c.address
      ..line1 = _line1.text
      ..city = _city.text
      ..postcode = _post.text;
  });

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycStepTitle(title: t('kyc.company.title'), text: t('kyc.company.text')),
        KTextField(label: t('kyc.company.name'), controller: _name, error: fieldErr('company.name'), onChanged: (_) => _sync()),
        const SizedBox(height: 14),
        KTextField(label: t('kyc.company.regNumber'), controller: _reg, error: fieldErr('company.reg_number'), onChanged: (_) => _sync()),
        const SizedBox(height: 14),
        PDateField(
          label: t('kyc.company.incorporatedOn'),
          value: c.incorporatedOn,
          max: DateTime.now(),
          error: fieldErr('company.incorporated_on'),
          onChanged: (v) => setState(() => c.incorporatedOn = v),
        ),
        const SizedBox(height: 14),
        KycCountryField(label: t('kyc.company.country'), value: c.country, error: fieldErr('company.country'), onChanged: (v) => setState(() => c.country = v)),
        const SizedBox(height: 14),
        KTextField(label: t('kyc.company.business'), controller: _business, onChanged: (_) => _sync()),
        const SizedBox(height: 24),
        Text(t('kyc.company.registeredAddress'), style: context.text.label.copyWith(fontSize: 14, color: k.fg)),
        const SizedBox(height: 12),
        KTextField(label: t('kyc.details.street'), controller: _line1, error: fieldErr('company.address.line1'), onChanged: (_) => _sync()),
        const SizedBox(height: 14),
        KTextField(label: t('kyc.details.city'), controller: _city, error: fieldErr('company.address.city'), onChanged: (_) => _sync()),
        const SizedBox(height: 14),
        KTextField(label: t('kyc.details.postcode'), controller: _post, onChanged: (_) => _sync()),
        const SizedBox(height: 14),
        KycCountryField(label: t('kyc.company.addressCountry'), value: c.address.country, onChanged: (v) => setState(() => c.address.country = v)),
        KycStepNav(
          busy: busy,
          disabled: c.name.trim().isEmpty || c.regNumber.trim().isEmpty || c.incorporatedOn.isEmpty || c.address.line1.trim().isEmpty,
          onNext: () => unawaited(save({'company': c.toJson()}, widget.onSaved)),
        ),
      ],
    );
  }
}

class _PartiesStep extends ConsumerStatefulWidget {
  const _PartiesStep({super.key, required this.state, required this.onSaved, required this.onBack});
  final KycState state;
  final ValueChanged<KycState> onSaved;
  final VoidCallback onBack;

  @override
  ConsumerState<_PartiesStep> createState() => _PartiesStepState();
}

class _PartiesStepState extends ConsumerState<_PartiesStep> with _KycSave {
  late final List<KycParty> _list = widget.state.kase?.parties.isNotEmpty == true
      ? [
          for (final p in widget.state.kase!.parties) KycParty.fromJson({...p.toJson()}),
        ]
      : [
          KycParty(
            firstName: widget.state.p('first_name'),
            lastName: widget.state.p('last_name'),
            dateOfBirth: widget.state.p('date_of_birth'),
            nationality: widget.state.p('country'),
          ),
        ];

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycStepTitle(title: t('kyc.parties.title'), text: t('kyc.parties.text')),
        for (var i = 0; i < _list.length; i++)
          _PartyCard(
            key: ObjectKey(_list[i]),
            index: i,
            party: _list[i],
            canRemove: _list.length > 1,
            onRemove: () => setState(() => _list.removeAt(i)),
            onChanged: () => setState(() {}),
          ),
        if (err?.field == 'parties')
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(err!.message, style: context.text.footnote.copyWith(color: k.down)),
          ),
        if (_list.length < 10) ...[
          const SizedBox(height: 4),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KButton(
              label: t('kyc.parties.addPerson'),
              icon: LucideIcons.plus,
              size: KButtonSize.sm,
              variant: KButtonVariant.surface,
              onPressed: () => setState(() => _list.add(KycParty())),
            ),
          ),
        ],
        KycStepNav(
          onBack: widget.onBack,
          busy: busy,
          onNext: () => unawaited(
            save({
              'parties': [for (final p in _list) p.toJson()],
            }, widget.onSaved),
          ),
        ),
      ],
    );
  }
}

class _PartyCard extends StatefulWidget {
  const _PartyCard({super.key, required this.index, required this.party, required this.canRemove, required this.onRemove, required this.onChanged});
  final int index;
  final KycParty party;
  final bool canRemove;
  final VoidCallback onRemove, onChanged;

  @override
  State<_PartyCard> createState() => _PartyCardState();
}

class _PartyCardState extends State<_PartyCard> {
  late final _first = TextEditingController(text: widget.party.firstName);
  late final _last = TextEditingController(text: widget.party.lastName);
  late final _own = TextEditingController(text: widget.party.ownership == null ? '' : _num(widget.party.ownership!));

  static String _num(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _own.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = widget.party;
    final n = widget.index + 1;
    void changed(VoidCallback f) {
      f();
      widget.onChanged();
    }

    return Container(
      key: ValueKey('party-${widget.index}'),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(t('kyc.parties.person', {'n': n}), style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
              ),
              if (widget.canRemove)
                KButton(label: t('common.remove'), icon: LucideIcons.trash2, size: KButtonSize.sm, variant: KButtonVariant.ghost, onPressed: widget.onRemove),
            ],
          ),
          const SizedBox(height: 10),
          KTextField(label: t('kyc.details.firstName'), controller: _first, onChanged: (v) => changed(() => p.firstName = v)),
          const SizedBox(height: 12),
          KTextField(label: t('kyc.details.lastName'), controller: _last, onChanged: (v) => changed(() => p.lastName = v)),
          const SizedBox(height: 12),
          PDateField(label: t('kyc.details.dob'), value: p.dateOfBirth, max: maxDob(), onChanged: (v) => changed(() => p.dateOfBirth = v)),
          const SizedBox(height: 12),
          KycCountryField(label: t('kyc.parties.nationality'), value: p.nationality, onChanged: (v) => changed(() => p.nationality = v)),
          const SizedBox(height: 12),
          KPickerField(
            label: t('kyc.parties.idDocument'),
            value: t(kIdTypes.firstWhere((o) => o.$1 == p.idType, orElse: () => kIdTypes.first).$2),
            onTap: () async {
              final v = await showKPicker<String>(
                context,
                title: t('kyc.parties.idDocument'),
                selected: p.idType,
                options: [for (final o in kIdTypes) KPickOption(o.$1, t(o.$2))],
              );
              if (v != null) changed(() => p.idType = v);
            },
          ),
          const SizedBox(height: 12),
          KTextField(
            label: t('kyc.parties.ownership'),
            controller: _own,
            ltr: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
            onChanged: (v) => changed(() => p.ownership = v.isEmpty ? null : double.tryParse(v)),
          ),
          const SizedBox(height: 8),
          for (final r in const ['director', 'ubo'])
            KycCheck(
              value: p.roles.contains(r),
              label: r == 'director' ? t('kyc.parties.director') : t('kyc.parties.uboCheckbox'),
              onChanged: (_) => changed(() => p.roles.contains(r) ? p.roles.remove(r) : p.roles.add(r)),
            ),
        ],
      ),
    );
  }
}

class _CorpDocsStep extends StatelessWidget {
  const _CorpDocsStep({super.key, required this.state, required this.onSaved, required this.onBack, required this.onNext});
  final KycState state;
  final ValueChanged<KycState> onSaved;
  final VoidCallback onBack, onNext;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    const inc = KycSlot('incorporation', 'single');
    const addr = KycSlot('company_address', 'single');
    final ready = state.required.where((r) => r.slot.kind != 'selfie').every((r) => r.uploaded);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycStepTitle(title: t('kyc.corpDocs.title'), text: t('kyc.corpDocs.text')),
        DocSlot(
          slot: inc,
          label: t('kyc.corpDocs.incorporation'),
          hint: t('kyc.corpDocs.incorporationHint'),
          purpose: KycPurpose.doc,
          doc: docFor(state, inc),
          onUploaded: onSaved,
        ),
        const SizedBox(height: 12),
        PoaSlot(slot: addr, label: t('kyc.corpDocs.companyPoa'), doc: docFor(state, addr), onUploaded: onSaved, company: true),
        for (final p in state.kase?.parties ?? const <KycParty>[]) ...[
          const SizedBox(height: 20),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '${p.firstName} ${p.lastName} '),
                TextSpan(
                  text: '· ${p.roles.map((r) => r == 'ubo' ? t('kyc.parties.ubo') : t('kyc.parties.director')).join(', ')}',
                  style: TextStyle(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
            style: context.text.label.copyWith(fontSize: 13.5, color: k.fg),
          ),
          const SizedBox(height: 8),
          DocSlot(
            slot: KycSlot('party_id', 'front', p.key),
            label: p.idType == 'passport' ? t('kyc.id.passportPage') : t('kyc.corpDocs.idFront'),
            hint: t(kIdTypes.firstWhere((o) => o.$1 == p.idType, orElse: () => kIdTypes.first).$2),
            purpose: KycPurpose.id,
            passport: p.idType == 'passport',
            doc: docFor(state, KycSlot('party_id', 'front', p.key)),
            onUploaded: onSaved,
          ),
          if (p.idType != 'passport') ...[
            const SizedBox(height: 12),
            DocSlot(
              slot: KycSlot('party_id', 'back', p.key),
              label: t('kyc.corpDocs.idBack'),
              hint: t(kIdTypes.firstWhere((o) => o.$1 == p.idType, orElse: () => kIdTypes.first).$2),
              purpose: KycPurpose.id,
              doc: docFor(state, KycSlot('party_id', 'back', p.key)),
              onUploaded: onSaved,
            ),
          ],
        ],
        KycStepNav(onBack: onBack, onNext: onNext, disabled: !ready),
      ],
    );
  }
}

/* ------------------------------------------------------------------ more information requested */

class KycMoreInfo extends ConsumerStatefulWidget {
  const KycMoreInfo({super.key, required this.state, required this.setState, required this.onSubmitted});
  final KycState state;
  final ValueChanged<KycState> setState;
  final ValueChanged<KycState> onSubmitted;

  @override
  ConsumerState<KycMoreInfo> createState() => _KycMoreInfoState();
}

class _KycMoreInfoState extends ConsumerState<KycMoreInfo> {
  bool _checking = false;
  bool _consent = false;
  KycState? _result;
  List<KycCheckStep> _steps = const [];

  Future<void> _submit() async {
    final t = context.t;
    setState(() {
      _steps = submissionChecks(widget.state, t).where((s) => const ['received', 'quality', 'resolution', 'poa', 'face', 'send'].contains(s.key)).toList();
      _checking = true;
    });
    try {
      final r = await kycPost(ref.read(apiProvider), 'submit', {'confirm': true});
      if (mounted) setState(() => _result = r);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _checking = false);
      _toastError(ref, localizeError(e, t));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    if (_checking) {
      return KycCheckingSequence(
        steps: _steps,
        serverDone: _result != null,
        onFinish: () {
          final r = _result;
          if (r != null) widget.onSubmitted(r);
        },
      );
    }
    final s = widget.state;
    final c = s.kase!;
    final requested = s.required.where((r) => r.requested).toList();
    final ready = requested.every((r) => r.uploaded);
    final rtl = _rtl(context);
    return Column(
      key: const ValueKey('kyc-more-info'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: k.warnSoft,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: k.warn.withValues(alpha: 0.4)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(LucideIcons.triangleAlert, size: 20, color: k.warn),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(t('kyc.moreInfo.title'), style: context.text.headline.copyWith(fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    Text(t('kyc.moreInfo.text'), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13)),
                    if (c.requestMessage != null) ...[const SizedBox(height: 12), KycTeamNote(message: c.requestMessage!, background: k.surface)],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        for (final r in requested) ...[_requestedSlot(context, s, c, r), const SizedBox(height: 16)],
        KycCheck(value: _consent, onChanged: (v) => setState(() => _consent = v), label: t('kyc.review.consent')),
        const SizedBox(height: 16),
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: KButton(
            key: const ValueKey('resubmit'),
            label: t('kyc.moreInfo.send'),
            trailingIcon: rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight,
            onPressed: ready && _consent ? () => unawaited(_submit()) : null,
          ),
        ),
      ],
    );
  }

  Widget _requestedSlot(BuildContext context, KycState s, KycCase c, KycRequirement r) {
    final t = context.t;
    final doc = docFor(s, r.slot);
    if (r.slot.kind == 'proof_of_address' || r.slot.kind == 'company_address') {
      return PoaSlot(
        key: ValueKey(r.label),
        slot: r.slot,
        label: r.label,
        doc: doc,
        requested: true,
        onUploaded: widget.setState,
        company: r.slot.kind == 'company_address',
      );
    }
    final party = c.parties.where((p) => p.key == r.slot.party).firstOrNull;
    final passport = r.slot.kind == 'id_document' ? c.idDocType == 'passport' : (r.slot.kind == 'party_id' ? party?.idType == 'passport' : false);
    final purpose = r.slot.kind == 'selfie' ? KycPurpose.selfie : (r.slot.kind == 'incorporation' ? KycPurpose.doc : KycPurpose.id);
    return DocSlot(
      key: ValueKey(r.label),
      slot: r.slot,
      label: r.label,
      hint: r.slot.kind == 'selfie' ? t('kyc.selfie.hint') : t('kyc.moreInfo.docHint'),
      purpose: purpose,
      passport: passport,
      doc: doc,
      requested: true,
      preferCamera: r.slot.kind == 'selfie',
      onUploaded: widget.setState,
    );
  }
}
