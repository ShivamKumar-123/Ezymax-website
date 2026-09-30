import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "สร้างบัญชี",
  "signIn.newHere": "เพิ่งเริ่มใช้ Kalks?",
  "signUp.eyebrow": "เปิดบัญชีของคุณ",
  "signUp.haveAccount": "มีบัญชีอยู่แล้ว?",
  "signUp.signIn": "เข้าสู่ระบบ",
  "signUp.dobPlaceholder": "YYYY-MM-DD (ค.ศ.)",
  "signUp.dobHint": "คุณต้องมีอายุ 18 ปีขึ้นไป",
  "signUp.phonePlaceholder": "หมายเลขโทรศัพท์",
  "signUp.marketing": "ส่งเคล็ดลับการเทรด ข่าวผลิตภัณฑ์ และข้อเสนอพิเศษทางอีเมลถึงฉัน ยกเลิกการรับได้ทุกเมื่อ",
  "signUp.chooseCountry": "เลือกประเทศของคุณ",
  "signUp.continue": "ไปต่อที่ Kalks",
  "forgot.eyebrow": "รีเซ็ตรหัสผ่าน",
  "forgot.continue": "ดำเนินการต่อ",
  "otp.eyebrow": "ตรวจสอบความปลอดภัย",
  "otp.wrongEmail": "ใช้อีเมลอื่น",
  googleSoon: "เข้าสู่ระบบด้วย Google ได้ในพื้นที่ลูกค้าบนเว็บ",
};
export default mobileAuth;
