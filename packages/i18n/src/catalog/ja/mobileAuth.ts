import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "アカウントを作成",
  "signIn.newHere": "Kalksは初めてですか？",
  "signUp.eyebrow": "アカウント開設",
  "signUp.haveAccount": "すでにアカウントをお持ちですか？",
  "signUp.signIn": "ログイン",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "18歳以上である必要があります。",
  "signUp.phonePlaceholder": "電話番号",
  "signUp.marketing": "取引のヒント、製品ニュース、特典をメールで受け取る。配信はいつでも停止できます。",
  "signUp.chooseCountry": "居住国を選択",
  "signUp.continue": "Kalksへ進む",
  "forgot.eyebrow": "パスワードのリセット",
  "forgot.continue": "続行",
  "otp.eyebrow": "セキュリティ確認",
  "otp.wrongEmail": "別のメールアドレスを使用",
  "googleSoon": "Googleログインはウェブ版のクライアントエリアでご利用いただけます。",
};
export default mobileAuth;
