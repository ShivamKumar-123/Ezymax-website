import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Tạo tài khoản",
  "signIn.newHere": "Mới đến Kalks?",
  "signUp.eyebrow": "Mở tài khoản của bạn",
  "signUp.haveAccount": "Đã có tài khoản?",
  "signUp.signIn": "Đăng nhập",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "Bạn phải từ 18 tuổi trở lên.",
  "signUp.phonePlaceholder": "Số điện thoại",
  "signUp.marketing": "Gửi cho tôi mẹo giao dịch, tin sản phẩm và ưu đãi qua email. Có thể hủy đăng ký bất cứ lúc nào.",
  "signUp.chooseCountry": "Chọn quốc gia của bạn",
  "signUp.continue": "Tiếp tục đến Kalks",
  "forgot.eyebrow": "Đặt lại mật khẩu",
  "forgot.continue": "Tiếp tục",
  "otp.eyebrow": "Kiểm tra bảo mật",
  "otp.wrongEmail": "Dùng email khác",
  "googleSoon": "Đăng nhập bằng Google có trong khu vực khách hàng trên web.",
};
export default mobileAuth;
