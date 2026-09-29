import type { NsMessages } from "../../core";

// Client Area 고객 지원: 라이브 채팅, 런처, 지원 페이지. "Kalks" 및 "Kalks AI"는 그대로 유지합니다.
const support: NsMessages<"support"> = {
  // 지원 페이지
  "page.title": "고객 지원",
  "page.subtitle": "Kalks AI와 채팅하여 즉시 답변을 받으세요. 언제든지 상담원 연결을 요청하시면 전체 대화 내용을 바탕으로 저희 팀이 이어서 도와드립니다.",
  "email.prefer": "이메일을 선호하시나요?",
  // <email> 및 <id>는 고객의 이메일 주소와 고객 ID를 감쌉니다
  "email.writeFrom": "<email>{email}</email>에서 보내시고 고객 ID <id>{id}</id>를 포함해 주세요.",
  "email.write": "고객 지원에 이메일 보내기",
  "email.copyId": "고객 ID 복사",
  clientId: "고객 ID",
  notice: "저희 팀의 답변은 알림 벨에도 표시되며, 부재 중일 때는 이메일로 알려드립니다. 프로필 → 알림에서 변경할 수 있습니다.",
  "toast.copied": "{what} 복사됨",
  "toast.copyFailed": "복사하지 못했습니다. 직접 선택해 주세요",

  // 대화 상태
  "status.bot": "AI 어시스턴트",
  "status.waiting": "대기 중",
  "status.assigned": "상담원 연결됨",
  "status.resolved": "종료됨",

  // 대화 내역
  "history.title": "내 대화",
  "history.subtitle": "대화 기록은 Client Area에 보관됩니다",
  "history.emptyTitle": "아직 대화가 없습니다",
  "history.emptyText": "채팅에서 질문하시면 여기에 표시됩니다.",
  conversation: "대화",
  "toast.openFailed": "대화를 열지 못했습니다",

  // 플로팅 버튼
  "launcher.open": "지원 채팅 열기",
  "launcher.close": "지원 채팅 닫기",

  // 채팅
  you: "나",
  agent: "상담원",
  // 이름이 없는 팀원의 대체 이름
  supportName: "고객 지원",
  // 파일 크기, 예: "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // 추천 첫 질문 (고객 메시지로 전송됨)
  "quick.verify": "본인 인증은 어떻게 하나요?",
  "quick.deposit": "USDT는 어떻게 입금하나요?",
  "quick.withdrawal": "출금은 언제 도착하나요?",
  "quick.stopOut": "스톱아웃이란 무엇인가요?",
  "header.supportTeam": "고객 지원팀",
  "header.agentSub": "고객 지원 · Kalks",
  "header.connecting": "상담원과 연결 중…",
  "header.replySoon": "저희 팀이 곧 여기에서 답변드립니다",
  "header.helpCentre": "도움말 센터 답변 · 언제든 상담원 연결 가능",
  "header.instant": "즉시 답변 · 언제든 상담원 연결 가능",
  "chip.liveAgent": "실시간 상담원",
  "menu.aria": "채팅 옵션",
  "menu.talkToPerson": "상담원 연결",
  "menu.endChat": "채팅 종료",
  "menu.newChat": "새 채팅 시작",
  closeChat: "채팅 닫기",
  unavailable: "지금은 채팅을 이용할 수 없습니다.",
  greeting: "안녕하세요, {name}님.",
  "csat.question": "이번 채팅은 어떠셨나요?",
  "csat.stars": { other: "별 {count}개" },
  "csat.placeholder": "추가 의견이 있으신가요? (선택 사항)",
  "csat.send": "평가 보내기",
  "csat.rated": "이 채팅을 {rating}/5점으로 평가하셨습니다",
  "composer.attach": "파일 첨부",
  "composer.messageTo": "{name}에게 메시지…",
  "composer.newChat": "새 채팅 시작…",
  "composer.ask": "{name}에게 무엇이든 물어보세요…",
  "composer.aria": "메시지",
  disclaimer: "{name}은(는) 실수할 수 있으며 투자 조언을 제공하지 않습니다. 채팅은 품질 관리를 위해 기록됩니다.",
  "toast.chattingWith": "{name}와(과) 채팅 중입니다",
  "toast.inQueue": "상담원 연결 대기 중입니다",
  "toast.notSent": "메시지가 전송되지 않았습니다",
  "toast.teamUnreachable": "팀에 연결하지 못했습니다",
  "toast.endFailed": "채팅을 종료하지 못했습니다",
  "toast.rateFailed": "평가가 저장되지 않았습니다",
  "toast.thanks": "의견을 보내 주셔서 감사합니다",
  "toast.fileTooLarge": "파일이 너무 큽니다",
  "toast.fileTooLargeText": "파일은 최대 {mb} MB까지 첨부할 수 있습니다.",
  "toast.unsupported": "지원되지 않는 파일",
  "toast.unsupportedText": "이미지(PNG, JPG, GIF, WEBP) 또는 PDF를 첨부하세요.",
  "toast.uploadFailed": "업로드 실패",
  "error.uploadFailed": "업로드에 실패했습니다.",
};
export default support;
