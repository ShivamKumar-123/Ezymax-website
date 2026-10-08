// Academy › Glossary (/academy/glossary?q=): port of the web's LiveGlossary (components/academy/live/glossary.tsx):
//   back link · header (count) · search + category pills + A–Z letters · "N terms" · term cards (category, definition,
//   related terms that jump to their card).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'academy_api.dart';
import 'widgets/shared.dart';

class AcademyGlossaryScreen extends ConsumerStatefulWidget {
  const AcademyGlossaryScreen({super.key, this.q});

  /// The search from the link (`?q=`, the home page's glossary card).
  final String? q;

  @override
  ConsumerState<AcademyGlossaryScreen> createState() => _AcademyGlossaryScreenState();
}

class _AcademyGlossaryScreenState extends ConsumerState<AcademyGlossaryScreen> {
  late String _q = widget.q ?? '';
  String _cat = '';
  String? _flash;
  int _searchGen = 0;
  Timer? _flashTimer;
  final _scroll = ScrollController();
  final Map<String, GlobalKey> _termKeys = {};
  final Map<String, GlobalKey> _letterKeys = {};

  @override
  void didUpdateWidget(AcademyGlossaryScreen old) {
    super.didUpdateWidget(old);
    if (widget.q != old.q && widget.q != null) {
      setState(() {
        _q = widget.q!;
        _searchGen++;
      });
    }
  }

  @override
  void dispose() {
    _flashTimer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  GlobalKey _termKey(String slug) => _termKeys.putIfAbsent(slug, GlobalKey.new);
  GlobalKey _letterKey(String l) => _letterKeys.putIfAbsent(l, GlobalKey.new);

  /// Scrolls `key` into view: centred (a related term, web block "center"), or just under the header (a letter).
  void _scrollTo(GlobalKey key, {bool top = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = key.currentContext;
      if (c == null || !c.mounted || !_scroll.hasClients) return;
      final ro = c.findRenderObject();
      if (ro == null) return;
      final viewport = RenderAbstractViewport.of(ro);
      final pos = _scroll.position;
      // the page scrolls under the frosted header and tab bar (their heights are the MediaQuery padding)
      final pad = MediaQuery.paddingOf(context);
      final target = top ? viewport.getOffsetToReveal(ro, 0).offset - pad.top - 12 : viewport.getOffsetToReveal(ro, 0.5).offset - (pad.top - pad.bottom) / 2;
      unawaited(pos.animateTo(target.clamp(pos.minScrollExtent, pos.maxScrollExtent), duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic));
    });
  }

  /// A related term: clear the filters, highlight its card and scroll to it.
  void _jump(String slug) {
    setState(() {
      _q = '';
      _cat = '';
      _searchGen++;
      _flash = slug;
    });
    _scrollTo(_termKey(slug));
    _flashTimer?.cancel();
    _flashTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _flash = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final g = ref.watch(academyGlossaryProvider);
    return KPageScroll(
      controller: _scroll,
      onRefresh: () async {
        ref.invalidate(academyGlossaryProvider);
        await ref.read(academyGlossaryProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        AcademyBackLink(href: '/academy', label: t('academy.title')),
        const SizedBox(height: 12),
        KAsync(
          value: g,
          loading: const AcademyPageSkeleton(),
          error: (e) => AcademyUnavailable(error: e, onRetry: () => ref.invalidate(academyGlossaryProvider)),
          builder: (data) => _body(context, data),
        ),
      ],
    );
  }

  Widget _body(BuildContext context, AcademyGlossary data) {
    final t = context.t;
    final k = context.k;
    final n = _q.trim().toLowerCase();
    final list = data.terms
        .where((x) => (_cat.isEmpty || x.category == _cat) && (n.isEmpty || x.term.toLowerCase().contains(n) || x.definition.toLowerCase().contains(n)))
        .toList();
    // exact / prefix matches first when searching
    if (n.isNotEmpty) {
      int rank(String x) {
        final l = x.toLowerCase();
        return l == n ? 0 : (l.startsWith(n) ? 1 : (l.contains(n) ? 2 : 3));
      }

      list.sort((a, b) {
        final r = rank(a.term) - rank(b.term);
        return r != 0 ? r : a.term.compareTo(b.term);
      });
    }
    final letters = (data.terms.map((x) => x.letter).where((l) => l.isNotEmpty).toSet().toList())..sort();
    final browsing = _q.isEmpty && _cat.isEmpty;

    Widget pill(String label, {String? count, required bool on, required VoidCallback onTap}) => KPressable(
      minSize: 36,
      pressedScale: 0.96,
      semanticLabel: label,
      onTap: onTap,
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: on ? k.emberSoft : k.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: on ? k.ember.withValues(alpha: 0.4) : k.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: context.text.caption.copyWith(color: on ? k.fg : k.fg3, fontWeight: FontWeight.w500, fontSize: 12),
            ),
            if (count != null) ...[
              const SizedBox(width: 5),
              Text(
                count,
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12, fontFeatures: kTabular),
              ),
            ],
          ],
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KPageHeader(title: t('academy.home.glossary'), subtitle: Text(t('academy.glossary.subtitle', {'count': data.total}))),
        const SizedBox(height: 18),
        KCard(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                label: t('academy.glossary.searchAria'),
                child: KSearchField(
                  key: ValueKey('glossary-search-$_searchGen'),
                  initial: _q,
                  placeholder: t('academy.glossary.placeholder'),
                  clearLabel: t('academy.glossary.clear'),
                  onChanged: (v) => setState(() => _q = v),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    pill(t('common.all'), on: _cat.isEmpty, onTap: () => setState(() => _cat = '')),
                    for (final c in data.categories) ...[
                      const SizedBox(width: 6),
                      pill(c.name, count: '${c.count}', on: _cat == c.name, onTap: () => setState(() => _cat = _cat == c.name ? '' : c.name)),
                    ],
                  ],
                ),
              ),
              if (browsing) ...[
                const SizedBox(height: 10),
                Container(height: 0.6, color: k.line),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 2,
                  runSpacing: 2,
                  children: [
                    for (final l in letters)
                      KPressable(
                        minSize: 32,
                        semanticLabel: l,
                        onTap: () => _scrollTo(_letterKey(l), top: true),
                        child: SizedBox(
                          width: 30,
                          height: 30,
                          child: Center(
                            child: Text(l, style: context.text.caption.copyWith(color: k.fg3, fontSize: 12.5)),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text(
          t('academy.glossary.count', {'count': list.length}),
          key: const ValueKey('glossary-count'),
          style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
        ),
        const SizedBox(height: 10),
        if (list.isEmpty)
          KCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 48),
            child: Text(
              t('academy.glossary.noMatch', {'q': _q}),
              textAlign: TextAlign.center,
              style: context.text.callout.copyWith(color: k.fg3),
            ),
          )
        else
          for (var i = 0; i < list.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            _TermCard(
              key: _termKey(list[i].slug),
              term: list[i],
              letterKey: browsing && (i == 0 || list[i - 1].letter != list[i].letter) ? _letterKey(list[i].letter) : null,
              flash: _flash == list[i].slug,
              onRelated: _jump,
            ),
          ],
      ],
    );
  }
}

class _TermCard extends StatelessWidget {
  const _TermCard({super.key, required this.term, required this.letterKey, required this.flash, required this.onRelated});
  final GlossaryTerm term;
  final GlobalKey? letterKey;
  final bool flash;
  final ValueChanged<String> onRelated;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final card = KCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(term.term, style: context.text.headline.copyWith(fontSize: 15.5))),
              const SizedBox(width: 10),
              KChip(label: term.category, small: true),
            ],
          ),
          const SizedBox(height: 6),
          Text(term.definition, style: context.text.callout.copyWith(color: k.fg2, height: 1.55)),
          if (term.related.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  t('academy.glossary.related'),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                ),
                for (final r in term.related)
                  KPressable(
                    minSize: 32,
                    semanticLabel: r.term,
                    onTap: () => onRelated(r.slug),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: k.surface2,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: k.line),
                      ),
                      child: Text(
                        r.term,
                        style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400, fontSize: 12),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
    return Stack(
      children: [
        if (letterKey != null) Positioned(top: 0, left: 0, child: SizedBox(key: letterKey, width: 1, height: 1)),
        AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(k.cardRadius + 2),
            border: Border.all(color: flash ? k.ember.withValues(alpha: 0.6) : Colors.transparent, width: 1.5),
          ),
          child: card,
        ),
      ],
    );
  }
}
