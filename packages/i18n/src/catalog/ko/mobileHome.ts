import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 홈 탭. 제목은 큰 대문자 디스플레이 서체: 짧게
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "{name}님, 좋은 아침입니다",
  "greet.afternoon": "{name}님, 좋은 오후입니다",
  "greet.evening": "{name}님, 좋은 저녁입니다",
  equity: "평가 잔액",
  closedToday: "오늘 실현 손익",
  openPnl: "평가 손익",
  allLive: "전체 실계좌 {amount}",
  "quick.deposit": "입금",
  "quick.withdraw": "출금",
  "quick.transfer": "이체",
  "quick.trade": "거래",
  movers: "급등락 종목",
  news: "헤드라인",
  allNews: "전체 뉴스",
  notifications: "알림",
  "kyc.title": "본인 인증을 완료하세요",
  "kyc.body": "인증을 완료하면 실거래와 출금을 이용할 수 있습니다. 몇 분이면 끝납니다.",
  "kyc.pending": "인증 검토 중",
  "kyc.pendingBody": "서류를 확인하고 있습니다. 완료되면 알림을 보내 드립니다.",
  "kyc.action": "계속",
  "noAccount.title": "첫 계좌를 개설하세요",
  "noAccount.body": "데모 계좌는 가상 자금과 함께 몇 초 만에 준비됩니다. 준비되면 실계좌로 시작하세요.",
  "noAccount.action": "계좌 개설",
  "news.empty": "지금은 헤드라인이 없습니다.",
  "a11y.bell": "알림, 읽지 않음 {count}건",

  // 둘러보기: 모듈별 색상 블록 (제목은 최대 두 줄, 힌트는 두 줄)
  "explore.title": "둘러보기",
  "explore.copy": "카피 트레이딩",
  "explore.copyHint": "검증된 트레이더 팔로우",
  "explore.prop": "프롭 챌린지",
  "explore.propHint": "자금을 지원받아 거래",
  "explore.academy": "아카데미",
  "explore.academyHint": "단계별로 배우는 트레이딩",
  "explore.ai": "AI Trader",
  "explore.aiHint": "아이디어를 전략으로",
  "explore.invite": "친구 초대",
  "explore.inviteHint": "친구가 거래하면 보상 지급",
};
export default mobileHome;
