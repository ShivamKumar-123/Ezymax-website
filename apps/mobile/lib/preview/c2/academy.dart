// Sample answers for the academy screens (previews and widget tests only; shapes of the real API, services/academy
// via the Client Area BFF). Return null for paths this module doesn't own.
//
// The sample learner: phase 1 complete and certified, phase 2 at 9 of 14 chapters (reading "Stop loss, take profit and
// trailing stops"), the FX Options elective complete with its exam unlocked (one attempt at 63 %), a 4-day streak.
// Quizzes and exams are graded here from the real answer keys; a passed exam issues a certificate.

(int, Object)? previewAcademy(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (!path.startsWith('academy/')) return null;
  final parts = path.split('/').sublist(1);
  final get = method == 'GET';
  if (get && parts.length == 1 && parts[0] == 'catalog') return (200, _catalog());
  if (get && parts.length == 1 && parts[0] == 'glossary') return (200, _glossary());
  if (get && parts.length == 2 && parts[0] == 'me' && parts[1] == 'certificates') return (200, {'certificates': _myCertificates()});
  if (parts.length >= 2 && parts[0] == 'chapters') {
    final slug = parts[1];
    final found = _locate(slug);
    if (found == null) return _notFound('Chapter');
    if (get && parts.length == 2) return (200, _chapterView(found));
    if (!get && parts.length == 3 && parts[2] == 'progress') {
      final pct = (body['read_pct'] as num?)?.round().clamp(0, 100) ?? 0;
      return (200, {'progress': _progress(slug, readOverride: pct)});
    }
    if (!get && parts.length == 3 && parts[2] == 'quiz') return _quiz(found, body);
  }
  if (parts.length == 2 && parts[0] == 'exams') {
    final phase = _phases.where((p) => p['slug'] == parts[1]).firstOrNull;
    if (phase == null) return _notFound('Phase');
    return get ? (200, _examView(phase)) : _exam(phase, body);
  }
  if (get && parts.length >= 2 && parts[0] == 'certificates') {
    final code = parts[1];
    if (!RegExp(r'^KA-[A-Z0-9]{5}-[A-Z0-9]{5}$').hasMatch(code)) return _notFound('Certificate');
    if (parts.length == 3 && parts[2] == 'image') return (200, _certificateSvg(code));
    return (200, {..._myCertificates().first, 'revoked': false});
  }
  return _notFound('Page');
}

(int, Object) _notFound(String what) => (
  404,
  {
    'error': {'code': 'not_found', 'message': '$what not found.'},
  },
);

/* ------------------------------------------------------------------ the learner */

const String _certCode = 'KA-7Q2MD-XK9PF';
const String _certIssued = '2026-09-12T10:24:00Z';
const String _continueSlug = 'p2-t-stop-loss-take-profit-trailing';

/// Chapters complete: all of phase 1 and phase 9, the fundamental track and two technical chapters of phase 2.
bool _completed(Map<String, Object?> phase, Map<String, Object?> section, int index) {
  switch (phase['slug']) {
    case 'phase-1':
    case 'phase-9':
      return true;
    case 'phase-2':
      return section['track'] == 'fundamental' || index < 2;
  }
  return false;
}

typedef _Found = ({Map<String, Object?> phase, Map<String, Object?> section, Map<String, Object?> chapter, int index});

List<Map<String, Object?>> _sectionsOf(Map<String, Object?> p) => (p['sections'] as List).cast<Map<String, Object?>>();
List<Map<String, Object?>> _chaptersOf(Map<String, Object?> s) => (s['chapters'] as List).cast<Map<String, Object?>>();

_Found? _locate(String slug) {
  for (final p in _phases) {
    for (final s in _sectionsOf(p)) {
      final cs = _chaptersOf(s);
      for (var i = 0; i < cs.length; i++) {
        if (cs[i]['slug'] == slug) return (phase: p, section: s, chapter: cs[i], index: i);
      }
    }
  }
  return null;
}

Map<String, Object?> _progress(String slug, {int? readOverride}) {
  final f = _locate(slug);
  if (f == null) return {'read_pct': 0, 'quiz_best': null, 'quiz_total': null, 'completed': false, 'completed_at': null};
  final total = (f.chapter['questions'] as int?) ?? 0;
  if (_completed(f.phase, f.section, f.index)) {
    // full marks on most chapters, one wrong answer on every third
    final best = f.index % 3 == 2 ? total - 1 : total;
    final day = DateTime.utc(2026, 9).add(Duration(days: (f.phase['order'] as int) * 3 + f.index));
    return {'read_pct': readOverride ?? 100, 'quiz_best': best, 'quiz_total': total, 'completed': true, 'completed_at': day.toIso8601String()};
  }
  final read = slug == _continueSlug ? 40 : 0;
  return {'read_pct': readOverride ?? read, 'quiz_best': null, 'quiz_total': null, 'completed': false, 'completed_at': null};
}

String _day(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/* ------------------------------------------------------------------ catalog */

Map<String, Object?> _catalog() {
  var doneAll = 0, totalAll = 0, minDone = 0, minAll = 0;
  final quiz = <double>[];
  final phases = <Map<String, Object?>>[];
  for (final p in _phases) {
    var done = 0, total = 0, minutes = 0;
    final sections = <Map<String, Object?>>[];
    for (final s in _sectionsOf(p)) {
      final chapters = <Map<String, Object?>>[];
      for (final c in _chaptersOf(s)) {
        final pr = _progress(c['slug']! as String);
        final m = c['minutes']! as int;
        total++;
        minutes += m;
        if (pr['completed'] == true) {
          done++;
          minDone += m;
          quiz.add((pr['quiz_best']! as int) * 100 / (pr['quiz_total']! as int));
        }
        chapters.add({...c, 'progress': pr});
      }
      sections.add({...s, 'chapters': chapters});
    }
    doneAll += done;
    totalAll += total;
    minAll += minutes;
    final ex = _exams[p['slug']];
    final ap = _attempts[p['slug']] ?? const [];
    phases.add({
      'slug': p['slug'],
      'order': p['order'],
      'title': p['title'],
      'level': p['level'],
      'summary': p['summary'],
      'elective': p['elective'],
      'minutes': minutes,
      'progress': {'done': done, 'total': total},
      'sections': sections,
      'exam': ex == null
          ? null
          : {
              'questions': ex['count'],
              'pass_mark': ex['pass_mark'],
              'unlocked': done == total && total > 0,
              'best_pct': ap.isEmpty ? null : ap.map((a) => a.pct).reduce((a, b) => a > b ? a : b),
              'passed': ap.any((a) => a.passed),
              'attempts': ap.length,
            },
      'certificate': p['slug'] == 'phase-1' ? {'code': _certCode, 'issued_at': _certIssued} : null,
    });
  }
  final today = DateTime.now().toUtc();
  final c = _locate(_continueSlug)!;
  return {
    'lang': 'en',
    'phases': phases,
    'me': {
      'chapters_done': doneAll,
      'chapters_total': totalAll,
      'minutes_done': minDone,
      'minutes_total': minAll,
      'quiz_avg': quiz.isEmpty ? null : (quiz.reduce((a, b) => a + b) / quiz.length).round(),
      'certificates': 1,
      'streak': 4,
      'active_days': [
        for (final d in const [5, 3, 2, 1, 0]) _day(today.subtract(Duration(days: d))),
      ],
      'continue': {
        'slug': _continueSlug,
        'title': c.chapter['title'],
        'minutes': c.chapter['minutes'],
        'phase': {'slug': c.phase['slug'], 'order': c.phase['order'], 'title': c.phase['title']},
        'read_pct': 40,
        'started': true,
      },
    },
  };
}

/* ------------------------------------------------------------------ chapters */

/// A chapter without its full text in the sample: its summary, a note and a short quiz.
Map<String, Object?> _fallbackBody(Map<String, Object?> c) => {
  'body':
      '${c['summary']}\n\n## In this chapter\n\nThis sample shows the chapter outline only. Open *Pips, points and pip value* or '
      '*Stop loss, take profit and trailing stops* for complete chapters with tables, diagrams and callouts.\n\n'
      '> **Note:** Every chapter ends with a short quiz. Score 60% or more to complete it.',
  'takeaways': <String>[],
  'practice': null,
  'words': 60,
  'quiz': (_bodies['p2-f-pips-and-points']!['quiz']! as List).take(2).toList(),
};

Map<String, Object?> _content(String slug, Map<String, Object?> c) => _bodies[slug] ?? _fallbackBody(c);

List<Map<String, Object?>> _publicQuiz(List<Object?> qs) => [
  for (final q in qs.cast<Map<String, Object?>>()) {'question': q['question'], 'options': q['options']},
];

Map<String, Object?> _chapterView(_Found f) {
  final slug = f.chapter['slug']! as String;
  final body = _content(slug, f.chapter);
  final flat = [
    for (final p in _phases)
      for (final s in _sectionsOf(p)) ..._chaptersOf(s),
  ];
  final idx = flat.indexWhere((c) => c['slug'] == slug);
  Map<String, Object?>? nav(int i) => i < 0 || i >= flat.length ? null : {'slug': flat[i]['slug'], 'title': flat[i]['title']};
  final cs = _chaptersOf(f.section);
  return {
    'chapter': {
      'slug': slug,
      'title': f.chapter['title'],
      'summary': f.chapter['summary'],
      'body': body['body'],
      'takeaways': body['takeaways'],
      'practice': body['practice'],
      'minutes': f.chapter['minutes'],
      'words': body['words'],
      'quiz': _publicQuiz(body['quiz']! as List),
      'updated_at': '2026-09-01T08:00:00Z',
      'lang': 'en',
    },
    'phase': {'slug': f.phase['slug'], 'order': f.phase['order'], 'title': f.phase['title'], 'level': f.phase['level'], 'elective': f.phase['elective']},
    'section': {
      'slug': f.section['slug'],
      'track': f.section['track'],
      'title': f.section['title'],
      'index': f.index + 1,
      'count': cs.length,
      'chapters': [
        for (var i = 0; i < cs.length; i++) {'slug': cs[i]['slug'], 'title': cs[i]['title'], 'completed': _completed(f.phase, f.section, i)},
      ],
    },
    'prev': nav(idx - 1),
    'next': nav(idx + 1),
    'progress': _progress(slug),
  };
}

/// Grades `answers` against `qs` (the service's grade()).
(List<Map<String, Object?>>, int, bool) _grade(List<Map<String, Object?>> qs, List<Object?> answers) {
  final results = <Map<String, Object?>>[];
  var score = 0;
  var all = true;
  for (var i = 0; i < qs.length; i++) {
    final a = i < answers.length ? (answers[i] as num?)?.toInt() : null;
    final options = (qs[i]['options']! as List).length;
    if (a != null && a >= 0 && a < options) {
      final ok = a == qs[i]['answer'];
      if (ok) score++;
      results.add({'index': i, 'choice': a, 'correct': ok, 'answer': qs[i]['answer'], 'explanation': qs[i]['explanation']});
    } else {
      all = false;
    }
  }
  return (results, score, all);
}

(int, Object) _quiz(_Found f, Map<String, dynamic> body) {
  final slug = f.chapter['slug']! as String;
  final qs = (_content(slug, f.chapter)['quiz']! as List).cast<Map<String, Object?>>();
  final answers = (body['answers'] as List?) ?? const [];
  final (results, score, all) = _grade(qs, answers);
  final passed = all && score * 100 >= 60 * qs.length;
  final before = _completed(f.phase, f.section, f.index);
  var done = 0, total = 0;
  for (final s in _sectionsOf(f.phase)) {
    final cs = _chaptersOf(s);
    for (var i = 0; i < cs.length; i++) {
      total++;
      if (_completed(f.phase, s, i) || (passed && cs[i]['slug'] == slug)) done++;
    }
  }
  return (
    200,
    {
      'results': results,
      'answered': results.length,
      'score': score,
      'total': qs.length,
      'all_answered': all,
      'passed': passed,
      'pass_pct': 60,
      'completed': before || passed,
      'completed_now': passed && !before,
      'phase': {'slug': f.phase['slug'], 'done': done, 'total': total, 'exam_unlocked': done == total},
    },
  );
}

/* ------------------------------------------------------------------ exams and certificates */

const Map<String, List<({int pct, bool passed, String at})>> _attempts = {
  'phase-1': [(pct: 87, passed: true, at: _certIssued)],
  'phase-9': [(pct: 63, passed: false, at: '2026-10-02T17:40:00Z')],
};

List<Map<String, Object?>> _examQuestions(Map<String, Object?> phase) {
  final ex = _exams[phase['slug']]!;
  final qs = ex['questions'] as List?;
  if (qs != null) return qs.cast<Map<String, Object?>>();
  // locked in the sample: only the count matters
  return [
    for (var i = 0; i < (ex['count']! as int); i++)
      {
        'question': 'Question ${i + 1}',
        'options': ['A', 'B', 'C', 'D'],
        'answer': 0,
        'explanation': '',
      },
  ];
}

Map<String, Object?> _examView(Map<String, Object?> phase) {
  final cat = _catalog();
  final p = (cat['phases']! as List).cast<Map<String, Object?>>().firstWhere((x) => x['slug'] == phase['slug']);
  final pr = p['progress']! as Map<String, Object?>;
  final ex = _exams[phase['slug']]!;
  final qs = _examQuestions(phase);
  return {
    'phase': {'slug': phase['slug'], 'order': phase['order'], 'title': phase['title'], 'level': phase['level'], 'elective': phase['elective']},
    'exam': {'pass_mark': ex['pass_mark'], 'questions': _publicQuiz(qs), 'count': qs.length},
    'unlocked': pr['done'] == pr['total'],
    'chapters_done': pr['done'],
    'chapters_total': pr['total'],
    'attempts': [
      for (final a in _attempts[phase['slug']] ?? const <({int pct, bool passed, String at})>[]) {'pct': a.pct, 'passed': a.passed, 'at': a.at},
    ],
    'certificate': phase['slug'] == 'phase-1' ? {'code': _certCode, 'issued_at': _certIssued, 'score_pct': 87} : null,
  };
}

(int, Object) _exam(Map<String, Object?> phase, Map<String, dynamic> body) {
  final view = _examView(phase);
  if (view['unlocked'] != true) {
    return (
      403,
      {
        'error': {'code': 'locked', 'message': 'Complete every chapter of this phase first.'},
      },
    );
  }
  final qs = _examQuestions(phase);
  final passMark = _exams[phase['slug']]!['pass_mark']! as int;
  final (results, score, all) = _grade(qs, (body['answers'] as List?) ?? const []);
  if (!all) {
    return (
      400,
      {
        'error': {'code': 'bad_request', 'message': 'Answer every question.'},
      },
    );
  }
  final pct = qs.isEmpty ? 0 : (score * 100 / qs.length).round();
  final passed = pct >= passMark;
  final had = view['certificate'] as Map<String, Object?>?;
  final issued = passed && had == null;
  final code = phase['slug'] == 'phase-1' ? _certCode : 'KA-P${phase['order']}XQZ-PRVW2';
  return (
    200,
    {
      'score': score,
      'total': qs.length,
      'pct': pct,
      'pass_mark': passMark,
      'passed': passed,
      'results': results,
      'certificate': had ?? (passed ? {'code': code, 'issued_at': DateTime.now().toUtc().toIso8601String(), 'score_pct': pct} : null),
      'certificate_issued': issued,
    },
  );
}

List<Map<String, Object?>> _myCertificates() => [
  {
    'code': _certCode,
    'phase': 'phase-1',
    'phase_order': 1,
    'phase_title': _phases.first['title'],
    'level': _phases.first['level'],
    'score_pct': 87,
    'issued_at': _certIssued,
    'learner_name': 'Arjun Mehta',
    'verify_url': 'https://app.kalkstrade.com/certificate/$_certCode',
  },
];

/// The service's certificate image (services/academy/src/cert.rs), for the sample learner.
String _certificateSvg(String code) {
  // the sample certificate is phase 1's; one issued in the preview is shown as the FX Options elective's
  final first = code == _certCode;
  final level = first ? 'Beginner' : 'Intermediate';
  final title = first ? 'Phase 1 · Markets and instruments' : 'Phase 9 · Kalks FX Options';
  final tracks = first ? 'Fundamental and technical analysis tracks' : 'Options trading track';
  final score = first ? 87 : 81;
  final issued = first ? '12 Sep 2026' : '8 Oct 2026';
  return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1131" width="1600" height="1131" font-family="Inter, 'Helvetica Neue', Arial, sans-serif">
  <rect width="1600" height="1131" fill="#0b0b0e"/>
  <rect x="36" y="36" width="1528" height="1059" rx="28" fill="#111115" stroke="#2a2a33" stroke-width="2"/>
  <rect x="36" y="36" width="1528" height="10" rx="5" fill="#ff5a1f"/>
  <g fill="none" stroke="#1d1d24" stroke-width="1">
    <path d="M1180 1095 L1564 711"/><path d="M1260 1095 L1564 791"/><path d="M1340 1095 L1564 871"/><path d="M1420 1095 L1564 951"/>
  </g>
  <text x="120" y="170" font-size="30" font-weight="700" fill="#f4f4f6" letter-spacing="1">Kalks</text>
  <text x="120" y="206" font-size="20" fill="#ff5a1f" letter-spacing="6">ACADEMY</text>
  <text x="1480" y="170" text-anchor="end" font-size="18" fill="#8b8b96" letter-spacing="3">CERTIFICATE OF COMPLETION</text>
  <text x="1480" y="200" text-anchor="end" font-size="16" fill="#8b8b96">$level level</text>
  <text x="120" y="360" font-size="22" fill="#8b8b96">This certifies that</text>
  <text x="120" y="450" font-size="72" font-weight="600" fill="#f4f4f6">Arjun Mehta</text>
  <rect x="120" y="486" width="220" height="3" fill="#ff5a1f"/>
  <text x="120" y="560" font-size="22" fill="#8b8b96">has completed every chapter and passed the final exam of</text>
  <text x="120" y="630" font-size="44" font-weight="600" fill="#f4f4f6">$title</text>
  <text x="120" y="680" font-size="22" fill="#c9c9d1">$tracks · final exam score $score%</text>
  <line x1="120" y1="850" x2="1480" y2="850" stroke="#2a2a33" stroke-width="2"/>
  <text x="120" y="900" font-size="16" fill="#8b8b96" letter-spacing="2">ISSUED</text>
  <text x="120" y="935" font-size="24" fill="#f4f4f6">$issued</text>
  <text x="520" y="900" font-size="16" fill="#8b8b96" letter-spacing="2">CERTIFICATE ID</text>
  <text x="520" y="935" font-size="24" fill="#f4f4f6" font-family="'JetBrains Mono', Menlo, monospace">$code</text>
  <text x="1480" y="900" text-anchor="end" font-size="16" fill="#8b8b96" letter-spacing="2">VERIFY</text>
  <text x="1480" y="935" text-anchor="end" font-size="20" fill="#ff5a1f">app.kalkstrade.com/certificate/$code</text>
  <text x="120" y="1030" font-size="15" fill="#6b6b76">Educational certificate. It is not a financial qualification or licence. Trading CFDs on margin carries a high risk of losing money.</text>
</svg>''';
}

/* ------------------------------------------------------------------ glossary */

Map<String, Object?> _glossary() {
  final names = {for (final t in _terms) t['slug']: t['term']};
  final cats = <String, int>{};
  for (final t in _terms) {
    cats.update(t['category']! as String, (n) => n + 1, ifAbsent: () => 1);
  }
  final categories = cats.entries.map((e) => {'name': e.key, 'count': e.value}).toList()
    ..sort((a, b) => (a['name']! as String).compareTo(b['name']! as String));
  return {
    'terms': [
      for (final t in _terms)
        {
          ...t,
          'related': [
            for (final r in (t['related']! as List).cast<String>())
              if (names[r] != null) {'slug': r, 'term': names[r]},
          ],
        },
    ],
    'categories': categories,
    'total': _terms.length,
  };
}

/* ------------------------------------------------------------------ sample content */

// Generated from content/academy/en (phases, chapter cards, three full chapters, three exams, a glossary sample).
const List<Map<String, Object?>> _phases = [
  {
    'slug': 'phase-1',
    'order': 1,
    'title': 'Markets and instruments',
    'level': 'Beginner',
    'summary': 'Understand how financial markets and CFD brokers work, which instruments you can trade on Kalks and what moves their prices, and read a price chart with confidence in Kalks Trader.',
    'elective': false,
    'sections': [
      {
        'slug': 'p1-fundamental',
        'track': 'fundamental',
        'title': 'How financial markets work',
        'summary': 'Who trades, where prices come from, what a CFD is, the asset classes on Kalks and the real risks of leveraged trading.',
        'chapters': [
          {
            'slug': 'p1-f-how-financial-markets-work',
            'title': 'How financial markets work',
            'summary': 'What a market actually does, who the participants are, and why every price you see has two sides.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p1-f-fx-market-structure-sessions',
            'title': 'The FX market: structure and trading sessions',
            'summary': 'How currency pairs are quoted, how the global FX market is layered, and why the time of day changes how a pair behaves.',
            'minutes': 5,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p1-f-what-is-a-cfd',
            'title': 'What is a CFD?',
            'summary':
                'How a contract for difference lets you trade price movements in currencies, gold, indices, oil, crypto and shares without owning the asset.',
            'minutes': 5,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p1-f-asset-classes',
            'title': 'Asset classes you can trade on Kalks',
            'summary': 'Forex, metals, indices, energies, crypto and US shares: what each one represents, when it trades and how differently it behaves.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p1-f-what-moves-prices',
            'title': 'What moves prices',
            'summary': 'Supply and demand, expectations and surprises: the main forces behind price moves in currencies, gold, indices, oil and crypto.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p1-f-how-a-broker-works',
            'title': 'How a broker works',
            'summary': "Where your broker's prices come from, how orders are executed, how brokers earn money and what protects your funds.",
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p1-f-risks-of-leveraged-products',
            'title': 'The risks of leveraged products',
            'summary':
                'How leverage, gaps, volatility and your own behaviour can turn a small price move into a large loss, and what to do about it from day one.',
            'minutes': 4,
            'order': 7,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p1-technical',
        'track': 'technical',
        'title': 'Price charts from zero',
        'summary':
            'Read line, bar and candlestick charts, understand timeframes and server time, and take a first look at trend, range, volatility and volume.',
        'chapters': [
          {
            'slug': 'p1-t-reading-a-price-chart',
            'title': 'What a price chart shows: line, bar and candlestick',
            'summary': 'The two axes of every chart, how open, high, low and close are recorded, and when to use a line, bar or candlestick chart.',
            'minutes': 4,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p1-t-candlestick-anatomy',
            'title': 'Candlestick anatomy',
            'summary': 'Bodies, wicks and closing position: how to read what buyers and sellers did inside a single candle.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p1-t-timeframes-server-time',
            'title': 'Timeframes, server time and the New York close',
            'summary': 'How timeframes group price data, why Kalks server time is aligned with the New York close, and how to convert it to your own clock.',
            'minutes': 5,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p1-t-trend-vs-range',
            'title': 'Trend or range: a first look',
            'summary': 'Recognise the three basic market states, uptrend, downtrend and range, using swing highs and swing lows.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p1-t-volatility-volume-basics',
            'title': 'Volatility and volume basics',
            'summary': 'How much a market typically moves, how active it is, and why both numbers should shape your expectations and your position size.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p1-t-navigating-charts-kalks-trader',
            'title': 'Navigating charts in Kalks Trader',
            'summary': 'A practical tour of the Kalks Trader chart workspace: symbols, tabs, timeframes, chart types, tools, indicators, templates and on-chart trade lines.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-2',
    'order': 2,
    'title': 'How trading works',
    'level': 'Beginner',
    'summary': 'Understand exactly what a trade costs and what it can make or lose: pips, lots, leverage, margin, spreads, swaps and P&L, and place, manage and close orders confidently in Kalks Trader.',
    'elective': false,
    'sections': [
      {
        'slug': 'p2-fundamental',
        'track': 'fundamental',
        'title': 'The economics of a trade',
        'summary': 'Pips, lots, leverage, margin, trading costs and profit-and-loss arithmetic, worked through with real numbers.',
        'chapters': [
          {
            'slug': 'p2-f-pips-and-points',
            'title': 'Pips, points and pip value',
            'summary': 'How price movement is measured on FX, metals and indices, and how to turn a move in pips into money.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p2-f-lots-and-contract-size',
            'title': 'Lots and contract size',
            'summary':
                'What a lot really represents on each symbol, how to calculate the notional value of a position, and why that number is your true exposure.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p2-f-leverage-and-margin',
            'title': 'Leverage and margin',
            'summary': 'How margin is calculated, what leverage really changes, and why effective leverage on your equity is the number that matters.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p2-f-margin-level-and-stop-out',
            'title': 'Margin level, margin call and stop-out',
            'summary': 'Balance, equity, free margin and margin level explained, and exactly what happens as losses push an account towards stop-out.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p2-f-spreads-commissions-and-swaps',
            'title': 'Trading costs: spreads, commissions and swaps',
            'summary': 'The three costs of holding a CFD position, how to calculate each one in money, and when they tend to be highest.',
            'minutes': 4,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p2-f-profit-and-loss-maths',
            'title': 'Profit and loss maths and currency conversion',
            'summary': 'Calculate the result of any trade by hand, convert it into your account currency, and include commission and swaps to get the true net figure.',
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p2-f-account-types',
            'title': 'Account types: demo, live, standard and cent',
            'summary': 'What distinguishes demo from live, standard from cent, and how account conditions such as spreads, commission, leverage and position mode change the economics of each trade.',
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p2-technical',
        'track': 'technical',
        'title': 'Orders and execution in Kalks Trader',
        'summary': 'Market and pending orders, stops and targets, position modes, execution risk and a guided first demo trade.',
        'chapters': [
          {
            'slug': 'p2-t-market-orders',
            'title': 'Market orders: buying and selling now',
            'summary': 'How a market order is filled, which side of the quote you get, how to read the order ticket and how to close a position.',
            'minutes': 4,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p2-t-pending-orders',
            'title': 'Pending orders: limit, stop, stop-limit and expiry',
            'summary':
                'The four basic pending orders and the stop-limit, where each one sits relative to the current price, how it is triggered and when it expires.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p2-t-stop-loss-take-profit-trailing',
            'title': 'Stop loss, take profit and trailing stops',
            'summary': 'How protective stops and profit targets are triggered and filled, how to translate them into money, and how a server-side trailing stop follows the price.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p2-t-oco-and-partial-close',
            'title': 'OCO orders and partial close',
            'summary': 'Link two pending orders so that one cancels the other, and take profit on part of a position while letting the rest run.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p2-t-netting-vs-hedging',
            'title': 'Netting vs hedging accounts',
            'summary': 'How the two position modes treat new orders on the same symbol, how average prices and reversals work in netting, and how Close By works in hedging.',
            'minutes': 4,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p2-t-execution-slippage-gaps',
            'title': 'Execution, slippage, gaps and weekend risk',
            'summary': 'Why orders are sometimes filled away from the price you expected, how gaps jump over stop losses, and how to manage positions through closed markets.',
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p2-t-first-demo-trade',
            'title': 'A guided first demo trade',
            'summary': 'Plan, size, place, manage and review a complete EURUSD trade on a Kalks demo account, using everything from this phase.',
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-3',
    'order': 3,
    'title': 'Economics and price action',
    'level': 'Intermediate',
    'summary': 'Understand the economic forces that drive currencies, indices and metals, and read raw price action with confidence: structure, levels, candles and timeframes.',
    'elective': false,
    'sections': [
      {
        'slug': 'p3-fundamental',
        'track': 'fundamental',
        'title': 'Economic foundations',
        'summary': 'Central banks, interest rates, inflation, growth, jobs, fiscal policy and trade flows, and how each one moves the markets you trade.',
        'chapters': [
          {
            'slug': 'p3-f-central-banks-monetary-policy',
            'title': 'Central banks and monetary policy',
            'summary': 'What central banks are trying to achieve, the tools they use, and why their decisions move every market on your watchlist.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p3-f-interest-rates-and-currencies',
            'title': 'Interest rates and currencies',
            'summary':
                'Why rate differentials drive exchange rates, how real rates change the picture, and how the same differential shows up in your swap charges.',
            'minutes': 5,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p3-f-inflation-cpi-pce',
            'title': 'Inflation: CPI, PCE and core measures',
            'summary':
                'How inflation is measured, why core and month-on-month figures matter more than the headline, and how inflation data moves rate expectations.',
            'minutes': 5,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p3-f-growth-gdp-pmi',
            'title': 'Economic growth: GDP and PMIs',
            'summary': 'How GDP measures the size and growth of an economy, why PMIs are watched as an early signal, and how growth data feeds into rate expectations and risk appetite.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p3-f-labour-market-nfp',
            'title': 'The labour market and NFP',
            'summary': 'What the US jobs report contains, how to read payrolls, unemployment and wages together, and why the labour market matters so much to central banks.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p3-f-fiscal-policy-government-debt',
            'title': 'Fiscal policy and government debt',
            'summary':
                'How government spending, taxes, deficits and debt affect growth, bond yields and currencies, and when fiscal news becomes a market event.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p3-f-trade-and-current-account',
            'title': 'Trade, the current account and capital flows',
            'summary': "How trade balances and the current account reflect a country's relationship with the rest of the world, and why these slow-moving flows matter for currencies.",
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p3-technical',
        'track': 'technical',
        'title': 'Chart reading and price action',
        'summary':
            'Support and resistance, market structure, trendlines, candlestick patterns, breakouts, supply and demand zones and multi-timeframe reading.',
        'chapters': [
          {
            'slug': 'p3-t-support-and-resistance',
            'title': 'Support and resistance',
            'summary': 'How to find the price levels where buying or selling has repeatedly appeared, draw them as zones, and use them to plan entries, stops and targets.',
            'minutes': 4,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p3-t-market-structure',
            'title': 'Market structure: highs, lows and trend',
            'summary': 'Read trends objectively through swing highs and lows, spot a break of structure early, and tell a healthy pullback from a genuine change of trend.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p3-t-trendlines-and-channels',
            'title': 'Trendlines and channels',
            'summary': 'Draw trendlines that reflect real market behaviour, project them forward, build channels, and read what a steepening, flattening or broken line is telling you.',
            'minutes': 5,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p3-t-candlestick-patterns',
            'title': 'Candlestick patterns that matter',
            'summary': 'Read the most useful single and multi-candle patterns as evidence of who won the battle in a period, and learn why location matters more than the pattern itself.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p3-t-breakouts-and-false-breaks',
            'title': 'Breakouts and false breaks',
            'summary':
                'Tell a genuine breakout from a false one, choose between entering on the break or the retest, and turn failed breakouts into opportunities.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p3-t-supply-and-demand-zones',
            'title': 'Supply and demand zones',
            'summary': 'Identify the price areas where strong imbalances between buyers and sellers started big moves, and learn how to grade and trade them.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p3-t-multi-timeframe-basics',
            'title': 'Multi-timeframe analysis basics',
            'summary': 'Combine a higher timeframe for direction, a middle timeframe for setups and a lower timeframe for timing, so your trades line up with the bigger picture.',
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-4',
    'order': 4,
    'title': 'News and indicators',
    'level': 'Intermediate',
    'summary': 'Read the economic calendar like a professional, plan around high-impact releases and their execution risks, and apply the core technical indicators and chart patterns with correct formulas and realistic expectations.',
    'elective': false,
    'sections': [
      {
        'slug': 'p4-fundamental',
        'track': 'fundamental',
        'title': 'Economic calendar and news trading',
        'summary': 'How scheduled data and central-bank events move prices, and how to manage the spreads, slippage and gaps that come with them.',
        'chapters': [
          {
            'slug': 'p4-f-reading-the-economic-calendar',
            'title': 'Reading the economic calendar',
            'summary': 'What every column of an economic calendar means and how to turn it into a weekly plan of risk events.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p4-f-expectations-and-surprises',
            'title': 'Expectations, surprises and priced-in news',
            'summary': 'Why markets move on the difference between data and expectations, and how to size a surprise.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p4-f-central-bank-decision-days',
            'title': 'Central-bank decision days',
            'summary': 'How rate decisions, statements, projections and press conferences unfold, and why the reaction often comes in waves.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p4-f-nfp-and-cpi-playbook',
            'title': 'The NFP and CPI playbook',
            'summary': 'A structured approach to the two US releases that move the most markets: the employment report and consumer inflation.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p4-f-spreads-slippage-and-gaps',
            'title': 'Spreads, slippage and gaps around news',
            'summary': 'Why execution costs rise sharply at release time and how to calculate their real effect on a trade.',
            'minutes': 4,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p4-f-earnings-season',
            'title': 'Earnings season and stock CFDs',
            'summary': 'How quarterly company results move single stocks and indices, and how to manage the overnight gap risk they create.',
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p4-f-news-trading-risk-and-planning',
            'title': 'News-trading risk and your plan',
            'summary': 'The main ways traders approach scheduled news, the risks of each, and a checklist that turns the calendar into rules.',
            'minutes': 4,
            'order': 7,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p4-technical',
        'track': 'technical',
        'title': 'Indicators and chart patterns',
        'summary': 'Moving averages, oscillators, volatility tools, Fibonacci and classic patterns, and how to combine them without drowning in signals.',
        'chapters': [
          {
            'slug': 'p4-t-moving-averages',
            'title': 'Moving averages',
            'summary': 'How simple and exponential moving averages are calculated, what they reveal about trend, and where they fail.',
            'minutes': 4,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p4-t-rsi-and-stochastic',
            'title': 'RSI and the stochastic oscillator',
            'summary': 'How the two most popular momentum oscillators are calculated and why overbought does not mean sell.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p4-t-macd',
            'title': 'MACD',
            'summary': 'How the MACD line, signal line and histogram are built from 12, 26 and 9-period EMAs, and how to read them in context.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p4-t-bollinger-bands-and-atr',
            'title': 'Bollinger Bands and ATR',
            'summary': 'Two ways to measure volatility, and how to use them for context, stop placement and position sizing.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p4-t-fibonacci-retracements',
            'title': 'Fibonacci retracements and extensions',
            'summary': 'How to draw Fibonacci levels on a swing, calculate them by hand, and use them as zones rather than magic numbers.',
            'minutes': 4,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p4-t-classic-chart-patterns',
            'title': 'Classic chart patterns',
            'summary': 'Head and shoulders, double tops and bottoms, triangles and flags: how to identify them, where they are confirmed and how measured targets are calculated.',
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p4-t-divergence-and-combining-tools',
            'title': 'Divergence and combining tools',
            'summary': 'How to read momentum divergence correctly and how to build a small, non-redundant toolkit instead of a cluttered chart.',
            'minutes': 4,
            'order': 7,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-5',
    'order': 5,
    'title': 'Intermarket analysis and risk control',
    'level': 'Intermediate',
    'summary': 'Read how bonds, the dollar, commodities, equities, gold and oil influence one another, and size every trade so that no single loss, losing streak or cluster of correlated positions can seriously damage your account.',
    'elective': false,
    'sections': [
      {
        'slug': 'p5-fundamental',
        'track': 'fundamental',
        'title': 'Intermarket analysis',
        'summary': 'How yields, the yield curve, the US dollar, commodities, equities, gold and oil connect, and how to use those links as context for FX, metals and index trades.',
        'chapters': [
          {
            'slug': 'p5-f-bonds-and-yields',
            'title': 'Bonds and yields: the market behind every market',
            'summary': 'Why bond prices and yields move in opposite directions, what the 2-year and 10-year yields tell you, and how yield differentials drive currency pairs.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p5-f-the-yield-curve',
            'title': 'The yield curve: shape, shifts and signals',
            'summary': 'Read normal, flat and inverted curves, recognise bull and bear steepening or flattening, and understand what each shift says about policy and growth.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p5-f-us-dollar-and-dollar-index',
            'title': 'The US dollar and the dollar index',
            'summary': 'Why the dollar sits at the centre of global markets, how the dollar index is built, and how to separate a broad dollar move from a single-currency story.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p5-f-commodities-and-commodity-currencies',
            'title': 'Commodities and commodity currencies',
            'summary': 'How export prices feed into the Australian and Canadian dollars, why China matters for AUD, and how to check whether a commodity link is actually working.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p5-f-equities-and-risk-appetite',
            'title': 'Equities and risk appetite',
            'summary':
                'How stock indices act as a gauge of risk appetite, why yields move growth stocks, and which currencies tend to follow or oppose equities.',
            'minutes': 4,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p5-f-gold-and-real-yields',
            'title': 'Gold and real yields',
            'summary': 'Why gold has historically moved inversely to inflation-adjusted yields, what else drives it, and why the relationship can break for long periods.',
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p5-f-oil-and-energy',
            'title': 'Oil and energy in the intermarket picture',
            'summary': 'What drives WTI and Brent, how oil feeds into inflation, yields and currencies, and which weekly reports move USOIL and UKOIL.',
            'minutes': 4,
            'order': 7,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p5-technical',
        'track': 'technical',
        'title': 'Risk management and position sizing',
        'summary': 'Risk per trade, exact position-size formulas for every asset class, R-multiples and expectancy, stop placement, drawdown maths, correlated exposure and leverage discipline.',
        'chapters': [
          {
            'slug': 'p5-t-risk-per-trade',
            'title': 'Risk per trade: the decision that comes first',
            'summary':
                'Why professionals fix the amount they can lose before they think about profit, and how to choose and apply a risk percentage per trade.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p5-t-position-size-formulas',
            'title': 'Position size formulas for every asset class',
            'summary': 'One universal formula and worked calculations for USD-quoted pairs, USD-base pairs, yen crosses, gold, indices, crypto and stocks.',
            'minutes': 5,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p5-t-r-multiples-and-expectancy',
            'title': 'R-multiples and expectancy',
            'summary':
                'Measure every trade in units of risk, calculate the expectancy of a strategy, and understand why win rate alone tells you almost nothing.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p5-t-stop-placement',
            'title': 'Where to place the stop loss',
            'summary': 'Place stops where your trade idea is proven wrong, using market structure and volatility, then size the position to fit the stop rather than the reverse.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p5-t-drawdown-and-risk-of-ruin',
            'title': 'Drawdown maths and risk of ruin',
            'summary': 'Why losses are harder to recover than they look, how often long losing streaks really occur, and how risk per trade drives the chance of ruin.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p5-t-correlation-and-total-exposure',
            'title': 'Correlation and total exposure',
            'summary': 'Why several positions can be one bet in disguise, how to measure net currency exposure and open risk, and how to cap risk per theme.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p5-t-leverage-discipline',
            'title': 'Leverage discipline',
            'summary': "Separate the account's leverage setting from the leverage you actually use, keep effective leverage and margin level in safe ranges, and build a pre-trade risk checklist.",
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-6',
    'order': 6,
    'title': 'Sentiment, positioning and systems',
    'level': 'Advanced',
    'summary': 'Read what other market participants are doing and feeling, and turn your own trading ideas into written, testable strategies that you backtest honestly and forward-test on demo before risking real money.',
    'elective': false,
    'sections': [
      {
        'slug': 'p6-fundamental',
        'track': 'fundamental',
        'title': 'Sentiment and positioning',
        'summary': 'Risk appetite, the COT report, retail sentiment, volatility regimes, the carry trade, recurring flows and options-market signals.',
        'chapters': [
          {
            'slug': 'p6-f-risk-on-risk-off',
            'title': 'Risk-on and risk-off',
            'summary': 'How global risk appetite pushes many markets in the same direction at once, and how to recognise which regime you are trading in.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p6-f-cot-report',
            'title': 'The Commitments of Traders report',
            'summary': 'What the weekly COT report shows about futures positioning in currencies, gold, oil and indices, and how to turn it into a useful sentiment gauge.',
            'minutes': 5,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p6-f-retail-sentiment',
            'title': 'Retail sentiment as a contrarian gauge',
            'summary': 'Why the aggregate positioning of retail traders often leans the wrong way, how to read it, and where the idea breaks down.',
            'minutes': 5,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p6-f-vix-volatility-regimes',
            'title': 'The VIX and volatility regimes',
            'summary': 'What the VIX measures, how to convert it into an expected price range, and how to adapt position size and strategy to calm, normal and stressed markets.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p6-f-carry-trade',
            'title': 'The carry trade',
            'summary': 'How traders earn interest-rate differentials through swaps, why carry trades build up slowly and unwind violently, and how to judge carry against risk.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p6-f-flows-fixings-rebalancing',
            'title': 'Flows: month-end, fixings and rebalancing',
            'summary': 'How large, scheduled, non-speculative orders from funds, corporates and index trackers move prices at predictable times, and how to trade around them.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p6-f-options-market-signals',
            'title': 'Reading signals from the options market',
            'summary': 'How implied volatility, expected moves, risk reversals, put/call ratios and large option expiries reveal what professional traders are paying for, even if you only trade CFDs.',
            'minutes': 6,
            'order': 7,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p6-technical',
        'track': 'technical',
        'title': 'Strategy design and backtesting',
        'summary': 'Define a trading system, build it in the Kalks strategy builder, backtest it properly, avoid overfitting, judge the metrics and forward-test on demo.',
        'chapters': [
          {
            'slug': 'p6-t-what-is-a-trading-system',
            'title': 'What a trading system is',
            'summary': 'The difference between a trading idea and a trading system, the components every system needs, and why writing rules down makes your trading testable.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p6-t-entry-exit-filter-rules',
            'title': 'Writing rules for entries, exits and filters',
            'summary': 'How to turn setups into unambiguous conditions, choose entry and exit mechanics, add filters that earn their place, and attach a position-sizing rule.',
            'minutes': 6,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p6-t-building-in-the-strategy-builder',
            'title': 'Building a strategy in the Kalks strategy builder',
            'summary': 'How to translate a written rule set into the Kalks strategy builder under Client Area, Developer, Strategies, and check that the strategy does what you intended.',
            'minutes': 5,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p6-t-backtesting-method',
            'title': 'Backtesting method',
            'summary': 'How to run an honest backtest in Developer, Backtests: choosing the date range, modelling costs, splitting data, getting enough trades and avoiding the biases that make results look better than reality.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p6-t-overfitting-and-walk-forward',
            'title': 'Overfitting and walk-forward testing',
            'summary': 'Why optimised strategies often fail live, how to recognise overfitting, and how walk-forward testing gives a more honest estimate of future performance.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p6-t-performance-metrics',
            'title': 'Reading performance metrics',
            'summary': 'How to read the numbers in a backtest report, including net profit, win rate, profit factor, expectancy, drawdown and risk-adjusted return, and which ones matter most.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p6-t-forward-testing-on-demo',
            'title': 'Forward testing on a demo account',
            'summary': 'How to forward-test a backtested strategy on a Kalks demo account, what to record, how to compare the results fairly with the backtest, and when to stop, adjust or move to small live size.',
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-7',
    'order': 7,
    'title': "Asset classes and the trader's mind",
    'level': 'Advanced',
    'summary': 'Understand what really drives each asset class traded on Kalks, and build the plan, routine, journal and review process that turn a strategy into consistent execution.',
    'elective': false,
    'sections': [
      {
        'slug': 'p7-fundamental',
        'track': 'fundamental',
        'title': 'Asset-class deep dives',
        'summary': 'How FX majors and crosses, precious metals, crude oil, equity indices, crypto and single stocks behave, and what moves each of them.',
        'chapters': [
          {
            'slug': 'p7-f-fx-majors-and-crosses',
            'title': 'FX majors and crosses',
            'summary':
                'How the major pairs differ from one another, how cross rates are built, and why a cross such as GBPJPY behaves so differently from EURUSD.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p7-f-gold-and-silver',
            'title': 'Gold and silver',
            'summary': 'What drives XAUUSD and XAGUSD, how the two metals differ, and how to size positions on a 100 oz gold contract.',
            'minutes': 5,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p7-f-crude-oil',
            'title': 'Crude oil',
            'summary': 'How supply decisions, inventories and the futures curve drive USOIL and UKOIL, and what that means for a CFD trader.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p7-f-equity-indices',
            'title': 'Equity indices',
            'summary': 'How US30, NAS100, SPX500, GER40, UK100 and JP225 are built, what drives them, and the practical details of trading index CFDs.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p7-f-crypto-markets',
            'title': 'Crypto markets',
            'summary':
                'What drives BTCUSD, ETHUSD and other crypto CFDs, why they behave differently from traditional assets, and how to manage their volatility.',
            'minutes': 4,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p7-f-single-stocks-and-earnings',
            'title': 'Single stocks and earnings',
            'summary': 'How company earnings, guidance and corporate actions move stock CFDs such as AAPL, TSLA and NVDA, and how to manage earnings-gap risk.',
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p7-technical',
        'track': 'technical',
        'title': 'Trading psychology and performance review',
        'summary': 'Recognise cognitive biases, write and follow a trading plan, keep a journal, review your statistics and manage drawdowns without tilting.',
        'chapters': [
          {
            'slug': 'p7-t-cognitive-biases',
            'title': 'Cognitive biases in trading',
            'summary': 'The mental shortcuts that quietly damage trading decisions, how to recognise them in your own behaviour, and rules that counter them.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p7-t-the-trading-plan',
            'title': 'The trading plan',
            'summary': 'What a complete trading plan contains, how to write one that removes in-the-moment decisions, and how to update it without drifting.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p7-t-routine-and-discipline',
            'title': 'Routine and discipline',
            'summary': 'How a repeatable pre-session, in-session and post-session routine turns a trading plan into consistent behaviour.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p7-t-trading-journal',
            'title': 'Keeping a trading journal',
            'summary':
                'What to record for every trade, how to measure results in R, and how MAE and MFE reveal whether your stops and targets are well placed.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p7-t-performance-review',
            'title': 'Reviewing performance statistics',
            'summary': 'How to calculate and interpret win rate, expectancy, profit factor and drawdown from your journal, and how to segment results to find what really works.',
            'minutes': 4,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p7-t-drawdowns-and-tilt',
            'title': 'Drawdowns and tilt',
            'summary': 'Why every strategy has drawdowns, how to tell normal losing streaks from a broken edge, and how to stop tilt from turning a bad day into a bad month.',
            'minutes': 4,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p7-t-sustainable-habits',
            'title': 'Sustainable trading habits',
            'summary':
                'How to build a trading practice that lasts: realistic expectations, gradual scaling, process goals, and protecting your health and attention.',
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-8',
    'order': 8,
    'title': 'Macro regimes and professional trading',
    'level': 'Professional',
    'summary': 'Identify the macro regime you are trading in, build scenario-based views on long-term themes, and run a portfolio of strategies with professional execution, prop-firm discipline and a structured review process.',
    'elective': false,
    'sections': [
      {
        'slug': 'p8-fundamental',
        'track': 'fundamental',
        'title': 'Macro regimes and long-term themes',
        'summary':
            'Business cycles, inflation and monetary regimes, commodity shocks, structural themes and how to turn them into a scenario-based macro view.',
        'chapters': [
          {
            'slug': 'p8-f-business-cycle-regimes',
            'title': 'The business cycle and macro regimes',
            'summary': 'Use the direction of growth and inflation to classify the macro regime, and understand why the same news moves markets differently in each one.',
            'minutes': 4,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p8-f-inflation-regimes',
            'title': 'Inflation regimes and what they change',
            'summary': 'Learn how low-and-stable, high-and-volatile and deflationary inflation regimes change asset correlations, real yields and the behaviour of gold, bonds and currencies.',
            'minutes': 5,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p8-f-monetary-cycles-qe-qt',
            'title': 'Monetary cycles: rates, QE and QT',
            'summary': 'Understand hiking and easing cycles, how quantitative easing and tightening work, and how markets price the path of policy long before it happens.',
            'minutes': 4,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p8-f-geopolitics-commodity-shocks',
            'title': 'Geopolitics and commodity shocks',
            'summary': 'Analyse how wars, sanctions, supply disruptions and elections transmit into oil, gold, currencies and indices, and how to manage the gap risk they create.',
            'minutes': 5,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p8-f-structural-themes',
            'title': 'Structural themes that shape the next decade',
            'summary': 'Examine long-term forces such as demographics, deglobalisation, the energy transition, technology investment and public debt, and learn how to use them without mistaking them for timing signals.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p8-f-long-term-currency-cycles',
            'title': 'Long-term currency cycles and the dollar',
            'summary': 'Study the multi-year US dollar cycle, the forces behind it and valuation tools such as purchasing power parity, so you can place shorter-term FX trades in their long-term context.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p8-f-macro-view-scenario-planning',
            'title': 'Building a macro view and scenario planning',
            'summary':
                'Combine regimes, policy cycles and themes into a written macro view with explicit scenarios, probabilities, signposts and trade expressions.',
            'minutes': 4,
            'order': 7,
            'questions': 4,
          },
        ],
      },
      {
        'slug': 'p8-technical',
        'track': 'technical',
        'title': 'Professional trading',
        'summary':
            'Multi-timeframe systems, strategy portfolios, execution quality, scaling, prop-firm rules, copy trading and PAMM, and professional routines.',
        'chapters': [
          {
            'slug': 'p8-t-multi-timeframe-systems',
            'title': 'Designing multi-timeframe trading systems',
            'summary': 'Build a rule-based system in which a higher timeframe sets the regime, a middle timeframe defines the setup and a lower timeframe triggers the entry.',
            'minutes': 4,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p8-t-strategy-portfolio-allocation',
            'title': 'A portfolio of strategies and capital allocation',
            'summary': 'Combine several uncorrelated strategies, allocate risk between them by volatility, and set rules for monitoring, rebalancing and switching strategies off.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p8-t-execution-quality',
            'title': 'Execution quality and trading costs',
            'summary': 'Measure the full cost of every trade, including spread, commission, slippage and swap, and improve execution through order choice, timing and records.',
            'minutes': 5,
            'order': 3,
            'questions': 4,
          },
          {
            'slug': 'p8-t-scaling-positions-capital',
            'title': 'Scaling positions and scaling capital',
            'summary': 'Add to and reduce positions with defined risk, and grow trading size in controlled steps without letting larger size break your execution or psychology.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p8-t-prop-firm-readiness',
            'title': 'Prop-firm readiness: trading within loss limits',
            'summary': 'Understand how prop challenges work, how daily loss and maximum drawdown rules are calculated, what they cost, and how to adapt your risk so a single bad day does not end the account.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p8-t-copy-trading-pamm',
            'title': 'Running copy-trading and PAMM strategies responsibly',
            'summary': 'Learn how copy trading and PAMM accounts work, how performance fees and high-water marks are calculated, and what a strategy provider owes the investors who follow them.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p8-t-professional-routines-review',
            'title': 'Professional routines and structured review',
            'summary': 'Build daily, weekly, monthly and quarterly routines that turn trading into a managed process, with clear metrics, contingency plans and decision rules.',
            'minutes': 4,
            'order': 7,
            'questions': 4,
          },
        ],
      },
    ],
  },
  {
    'slug': 'phase-9',
    'order': 9,
    'title': 'Kalks FX Options',
    'level': 'Intermediate',
    'summary': 'An elective course on Kalks FX Options that you can take at any time: what calls and puts are, how premiums, expiries and settlement work, payoffs and the Greeks, common strategies, barrier options and the real risks of selling options.',
    'elective': true,
    'sections': [
      {
        'slug': 'p9-options',
        'track': 'options',
        'title': 'Trading options on Kalks',
        'summary': 'European, cash-settled options on 9 FX pairs, gold, silver and oil: premiums, payoffs, breakevens, Greeks, strategies, barriers, margin for sellers and sizing rules, with worked examples in USD per contract.',
        'chapters': [
          {
            'slug': 'p9-o-what-are-options',
            'title': 'What options are',
            'summary': 'An option gives its buyer a right, not an obligation. How Kalks FX Options work, why traders use options and how they differ from the CFDs you already know.',
            'minutes': 5,
            'order': 1,
            'questions': 4,
          },
          {
            'slug': 'p9-o-calls-and-puts',
            'title': 'Calls and puts',
            'summary': 'The four basic option positions, what in, at and out of the money mean, and worked examples on EURUSD and gold in USD per contract.',
            'minutes': 4,
            'order': 2,
            'questions': 4,
          },
          {
            'slug': 'p9-o-premium-strike-expiry',
            'title': 'Premium, strike and expiry',
            'summary': 'What an option price is made of, what makes it rise or fall, how expiries, the 10:00 New York cut and the settlement average work, and how premiums are quoted per contract.',
            'minutes': 5,
            'order': 3,
            'questions': 5,
          },
          {
            'slug': 'p9-o-payoff-and-breakeven',
            'title': 'Payoff and breakeven',
            'summary': 'Payoff tables for the four basic positions, how to find the breakeven and the maximum gain and loss, and how the result changes if you close before expiry.',
            'minutes': 4,
            'order': 4,
            'questions': 4,
          },
          {
            'slug': 'p9-o-greeks',
            'title': 'The Greeks in plain words',
            'summary': 'Delta, gamma, theta, vega and rho explained without formulas, implied versus realised volatility, and why options behave so differently in their final hours.',
            'minutes': 5,
            'order': 5,
            'questions': 4,
          },
          {
            'slug': 'p9-o-strategies',
            'title': 'Option strategies',
            'summary': 'Protective puts and covered calls with a CFD position, vertical spreads, straddles, strangles, iron condors and butterflies: when each fits, and its maximum profit, maximum loss and breakevens.',
            'minutes': 5,
            'order': 6,
            'questions': 4,
          },
          {
            'slug': 'p9-o-barrier-options',
            'title': 'Barrier options',
            'summary': 'Knock-in and knock-out options, why they cost less than standard options, how Kalks monitors the barrier, and what happens when the market gaps through it.',
            'minutes': 5,
            'order': 7,
            'questions': 4,
          },
          {
            'slug': 'p9-o-selling-risk-and-margin',
            'title': 'Selling options: risk and margin',
            'summary': 'Why option sellers can lose many times the premium, how Kalks calculates scenario-based margin, what happens at margin call and stop-out, and practical sizing rules for options.',
            'minutes': 5,
            'order': 8,
            'questions': 4,
          },
        ],
      },
    ],
  },
];

const Map<String, Map<String, Object?>> _bodies = {
  'p2-f-pips-and-points': {
    'body': 'Every price you see in Kalks Trader changes in small steps. Before you can talk sensibly about profit, loss, stops or costs, you need a shared unit for measuring those steps. In currency trading that unit is the **pip**; on metals, indices and crypto traders usually talk in **points**. This chapter explains both and shows how to convert a move in pips into an amount of money.\n\n## What a pip is\n\nA pip ("percentage in point") is the conventional minimum meaningful move in a currency pair. For most pairs it is the fourth decimal place, **0.0001**. For pairs quoted against the Japanese yen, where the price is a much larger number, it is the second decimal place, **0.01**.\n\n| Symbol | Example quote | One pip |\n|---|---|---|\n| EURUSD | 1.0850 | 0.0001 |\n| GBPUSD | 1.2700 | 0.0001 |\n| USDCAD | 1.3700 | 0.0001 |\n| USDJPY | 155.20 | 0.01 |\n| GBPJPY | 195.00 | 0.01 |\n\nModern platforms quote one more decimal than the pip: EURUSD appears as 1.08503 and USDJPY as 155.204. That last digit is a **fractional pip**, one tenth of a pip. Many platforms call this smallest step a *point*. It is useful for precision, but the pip remains the unit traders use for stops, targets and spreads, so do not confuse the two: 35 pips and 350 points describe the same move on EURUSD.\n\n## Counting pips\n\nCounting a move is just subtraction followed by division by the pip size.\n\n```text\nEURUSD  1.0850 -> 1.0885   difference 0.0035 / 0.0001 = 35 pips\nUSDJPY  155.20 -> 154.75   difference 0.45   / 0.01   = 45 pips\nEURUSD  1.08503 -> 1.08547 difference 0.00044 / 0.0001 = 4.4 pips\n```\n\nThe direction tells you whether that move helped or hurt you. If you bought EURUSD, a rise from 1.0850 to 1.0885 is 35 pips in your favour; if you sold, it is 35 pips against you.\n\n## Points on metals, indices and crypto\n\nOutside FX there is no universal pip. Gold (XAUUSD) is quoted to two decimals, for example 2,350.40, and traders normally describe moves in dollars: "gold is up 12 dollars" means the price rose by 12.00. Indices such as US30 or GER40 are quoted in index points, so US30 moving from 39,200 to 39,285 is an 85-point move. Crypto such as BTCUSD at 64,000 is usually described in dollars too.\n\nBecause conventions vary, the reliable approach is to open the contract specification for the symbol in Kalks Trader and check three things: the number of digits, the contract size and the tick (minimum price step). Everything else follows from those.\n\n## Pip value: turning pips into money\n\nA pip only matters because of the amount of money attached to it. The pip value, in the **quote currency** (the second currency of the pair), is:\n\n```text\npip value (quote currency) = position size in units x pip size\n```\n\nFor EURUSD the quote currency is USD, so the answer is already in dollars. One standard lot is 100,000 units (lots are covered in the next chapter):\n\n```text\n1.00 lot EURUSD: 100,000 x 0.0001 = 10.00 USD per pip\n0.10 lot EURUSD:  10,000 x 0.0001 =  1.00 USD per pip\n0.01 lot EURUSD:   1,000 x 0.0001 =  0.10 USD per pip\n```\n\nWhen USD is not the quote currency, the result comes out in another currency and must be converted to your account currency at the current rate:\n\n```text\n1.00 lot USDJPY: 100,000 x 0.01   = 1,000 JPY per pip\n                 1,000 / 155.00    = 6.45 USD per pip  (USDJPY at 155.00)\n\n1.00 lot USDCAD: 100,000 x 0.0001 = 10 CAD per pip\n                 10 / 1.3700       = 7.30 USD per pip  (USDCAD at 1.3700)\n```\n\nThis is why pip value on USDJPY or USDCAD changes slightly as the exchange rate moves, while EURUSD, GBPUSD and AUDUSD stay fixed at 10 USD per lot for a USD account.\n\n> **Example:** Gold is quoted per troy ounce and one XAUUSD lot is 100 oz. A 1.00 move in price (2,350.40 to 2,351.40) is worth 100 x 1.00 = 100 USD per lot, and the smallest step of 0.01 is worth 1 USD per lot. On an index, on a 1-unit-per-point contract, one lot of US30 earns or loses 1 USD per index point; check the contract specification in Kalks Trader for the real size of each symbol.\n\n## Why this matters\n\nPips let you describe a trade independently of its size. A plan such as "stop 25 pips below entry, target 50 pips above" works whether you trade 0.01 or 1.00 lot. Pip value then converts that plan into money, which is what you actually risk. A 25-pip stop on 0.10 lot EURUSD risks about 25 USD; the same stop on 1.00 lot risks about 250 USD. Same chart, very different consequence.\n\n## Common mistakes\n\n- Confusing points with pips. A 4-pip spread is 40 points, and typing 30 into a field measured in points gives a 3-pip stop, not a 30-pip one.\n- Applying 0.0001 to JPY pairs. On USDJPY a move from 155.20 to 155.30 is 10 pips, not 1,000.\n- Assuming every symbol is worth 10 USD per pip per lot. That only holds for pairs quoted in USD on a USD account.\n- Judging a gold or index move by its size in points without checking what one point is worth on that contract.',
    'takeaways': [
      'A pip is 0.0001 on most currency pairs and 0.01 on JPY pairs; the extra quoted digit is a fraction of a pip, not a full pip.',
      'Pip value in the quote currency is simply position size in units multiplied by the pip size.',
      'One standard lot of EURUSD is worth 10 USD per pip, but pip value is not 10 USD on every symbol or at every lot size.',
      'Metals, indices and crypto are usually measured in price points, so always check the contract specification before judging a move in money.',
    ],
    'practice': {
      'label': "Open EURUSD and USDJPY side by side on your demo account, note how many decimals each quote has, and count the pips between today's high and low on each.",
      'symbol': 'EURUSD',
    },
    'words': 838,
    'quiz': [
      {
        'question': 'EURUSD moves from 1.0850 to 1.0885. How many pips is that?',
        'options': ['3.5 pips', '35 pips', '350 pips', '0.35 pips'],
        'answer': 1,
        'explanation':
            'The difference is 0.0035, and one pip on EURUSD is 0.0001, so 0.0035 / 0.0001 = 35 pips. 350 would be the count in fractional pips (points).',
      },
      {
        'question': 'USDJPY falls from 155.20 to 154.75. How many pips has it moved?',
        'options': ['4.5 pips', '450 pips', '0.45 pips', '45 pips'],
        'answer': 3,
        'explanation': 'On JPY pairs a pip is 0.01. The move is 0.45, and 0.45 / 0.01 = 45 pips.',
      },
      {
        'question': 'What is the pip value of a 0.10 lot EURUSD position, in USD?',
        'options': ['1 USD per pip', '10 USD per pip', '0.10 USD per pip', '100 USD per pip'],
        'answer': 0,
        'explanation': '0.10 lot is 10,000 EUR. 10,000 x 0.0001 = 1 USD per pip. 10 USD per pip applies to a full standard lot.',
      },
      {
        'question': 'A EURUSD quote changes from 1.08503 to 1.08547. What is the move?',
        'options': ['44 pips', '0.44 pips', '4.4 pips', '440 pips'],
        'answer': 2,
        'explanation': 'The difference is 0.00044. Dividing by the pip size of 0.0001 gives 4.4 pips; the fifth decimal is a tenth of a pip.',
      },
    ],
  },
  'p2-t-stop-loss-take-profit-trailing': {
    'body': "Placing a trade is a decision about where you think price is going. Placing a **stop loss** is a decision about where you admit you were wrong. Placing a **take profit** is a decision about where you will be satisfied. Kalks Trader lets you attach both to any market or pending order, and adds a server-side **trailing stop** that follows the price for you. This chapter explains how each behaves in practice.\n\n## Stop loss: the exit when you are wrong\n\nA stop loss is an instruction to close the position if price moves against you to a given level. For a long position it sits below the entry; for a short, above.\n\nTwo mechanics matter:\n\n- **Trigger side.** A long is closed by selling, so its stop triggers when the **bid** reaches the level. A short is closed by buying, so its stop triggers when the **ask** reaches the level. Since the chart normally shows the bid, a short's stop can trigger when the chart appears not to have reached it, especially when spreads widen.\n- **Fill.** Once triggered, a stop becomes a market order. In calm markets you are filled at or very near the level. In a fast market, a news spike or a weekend gap, the fill can be worse. A stop loss limits your loss; it does not guarantee an exact price.\n\n## Take profit: the exit when you are right\n\nA take profit closes the position once price reaches your target. It behaves like a limit order: filled at the target price or better. A long's take profit triggers on the bid, a short's on the ask.\n\nA take profit forces you to decide the reward before emotion takes over. Without one, traders often watch a winning trade return to breakeven while waiting for \"a bit more\".\n\n## Turning levels into money\n\n```text\nLong 0.20 lot EURUSD at 1.0851 (pip value 2.00 USD)\nStop loss   1.0821  -> 30 pips x 2.00 = 60.00 USD risk\nTake profit 1.0911  -> 60 pips x 2.00 = 120.00 USD target\nReward to risk = 120 / 60 = 2 : 1\n\nShort 0.10 lot XAUUSD at 2,350.40 (10 oz, 10 USD per 1.00 move)\nStop loss   2,362.40 -> 12.00 x 10 = 120.00 USD risk\nTake profit 2,326.40 -> 24.00 x 10 = 240.00 USD target\n```\n\nDoing this before placing the order tells you whether the potential loss is acceptable. How much to risk per trade, and where to put stops relative to market structure, are covered in depth in later phases.\n\n> **Risk warning:** CFDs are leveraged and stop losses can be filled at worse prices during gaps or fast markets, so your actual loss can exceed the planned amount. A stop loss is still far better than none: it is the main tool that keeps a single trade from damaging your account.\n\n## Trailing stops\n\nA trailing stop is a stop loss that moves automatically in your favour. You set a distance, for example 20 pips. For a long, each time the bid makes a new high the stop is moved up so it stays 20 pips below that high. If the price falls, the stop stays where it is. It never moves against you.\n\nOn Kalks the trailing stop is **server-side**: it is managed by the server, so it keeps trailing when your browser or Kalks Trader is closed.\n\n```svg\n<svg viewBox=\"0 0 640 320\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect width=\"100%\" height=\"100%\" fill=\"#121216\"/>\n  <line x1=\"60\" y1=\"30\" x2=\"60\" y2=\"290\" stroke=\"#3a3a44\" stroke-width=\"1\"/>\n  <line x1=\"60\" y1=\"290\" x2=\"560\" y2=\"290\" stroke=\"#3a3a44\" stroke-width=\"1\"/>\n  <text x=\"8\" y=\"59\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">1.0905</text>\n  <text x=\"8\" y=\"119\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">1.0885</text>\n  <text x=\"8\" y=\"224\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">1.0850</text>\n  <text x=\"8\" y=\"281\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">1.0831</text>\n  <polyline points=\"60,217 140,190 220,160 280,175 340,100 400,115 450,55 520,115\" fill=\"none\" stroke=\"#22c55e\" stroke-width=\"2\"/>\n  <path d=\"M60,277 H140 V250 H220 V220 H340 V160 H450 V115 H520\" fill=\"none\" stroke=\"#ff5a1f\" stroke-width=\"2\"/>\n  <circle cx=\"520\" cy=\"115\" r=\"5\" fill=\"#ef4444\"/>\n  <text x=\"530\" y=\"112\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">Stop hit</text>\n  <text x=\"530\" y=\"128\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">1.0885</text>\n  <line x1=\"380\" y1=\"250\" x2=\"410\" y2=\"250\" stroke=\"#22c55e\" stroke-width=\"2\"/>\n  <text x=\"416\" y=\"254\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">Bid price</text>\n  <line x1=\"380\" y1=\"270\" x2=\"410\" y2=\"270\" stroke=\"#ff5a1f\" stroke-width=\"2\"/>\n  <text x=\"416\" y=\"274\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\">Trailing stop, 20 pips</text>\n  <text x=\"310\" y=\"312\" fill=\"#c9c9d1\" font-family=\"Inter, Arial, sans-serif\" font-size=\"12\" text-anchor=\"middle\">Time (simplified: the stop rises only when price makes a new high)</text>\n</svg>\n```\n\n> **Example:** You buy 0.20 lot EURUSD at 1.0851 with a 20-pip trailing stop. The bid climbs to 1.0890, so the stop moves to 1.0870. The bid dips to 1.0875; the stop stays at 1.0870. The bid then rises to 1.0905 and the stop moves to 1.0885. When the bid falls back to 1.0885, the position closes: (1.0885 - 1.0851) = 34 pips x 2.00 USD = 68.00 USD profit.\n\nThe distance is the key choice. Too tight, and normal fluctuations close the trade early; too wide, and you give back much of the profit before exiting. A distance based on the symbol's typical movement (gold needs far more room than EURUSD) works better than a fixed number used everywhere.\n\n## Common mistakes\n\n- Placing stops at round numbers or obvious levels where many other stops sit, making them easy to reach in a quick spike.\n- Widening the stop when price approaches it. This turns a planned loss into an unplanned larger one.\n- Setting a take profit so far away that it is rarely reached, or so close that costs eat most of the gain.\n- Forgetting the spread on short positions: the ask, not the bid shown on the chart, triggers the stop.",
    'takeaways': [
      'A stop loss closes a losing position at the next available price once its level is touched, so it limits loss but can slip in fast markets.',
      'A take profit closes at your target price or better once it is reached.',
      'Stops and targets on long positions trigger on the bid; on short positions they trigger on the ask.',
      'A server-side trailing stop moves only in your favour at a fixed distance and keeps working when Kalks Trader is closed.',
    ],
    'practice': {
      'label':
          'Open a 0.01 lot EURUSD demo position with a 20-pip stop and 40-pip target, then add a 15-pip trailing stop and watch how the stop level updates.',
      'symbol': 'EURUSD',
    },
    'words': 742,
    'quiz': [
      {
        'question': 'You buy 0.20 lot EURUSD at 1.0851 with a stop loss at 1.0821. How much do you lose if the stop is filled exactly?',
        'options': ['30 USD', '600 USD', '6 USD', '60 USD'],
        'answer': 3,
        'explanation': 'The stop is 30 pips away and 0.20 lot is worth 2 USD per pip, so the loss is 30 x 2 = 60 USD.',
      },
      {
        'question': 'Which price triggers the stop loss of a short position?',
        'options': ['The ask', 'The bid', 'The mid price', 'The previous candle close'],
        'answer': 0,
        'explanation': 'A short is closed by buying, and buys are executed at the ask, so its stop loss triggers on the ask.',
      },
      {
        'question': 'A long position has a 20-pip trailing stop. Price rises 50 pips, then falls 10 pips. Where is the stop?',
        'options': ['20 pips below entry', '30 pips above entry', '40 pips above entry', 'At entry'],
        'answer': 1,
        'explanation': 'At the peak, 50 pips above entry, the stop is 20 pips below it: 30 pips above entry. A trailing stop never moves back, so the 10-pip fall does not change it.',
      },
      {
        'question': 'Why can a stop loss be filled at a worse price than its level?',
        'options': [
          "Because stops are filled at the previous day's close",
          'Because the broker adds a fixed penalty',
          'Because once triggered it becomes a market order and executes at the next available price',
          'Because stops only work while the terminal is open',
        ],
        'answer': 2,
        'explanation': 'A triggered stop is executed as a market order. In a gap or fast market the next available price can be beyond the stop level.',
      },
    ],
  },
  'p9-o-what-are-options': {
    'body': "Up to now this course has been about CFDs, where profit and loss move in a straight line with the price. Options work differently. With an option you pay a price today, the **premium**, for a payoff that depends on where the market settles on a future date. Kalks FX Options lets you trade options on currencies, metals and oil from the same account you use for CFDs. This chapter explains what you are actually buying or selling.\n\n## A right, not an obligation\n\nAn option is a contract between a buyer and a seller.\n\n- The **buyer** (or holder) pays the premium and receives a **right**. If the market finishes on the right side of an agreed price, the buyer is paid. If not, the option simply expires and the buyer has lost only the premium.\n- The **seller** (or **writer**) receives the premium and takes on an **obligation**. If the option finishes in the buyer's favour, the seller must pay. The seller's gain is capped at the premium; the loss is not.\n\nThe agreed price is the **strike**, and the date is the **expiry**. There are two basic types. A **call** pays when the price finishes above the strike, and a **put** pays when it finishes below. The next chapter covers both in detail.\n\n## European style and cash settlement\n\nKalks FX Options are **European style**. They cannot be exercised early: the only moment that decides the payoff is expiry. You do not have to do anything at expiry, because exercise is automatic.\n\nThey are also **cash-settled in USD**. Nobody receives euros, gold bars or barrels of oil. At expiry:\n\n- an option that is **in the money** pays the difference between the settlement price and the strike, multiplied by the contract size, in USD;\n- an option that is **out of the money** expires worthless.\n\nThe **settlement price** is not the last tick. It is the time-weighted average (TWAP) of the mid price over the last 30 minutes before the **cut**, which is 10:00 New York time by default. Averaging over half an hour makes the settlement much harder to distort with one sharp spike.\n\n> **Example:** You hold one EURUSD call with a strike of 1.1700. The average mid price from 09:30 to 10:00 New York time on expiry day is 1.1760. The option is in the money by 0.0060, and one contract is 10,000 euros, so 0.0060 x 10,000 = 60 USD is credited to your account automatically.\n\n## Why traders use options\n\n| Use | What you do | Why |\n|---|---|---|\n| Directional view with a known maximum loss | Buy a call or a put | The most you can lose is the premium, fixed before you trade, and no gap can skip past it |\n| Hedging | Buy a put against a long CFD, or a call against a short CFD | Puts a floor or a ceiling under an existing position for a known cost |\n| Income | Sell options and collect the premium | Earns the premium if the market stays away from the strike, but with large potential losses |\n\nThe first two uses buy protection or opportunity for a fixed price. The third sells it, which is a very different business. The last chapter of this course is dedicated to the risks of selling.\n\n## How options differ from CFDs\n\n| | CFD | Bought option |\n|---|---|---|\n| Profit and loss | Moves one-for-one with the price | Nothing below the strike (for a call), then rises with the price |\n| Cost to open | Margin, a fraction of the position value | The full premium, paid upfront |\n| Leverage | Yes | No: you pay the full price of what you buy |\n| Maximum loss | Can exceed your planned stop, especially through gaps | The premium paid |\n| Time | No expiry | Loses value as expiry approaches |\n| Direction | Long or short the same instrument | Calls for rises, puts for falls |\n\nA sold option behaves differently again: the seller posts margin and can face losses many times the premium received.\n\n## What you can trade\n\nKalks FX Options covers 13 underlyings, each with a fixed contract size.\n\n| Underlying | Symbols | One contract |\n|---|---|---|\n| FX pairs | EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD, EURJPY, GBPJPY | 10,000 units of the base currency |\n| Gold | XAUUSD | 1 troy ounce |\n| Silver | XAGUSD | 50 troy ounces |\n| Crude oil | USOIL (WTI), UKOIL (Brent) | 10 barrels |\n\nPremiums are always shown in USD per contract. The options are priced with standard models: Garman-Kohlhagen for currency pairs, Black-Scholes for gold and silver, and Black-76 for oil. You do not need the formulas, but the next chapters explain what drives the price.\n\n## Who is on the other side\n\nThere is no exchange order book. **Kalks is the counterparty** to every option trade and quotes a bid and an ask for every listed strike. You buy at the ask, and you can close before expiry by selling at the bid, in full or in part. Options positions live in the **same trading account** as your CFDs and share its margin, so a losing options position reduces the margin available to your CFD trades, and the other way round. Whether options are available on a given account depends on your broker's settings.\n\n> **Risk warning:** Buying options can lose 100% of the premium, and this happens often: many options expire worthless. Selling options can lose much more than the premium received. Learn the mechanics on a demo account before trading options with real money.\n\n## Common mistakes\n\n- **Thinking an option is a cheap CFD.** A bought option needs the move to happen before expiry and to be large enough to cover the premium.\n- **Expecting delivery.** Settlement is cash in USD only.\n- **Assuming you must act at expiry.** Exercise is automatic; your only decision is whether to hold until then or close earlier at the bid.",
    'takeaways': [
      'An option gives its buyer the right, but not the obligation, to a payoff based on a fixed strike price at expiry. The seller, or writer, takes on the matching obligation in exchange for the premium.',
      'Kalks FX Options are European style and cash-settled in USD: they are exercised automatically at expiry, an in-the-money option pays the difference and an out-of-the-money option expires worthless.',
      'A buyer pays the full premium upfront with no leverage, so the most a buyer can lose is the premium. A seller receives the premium but posts margin and can lose many times that amount.',
      'Traders use options for directional views with a known maximum loss, for hedging existing positions and for income, and each use has a very different risk profile.',
      'Options sit in the same trading account as your CFDs, and Kalks is the counterparty to every trade, quoting a bid and an ask for every strike.',
    ],
    'practice': {
      'label': 'Open EURUSD and XAUUSD on your demo account, note the current prices, and write down which strike would be at the money for each and what one option contract represents (10,000 euros and 1 ounce).',
      'symbol': 'EURUSD',
    },
    'words': 938,
    'quiz': [
      {
        'question': 'What does the buyer of an option receive in exchange for the premium?',
        'options': [
          'An obligation to buy the underlying at the strike price',
          "The right, but not the obligation, to the option's payoff at expiry",
          'A CFD position with lower margin',
          'A guarantee that the trade will be profitable',
        ],
        'answer': 1,
        'explanation': 'The buyer pays the premium for a right. If the option finishes in the money it pays out; if not, the buyer has lost only the premium. The obligation sits with the seller.',
      },
      {
        'question': 'Kalks FX Options are European style. What does that mean?',
        'options': [
          'They can be exercised at any time before expiry',
          'They can only be traded during European market hours',
          'They are exercised only at expiry, automatically, based on the settlement price',
          'They are settled by delivering euros to your account',
        ],
        'answer': 2,
        'explanation': 'European options cannot be exercised early. At the cut, every option is settled automatically against the settlement price, in USD cash. You can still close the position before expiry by trading it.',
      },
      {
        'question': 'You buy one EURUSD call for 24 USD. What is the most you can lose on this position?',
        'options': ['24 USD', '240 USD', 'The full value of 10,000 euros', 'There is no limit'],
        'answer': 0,
        'explanation': 'A buyer pays the full premium upfront and has no further obligation, so the maximum loss is the 24 USD premium. Unlimited losses belong to sellers of calls, not buyers.',
      },
      {
        'question': 'A EURUSD option you hold finishes in the money at expiry. What happens?',
        'options': [
          'You receive 10,000 euros in your account',
          'A CFD position is opened for you at the strike price',
          'Nothing, unless you exercise it manually before the cut',
          'It is exercised automatically and the difference is paid to your account in USD',
        ],
        'answer': 3,
        'explanation': 'Kalks options are cash-settled. An in-the-money option pays the difference between the settlement price and the strike, multiplied by the contract size, in USD. There is no delivery and no manual exercise.',
      },
    ],
  },
};

const Map<String, Map<String, Object?>> _exams = {
  'phase-1': {
    'pass_mark': 70,
    'count': 15,
    'questions': [
      {
        'question': 'USDJPY is quoted 155.20 / 155.22. You sell. At which price is your market order normally filled?',
        'options': ['155.22, the ask', '155.21, the mid price', '155.20, the bid', 'The previous close'],
        'answer': 2,
        'explanation': 'Sell orders fill at the bid, the lower of the two prices. Buy orders fill at the ask.',
      },
      {
        'question': 'Which participant mainly trades currencies to settle real business payments rather than to speculate?',
        'options': ['A multinational corporation paying foreign suppliers', 'A hedge fund', 'A proprietary trading firm', 'A retail scalper'],
        'answer': 0,
        'explanation': 'Corporations buy and sell currencies to pay for goods, repatriate profits and hedge costs. Their flows are commercial.',
      },
      {
        'question': 'You buy AUDUSD. Which statement describes your exposure?',
        'options': ['Short AUD, long USD', 'Long AUD, short USD', 'Long both currencies', 'Exposure to the spread only'],
        'answer': 1,
        'explanation': 'Buying a pair means buying the base currency (AUD) and selling the quote currency (USD).',
      },
      {
        'question': 'You sell 0.20 lot of XAUUSD (20 oz) at 2,350.40 and buy it back at 2,358.90. What is the result before costs?',
        'options': ['+170 USD', '-85 USD', '+85 USD', '-170 USD'],
        'answer': 3,
        'explanation': 'A short loses when price rises. The move is 2,358.90 - 2,350.40 = 8.50 USD per ounce, and 8.50 x 20 oz = 170 USD lost.',
      },
      {
        'question': 'Which Kalks instrument is most likely to gap sharply at the open after a company reports quarterly results overnight?',
        'options': ['EURUSD', 'NVDA', 'USDCHF', 'XAGUSD'],
        'answer': 1,
        'explanation': 'Single-share CFDs follow their exchange session and often gap on earnings released outside trading hours.',
      },
      {
        'question': 'US employment data comes in far weaker than the consensus forecast. What is the most typical first reaction?',
        'options': [
          'USD weakens, so EURUSD tends to rise',
          'USD strengthens, so EURUSD tends to fall',
          'Oil always rises',
          'No instrument reacts to a data surprise',
        ],
        'answer': 0,
        'explanation':
            'A negative surprise lowers expectations for US interest rates, which usually weakens the dollar. Tendencies can be overridden by other drivers.',
      },
      {
        'question': 'Account X charges a 0.9-pip EURUSD spread with no commission. Account Y charges 0.1 pip plus 6 USD per lot round turn. What is the cost difference for 1 lot?',
        'options': ['Y is 1 USD cheaper', 'X is 2 USD cheaper', 'They cost the same', 'Y is 2 USD cheaper'],
        'answer': 3,
        'explanation': 'X costs 0.9 x 10 = 9 USD. Y costs 0.1 x 10 + 6 = 7 USD. So Y is 9 - 7 = 2 USD cheaper per lot round trip.',
      },
      {
        'question': 'A 2,000 USD account on 1:200 leverage buys 1 lot of EURUSD. How much does changing the leverage to 1:500 change the loss per pip?',
        'options': [
          'It reduces the loss per pip by 60%',
          'It increases the loss per pip 2.5 times',
          'It does not change it; the loss per pip is still 10 USD',
          'It removes the risk of stop-out',
        ],
        'answer': 2,
        'explanation': 'Leverage changes the margin required, not the value of a pip. One lot of EURUSD is worth 10 USD per pip at any leverage.',
      },
      {
        'question': 'An M30 candle has open 1.2710, high 1.2735, low 1.2702 and close 1.2729. How long is its lower wick?',
        'options': ['8 pips', '6 pips', '19 pips', '33 pips'],
        'answer': 0,
        'explanation': 'The candle is bullish, so the bottom of the body is the open, 1.2710. Lower wick = 1.2710 - 1.2702 = 0.0008, or 8 pips. 6 pips is the upper wick and 33 pips the range.',
      },
      {
        'question': 'Why can a buy stop order trigger before the plotted candle high reaches its level?',
        'options': [
          'Because charts show the ask price',
          'Because charts are normally drawn from the bid, while buy orders trigger on the ask',
          'Because stop orders trigger randomly',
          "Because the chart uses the previous day's prices",
        ],
        'answer': 1,
        'explanation': 'The plotted price is the bid. The ask is higher by the spread, so a buy order can be triggered when the ask reaches the level even if the bid never does.',
      },
      {
        'question': 'Which chart type is best suited to a quick, uncluttered view of the long-term direction?',
        'options': ['M1 candlesticks', 'OHLC bars on M5', 'Tick volume', 'A line chart of closing prices on a high timeframe'],
        'answer': 3,
        'explanation': 'A line chart joins closes and removes intra-period noise, which makes the big picture easy to see, especially on D1 or W1.',
      },
      {
        'question': 'On Kalks Trader, at what server times do H4 candles open?',
        'options': [
          '01:00, 05:00, 09:00, 13:00, 17:00, 21:00',
          '00:00, 04:00, 08:00, 12:00, 16:00, 20:00',
          'Only during the London session',
          'At random times set by volume',
        ],
        'answer': 1,
        'explanation': 'H4 candles are aligned with the server day that starts at 00:00, the New York close, so six H4 candles make one D1 candle.',
      },
      {
        'question': "A market's last swing highs are 1.2950, 1.2905, 1.2870 and its swing lows are 1.2880, 1.2830, 1.2795. What is the state?",
        'options': ['Downtrend', 'Uptrend', 'Range', 'It cannot be a trend because the numbers are too close'],
        'answer': 0,
        'explanation': 'Each high is lower than the one before and each low is lower too: lower highs and lower lows define a downtrend.',
      },
      {
        'question': 'NAS100 averages a 240-point daily range at 18,000. What is that in percentage terms?',
        'options': ['About 0.13%', 'About 2.4%', 'About 13.3%', 'About 1.3%'],
        'answer': 3,
        'explanation': '240 / 18,000 = 0.0133, or about 1.3% of the price.',
      },
      {
        'question': 'What is the main benefit of setting an alert at a key level in Kalks Trader?',
        'options': [
          'It automatically opens a trade at that level',
          'It reduces your spread',
          'It notifies you when price reaches the level without placing any order',
          'It prevents stop-out',
        ],
        'answer': 2,
        'explanation': 'An alert is a notification only. It lets you prepare for a level without watching the screen and without committing to a trade.',
      },
    ],
  },
  'phase-2': {
    'pass_mark': 70,
    'count': 15,
    'questions': [
      {
        'question': 'What is the pip value in USD of a 0.50 lot USDJPY position when USDJPY is at 155.00?',
        'options': ['5.00 USD', '500 USD', '0.32 USD', '3.23 USD'],
        'answer': 3,
        'explanation': '0.50 lot is 50,000 units, and 50,000 x 0.01 = 500 JPY per pip. Converted at 155.00: 500 / 155.00 = 3.23 USD. 5.00 USD would only apply to a pair quoted in USD.',
      },
      {
        'question': 'What is the notional value in USD of 0.40 lot GBPUSD at 1.2700?',
        'options': ['50,800 USD', '40,000 USD', '5,080 USD', '508 USD'],
        'answer': 0,
        'explanation': '0.40 lot is 40,000 GBP. 40,000 x 1.2700 = 50,800 USD. 40,000 is the amount in pounds, not dollars.',
      },
      {
        'question': 'What margin is required for 0.10 lot XAUUSD at 2,350.40 with 1:200 leverage?',
        'options': ['235.04 USD', '1,175.20 USD', '117.52 USD', '11.75 USD'],
        'answer': 2,
        'explanation': '0.10 lot is 10 oz, so notional is 10 x 2,350.40 = 23,504 USD. 23,504 / 200 = 117.52 USD. 235.04 USD would be the margin at 1:100.',
      },
      {
        'question': 'An account has a 2,000 USD balance, no floating result yet and 800 USD of used margin. Stop-out is at 50%. How large a floating loss can it take before stop-out is reached?',
        'options': ['1,200 USD', '800 USD', '2,000 USD', '1,600 USD'],
        'answer': 3,
        'explanation': 'Stop-out equity is 50% x 800 = 400 USD. From 2,000 USD, the account can lose 2,000 - 400 = 1,600 USD. 1,200 USD is the loss that brings it to the 100% margin call.',
      },
      {
        'question': 'XAUUSD is quoted 2,350.40 / 2,350.70. What is the spread cost of a 0.50 lot trade?',
        'options': ['1.50 USD', '15.00 USD', '150.00 USD', '30.00 USD'],
        'answer': 1,
        'explanation': 'The spread is 0.30 and 0.50 lot is 50 oz, so the cost is 0.30 x 50 = 15.00 USD.',
      },
      {
        'question': 'On which night is the triple swap normally applied to a US30 index position?',
        'options': ['Wednesday', 'Every night', 'Friday', 'Monday'],
        'answer': 2,
        'explanation': 'Indices, energies and stocks take the triple swap on Friday night. Wednesday is the triple night for FX and metals, and crypto is charged every night.',
      },
      {
        'question': 'You sell 0.30 lot GBPUSD at 1.2700 and buy it back at 1.2655. What is the gross result?',
        'options': ['+135 USD', '-135 USD', '+13.50 USD', '+1,350 USD'],
        'answer': 0,
        'explanation': 'For a short, profit is open minus close: (1.2700 - 1.2655) x 30,000 = 0.0045 x 30,000 = +135 USD, or 45 pips x 3 USD.',
      },
      {
        'question': 'A cent account shows a balance of 12,500 USC. What is it worth in US dollars?',
        'options': ['12,500 USD', '1,250 USD', '125 USD', '12.50 USD'],
        'answer': 2,
        'explanation': '1 USD = 100 USC, so 12,500 / 100 = 125 USD.',
      },
      {
        'question': 'At which price is a short EURUSD position closed with a market order?',
        'options': ['The bid', 'The ask', 'The mid price', 'The last candle close'],
        'answer': 1,
        'explanation': 'Closing a short means buying, and buys are filled at the ask.',
      },
      {
        'question': 'Gold trades at 2,350.40. You want to open a short only if price rallies to 2,365.00. Which order fits?',
        'options': ['Sell stop at 2,365.00', 'Buy limit at 2,365.00', 'Buy stop at 2,365.00', 'Sell limit at 2,365.00'],
        'answer': 3,
        'explanation': 'Selling above the current price is a sell limit. A sell stop must be placed below the market.',
      },
      {
        'question': 'You short XAUUSD at 2,350.40 with a 5.00 trailing stop. The ask falls to 2,331.00 and then rises to 2,334.00. Where is the stop now?',
        'options': ['2,336.00', '2,339.00', '2,355.40', '2,331.00'],
        'answer': 0,
        'explanation': 'For a short the stop trails 5.00 above the lowest ask: 2,331.00 + 5.00 = 2,336.00. It does not move back up when price rises, and 2,334.00 has not reached it yet.',
      },
      {
        'question': 'An OCO pair contains a buy limit at 1.0820 and a buy stop at 1.0880. The buy limit fills. What happens to the buy stop?',
        'options': ['Both stay active', 'It becomes a buy limit', 'It is cancelled', 'It is moved to the fill price'],
        'answer': 2,
        'explanation': 'In an OCO pair, the fill of one order cancels the other, so you end up with one long position, not two.',
      },
      {
        'question': 'On a netting account you are long 0.60 lot EURUSD at 1.0850 and sell 0.20 lot at 1.0880. What is the outcome?',
        'options': [
          'Long 0.60 lot and short 0.20 lot as separate positions',
          'Long 0.40 lot at 1.0860 with nothing realised',
          'Short 0.20 lot at 1.0880',
          'Long 0.40 lot at 1.0850 and +60 USD realised',
        ],
        'answer': 3,
        'explanation': 'Netting reduces the existing position. The closed 0.20 lot realises (1.0880 - 1.0850) x 20,000 = 60 USD, and 0.40 lot stays open at the original 1.0850. Separate positions would only occur in hedging mode.',
      },
      {
        'question': 'A sell stop sits at 1.0800. EURUSD closes Friday at 1.0830 and opens Monday at 1.0770. Where is the order most likely filled?',
        'options': ['At 1.0800 exactly', 'Around 1.0770, the first available price', 'It is cancelled', "At Friday's close of 1.0830"],
        'answer': 1,
        'explanation':
            'No trading took place at 1.0800. The stop is triggered by the first price after the gap and becomes a market order, filled around 1.0770.',
      },
      {
        'question': 'You plan to risk 60 USD on XAUUSD with a stop 6.00 away from entry. What position size fits?',
        'options': ['1.00 lot', '0.01 lot', '0.60 lot', '0.10 lot'],
        'answer': 3,
        'explanation': 'You need 60 / 6.00 = 10 USD per 1.00 move. One gold lot is 100 oz, worth 100 USD per 1.00, so 10 / 100 = 0.10 lot.',
      },
    ],
  },
  'phase-3': {'pass_mark': 70, 'count': 15},
  'phase-4': {'pass_mark': 70, 'count': 15},
  'phase-5': {'pass_mark': 70, 'count': 15},
  'phase-6': {'pass_mark': 70, 'count': 15},
  'phase-7': {'pass_mark': 70, 'count': 15},
  'phase-8': {'pass_mark': 70, 'count': 15},
  'phase-9': {
    'pass_mark': 70,
    'count': 16,
    'questions': [
      {
        'question': 'Which statement about the seller, or writer, of an option is correct?',
        'options': [
          'They pay the premium and gain the right to the payoff',
          'They receive the premium and must pay the payout if the option finishes in the money',
          'Their maximum loss is the premium received',
          'They must deliver the underlying at expiry',
        ],
        'answer': 1,
        'explanation': 'The seller collects the premium upfront and must pay the payout if the option ends in the money. The gain is capped at the premium, while the loss can be far larger. Kalks options are cash-settled, so nothing is delivered.',
      },
      {
        'question': 'How does buying a Kalks option differ from opening a CFD position?',
        'options': [
          'The buyer pays the full premium upfront with no leverage, and that premium is the maximum loss',
          'Options use more leverage than CFDs',
          'Options never lose value over time',
          'Options can be held indefinitely without an expiry',
        ],
        'answer': 0,
        'explanation': 'A bought option is paid for in full, so there is no leverage and the premium is the most you can lose. A CFD uses margin and leverage, and its loss can exceed a planned stop. Options lose time value and always have an expiry.',
      },
      {
        'question': 'EURUSD trades at 1.1650. Which of these options is in the money?',
        'options': ['The 1.1700 call', 'The 1.1600 put', 'The 1.1700 put', 'The 1.1750 call'],
        'answer': 2,
        'explanation': 'A put is in the money when the price is below its strike. At 1.1650 the 1.1700 put would pay 0.0050 now. The 1.1700 and 1.1750 calls and the 1.1600 put would pay nothing.',
      },
      {
        'question': 'You buy one XAUUSD 3,900 call for 85 USD. Gold settles at 3,960. What is your result?',
        'options': ['+60 USD', '-25 USD', '+145 USD', '-85 USD'],
        'answer': 1,
        'explanation': 'The call pays (3,960 - 3,900) x 1 ounce = 60 USD. After the 85 USD premium the result is 60 - 85 = -25 USD: the option finished in the money, but not by enough to cover its cost.',
      },
      {
        'question': 'EURUSD is at 1.1650 and a 1.1700 put costs 0.0070. How does that premium split?',
        'options': [
          'Intrinsic value 0.0050, time value 0.0020',
          'Intrinsic value 0, time value 0.0070',
          'Intrinsic value 0.0070, time value 0',
          'Intrinsic value 0.0020, time value 0.0050',
        ],
        'answer': 0,
        'explanation': 'Put intrinsic value is strike minus spot: 1.1700 - 1.1650 = 0.0050. The rest of the premium, 0.0070 - 0.0050 = 0.0020, is time value, which falls to zero at the cut.',
      },
      {
        'question': 'A weekly expiry falls on a Friday that is a holiday. When do those options expire?',
        'options': [
          'On the following Monday at the cut',
          'At the Friday close regardless of the holiday',
          'They are cancelled and the premium is refunded',
          'On the previous business day, at the 10:00 New York cut',
        ],
        'answer': 3,
        'explanation': 'Expiries that fall on a holiday move to the previous business day, usually the Thursday, and settle at the normal cut against the 30-minute average of the mid price.',
      },
      {
        'question': 'You buy one XAUUSD 3,850 put for 54 USD. Gold settles at 3,700. What is your result?',
        'options': ['+150 USD', '-54 USD', '+204 USD', '+96 USD'],
        'answer': 3,
        'explanation': 'The put pays (3,850 - 3,700) x 1 ounce = 150 USD. Subtracting the 54 USD premium gives +96 USD. The breakeven was 3,850 - 54 = 3,796.',
      },
      {
        'question': 'What is the breakeven at expiry of a short EURUSD 1.1600 put sold for 0.0030?',
        'options': ['1.1630', '1.1600', '1.1570', '1.1300'],
        'answer': 2,
        'explanation': 'A put breaks even at the strike minus the premium: 1.1600 - 0.0030 = 1.1570. Buyer and seller share the same breakeven; below it, the seller loses.',
      },
      {
        'question': 'Before a central-bank decision you buy a straddle. After the decision the price barely moves and implied volatility drops sharply. What is the most likely outcome?',
        'options': [
          'The straddle gains, because event days always pay option buyers',
          'The straddle loses value through falling implied volatility and time decay',
          "The straddle's value stays unchanged until expiry",
          'The straddle is knocked out',
        ],
        'answer': 1,
        'explanation': 'Without a large move, the straddle loses through vega as implied volatility collapses, and through theta as time passes. This volatility crush is a common surprise for option buyers around events.',
      },
      {
        'question': 'A EURUSD put has a delta of -0.30. For small moves, one contract behaves most like which CFD position?',
        'options': [
          'A long position of about 3,000 euros',
          'A short position of about 10,000 euros',
          'A short position of about 3,000 euros, or 0.03 lot',
          'No exposure until expiry',
        ],
        'answer': 2,
        'explanation': 'Equivalent exposure is delta x contract size: -0.30 x 10,000 = -3,000 euros, a short position of about 0.03 lot. It changes as the price moves, because of gamma.',
      },
      {
        'question': 'You buy a XAUUSD 3,900 put at 76 USD and sell a 3,800 put at 35 USD, same expiry. Gold settles at 3,750. What is the result?',
        'options': ['+59 USD', '+109 USD', '-41 USD', '+150 USD'],
        'answer': 0,
        'explanation': 'The bought put pays 150 USD and the sold put costs 50 USD, a net payout of 100 USD, the maximum for this bear put spread. After the 41 USD net premium, the result is +59 USD.',
      },
      {
        'question': 'You expect EURUSD to stay in a range and want your maximum loss fixed in advance. Which strategy fits best?',
        'options': ['Long straddle', 'Short strangle', 'Long call', 'Iron condor'],
        'answer': 3,
        'explanation': 'An iron condor earns its credit if the price stays between the sold strikes, and the bought wings cap the loss. A short strangle also profits from a range, but its loss is unlimited; a long straddle needs a large move.',
      },
      {
        'question':
            'You hold a XAUUSD 3,850 down-and-in put with a barrier at 3,700. Gold falls to a low of 3,720 and settles at 3,760. What does the option pay?',
        'options': ['90 USD', 'Nothing, because the barrier was never touched', '150 USD', 'The premium back'],
        'answer': 1,
        'explanation': 'A knock-in only comes alive if the barrier is touched. Gold never reached 3,700, so the option expires worthless even though a standard 3,850 put would have paid 90 USD.',
      },
      {
        'question': 'Which price does Kalks use to decide whether a barrier has been touched?',
        'options': [
          "The underlying's mid price, monitored continuously until the cut",
          'The daily closing bid',
          'The settlement average at the cut only',
          'The ask price, checked once an hour',
        ],
        'answer': 0,
        'explanation': 'The barrier is watched continuously on the mid price. Because charts normally plot the bid, the mid can touch an up-barrier slightly before the bid line on your chart does.',
      },
      {
        'question': 'Why is margin for sold options higher on Fridays?',
        'options': [
          'Because spreads are always wider on Fridays',
          'Because options cannot be closed on Fridays',
          'Because premiums are only paid on Fridays',
          'To cover the risk of a gap when the market reopens after the weekend',
        ],
        'answer': 3,
        'explanation': "A weekend add-on is applied on Fridays because prices can reopen far from Friday's close, and a short option cannot be closed or protected while the market is shut.",
      },
      {
        'question': 'Which statement about Kalks FX Options is true?',
        'options': [
          'A seller can be assigned at any time before expiry',
          'In-the-money options are settled by delivering the currency',
          'There is no early exercise or assignment, because the options are European and cash-settled',
          'Sellers need no margin because they receive the premium',
        ],
        'answer': 2,
        'explanation': 'European, cash-settled options can only settle at expiry, in USD, so there is no assignment. Sellers still post scenario-based margin, because their potential loss can be far larger than the premium.',
      },
    ],
  },
};

const List<Map<String, Object?>> _terms = [
  {
    'slug': 'account-group',
    'term': 'Account group',
    'category': 'Platform',
    'definition': 'A configuration set that defines the trading conditions for a set of accounts, including spreads, commission, maximum leverage, swap rules and margin call and stop-out levels. Two clients with different account groups can see different conditions on the same symbol.',
    'related': ['leverage', 'spread', 'stop-out-level'],
  },
  {
    'slug': 'actual-consensus-previous',
    'term': 'Actual, consensus and previous',
    'category': 'Fundamental analysis',
    'definition': "The three figures shown for each economic calendar release: the newly published value, the average forecast of economists before the release, and the prior period's value (sometimes revised). Markets react mainly to the gap between actual and consensus, not to the absolute number.",
    'related': ['economic-calendar'],
  },
  {
    'slug': 'analysis-paralysis',
    'term': 'Analysis paralysis',
    'category': 'Psychology',
    'definition': 'Being unable to act because of too many indicators, timeframes or opinions that never fully agree. It usually leads to missed valid setups followed by impulsive late entries. A written trading plan with a short checklist of required conditions is the practical remedy.',
    'related': ['trading-plan', 'fomo'],
  },
  {
    'slug': 'anchoring-bias',
    'term': 'Anchoring bias',
    'category': 'Psychology',
    'definition': 'Relying too heavily on the first number you saw, such as your entry price or a recent high. A trader who bought XAUUSD at 2,380 may refuse to exit at 2,340 because the market "should" return to the entry, even though price has no memory of that level.',
    'related': ['confirmation-bias'],
  },
  {
    'slug': 'ascending-triangle',
    'term': 'Ascending triangle',
    'category': 'Technical analysis',
    'definition': 'A chart pattern with a flat resistance line and rising lows beneath it, showing buyers stepping in at higher prices each time. It is commonly read as a bullish continuation pattern, confirmed only when price closes above the flat resistance. Failed breakouts back into the triangle are common.',
    'related': ['breakout', 'resistance'],
  },
  {
    'slug': 'ask-price',
    'term': 'Ask price',
    'category': 'Trading mechanics',
    'definition': 'The price at which you can buy an instrument right now; it is always the higher of the two quoted prices. If EURUSD is quoted 1.0850 / 1.0851, a market buy order is filled at the ask of 1.0851, subject to any slippage.',
    'related': ['bid-price', 'spread', 'market-order'],
  },
  {
    'slug': 'asset-class',
    'term': 'Asset class',
    'category': 'Markets',
    'definition': 'A group of instruments that share similar characteristics and respond to similar drivers. On Kalks the main asset classes are forex, metals, stock indices, energies, cryptocurrencies and US stocks, all traded as CFDs. Each class has its own trading hours, volatility and cost profile.',
    'related': ['cfd'],
  },
  {
    'slug': 'atr',
    'term': 'Average True Range (ATR)',
    'category': 'Technical analysis',
    'definition': 'An indicator that measures average price range per candle over a set period, usually 14, including gaps between candles. An ATR of 18.00 on the daily XAUUSD chart means gold has recently moved about \$18 per day. Traders use it to size stops to current volatility rather than using fixed distances.',
    'related': ['volatility', 'stop-loss'],
  },
  {
    'slug': 'backtesting',
    'term': 'Backtesting',
    'category': 'Technical analysis',
    'definition': 'Testing a set of trading rules on historical price data to see how they would have performed. In Kalks, strategies built under Client Area, Developer, Strategies can be tested in Developer, Backtests. Past results never guarantee future performance and must account for spreads, commission and swaps.',
    'related': ['overfitting'],
  },
  {
    'slug': 'bid-price',
    'term': 'Bid price',
    'category': 'Trading mechanics',
    'definition': 'The price at which you can sell an instrument right now; it is always the lower of the two quoted prices. Long positions are closed at the bid, which is why a new buy trade immediately shows a small loss equal to the spread.',
    'related': ['ask-price', 'spread'],
  },
  {
    'slug': 'breakout',
    'term': 'Breakout',
    'category': 'Technical analysis',
    'definition': 'A decisive move through a support, resistance or pattern boundary, ideally with a candle close beyond the level and rising momentum. Breakout traders aim to join the new move early, accepting that many breakouts fail and reverse back into the range.',
    'related': ['resistance'],
  },
  {
    'slug': 'candlestick',
    'term': 'Candlestick',
    'category': 'Technical analysis',
    'definition': 'A chart element showing the open, high, low and close of one period. The body spans open to close and is coloured by direction; the wicks show the extremes. On a one-hour chart, each candle summarises sixty minutes of trading.',
    'related': [],
  },
  {
    'slug': 'carry-trade',
    'term': 'Carry trade',
    'category': 'Fundamental analysis',
    'definition': 'A strategy of buying a higher-yielding currency against a lower-yielding one to earn the interest differential through positive swaps. With Australian rates at 4.35% and Japanese rates at 0.10%, long AUDJPY earns carry, but sharp exchange-rate losses in risk-off episodes can erase months of interest quickly.',
    'related': ['interest-rate', 'swap'],
  },
  {
    'slug': 'central-bank',
    'term': 'Central bank',
    'category': 'Fundamental analysis',
    'definition': "The institution that sets a country's monetary policy, manages its currency and supervises parts of the banking system, such as the Federal Reserve, ECB, Bank of England or Bank of Japan. Its interest-rate decisions and guidance are among the strongest long-term drivers of currency values.",
    'related': ['interest-rate'],
  },
  {
    'slug': 'cot-report',
    'term': 'Commitments of Traders (COT) report',
    'category': 'Fundamental analysis',
    'definition': 'A weekly CFTC report showing the futures positions of commercial hedgers, large speculators and others as of Tuesday, published on Friday. Traders use it to judge whether speculative positioning in currencies, gold or oil has become stretched.',
    'related': ['carry-trade'],
  },
  {
    'slug': 'confirmation-bias',
    'term': 'Confirmation bias',
    'category': 'Psychology',
    'definition': 'The tendency to notice evidence that supports an existing view while dismissing evidence against it. A trader long on NAS100 may read every news item as bullish and ignore a broken support level. Writing down in advance what would prove the idea wrong helps counter it.',
    'related': ['anchoring-bias'],
  },
  {
    'slug': 'cpi',
    'term': 'Consumer Price Index (CPI)',
    'category': 'Fundamental analysis',
    'definition': 'A monthly measure of the change in prices of a basket of consumer goods and services. Headline CPI includes food and energy; core CPI excludes them. A US CPI print above consensus usually lifts the dollar and Treasury yields because it raises expectations of tighter Fed policy.',
    'related': ['inflation', 'central-bank'],
  },
  {
    'slug': 'cfd',
    'term': 'Contract for difference (CFD)',
    'category': 'Markets',
    'definition': "A derivative contract in which you exchange the difference in an asset's price between opening and closing the trade, without owning the asset itself. CFDs allow long and short trading with leverage. Because they are leveraged, losses can build quickly and can exceed what you expected to risk.",
    'related': ['leverage', 'margin'],
  },
  {
    'slug': 'drawdown',
    'term': 'Drawdown',
    'category': 'Risk management',
    'definition': 'The decline in account equity from a peak to a subsequent low, expressed in money or percentage. Losses require larger gains to recover: a 20% drawdown needs a 25% gain to get back to the peak, and a 50% drawdown needs 100%.',
    'related': [],
  },
  {
    'slug': 'economic-calendar',
    'term': 'Economic calendar',
    'category': 'Fundamental analysis',
    'definition': 'A schedule of upcoming data releases, central-bank decisions and events, showing time, impact level, consensus and previous values. Kalks provides one in the Client Area. Checking it before trading helps you avoid being caught by high-impact news with a position you did not plan for.',
    'related': ['actual-consensus-previous', 'nfp', 'cpi'],
  },
  {
    'slug': 'expectancy',
    'term': 'Expectancy',
    'category': 'Risk management',
    'definition': 'The average amount a strategy expects to win or lose per trade over many trades. With a 40% win rate, average win of 2R and average loss of 1R, expectancy is 0.4 x 2 minus 0.6 x 1, which equals +0.2R per trade before costs.',
    'related': [],
  },
  {
    'slug': 'fomo',
    'term': 'Fear of missing out (FOMO)',
    'category': 'Psychology',
    'definition': 'The urge to enter a trade because price is moving fast and you fear missing the move. FOMO entries are usually late, far from a logical stop, and taken without plan conditions. Accepting that other opportunities will come is the most effective antidote.',
    'related': ['trading-plan'],
  },
  {
    'slug': 'fibonacci-retracement',
    'term': 'Fibonacci retracement',
    'category': 'Technical analysis',
    'definition': 'Horizontal levels drawn between a swing low and high at ratios such as 38.2%, 50% and 61.8% to highlight possible pullback areas. For a gold move from 2,300 to 2,400, the 50% level is 2,350 and the 61.8% level is 2,338.20.',
    'related': [],
  },
  {
    'slug': 'gdp',
    'term': 'Gross domestic product (GDP)',
    'category': 'Fundamental analysis',
    'definition': 'The total value of goods and services produced by an economy over a period, usually reported quarterly and annualised. Strong GDP growth supports a currency via expectations of higher rates, though markets often react more to timelier data such as PMIs.',
    'related': [],
  },
  {
    'slug': 'inflation',
    'term': 'Inflation',
    'category': 'Fundamental analysis',
    'definition': 'The rate at which the general price level rises, reducing the purchasing power of money. Central banks typically target around 2% a year. Inflation above target tends to prompt higher rates, which affects currencies, bond yields, gold and stock valuations.',
    'related': ['cpi'],
  },
  {
    'slug': 'interest-rate',
    'term': 'Interest rate',
    'category': 'Fundamental analysis',
    'definition': 'The cost of borrowing money, with the policy rate set by the central bank. Higher rates relative to other countries tend to attract capital and support a currency. Interest-rate differentials also determine the swap you pay or earn on overnight positions.',
    'related': ['central-bank', 'carry-trade'],
  },
  {
    'slug': 'leverage',
    'term': 'Leverage',
    'category': 'Trading mechanics',
    'definition': "The ratio between a position's notional size and the margin required to open it. At 1:100, \$1,000 of margin controls a \$100,000 position. Leverage magnifies both profits and losses equally; it does not change the direction of your risk, only its speed.",
    'related': ['margin', 'margin-level'],
  },
  {
    'slug': 'lot',
    'term': 'Lot',
    'category': 'Trading mechanics',
    'definition': 'The unit used to express trade size in the terminal. One lot equals one contract size, so 1.00 lot of EURUSD is 100,000 euros and 1.00 lot of XAUUSD is 100 ounces. On Kalks the minimum trade is 0.01 lot.',
    'related': [],
  },
  {
    'slug': 'macd',
    'term': 'MACD',
    'category': 'Technical analysis',
    'definition': 'Moving Average Convergence Divergence, an indicator plotting the difference between two EMAs, usually 12 and 26 periods, together with a 9-period signal line. Crossovers and the histogram measure momentum shifts; divergence with price can warn of a weakening trend.',
    'related': [],
  },
  {
    'slug': 'margin',
    'term': 'Margin',
    'category': 'Trading mechanics',
    'definition': 'The collateral required to open and hold a leveraged position. On Kalks it is notional value divided by leverage, adjusted by any symbol margin percentage. One lot of EURUSD at 1.0850 is \$108,500 notional, so at 1:100 the margin required is \$1,085.',
    'related': ['leverage', 'margin-level'],
  },
  {
    'slug': 'margin-call',
    'term': 'Margin call',
    'category': 'Trading mechanics',
    'definition': 'A warning that your margin level has fallen to a threshold, typically 100%, meaning equity equals used margin. At that point you usually cannot open new positions. It is a signal to reduce exposure or add funds before the stop-out level is reached.',
    'related': ['margin-level'],
  },
  {
    'slug': 'margin-level',
    'term': 'Margin level',
    'category': 'Trading mechanics',
    'definition': "Equity divided by used margin, multiplied by 100%. With equity of \$2,000 and used margin of \$1,000, margin level is 200%. It falls as floating losses rise, and the broker's margin call and stop-out rules are triggered by this figure.",
    'related': ['margin-call'],
  },
  {
    'slug': 'market-order',
    'term': 'Market order',
    'category': 'Trading mechanics',
    'definition': 'An instruction to buy or sell immediately at the best available price, buying at the ask and selling at the bid. Market orders guarantee execution in normal conditions but not the exact price, especially in fast-moving markets.',
    'related': ['pending-order', 'slippage'],
  },
  {
    'slug': 'moving-average',
    'term': 'Moving average',
    'category': 'Technical analysis',
    'definition': 'An indicator showing the average closing price over a set number of periods, smoothing out noise to reveal direction. Price above a rising 200-day average suggests a long-term uptrend. Moving averages lag price and work poorly in sideways markets.',
    'related': [],
  },
  {
    'slug': 'nfp',
    'term': 'Non-farm payrolls (NFP)',
    'category': 'Fundamental analysis',
    'definition': 'The monthly US employment report of jobs added outside the farming sector, usually released on the first Friday of the month at 08:30 New York time. It is among the most market-moving releases for the dollar, gold and US indices.',
    'related': ['economic-calendar'],
  },
  {
    'slug': 'overfitting',
    'term': 'Overfitting',
    'category': 'Technical analysis',
    'definition': 'Tuning a strategy so closely to past data that it captures random noise instead of a durable pattern. An overfitted backtest looks excellent but fails on new data. Fewer parameters, out-of-sample testing and walk-forward analysis help reduce it.',
    'related': ['backtesting'],
  },
  {
    'slug': 'pending-order',
    'term': 'Pending order',
    'category': 'Trading mechanics',
    'definition': 'An order to open a position only when price reaches a specified level. The four main types are buy limit, sell limit, buy stop and sell stop, with stop-limit orders adding a limit price after the trigger. Pending orders let you plan entries without watching the screen.',
    'related': [],
  },
  {
    'slug': 'pip',
    'term': 'Pip',
    'category': 'Trading mechanics',
    'definition': 'The standard unit of price movement in forex: 0.0001 for most pairs and 0.01 for JPY pairs. EURUSD moving from 1.0850 to 1.0875 is a 25-pip move; USDJPY moving from 150.00 to 150.40 is 40 pips.',
    'related': [],
  },
  {
    'slug': 'rsi',
    'term': 'Relative Strength Index (RSI)',
    'category': 'Technical analysis',
    'definition': 'A momentum oscillator, usually calculated over 14 periods, that compares the size of recent gains with recent losses on a scale of 0 to 100. Readings above 70 are called overbought and below 30 oversold. In strong trends RSI can stay at extremes, so divergence and context matter more than the thresholds.',
    'related': [],
  },
  {
    'slug': 'resistance',
    'term': 'Resistance',
    'category': 'Technical analysis',
    'definition': 'A price area where selling has previously halted rallies, forming a ceiling. The more clearly a level has turned price, the more attention it gets. Once broken decisively, resistance often becomes support on a retest.',
    'related': ['support', 'breakout'],
  },
  {
    'slug': 'risk-reward-ratio',
    'term': 'Risk-reward ratio',
    'category': 'Risk management',
    'definition': 'The relationship between potential loss and potential gain on a trade. A 20-pip stop with a 50-pip target gives 1:2.5. Higher ratios need a lower win rate to break even: at 1:2 the break-even win rate before costs is about 33.3%.',
    'related': ['take-profit'],
  },
  {
    'slug': 'slippage',
    'term': 'Slippage',
    'category': 'Trading mechanics',
    'definition': 'The difference between the expected price of an order and the actual fill. If you buy at 1.0851 but are filled at 1.0853, slippage is 2 pips against you. It is most common during news and low liquidity, and can occasionally be positive.',
    'related': ['market-order'],
  },
  {
    'slug': 'spread',
    'term': 'Spread',
    'category': 'Trading mechanics',
    'definition': 'The difference between the bid and ask price and the main built-in cost of a trade. With EURUSD at 1.0850 / 1.0851 the spread is 1 pip, or \$10 per standard lot. On XAUUSD at 2,350.40 / 2,350.70, the \$0.30 spread costs \$30 per lot.',
    'related': ['ask-price', 'bid-price'],
  },
  {
    'slug': 'stop-loss',
    'term': 'Stop loss',
    'category': 'Trading mechanics',
    'definition': 'An order that closes a position automatically at a predefined loss level. Buying EURUSD at 1.0851 with a stop at 1.0826 limits the planned loss to 25 pips. In gaps and fast markets the stop can be filled at a worse price.',
    'related': ['take-profit', 'trailing-stop'],
  },
  {
    'slug': 'stop-out-level',
    'term': 'Stop-out level',
    'category': 'Platform',
    'definition': 'The margin level at which forced closing begins, typically 50% on Kalks depending on account group. With used margin of \$1,000, stop-out begins when equity falls to \$500. It is a last-resort safety mechanism, not a risk plan.',
    'related': ['margin-call', 'account-group'],
  },
  {
    'slug': 'support',
    'term': 'Support',
    'category': 'Technical analysis',
    'definition': 'A price area where buying has previously halted declines, forming a floor. It is best seen as a zone rather than an exact price. Once broken decisively, support often becomes resistance on a later retest.',
    'related': ['resistance'],
  },
  {
    'slug': 'swap',
    'term': 'Swap',
    'category': 'Trading mechanics',
    'definition': "The overnight financing charged or credited on positions held past 00:00 server time. Its size depends on the interest-rate differential and the broker's fee, and it can be positive or negative. Crypto swaps are charged every night.",
    'related': [],
  },
  {
    'slug': 'take-profit',
    'term': 'Take profit',
    'category': 'Trading mechanics',
    'definition': 'An order that closes a position automatically once a target is reached, locking in gains. Buying XAUUSD at 2,350.40 with a take profit at 2,370.40 closes the trade after a \$20 rise, worth \$2,000 on 1.00 lot.',
    'related': ['stop-loss', 'risk-reward-ratio'],
  },
  {
    'slug': 'trading-plan',
    'term': 'Trading plan',
    'category': 'Psychology',
    'definition': 'A written document that defines what, when and how you trade: markets, setups, entry and exit rules, risk per trade, daily limits and review routine. It turns trading decisions into rules decided calmly in advance, rather than under pressure.',
    'related': [],
  },
  {
    'slug': 'trailing-stop',
    'term': 'Trailing stop',
    'category': 'Trading mechanics',
    'definition': 'A stop loss that automatically follows price as a trade moves in your favour by a set distance, but never moves back. On Kalks it is managed server-side. A 20-pip trailing stop on a long from 1.0850 would sit at 1.0860 once the bid reaches 1.0880.',
    'related': ['stop-loss', 'trend'],
  },
  {
    'slug': 'trend',
    'term': 'Trend',
    'category': 'Technical analysis',
    'definition': 'The general direction of price over a period, identified by swing structure, moving averages or trendlines. Trends exist on every timeframe and can conflict: the daily trend may be up while the hourly chart is falling.',
    'related': [],
  },
  {
    'slug': 'volatility',
    'term': 'Volatility',
    'category': 'Markets',
    'definition': 'How much and how quickly a price changes. High volatility means larger moves, wider stops and bigger potential gains and losses. XAUUSD and BTCUSD are typically more volatile than EURUSD, so the same lot size carries more risk.',
    'related': ['atr'],
  },
  {
    'slug': 'yield-curve',
    'term': 'Yield curve',
    'category': 'Fundamental analysis',
    'definition': 'A chart of government bond yields across maturities. Normally longer maturities yield more. When short yields exceed long ones, such as a 2-year at 4.8% and a 10-year at 4.2%, the curve is inverted, which has often preceded recessions.',
    'related': ['interest-rate'],
  },
];
