// Dashboard › Calendar (web components/news-live/calendar-page.tsx LiveCalendarPage, phone order):
//   1 header: Economic calendar, "Week of … · server time GMT+3"; Server / My time; previous · This week · next
//   2 Next high-impact (countdown), 3 This week (counts by impact, source), 4 High-impact alerts (switch, minutes,
//     reminders count)
//   5 the week card: day tabs (today, high-impact dots, count), impact and currency filters, the events (the "now"
//     line on today), tap -> the event's detail inline: release history, this release, the time in both zones,
//     "Remind me 15 min before" / "Remove reminder", instruments to watch (-> Ezymex Trader); the colour legend
// The web's 8-column table scrolls sideways on phones; here each event is a compact two-line row with the same
// columns (time, currency, event, impact, actual / forecast / previous).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/format/format.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import '../markets/instruments.dart';
import '../markets/markets_feed.dart';
import '../news/news_api.dart';
import '../news/widgets/news_bits.dart';

const List<String> _ccys = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
const Map<String, String> _ccyCountry = {
  'USD': 'us',
  'EUR': 'eu',
  'GBP': 'gb',
  'JPY': 'jp',
  'AUD': 'au',
  'CAD': 'ca',
  'CHF': 'ch',
  'NZD': 'nz',
  'CNY': 'cn',
  'INR': 'in',
};

/// A release figure ("2.5%", "<1.2K") as a number, null when it isn't one.
double? figure(String s) {
  final m = RegExp(r'^(-?\d+(?:\.\d+)?)\s*([KMBT%]?)$', caseSensitive: false).firstMatch(s.trim().replaceFirst(RegExp(r'^[<>~]'), '').replaceAll(',', ''));
  return m == null ? null : double.tryParse(m.group(1)!);
}

String _unitOf(String s) => RegExp(r'[KMBT%]$', caseSensitive: false).firstMatch(s.trim())?.group(0) ?? '';

String _localTime(DateTime d) {
  final l = d.toLocal();
  return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  /// ISO start of the shown week ('' = this week).
  String _weekFrom = '';
  String? _day;
  final Set<int> _impacts = {0, 1, 2, 3};
  final Set<String> _ccySel = {};
  int? _openId;
  bool _serverZone = true;
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  void _shiftWeek(CalendarWeek data, int n) => setState(() {
    _weekFrom = data.from.add(Duration(days: 7 * n)).toUtc().toIso8601String();
    _day = null;
    _openId = null;
  });

  Future<void> _toggleReminder(CalEvent e) async {
    final t = context.t;
    final toast = ref.read(notificationsProvider.notifier);
    try {
      final on = await ref.read(myCalendarProvider.notifier).toggleReminder(e);
      KHaptics.success();
      toast.toast(
        NotificationKind.success,
        on ? t('news.cal.reminder.set') : t('news.cal.reminder.removed'),
        description: on ? t('news.cal.reminder.setDesc', {'currency': e.currency, 'title': e.title}) : e.title,
      );
    } on ApiException catch (err) {
      toast.toast(NotificationKind.error, err.message.isEmpty ? t('news.cal.reminder.error') : localizeError(err, t));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cal = ref.watch(calendarWeekProvider(_weekFrom));
    final next = ref.watch(calendarNextProvider);
    final my = ref.watch(myCalendarProvider).value;
    final data = cal.value;
    final offset = data?.serverOffset ?? 3;
    final now = DateTime.now();
    final tag = intlLocale(t.locale);
    String isoDay(DateTime d) => d.toIso8601String().substring(0, 10);
    final serverToday = isoDay(now.toUtc().add(Duration(hours: offset)));

    // the week's days in server time: Monday–Friday, plus a weekend day when it has events
    final days = <String>[];
    if (data != null) {
      final start = data.from.toUtc().add(Duration(hours: offset));
      for (var i = 0; i < 7; i++) {
        final d = isoDay(start.add(Duration(days: i)));
        if (i < 5 || data.events.any((e) => e.serverDate == d)) days.add(d);
      }
    }
    final day = _day != null && days.contains(_day) ? _day : (days.contains(serverToday) ? serverToday : days.firstOrNull);
    final all = data?.events ?? const <CalEvent>[];
    final events = all.where((e) => e.serverDate == day && _impacts.contains(e.impact) && (_ccySel.isEmpty || _ccySel.contains(e.currency))).toList();
    final nowIdx = day == serverToday ? events.indexWhere((e) => e.startsAt.isAfter(now)) : -1;
    final nextHigh = next.value;
    DateTime dayDate(String d) => DateTime.parse('${d}T12:00:00Z');
    String weekday(String d) => latinDigits(DateFormat.EEEE(tag).format(dayDate(d)));
    String dayMonth(DateTime d) => latinDigits(DateFormat.MMMd(tag).format(d));
    final weekLabel = data == null
        ? ''
        : '${dayMonth(data.from.toUtc().add(Duration(hours: offset)))} – ${latinDigits(DateFormat.yMMMd(tag).format(data.to.toUtc().add(Duration(hours: offset)).subtract(const Duration(milliseconds: 1))))}';
    String rowTime(CalEvent e) => e.allDay ? t('news.cal.allDay') : (_serverZone ? e.serverTime : _localTime(e.startsAt));

    return KPageScroll(
      onRefresh: () async {
        ref
          ..invalidate(calendarWeekProvider(_weekFrom))
          ..invalidate(calendarNextProvider)
          ..invalidate(myCalendarProvider);
        await ref.read(calendarWeekProvider(_weekFrom).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        // 1. header
        KPageHeader(
          title: t('news.cal.title'),
          subtitle: Text(
            data != null
                ? t('news.cal.subtitleWeek', {
                    'week': weekLabel,
                    'zone': _serverZone ? t('news.cal.zoneServer', {'tz': gmt(offset)}) : t('news.cal.zoneLocal'),
                  })
                : t('news.cal.subtitle'),
          ),
        ),
        const SizedBox(height: 14),
        KSegmented<bool>(
          plain: true,
          values: const [true, false],
          labels: [
            t('news.cal.server', {'tz': gmt(offset)}),
            t('news.cal.myTime'),
          ],
          selected: _serverZone,
          onChanged: (v) => setState(() => _serverZone = v),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            KIconButton(
              icon: Directionality.of(context) == TextDirection.rtl ? LucideIcons.chevronRight : LucideIcons.chevronLeft,
              filled: true,
              size: 36,
              semanticLabel: t('news.cal.prevWeek'),
              onPressed: data == null ? null : () => _shiftWeek(data, -1),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: KButton(
                label: t('news.cal.thisWeek'),
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                expand: true,
                onPressed: _weekFrom.isEmpty
                    ? null
                    : () => setState(() {
                        _weekFrom = '';
                        _day = null;
                      }),
              ),
            ),
            const SizedBox(width: 6),
            KIconButton(
              icon: Directionality.of(context) == TextDirection.rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
              filled: true,
              size: 36,
              semanticLabel: t('news.cal.nextWeek'),
              onPressed: data == null ? null : () => _shiftWeek(data, 1),
            ),
          ],
        ),
        const SizedBox(height: 16),
        // 2. next high-impact
        KCard(
          hot: true,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('news.cal.nextHigh'), style: context.text.label.copyWith(color: k.fg2)),
              const SizedBox(height: 8),
              if (nextHigh != null) ...[
                Row(
                  children: [
                    KFlag(nextHigh.country),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('${nextHigh.currency} ${nextHigh.title}', style: context.text.title2.copyWith(fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Icon(LucideIcons.clock3, size: 14, color: k.ember),
                    Text(
                      '${weekday(nextHigh.serverDate)} ${_serverZone ? nextHigh.serverTime : _localTime(nextHigh.startsAt)} ·',
                      style: context.text.footnote.copyWith(color: k.fg2),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: k.surface.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: k.line),
                      ),
                      child: Text(countdownText(t, nextHigh.startsAt.difference(now)), textDirection: TextDirection.ltr, style: context.text.mono(12.5)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  t('news.cal.forecastPrevious', {
                    'forecast': nextHigh.forecast.isEmpty ? '—' : nextHigh.forecast,
                    'previous': nextHigh.previous.isEmpty ? '—' : nextHigh.previous,
                  }),
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
              ] else
                Text(next.isLoading ? t('common.loading') : t('news.cal.noHigh'), style: context.text.callout.copyWith(color: k.fg3)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // 3. this week
        KCard(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('news.cal.thisWeek'), style: context.text.label.copyWith(color: k.fg2)),
              const SizedBox(height: 6),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(data == null ? '—' : '${all.length}', style: context.text.moneyL.copyWith(fontSize: 30)),
                  const SizedBox(width: 8),
                  Text(t('news.cal.eventsWord'), style: context.text.callout.copyWith(color: k.fg3)),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  KChip(label: t('news.cal.high', {'count': all.where((e) => e.impact == 3).length}), tone: KChipTone.down, icon: LucideIcons.flame),
                  KChip(label: t('news.cal.medium', {'count': all.where((e) => e.impact == 2).length}), tone: KChipTone.warn),
                  KChip(label: t('news.cal.low', {'count': all.where((e) => e.impact == 1).length})),
                ],
              ),
              if (data?.updatedAt != null) ...[
                const SizedBox(height: 10),
                Text(
                  t('news.cal.updated', {'time': _localTime(data!.updatedAt!), 'source': data.sourceName}),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        // 4. alerts
        _AlertsCard(my: my),
        const SizedBox(height: 16),
        // 5. the week
        KCard(
          padding: EdgeInsets.zero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 74,
                child: cal.isLoading && data == null
                    ? ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                        children: [
                          for (var i = 0; i < 5; i++) const Padding(padding: EdgeInsetsDirectional.only(end: 8), child: KSkeleton(width: 96, height: 48)),
                        ],
                      )
                    : ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(10, 12, 10, 0),
                        children: [
                          for (final d in days)
                            _DayTab(
                              label: weekday(d),
                              date: dayMonth(dayDate(d)),
                              today: d == serverToday,
                              on: d == day,
                              high: all.where((e) => e.serverDate == d && e.impact == 3).length,
                              count: all.where((e) => e.serverDate == d).length,
                              onTap: () => setState(() {
                                _day = d;
                                _openId = null;
                              }),
                            ),
                        ],
                      ),
              ),
              const KDivider(),
              // filters
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      t('news.cal.impact'),
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                    ),
                    for (final i in const [3, 2, 1])
                      _FilterPill(
                        on: _impacts.contains(i),
                        onTap: () => setState(() {
                          if (_impacts.contains(i) && _impacts.where((y) => y > 0).length == 1) return;
                          _impacts.contains(i) ? _impacts.remove(i) : _impacts.add(i);
                        }),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ImpactBars(i),
                            const SizedBox(width: 6),
                            Text(i == 3 ? t('news.impact.high') : (i == 2 ? t('news.impact.medium') : t('news.impact.low'))),
                          ],
                        ),
                      ),
                    _FilterPill(
                      on: _impacts.contains(0),
                      onTap: () => setState(() => _impacts.contains(0) ? _impacts.remove(0) : _impacts.add(0)),
                      child: Text(t('news.impact.holidays')),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
                child: Wrap(
                  spacing: 5,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      t('news.cal.currency'),
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                    ),
                    for (final c in _ccys)
                      KPressable(
                        minSize: 36,
                        semanticLabel: c,
                        onTap: () => setState(() => _ccySel.contains(c) ? _ccySel.remove(c) : _ccySel.add(c)),
                        child: Opacity(
                          opacity: _ccySel.isNotEmpty && !_ccySel.contains(c) ? 0.5 : 1,
                          child: Container(
                            height: 32,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            decoration: BoxDecoration(
                              color: _ccySel.contains(c) ? k.emberSoft : k.surface2,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: _ccySel.contains(c) ? k.ember.withValues(alpha: 0.4) : k.line),
                            ),
                            child: KFlag(_ccyCountry[c]!, size: 18),
                          ),
                        ),
                      ),
                    if (_ccySel.isNotEmpty) KTextButton(label: t('news.cal.clear'), color: k.fg3, onPressed: () => setState(_ccySel.clear)),
                  ],
                ),
              ),
              const KDivider(),
              if (cal.hasError && data == null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                  child: Text(
                    errorText(cal.error, t),
                    textAlign: TextAlign.center,
                    style: context.text.callout.copyWith(color: k.fg3),
                  ),
                )
              else if (data != null && events.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                  child: Text(
                    t('news.cal.empty'),
                    textAlign: TextAlign.center,
                    style: context.text.callout.copyWith(color: k.fg3),
                  ),
                ),
              for (var i = 0; i < events.length; i++) ...[
                if (i == nowIdx) _NowLine(label: _serverZone ? isoTime(now.toUtc().add(Duration(hours: offset))) : _localTime(now)),
                _EventRow(
                  e: events[i],
                  time: rowTime(events[i]),
                  open: _openId == events[i].id,
                  past: events[i].startsAt.isBefore(now),
                  reminded: my?.reminders.contains(events[i].id) ?? false,
                  onTap: () => setState(() => _openId = _openId == events[i].id ? null : events[i].id),
                ),
                if (_openId == events[i].id)
                  _Detail(
                    e: events[i],
                    serverZone: _serverZone,
                    offset: offset,
                    reminded: my?.reminders.contains(events[i].id) ?? false,
                    onRemind: () => _toggleReminder(events[i]),
                  ),
              ],
              const KDivider(),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                child: Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  children: [
                    Text.rich(
                      TextSpan(
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        children: [
                          TextSpan(
                            text: t('news.cal.legend.green'),
                            style: TextStyle(color: k.up, fontWeight: FontWeight.w700),
                          ),
                          TextSpan(text: ' ${t('news.cal.legend.greenText')}'),
                        ],
                      ),
                    ),
                    Text.rich(
                      TextSpan(
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        children: [
                          TextSpan(
                            text: t('news.cal.legend.red'),
                            style: TextStyle(color: k.down, fontWeight: FontWeight.w700),
                          ),
                          TextSpan(text: ' ${t('news.cal.legend.redText')}'),
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(LucideIcons.info, size: 14, color: k.fg3),
                        const SizedBox(width: 5),
                        Text(
                          t('news.cal.source', {'source': data?.sourceName ?? 'Forex Factory'}),
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// "21:40" of a server-time clock (DateTime in UTC holding the server's wall clock).
String isoTime(DateTime d) => d.toIso8601String().substring(11, 16);

class _DayTab extends StatelessWidget {
  const _DayTab({required this.label, required this.date, required this.today, required this.on, required this.high, required this.count, required this.onTap});
  final String label, date;
  final bool today, on;
  final int high, count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      pressedScale: 1,
      child: Container(
        width: 112,
        margin: const EdgeInsetsDirectional.only(end: 4),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: BoxDecoration(
          color: on ? k.surface2 : null,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          border: on ? Border(bottom: BorderSide(color: k.ember, width: 2)) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.label.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: on ? k.fg : k.fg2),
                  ),
                ),
                if (today) ...[
                  const SizedBox(width: 4),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 3),
            Row(
              children: [
                Text(
                  date,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
                const Spacer(),
                for (var i = 0; i < high.clamp(0, 4); i++)
                  Container(
                    width: 5,
                    height: 5,
                    margin: const EdgeInsetsDirectional.only(end: 2),
                    decoration: BoxDecoration(color: k.down, shape: BoxShape.circle),
                  ),
                const SizedBox(width: 3),
                Text(
                  '$count',
                  style: context.text.caption.copyWith(color: k.fg3, fontFeatures: kTabular),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({required this.on, required this.onTap, required this.child});
  final bool on;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      minSize: 36,
      onTap: onTap,
      child: Opacity(
        opacity: on ? 1 : 0.6,
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 11),
          decoration: BoxDecoration(
            color: on ? k.surface3 : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: k.line),
          ),
          child: DefaultTextStyle.merge(
            style: context.text.caption.copyWith(fontSize: 12, color: on ? k.fg : k.fg3, fontWeight: FontWeight.w500),
            child: Center(widthFactor: 1, child: child),
          ),
        ),
      ),
    );
  }
}

class _NowLine extends StatelessWidget {
  const _NowLine({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(10)),
            child: Text(
              label,
              textDirection: TextDirection.ltr,
              style: context.text.mono(10.5, weight: FontWeight.w600, color: Colors.white),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: Container(height: 1, color: k.ember.withValues(alpha: 0.5))),
          const SizedBox(width: 8),
          Text(
            context.t('news.cal.now'),
            style: context.text.caption.copyWith(color: k.ember, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.e, required this.time, required this.open, required this.past, required this.reminded, required this.onTap});
  final CalEvent e;
  final String time;
  final bool open, past, reminded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final stripe = e.impact == 3 ? k.down : (e.impact == 2 ? k.warn : k.fg3.withValues(alpha: 0.4));
    Widget fig(String label, Widget value) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500, fontSize: 10),
          ),
          const SizedBox(height: 1),
          value,
        ],
      ),
    );
    return KPressable(
      onTap: onTap,
      pressedScale: 1,
      child: Opacity(
        opacity: past && !open ? 0.8 : 1,
        child: Container(
          color: open ? k.surface2.withValues(alpha: 0.6) : null,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 3,
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: stripe,
                    borderRadius: const BorderRadiusDirectional.horizontal(end: Radius.circular(3)).resolve(Directionality.of(context)),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(11, 10, 12, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            SizedBox(
                              width: 52,
                              child: Text(
                                time,
                                textDirection: TextDirection.ltr,
                                style: context.text.mono(12.5, color: k.fg2),
                              ),
                            ),
                            KFlag(e.country, size: 18),
                            const SizedBox(width: 6),
                            Text(e.currency, style: context.text.mono(12.5, weight: FontWeight.w600)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                e.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600, color: k.fg),
                              ),
                            ),
                            if (reminded) ...[
                              const SizedBox(width: 4),
                              Icon(LucideIcons.bellRing, size: 14, color: k.ember, semanticLabel: t('news.cal.reminderSetAria')),
                            ],
                            const SizedBox(width: 6),
                            AnimatedRotation(
                              turns: open ? 0.5 : 0,
                              duration: const Duration(milliseconds: 200),
                              child: Icon(LucideIcons.chevronDown, size: 16, color: open ? k.fg : k.fg3),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            SizedBox(
                              width: 52,
                              child: Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: e.impact > 0
                                    ? ImpactBars(e.impact)
                                    : Text(
                                        t('news.impact.holiday'),
                                        style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
                                      ),
                              ),
                            ),
                            fig(t('news.cal.col.actual'), ActualValue(e, size: 12.5)),
                            fig(t('news.cal.col.forecast'), Text(e.forecast.isEmpty ? '—' : e.forecast, style: context.text.mono(12.5, color: k.fg2))),
                            fig(t('news.cal.col.previous'), Text(e.previous.isEmpty ? '—' : e.previous, style: context.text.mono(12.5, color: k.fg3))),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Detail extends ConsumerWidget {
  const _Detail({required this.e, required this.serverZone, required this.offset, required this.reminded, required this.onRemind});
  final CalEvent e;
  final bool serverZone;
  final int offset;
  final bool reminded;
  final VoidCallback onRemind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final d = ref.watch(calendarDetailProvider(e.id));
    final syms = e.symbols.where(kInstrumentMap.containsKey).toList();
    final quotes = syms.isEmpty ? null : ref.watch(marketsFeedProvider);
    final unit = _unitOf(e.previous.isNotEmpty ? e.previous : (e.forecast.isNotEmpty ? e.forecast : e.actual));
    String fmtV(double v) => '${Fmt.number(v, v == v.roundToDouble() ? 0 : 2)}$unit';
    final tag = intlLocale(t.locale);
    final hist = [
      for (final h in d.value ?? const <CalHistory>[])
        if (figure(h.actual) != null) (label: latinDigits(DateFormat.yMMM(tag).format(h.startsAt.toLocal())), v: figure(h.actual)!),
    ];
    final bars = [...hist, if (figure(e.actual) != null) (label: t('news.cal.now'), v: figure(e.actual)!)];
    final future = e.startsAt.isAfter(DateTime.now());
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final digitsOf = kInstrumentMap.map((s, i) => MapEntry(s, i.digits));

    Widget box(String label, String value, {Color? color}) => Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: k.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: k.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              textDirection: TextDirection.ltr,
              style: context.text.mono(13.5, weight: FontWeight.w600, color: color ?? k.fg),
            ),
          ],
        ),
      ),
    );

    return Container(
      color: k.surface2.withValues(alpha: 0.5),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(t('news.cal.history'), style: context.text.label.copyWith(color: k.fg2)),
          const SizedBox(height: 8),
          if (d.isLoading && !d.hasValue)
            const KSkeleton(height: 150)
          else if (bars.length >= 2)
            KBarChart(
              values: [for (final b in bars) b.v],
              labels: [for (final b in bars) '${b.label} · ${fmtV(b.v)}'],
              height: 130,
              color: k.gold,
              highlightLast: true,
            )
          else
            Container(
              height: 120,
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: k.surface,
                borderRadius: BorderRadius.circular(k.rowRadius),
                border: Border.all(color: k.line),
              ),
              child: Text(
                e.forecast.isNotEmpty || e.previous.isNotEmpty ? t('news.cal.historyBuilding') : t('news.cal.noFigures'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            ),
          const SizedBox(height: 16),
          Text(t('news.cal.thisRelease'), style: context.text.label.copyWith(color: k.fg2)),
          const SizedBox(height: 8),
          Row(
            children: [
              box(
                t('news.cal.col.actual'),
                e.actual.isNotEmpty ? e.actual : (future ? t('common.pending') : '—'),
                color: e.surprise == 1 ? k.up : (e.surprise == -1 ? k.down : null),
              ),
              const SizedBox(width: 8),
              box(t('news.cal.col.forecast'), e.forecast.isEmpty ? '—' : e.forecast),
              const SizedBox(width: 8),
              box(t('news.cal.col.previous'), e.previous.isEmpty ? '—' : e.previous),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            (e.allDay
                    ? t('news.cal.allDay')
                    : serverZone
                    ? t('news.cal.timeServer', {'server': e.serverTime, 'tz': gmt(offset), 'local': _localTime(e.startsAt)})
                    : t('news.cal.timeLocal', {'server': e.serverTime, 'local': _localTime(e.startsAt)})) +
                (e.lowerIsBetter && e.forecast.isNotEmpty ? ' · ${t('news.cal.lowerIsBetter')}' : ''),
            style: context.text.footnote.copyWith(color: k.fg2, height: 1.5),
          ),
          if (future && !e.allDay && !readOnly) ...[
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KButton(
                label: reminded ? t('news.cal.removeReminder') : t('news.cal.remindMe'),
                icon: reminded ? LucideIcons.bellOff : LucideIcons.bellPlus,
                variant: reminded ? KButtonVariant.ghost : KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: onRemind,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Text(t('news.cal.toWatch'), style: context.text.label.copyWith(color: k.fg2)),
          const SizedBox(height: 8),
          if (syms.isEmpty) Text(t('news.cal.noLinked'), style: context.text.footnote.copyWith(color: k.fg3)),
          for (final s in syms)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: KPressable(
                pressedScale: 0.99,
                onTap: () => context.push('/trader?symbol=$s'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: k.surface,
                    borderRadius: BorderRadius.circular(k.rowRadius),
                    border: Border.all(color: k.line),
                  ),
                  child: Row(
                    children: [
                      SymbolAvatar(s, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          s,
                          style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                        ),
                      ),
                      if (quotes?[s] != null) ...[
                        Text(Fmt.number(quotes![s]!.bid, digitsOf[s] ?? 2), textDirection: TextDirection.ltr, style: context.text.mono(12)),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 56,
                          child: Text(
                            Fmt.percent(quotes[s]!.change, signed: true),
                            textAlign: TextAlign.end,
                            textDirection: TextDirection.ltr,
                            style: context.text.caption.copyWith(fontSize: 11, color: quotes[s]!.change >= 0 ? k.up : k.down),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AlertsCard extends ConsumerStatefulWidget {
  const _AlertsCard({required this.my});
  final MyCalendar? my;

  @override
  ConsumerState<_AlertsCard> createState() => _AlertsCardState();
}

class _AlertsCardState extends ConsumerState<_AlertsCard> {
  bool _busy = false;

  Future<void> _save(bool enable, int minutes) async {
    if (_busy) return;
    final t = context.t;
    final toast = ref.read(notificationsProvider.notifier);
    setState(() => _busy = true);
    try {
      await ref.read(myCalendarProvider.notifier).setAlerts(enable, minutes);
      KHaptics.success();
      toast.toast(NotificationKind.success, enable ? t('news.alerts.saved', {'minutes': minutes}) : t('news.alerts.off'));
    } on ApiException catch (e) {
      toast.toast(NotificationKind.error, e.message.isEmpty ? t('news.alerts.error') : localizeError(e, t));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final my = widget.my;
    final on = my?.highImpact ?? false;
    final minutes = my?.minutes ?? 15;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    return KCard(
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(t('news.alerts.title'), style: context.text.label.copyWith(color: k.fg2)),
              ),
              KSwitch(value: on, semanticLabel: t('news.alerts.toggle'), onChanged: readOnly || my == null ? null : (v) => _save(v, minutes)),
            ],
          ),
          const SizedBox(height: 4),
          Text(on ? t('news.alerts.onText', {'minutes': minutes}) : t('news.alerts.offText'), style: context.text.footnote.copyWith(color: k.fg2, height: 1.5)),
          if (on) ...[
            const SizedBox(height: 10),
            KSegmented<int>(
              plain: true,
              height: 32,
              values: const [5, 15, 30, 60],
              labels: [
                for (final m in const [5, 15, 30, 60]) t('news.alerts.minutes', {'m': m}),
              ],
              selected: minutes,
              onChanged: readOnly ? (_) {} : (m) => _save(true, m),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(LucideIcons.bellRing, size: 14, color: k.fg3),
              const SizedBox(width: 6),
              Text(
                t('news.alerts.reminders', {'count': my?.reminders.length ?? 0}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
