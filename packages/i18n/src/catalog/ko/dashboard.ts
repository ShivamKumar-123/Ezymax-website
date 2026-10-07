import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // 페이지 헤더 (Client Area 홈)
  "greeting.morning": "{name}님, 좋은 아침입니다",
  "greeting.afternoon": "{name}님, 좋은 오후입니다",
  "greeting.evening": "{name}님, 좋은 저녁입니다",
  "greeting.welcome": "{name}님, 환영합니다",
  "subtitle.live": "Kalks에 오신 것을 환영합니다. 계정 현황과 오늘의 시장을 확인하세요.",
  "subtitle.demo": "오늘 계좌 운용 현황입니다.",
  launchTrader: "Kalks Trader 실행",
  openTerminal: "거래 터미널 열기",

  // 시작하기 체크리스트
  "steps.title": "시작하기",
  "steps.subtitle": "실거래까지의 진행 상황",
  "steps.progress": "{done}/{total}",
  "steps.account.title": "계정 만들기",
  "steps.account.text": "{date}에 가입했습니다.",
  "steps.email.title": "이메일 인증",
  "steps.email.verified": "{email} 인증이 완료되었습니다.",
  "steps.email.confirm": "보내 드린 코드로 {email}을(를) 인증하세요.",
  "steps.kyc.title": "본인 인증",
  "steps.kyc.verified": "본인 인증이 완료되었습니다. 이제 출금할 수 있습니다.",
  "steps.kyc.moreInfo": "서류가 한 가지 더 필요합니다.",
  "steps.kyc.review": "인증팀에서 서류를 검토하고 있습니다.",
  "steps.kyc.draft": "진행하던 단계부터 계속하세요. 약 3분 소요됩니다.",
  "steps.kyc.rejected": "서류를 인증하지 못했습니다. 다시 시작할 수 있습니다.",
  "steps.kyc.todo": "약 3분 소요됩니다. 완료하면 출금이 가능합니다.",
  "steps.accountOpen.title": "거래 계좌 개설",
  "steps.accountOpen.opened": { other: "실계좌 {live}개, 데모 계좌 {demo}개가 개설되어 있습니다." },
  "steps.accountOpen.todo": "실계좌 또는 데모 계좌를 개설하세요. 로그인 정보가 즉시 발급됩니다.",
  "steps.wallet.title": "지갑에 입금",
  "steps.wallet.text": "TRC20 USDT 입금 기능을 연결하고 있습니다.",
  // 단계 상태 칩
  "steps.state.done": "완료",
  "steps.state.todo": "할 일",
  "steps.state.review": "검토 중",
  "steps.state.rejected": "거부됨",
  "steps.state.soon": "시작 전",

  // 거래 계좌 카드
  "accounts.title": "거래 계좌",
  "accounts.summary": "실계좌 평가 잔액 <b>{equity}</b> · 실계좌 {live} · 데모 {demo} · 보유 포지션 {positions}",
  "accounts.subtitle": "실계좌 및 데모 계좌",
  "accounts.all": "모든 계좌",
  "accounts.open": "계좌 개설",
  "accounts.unavailable": "지금은 거래 계좌 정보를 불러올 수 없습니다. 잔고는 안전하게 보관되어 있습니다.",
  "accounts.openLive.title": "실계좌 개설",
  "accounts.openLive.text": "실제 시장에서 거래합니다. 잔고 0에서 시작하며, 지갑에서 입금할 수 있습니다.",
  "accounts.openDemo.title": "데모 계좌 개설",
  "accounts.openDemo.text": "실시간 가격으로 가상 자금을 운용하며, 매일 충전할 수 있습니다.",
  "accounts.more": { other: "계좌 {count}개 더 보기" },
  "accounts.myTitle": "내 거래 계좌",

  // 내 계정 카드
  "account.title": "내 계정",
  "account.clientId": "고객 ID",
  "account.emailStatus": "이메일 상태",
  "account.notVerified": "미인증",
  "account.identity": "본인 인증",
  "account.memberSince": "가입일",
  "account.profile": "프로필",

  // Kalks Trader 배너
  "trader.chip": "실시간 가격",
  "trader.text": "외환, 금속, 지수, 에너지, 암호화폐, 주식 등 {count}개 종목의 실시간 시세와 차트를 제공합니다. 설치 없이 브라우저에서 실행됩니다.",

  // 마켓 시계 / 히트맵
  "sessions.title": "마켓 시계",
  "sessions.open": "{total}개 시장 중 {open}개 개장",
  "heatmap.title": "마켓 히트맵",
  "heatmap.subtitle": "실시간 가격 기준 오늘의 변동 · 빈 점: 시장 마감",
  "heatmap.up": "상승 {count}",
  "heatmap.down": "하락 {count}",
  "heatmap.allMarkets": "전체 시장",
  "heatmap.tipOpen": "{symbol} · 시장 개장",
  "heatmap.tipClosed": "{symbol} · 시장 마감, 직전 세션 변동",

  // 고객 지원 카드
  "support.title": "도움이 필요하신가요?",
  "support.text": "등록된 이메일 주소로 <mail>{email}</mail>에 문의하시고 고객 ID를 함께 기재해 주세요.",
  "support.emailSupport": "이메일 문의",
  "support.copied": "이메일 주소가 복사되었습니다",
  "support.copyFailed": "복사하지 못했습니다. 주소를 직접 선택해 주세요",

  // 데모 대시보드: 온보딩
  "onboarding.title": "계정 설정을 완료하세요",
  "onboarding.text": "KYC를 완료하면 출금과 더 높은 한도를 이용할 수 있습니다.",
  "onboarding.progress": "진행률",
  "onboarding.dismiss": "닫기",

  // 증거금 상태
  "margin.title": "증거금 상태",
  "margin.subtitle": "모든 실계좌 기준",
  "margin.healthy": "양호",
  "margin.level": "증거금 수준",
  "margin.used": "사용 증거금",
  "margin.free": "가용 증거금",

  // 평가 잔액 / 손익. {range}는 그대로 유지
  "equity.title": "총 평가 잔액",
  "equity.changeOver": "{range} 변동",
  "pnl.title": "손익 · 이번 달",
  "pnl.lowRisk": "낮은 위험",
  "pnl.winRate": "승률 (30일)",
  "pnl.trades": "거래 수 (30일)",
  "pnl.avgWin": "평균 수익 거래",
  "pnl.avgLoss": "평균 손실 거래",
  "pnl.charges": "지불 수수료",

  // KPI 카드
  "kpi.wallet": "지갑",
  "kpi.today": "오늘 +{pct}%",
  "kpi.monthPnl": "월간 손익",
  "kpi.vsLastMonth": "지난달 대비 +{pct}%",
  "kpi.partnerEarnings": "파트너 수익",
  "kpi.copy": "카피 {amount}",

  // 급등락 종목
  "movers.title": "급등락 종목",
  "movers.gainers": "상승",
  "movers.losers": "하락",

  // 경제 캘린더. A = 실제, F = 예상, P = 이전
  "calendar.title": "경제 캘린더",
  "calendar.subtitle": "오늘 · 서버 시간 GMT+3",
  "calendar.actual": "실제 {value} · ",
  "calendar.forecastPrevious": "예상 {forecast} · 이전 {previous}",

  // 뉴스 / 세계
  "news.title": "시장 뉴스",
  "news.all": "전체 뉴스",
  "news.pinned": "고정됨",
  "world.title": "세계 시장 및 뉴스",
  "world.subtitle": "국가별 실시간 헤드라인 및 통화 심리",
  "world.stories": { other: "오늘 기사 {count}건" },

  // 보유 포지션
  "positions.title": "보유 포지션",
  "positions.summary": { other: "포지션 {count}개 · 평가 손익" },
  "positions.terminal": "터미널",

  // 파트너 배너
  "partner.chip": "파트너 프로그램",
  "partner.title": "트레이더를 초대하세요. 랏당 최대 $15를 평생 받으세요.",
  "partner.text": "다단계 커미션, CPA 보너스, 실시간 추적. 내 링크: <link>{url}</link>",
  "partner.open": "파트너 대시보드 열기",

  // 짧은 상대 시간
  "time.justNow": "방금 전",
  "time.minutesAgo": "{count}분 전",
  "time.hoursAgo": "{count}시간 전",
  "time.daysAgo": "{count}일 전",
  "time.ago": "{time} 전",

  // 알림
  "notifications.title": "알림",
  "notifications.ariaUnread": "알림, 읽지 않음 {count}건",
  "notifications.markAll": "모두 읽음으로 표시",
  "notifications.clear": "지우기",
  "notifications.emptyTitle": "아직 알림이 없습니다",
  "notifications.emptyText": "입금, 출금, 본인 인증, 거래 알림 및 고객 지원 답변이 여기에 표시됩니다.",
  "notifications.settings": "알림 설정",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "메뉴 펼치기",
  "chrome.collapse": "메뉴 접기",
  "chrome.menu": "메뉴",
  "home.todayPnl": "오늘의 손익",
  "home.walletBalance": "지갑 잔액",
  "home.rewardsEarnings": "리워드 및 IB 수익",
  "home.todayPct": "오늘 {pct}%",
  "home.floating": "평가 손익",
  "home.rewards": "리워드",
  "home.accountsChip": "실계좌 {live}개 · 보유 포지션 {positions}개",
  "home.statistics": "통계",
  "home.pnl": "손익",
  "home.weekly": "주간",
  "home.monthly": "월간",
  "home.lastYear": "지난 1년",
  "home.noHistory": "실계좌에 거래 활동이 생기면 자산 추이가 여기에 표시됩니다.",
  "home.thisPeriod": "이번 기간",
  "home.previousPeriod": "이전 기간",
  "home.yourAccounts": "내 계좌",
  "home.tradingAccount": "거래 계좌",
  "home.accountInfo": "계좌 정보",
  "home.accountName": "계좌 이름",
  "home.leverage": "레버리지",
  "home.previous": "이전 계좌",
  "home.next": "다음 계좌",
  "home.showBalances": "잔액 보기",
  "home.hideBalances": "잔액 숨기기",
  "home.trade": "거래하기",
  "home.history": "내역",
  "home.funding": "입금",
  "home.linked": "연결 항목",
  "home.connected": "연결됨",
  "home.subscriptions": { other: "활성 구독 {count}개" },
  "home.points": "{points}포인트",
  "home.redeem": "교환하기",
  "home.networkUnavailable": "일시 중지됨",
  "home.totalBalance": "총 잔액",
  "home.totalBalanceSub": "실계좌 및 지갑",
  "home.transferFunds": "자금 이체",
  "home.quickActions": "빠른 실행",
  "home.later": "나중에",
  "home.viewDetails": "자세히 보기",
  "home.verifyNow": "지금 인증하기",
  "home.fundTitle": "지갑 충전",
  "home.fundText": "USDT를 입금하고 실계좌에서 거래를 시작하세요.",
  "home.depositNow": "지금 입금",
  "home.tradingTitle": "거래",
  "home.marketsTitle": "시장",
  "home.moreTitle": "추천",
};
export default dashboard;
