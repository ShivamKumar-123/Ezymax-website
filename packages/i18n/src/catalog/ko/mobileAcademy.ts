import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 아카데미 화면 (단계, 챕터 리더, 퀴즈, 최종 시험, 용어집, 진행 상황, 수료증)
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // 아카데미 제목 위 작은 대문자 줄
  eyebrow: "Kalks 아카데미",
  // 제목 아래; {count} = 챕터 수
  "home.subtitle": "8단계 {count}개 챕터 · 퀴즈, 최종 시험, 수료증 제공.",
  // 아카데미 홈의 큰 숫자 타일 (숫자 아래 짧은 라벨)
  "stats.chapters": "완료한 챕터",
  "stats.streakDays": "연속 학습일",
  "stats.certificates": "수료증",
  // {n} = 단계 번호, {title} = 단계 제목
  "home.phaseA11y": "{n}단계: {title}",

  // 챕터 리더
  "reader.updated": "{date} 업데이트",
  "reader.completedOn": "{date} 완료",
  "reader.upNext": "다음 학습",
  "reader.completeHint": "퀴즈를 통과하면 이 챕터가 완료됩니다.",
  "reader.zoomHint": "다이어그램을 전체 화면으로 엽니다",
  "reader.tapToZoom": "탭하여 확대",
  "reader.zoomHelp": "핀치하거나 두 번 탭하여 확대",

  // 앱의 거래 탭에서 챕터 연습; {login} = 데모 계좌 번호
  "practice.title": "데모로 연습하기",
  "practice.onDemo": "데모 #{login}에서 거래",

  // 최종 시험 화면
  "exam.answerAll": "제출하려면 모든 문항에 답하세요.",

  // 용어집; "terms"는 용어 수 옆의 작은 라벨
  "glossary.terms": { other: "쉽게 풀어 쓴 용어" },
  "glossary.letters": "색인",
  "glossary.openTerm": "정의를 엽니다",

  // 수료증
  "cert.share": "공유",
  // 공유 문구; {brand} = 브로커 이름, {n} = 단계 번호, {title} = 단계 제목, {url} = 인증 링크
  "cert.shareText": "{brand} 아카데미 {n}단계 “{title}” 수료증: {url}",
  "cert.imageA11y": "{n}단계 수료증",

  // 접근성 라벨
  "a11y.glossary": "용어집 열기",
  "a11y.progress": "내 진행 상황",
  "a11y.contents": "챕터 목차",

  // 상태
  "state.viewer.title": "공유되지 않은 항목",
  "state.viewer.body": "아카데미는 이 보기 전용 로그인에 공유된 항목에 포함되어 있지 않습니다.",
  "state.disabled.title": "이용할 수 없음",
  "state.disabled.body": "고객님의 계정에서는 아카데미를 이용할 수 없습니다.",
};
export default mobileAcademy;
