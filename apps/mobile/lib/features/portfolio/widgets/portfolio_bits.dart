// Small pieces shared by the Portfolio pages (ports of apps/crm/components/trading/ui.tsx KindBadge,
// accounts-page.tsx AccountsError, instrument.tsx TradeSymbolAvatar / OptionTag, portfolio.tsx NoAccounts) plus the
// day / month pickers that stand in for the web's <input type="date|month">.
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/account.dart';
import '../../../core/models/trading.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../../markets/instruments.dart';

/// LIVE / DEMO / PROP (web KindBadge).
class KindBadge extends StatelessWidget {
  const KindBadge({super.key, required this.account});
  final EngineAccount account;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    if (account.prop) return KChip(label: t('accounts.badge.prop'), small: true);
    return account.live
        ? KChip(label: t('accounts.badge.live'), tone: KChipTone.ember, small: true)
        : KChip(label: t('accounts.badge.demo'), tone: KChipTone.gold, small: true);
  }
}

/// The small "Option" tag next to a trade's name (web OptionTag).
class OptionTag extends StatelessWidget {
  const OptionTag({super.key});

  @override
  Widget build(BuildContext context) => KChip(label: context.t('accounts.opt.tag').toUpperCase(), tone: KChipTone.gold, small: true);
}

/// BUY / SELL chip of a deal or position.
class SideChip extends StatelessWidget {
  const SideChip({super.key, required this.buy, required this.label});
  final bool buy;
  final String label;

  @override
  Widget build(BuildContext context) => KChip(label: label, tone: buy ? KChipTone.up : KChipTone.down, small: true);
}

const Map<String, String> _ccyFlag = {
  'EUR': 'eu',
  'GBP': 'gb',
  'USD': 'us',
  'JPY': 'jp',
  'AUD': 'au',
  'CAD': 'ca',
  'CHF': 'ch',
  'NZD': 'nz',
  'INR': 'in',
  'SGD': 'sg',
  'HKD': 'hk',
  'ZAR': 'za',
  'MXN': 'mx',
  'NOK': 'no',
  'SEK': 'se',
  'DKK': 'dk',
  'PLN': 'pl',
  'TRY': 'tr',
  'CNH': 'cn',
  'CNY': 'cn',
  'HUF': 'hu',
  'CZK': 'cz',
};

/// Avatar for any engine symbol (web TradeSymbolAvatar): the instrument's avatar when the list knows it, two flags
/// for other currency pairs, initials otherwise; an option shows its underlying with a small C / P mark.
class TradeSymbolAvatar extends StatelessWidget {
  const TradeSymbolAvatar({super.key, required this.symbol, this.size = 28});
  final String symbol;
  final double size;

  Widget _base(BuildContext context, String s) {
    final k = context.k;
    if (kInstrumentMap.containsKey(s)) return SymbolAvatar(s, size: size);
    final base = s.length == 6 ? _ccyFlag[s.substring(0, 3)] : null;
    final quote = s.length == 6 ? _ccyFlag[s.substring(3)] : null;
    if (base != null && quote != null) {
      Widget ring(Widget c) => Container(
        padding: const EdgeInsets.all(1.5),
        decoration: BoxDecoration(color: k.surface, shape: BoxShape.circle),
        child: c,
      );
      return SizedBox(
        width: size * 1.45,
        height: size,
        child: Stack(
          textDirection: TextDirection.ltr,
          children: [
            Positioned(left: 0, top: 0, child: ring(KFlag(base, size: size - 3))),
            Positioned(right: 0, top: 0, child: ring(KFlag(quote, size: size - 3))),
          ],
        ),
      );
    }
    final initials = s.replaceAll(RegExp('[^A-Za-z0-9]'), '');
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: k.surface3,
        shape: BoxShape.circle,
        border: Border.all(color: k.line),
      ),
      child: Text(
        initials.isEmpty ? '?' : initials.substring(0, initials.length < 2 ? initials.length : 2).toUpperCase(),
        style: context.text.micro.copyWith(fontSize: size * 0.36 < 8 ? 8 : size * 0.36, color: k.fg2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = parseSeries(symbol);
    if (p == null) return _base(context, symbol);
    final k = context.k;
    final badge = (size * 0.5).clamp(10.0, 40.0);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        _base(context, p.underlying),
        PositionedDirectional(
          end: -3,
          bottom: -3,
          child: Container(
            width: badge,
            height: badge,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: p.right == 'call' ? k.up : k.down,
              shape: BoxShape.circle,
              border: Border.all(color: k.surface, width: 2),
            ),
            child: Text(
              p.right == 'call' ? 'C' : 'P',
              style: TextStyle(fontSize: badge * 0.5, fontWeight: FontWeight.w800, color: Colors.white, height: 1),
            ),
          ),
        ),
      ],
    );
  }
}

/// "Trading accounts are unavailable" with Try again (web AccountsError).
class AccountsError extends StatelessWidget {
  const AccountsError({super.key, required this.onRetry, this.message});
  final VoidCallback onRetry;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KCard(
      child: KEmptyState(
        compact: true,
        art: KIllustrationName.connectionLost,
        title: t('accounts.error.unavailableTitle'),
        text: message ?? t('accounts.error.unavailableText'),
        action: KButton(label: t('common.retry'), icon: LucideIcons.rotateCw, variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: onRetry),
      ),
    );
  }
}

/// "No trading accounts yet" with Open account (web NoAccounts). `text` replaces the description.
class NoAccounts extends StatelessWidget {
  const NoAccounts({super.key, this.text, this.readOnly = false, this.icon = true});
  final String? text;
  final bool readOnly;
  final bool icon;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KCard(
      child: KEmptyState(
        art: KIllustrationName.welcome,
        title: t('portfolio.noAccounts.title'),
        text: text ?? t('portfolio.noAccounts.text'),
        action: readOnly
            ? null
            : KButton(label: t('portfolio.openAccount'), icon: icon ? LucideIcons.plus : null, onPressed: () => context.go('/accounts/new')),
      ),
    );
  }
}

/// The page header's buttons, under the title on phones (web PageHeader actions).
class PageActions extends StatelessWidget {
  const PageActions({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 14),
    child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: children),
  );
}

/// The web's chart palette (CHART_COLORS) from the theme's tokens.
List<Color> chartColors(KTokens k) => [k.ember, k.gold, k.up, k.info, k.down, k.fg3, k.tile(KTone.mint).$2, k.ember2];

/// Colour of an up / down / zero figure.
Color signColor(KTokens k, num v, {Color? zero}) => v > 0 ? k.up : (v < 0 ? k.down : (zero ?? k.fg3));

/// Opens Kalks Trader on the account (web TradeButton with its own label).
class TraderButton extends StatelessWidget {
  const TraderButton({super.key, required this.account, this.label = 'Trader'});
  final EngineAccount account;
  final String label;

  @override
  Widget build(BuildContext context) => KButton(
    label: label,
    icon: LucideIcons.candlestickChart,
    size: KButtonSize.sm,
    onPressed: account.tradeBlocked ? null : () => context.push('/trader?login=${account.login}'),
  );
}

/* ------------------------------------------------------------------ day / month pickers */

/// A compact date input (web <Input type="date|month">): shows the value, opens an iOS wheel in a sheet.
class DateInput extends StatelessWidget {
  const DateInput({super.key, required this.value, required this.onTap, this.label, this.height = KSize.field, this.semanticLabel, this.mono = true});
  final String value;
  final VoidCallback onTap;
  final String? label;
  final double height;
  final String? semanticLabel;

  /// Figures in Geist Mono (YYYY-MM-DD); off for a written month ("September 2026").
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final box = KPressable(
      onTap: onTap,
      pressedScale: 1,
      semanticLabel: semanticLabel ?? label,
      child: Container(
        height: height,
        padding: const EdgeInsetsDirectional.only(start: 12, end: 10),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(height >= 40 ? 14 : 12),
          border: Border.all(color: k.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                value.isEmpty ? '—' : value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textDirection: mono ? TextDirection.ltr : null,
                textAlign: Directionality.of(context) == TextDirection.rtl ? TextAlign.right : TextAlign.left,
                style: mono
                    ? context.text.mono(height >= 40 ? 14 : 12.5, color: value.isEmpty ? k.fg3 : k.fg)
                    : context.text.body.copyWith(fontSize: 14.5, color: value.isEmpty ? k.fg3 : k.fg),
              ),
            ),
            Icon(LucideIcons.calendar, size: 15, color: k.fg3),
          ],
        ),
      ),
    );
    if (label == null) return box;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(label!, style: context.text.label.copyWith(color: k.fg2)),
        ),
        box,
      ],
    );
  }
}

DateTime? _parseDay(String s) {
  final p = s.split('-');
  if (p.length < 2) return null;
  final y = int.tryParse(p[0]), m = int.tryParse(p[1]), d = p.length > 2 ? int.tryParse(p[2]) : 1;
  if (y == null || m == null || d == null) return null;
  return DateTime(y, m, d);
}

/// Picks a day (YYYY-MM-DD) or, with `month`, a month (YYYY-MM) on an iOS wheel; null when closed.
Future<String?> pickDay(BuildContext context, {required String title, required String value, String? min, String? max, bool month = false}) async {
  final lo = min == null ? DateTime(2000) : _parseDay(min) ?? DateTime(2000);
  final hi = max == null ? DateTime.now() : _parseDay(max) ?? DateTime.now();
  var picked = _parseDay(value) ?? hi;
  if (picked.isAfter(hi)) picked = hi;
  if (picked.isBefore(lo)) picked = lo;
  String fmt(DateTime d) => month ? isoDay(d).substring(0, 7) : isoDay(d);
  final k = context.k;
  return showKSheet<String>(
    context,
    title: title,
    builder: (ctx) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 216,
          child: CupertinoTheme(
            data: CupertinoThemeData(
              brightness: k.brightness,
              textTheme: CupertinoTextThemeData(dateTimePickerTextStyle: ctx.text.body.copyWith(fontSize: 20)),
            ),
            child: CupertinoDatePicker(
              mode: month ? CupertinoDatePickerMode.monthYear : CupertinoDatePickerMode.date,
              initialDateTime: picked,
              minimumDate: lo,
              maximumDate: DateTime(hi.year, hi.month, hi.day, 23, 59),
              onDateTimeChanged: (d) => picked = d,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: KButton(label: ctx.t('common.done'), size: KButtonSize.lg, expand: true, onPressed: () => Navigator.of(ctx).pop(fmt(picked))),
        ),
      ],
    ),
  );
}
