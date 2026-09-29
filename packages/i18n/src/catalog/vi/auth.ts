import type { NsMessages } from "../../core";

const auth: NsMessages<"auth"> = {
  // Shared form fields
  "field.email": "Email",
  "field.emailOrViewer": "Email hoặc ID người xem",
  "field.password": "Mật khẩu",
  "field.newPassword": "Mật khẩu mới",
  "field.firstName": "Tên",
  "field.lastName": "Họ",
  "field.country": "Quốc gia cư trú",
  "field.phone": "Điện thoại",
  "field.dateOfBirth": "Ngày sinh",
  "field.referralCode": "Mã giới thiệu",
  "field.optionalHint": "không bắt buộc",
  "placeholder.email": "you@example.com",
  "placeholder.createPassword": "Tạo mật khẩu mạnh",
  "togglePassword": "Hiện/ẩn mật khẩu",

  // Shared OTP / code step
  "otp.didntGetIt": "Chưa nhận được mã?",
  "otp.verifying": "Đang xác minh…",
  "otp.resendIn": "Gửi lại sau 0:{seconds}",
  "otp.sending": "Đang gửi…",
  "otp.resendCode": "Gửi lại mã",
  "otp.devHint": "Chế độ dev: chưa cấu hình gửi email. Mã của bạn là <code>{code}</code> (cũng có trong log gateway).",
  "toast.newCodeSent": "Đã gửi mã mới",
  "toast.checkEmail": "Kiểm tra {email}",

  // Google sign-in
  "google.continue": "Tiếp tục với Google",
  "google.signUp": "Đăng ký bằng Google",
  "google.opening": "Đang mở Google…",
  "google.orWithEmail": "hoặc bằng email",
  "google.error.cancelled": "Đăng nhập Google đã bị hủy. Hãy chọn một tài khoản để tiếp tục hoặc dùng email của bạn bên dưới.",
  "google.error.expired": "Phiên đăng nhập Google đã hết hạn hoặc được mở ở tab khác. Vui lòng thử lại.",
  "google.error.unverified": "Địa chỉ email của tài khoản Google chưa được xác minh. Hãy xác minh với Google hoặc dùng email của bạn bên dưới.",
  "google.error.conflict": "Email này đã được liên kết với một tài khoản Google khác. Hãy dùng tài khoản Google đó hoặc đăng nhập bằng mật khẩu.",
  "google.error.disabled": "Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ bộ phận hỗ trợ.",
  "google.error.rate_limited": "Quá nhiều lần đăng nhập. Vui lòng đợi vài phút rồi thử lại.",
  "google.error.unavailable": "Đăng nhập Google hiện không khả dụng. Vui lòng thử lại sau hoặc dùng email.",
  "google.error.failed": "Chúng tôi không thể đăng nhập cho bạn bằng Google. Vui lòng thử lại.",

  // Password strength meter
  "strength.rule": "Từ 8 ký tự, chữ hoa, số & ký hiệu",
  "strength.tooWeak": "Quá yếu",
  "strength.weak": "Yếu",
  "strength.fair": "Trung bình",
  "strength.good": "Tốt",
  "strength.strong": "Mạnh",

  // Demo entry card (demo builds only)
  "demo.title": "Đây là bản demo Kalks",
  "demo.body": "Không cần tài khoản. Mọi màn hình đều chạy trên dữ liệu mẫu.",
  "demo.enter": "Vào bản demo",

  // Auth layout brand panel
  "brand.headline": "Giao dịch thị trường toàn cầu với độ chính xác chuẩn tổ chức.",
  "brand.body": "Forex, kim loại, chỉ số, năng lượng, tiền mã hóa và cổ phiếu — nạp USDT tức thì, một tài khoản để giao dịch, sao chép và làm đối tác.",
  "brand.previewAlt": "Bảng điều khiển khu vực khách hàng Kalks",

  // Sign in
  "login.title": "Chào mừng bạn trở lại",
  "login.subtitle": "Đăng nhập vào khu vực khách hàng Kalks.",
  "login.forgot": "Quên mật khẩu?",
  "login.signingIn": "Đang đăng nhập…",
  "login.signIn": "Đăng nhập",
  "login.newToKalks": "Mới đến Kalks? <link>Tạo tài khoản</link>",
  "login.verifyEmailTitle": "Xác minh email",
  "login.verifyDeviceTitle": "Xác minh danh tính của bạn",
  "login.emailNotVerified": "Email của bạn chưa được xác minh.",
  "login.newDevice": "Phát hiện thiết bị mới.",
  "login.codeSent": "Chúng tôi đã gửi mã 6 chữ số đến <b>{email}</b>.",
  "login.verifyContinue": "Xác minh & tiếp tục",
  "login.back": "← Quay lại",

  // Sign up
  "register.stepDetails": "Thông tin",
  "register.stepVerify": "Xác minh email",
  "register.stepDone": "Xong",
  "register.title": "Tạo tài khoản Kalks",
  "register.subtitleDemo": "Mở tài khoản demo miễn phí ngay lập tức. Chuyển sang tài khoản thực bất cứ khi nào bạn sẵn sàng.",
  "register.subtitle": "Đăng ký trong một phút và theo dõi thị trường trực tiếp ngay.",
  "register.emailTaken": "<signin>Đăng nhập</signin> hoặc <reset>đặt lại mật khẩu</reset>.",
  "register.terms": "Tôi trên 18 tuổi và đồng ý với <agreement>Thỏa thuận khách hàng</agreement>, <risk>Công bố rủi ro</risk> và <privacy>Chính sách quyền riêng tư</privacy>.",
  "register.creating": "Đang tạo tài khoản…",
  "register.create": "Tạo tài khoản",
  "register.haveAccount": "Đã có tài khoản? <link>Đăng nhập</link>",
  "register.checkInbox": "Kiểm tra hộp thư của bạn",
  "register.enterCode": "Nhập mã 6 chữ số chúng tôi đã gửi đến <b>{email}</b>.",
  "register.verifyEmail": "Xác minh email",
  "register.welcome": "Chào mừng bạn đến với Kalks, {name}",
  "register.readyDemo": "Email của bạn đã được xác minh và tài khoản đã sẵn sàng. Hãy mở tài khoản demo ngay hoặc xác minh danh tính để giao dịch thực.",
  "register.ready": "Email của bạn đã được xác minh và tài khoản đã sẵn sàng. Theo dõi thị trường trực tiếp ngay; tính năng nạp tiền và tài khoản giao dịch sắp ra mắt.",
  "register.openClientArea": "Mở khu vực khách hàng",

  // Complete profile after Google sign-up
  "complete.stepGoogle": "Tài khoản Google",
  "complete.stepDetails": "Thông tin của bạn",
  "complete.loading": "Đang tải hồ sơ Google của bạn…",
  "complete.expiredTitle": "Hãy bắt đầu lại",
  "complete.accountExists": "Tài khoản của bạn đã được thiết lập. Tiếp tục với Google để đăng nhập.",
  "complete.expired": "Phiên đăng ký Google đã hết hạn hoặc đã hoàn tất ở tab khác. Tiếp tục với Google để tiếp tục từ chỗ bạn đã dừng.",
  "complete.preferEmail": "Muốn dùng email? <link>Đăng ký bằng email</link>",
  "complete.title": "Hoàn thiện hồ sơ",
  "complete.subtitle": "Một vài thông tin cần thiết cho mọi tài khoản Kalks. Chỉ mất chưa đầy một phút.",
  "complete.googleAccount": "Tài khoản Google",
  "complete.emailTaken": "Hãy <signin>đăng nhập</signin> bằng mật khẩu hoặc <reset>đặt lại mật khẩu</reset>.",
  "complete.ready": "Tài khoản của bạn đã sẵn sàng và đã đăng nhập bằng Google. Theo dõi thị trường trực tiếp ngay; tính năng nạp tiền và tài khoản giao dịch sắp ra mắt.",
  "complete.notYou": "Không phải bạn? <link>Dùng tài khoản Google khác</link>",

  // Forgot / reset password
  "forgot.backToSignIn": "Quay lại đăng nhập",
  "forgot.titleReset": "Đặt lại mật khẩu",
  "forgot.titleCode": "Nhập mã",
  "forgot.titleNew": "Đặt mật khẩu mới",
  "forgot.intro": "Chúng tôi sẽ gửi email cho bạn mã 6 chữ số để đặt lại mật khẩu.",
  "forgot.codeSent": "Nếu có tài khoản với <b>{email}</b>, chúng tôi đã gửi mã đến địa chỉ đó.",
  "forgot.passwordRule": "Dùng ít nhất 8 ký tự, kết hợp chữ cái, số và ký hiệu.",
  "forgot.sendCode": "Gửi mã",
  "forgot.updating": "Đang cập nhật…",
  "forgot.update": "Cập nhật mật khẩu",
  "forgot.toastUpdated": "Đã cập nhật mật khẩu",
  "forgot.toastUpdatedBody": "Hãy đăng nhập bằng mật khẩu mới.",

  // Step-up confirmation dialog
  "stepup.intro": "Để {what}, hãy nhập mã 6 chữ số chúng tôi đã gửi đến <b>{email}</b>. Mã hết hạn sau {minutes} phút.",
  "stepup.spam": "Chưa nhận được mã? Hãy kiểm tra thư mục spam.",
  "stepup.checking": "Đang kiểm tra…",
  "stepup.saving": "Đang lưu…",
  "stepup.sendAgain": "Gửi lại mã",
  "stepup.sendingCode": "Đang gửi mã xác nhận đến email của bạn…",
};
export default auth;
