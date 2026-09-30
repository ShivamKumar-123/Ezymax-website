import type { NsMessages } from "../../core";

// Kalks mobile app: notifications inbox, push notifications, app lock, "Continue with Google" and app links.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications)
  "inbox.eyebrow": "Hộp thư",
  "inbox.unread": { other: "{count} chưa đọc" },
  "inbox.caughtUp": "Đã xem hết",
  "inbox.filter.unread": "Chưa đọc",
  "inbox.markedAll": "Đã đánh dấu tất cả là đã đọc",
  "inbox.emptyUnread.title": "Đã xem hết",
  "inbox.emptyUnread.body": "Bạn đã đọc mọi thông báo. Thông báo mới sẽ hiển thị tại đây khi đến.",
  "inbox.loadMoreFailed": "Không thể tải thông báo cũ hơn. Chạm để thử lại.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "Bạn đang ngoại tuyến. Đây là các thông báo đã lưu trên điện thoại này.",
  // Row accessibility
  "inbox.a11y.unread": "Chưa đọc",
  "inbox.a11y.settings": "Cài đặt thông báo",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Mở liên kết",
  "inbox.detail.received": "Nhận lúc {time}",

  // Asking for push permission: a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Thông báo",
  "push.ask.title": "Biết ngay lập tức",
  "push.ask.body": "Tiền nạp đã ghi có, lệnh rút đã chi trả, margin call, stop out và phản hồi hỗ trợ, gửi thẳng đến màn hình khóa của bạn.",
  "push.ask.point.money": "Nạp và rút tiền",
  "push.ask.point.risk": "Margin call và stop out",
  "push.ask.point.support": "Phản hồi từ bộ phận hỗ trợ",
  "push.ask.allow": "Bật thông báo",
  "push.ask.later": "Để sau",
  "push.ask.note": "Bạn chọn chủ đề tại Hồ sơ › Thông báo. Ưu đãi chỉ được gửi nếu bạn bật.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "bây giờ",
  "push.ask.sampleTitle": "Đã ghi có khoản nạp",
  "push.ask.sampleBody": "Đã ghi có 250.00 USDT vào ví của bạn.",
  "push.card.title": "Bật thông báo đẩy",
  "push.card.body": "Nhận thông báo nạp tiền, khớp lệnh và margin call trên màn hình khóa.",
  "push.card.action": "Bật",
  "push.card.deniedTitle": "Thông báo đẩy đang tắt",
  "push.card.deniedBody": "Hãy cho phép Kalks gửi thông báo trong cài đặt điện thoại để nhận thông báo trên màn hình khóa.",
  "push.card.deniedAction": "Mở cài đặt",
  "push.card.dismiss": "Ẩn",
  "push.enabled": "Đã bật thông báo đẩy",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Margin call và bảo mật",
  "push.channel.alertsHint": "Cảnh báo margin call và stop out, cảnh báo giá của bạn, đăng nhập mới",
  "push.channel.activity": "Hoạt động tài khoản",
  "push.channel.activityHint": "Nạp tiền, rút tiền, khớp lệnh, xác minh và phản hồi hỗ trợ",
  "push.channel.news": "Tin tức và ưu đãi",
  "push.channel.newsHint": "Khuyến mãi và tin sản phẩm bạn đã đăng ký nhận",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "Thông báo mới: {title}. Chạm hai lần để mở.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "Đã khóa",
  "lock.title": "Chào mừng trở lại",
  "lock.subtitle": "Mở khóa để xem tài khoản và số dư của bạn.",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "Mở khóa bằng {method}",
  "lock.unlock": "Mở khóa",
  "lock.prompt": "Mở khóa Kalks",
  "lock.promptSubtitle": "Xác nhận đó là bạn",
  "lock.failed": "Không thành công. Hãy thử lại.",
  "lock.lockout": "Quá nhiều lần thử. Hãy mở khóa điện thoại bằng mật mã rồi thử lại.",
  "lock.noScreenLock": "Điện thoại của bạn không còn khóa màn hình nên Kalks không thể xác nhận đó là bạn. Hãy đăng xuất và đăng nhập lại bằng mật khẩu.",
  "lock.notYou": "Không phải bạn, hoặc không thể mở khóa?",
  "lock.signOut": "Đăng xuất",
  "lock.signOutTitle": "Đăng xuất khỏi Kalks?",
  "lock.signOutBody": "Bạn sẽ đăng nhập lại bằng email và mật khẩu. Lệnh và tiền của bạn không bị ảnh hưởng.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "vân tay",
  "lock.method.face": "nhận diện khuôn mặt",
  "lock.method.iris": "mống mắt",
  "lock.method.passcode": "mật mã",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Bảo mật",
  "settings.title": "Khóa ứng dụng",
  "settings.subtitle": "Khóa Kalks bằng {method} khi mở ứng dụng và sau khi ứng dụng chạy nền.",
  "settings.toggle": "Khóa Kalks",
  "settings.toggleHint": "Dùng {method}, với mật mã điện thoại làm phương án dự phòng",
  "settings.on": "Đã bật khóa ứng dụng",
  "settings.off": "Đã tắt khóa ứng dụng",
  "settings.after": "Khóa lại sau",
  "settings.afterHint": "Thời gian Kalks có thể chạy nền trước khi yêu cầu mở khóa lại. Ứng dụng luôn yêu cầu khi khởi động.",
  "settings.timeout.0": "Ngay lập tức",
  "settings.timeout.60": "1 phút",
  "settings.timeout.300": "5 phút",
  "settings.timeout.900": "15 phút",
  "settings.timeout.3600": "1 giờ",
  "settings.privacy": "Khi bật khóa ứng dụng, trình chuyển ứng dụng sẽ hiển thị màn che thay vì số dư của bạn.",
  "settings.lockNow": "Khóa ngay",
  "settings.confirmOn": "Xác nhận để bật khóa ứng dụng",
  "settings.confirmOff": "Xác nhận để tắt khóa ứng dụng",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Xác nhận để đổi thời điểm Kalks khóa",
  // Toast body after a password sign-in on a phone whose screen lock was removed
  "settings.turnedOffNoScreenLock": "Điện thoại này không có khóa màn hình nên Kalks không thể xác nhận đó là bạn. Hãy thiết lập khóa màn hình trong cài đặt điện thoại để dùng lại khóa ứng dụng.",
  "settings.notConfirmed": "Chưa xác nhận, không có gì thay đổi",
  "settings.unavailableTitle": "Hãy thiết lập khóa màn hình trước",
  "settings.unavailableBody": "Khóa ứng dụng dùng Face ID, vân tay hoặc mật mã của điện thoại. Hãy bật một trong số đó trong cài đặt điện thoại, rồi quay lại.",
  "settings.webTitle": "Có trong ứng dụng",
  "settings.webBody": "Khóa ứng dụng hoạt động trong ứng dụng Kalks cho iPhone và Android.",
  "settings.thisPhone": "Chỉ áp dụng cho điện thoại này",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "Không có gì để mở",
  "link.notFound.body": "Liên kết này không khớp với màn hình nào trong ứng dụng. Có thể liên kết đã cũ, hoặc dành cho khu vực khách hàng trên web.",
  "link.notFound.home": "Về Trang chủ",
  "link.openFailed": "Không thể mở liên kết này.",
};
export default mobilePlatform;
