import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';

/// The language list (web LanguageMenu): the 22 languages with their flags, native and English names.
Future<void> showLanguageSheet(BuildContext context, WidgetRef ref) => showKSheet<void>(
  context,
  title: context.t('shell.language'),
  expand: true,
  builder: (ctx) => Consumer(
    builder: (ctx, ref, _) {
      final current = ref.watch(localeProvider);
      final k = ctx.k;
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        children: [
          KListSection(
            margin: EdgeInsets.zero,
            children: [
              for (final l in kLocales)
                KListRow(
                  dense: true,
                  leading: KFlag(l.flag, size: 24),
                  title: l.name,
                  subtitle: l.english == l.name ? null : l.english,
                  selected: l.code == current,
                  trailing: l.code == current ? Icon(LucideIcons.check, size: 18, color: k.ember) : null,
                  chevron: false,
                  onTap: () async {
                    await ref.read(i18nProvider.notifier).setLocale(l.code);
                    if (ctx.mounted) Navigator.of(ctx).pop();
                  },
                ),
            ],
          ),
        ],
      );
    },
  ),
);

/// Sun / moon toggle (web ThemeToggle).
class ThemeToggleButton extends ConsumerWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = context.k.dark;
    return KIconButton(
      icon: dark ? LucideIcons.sun : LucideIcons.moon,
      semanticLabel: context.t('shell.toggleTheme'),
      onPressed: () => ref.read(themeModeProvider.notifier).toggle(Theme.of(context).brightness),
    );
  }
}

/// Globe button opening the language list.
class LanguageButton extends ConsumerWidget {
  const LanguageButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final info = localeInfo(ref.watch(localeProvider));
    return KPressable(
      onTap: () => showLanguageSheet(context, ref),
      semanticLabel: context.t('shell.language'),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: context.k.surface2,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: context.k.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            KFlag(info.flag, size: 18),
            const SizedBox(width: 6),
            Text(info.code.toUpperCase(), style: context.text.caption.copyWith(fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
