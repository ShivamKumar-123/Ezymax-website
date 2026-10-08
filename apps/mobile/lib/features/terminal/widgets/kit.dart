// Small building blocks of Kalks Trader (web: packages/ui price.tsx / avatars.tsx, apps/terminal components/ui
// primitives.tsx + kit.tsx), in the app's design system: symbol avatars, MT5-style prices, live quotes, P&L text,
// badges, section labels, compact steppers and the order form's number fields.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format/format.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/trade_math.dart';

/* ---------------- symbol avatar ---------------- */

const Map<String, String> _ccyCountry = {
  'EUR': 'eu',
  'USD': 'us',
  'GBP': 'gb',
  'JPY': 'jp',
  'AUD': 'au',
  'CAD': 'ca',
  'CHF': 'ch',
  'NZD': 'nz',
  'INR': 'in',
  'SGD': 'sg',
  'ZAR': 'za',
  'HKD': 'hk',
  'CNH': 'cn',
  'CNY': 'cn',
  'MXN': 'mx',
  'NOK': 'no',
  'SEK': 'se',
  'DKK': 'dk',
  'PLN': 'pl',
  'TRY': 'tr',
  'HUF': 'hu',
  'CZK': 'cz',
  'THB': 'th',
  'AED': 'ae',
  'SAR': 'sa',
  'KRW': 'kr',
  'BRL': 'br',
  'ILS': 'il',
  'RUB': 'ru',
};

const Map<String, String> _indexCountry = {
  'US30': 'us',
  'NAS100': 'us',
  'SPX500': 'us',
  'US2000': 'us',
  'GER40': 'de',
  'DE40': 'de',
  'UK100': 'gb',
  'JP225': 'jp',
  'FRA40': 'fr',
  'AUS200': 'au',
  'HK50': 'hk',
  'EU50': 'eu',
  'ESP35': 'es',
  'ITA40': 'it',
  'CHN50': 'cn',
  'IND50': 'in',
};

const Set<String> _coins = {'ada', 'avax', 'bnb', 'btc', 'doge', 'dot', 'eth', 'link', 'ltc', 'matic', 'sol', 'trx', 'usdt', 'xrp'};
const Map<String, (String, Color)> _stocks = {
  'AAPL': ('apple', Color(0xFF1D1D1F)),
  'TSLA': ('tesla', Color(0xFFCC0000)),
  'NVDA': ('nvidia', Color(0xFF76B900)),
  'META': ('meta', Color(0xFF0866FF)),
  'NFLX': ('netflix', Color(0xFFE50914)),
  'GOOGL': ('google', Color(0xFF1F1F1F)),
  'GOOG': ('google', Color(0xFF1F1F1F)),
};

/// The market's avatar (web SymbolAvatar): two flags for a currency pair, the coin, the company logo, the country of
/// an index, a gold / silver disc, an energy code; a letter disc otherwise.
class SymbolAvatar extends ConsumerWidget {
  const SymbolAvatar(this.symbol, {super.key, this.size = 22});
  final String symbol;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final spec = ref.watch(symbolBookProvider.select((b) => b[symbol]));
    final cls = spec?.assetClass ?? _guessClass(symbol);
    final k = context.k;
    Widget disc(Widget child, {Gradient? gradient, Color? color}) => Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: gradient,
        color: color,
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: child,
    );
    Widget letter() => disc(
      Text(
        symbol.isEmpty ? '?' : symbol[0],
        style: TextStyle(fontFamily: KFonts.sans, fontSize: size * 0.46, fontWeight: FontWeight.w700, color: k.fg2, height: 1),
      ),
      color: k.surface3,
    );
    switch (cls) {
      case 'forex':
        final base = _ccyCountry[spec?.baseCurrency ?? (symbol.length >= 6 ? symbol.substring(0, 3) : '')];
        final quote = _ccyCountry[spec?.profitCurrency ?? (symbol.length >= 6 ? symbol.substring(3, 6) : '')];
        if (base == null || quote == null) return letter();
        return SizedBox(
          width: size * 1.45,
          height: size,
          child: Stack(
            children: [
              Positioned(right: 0, child: KFlag(quote, size: size)),
              Positioned(left: 0, child: KFlag(base, size: size)),
            ],
          ),
        );
      case 'metals':
        final silver = symbol.startsWith('XAG') || symbol.startsWith('XPT') || symbol.startsWith('XPD');
        return disc(
          Text(
            symbol.startsWith('XAU') ? 'Au' : (symbol.startsWith('XAG') ? 'Ag' : symbol.substring(1, 3)),
            style: TextStyle(fontFamily: KFonts.sans, fontSize: size * 0.4, fontWeight: FontWeight.w700, color: Colors.black.withValues(alpha: 0.7), height: 1),
          ),
          gradient: RadialGradient(
            center: const Alignment(-0.4, -0.5),
            colors: silver ? const [Color(0xFFFFFFFF), Color(0xFFC7CCD4), Color(0xFF7A818C)] : const [Color(0xFFFFF3C4), Color(0xFFE9B949), Color(0xFF9C6F14)],
            stops: const [0, 0.45, 1],
          ),
        );
      case 'energies':
        final code = symbol.contains('US') && symbol.contains('OIL')
            ? 'WTI'
            : (symbol.contains('UK') ? 'BRN' : (symbol.startsWith('NG') ? 'NG' : symbol.substring(0, 3)));
        return disc(
          Text(
            code,
            style: TextStyle(fontFamily: KFonts.sans, fontSize: size * 0.34, fontWeight: FontWeight.w700, color: k.gold, height: 1),
          ),
          gradient: const RadialGradient(center: Alignment(-0.4, -0.5), colors: [Color(0xFF3B3B44), Color(0xFF141418)]),
        );
      case 'crypto':
        final base = spec?.baseCurrency ?? '';
        final coin = (base.isNotEmpty && base.length <= 5 && base != 'USD' ? base : symbol.replaceAll(RegExp(r'USDT?$'), '')).toLowerCase();
        return _coins.contains(coin) ? KCoinIcon(coin, size: size) : letter();
      case 'stocks':
        final st = _stocks[symbol];
        if (st == null) return letter();
        return disc(
          ColorFiltered(
            colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
            child: KCoinIcon(st.$1, size: size * 0.62, stock: true),
          ),
          color: st.$2,
        );
      case 'indices':
        final c = _indexCountry[symbol];
        return c == null ? letter() : KFlag(c, size: size);
    }
    return letter();
  }

  static String _guessClass(String s) {
    if (RegExp(r'^[A-Z]{6}$').hasMatch(s) && _ccyCountry.containsKey(s.substring(0, 3)) && _ccyCountry.containsKey(s.substring(3))) return 'forex';
    if (s.startsWith('XAU') || s.startsWith('XAG')) return 'metals';
    if (_indexCountry.containsKey(s)) return 'indices';
    return '';
  }
}

/* ---------------- prices ---------------- */

/// MT5-style price (web PriceText): the head dimmed, the two pip digits larger, the pipette raised. Latin digits,
/// always left-to-right. A change flashes the pip digits green / red for a moment (web Digit). `color` paints every
/// part (prices on Buy / Sell buttons).
class PriceText extends StatefulWidget {
  const PriceText(this.value, {super.key, required this.digits, this.size = 13, this.color, this.weight = FontWeight.w500, this.dir = 0});
  final double value;
  final int digits;
  final double size;
  final Color? color;
  final FontWeight weight;

  /// Kept for callers; the flash follows the value itself.
  final int dir;

  @override
  State<PriceText> createState() => _PriceTextState();
}

class _PriceTextState extends State<PriceText> {
  int _flash = 0;
  Timer? _timer;

  @override
  void didUpdateWidget(PriceText old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value && old.value > 0 && widget.value > 0) {
      _flash = widget.value > old.value ? 1 : -1;
      _timer?.cancel();
      _timer = Timer(const Duration(milliseconds: 650), () {
        if (mounted) setState(() => _flash = 0);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final value = widget.value;
    final size = widget.size;
    final color = widget.color;
    if (!value.isFinite || value <= 0) {
      return Text(
        '—',
        style: context.text.mono(size, color: color ?? k.fg3),
        textDirection: TextDirection.ltr,
      );
    }
    final digits = widget.digits;
    final s = Fmt.number(value, digits);
    String head = s, pips = '', tail = '';
    if (digits >= 2) {
      final pipette = digits == 3 || digits == 5;
      tail = pipette ? s.substring(s.length - 1) : '';
      final body = pipette ? s.substring(0, s.length - 1) : s;
      head = body.substring(0, body.length - 2);
      pips = body.substring(body.length - 2);
    }
    final pipColor = color ?? (_flash > 0 ? k.up : (_flash < 0 ? k.down : k.fg));
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: head,
            style: context.text.mono(size, weight: widget.weight, color: color ?? k.fg2),
          ),
          if (pips.isNotEmpty)
            TextSpan(
              text: pips,
              style: context.text.mono(size * 1.12, weight: FontWeight.w600, color: pipColor),
            ),
          if (tail.isNotEmpty)
            WidgetSpan(
              alignment: PlaceholderAlignment.top,
              child: Text(
                tail,
                style: context.text.mono(size * 0.7, weight: widget.weight, color: color ?? k.fg2),
              ),
            ),
        ],
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
      softWrap: false,
    );
  }
}

/// Rebuilds with every quote of `symbol` while on screen (a listener counts as active demand on the market stream).
class QuoteBuilder extends ConsumerStatefulWidget {
  const QuoteBuilder({super.key, required this.symbol, required this.builder, this.throttle});
  final String symbol;
  final Widget Function(BuildContext context, TQuote? q) builder;

  /// At most one rebuild per this long (derived numbers that don't need every tick).
  final Duration? throttle;

  @override
  ConsumerState<QuoteBuilder> createState() => _QuoteBuilderState();
}

class _QuoteBuilderState extends ConsumerState<QuoteBuilder> {
  TQuote? _q;
  void Function()? _unsub;
  Timer? _timer;
  bool _dirty = false;

  @override
  void initState() {
    super.initState();
    _subscribe();
  }

  @override
  void didUpdateWidget(QuoteBuilder old) {
    super.didUpdateWidget(old);
    if (old.symbol != widget.symbol) {
      _unsub?.call();
      _q = null;
      _subscribe();
    }
  }

  void _subscribe() {
    final feed = ref.read(marketFeedProvider);
    _q = feed.quote(widget.symbol);
    _unsub = feed.subscribe([widget.symbol], (q) {
      _q = q;
      if (!mounted) return;
      final th = widget.throttle;
      if (th == null) {
        setState(() {});
        return;
      }
      _dirty = true;
      _timer ??= Timer(th, () {
        _timer = null;
        if (mounted && _dirty) setState(() => _dirty = false);
      });
    });
  }

  @override
  void dispose() {
    _unsub?.call();
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _q);
}

/* ---------------- money ---------------- */

/// Signed account money in green / red (web Pnl), e.g. "+12.40". `arrow` adds ▲ / ▼.
class PnlText extends StatelessWidget {
  const PnlText(this.usd, {super.key, required this.cent, this.size = 13, this.weight = FontWeight.w600, this.arrow = false, this.suffix});
  final double usd;
  final bool cent;
  final double size;
  final FontWeight weight;
  final bool arrow;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final c = usd > 0.004 ? k.up : (usd < -0.004 ? k.down : k.fg2);
    final a = !arrow ? '' : (usd > 0.004 ? '▲ ' : (usd < -0.004 ? '▼ ' : ''));
    return Text(
      '$a${accMoney(cent, usd, signed: true)}${suffix == null ? '' : ' $suffix'}',
      textDirection: TextDirection.ltr,
      maxLines: 1,
      style: context.text.mono(size, weight: weight, color: c),
    );
  }
}

/* ---------------- badges, labels ---------------- */

enum TBadgeTone { neutral, ember, gold, warn, up, down, info }

/// A small tag (web Badge): "Live", "Demo", "Read-only".
class TBadge extends StatelessWidget {
  const TBadge(this.label, {super.key, this.tone = TBadgeTone.neutral, this.minWidth});
  final String label;
  final TBadgeTone tone;
  final double? minWidth;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final (Color bg, Color fg) = switch (tone) {
      TBadgeTone.neutral => (k.surface3, k.fg2),
      TBadgeTone.ember => (k.emberSoft, k.ember),
      TBadgeTone.gold => (k.goldSoft, k.gold),
      TBadgeTone.warn => (k.warnSoft, k.warn),
      TBadgeTone.up => (k.upSoft, k.up),
      TBadgeTone.down => (k.downSoft, k.down),
      TBadgeTone.info => (k.infoSoft, k.info),
    };
    return Container(
      constraints: BoxConstraints(minWidth: minWidth ?? 0),
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: tone == TBadgeTone.neutral ? k.line : fg.withValues(alpha: 0.33)),
      ),
      child: Text(label.toUpperCase(), maxLines: 1, style: context.text.micro.copyWith(color: fg, fontSize: 10, height: 1.1, letterSpacing: 0.4)),
    );
  }
}

/// The small uppercase label above a block ("POSITIONS · 3").
class TSectionLabel extends StatelessWidget {
  const TSectionLabel(this.text, {super.key, this.trailing, this.padding = const EdgeInsets.fromLTRB(12, 14, 12, 6)});
  final String text;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Padding(
    padding: padding,
    child: Row(
      children: [
        Expanded(
          child: Text(
            text.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.text.micro.copyWith(color: context.k.fg3, letterSpacing: 0.8, fontSize: 10.5),
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

/// A rounded panel (terminal card: radius 14 on the panel colour).
class TPanel extends StatelessWidget {
  const TPanel({super.key, required this.child, this.padding = EdgeInsets.zero, this.margin = EdgeInsets.zero});
  final Widget child;
  final EdgeInsetsGeometry padding, margin;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: k.surface,
        borderRadius: BorderRadius.circular(k.cardRadius),
        border: Border.all(color: k.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

/* ---------------- number inputs ---------------- */

/// A compact − value + control (web Stepper, h-8): taps step, holding repeats, tapping the value types it.
class TStepper extends StatefulWidget {
  const TStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.step = 0.01,
    this.min = 0,
    this.max = double.infinity,
    this.decimals = 2,
    this.height = 32,
    this.placeholder,
    this.tone,
    this.semanticLabel,
  });

  /// The text value ('' = empty, e.g. no SL).
  final String value;
  final ValueChanged<String> onChanged;
  final double step, min, max;
  final int decimals;
  final double height;
  final String? placeholder;

  /// Up / down tint (SL red, TP green).
  final Color? tone;
  final String? semanticLabel;

  @override
  State<TStepper> createState() => _TStepperState();
}

class _TStepperState extends State<TStepper> {
  late final TextEditingController _c = TextEditingController(text: widget.value);
  final FocusNode _focus = FocusNode();
  bool _repeating = false;

  @override
  void didUpdateWidget(TStepper old) {
    super.didUpdateWidget(old);
    if (widget.value != _c.text && !_focus.hasFocus) _c.text = widget.value;
  }

  @override
  void dispose() {
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _bump(int dir) {
    final cur = double.tryParse(_c.text);
    final base = cur ?? (double.tryParse(widget.placeholder ?? '') ?? widget.min);
    var next = cur == null ? base : base + dir * widget.step;
    next = next.clamp(widget.min, widget.max);
    final s = next.toStringAsFixed(widget.decimals);
    if (s == _c.text) return;
    KHaptics.selection();
    _c.text = s;
    widget.onChanged(s);
  }

  Future<void> _repeat(int dir) async {
    _repeating = true;
    var wait = 280;
    while (_repeating && mounted) {
      _bump(dir);
      await Future<void>.delayed(Duration(milliseconds: wait));
      wait = (wait * 0.8).clamp(50, 280).round();
    }
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    Widget btn(IconData icon, int dir) => GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _bump(dir),
      onLongPressStart: (_) => _repeat(dir),
      onLongPressEnd: (_) => _repeating = false,
      child: SizedBox(
        width: widget.height + 2,
        height: widget.height,
        child: Icon(icon, size: 15, color: k.fg2),
      ),
    );
    return Semantics(
      label: widget.semanticLabel,
      child: Container(
        height: widget.height,
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: widget.tone?.withValues(alpha: 0.35) ?? k.line),
        ),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Row(
            children: [
              btn(LucideIcons.minus, -1),
              Expanded(
                child: TextField(
                  controller: _c,
                  focusNode: _focus,
                  textAlign: TextAlign.center,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                  style: context.text.mono(13, weight: FontWeight.w600, color: widget.tone ?? k.fg),
                  cursorColor: k.ember,
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: widget.placeholder,
                    hintStyle: context.text.mono(12, color: k.fg3),
                  ),
                  onChanged: widget.onChanged,
                ),
              ),
              btn(LucideIcons.plus, 1),
            ],
          ),
        ),
      ),
    );
  }
}

/// A label · value row of the order form (web FieldRow): the label at the start, the control at the end.
class TFieldRow extends StatelessWidget {
  const TFieldRow({super.key, required this.label, required this.child, this.help, this.tone});
  final Widget label;
  final Widget child;
  final Widget? help;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      constraints: const BoxConstraints(minHeight: 44),
      padding: const EdgeInsetsDirectional.fromSTEB(12, 4, 6, 4),
      decoration: BoxDecoration(
        color: tone == null ? k.surface2 : Color.lerp(k.surface2, tone, 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tone == null ? k.line : tone!.withValues(alpha: 0.3)),
      ),
      child: LayoutBuilder(
        builder: (context, c) => Row(
          children: [
            // the label takes what it needs (at most 60 %), the control the rest, aligned to the end
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: c.maxWidth * 0.6),
              child: DefaultTextStyle.merge(
                style: context.text.label.copyWith(color: k.fg2, fontSize: 13),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                child: label,
              ),
            ),
            if (help != null) ...[const SizedBox(width: 4), help!],
            const SizedBox(width: 8),
            // on a very narrow screen the control shrinks rather than overflowing
            Expanded(
              child: Align(
                alignment: AlignmentDirectional.centerEnd,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerEnd, child: child),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A label · value line of the summary (web SummaryRow).
class TSummaryRow extends StatelessWidget {
  const TSummaryRow({super.key, required this.label, required this.value, this.help, this.ltr = true});
  final String label;
  final Widget value;
  final Widget? help;

  /// Figures with their currency stay left-to-right in Arabic, Urdu and Persian (sentences pass false).
  final bool ltr;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Text(label, style: context.text.footnote.copyWith(color: context.k.fg3, fontSize: 12.5)),
        if (help != null) ...[const SizedBox(width: 3), help!],
        const SizedBox(width: 12),
        Expanded(
          child: Align(
            alignment: AlignmentDirectional.centerEnd,
            child: DefaultTextStyle.merge(
              textAlign: TextAlign.end,
              style: context.text.mono(12.5, color: context.k.fg),
              child: ltr ? Directionality(textDirection: TextDirection.ltr, child: value) : value,
            ),
          ),
        ),
      ],
    ),
  );
}

/// A "(?)" that opens a plain-language explanation (web HelpTip) as a small sheet.
class THelp extends StatelessWidget {
  const THelp({super.key, required this.text, this.title});
  final String text;
  final String? title;

  @override
  Widget build(BuildContext context) => KPressable(
    minSize: 28,
    semanticLabel: title ?? text,
    onTap: () => showKSheet<void>(
      context,
      title: title,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Text(text, style: ctx.text.callout.copyWith(color: ctx.k.fg2)),
      ),
    ),
    child: Icon(LucideIcons.circleQuestionMark, size: 14, color: context.k.fg3),
  );
}

/// The chips row of quick choices (web QuickStrip: 0.01 · 0.1 · 0.5 · 1 · 2).
class TQuickStrip<V> extends StatelessWidget {
  const TQuickStrip({super.key, required this.options, required this.labels, required this.selected, required this.onPick});
  final List<V> options;
  final List<String> labels;
  final V? selected;
  final ValueChanged<V> onPick;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Row(
      children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: KPressable(
              minSize: 32,
              onTap: () => onPick(options[i]),
              child: Container(
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: options[i] == selected ? k.emberSoft : k.surface2,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: options[i] == selected ? k.ember.withValues(alpha: 0.4) : k.line),
                ),
                child: Text(
                  labels[i],
                  style: context.text.mono(12, weight: FontWeight.w600, color: options[i] == selected ? k.ember : k.fg2),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// A full-width centred empty / status line of a list (web "p-6 text-center text-fg-3").
class TEmptyLine extends StatelessWidget {
  const TEmptyLine(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: context.text.footnote.copyWith(color: context.k.fg3),
    ),
  );
}

/// A compact switch for form rows (web Switch size sm): the iOS switch at 3/4 size, taking only that space.
class TSmallSwitch extends StatelessWidget {
  const TSmallSwitch({super.key, required this.value, required this.onChanged, this.semanticLabel});
  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 40,
    height: 26,
    child: FittedBox(
      child: KSwitch(value: value, onChanged: onChanged, semanticLabel: semanticLabel),
    ),
  );
}
