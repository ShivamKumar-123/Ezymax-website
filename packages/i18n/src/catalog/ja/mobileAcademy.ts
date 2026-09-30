import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is reused from the `academy` namespace; these are the phone-only strings.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalksアカデミー",
  // Under the title; {count} = number of chapters
  "home.subtitle": "8つのフェーズに全{count}章。クイズ、最終試験、修了証付き。",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "修了した章",
  "stats.streakDays": "連続学習日数",
  "stats.certificates": "修了証",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "フェーズ {n}：{title}",

  // Chapter reader
  "reader.updated": "{date}更新",
  "reader.completedOn": "{date}修了",
  "reader.upNext": "次の章",
  "reader.completeHint": "クイズに合格すると、この章を修了できます。",
  "reader.zoomHint": "図を全画面で開きます",
  "reader.tapToZoom": "タップで拡大",
  "reader.zoomHelp": "ピンチまたはダブルタップで拡大",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "デモで練習",
  "practice.onDemo": "デモ口座 #{login} で取引",

  // Final exam screen
  "exam.answerAll": "提出するには、すべての問題に回答してください。",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { other: "用語をわかりやすく解説" },
  "glossary.letters": "アルファベット索引",
  "glossary.openTerm": "定義を開きます",

  // Certificates
  "cert.share": "共有",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "{brand}アカデミー フェーズ{n}「{title}」の修了証を取得しました：{url}",
  "cert.imageA11y": "フェーズ{n}の修了証",

  // Accessibility labels
  "a11y.glossary": "用語集を開く",
  "a11y.progress": "学習状況",
  "a11y.contents": "章の目次",

  // States
  "state.viewer.title": "共有されていません",
  "state.viewer.body": "アカデミーは、この閲覧専用ログインの共有範囲に含まれていません。",
  "state.disabled.title": "ご利用いただけません",
  "state.disabled.body": "お客様のアカウントではアカデミーをご利用いただけません。",
};
export default mobileAcademy;
