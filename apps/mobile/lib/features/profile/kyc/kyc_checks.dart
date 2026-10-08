// Instant on-device quality checks before anything is uploaded: a port of the web's components/verification/
// checks.ts. One down-scaled grayscale pass (≤ 800 px): sharpness from the variance of the Laplacian, glare from
// clipped highlights, lighting from mean luminance, framing from where the edges are, a text-band heuristic for the
// passport's two machine-readable lines, and face presence. The browser's FaceDetector has no equivalent here, so
// the selfie uses the web's own fallback (faceDetectorAvailable() false): the brightness / contrast heuristic inside
// the oval. Results travel with the upload (`checks`) so the reviewer sees what the client saw; the gateway
// re-checks type, size and resolution on its side.
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import '../../../i18n/i18n.dart';

/// What the image is for (web Purpose).
enum KycPurpose { id, poa, selfie, doc }

/// Minimum short side in pixels (web MIN_SIDE).
const Map<KycPurpose, int> kMinSide = {KycPurpose.id: 600, KycPurpose.poa: 600, KycPurpose.doc: 600, KycPurpose.selfie: 480};

/// Analysis size (web ANALYSIS_MAX).
const int kAnalysisMax = 800;

/// A grayscale image (web Gray).
class Gray {
  const Gray(this.g, this.w, this.h);
  final Float32List g;
  final int w, h;
}

/// Luma of RGBA bytes (0.299 R + 0.587 G + 0.114 B).
Gray grayFromRgba(Uint8List rgba, int w, int h) {
  final g = Float32List(w * h);
  for (var i = 0, j = 0; i < g.length; i++, j += 4) {
    g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  }
  return Gray(g, w, h);
}

/// The analysis size of a `sw` × `sh` image: at most 800 px on the long side, at least 8 (web gray()).
(int w, int h) analysisSize(int sw, int sh, [int max = kAnalysisMax]) {
  final scale = math.min(1.0, max / math.max(sw, sh));
  return (math.max(8, (sw * scale).round()), math.max(8, (sh * scale).round()));
}

/// Variance of the 4-neighbour Laplacian (higher = sharper) and the Laplacian magnitude map.
({double variance, Float32List lap}) laplacian(Gray gi) {
  final g = gi.g, w = gi.w, h = gi.h;
  final lap = Float32List(w * h);
  var sum = 0.0, sq = 0.0;
  var n = 0;
  for (var y = 1; y < h - 1; y++) {
    for (var x = 1; x < w - 1; x++) {
      final i = y * w + x;
      final v = g[i - w] + g[i + w] + g[i - 1] + g[i + 1] - 4 * g[i];
      lap[i] = v.abs();
      sum += v;
      sq += v * v;
      n++;
    }
  }
  final mean = sum / math.max(1, n);
  return (variance: sq / math.max(1, n) - mean * mean, lap: lap);
}

/// Mean luminance and the share of clipped highlights (≥ 250).
({double mean, double clipped}) grayStats(Float32List g) {
  var sum = 0.0;
  var clipped = 0;
  for (var i = 0; i < g.length; i++) {
    sum += g[i];
    if (g[i] >= 250) clipped++;
  }
  return (mean: sum / g.length, clipped: clipped / g.length);
}

/// Bounding box that holds the central 94 % of edge pixels, as a fraction of the image area.
double fillRatio(Float32List lap, int w, int h) {
  final cols = Float64List(w);
  final rows = Float64List(h);
  var total = 0;
  for (var y = 1; y < h - 1; y++) {
    for (var x = 1; x < w - 1; x++) {
      if (lap[y * w + x] > 24) {
        cols[x]++;
        rows[y]++;
        total++;
      }
    }
  }
  if (total < 50) return 0;
  double bounds(Float64List arr) {
    var acc = 0.0;
    var lo = 0;
    var hi = arr.length - 1;
    for (var i = 0; i < arr.length; i++) {
      acc += arr[i];
      if (acc >= total * 0.03) {
        lo = i;
        break;
      }
    }
    acc = 0;
    for (var i = arr.length - 1; i >= 0; i--) {
      acc += arr[i];
      if (acc >= total * 0.03) {
        hi = i;
        break;
      }
    }
    return math.max(0, hi - lo) / arr.length;
  }

  return bounds(cols) * bounds(rows);
}

/// Passport MRZ heuristic: in the bottom third, rows with many sharp horizontal transitions are "text rows"; two bands
/// of them spanning most of the width look like the two machine-readable lines.
int mrzLines(Gray gi) {
  final g = gi.g, w = gi.w, h = gi.h;
  final start = (h * 0.62).floor();
  final textRow = <bool>[];
  for (var y = start; y < h; y++) {
    var transitions = 0;
    var first = -1, last = -1;
    for (var x = 1; x < w; x++) {
      if ((g[y * w + x] - g[y * w + x - 1]).abs() > 38) {
        transitions++;
        if (first < 0) first = x;
        last = x;
      }
    }
    textRow.add(transitions > w * 0.08 && last - first > w * 0.55);
  }
  var bands = 0, run = 0, gap = 0;
  for (final t in textRow) {
    if (t) {
      run++;
      gap = 0;
    } else if (run > 0 && ++gap > 1) {
      if (run >= 2) bands++;
      run = 0;
      gap = 0;
    }
  }
  if (run >= 2) bands++;
  return bands;
}

/// The face check (web detectFace without a FaceDetector): the oval holds a well-lit, textured subject that stands
/// out from the background.
FaceCheck faceHeuristic(Gray gi) {
  final g = gi.g, w = gi.w, h = gi.h;
  final cx = w / 2, cy = h / 2;
  final rx = w * 0.26, ry = h * 0.36;
  var inSum = 0.0, inSq = 0.0, outSum = 0.0;
  var inN = 0, outN = 0;
  for (var y = 0; y < h; y += 2) {
    for (var x = 0; x < w; x += 2) {
      final v = g[y * w + x];
      final d = math.pow((x - cx) / rx, 2) + math.pow((y - cy) / ry, 2);
      if (d <= 1) {
        inSum += v;
        inSq += v * v;
        inN++;
      } else if (d > 1.4) {
        outSum += v;
        outN++;
      }
    }
  }
  final mean = inSum / math.max(1, inN);
  final sd = math.sqrt(math.max(0, inSq / math.max(1, inN) - mean * mean));
  final contrastWithBg = (mean - outSum / math.max(1, outN)).abs();
  return FaceCheck(found: mean > 55 && mean < 225 && sd > 16 && contrastWithBg > 4, method: 'heuristic', centered: true);
}

class FaceCheck {
  const FaceCheck({required this.found, required this.method, this.centered});
  final bool found;

  /// face_detector | heuristic
  final String method;
  final bool? centered;

  Map<String, Object?> toJson() => {'found': found, 'method': method, 'centered': ?centered};
}

/// Results of the instant checks (web ClientChecks), stored with the upload for the reviewer.
class ClientChecks {
  ClientChecks({
    required this.source,
    this.width,
    this.height,
    this.blurScore,
    this.blurOk,
    this.glarePct,
    this.glareOk,
    this.brightnessMean,
    this.brightnessOk,
    this.resolutionOk,
    this.resolutionMin,
    this.fillRatio,
    this.fillOk,
    this.mrzFound,
    this.mrzLines,
    this.face,
    this.issueDate,
    this.issueAgeDays,
    this.issueOk,
    this.skipped,
  });

  /// camera | file
  final String source;
  final int? width, height;
  final double? blurScore;
  final bool? blurOk;
  final double? glarePct;
  final bool? glareOk;
  final int? brightnessMean;
  final bool? brightnessOk;
  final bool? resolutionOk;
  final int? resolutionMin;
  final double? fillRatio;
  final bool? fillOk;
  final bool? mrzFound;
  final int? mrzLines;
  final FaceCheck? face;
  String? issueDate;
  int? issueAgeDays;
  bool? issueOk;

  /// English, for the reviewer (translated only for display): one of [kSkipped].
  String? skipped;

  Map<String, Object?> toJson() => {
    'source': source,
    'width': ?width,
    'height': ?height,
    if (blurScore != null) 'blur': {'score': blurScore, 'ok': blurOk},
    if (glarePct != null) 'glare': {'pct': glarePct, 'ok': glareOk},
    if (brightnessMean != null) 'brightness': {'mean': brightnessMean, 'ok': brightnessOk},
    if (resolutionOk != null) 'resolution': {'ok': resolutionOk, 'min': resolutionMin},
    if (fillRatio != null) 'fill': {'ratio': fillRatio, 'ok': fillOk},
    if (mrzFound != null) 'mrz': {'found': mrzFound, 'lines': mrzLines},
    if (face != null) 'face': face!.toJson(),
    if (issueDate != null) 'issue_date': {'date': issueDate, 'age_days': issueAgeDays, 'ok': issueOk},
    'skipped': ?skipped,
  };

  /// Adds the proof of address's issue date check (≤ 92 days old, not in the future).
  void withIssueDate(String iso, [DateTime? now]) {
    final age = ageDays(iso, now);
    issueDate = iso;
    issueAgeDays = age;
    issueOk = age <= 92 && age >= 0;
  }
}

double _round(double v, int decimals) {
  final f = math.pow(10, decimals);
  return (v * f).round() / f;
}

/// Full check of a decoded image (natural size sw × sh, analysed as `gi`): web analyze().
ClientChecks analyzeGray(Gray gi, int sw, int sh, KycPurpose purpose, {bool passport = false, required String origin}) {
  final lap = laplacian(gi);
  final s = grayStats(gi.g);
  final min = kMinSide[purpose]!;
  final blurMin = purpose == KycPurpose.selfie ? 18 : 55;
  final paper = purpose == KycPurpose.id || purpose == KycPurpose.selfie;
  final fill = purpose != KycPurpose.selfie ? fillRatio(lap.lap, gi.w, gi.h) : null;
  final mrz = purpose == KycPurpose.id && passport ? mrzLines(gi) : null;
  return ClientChecks(
    source: origin,
    width: sw,
    height: sh,
    resolutionOk: math.min(sw, sh) >= min,
    resolutionMin: min,
    blurScore: _round(lap.variance, 1),
    blurOk: lap.variance >= blurMin,
    brightnessMean: s.mean.round(),
    brightnessOk: s.mean >= 55 && s.mean <= 235,
    // paper documents are white by nature; glare is only judged on cards and faces
    glarePct: paper ? _round(s.clipped * 100, 1) : null,
    glareOk: paper ? s.clipped < 0.06 : null,
    fillRatio: fill == null ? null : _round(fill, 2),
    fillOk: fill == null ? null : fill >= 0.35,
    mrzFound: mrz == null ? null : mrz >= 2,
    mrzLines: mrz,
    face: purpose == KycPurpose.selfie ? faceHeuristic(gi) : null,
  );
}

/// Decodes an image (JPEG / PNG / WebP …) at the analysis size with dart:ui and checks it. Null when the format can't
/// be decoded on this phone (the web's `decode()` returning null: checked by the team after upload).
Future<ClientChecks?> analyzeImage(Uint8List bytes, KycPurpose purpose, {bool passport = false, required String origin}) async {
  ui.ImmutableBuffer? buffer;
  ui.ImageDescriptor? desc;
  ui.Codec? codec;
  ui.Image? image;
  try {
    buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    desc = await ui.ImageDescriptor.encoded(buffer);
    final sw = desc.width, sh = desc.height;
    final (w, h) = analysisSize(sw, sh);
    codec = await desc.instantiateCodec(targetWidth: w, targetHeight: h);
    image = (await codec.getNextFrame()).image;
    final data = await image.toByteData();
    if (data == null) return null;
    final gi = grayFromRgba(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes), image.width, image.height);
    return analyzeGray(gi, sw, sh, purpose, passport: passport, origin: origin);
  } catch (_) {
    return null;
  } finally {
    image?.dispose();
    codec?.dispose();
    desc?.dispose();
    buffer?.dispose();
  }
}

/// Days between an ISO date (yyyy-mm-dd) and today (local), negative for future dates (web ageDays).
int ageDays(String iso, [DateTime? now]) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(iso);
  if (m == null) return 0;
  final d = DateTime(int.parse(m.group(1)!), int.parse(m.group(2)!), int.parse(m.group(3)!));
  final n = now ?? DateTime.now();
  final today = DateTime(n.year, n.month, n.day);
  return (today.difference(d).inHours / 24).round();
}

/// `skipped` texts (stored in English for the reviewer) and their display keys (web SKIPPED_KEYS).
const Map<String, String> kSkipped = {
  'This image format is checked by our team after upload.': 'kyc.check.skipped.format',
  'PDF documents are checked by our team after upload.': 'kyc.check.skipped.pdf',
  'HEIC photos are checked by our team after upload.': 'kyc.check.skipped.heic',
};

const String kSkippedFormat = 'This image format is checked by our team after upload.';
const String kSkippedPdf = 'PDF documents are checked by our team after upload.';
const String kSkippedHeic = 'HEIC photos are checked by our team after upload.';

enum CheckState { ok, warn, fail, info }

/// One human line of a check result (web CheckRow).
class CheckRow {
  const CheckRow(this.key, this.label, this.state, this.detail);
  final String key, label, detail;
  final CheckState state;
}

/// Human rows for a check result, shown at once before the upload; a `fail` blocks it (web checkRows).
List<CheckRow> checkRows(ClientChecks c, KycPurpose purpose, T t, {bool passport = false}) {
  final rows = <CheckRow>[];
  if (c.skipped != null) {
    final sk = kSkipped[c.skipped];
    rows.add(CheckRow('skipped', t('kyc.check.quality'), CheckState.info, sk != null ? t(sk) : c.skipped!));
    return rows;
  }
  if (c.resolutionOk != null) {
    rows.add(
      CheckRow(
        'resolution',
        t('kyc.check.resolution'),
        c.resolutionOk! ? CheckState.ok : CheckState.fail,
        c.resolutionOk! ? '${c.width} × ${c.height} px' : t('kyc.check.resolutionLow', {'px': math.min(c.width ?? 0, c.height ?? 0)}),
      ),
    );
  }
  if (c.blurOk != null) {
    rows.add(CheckRow('blur', t('kyc.check.sharpness'), c.blurOk! ? CheckState.ok : CheckState.warn, c.blurOk! ? t('kyc.check.sharp') : t('kyc.check.blurry')));
  }
  if (c.glareOk != null) {
    rows.add(
      CheckRow('glare', t('kyc.check.glare'), c.glareOk! ? CheckState.ok : CheckState.warn, c.glareOk! ? t('kyc.check.noGlare') : t('kyc.check.glareFound')),
    );
  }
  if (c.brightnessOk != null) {
    rows.add(
      CheckRow(
        'brightness',
        t('kyc.check.lighting'),
        c.brightnessOk! ? CheckState.ok : CheckState.warn,
        c.brightnessOk! ? t('kyc.check.wellLit') : ((c.brightnessMean ?? 0) < 55 ? t('kyc.check.tooDark') : t('kyc.check.overExposed')),
      ),
    );
  }
  if (c.fillOk != null) {
    rows.add(
      CheckRow('fill', t('kyc.check.framing'), c.fillOk! ? CheckState.ok : CheckState.warn, c.fillOk! ? t('kyc.check.fills') : t('kyc.check.moveCloser')),
    );
  }
  if (purpose == KycPurpose.id && passport && c.mrzFound != null) {
    rows.add(
      CheckRow('mrz', t('kyc.check.mrz'), c.mrzFound! ? CheckState.ok : CheckState.warn, c.mrzFound! ? t('kyc.check.mrzOk') : t('kyc.check.mrzMissing')),
    );
  }
  if (c.face != null) {
    rows.add(
      CheckRow(
        'face',
        t('kyc.check.face'),
        c.face!.found ? CheckState.ok : CheckState.warn,
        c.face!.found ? (c.face!.method == 'face_detector' ? t('kyc.check.faceDetected') : t('kyc.check.faceInOval')) : t('kyc.check.faceMissing'),
      ),
    );
  }
  if (c.issueOk != null) {
    rows.add(
      CheckRow(
        'issue_date',
        t('kyc.check.issueDate'),
        c.issueOk! ? CheckState.ok : CheckState.fail,
        c.issueOk! ? t('kyc.check.issuedDaysAgo', {'count': c.issueAgeDays ?? 0}) : t('kyc.check.issueTooOld'),
      ),
    );
  }
  return rows;
}
