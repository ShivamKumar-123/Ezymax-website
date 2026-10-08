// The web DataTable's CSV button: the table's exportable columns as a CSV file, handed to the share sheet (where the
// client saves it or sends it on), like the app's other downloads (lib/core/files.dart).
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/files.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

String _esc(Object? v) {
  final s = '${v ?? ''}';
  return RegExp(r'[",\n]').hasMatch(s) ? '"${s.replaceAll('"', '""')}"' : s;
}

/// "head1,head2\nv1,v2…" (web downloadCsv).
String buildCsv(List<String> headers, List<List<Object?>> rows) => [headers.map(_esc).join(','), ...rows.map((r) => r.map(_esc).join(','))].join('\n');

/// The compact "CSV" button of a table (web: `<Download /> CSV`).
class CsvButton extends ConsumerWidget {
  const CsvButton({super.key, required this.name, required this.headers, required this.rows});
  final String name;
  final List<String> headers;
  final List<List<Object?>> Function() rows;

  @override
  Widget build(BuildContext context, WidgetRef ref) => KButton(
    label: 'CSV',
    icon: LucideIcons.download,
    variant: KButtonVariant.surface,
    size: KButtonSize.sm,
    onPressed: () async {
      final csv = buildCsv(headers, rows());
      final ok = await shareFile((bytes: Uint8List.fromList(utf8.encode(csv)), fileName: '$name.csv', contentType: 'text/csv'), fallbackName: '$name.csv');
      if (!ok && context.mounted) ref.read(notificationsProvider.notifier).toast(NotificationKind.error, context.t('common.errorRetry'));
    },
  );
}
