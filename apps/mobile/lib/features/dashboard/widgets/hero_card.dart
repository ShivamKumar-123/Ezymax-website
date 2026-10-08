// The Kalks brand hero at the top of the Overview: the website's robot (kalks-website public/images/brand/
// src-hero-robot.png, cropped so the helmet sits on the trailing side) with "Trade like a sovereign." and the way into
// Kalks FX Options. Stock Kalks brand only: a white-label broker never sees Kalks imagery.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

class DashboardHero extends StatelessWidget {
  const DashboardHero({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return GestureDetector(
      onTap: () => context.go('/options'),
      child: Container(
        height: 188,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(k.cardRadius),
          boxShadow: [BoxShadow(color: k.ember.withValues(alpha: 0.28), offset: const Offset(0, 14), blurRadius: 30, spreadRadius: -14)],
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // the robot faces the text in both directions
            Transform.flip(
              flipX: rtl,
              child: Image.asset('assets/photos/hero-robot.jpg', fit: BoxFit.cover, alignment: const Alignment(1, -0.55), filterQuality: FilterQuality.high),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: AlignmentDirectional.centerStart,
                  end: AlignmentDirectional.centerEnd,
                  colors: [Colors.black.withValues(alpha: 0.86), Colors.black.withValues(alpha: 0.5), Colors.black.withValues(alpha: 0)],
                  stops: const [0, 0.48, 0.78],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(width: 18, height: 1.5, color: k.ember),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          t('options.page.title').toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.text.caption.copyWith(color: Colors.white.withValues(alpha: 0.78), fontWeight: FontWeight.w600, letterSpacing: 1.4),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  FractionallySizedBox(
                    widthFactor: 0.62,
                    child: Text(
                      t('app.dashboard.heroTitle'),
                      maxLines: 3,
                      style: context.text.title1.copyWith(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700, height: 1.12, letterSpacing: -0.4),
                    ),
                  ),
                  const Spacer(),
                  KButton(
                    label: t('options.intro.start'),
                    size: KButtonSize.sm,
                    trailingIcon: rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight,
                    onPressed: () => context.go('/options'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
