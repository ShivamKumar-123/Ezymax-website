import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "이벤트 및 소식",
  subtitle: "팀이 전하는 이벤트, 공지, 뉴스",
  all: "전체 소식",
  "filter.events": "이벤트",
  "filter.posts": "공지",
  "kind.event": "이벤트",
  "kind.post": "공지",
  "state.upcoming": "예정",
  "state.live": "진행 중",
  "state.ended": "종료",
  when: "일시",
  where: "장소",
  online: "온라인",
  join: "온라인 참여",
  readMore: "더 보기",
  published: "{date} 게시",
  "empty.title": "현재 소식이 없습니다",
  "empty.text": "새 이벤트와 공지가 여기에 표시됩니다.",
  "notFound.title": "이 소식을 볼 수 없습니다",
  "notFound.text": "종료되었거나 삭제되었을 수 있습니다.",
  "hero.label": "추천",
  "hero.slide": "슬라이드 {n}/{total}",
  "hero.previous": "이전 슬라이드",
  "hero.next": "다음 슬라이드",
  "hero.pause": "슬라이드쇼 일시정지",
  "hero.play": "슬라이드쇼 재생",
  "hero.dismiss": "이 배너 숨기기",
};
export default updates;
