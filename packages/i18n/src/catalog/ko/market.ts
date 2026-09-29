import type { NsMessages } from "../../core";

// Kalks Trader 왼쪽 패널: 시장 감시(시세 목록), 자산군 칩, 네비게이터
const market: NsMessages<"market"> = {
  // 시장 감시 헤더 및 탭
  title: "시장 감시",
  collapse: "접기",
  "tab.symbols": "종목",
  "tab.details": "상세",
  "tab.favourites": "즐겨찾기",
  segmentAria: "시장 감시 자산군",
  searchPlaceholder: "종목 검색",
  searchAria: "시장 감시 검색",
  clear: "지우기",

  // 시장 감시 열
  "col.symbol": "종목",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "스프레드, 포인트",
  "col.change": "변동%",

  // 행 / 호버 카드
  "row.title": "{name} · 스프레드 {spread}",
  "tip.low": "저",
  "tip.high": "고",
  "tip.spread": "스프레드",
  "tip.range": "범위",
  bid: "Bid",
  ask: "Ask",

  // 빈 상태 및 하단
  "empty.favourites": "아직 즐겨찾기가 없습니다. 종목을 마우스 오른쪽 버튼으로 클릭하여 추가하세요.",
  "empty.noMatch": "일치하는 종목이 없습니다.",
  "footer.count": "종목 {shown} / {total}",
  "footer.hint": "더블클릭: 차트",

  // 컨텍스트 메뉴
  "menu.newOrder": "신규 주문",
  "menu.chartWindow": "차트 창",
  "menu.openInActive": "활성 차트에서 열기",
  "menu.depth": "호가창",
  "menu.specification": "상품 명세",
  "menu.removeFavourite": "즐겨찾기에서 삭제",
  "menu.addFavourite": "즐겨찾기에 추가",
  "menu.hide": "숨기기",
  "menu.showAll": "모두 표시",

  // 토스트
  "toast.hidden": "{symbol}을(를) 시장 감시에서 숨겼습니다",
  "toast.hiddenDesc": "컨텍스트 메뉴에서 모든 종목을 표시할 수 있습니다.",
  "toast.opened": "{symbol}을(를) 활성 차트에서 열었습니다",

  // 자산군 칩
  "segment.favourites": "즐겨찾기",
  "segment.forex": "외환",
  "segment.metals": "금속",
  "segment.indices": "지수",
  "segment.energies": "에너지",
  "segment.crypto": "암호화폐",
  "segment.stocks": "주식",
  "segment.aria": "자산군",
  "segment.title": { other: "{label} · 종목 {count}개" },

  // 네비게이터 트리
  "nav.title": "네비게이터",
  "nav.indicators": "지표",
  "nav.strategies": "전략",
  "nav.scripts": "스크립트",
  "nav.guest": "게스트",
  "nav.noAccount": "아직 거래 계좌가 없습니다",
  "nav.openAccount": "계좌 개설",
  "nav.openAccountTitle": "Kalks 계정 만들기 (Client Area가 열립니다)",
  "nav.signIn": "로그인",
  "nav.signInTitle": "Client Area에 로그인",
  "nav.accountType.live": "실계좌",
  "nav.accountType.demo": "데모",
  "nav.category.trend": "추세",
  "nav.category.oscillators": "오실레이터",
  "nav.category.volatility": "변동성",
  "nav.category.volume": "거래량",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · 더블클릭 또는 Enter로 {symbol}, {tf}에 적용",
  "nav.strategyTitle": { other: "{server} · {login} · 거래 {count}건" },
  "nav.strategyRunning": "{name}이(가) 이미 실행 중입니다",
  "nav.strategyAttached": "{name}이(가) 적용되었습니다",
  "nav.strategyDesc": "{login} · {server} · 오늘 손익 {pnl}",
  "nav.script.closeAll": "모든 포지션 청산",
  "nav.script.closeProfitable": "수익 포지션 청산",
  "nav.script.closeLosing": "손실 포지션 청산",
  "nav.script.deletePendings": "모든 대기 주문 삭제",
  "nav.script.breakevenAll": "모두 손익분기 (SL → 진입가)",
  "nav.scriptTitle": "더블클릭하여 현재 계좌에서 실행",
  "nav.scriptsReadOnly": "읽기 전용 모드에서는 스크립트를 사용할 수 없습니다",
};
export default market;
