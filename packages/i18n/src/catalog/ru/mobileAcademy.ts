import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is reused from the `academy` namespace; these are the phone-only strings.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Академия Kalks",
  // Under the title; {count} = number of chapters
  "home.subtitle": "Восемь этапов · глав: {count} · тесты, итоговые экзамены и сертификаты.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Глав пройдено",
  "stats.streakDays": "Дней подряд",
  "stats.certificates": "Сертификаты",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Этап {n}: {title}",

  // Chapter reader
  "reader.updated": "Обновлено {date}",
  "reader.completedOn": "Пройдено {date}",
  "reader.upNext": "Далее",
  "reader.completeHint": "Сдайте тест, чтобы завершить эту главу.",
  "reader.zoomHint": "Открывает схему на весь экран",
  "reader.tapToZoom": "Нажмите, чтобы увеличить",
  "reader.zoomHelp": "Разведите пальцы или дважды коснитесь для увеличения",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "Практика на демо",
  "practice.onDemo": "Торговать на демо #{login}",

  // Final exam screen
  "exam.answerAll": "Ответьте на все вопросы, чтобы отправить экзамен.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": {
    one: "термин простым языком",
    few: "термина простым языком",
    many: "терминов простым языком",
    other: "термина простым языком",
  },
  "glossary.letters": "Алфавитный указатель",
  "glossary.openTerm": "Открывает определение",

  // Certificates
  "cert.share": "Поделиться",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "Мой сертификат Академии {brand} за этап {n} «{title}»: {url}",
  "cert.imageA11y": "Сертификат этапа {n}",

  // Accessibility labels
  "a11y.glossary": "Открыть глоссарий",
  "a11y.progress": "Мой прогресс",
  "a11y.contents": "Содержание главы",

  // States
  "state.viewer.title": "Нет доступа",
  "state.viewer.body": "Академия не входит в то, что открыто этому входу для просмотра.",
  "state.disabled.title": "Недоступно",
  "state.disabled.body": "Академия недоступна для Вашего аккаунта.",
};
export default mobileAcademy;
