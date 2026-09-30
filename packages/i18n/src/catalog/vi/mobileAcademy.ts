import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phone-only strings; the rest reuses the `academy` namespace).
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Học viện Kalks",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} chương trong tám giai đoạn, kèm bài kiểm tra, bài thi cuối và chứng chỉ.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Chương đã xong",
  "stats.streakDays": "Chuỗi ngày học",
  "stats.certificates": "Chứng chỉ",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Giai đoạn {n}: {title}",

  // Chapter reader
  "reader.updated": "Cập nhật {date}",
  "reader.completedOn": "Hoàn thành {date}",
  "reader.upNext": "Tiếp theo",
  "reader.completeHint": "Vượt qua bài kiểm tra để hoàn thành chương này.",
  "reader.zoomHint": "Mở sơ đồ toàn màn hình",
  "reader.tapToZoom": "Chạm để phóng to",
  "reader.zoomHelp": "Chụm hai ngón hoặc chạm hai lần để phóng to",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "Luyện tập trên demo",
  "practice.onDemo": "Giao dịch trên demo #{login}",

  // Final exam screen
  "exam.answerAll": "Trả lời tất cả câu hỏi để nộp bài.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { other: "thuật ngữ bằng ngôn ngữ dễ hiểu" },
  "glossary.letters": "Mục lục chữ cái",
  "glossary.openTerm": "Mở định nghĩa",

  // Certificates
  "cert.share": "Chia sẻ",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "Chứng chỉ Học viện {brand} của tôi cho Giai đoạn {n}, {title}: {url}",
  "cert.imageA11y": "Chứng chỉ giai đoạn {n}",

  // Accessibility labels
  "a11y.glossary": "Mở thuật ngữ",
  "a11y.progress": "Tiến độ của tôi",
  "a11y.contents": "Mục lục chương",

  // States
  "state.viewer.title": "Không được chia sẻ với bạn",
  "state.viewer.body": "Học viện không nằm trong phạm vi được chia sẻ với đăng nhập chỉ xem này.",
  "state.disabled.title": "Không khả dụng",
  "state.disabled.body": "Học viện không khả dụng cho tài khoản của bạn.",
};
export default mobileAcademy;
