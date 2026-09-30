import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 알림함, 푸시 알림, 앱 잠금(Face ID / 지문 / 휴대폰 암호), "Google로 계속하기", 앱을 여는 링크
// 브랜드 및 제품 이름(Kalks, Face ID, Touch ID, Google)은 그대로 유지합니다.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // 알림함 (/notifications). 그룹별 날짜 헤더: 오늘, 어제, 그다음 날짜
  "inbox.eyebrow": "알림함",
  "inbox.unread": { other: "읽지 않음 {count}건" },
  "inbox.caughtUp": "모두 확인했습니다",
  "inbox.filter.unread": "읽지 않음",
  "inbox.markedAll": "모두 읽음으로 표시했습니다",
  "inbox.emptyUnread.title": "모두 확인했습니다",
  "inbox.emptyUnread.body": "모든 알림을 읽었습니다. 새 알림이 도착하면 여기에 표시됩니다.",
  "inbox.loadMoreFailed": "이전 알림을 불러오지 못했습니다. 탭하여 다시 시도하세요.",
  // 휴대폰이 오프라인이고 알림함이 이전에 저장한 내용을 보여 줄 때 제목 아래
  "inbox.offlineCached": "오프라인 상태입니다. 이 휴대폰에 저장된 알림입니다.",
  // 행 접근성: "읽지 않음. 입금 완료. 100 USDT가 입금되었습니다. 2분 전"
  "inbox.a11y.unread": "읽지 않음",
  "inbox.a11y.settings": "알림 설정",
  // 열 화면이 없는 알림의 상세 시트
  "inbox.detail.openWeb": "링크 열기",
  "inbox.detail.received": "{time} 수신",

  // 푸시 권한 요청 (첫 실행 시에는 하지 않음): 홈의 시트와 알림함의 카드
  "push.ask.eyebrow": "알림",
  "push.ask.title": "일이 생기는 즉시 확인하세요",
  "push.ask.body": "입금 완료, 출금 지급, 마진콜, 스톱아웃, 고객 지원 답변을 잠금 화면에서 바로 받아보세요.",
  "push.ask.point.money": "입금 및 출금",
  "push.ask.point.risk": "마진콜 및 스톱아웃",
  "push.ask.point.support": "고객 지원 답변",
  "push.ask.allow": "알림 켜기",
  "push.ask.later": "나중에",
  "push.ask.note": "받을 주제는 프로필 › 알림에서 선택합니다. 혜택 알림은 직접 켠 경우에만 발송됩니다.",
  // 잠금 화면에 표시되는 모습의 샘플 알림 ("now" = 시간 라벨)
  "push.ask.now": "지금",
  "push.ask.sampleTitle": "입금 완료",
  "push.ask.sampleBody": "250.00 USDT가 지갑에 입금되었습니다.",
  "push.card.title": "푸시 알림 켜기",
  "push.card.body": "입금, 체결, 마진콜을 잠금 화면에서 받아보세요.",
  "push.card.action": "켜기",
  "push.card.deniedTitle": "푸시 알림이 꺼져 있습니다",
  "push.card.deniedBody": "잠금 화면에서 알림을 받으려면 휴대폰 설정에서 Kalks 알림을 허용하세요.",
  "push.card.deniedAction": "설정 열기",
  "push.card.dismiss": "숨기기",
  "push.enabled": "푸시 알림이 켜졌습니다",
  // Android 알림 채널 (휴대폰의 앱 설정에 표시)
  "push.channel.alerts": "마진콜 및 보안",
  "push.channel.alertsHint": "마진콜 및 스톱아웃 경고, 가격 알림, 새 기기 로그인",
  "push.channel.activity": "계좌 활동",
  "push.channel.activityHint": "입금, 출금, 체결, 인증 및 고객 지원 답변",
  "push.channel.news": "뉴스 및 혜택",
  "push.channel.newsHint": "수신에 동의한 프로모션 및 제품 소식",
  // 앱 사용 중 도착한 푸시의 인앱 배너
  "push.banner.a11y": "새 알림: {title}. 두 번 탭하여 여세요.",

  // 앱 잠금 화면 (콜드 스타트, 설정한 시간 동안 백그라운드에 있은 후, /lock)
  "lock.eyebrow": "잠김",
  "lock.title": "다시 오신 것을 환영합니다",
  "lock.subtitle": "잠금을 해제하고 계좌와 잔고를 확인하세요.",
  // {method}: Face ID, Touch ID, 지문, 얼굴 인식 또는 암호
  "lock.unlockWith": "{method}(으)로 잠금 해제",
  "lock.unlock": "잠금 해제",
  "lock.prompt": "Kalks 잠금 해제",
  "lock.promptSubtitle": "본인 확인",
  "lock.failed": "인증에 실패했습니다. 다시 시도하세요.",
  "lock.lockout": "시도 횟수가 너무 많습니다. 휴대폰 암호로 잠금을 해제한 후 다시 시도하세요.",
  "lock.noScreenLock": "휴대폰에 화면 잠금이 설정되어 있지 않아 Kalks에서 본인 확인을 할 수 없습니다. 로그아웃한 후 비밀번호로 로그인하세요.",
  "lock.notYou": "본인이 아니거나 잠금을 해제할 수 없나요?",
  "lock.signOut": "로그아웃",
  "lock.signOutTitle": "Kalks에서 로그아웃하시겠습니까?",
  "lock.signOutBody": "이메일과 비밀번호로 다시 로그인하게 됩니다. 포지션과 자금에는 영향이 없습니다.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "지문",
  "lock.method.face": "얼굴 인식",
  "lock.method.iris": "홍채",
  "lock.method.passcode": "암호",

  // 설정 › 앱 잠금 (/settings/app-lock)
  "settings.eyebrow": "보안",
  "settings.title": "앱 잠금",
  "settings.subtitle": "앱을 열 때와 백그라운드에서 돌아올 때 {method}(으)로 Kalks를 잠급니다.",
  "settings.toggle": "Kalks 잠금",
  "settings.toggleHint": "{method} 사용, 대체 수단으로 휴대폰 암호 사용",
  "settings.on": "앱 잠금이 켜졌습니다",
  "settings.off": "앱 잠금이 꺼졌습니다",
  "settings.after": "다시 잠그기까지",
  "settings.afterHint": "Kalks가 다시 확인하기 전까지 백그라운드에 머물 수 있는 시간입니다. 앱을 시작할 때는 항상 확인합니다.",
  "settings.timeout.0": "즉시",
  "settings.timeout.60": "1분",
  "settings.timeout.300": "5분",
  "settings.timeout.900": "15분",
  "settings.timeout.3600": "1시간",
  "settings.privacy": "앱 잠금이 켜져 있으면 앱 전환 화면에 잔고 대신 가림 화면이 표시됩니다.",
  "settings.lockNow": "지금 잠그기",
  "settings.confirmOn": "앱 잠금을 켜려면 확인하세요",
  "settings.confirmOff": "앱 잠금을 끄려면 확인하세요",
  // 사용자가 "다시 잠그기까지" 시간을 늘릴 때의 시스템 프롬프트
  "settings.confirmTimeout": "Kalks 잠금 시간을 변경하려면 확인하세요",
  // 화면 잠금이 제거된 휴대폰에서 비밀번호로 로그인한 후의 토스트 본문 (화면 잠금 없이는 앱 잠금이 작동하지 않음)
  "settings.turnedOffNoScreenLock": "이 휴대폰에는 화면 잠금이 없어 Kalks에서 본인 확인을 할 수 없습니다. 앱 잠금을 다시 사용하려면 휴대폰 설정에서 화면 잠금을 설정하세요.",
  "settings.notConfirmed": "확인되지 않아 변경되지 않았습니다",
  "settings.unavailableTitle": "먼저 화면 잠금을 설정하세요",
  "settings.unavailableBody": "앱 잠금은 휴대폰의 Face ID, 지문 또는 암호를 사용합니다. 휴대폰 설정에서 하나를 켠 후 다시 오세요.",
  "settings.webTitle": "앱에서 이용 가능",
  "settings.webBody": "앱 잠금은 iPhone 및 Android용 Kalks 앱에서 작동합니다.",
  "settings.thisPhone": "이 휴대폰에만 적용됩니다",

  // 앱을 여는 링크(kalks://…, 알림 탭) 중 일치하는 화면이 없는 경우
  "link.notFound.title": "열 수 있는 화면이 없습니다",
  "link.notFound.body": "이 링크와 일치하는 앱 화면이 없습니다. 오래된 링크이거나 웹의 Client Area용 링크일 수 있습니다.",
  "link.notFound.home": "홈으로 이동",
  "link.openFailed": "이 링크를 열지 못했습니다.",
};
export default mobilePlatform;
