import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
// Keep "Ezymex" and "Ezymex AI" as they are. {placeholders} are filled in by the app.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "Hỗ trợ",
  "page.subtitle": "Trò chuyện với Ezymex AI để được giải đáp ngay. Bạn có thể yêu cầu gặp nhân viên bất cứ lúc nào, đội ngũ của chúng tôi sẽ tiếp nhận cùng toàn bộ cuộc trò chuyện.",
  "email.prefer": "Muốn liên hệ qua email?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "Gửi từ <email>{email}</email> và ghi kèm mã khách hàng <id>{id}</id>.",
  "email.write": "Gửi email cho bộ phận hỗ trợ",
  "email.copyId": "Sao chép mã khách hàng",
  clientId: "Mã khách hàng",
  notice: "Phản hồi từ đội ngũ của chúng tôi cũng hiển thị trong chuông thông báo, và chúng tôi sẽ gửi email khi bạn không trực tuyến. Thay đổi tại Hồ sơ → Thông báo.",
  "toast.copied": "Đã sao chép {what}",
  "toast.copyFailed": "Không thể sao chép, vui lòng chọn và sao chép thủ công",

  // Conversation status
  "status.bot": "Trợ lý AI",
  "status.waiting": "Đang chờ",
  "status.assigned": "Đang với nhân viên",
  "status.resolved": "Đã kết thúc",

  // Conversation history
  "history.title": "Cuộc trò chuyện của bạn",
  "history.subtitle": "Nội dung trò chuyện được lưu trong khu vực khách hàng",
  "history.emptyTitle": "Chưa có cuộc trò chuyện",
  "history.emptyText": "Hãy đặt câu hỏi trong khung chat, cuộc trò chuyện sẽ hiển thị tại đây.",
  conversation: "Cuộc trò chuyện",
  "toast.openFailed": "Không thể mở cuộc trò chuyện",

  // Floating button
  "launcher.open": "Mở chat hỗ trợ",
  "launcher.close": "Đóng chat hỗ trợ",

  // Chat
  you: "Bạn",
  agent: "Nhân viên",
  // Fallback name for a team member without a name
  supportName: "Hỗ trợ",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "Làm thế nào để xác minh danh tính?",
  "quick.deposit": "Làm thế nào để nạp USDT?",
  "quick.withdrawal": "Khi nào tôi nhận được tiền rút?",
  "quick.stopOut": "Stop-out là gì?",
  "header.supportTeam": "Đội ngũ hỗ trợ",
  "header.agentSub": "Hỗ trợ khách hàng · Ezymex",
  "header.connecting": "Đang kết nối bạn với nhân viên…",
  "header.replySoon": "Đội ngũ của chúng tôi sẽ sớm trả lời tại đây",
  "header.helpCentre": "Giải đáp từ trung tâm trợ giúp · có thể gặp nhân viên bất cứ lúc nào",
  "header.instant": "Trả lời tức thì · có thể gặp nhân viên bất cứ lúc nào",
  "chip.liveAgent": "Nhân viên trực tuyến",
  "menu.aria": "Tùy chọn chat",
  "menu.talkToPerson": "Nói chuyện với nhân viên",
  "menu.endChat": "Kết thúc chat",
  "menu.newChat": "Bắt đầu chat mới",
  closeChat: "Đóng chat",
  unavailable: "Chat hiện không khả dụng.",
  greeting: "Xin chào {name}.",
  "csat.question": "Bạn đánh giá cuộc trò chuyện này thế nào?",
  "csat.stars": { other: "{count} sao" },
  "csat.placeholder": "Bạn muốn góp ý thêm? (không bắt buộc)",
  "csat.send": "Gửi đánh giá",
  "csat.rated": "Bạn đã đánh giá cuộc trò chuyện {rating}/5",
  "composer.attach": "Đính kèm tệp",
  "composer.messageTo": "Nhắn cho {name}…",
  "composer.newChat": "Bắt đầu chat mới…",
  "composer.ask": "Hỏi {name} bất cứ điều gì…",
  "composer.aria": "Tin nhắn",
  disclaimer: "{name} có thể mắc lỗi và không bao giờ đưa ra lời khuyên đầu tư. Các cuộc trò chuyện được ghi lại để đảm bảo chất lượng.",
  "toast.chattingWith": "Bạn đang trò chuyện với {name}",
  "toast.inQueue": "Bạn đang trong hàng chờ gặp nhân viên",
  "toast.notSent": "Chưa gửi được tin nhắn",
  "toast.teamUnreachable": "Không thể liên hệ đội ngũ hỗ trợ",
  "toast.endFailed": "Không thể kết thúc chat",
  "toast.rateFailed": "Chưa lưu được đánh giá",
  "toast.thanks": "Cảm ơn bạn đã góp ý",
  "toast.fileTooLarge": "Tệp quá lớn",
  "toast.fileTooLargeText": "Tệp tối đa {mb} MB.",
  "toast.unsupported": "Tệp không được hỗ trợ",
  "toast.unsupportedText": "Hãy đính kèm ảnh (PNG, JPG, GIF, WEBP) hoặc tệp PDF.",
  "toast.uploadFailed": "Tải lên thất bại",
  "error.uploadFailed": "Tải lên thất bại.",
};
export default support;
