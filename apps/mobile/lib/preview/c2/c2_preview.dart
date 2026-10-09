// Sample answers of agent C2's modules (Markets, News, Calendar, Options intro, Copy & PAMM, Partner, Prop, Rewards,
// Academy, Developer), one file per module. The preview adapter asks here first.
import 'academy.dart';
import 'calendar.dart';
import 'developer.dart';
import 'markets.dart';
import 'news.dart';
import 'options.dart';
import 'partner.dart';
import 'prop.dart';
import 'rewards.dart';
import 'social.dart';
import 'staking.dart';

typedef PreviewAnswer = (int, Object)? Function(String method, String path, Map<String, dynamic> body, Map<String, String> query);

const List<PreviewAnswer> _modules = [
  previewMarkets,
  previewNews,
  previewCalendar,
  previewOptions,
  previewSocial,
  previewPartner,
  previewProp,
  previewRewards,
  previewAcademy,
  previewDeveloper,
  previewStaking,
];

/// The sample answer for `method path`, or null when no C2 module owns it.
(int, Object)? previewC2(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  for (final m in _modules) {
    final r = m(method, path, body, query);
    if (r != null) return r;
  }
  return null;
}
