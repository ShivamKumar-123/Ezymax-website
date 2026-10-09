// Screenshots of the Support module in light, dark and Arabic: the Support page (top and scrolled), the live chat's
// states (a new chat with the bot writing, the rating after the end, the queue for a person, the chat sheet of the
// floating button), Ask Ezymex AI on the Dashboard (pill, sheet, streaming, answered, the open request for a person:
// note, held question, sent to the team, closed and asked) and the floating launcher with its badge.
// Run: flutter test test_shots/c1_support_shots_test.dart --update-goldens
import 'dart:async';

import 'package:ezymex/app.dart';
import 'package:ezymex/features/support/launcher.dart';
import 'package:ezymex/features/support/support_data.dart';
import 'package:ezymex/preview/c1/preview_support.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../test/helpers/test_app.dart';
import 'shots.dart';

SupportFrames _frames(WidgetTester tester) => ProviderScope.containerOf(tester.element(find.byType(EzymexApp))).read(supportFramesProvider);

/// Plays the bot's streamed answer into the open conversation.
Future<void> _stream(WidgetTester tester, String text) async {
  final id = PreviewSupport.openId;
  _frames(tester)
    ..add({'type': 'bot.typing', 'conversationId': id, 'streamId': 'shot'})
    ..add({'type': 'bot.delta', 'conversationId': id, 'streamId': 'shot', 'text': text});
  await settle(tester, frames: 4);
}

/// Lets the 2.5 s poll (no live stream in tests) bring the answer.
Future<void> _poll(WidgetTester tester) async {
  for (var i = 0; i < 3; i++) {
    await tester.pump(const Duration(milliseconds: 2600));
    await settle(tester, frames: 4);
  }
}

/// Scrolls the Support page by `dy` through its own position (a drag in the middle would scroll the chat's messages).
Future<void> Function(WidgetTester) _scrollPage(double dy) => (tester) async {
  final page = find.byType(KPageScroll);
  final pos = tester.state<ScrollableState>(find.descendant(of: page, matching: find.byType(Scrollable)).first).position;
  pos.jumpTo((pos.pixels + dy).clamp(pos.minScrollExtent, pos.maxScrollExtent));
  await settle(tester, frames: 4);
};

/// Taps one of the last quick replies, scrolling the sideways row to its end first (web: overflow-x-auto).
Future<void> _quick(WidgetTester tester, String label) async {
  final row = tester.state<ScrollableState>(find.descendant(of: find.byKey(const ValueKey('support-quick')), matching: find.byType(Scrollable))).position;
  row.jumpTo(row.maxScrollExtent);
  await settle(tester, frames: 2);
  await tester.tap(find.text(label));
  // only a moment: the 2.5 s poll would bring the whole answer before the streamed one is played
  await settle(tester, frames: 2);
}

Future<void> _openAi(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('ask-ai-pill')));
  await settle(tester);
}

const String _partial =
    "Here's what our help centre says about **Margin, margin call and stop-out**:\n\n**Margin level** = equity / used margin × 100%.\n\n- When the margin level falls to your account type's **margin call** level, we notify you.";

void main() {
  setUp(() => PreviewSupport.reset('agent'));

  const looks = [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'light', 'ar')];

  /* ---------------------------------------------------------------- Support page */

  for (final (name, theme, locale) in looks) {
    testWidgets('support page $name', (tester) async {
      await shotAt(tester, 'support-page-$name', '/support', theme: theme, locale: locale);
    });
    testWidgets('support page $name scrolled', (tester) async {
      await shotAt(tester, 'support-page-$name-2', '/support', theme: theme, locale: locale, before: _scrollPage(640));
    });
    testWidgets('support page $name bottom', (tester) async {
      await shotAt(tester, 'support-page-$name-3', '/support', theme: theme, locale: locale, before: _scrollPage(1400));
    });
  }

  for (final (name, theme, locale) in looks.take(2)) {
    testWidgets('chat new + bot writing $name', (tester) async {
      PreviewSupport.reset('none');
      await shotAt(
        tester,
        'support-chat-bot-$name',
        '/support',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await _quick(tester, 'What is a stop-out?');
          await _stream(tester, 'A **stop-out** happens when your margin level falls to the stop-out level of your account type:');
        },
      );
    });

    testWidgets('chat greeting $name', (tester) async {
      PreviewSupport.reset('none');
      await shotAt(tester, 'support-chat-greeting-$name', '/support', theme: theme, locale: locale);
    });

    testWidgets('chat rating $name', (tester) async {
      PreviewSupport.reset('bot');
      await shotAt(
        tester,
        'support-chat-rating-$name',
        '/support',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await tester.tap(find.byIcon(LucideIcons.ellipsis));
          await settle(tester);
          await tester.tap(find.text('End chat'));
          await settle(tester);
          await tester.tap(find.byIcon(LucideIcons.star).at(3));
          await settle(tester);
        },
      );
    });

    testWidgets('chat queue $name', (tester) async {
      PreviewSupport.reset('waiting');
      await shotAt(tester, 'support-chat-waiting-$name', '/support', theme: theme, locale: locale);
    });

    testWidgets('chat menu $name', (tester) async {
      await shotAt(
        tester,
        'support-chat-menu-$name',
        '/support',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await tester.tap(find.byIcon(LucideIcons.ellipsis));
          await settle(tester);
        },
      );
    });
  }

  /* ---------------------------------------------------------------- launcher + chat sheet */

  Future<void> launcherPage(WidgetTester tester) async {
    unawaited(
      rootNavigatorKey.currentState!.push(
        PageRouteBuilder<void>(
          pageBuilder: (context, _, _) => Stack(
            children: [
              const Positioned.fill(child: KBackdrop()),
              Positioned.fill(
                child: IgnorePointer(child: Container(color: context.k.bg.withValues(alpha: 0.2))),
              ),
              const SupportLauncher(path: '/'),
            ],
          ),
        ),
      ),
    );
    await settle(tester);
  }

  for (final (name, theme, locale) in looks) {
    testWidgets('launcher $name', (tester) async {
      await shotAt(
        tester,
        'support-launcher-$name',
        '/',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await launcherPage(tester);
          _frames(tester).add({
            'type': 'conversation',
            'conversation': {'id': 7801, 'status': 'assigned', 'assigneeName': 'Mei Lin', 'clientUnread': 2, 'createdAt': '2026-10-08T10:00:00Z'},
          });
        },
      );
    });

    testWidgets('chat sheet $name', (tester) async {
      await shotAt(
        tester,
        'support-chat-sheet-$name',
        '/',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await launcherPage(tester);
          await tester.tap(find.byKey(const ValueKey('support-launcher')));
          await settle(tester);
        },
      );
    });
  }

  /* ---------------------------------------------------------------- Ask Ezymex AI on the Dashboard */

  for (final (name, theme, locale) in looks) {
    testWidgets('ai pill $name', (tester) async {
      PreviewSupport.reset('none');
      await shotAt(tester, 'support-ai-pill-$name', '/', theme: theme, locale: locale);
    });

    testWidgets('ai sheet $name', (tester) async {
      PreviewSupport.reset('none');
      await shotAt(tester, 'support-ai-sheet-$name', '/', theme: theme, locale: locale, before: _openAi);
    });

    testWidgets('ai answered $name', (tester) async {
      PreviewSupport.reset('none');
      await shotAt(
        tester,
        'support-ai-answered-$name',
        '/',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await _openAi(tester);
          await tester.tap(find.byKey(const ValueKey('ai-chip-freeMargin')));
          await settle(tester);
          await _poll(tester);
        },
      );
    });
  }

  for (final (name, theme, locale) in looks.take(2)) {
    testWidgets('ai streaming $name', (tester) async {
      PreviewSupport.reset('none');
      await shotAt(
        tester,
        'support-ai-streaming-$name',
        '/',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await _openAi(tester);
          await tester.tap(find.byKey(const ValueKey('ai-chip-marginLevel')));
          await settle(tester);
          await _stream(tester, _partial);
        },
      );
    });

    testWidgets('ai open request $name', (tester) async {
      PreviewSupport.reset('waiting');
      await shotAt(tester, 'support-ai-team-1-open-request-$name', '/', theme: theme, locale: locale, before: _openAi);
    });

    testWidgets('ai held $name', (tester) async {
      PreviewSupport.reset('waiting');
      await shotAt(
        tester,
        'support-ai-team-2-held-$name',
        '/',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await _openAi(tester);
          await tester.tap(find.byKey(const ValueKey('ai-chip-deposit')));
          await settle(tester);
        },
      );
    });

    testWidgets('ai sent to team $name', (tester) async {
      PreviewSupport.reset('waiting');
      await shotAt(
        tester,
        'support-ai-team-3-result-$name',
        '/',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await _openAi(tester);
          await tester.tap(find.byKey(const ValueKey('ai-chip-deposit')));
          await settle(tester);
          await tester.tap(find.text('Send to our team'));
          await settle(tester);
        },
      );
    });

    testWidgets('ai closed and asked $name', (tester) async {
      PreviewSupport.reset('agent');
      await shotAt(
        tester,
        'support-ai-close-3-result-$name',
        '/',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await _openAi(tester);
          await tester.tap(find.byKey(const ValueKey('ai-chip-deposit')));
          await settle(tester);
          await tester.tap(find.text('Close it and ask Ezymex AI'));
          await settle(tester);
          await _poll(tester);
        },
      );
    });
  }
}
