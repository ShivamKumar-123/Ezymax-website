import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "客户支持",
  "page.subtitle": "与 Kalks AI 对话，即时获得解答。您可随时要求人工服务，我们的团队将接手并查看完整对话。",
  "email.prefer": "更喜欢使用邮件？",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "请使用 <email>{email}</email> 发送邮件，并注明您的客户 ID <id>{id}</id>。",
  "email.write": "发送邮件给客服",
  "email.copyId": "复制客户 ID",
  clientId: "客户 ID",
  notice: "我们团队的回复也会显示在通知铃铛中，您不在线时我们会发送邮件通知您。您可在“个人资料 → 通知”中更改此设置。",
  "toast.copied": "已复制{what}",
  "toast.copyFailed": "无法复制，请手动选择",

  // Conversation status
  "status.bot": "AI 助手",
  "status.waiting": "排队中",
  "status.assigned": "客服处理中",
  "status.resolved": "已结束",

  // Conversation history
  "history.title": "您的对话",
  "history.subtitle": "对话记录保存在您的客户专区中",
  "history.emptyTitle": "暂无对话",
  "history.emptyText": "在聊天中提出问题后，对话将显示在此处。",
  conversation: "对话",
  "toast.openFailed": "无法打开对话",

  // Floating button
  "launcher.open": "打开客服聊天",
  "launcher.close": "关闭客服聊天",

  // Chat
  you: "您",
  agent: "客服",
  // Fallback name for a team member without a name
  supportName: "客服",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "如何验证我的身份？",
  "quick.deposit": "如何入金 USDT？",
  "quick.withdrawal": "我的出金何时到账？",
  "quick.stopOut": "什么是强制平仓？",
  "header.supportTeam": "客服团队",
  "header.agentSub": "客户支持 · Kalks",
  "header.connecting": "正在为您连接客服…",
  "header.replySoon": "我们的团队将很快在此回复",
  "header.helpCentre": "帮助中心解答 · 可随时转接人工",
  "header.instant": "即时解答 · 可随时转接人工",
  "chip.liveAgent": "人工客服",
  "menu.aria": "聊天选项",
  "menu.talkToPerson": "转接人工",
  "menu.endChat": "结束聊天",
  "menu.newChat": "开始新聊天",
  closeChat: "关闭聊天",
  unavailable: "聊天服务暂不可用。",
  greeting: "您好，{name}。",
  "csat.question": "您对本次聊天满意吗？",
  "csat.stars": { other: "{count} 星" },
  "csat.placeholder": "还有其他补充吗？（可选）",
  "csat.send": "提交评分",
  "csat.rated": "您对本次聊天的评分为 {rating}/5",
  "composer.attach": "添加附件",
  "composer.messageTo": "发送消息给 {name}…",
  "composer.newChat": "开始新聊天…",
  "composer.ask": "向 {name} 提问…",
  "composer.aria": "消息",
  disclaimer: "{name} 可能会出错，且从不提供投资建议。聊天内容将被记录以保证服务质量。",
  "toast.chattingWith": "您正在与 {name} 聊天",
  "toast.inQueue": "您正在排队等待客服",
  "toast.notSent": "消息未发送",
  "toast.teamUnreachable": "无法联系到团队",
  "toast.endFailed": "无法结束聊天",
  "toast.rateFailed": "评分未保存",
  "toast.thanks": "感谢您的反馈",
  "toast.fileTooLarge": "文件过大",
  "toast.fileTooLargeText": "文件大小不能超过 {mb} MB。",
  "toast.unsupported": "不支持的文件",
  "toast.unsupportedText": "请添加图片（PNG、JPG、GIF、WEBP）或 PDF 文件。",
  "toast.uploadFailed": "上传失败",
  "error.uploadFailed": "上传失败。",
};
export default support;
