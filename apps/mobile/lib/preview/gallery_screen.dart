// The design system on one page (preview builds only: More › Design system, or /more/gallery). Every component of
// lib/ui in its states, for screenshots and as the reference later screens copy from. `?open=` (web preview URL) opens
// an overlay on load: banner, sheet, actions, alert, stepup, bell, profile, palette, language.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/auth/auth_controller.dart';
import '../core/config/app_config.dart';
import '../core/notifications/notifications.dart';
import '../features/common/pickers.dart';
import '../i18n/i18n.dart';
import '../shell/menus.dart';
import '../shell/nav.dart';
import '../ui/ui.dart';

class GalleryScreen extends ConsumerStatefulWidget {
  const GalleryScreen({super.key, this.open});
  final String? open;

  @override
  ConsumerState<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends ConsumerState<GalleryScreen> {
  String _seg = 'week';
  bool _switch = true;
  double _volume = 0.10;
  bool _check = true;

  @override
  void initState() {
    super.initState();
    if (widget.open != null) WidgetsBinding.instance.addPostFrameCallback((_) => Timer(const Duration(milliseconds: 600), () => _openOverlay(widget.open!)));
  }

  void _openOverlay(String what) {
    if (!mounted) return;
    final t = context.t;
    switch (what) {
      case 'banner':
        ref.read(notificationsProvider.notifier).push(title: 'Buy 0.10 XAUUSD filled at 2,384.15', body: 'Position #4410023 opened on #10042817.');
      case 'sheet':
        showKSheet<void>(
          context,
          title: t('shell.preferences'),
          builder: (_) => Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: KListSection(
              margin: EdgeInsets.zero,
              children: [
                KListRow(title: t('shell.language'), value: 'English', onTap: () {}),
                KListRow(title: t('profile.prefs.appearance'), value: t('shell.themeLight'), onTap: () {}),
              ],
            ),
          ),
        );
      case 'actions':
        showKActionSheet<String>(
          context,
          title: '#10042817',
          message: 'Pro · Hedging',
          actions: [
            KAction(label: t('accounts.row.trade'), value: 'trade', icon: LucideIcons.candlestickChart),
            const KAction(label: 'Rename', value: 'rename', icon: LucideIcons.pencil),
            const KAction(label: 'Archive', value: 'archive', icon: LucideIcons.archive, destructive: true),
          ],
        );
      case 'alert':
        showKAlert<bool>(
          context,
          title: t('app.biometric.offerTitle'),
          message: t('app.biometric.text'),
          actions: [
            KAction(label: t('app.biometric.notNow'), value: false),
            KAction(label: t('app.biometric.enable'), value: true, primary: true),
          ],
        );
      case 'stepup':
        showStepUpSheet(context, action: 'withdrawal', title: t('wallet.confirmWithdrawal'), what: 'withdraw 250.00 USDT', onConfirmed: (_) async {});
      case 'bell':
        showBellSheet(context);
      case 'profile':
        showProfileMenu(context);
      case 'palette':
        showCommandPalette(context, navFor(ref.read(configProvider), ref.read(meProvider)));
      case 'language':
        showLanguageSheet(context, ref);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    Widget label(String s) => Padding(
      padding: const EdgeInsets.only(top: 22, bottom: 10),
      child: Text(s.toUpperCase(), style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.6)),
    );
    return KPageScroll(
      children: [
        const KPageHeader(title: 'Design system', subtitle: Text('Kalks iOS · lib/ui')),
        label('Buttons (one primary per screen)'),
        Wrap(
          spacing: 8,
          runSpacing: 10,
          children: [
            KButton(label: t('common.deposit'), variant: KButtonVariant.ink, icon: LucideIcons.arrowDownToLine, onPressed: () {}),
            KButton(label: t('dashboard.home.trade'), icon: LucideIcons.candlestickChart, onPressed: () {}),
            KButton(label: t('common.cancel'), variant: KButtonVariant.surface, onPressed: () {}),
            KButton(label: t('common.details'), variant: KButtonVariant.outline, size: KButtonSize.sm, onPressed: () {}),
            KButton(label: t('common.delete'), variant: KButtonVariant.danger, size: KButtonSize.sm, onPressed: () {}),
            KButton(label: t('common.loading'), loading: true, size: KButtonSize.sm, onPressed: () {}),
            KButton(label: 'Sell', variant: KButtonVariant.sell, size: KButtonSize.sm, onPressed: () {}),
            KButton(label: 'Buy', variant: KButtonVariant.buy, size: KButtonSize.sm, onPressed: () {}),
          ],
        ),
        const SizedBox(height: 10),
        KButton(label: t('auth.login.signIn'), size: KButtonSize.lg, expand: true, trailingIcon: LucideIcons.arrowRight, onPressed: () {}),
        label('Chips and tiles'),
        Wrap(
          spacing: 6,
          runSpacing: 8,
          children: [for (final c in KChipTone.values) KChip(label: c.name, tone: c, dot: c == KChipTone.up)],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final tone in KTone.values) KIconTile(icon: LucideIcons.wallet, tone: tone)],
        ),
        label('Segmented, switch, stepper'),
        KSegmented<String>(
          values: const ['week', 'month', 'year'],
          labels: [t('dashboard.home.weekly'), t('dashboard.home.monthly'), t('dashboard.home.lastYear')],
          selected: _seg,
          onChanged: (v) => setState(() => _seg = v),
        ),
        const SizedBox(height: 10),
        KSegmented<String>(
          plain: true,
          values: const ['week', 'month'],
          labels: [t('shell.themeLight'), t('shell.themeDark')],
          selected: _seg == 'week' ? 'week' : 'month',
          onChanged: (v) => setState(() => _seg = v),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            KSwitch(value: _switch, onChanged: (v) => setState(() => _switch = v)),
            const Spacer(),
            KStepper(value: _volume, min: 0.01, max: 100, label: t('trader.mobile.volume'), onChanged: (v) => setState(() => _volume = v)),
          ],
        ),
        const SizedBox(height: 12),
        KStepIndicator(steps: [t('auth.register.stepDetails'), t('auth.register.stepVerify'), t('auth.register.stepDone')], current: 1),
        label('Grouped list, swipe a row'),
        KListSection(
          header: t('shell.nav.wallet'),
          footer: 'Rows: 48 pt (60 with a subtitle), chevron when they navigate.',
          children: [
            KListRow(
              leading: const KIconTile(icon: LucideIcons.arrowDownToLine, tone: KTone.mint, size: 32),
              title: t('shell.nav.deposit'),
              subtitle: 'USDT · TRC20 · BEP20',
              onTap: () {},
            ),
            KListRow(
              leading: const KIconTile(icon: LucideIcons.bell, tone: KTone.sky, size: 32),
              title: t('dashboard.notifications.title'),
              trailing: KSwitch(value: _switch, onChanged: (v) => setState(() => _switch = v)),
            ),
            KListRow(
              leading: const KIconTile(icon: LucideIcons.mail, tone: KTone.lavender, size: 32),
              title: 'Swipe me',
              value: '3',
              onTap: () {},
              swipeActions: [
                KSwipeAction(label: t('app.markRead'), icon: LucideIcons.check, color: k.info, onTap: () {}),
                KSwipeAction(label: t('common.delete'), icon: LucideIcons.trash2, destructive: true, onTap: () {}),
              ],
            ),
          ],
        ),
        label('Inputs'),
        KTextField(label: t('auth.field.email'), placeholder: t('auth.placeholder.email'), leading: LucideIcons.mail, ltr: true),
        const SizedBox(height: 12),
        KTextField(label: t('auth.field.password'), leading: LucideIcons.lock, obscure: true, error: t('auth.apiError.pwMin')),
        const SizedBox(height: 12),
        KOtpField(autofocus: false, onCompleted: (_) {}),
        const SizedBox(height: 12),
        KCheckRow(
          value: _check,
          onChanged: (v) => setState(() => _check = v),
          child: KRichText(t('auth.register.terms'), tags: const {'agreement': KTag(), 'risk': KTag(), 'privacy': KTag()}),
        ),
        const SizedBox(height: 8),
        const KFormError('Wrong email or password.'),
        label('Money, KPI and cards'),
        Row(
          children: [
            Expanded(
              child: KKpiCard(
                label: t('dashboard.equity.title'),
                icon: LucideIcons.trendingUp,
                value: KMoney(15413.2, style: context.text.moneyL),
                chip: KChip(label: t('dashboard.home.accountsChip', {'live': 2, 'positions': 6})),
                onTap: () {},
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        KCard(
          hot: true,
          child: Row(
            children: [
              const KIconTile(icon: LucideIcons.candlestickChart, size: 44),
              const SizedBox(width: 12),
              Expanded(child: Text('Kalks Trader', style: context.text.title2)),
              const KChangeChip('+1.25%'),
            ],
          ),
        ),
        label('Loading and empty states'),
        KCard(
          child: Row(
            children: [
              const KSkeleton(width: 44, height: 44, circle: true),
              const SizedBox(width: 12),
              Expanded(child: KSkeleton.lines(2)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        KCard(
          child: KEmptyState(art: KIllustrationName.emptyHistory, title: t('wallet.recent.emptyText'), compact: true),
        ),
        label('Overlays'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final o in ['banner', 'sheet', 'actions', 'alert', 'stepup', 'bell', 'profile', 'palette', 'language'])
              KButton(label: o, variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: () => _openOverlay(o)),
          ],
        ),
        label('Illustrations (PNG 1x/2x/3x)'),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [for (final n in KIllustrationName.values) KCard(padding: const EdgeInsets.all(8), child: KIllustration(n, width: 100, maxHeight: 80))],
        ),
      ],
    );
  }
}
