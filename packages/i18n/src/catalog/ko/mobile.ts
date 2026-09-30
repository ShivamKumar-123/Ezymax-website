import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 앱 셸, 온보딩 및 모든 화면이 공유하는 상태
const mobile: NsMessages<"mobile"> = {
  // 탭 바 (한 단어)
  "tab.home": "홈",
  "tab.markets": "시장",
  "tab.trade": "거래",
  "tab.portfolio": "포트폴리오",
  "tab.more": "더보기",

  // 온보딩 (슬라이드 3개). 제목은 큰 대문자 디스플레이 서체: 짧게
  "onboarding.skip": "건너뛰기",
  "onboarding.next": "다음",
  "onboarding.getStarted": "시작하기",
  "onboarding.haveAccount": "계정이 있습니다",
  "onboarding.welcome.title": "지금 시장으로",
  "onboarding.welcome.body": "외환, 금속, 지수, 에너지, 암호화폐, 주식을 하나의 계정에서. USDT로 즉시 입금하세요.",
  "onboarding.markets.title": "모든 틱을 실시간으로",
  "onboarding.markets.body": "실제 Bid·Ask 가격, 나만의 차트, 원탭 매수·매도까지. 휴대폰에 맞춰 만들었습니다.",
  "onboarding.security.title": "철저한 보안",
  "onboarding.security.body": "새 기기에서는 이메일 코드, 출금에는 확인 코드, 세션은 보안 저장소에 보관합니다.",
  "onboarding.step": "{n} / {total}",

  // 공통 상태
  "state.offline.title": "연결이 끊겼습니다",
  "state.offline.body": "인터넷 연결을 확인하세요. 가격과 계좌는 자동으로 다시 연결됩니다.",
  "state.reconnecting": "재연결 중…",
  "state.error.title": "문제가 발생했습니다",
  "state.error.body": "불러오지 못했습니다. 아래로 당기거나 탭하여 다시 시도하세요.",
  "state.maintenance.title": "점검 중",
  "state.maintenance.body": "Kalks를 업그레이드하고 있습니다. 포지션과 자금은 안전합니다. 잠시 후 다시 확인해 주세요.",
  "state.sessionExpired": "세션이 종료되었습니다. 다시 로그인하세요.",
  "state.updated": "{time} 업데이트",
  "state.pullToRefresh": "당겨서 새로 고침",

  "viewOnly": "보기 전용 접근",
  "viewOnlyBody": "이 로그인은 공유된 계좌를 볼 수 있지만 변경할 수는 없습니다.",

  // 공통 짧은 라벨
  "action.retry": "다시 시도",
  "action.openWeb": "Client Area에서 열기",
  "action.signOut": "로그아웃",
  "action.seeAll": "모두 보기",
  "a11y.close": "닫기",
  "a11y.back": "뒤로",
};
export default mobile;
