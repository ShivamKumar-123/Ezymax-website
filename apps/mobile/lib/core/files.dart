// Files from the API (statements, CSV exports, history ZIPs, attachments): the web downloads them; the app hands
// them to the system share sheet, where the client saves them (Files, Drive) or sends them on. In the web preview
// share_plus falls back to a browser download.
import 'dart:typed_data';

import 'package:share_plus/share_plus.dart';

/// A downloaded file (`ApiClient.download`).
typedef DownloadedFile = ({Uint8List bytes, String? fileName, String? contentType});

/// MIME type by extension, for answers without a usable Content-Type.
String mimeOf(String name) => switch (name.split('.').last.toLowerCase()) {
  'pdf' => 'application/pdf',
  'csv' => 'text/csv',
  'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'zip' => 'application/zip',
  'png' => 'image/png',
  'jpg' || 'jpeg' => 'image/jpeg',
  'json' => 'application/json',
  _ => 'application/octet-stream',
};

/// Opens the share sheet with `file` (named by the server's Content-Disposition, else `fallbackName`). Resolves
/// false when the phone has no share target (the caller then shows an error).
Future<bool> shareFile(DownloadedFile file, {required String fallbackName, String? subject}) async {
  final name = (file.fileName == null || file.fileName!.trim().isEmpty) ? fallbackName : file.fileName!.trim();
  final type = file.contentType?.split(';').first.trim();
  final mime = type == null || type.isEmpty || type == 'application/octet-stream' ? mimeOf(name) : type;
  final r = await SharePlus.instance.share(
    ShareParams(
      files: [XFile.fromData(file.bytes, name: name, mimeType: mime)],
      fileNameOverrides: [name],
      subject: subject,
    ),
  );
  return r.status != ShareResultStatus.unavailable;
}
