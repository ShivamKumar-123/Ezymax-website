// "More for you" (web live-dashboard.tsx TraderBanner, AccountCard, SessionsCard, SupportCard): Kalks Trader, the
// client's record, the market clock (packages/ui MarketSessions) and how to reach support.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/config/app_config.dart';
import '../../../core/format/format.dart';
import '../../../core/models/user.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../../markets/instruments.dart';

/// The support address: the broker's (config) or Kalks' own (web SUPPORT_EMAIL).
String supportEmailOf(AppConfig cfg) => (cfg.supportEmail == null || cfg.supportEmail!.isEmpty) ? 'support@kalkstrade.com' : cfg.supportEmail!;

/// Kalks Trader: live prices, the instrument count, Launch.
class TraderBanner extends StatelessWidget {
  const TraderBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return KCard(
      hot: true,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KChip(label: t('dashboard.trader.chip'), tone: KChipTone.ember, icon: LucideIcons.candlestickChart),
          const SizedBox(height: 12),
          Text('Kalks Trader', style: context.text.title1.copyWith(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(t('app.dashboard.traderText', {'count': kInstruments.length}), style: context.text.callout.copyWith(color: context.k.fg2)),
          const SizedBox(height: 20),
          KButton(
            label: t('dashboard.launchTrader'),
            trailingIcon: rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
            variant: KButtonVariant.ink,
            size: KButtonSize.lg,
            onPressed: () => context.push('/trader'),
          ),
        ],
      ),
    );
  }
}

/// "Your account": client ID, email, email status, identity, member since; Profile.
class AccountCard extends ConsumerWidget {
  const AccountCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final me = ref.watch(meProvider);
    if (me == null) return const SizedBox.shrink();
    final f = LocaleFormat(t.locale);
    final kyc = switch (me.kycStatus) {
      KycStatus.verified => (KChipTone.up, 'Verified'),
      KycStatus.rejected => (KChipTone.down, 'KYC rejected'),
      KycStatus.pending => (KChipTone.warn, 'KYC in review'),
      KycStatus.unverified => (KChipTone.warn, 'Verify your identity'),
    };
    final rows = <(String, Widget)>[
      (
        t('dashboard.account.clientId'),
        Text(
          me.clientId,
          textDirection: TextDirection.ltr,
          style: context.text.mono(13, weight: FontWeight.w600),
        ),
      ),
      (t('common.email'), Text(me.email, maxLines: 1, overflow: TextOverflow.ellipsis, textDirection: TextDirection.ltr)),
      (
        t('dashboard.account.emailStatus'),
        me.emailVerified
            ? KChip(label: t('common.verified'), tone: KChipTone.up, small: true)
            : KChip(label: t('dashboard.account.notVerified'), tone: KChipTone.warn, small: true),
      ),
      (
        t('dashboard.account.identity'),
        KChip(
          label: t.dyn('shell.kyc.${me.kycStatus.name}', fallback: kyc.$2),
          tone: kyc.$1,
          dot: true,
          small: true,
        ),
      ),
      (t('dashboard.account.memberSince'), Text(f.date(me.createdAt))),
    ];
    return KCard(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('dashboard.account.title'),
            icon: LucideIcons.userRound,
            action: KButton(
              label: t('dashboard.account.profile'),
              size: KButtonSize.sm,
              variant: KButtonVariant.surface,
              onPressed: () => context.go('/profile'),
            ),
          ),
          const SizedBox(height: 8),
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const KDivider(),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  Text(rows[i].$1, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: DefaultTextStyle.merge(
                        style: context.text.footnote.copyWith(color: k.fg, fontSize: 13, fontWeight: FontWeight.w600),
                        child: rows[i].$2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The trading sessions in server time (GMT+3): Sydney, Tokyo, London, New York (web MarketSessions).
const List<({String key, int open, int close, String flag})> kSessions = [
  (key: 'shell.sessions.sydney', open: 0, close: 9, flag: 'au'),
  (key: 'shell.sessions.tokyo', open: 3, close: 12, flag: 'jp'),
  (key: 'shell.sessions.london', open: 10, close: 19, flag: 'gb'),
  (key: 'shell.sessions.newYork', open: 15, close: 24, flag: 'us'),
];

/// Whether a session is open at server hour `h` (fractional), and hours until it closes / opens.
({bool open, double until}) sessionState(({String key, int open, int close, String flag}) s, double h) {
  final open = h >= s.open && h < s.close;
  final until = open ? s.close - h : (s.open - h + 24) % 24;
  return (open: open, until: until);
}

/// "Market clock": n of 28 markets open, then the four sessions.
class SessionsCard extends StatelessWidget {
  const SessionsCard({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final open = kInstruments.where(isMarketOpen).length;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('dashboard.sessions.title'),
            action: KChip(label: t('dashboard.sessions.open', {'open': open, 'total': kInstruments.length}), small: true),
          ),
          const SizedBox(height: 16),
          const MarketSessions(),
        ],
      ),
    );
  }
}

class MarketSessions extends StatefulWidget {
  const MarketSessions({super.key});

  @override
  State<MarketSessions> createState() => _MarketSessionsState();
}

class _MarketSessionsState extends State<MarketSessions> {
  late Timer _timer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _now = DateTime.now()));
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final u = _now.toUtc();
    final hh = (u.hour + 3) % 24;
    final h = hh + u.minute / 60 + u.second / 3600;
    String two(int n) => n.toString().padLeft(2, '0');
    final clock = '${two(hh)}:${two(u.minute)}:${two(u.second)}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                t('shell.sessions.title'),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
              ),
            ),
            Text(
              'GMT+3 · $clock',
              textDirection: TextDirection.ltr,
              style: context.text.mono(12, color: k.fg2),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final s in kSessions) ...[
          Builder(
            builder: (context) {
              final st = sessionState(s, h);
              final hours = st.until.floor();
              final mins = ((st.until - hours) * 60).floor();
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    KFlag(s.flag, size: 16),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 72,
                      child: Text(
                        t(s.key),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.footnote.copyWith(color: k.fg2),
                      ),
                    ),
                    Expanded(
                      child: Directionality(
                        textDirection: TextDirection.ltr,
                        child: LayoutBuilder(
                          builder: (context, c) => Container(
                            height: 8,
                            decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(4)),
                            child: Stack(
                              children: [
                                Positioned(
                                  left: c.maxWidth * s.open / 24,
                                  width: c.maxWidth * (s.close - s.open) / 24,
                                  top: 0,
                                  bottom: 0,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(4),
                                      color: st.open ? null : k.fg3.withValues(alpha: 0.3),
                                      gradient: st.open ? LinearGradient(colors: [k.ember.withValues(alpha: 0.6), k.ember]) : null,
                                      boxShadow: st.open ? [BoxShadow(color: k.ember.withValues(alpha: 0.5), blurRadius: 12)] : null,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: c.maxWidth * h / 24 - 1,
                                  top: -2,
                                  bottom: -2,
                                  width: 2,
                                  child: Container(color: k.fg),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 120,
                      child: Text(
                        st.open ? '● ${t('shell.sessions.openLeft', {'h': hours, 'm': mins})}' : t('shell.sessions.opensIn', {'h': hours, 'm': mins}),
                        textAlign: TextAlign.end,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.caption.copyWith(color: st.open ? k.up : k.fg3, fontWeight: FontWeight.w500, fontFeatures: kTabular),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ],
    );
  }
}

/// "Need help?": the support address, Copy and Email support.
class SupportCard extends ConsumerWidget {
  const SupportCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final email = supportEmailOf(ref.watch(configProvider));
    return KCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const KIconTile(icon: LucideIcons.lifeBuoy, tone: KTone.lavender, size: 48, radius: 15, iconSize: 20),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('dashboard.support.title'), style: context.text.headline.copyWith(fontSize: 16, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    KRichText(
                      t('dashboard.support.text', {'email': email}),
                      style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                      tags: {'mail': KTag(style: context.text.mono(12.5, color: k.fg))},
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              KButton(
                label: t('common.copy'),
                icon: LucideIcons.copy,
                size: KButtonSize.sm,
                variant: KButtonVariant.surface,
                onPressed: () => kCopy(context, email, message: t('dashboard.support.copied')),
              ),
              const SizedBox(width: 8),
              KButton(
                label: t('dashboard.support.emailSupport'),
                icon: LucideIcons.mail,
                size: KButtonSize.sm,
                onPressed: () async {
                  final ok = await launchUrl(Uri(scheme: 'mailto', path: email));
                  if (!ok && context.mounted) {
                    ref.read(notificationsProvider.notifier).toast(NotificationKind.error, t('dashboard.support.copyFailed'));
                  }
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}
