// Small building blocks shared by the Profile & Security pages (web components/profile, components/security):
//   PCardHeader     the web CardHeader with its flex-wrap: the action stays next to the title when it fits, else
//                   it moves under it (phones)
//   PRow            the label / value row of the live profile (`Row` in live-profile.tsx)
//   PLinkCard       the "card as a link" rows (Identity verification, Notifications)
//   PBackLink       "← Profile" above a sub-page's header
//   PToneAvatar     the web Avatar: initials on a pastel tile picked from the name
//   PPager          the DataTable pager (prev / page of pages / next)
//   PPasswordField  the web PasswordInput (eye toggle)
//   pickDay         a date (the web's <input type=date>) in an iOS wheel sheet
//   apiPut          PUT on the mobile API (the web's fetch PUT; ApiClient has no put)
import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/format/format.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../../auth/auth_widgets.dart' show kCountries;

/// PUT on the mobile API with the same error mapping as ApiClient (the web's `fetch(…, {method: "PUT"})` for
/// notifications/prefs and auth/marketing). A dead session and maintenance are reported like every other call.
Future<R> apiPut<R>(ApiClient api, String path, Map<String, Object?> body) async {
  Response<Object?> r;
  try {
    r = await api.dio.request<Object?>(
      path,
      data: body,
      options: Options(method: 'PUT', contentType: Headers.jsonContentType),
    );
  } on DioException catch (e) {
    if (e.type == DioExceptionType.cancel) rethrow;
    throw ApiException.network;
  }
  final status = r.statusCode ?? 0;
  if (status >= 400 || status == 0) {
    final e = ApiException.fromResponse(status, r.data, retryAfterHeader: r.headers.value('retry-after'));
    if (e.isUnauthorized) api.onSessionDead?.call(e);
    if (e.isMaintenance) api.onMaintenance?.call(e);
    throw e;
  }
  return (r.data ?? const <String, Object?>{}) as R;
}

/* ------------------------------------------------------------------ dates (the reader's local time, like the web) */

DateTime? parseIso(Object? v) => v is String && v.isNotEmpty ? DateTime.tryParse(v)?.toLocal() : null;

final Map<String, DateFormat> _fmt = {};
DateFormat _f(String key, String locale, DateFormat Function(String tag) make) => _fmt.putIfAbsent('$locale|$key', () => make(intlLocale(locale)));

/// "24 Sep, 21:40" (web `when`), "24 Sep 2026, 21:40" with the year.
String fmtWhen(String locale, DateTime? d, {bool withYear = false}) {
  if (d == null) return '—';
  final f = withYear ? _f('wy', locale, (tag) => DateFormat.yMMMd(tag).add_Hm()) : _f('w', locale, (tag) => DateFormat.MMMd(tag).add_Hm());
  return latinDigits(f.format(d.toLocal()));
}

/// "24 Sep 2026" (web `day` / `fmtDate`).
String fmtDay(String locale, DateTime? d) => d == null ? '—' : latinDigits(_f('d', locale, DateFormat.yMMMd).format(d.toLocal()));

/// "Sep 2026" (web `{month: "short", year: "numeric"}`).
String fmtMonthYear(String locale, DateTime? d) => d == null ? '—' : latinDigits(_f('my', locale, DateFormat.yMMM).format(d.toLocal()));

/// yyyy-mm-dd of a local date (the web's date inputs).
String isoDate(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// A yyyy-mm-dd string as a local date (null when empty or invalid).
DateTime? fromIsoDate(String v) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(v);
  if (m == null) return null;
  return DateTime(int.parse(m.group(1)!), int.parse(m.group(2)!), int.parse(m.group(3)!));
}

/// The country's name: the web uses Intl.DisplayNames; the app has the catalog's country names (news.country.*)
/// and the sign-up list, else the code.
String countryLabel(T t, String? code) {
  if (code == null || code.isEmpty) return '—';
  final c = code.toLowerCase();
  if (t.has('news.country.$c')) return t('news.country.$c');
  for (final x in kCountries) {
    if (x.$1 == c) return x.$2;
  }
  return c.toUpperCase();
}

/* ------------------------------------------------------------------ layout */

/// The web CardHeader (pastel icon tile, title, 2-line subtitle) with flex-wrap: the action sits at the end when
/// it fits on the title's line, otherwise on its own line under it.
class PCardHeader extends StatelessWidget {
  const PCardHeader({super.key, required this.title, this.subtitle, this.icon, this.action, this.subtitleWidget});
  final String title;
  final String? subtitle;
  final Widget? subtitleWidget;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final head = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[KIconTile(icon: icon!, radius: 13, iconSize: 18), const SizedBox(width: 12)],
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.title2.copyWith(fontSize: 18)),
              if (subtitleWidget != null) ...[const SizedBox(height: 2), subtitleWidget!],
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13, height: 1.3),
                ),
              ],
            ],
          ),
        ),
      ],
    );
    if (action == null) return head;
    return Wrap(alignment: WrapAlignment.spaceBetween, spacing: 16, runSpacing: 12, children: [head, action!]);
  }
}

/// A label / value line with a hairline under it (web live-profile `Row`, security facts).
class PRow extends StatelessWidget {
  const PRow({super.key, required this.label, required this.child, this.last = false, this.leading});
  final String label;
  final Widget child;
  final bool last;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        border: last ? null : Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Row(
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 10)],
          Text(label, style: context.text.callout.copyWith(color: leading == null ? k.fg3 : k.fg2)),
          const SizedBox(width: 16),
          Expanded(
            child: Align(
              alignment: AlignmentDirectional.centerEnd,
              child: DefaultTextStyle.merge(
                style: context.text.callout.copyWith(color: k.fg),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end,
                child: child,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A card that is a link (web `<Link><Card className="flex items-center gap-4 px-6 py-5">`): a round icon, title
/// (+ chip), a line of text and a chevron.
class PLinkCard extends StatelessWidget {
  const PLinkCard({super.key, required this.icon, required this.title, required this.text, required this.href, this.chip});
  final IconData icon;
  final String title;
  final String text;
  final String href;
  final Widget? chip;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return KCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
      onTap: () => context.go(href),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: k.surface3,
              shape: BoxShape.circle,
              border: Border.all(color: k.line),
            ),
            child: Icon(icon, size: 18, color: k.fg2),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(title, style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                    ?chip,
                  ],
                ),
                const SizedBox(height: 2),
                Text(text, style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Icon(rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight, size: 16, color: k.fg3),
        ],
      ),
    );
  }
}

/// "← Profile" (web `<Link href="/profile">` above the notifications page header).
class PBackLink extends StatelessWidget {
  const PBackLink({super.key, required this.label, required this.href});
  final String label;
  final String href;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: KPressable(
        onTap: () => context.go(href),
        semanticLabel: label,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft, size: 14, color: k.fg3),
              const SizedBox(width: 6),
              Text(label, style: context.text.label.copyWith(color: k.fg3)),
            ],
          ),
        ),
      ),
    );
  }
}

/// The page header with the web's phone layout: actions under the title and subtitle (flex-col on phones).
class PPageHeader extends StatelessWidget {
  const PPageHeader({super.key, required this.title, this.subtitle, this.actions = const []});
  final String title;
  final String? subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KPageHeader(title: title, subtitle: subtitle == null ? null : Text(subtitle!)),
        if (actions.isNotEmpty) ...[const SizedBox(height: 14), Wrap(spacing: 8, runSpacing: 8, children: actions)],
      ],
    ),
  );
}

const List<KTone> _avatarTones = [KTone.accent, KTone.lavender, KTone.pink, KTone.amber, KTone.mint, KTone.sky, KTone.coral];

/// The web's string hash (`(h * 31 + code) | 0`, absolute) that picks the avatar tone.
int webHash(String s) {
  var h = 0;
  for (final c in s.codeUnits) {
    h = (h * 31 + c).toSigned(32);
  }
  return h.abs();
}

/// The web Avatar: initials on a pastel tile (tone from the name), a green tick when verified.
class PToneAvatar extends StatelessWidget {
  const PToneAvatar({super.key, required this.name, this.size = 88, this.verified = false});
  final String name;
  final double size;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final initials = name.split(' ').where((p) => p.isNotEmpty).take(2).map((p) => p.characters.first.toUpperCase()).join();
    final (bg, fg) = k.tile(_avatarTones[webHash(name) % _avatarTones.length]);
    final tick = size * 0.18 < 16 ? 16.0 : size * 0.18;
    return SizedBox.square(
      dimension: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Text(
              initials,
              style: context.text.headline.copyWith(color: fg, fontWeight: FontWeight.w700, fontSize: (size * 0.34).roundToDouble().clamp(10, 60)),
            ),
          ),
          if (verified)
            PositionedDirectional(
              end: size * 0.02,
              bottom: size * 0.02,
              child: Container(
                width: tick + 4,
                height: tick + 4,
                decoration: BoxDecoration(
                  color: k.up,
                  shape: BoxShape.circle,
                  border: Border.all(color: k.surface, width: 2),
                ),
                child: Icon(LucideIcons.check, size: tick * 0.62, color: Colors.white),
              ),
            ),
        ],
      ),
    );
  }
}

/// The DataTable pager on phones: previous, "page / pages", next (shown when there is more than one page).
class PPager extends StatelessWidget {
  const PPager({super.key, required this.page, required this.pages, required this.onPage});
  final int page;
  final int pages;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    if (pages <= 1) return const SizedBox.shrink();
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          KIconButton(
            icon: rtl ? LucideIcons.chevronRight : LucideIcons.chevronLeft,
            size: 32,
            filled: true,
            semanticLabel: context.t('common.back'),
            onPressed: page == 0 ? null : () => onPage(page - 1),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              '${page + 1} / $pages',
              textDirection: TextDirection.ltr,
              style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
            ),
          ),
          KIconButton(
            icon: rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
            size: 32,
            filled: true,
            semanticLabel: context.t('common.next'),
            onPressed: page >= pages - 1 ? null : () => onPage(page + 1),
          ),
        ],
      ),
    );
  }
}

/// The web PasswordInput: a password field with the show / hide eye.
class PPasswordField extends StatefulWidget {
  const PPasswordField({super.key, required this.controller, this.label, this.placeholder, this.error, this.onChanged, this.autofillHints});
  final TextEditingController controller;
  final String? label;
  final String? placeholder;
  final String? error;
  final ValueChanged<String>? onChanged;
  final Iterable<String>? autofillHints;

  @override
  State<PPasswordField> createState() => _PPasswordFieldState();
}

class _PPasswordFieldState extends State<PPasswordField> {
  bool _show = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KTextField(
      label: widget.label,
      controller: widget.controller,
      placeholder: widget.placeholder,
      obscure: !_show,
      error: widget.error,
      ltr: true,
      onChanged: widget.onChanged,
      autofillHints: widget.autofillHints,
      trailing: KIconButton(
        icon: _show ? LucideIcons.eyeOff : LucideIcons.eye,
        size: 36,
        semanticLabel: _show ? t('accountDetail.pwInput.hide') : t('accountDetail.pwInput.show'),
        onPressed: () => setState(() => _show = !_show),
      ),
    );
  }
}

/// A date chosen on iOS wheels in a sheet (the web's date input). Returns the chosen day, or null when closed.
Future<DateTime?> pickDay(BuildContext context, {required String title, DateTime? initial, DateTime? min, DateTime? max}) {
  final now = DateTime.now();
  final lo = min ?? DateTime(1900);
  final hi = max ?? DateTime(now.year + 30, 12, 31);
  var value = initial ?? (now.isAfter(hi) ? hi : (now.isBefore(lo) ? lo : now));
  if (value.isBefore(lo)) value = lo;
  if (value.isAfter(hi)) value = hi;
  return showKSheet<DateTime>(
    context,
    title: title,
    builder: (ctx) => KSheetContent(
      footer: KButton(label: ctx.t('common.done'), size: KButtonSize.lg, expand: true, onPressed: () => Navigator.of(ctx).pop(value)),
      children: [
        SizedBox(
          height: 200,
          child: CupertinoTheme(
            data: CupertinoThemeData(
              brightness: ctx.k.dark ? Brightness.dark : Brightness.light,
              textTheme: CupertinoTextThemeData(dateTimePickerTextStyle: ctx.text.body.copyWith(fontSize: 19)),
            ),
            child: CupertinoDatePicker(
              mode: CupertinoDatePickerMode.date,
              initialDateTime: value,
              minimumDate: DateTime(lo.year, lo.month, lo.day),
              maximumDate: DateTime(hi.year, hi.month, hi.day, 23, 59),
              onDateTimeChanged: (d) => value = DateTime(d.year, d.month, d.day),
            ),
          ),
        ),
      ],
    ),
  );
}

/// A read-only field that opens [pickDay] (label above with an optional hint next to it, the date, a calendar
/// icon; optional clear): the web's `<Field><Input type="date"/></Field>`.
class PDateField extends StatelessWidget {
  const PDateField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.min,
    this.max,
    this.error,
    this.hint,
    this.clearable = false,
    this.enabled = true,
  });
  final String label;

  /// yyyy-mm-dd or empty.
  final String value;
  final ValueChanged<String> onChanged;
  final DateTime? min, max;
  final String? error;
  final Widget? hint;
  final bool clearable;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final d = fromIsoDate(value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: [
              Expanded(
                child: Text(label, style: context.text.label.copyWith(color: k.fg2)),
              ),
              if (hint != null)
                DefaultTextStyle.merge(
                  style: context.text.caption.copyWith(fontWeight: FontWeight.w500),
                  child: hint!,
                ),
            ],
          ),
        ),
        Opacity(
          opacity: enabled ? 1 : 0.55,
          child: KPickerField(
            value: d == null ? null : fmtDay(t.locale, d),
            placeholder: 'yyyy-mm-dd',
            error: error,
            leading: Icon(LucideIcons.calendarDays, size: 17, color: k.fg3),
            onTap: !enabled
                ? null
                : () async {
                    if (clearable && d != null) {
                      final choice = await showKActionSheet<String>(
                        context,
                        actions: [
                          KAction(label: t('common.edit'), value: 'edit', icon: LucideIcons.calendarDays),
                          KAction(label: t('common.remove'), value: 'clear', icon: LucideIcons.x, destructive: true),
                        ],
                      );
                      if (choice == 'clear') return onChanged('');
                      if (choice != 'edit' || !context.mounted) return;
                    }
                    final picked = await pickDay(context, title: label, initial: d, min: min, max: max);
                    if (picked != null) onChanged(isoDate(picked));
                  },
          ),
        ),
      ],
    );
  }
}
