import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "创建账户",
  "signIn.newHere": "初次使用 Kalks？",
  "signUp.eyebrow": "开立您的账户",
  "signUp.haveAccount": "已有账户？",
  "signUp.signIn": "登录",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "您必须年满 18 周岁。",
  "signUp.phonePlaceholder": "电话号码",
  "signUp.marketing": "通过邮件向我发送交易技巧、产品资讯和优惠信息。可随时退订。",
  "signUp.chooseCountry": "选择您的国家/地区",
  "signUp.continue": "继续进入 Kalks",
  "forgot.eyebrow": "重置密码",
  "forgot.continue": "继续",
  "otp.eyebrow": "安全验证",
  "otp.wrongEmail": "使用其他邮箱",
  "googleSoon": "Google 登录可在网页版客户专区中使用。",
};
export default mobileAuth;
