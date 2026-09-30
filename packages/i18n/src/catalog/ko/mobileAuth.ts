import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 로그인, 가입 및 비밀번호 재설정 (대부분 `auth` 네임스페이스를 재사용)
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "계정 만들기",
  "signIn.newHere": "Kalks가 처음이신가요?",
  "signUp.eyebrow": "계정 개설",
  "signUp.haveAccount": "이미 계정이 있으신가요?",
  "signUp.signIn": "로그인",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "만 18세 이상이어야 합니다.",
  "signUp.phonePlaceholder": "전화번호",
  "signUp.marketing": "트레이딩 팁, 제품 소식 및 혜택을 이메일로 받겠습니다. 언제든지 수신을 거부할 수 있습니다.",
  "signUp.chooseCountry": "국가 선택",
  "signUp.continue": "Kalks로 계속하기",
  "forgot.eyebrow": "비밀번호 재설정",
  "forgot.continue": "계속",
  "otp.eyebrow": "보안 확인",
  "otp.wrongEmail": "다른 이메일 사용",
  "googleSoon": "Google 로그인은 웹의 Client Area에서 이용할 수 있습니다.",
};
export default mobileAuth;
