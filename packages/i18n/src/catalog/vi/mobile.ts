import type { NsMessages } from "../../core";

// Kalks mobile app: app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "Trang chủ",
  "tab.markets": "Thị trường",
  "tab.trade": "Giao dịch",
  "tab.portfolio": "Danh mục",
  "tab.more": "Thêm",

  // Onboarding (3 slides). Titles are shown in tall display type: keep them short.
  "onboarding.skip": "Bỏ qua",
  "onboarding.next": "Tiếp",
  "onboarding.getStarted": "Bắt đầu",
  "onboarding.haveAccount": "Tôi đã có tài khoản",
  "onboarding.welcome.title": "Bước vào thị trường",
  "onboarding.welcome.body": "Forex, kim loại, chỉ số, năng lượng, tiền mã hóa và cổ phiếu trong một tài khoản, nạp USDT tức thì.",
  "onboarding.markets.title": "Từng tick, trực tiếp",
  "onboarding.markets.body": "Giá bid và ask thực, biểu đồ của riêng bạn, Mua và Bán chỉ với một chạm, thiết kế cho điện thoại.",
  "onboarding.security.title": "Bảo mật chặt chẽ",
  "onboarding.security.body": "Mã qua email trên thiết bị mới, mã xác nhận khi rút tiền và kho lưu trữ an toàn cho phiên đăng nhập của bạn.",
  "onboarding.step": "{n}/{total}", // slide counter, e.g. "1 of 3"

  // Shared states
  "state.offline.title": "Mất kết nối",
  "state.offline.body": "Hãy kiểm tra kết nối internet. Giá và tài khoản của bạn sẽ tự động kết nối lại.",
  "state.reconnecting": "Đang kết nối lại…",
  "state.error.title": "Đã xảy ra lỗi",
  "state.error.body": "Không thể tải nội dung này. Kéo xuống hoặc chạm để thử lại.",
  "state.maintenance.title": "Đang bảo trì",
  "state.maintenance.body": "Chúng tôi đang nâng cấp Kalks. Lệnh và tiền của bạn vẫn an toàn. Vui lòng quay lại sau ít phút.",
  "state.sessionExpired": "Phiên của bạn đã kết thúc. Vui lòng đăng nhập lại.",
  "state.updated": "Cập nhật {time}",
  "state.pullToRefresh": "Kéo để làm mới",

  "viewOnly": "Quyền chỉ xem",
  "viewOnlyBody": "Đăng nhập này có thể xem các tài khoản được chia sẻ nhưng không thể thay đổi.",

  // Common short labels
  "action.retry": "Thử lại",
  "action.openWeb": "Mở trong khu vực khách hàng",
  "action.signOut": "Đăng xuất",
  "action.seeAll": "Xem tất cả",
  "a11y.close": "Đóng",
  "a11y.back": "Quay lại",
};
export default mobile;
