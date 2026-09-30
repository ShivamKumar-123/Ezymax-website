import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Chào buổi sáng, {name}",
  "greet.afternoon": "Chào buổi chiều, {name}",
  "greet.evening": "Chào buổi tối, {name}",
  equity: "Vốn",
  closedToday: "Đã chốt hôm nay",
  openPnl: "Lãi/lỗ đang mở",
  allLive: "Tất cả tài khoản thực {amount}",
  "quick.deposit": "Nạp tiền",
  "quick.withdraw": "Rút tiền",
  "quick.transfer": "Chuyển tiền",
  "quick.trade": "Giao dịch",
  movers: "Biến động mạnh",
  news: "Tin chính",
  allNews: "Tất cả tin tức",
  notifications: "Thông báo",
  "kyc.title": "Xác minh danh tính",
  "kyc.body": "Xác minh để mở khóa giao dịch thực và rút tiền. Chỉ mất vài phút.",
  "kyc.pending": "Đang xét duyệt xác minh",
  "kyc.pendingBody": "Chúng tôi đang kiểm tra tài liệu của bạn. Bạn sẽ nhận được thông báo khi hoàn tất.",
  "kyc.action": "Tiếp tục",
  "noAccount.title": "Mở tài khoản đầu tiên",
  "noAccount.body": "Tài khoản demo sẵn sàng trong vài giây với tiền ảo. Chuyển sang tài khoản thực khi bạn sẵn sàng.",
  "noAccount.action": "Mở tài khoản",
  "news.empty": "Hiện chưa có tin.",
  "a11y.bell": "Thông báo, {count} chưa đọc",

  // Explore: one colour block per module (title on two short lines at most, hint on two lines)
  "explore.title": "Khám phá",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Theo chân nhà giao dịch giỏi",
  "explore.prop": "Thử thách Prop",
  "explore.propHint": "Nhận vốn để giao dịch",
  "explore.academy": "Học viện",
  "explore.academyHint": "Học giao dịch từng bước",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Biến ý tưởng thành chiến lược",
  "explore.invite": "Mời bạn bè",
  "explore.inviteHint": "Kiếm tiền khi họ giao dịch",
};
export default mobileHome;
