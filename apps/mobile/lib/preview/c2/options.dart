// Sample answers for the Options page (previews and widget tests only; shapes of components/options/api.ts).
/// Accepted already (web preview URL `?optionsReady=1` shows the eligible page).
bool _accepted = Uri.base.queryParameters['optionsReady'] == '1';

/// Tests start from "not accepted yet".
void resetPreviewOptions() => _accepted = false;

const String _terms = '''
## 1. What these terms cover

These terms apply to **Ezymex FX Options**: European options on forex pairs, gold, silver and crude oil, traded in Ezymex Trader and settled in cash.

## 2. Buying and selling

- When you **buy** an option, the most you can lose is the premium you pay.
- When you **sell** an option, you receive the premium and hold margin. Your loss can be larger than the premium.

## 3. Prices and settlement

Prices are set on the Ezymex order book and by Ezymex. Options are exercised automatically at expiry against the average mid price of the 30 minutes before the cut (10:00 New York).

> Trading options carries a high level of risk and is not suitable for everyone.
''';

Map<String, dynamic> get _state => {
  'product': 'options',
  'disclosure': {'version': 3, 'title': 'Ezymex FX Options terms', 'bodyMd': _terms, 'publishedAt': '2026-09-01T09:00:00Z'},
  'disclosureAccepted': _accepted,
  'acceptedVersion': _accepted ? 3 : null,
  'acceptedAt': _accepted ? DateTime.now().toUtc().toIso8601String() : null,
  'eligible': _accepted,
  'missing': _accepted ? <String>[] : ['disclosure'],
  'kycVerified': true,
  'kycStatus': 'verified',
  'quizPassed': false,
};

(int, Object)? previewOptions(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (path == 'suitability/options') return (200, _state);
  if (path == 'suitability/options/accept') {
    _accepted = true;
    return (200, _state);
  }
  return null;
}
