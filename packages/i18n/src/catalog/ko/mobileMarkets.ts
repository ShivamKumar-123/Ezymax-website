import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 시장 탭 (관심 종목). 자산군 이름, Bid / Ask 및 검색은 `market` 네임스페이스를 재사용
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "실시간 가격",
  "empty.favourites.title": "아직 즐겨찾기가 없습니다",
  "empty.favourites.body": "종목을 길게 눌러 여기에 고정하세요.",
  "empty.favourites.action": "외환 둘러보기",
  "fav.added": "{symbol}을(를) 즐겨찾기에 추가했습니다",
  "fav.removed": "{symbol}을(를) 즐겨찾기에서 삭제했습니다",
  "a11y.row": "{symbol}, {name}. 차트를 엽니다. 길게 눌러 즐겨찾기에 추가하거나 삭제하세요.",
  "a11y.search": "종목 검색",
  cancel: "취소",
  "status.connecting": "가격에 연결 중…",
  "status.offline": "가격 일시 중지: 연결 없음",
};
export default mobileMarkets;
