// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /academy, /academy/glossary, /academy/progress; detail /academy/phase/:phase, /academy/phase/:phase/exam, /academy/chapter/:slug.
// /academy/coach is gated in live builds and stays the router's stub.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'academy_home_screen.dart';
import 'chapter_screen.dart';
import 'exam_screen.dart';
import 'glossary_screen.dart';
import 'phase_screen.dart';
import 'progress_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> academyScreens = {
  '/academy': (s) => const AcademyHomeScreen(),
  '/academy/glossary': (s) {
    final q = s.uri.queryParameters['q'];
    return AcademyGlossaryScreen(key: ValueKey('glossary-${q ?? ''}'), q: q);
  },
  '/academy/progress': (s) => const AcademyProgressScreen(),
};

/// Detail pages (iOS push).
final List<RouteBase> academyRoutes = [
  GoRoute(
    path: '/academy/phase/:phase',
    builder: (c, s) => AcademyPhaseScreen(key: ValueKey('phase-${s.pathParameters['phase']}'), slug: s.pathParameters['phase']!),
  ),
  GoRoute(
    path: '/academy/phase/:phase/exam',
    builder: (c, s) => AcademyExamScreen(key: ValueKey('exam-${s.pathParameters['phase']}'), phase: s.pathParameters['phase']!),
  ),
  GoRoute(
    path: '/academy/chapter/:slug',
    builder: (c, s) => AcademyChapterScreen(key: ValueKey('chapter-${s.pathParameters['slug']}'), slug: s.pathParameters['slug']!),
  ),
];
