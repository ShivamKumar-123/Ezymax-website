// The header's overlays, as iOS sheets: the bell (web NotificationsBell), the profile menu (web ProfilePill menu) and
// the search / command palette (web CommandPalette, ⌘K).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/auth/auth_controller.dart';
import '../core/format/format.dart';
import '../core/models/user.dart';
import '../core/notifications/notifications.dart';
import '../i18n/i18n.dart';
import '../ui/ui.dart';
import 'nav.dart';

/// KYC chip in the account menu (web KYC_CHIP).
(KChipTone, String) kycChip(KycStatus s, T t) => switch (s) {
  KycStatus.verified => (KChipTone.up, t('shell.kyc.verified')),
  KycStatus.pending => (KChipTone.warn, t('shell.kyc.pending')),
  KycStatus.rejected => (KChipTone.down, t('shell.kyc.rejected')),
  KycStatus.unverified => (KChipTone.warn, t('shell.kyc.unverified')),
};

/// The bell: the inbox with Mark all read / Clear, rows open their link; Notification settings at the bottom.
Future<void> showBellSheet(BuildContext context) => showKSheet<void>(context, expand: true, builder: (_) => const _BellSheet());

class _BellSheet extends ConsumerWidget {
  const _BellSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(notificationsProvider);
    final ctl = ref.read(notificationsProvider.notifier);
    final f = LocaleFormat(t.locale);
    final now = DateTime.now();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 12, 6),
          child: Row(
            children: [
              Text(t('dashboard.notifications.title'), style: context.text.title2),
              if (s.unread > 0) ...[const SizedBox(width: 8), KChip(label: '${s.unread}', tone: KChipTone.ember, small: true)],
              const Spacer(),
              if (s.items.isNotEmpty) ...[
                KTextButton(label: t('dashboard.notifications.markAll'), color: k.fg3, onPressed: s.unread > 0 ? ctl.markAll : null),
                KTextButton(label: t('dashboard.notifications.clear'), color: k.fg3, onPressed: ctl.clear),
              ],
            ],
          ),
        ),
        Expanded(
          child: s.items.isEmpty
              ? Center(
                  child: KEmptyState(icon: LucideIcons.bell, title: t('dashboard.notifications.emptyTitle'), text: t('dashboard.notifications.emptyText')),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  itemCount: s.items.length,
                  separatorBuilder: (_, _) => const KDivider(indent: 60),
                  itemBuilder: (context, i) {
                    final n = s.items[i];
                    return KSwipeable(
                      actions: [if (!n.read) KSwipeAction(label: t('app.markRead'), icon: LucideIcons.check, color: k.info, onTap: () => ctl.markOne(n))],
                      child: KPressable(
                        pressedScale: 1,
                        onTap: () {
                          Navigator.of(context).pop();
                          ctl.open(n);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              KIconTile(icon: n.icon, tone: n.tone, size: 38, radius: 11),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      n.title,
                                      style: context.text.callout.copyWith(
                                        fontWeight: n.read ? FontWeight.w400 : FontWeight.w600,
                                        color: n.read ? k.fg2 : k.fg,
                                      ),
                                    ),
                                    if (n.body.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        n.body,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: context.text.footnote.copyWith(color: k.fg3),
                                      ),
                                    ],
                                    const SizedBox(height: 3),
                                    Text(
                                      timeAgo(t, f, n.createdAt, now),
                                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                                    ),
                                  ],
                                ),
                              ),
                              if (!n.read)
                                Container(
                                  margin: const EdgeInsets.only(top: 8, left: 6, right: 4),
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
        const KDivider(),
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: KTextButton(
              label: t('dashboard.notifications.settings'),
              color: k.fg3,
              onPressed: () {
                Navigator.of(context).pop();
                GoRouter.of(context).go('/profile/notifications');
              },
            ),
          ),
        ),
      ],
    );
  }
}

/// The account menu: who is signed in (KYC or read-only chip), the profile pages, Log out (web ACCOUNT_MENU_LIVE).
Future<void> showProfileMenu(BuildContext context) => showKSheet<void>(context, builder: (_) => const _ProfileMenu());

class _ProfileMenu extends ConsumerWidget {
  const _ProfileMenu();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final me = ref.watch(meProvider);
    if (me == null) return const SizedBox(height: 120);
    final viewer = me.viewer;
    final (tone, kycLabel) = kycChip(me.kycStatus, t);
    void go(String href) {
      Navigator.of(context).pop();
      GoRouter.of(context).go(href);
    }

    final items = <(String, IconData, String)>[
      ('shell.profile', LucideIcons.userRound, '/profile'),
      ('shell.security', LucideIcons.shieldCheck, '/profile/security'),
      ('shell.nav.viewers', LucideIcons.eye, '/profile/viewers'),
      ('shell.verification', LucideIcons.idCard, '/profile/verification'),
      ('shell.preferences', LucideIcons.settings, '/profile/preferences'),
    ];
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 18),
            child: Row(
              children: [
                KAvatar(name: me.name, size: 46, verified: me.kycStatus == KycStatus.verified),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(me.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.headline),
                      Text(
                        viewer != null ? '${t('security.sessions.viewOnly')} · ${viewer.label}' : me.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.footnote.copyWith(color: k.fg3),
                      ),
                      const SizedBox(height: 6),
                      if (viewer != null)
                        const KChip(label: 'Read-only', tone: KChipTone.info, small: true, dot: true)
                      else
                        KChip(label: kycLabel, tone: tone, small: true, dot: true),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (viewer == null)
            KListSection(
              children: [
                for (final (key, icon, href) in items)
                  KListRow(
                    leading: Icon(icon, size: 19, color: k.fg2),
                    title: t(key),
                    onTap: () => go(href),
                  ),
              ],
            ),
          KListSection(
            margin: EdgeInsets.zero,
            children: [
              KListRow(
                leading: Icon(LucideIcons.logOut, size: 19, color: k.down),
                title: t('shell.logOut'),
                destructive: true,
                chevron: false,
                onTap: () {
                  Navigator.of(context).pop();
                  ref.read(authProvider.notifier).logout();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Search: every page of the navigation, grouped by module, filtered as you type (web CommandPalette).
Future<void> showCommandPalette(BuildContext context, List<NavModule> nav) => showKSheet<void>(context, expand: true, builder: (_) => _Palette(nav: nav));

class _Palette extends StatefulWidget {
  const _Palette({required this.nav});
  final List<NavModule> nav;

  @override
  State<_Palette> createState() => _PaletteState();
}

class _PaletteState extends State<_Palette> {
  final _q = TextEditingController();

  @override
  void initState() {
    super.initState();
    _q.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final q = _q.text.trim().toLowerCase();
    final all = navCommands(widget.nav, t);
    final hits = q.isEmpty ? all : all.where((c) => c.label.toLowerCase().contains(q) || c.group.toLowerCase().contains(q)).toList();
    final groups = <String, List<({String group, String label, String href, IconData icon})>>{};
    for (final c in hits) {
      (groups[c.group] ??= []).add(c);
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: KTextField(controller: _q, autofocus: true, leading: LucideIcons.search, placeholder: t('shell.searchPalette')),
        ),
        Expanded(
          child: hits.isEmpty
              ? Center(
                  child: Text(t('shell.noResults'), style: context.text.callout.copyWith(color: k.fg3)),
                )
              : ListView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  children: [
                    for (final g in groups.entries)
                      KListSection(
                        header: g.key,
                        children: [
                          for (final c in g.value)
                            KListRow(
                              dense: true,
                              leading: Icon(c.icon, size: 18, color: k.fg2),
                              title: c.label,
                              onTap: () {
                                Navigator.of(context).pop();
                                GoRouter.of(context).go(c.href);
                              },
                            ),
                        ],
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
