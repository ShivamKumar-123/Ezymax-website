// Getting a document into the KYC case: the picker (the phone's camera through image_picker, or a file through the
// system file chooser, as the web's camera view / file input) and the upload, exactly as the web's uploadDocument
// (components/verification/api.ts): `POST kyc/documents`, multipart/form-data with `file`, `kind`, `side`, `party?`,
// `issue_date?`, `doc_type?` and `checks?` (JSON). The picker is a provider so tests can feed bytes.
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_providers.dart';
import 'kyc_checks.dart';
import 'kyc_models.dart';

/// Upload limit (web MAX_BYTES; the BFF and gateway refuse more).
const int kKycMaxBytes = 10 * 1024 * 1024;

/// A photo or file the client chose: its bytes, file name, type and where it came from (camera | file).
class KycPicked {
  const KycPicked({required this.bytes, required this.name, required this.mime, required this.origin});
  final Uint8List bytes;
  final String name;
  final String mime;

  /// camera | file
  final String origin;
}

/// The camera can't be used: `blocked` when the person refused the permission (web NotAllowedError).
class KycCameraUnavailable implements Exception {
  const KycCameraUnavailable({this.blocked = false});
  final bool blocked;
}

/// Where photos and files come from. Null = the person closed the camera or the chooser.
abstract class KycPicker {
  /// The phone's camera (the front camera for a selfie).
  Future<KycPicked?> camera({required bool selfie});

  /// A file: JPEG, PNG, HEIC / HEIF, and PDF where `allowPdf` (web ACCEPT).
  Future<KycPicked?> file({required bool allowPdf});
}

/// MIME type from a file name (the web's `file.type`).
String kycMimeOf(String name) => switch (name.split('.').last.toLowerCase()) {
  'jpg' || 'jpeg' => 'image/jpeg',
  'png' => 'image/png',
  'webp' => 'image/webp',
  'heic' => 'image/heic',
  'heif' => 'image/heif',
  'pdf' => 'application/pdf',
  _ => 'application/octet-stream',
};

/// The device picker: image_picker for the camera (system camera app, JPEG ~92 %, at most 2560 px like a sharp
/// 1080p+ frame), file_picker for files.
class DeviceKycPicker implements KycPicker {
  const DeviceKycPicker();

  @override
  Future<KycPicked?> camera({required bool selfie}) async {
    try {
      final x = await ImagePicker().pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: selfie ? CameraDevice.front : CameraDevice.rear,
        imageQuality: 92,
        maxWidth: 2560,
        maxHeight: 2560,
        requestFullMetadata: false,
      );
      if (x == null) return null;
      final bytes = await x.readAsBytes();
      final name = x.name.isEmpty ? '${selfie ? 'selfie' : 'document'}-${DateTime.now().millisecondsSinceEpoch}.jpg' : x.name;
      return KycPicked(bytes: bytes, name: name, mime: x.mimeType ?? kycMimeOf(name), origin: 'camera');
    } on PlatformException catch (e) {
      throw KycCameraUnavailable(blocked: e.code.contains('denied') || e.code.contains('access'));
    }
  }

  @override
  Future<KycPicked?> file({required bool allowPdf}) async {
    final picked = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', if (allowPdf) 'pdf']);
    if (picked == null) return null;
    final bytes = await picked.readAsBytes();
    final name = picked.name.isEmpty ? 'document' : picked.name;
    return KycPicked(bytes: bytes, name: name, mime: kycMimeOf(name), origin: 'file');
  }
}

/// The picker in use: the device's, or one a test or preview set with `use` (web: the file input / camera view).
class KycPickerController extends Notifier<KycPicker> {
  @override
  KycPicker build() => const DeviceKycPicker();

  /// Replaces the picker (tests feed bytes this way).
  void use(KycPicker picker) => state = picker;
}

final kycPickerProvider = NotifierProvider<KycPickerController, KycPicker>(KycPickerController.new);

/// The upload's multipart body, field for field the web's FormData.
FormData kycUploadForm(KycSlot slot, Uint8List bytes, {required String name, required String mime, ClientChecks? checks, String? issueDate, String? docType}) {
  final form = FormData();
  form.files.add(MapEntry('file', MultipartFile.fromBytes(bytes, filename: name, contentType: DioMediaType.parse(mime))));
  form.fields.addAll([
    MapEntry('kind', slot.kind),
    MapEntry('side', slot.side),
    if (slot.party != null && slot.party!.isNotEmpty) MapEntry('party', slot.party!),
    if (issueDate != null && issueDate.isNotEmpty) MapEntry('issue_date', issueDate),
    if (docType != null && docType.isNotEmpty) MapEntry('doc_type', docType),
    if (checks != null) MapEntry('checks', jsonEncode(checks.toJson())),
  ]);
  return form;
}

/// `POST kyc/documents` -> the case's new state (`{status, document, state}`).
Future<KycState> uploadKycDocument(
  ApiClient api,
  KycSlot slot,
  Uint8List bytes, {
  required String name,
  required String mime,
  ClientChecks? checks,
  String? issueDate,
  String? docType,
}) async {
  final form = kycUploadForm(slot, bytes, name: name, mime: mime, checks: checks, issueDate: issueDate, docType: docType);
  final r = await api.upload<Map<String, dynamic>>('kyc/documents', data: form, contentType: 'multipart/form-data');
  return KycState.fromJson(r['state'] is Map ? (r['state'] as Map).cast<String, dynamic>() : const {});
}

/// Photos the client took or chose in this app session, by slot (web `previews`; kept in memory only, never
/// uploaded anywhere else).
final Map<String, ({Uint8List bytes, String mime})> kycPreviews = {};
