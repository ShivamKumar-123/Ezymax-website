import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens. Phone-only strings; the rest comes from the `academy` namespace.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small line above the Academy title
  eyebrow: "Kalks 学院",
  "home.subtitle": "八个阶段共 {count} 章，配有测验、结业考试和证书。",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "已完成章节",
  "stats.streakDays": "连续学习天数",
  "stats.certificates": "证书",
  "home.phaseA11y": "第 {n} 阶段：{title}",

  // Chapter reader
  "reader.updated": "更新于 {date}",
  "reader.completedOn": "完成于 {date}",
  "reader.upNext": "下一章",
  "reader.completeHint": "通过测验即可完成本章。",
  "reader.zoomHint": "全屏打开图示",
  "reader.tapToZoom": "点击放大",
  "reader.zoomHelp": "双指捏合或双击即可缩放",

  // Practise the chapter's exercise on the Trade tab
  "practice.title": "在模拟账户中练习",
  "practice.onDemo": "在模拟账户 #{login} 上交易",

  // Final exam screen
  "exam.answerAll": "请回答所有题目后再提交。",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { other: "个通俗易懂的术语" },
  "glossary.letters": "字母索引",
  "glossary.openTerm": "打开释义",

  // Certificates
  "cert.share": "分享",
  "cert.shareText": "我的 {brand} 学院第 {n} 阶段证书（{title}）：{url}",
  "cert.imageA11y": "第 {n} 阶段证书",

  // Accessibility labels
  "a11y.glossary": "打开术语表",
  "a11y.progress": "我的进度",
  "a11y.contents": "章节目录",

  // States
  "state.viewer.title": "未与您共享",
  "state.viewer.body": "此只读登录的共享内容不包括学院。",
  "state.disabled.title": "不可用",
  "state.disabled.body": "您的账户未开通学院。",
};
export default mobileAcademy;
