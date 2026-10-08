import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kalks/router/router.dart';

import '../helpers/test_app.dart';

/// Brings `f` to the middle of the screen (clear of the frosted header and tab bar).
Future<void> _show(WidgetTester tester, Finder f) async {
  await Scrollable.ensureVisible(tester.element(f), alignment: 0.5);
  await tester.pump(const Duration(milliseconds: 200));
}

void main() {
  testWidgets('academy home shows the continue hero, stats and phase cards, and opens a phase', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/academy');
    await settle(tester);

    expect(find.text('Academy'), findsWidgets);
    expect(find.text('Continue learning'), findsWidgets);
    expect(find.text('Stop loss, take profit and trailing stops'), findsOneWidget);
    expect(find.text('Resume chapter'), findsOneWidget);
    expect(find.text('Learning streak'.toUpperCase()), findsOneWidget);

    final card = find.byKey(const ValueKey('phase-card-phase-1'));
    await _show(tester, card);
    expect(find.text('Markets and instruments'), findsWidgets);
    expect(find.text('Certified'), findsWidgets);
    await tester.tap(card);
    await settle(tester);

    expect(find.text('Phase 1 of 8'), findsOneWidget);
    expect(find.text('Chapters'), findsOneWidget);
    expect(find.byKey(const ValueKey('section-fundamental')), findsOneWidget);
    // the track filter shows one track at a time
    await _show(tester, find.text('Technical'));
    await tester.tap(find.text('Technical'));
    await settle(tester);
    expect(find.byKey(const ValueKey('section-fundamental')), findsNothing);
    expect(find.byKey(const ValueKey('section-technical')), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('chapter reader renders the markdown and grades a quiz answer', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    unawaited(c.read(routerProvider).push('/academy/chapter/p2-f-pips-and-points'));
    await settle(tester);

    expect(find.text('Pips, points and pip value'), findsOneWidget);
    expect(find.text('Chapter 1 of 7'), findsOneWidget);
    expect(find.text('What a pip is'), findsOneWidget);

    await _show(tester, find.text('Key takeaways'));
    expect(find.text('Key takeaways'), findsOneWidget);

    // question 1: "EURUSD moves from 1.0850 to 1.0885. How many pips is that?" -> 35 pips
    final option = find.text('35 pips');
    await _show(tester, option);
    expect(find.text('Chapter quiz'), findsOneWidget);
    expect(find.text('0 of 4 answered'), findsOneWidget);
    await tester.tap(option);
    await settle(tester);
    expect(find.textContaining('Correct.', findRichText: true), findsOneWidget);
    expect(find.text('1 of 4 answered'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('final exam: locked phase, then a full attempt with a result', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    unawaited(c.read(routerProvider).push('/academy/phase/phase-2/exam'));
    await settle(tester);
    expect(find.text('The exam unlocks when every chapter is complete'), findsOneWidget);
    expect(find.text('Back to the chapters'), findsOneWidget);
    await unmount(tester);

    final c2 = await pumpApp(tester, signedIn: true);
    unawaited(c2.read(routerProvider).push('/academy/phase/phase-9/exam'));
    await settle(tester);
    expect(find.text('Phase 9 exam: Kalks FX Options'), findsOneWidget);
    expect(find.text('0 of 16 answered'), findsOneWidget);
    for (var qi = 0; qi < 16; qi++) {
      final q = find.byKey(ValueKey('exam-q-$qi'));
      final first = find.descendant(of: q, matching: find.text('A'));
      await _show(tester, first);
      await tester.tap(first);
      await tester.pump();
    }
    expect(find.text('16 of 16 answered'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('exam-submit')));
    await settle(tester);
    expect(find.byKey(const ValueKey('exam-result')), findsOneWidget);
    expect(find.text('Retake exam'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('glossary search and my progress', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/academy/glossary?q=spread');
    await settle(tester);
    expect(find.text('Glossary'), findsWidgets);
    expect(find.text('Spread'), findsWidgets);
    final count = tester.widget<Text>(find.byKey(const ValueKey('glossary-count'))).data!;
    expect(count, isNot('0 terms'));

    c.read(routerProvider).go('/academy/progress');
    await settle(tester);
    expect(find.text('My progress'), findsWidgets);
    expect(find.text('Chapters complete'), findsOneWidget);
    await _show(tester, find.text('By phase'));
    expect(find.text('By phase'), findsOneWidget);
    await _show(tester, find.byKey(const ValueKey('certificate-tile')));
    expect(find.textContaining('KA-7Q2MD-XK9PF · issued'), findsWidgets);
    await unmount(tester);
  });
}
