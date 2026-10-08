// API & Algo › API docs (/developer/docs): port of apps/crm/components/algo/docs-page.tsx (LiveDocsPage), rendered
// natively. Header (OpenAPI, API keys) · Authentication (bearer, HMAC in curl / Python / Node.js) · Endpoints ·
// Errors · Webhook alerts · Strategy language. The section index (xl only on the web) is not shown on phones.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/format/format.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'developer_api.dart';
import 'widgets/algo_widgets.dart';

const _endpoints = <({String m, String p, String scope, String text, String? body})>[
  (m: 'GET', p: '/account', scope: 'read', text: 'account', body: null),
  (m: 'GET', p: '/positions', scope: 'read', text: 'positions', body: null),
  (m: 'GET', p: '/orders', scope: 'read', text: 'orders', body: null),
  (m: 'GET', p: '/history?from=2026-09-01&to=2026-10-01&page=1&limit=100', scope: 'read', text: 'history', body: null),
  (m: 'GET', p: '/quotes?symbols=EURUSD,XAUUSD', scope: 'read', text: 'quotes', body: null),
  (
    m: 'POST',
    p: '/orders',
    scope: 'trade',
    text: 'placeOrder',
    body: '{"symbol":"EURUSD","side":"buy","type":"market","volume":0.1,"sl":1.0850,"tp":1.0950,"clientOrderId":"my-id-1"}',
  ),
  (m: 'PATCH', p: '/positions/{ticket}', scope: 'trade', text: 'modify', body: '{"sl":1.0880,"tp":null}'),
  (m: 'POST', p: '/positions/{ticket}/close', scope: 'trade', text: 'close', body: '{"volume":0.05}'),
  (m: 'DELETE', p: '/orders/{ticket}', scope: 'trade', text: 'cancel', body: null),
];

const _errors = [
  ('401', 'unauthorized'),
  ('403', 'forbidden'),
  ('409', 'halted / requote'),
  ('422', 'market_closed · no_money · invalid_volume · invalid_sl · max_lot · validation'),
  ('429', 'rate_limited'),
  ('503', 'unavailable'),
];

class DeveloperDocsScreen extends ConsumerStatefulWidget {
  const DeveloperDocsScreen({super.key});

  @override
  ConsumerState<DeveloperDocsScreen> createState() => _DeveloperDocsScreenState();
}

class _DeveloperDocsScreenState extends ConsumerState<DeveloperDocsScreen> {
  String _lang = 'curl';

  String _sign(String base) => switch (_lang) {
    'python' =>
      '''import hashlib, hmac, json, time, requests

KEY_ID, SECRET = "kk_xxxxxxxxxxxx", "ks_xxxxxxxxxxxx"
BASE = "$base"

def call(method, path, body=None):
    data = json.dumps(body, separators=(",", ":")) if body is not None else ""
    ts = str(int(time.time() * 1000))
    sig = hmac.new(SECRET.encode(), f"{ts}{method}/public/v1{path}{data}".encode(), hashlib.sha256).hexdigest()
    h = {"X-Ezymex-Key": KEY_ID, "X-Ezymex-Timestamp": ts, "X-Ezymex-Signature": sig, "content-type": "application/json"}
    r = requests.request(method, BASE + path, headers=h, data=data or None, timeout=10)
    r.raise_for_status()
    return r.json()

print(call("GET", "/account"))
print(call("POST", "/orders", {"symbol": "EURUSD", "side": "buy", "volume": 0.1}))''',
    'node' =>
      '''import crypto from "node:crypto";

const KEY_ID = "kk_xxxxxxxxxxxx", SECRET = "ks_xxxxxxxxxxxx";
const BASE = "$base";

async function call(method, path, body) {
  const data = body === undefined ? "" : JSON.stringify(body);
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", SECRET).update(ts + method + "/public/v1" + path + data).digest("hex");
  const r = await fetch(BASE + path, { method, body: data || undefined, headers: { "X-Ezymex-Key": KEY_ID, "X-Ezymex-Timestamp": ts, "X-Ezymex-Signature": sig, "content-type": "application/json" } });
  if (!r.ok) throw new Error((await r.json()).error?.message);
  return r.json();
}

console.log(await call("GET", "/positions"));''',
    _ =>
      '''KEY_ID=kk_xxxxxxxxxxxx
SECRET=ks_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TS=\$(date +%s000)
BODY='{"symbol":"EURUSD","side":"buy","volume":0.1}'
SIG=\$(printf '%s' "\${TS}POST/public/v1/orders\${BODY}" | openssl dgst -sha256 -hmac "\$SECRET" -hex | sed 's/^.* //')
curl -X POST $base/orders \\
  -H "X-Ezymex-Key: \$KEY_ID" -H "X-Ezymex-Timestamp: \$TS" -H "X-Ezymex-Signature: \$SIG" \\
  -H "content-type: application/json" -d "\$BODY"''',
  };

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = LocaleFormat(t.locale);
    final meta = ref.watch(algoMetaProvider).value;
    final root = meta?.publicUrl ?? 'https://api.ezymex.com/algo';
    final base = '$root/public/v1';
    final codeTag = KTag(style: context.text.mono(11.5, color: k.fg2));
    final limits = meta?.limits ?? const <String, int>{};

    Widget methodBadge(String m) {
      final (bg, fg) = m == 'GET' ? (k.upSoft, k.up) : (m == 'DELETE' ? (k.downSoft, k.down) : (k.emberSoft, k.ember));
      return Container(
        width: 58,
        padding: const EdgeInsets.symmetric(vertical: 3),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
        child: Text(
          m,
          style: context.text.mono(11, color: fg, weight: FontWeight.w700),
        ),
      );
    }

    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(algoMetaProvider);
        await ref.read(algoMetaProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('developer.docs.title'), subtitle: Text(t('developer.docs.subtitle'))),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            KButton(
              label: 'OpenAPI',
              icon: LucideIcons.bookOpen,
              variant: KButtonVariant.surface,
              onPressed: () => launchUrl(Uri.parse('$base/openapi.json'), mode: LaunchMode.externalApplication),
            ),
            KButton(label: t('developer.keys.title'), icon: LucideIcons.keyRound, onPressed: () => context.go('/developer')),
          ],
        ),
        const SizedBox(height: 20),
        // authentication
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(icon: LucideIcons.keyRound, title: t('developer.docs.auth'), subtitle: base),
              const SizedBox(height: 14),
              KRichText(
                t('developer.docs.authIntro'),
                style: context.text.callout.copyWith(color: k.fg2),
                tags: {
                  'link': KTag.link(() => context.go('/developer')),
                  'read': KTag(
                    style: TextStyle(color: k.up, fontWeight: FontWeight.w600),
                  ),
                  'trade': KTag(
                    style: TextStyle(color: k.ember, fontWeight: FontWeight.w600),
                  ),
                },
              ),
              const SizedBox(height: 14),
              SmallLabel(t('developer.docs.bearer')),
              const SizedBox(height: 6),
              CodeBlock('curl $base/account -H "Authorization: Bearer \$KEY_ID:\$SECRET"', lang: 'curl'),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: SmallLabel(t('developer.docs.hmac'))),
                  SizedBox(
                    width: 210,
                    child: KSegmented<String>(
                      values: const ['curl', 'python', 'node'],
                      labels: const ['curl', 'Python', 'Node.js'],
                      selected: _lang,
                      plain: true,
                      height: 30,
                      onChanged: (v) => setState(() => _lang = v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              KRichText(
                t('developer.docs.signature'),
                style: context.text.footnote.copyWith(color: k.fg3),
                tags: {'code': codeTag},
              ),
              const SizedBox(height: 8),
              CodeBlock(_sign(base), lang: _lang == 'node' ? 'node' : _lang),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // endpoints
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.docs.endpoints'), subtitle: t('developer.docs.endpointsSub')),
              const SizedBox(height: 12),
              for (final e in _endpoints)
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: k.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          methodBadge(e.m),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              e.p,
                              textDirection: TextDirection.ltr,
                              style: context.text.mono(12, color: k.fg),
                            ),
                          ),
                          const SizedBox(width: 6),
                          KChip(
                            label: t.dyn('developer.scope.${e.scope}', fallback: e.scope),
                            tone: e.scope == 'trade' ? KChipTone.ember : KChipTone.up,
                            small: true,
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(t.dyn('developer.docs.ep.${e.text}'), style: context.text.footnote.copyWith(color: k.fg3)),
                      if (e.body != null) ...[const SizedBox(height: 8), CodeBlock(e.body!, copy: false)],
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // errors
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.docs.errors'), subtitle: t('developer.docs.errorsSub', {'shape': '{"error": {"code", "message"}}'})),
              const SizedBox(height: 8),
              for (var i = 0; i < _errors.length; i++) ...[
                if (i > 0) const KDivider(),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 40,
                            child: Text(
                              _errors[i].$1,
                              style: context.text.mono(12.5, color: k.fg, weight: FontWeight.w600),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              _errors[i].$2,
                              textDirection: TextDirection.ltr,
                              style: context.text.mono(12, color: k.ember),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Padding(
                        padding: const EdgeInsetsDirectional.only(start: 40),
                        child: Text(t.dyn('developer.docs.err.${_errors[i].$1}'), style: context.text.footnote.copyWith(color: k.fg2)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        // webhooks
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(icon: LucideIcons.webhook, title: t('developer.docs.webhooks'), subtitle: 'POST $root/hooks/<${t('developer.docs.secretToken')}>'),
              const SizedBox(height: 12),
              KRichText(
                t('developer.docs.webhookIntro'),
                style: context.text.callout.copyWith(color: k.fg2),
                tags: {'link': KTag.link(() => context.go('/developer/webhooks'))},
              ),
              const SizedBox(height: 10),
              const CodeBlock(
                '{"passphrase":"…","action":"{{strategy.order.action}}","symbol":"{{ticker}}","volume":{{strategy.order.contracts}},"sl_pips":20,"id":"{{strategy.order.id}}-{{timenow}}","timestamp":"{{timenow}}"}',
                lang: 'json',
              ),
              const SizedBox(height: 10),
              Text(t('developer.docs.webhookFields'), style: context.text.footnote.copyWith(color: k.fg3)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // strategy language
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(icon: LucideIcons.workflow, title: t('developer.docs.strategies'), subtitle: t('developer.docs.strategiesSub')),
              const SizedBox(height: 12),
              CodeBlock(meta?.example ?? '…', lang: 'kst'),
              const SizedBox(height: 10),
              for (final fn in meta?.functions ?? const <DslLine>[])
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: k.surface2.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(10)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        fn.syntax,
                        textDirection: TextDirection.ltr,
                        style: context.text.mono(11.5, color: k.info),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fn.text,
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 4),
              Text(
                t('developer.docs.sandbox', {
                  'chars': f.number(limits['sourceChars'] ?? 20000, 0),
                  'nodes': f.number(limits['nodes'] ?? 4000, 0),
                  'period': limits['period'] ?? 1000,
                }),
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
