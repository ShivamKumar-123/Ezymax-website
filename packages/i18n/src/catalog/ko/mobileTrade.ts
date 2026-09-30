import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 거래 탭 (차트, 매도 / 매수 바, 주문 티켓) 및 거래 알림
// 거래 용어는 MetaTrader 5 한국어 현지화를 따릅니다. {placeholders}는 숫자, 가격, 티켓, 종목이므로 그대로 유지합니다.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // 헤더
  pickSymbol: "종목 선택",
  searchSymbol: "종목 검색",
  depth: "호가창",
  alert: "가격 알림",
  news: "{symbol} 뉴스",
  calendar: "{currency} 경제 캘린더",
  "account.chip": "{type} · #{login}",
  "account.manage": "계좌 관리",
  "account.open": "계좌 개설",

  // 차트
  "chart.indicators": "지표",
  "chart.type.candles": "캔들",
  "chart.type.line": "라인",
  "ind.ma": "이동평균 20",
  "ind.ema": "지수이동평균 50",
  "ind.bb": "볼린저 밴드 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "이 종목의 차트 내역이 아직 없습니다",
  "chart.hint": "핀치로 확대 · 드래그로 스크롤 · 길게 눌러 십자선 · 두 번 탭하여 초기화",

  // 매도 / 매수 바 및 티켓
  "bar.volume": "랏",
  "ticket.title": "신규 주문",
  "ticket.confirmBuy": "{volume} {symbol} 매수",
  "ticket.confirmSell": "{volume} {symbol} 매도",
  "ticket.atMarket": "시장가",
  "ticket.at": "{price}에",
  "ticket.addSl": "손절매 추가",
  "ticket.addTp": "이익 실현 추가",
  "ticket.ifHit": "도달 시 {money}",
  "ticket.required": "증거금",
  "ticket.pip": "핍 가치",
  "ticket.after": "주문 후 가용",
  "ticket.notEnough": "이 거래량에 필요한 가용 증거금이 부족합니다.",
  "ticket.noSpecs": "계약 정보 불러오는 중…",
  "ticket.distance": "현재가에서 {n}핍",
  "ticket.price": "가격",

  // 거부: 사유(order.reject.<code>) 아래의 쉬운 설명. 엔진의 상세 메시지가 뒤따름
  "reject.no_money": "가용 증거금이 이 주문에 부족합니다. 거래량을 줄이거나 이 계좌에 자금을 추가하세요.",
  "reject.insufficient_funds": "가용 증거금이 이 주문에 부족합니다. 거래량을 줄이거나 이 계좌에 자금을 추가하세요.",
  "reject.market_closed": "현재 이 시장은 마감되었습니다. 개장 후 다시 시도하세요.",
  "reject.invalid_volume": "이 종목의 거래량 한도와 랏 단위에 맞게 입력하세요.",
  "reject.max_lot": "이 거래량은 계좌의 주문당 최대 거래량을 초과합니다.",
  "reject.close_only": "현재 이 계좌는 포지션 청산만 가능하며 신규 포지션은 열 수 없습니다.",
  "reject.symbol_close_only": "현재 이 종목은 청산만 가능하며 신규 진입은 할 수 없습니다.",
  "reject.trading_disabled": "이 계좌는 거래가 비활성화되어 있습니다. 자세한 내용은 고객 지원팀에 문의하세요.",
  "reject.symbol_halted": "이 종목의 거래가 일시 중단되었습니다. 나중에 다시 시도하세요.",
  "reject.requote.title": "가격이 변동되었습니다",
  "reject.requote": "주문이 전송되는 동안 시장 가격이 변동되었습니다. 새 가격을 확인하고 다시 확정하세요.",
  "reject.invalid_sl": "손절매 가격의 방향이 잘못되었거나 현재가에 너무 가깝습니다.",
  "reject.invalid_tp": "이익 실현 가격의 방향이 잘못되었거나 현재가에 너무 가깝습니다.",
  "reject.invalid_price": "이 가격은 해당 주문 유형에 맞지 않는 방향에 있습니다.",
  "reject.off_market": "이 가격은 시장가와 너무 멀리 떨어져 있습니다. 값을 확인하세요.",
  "reject.stale_price": "이 종목의 가격이 잠시 멈췄습니다. 잠시 후 다시 시도하세요.",
  "reject.no_price": "현재 이 종목의 실시간 가격이 없습니다.",
  "reject.read_only": "이 로그인은 계좌를 볼 수 있지만 거래할 수는 없습니다.",
  "reject.uncertain.title": "거래 서버 응답 없음",
  "reject.uncertain": "주문이 처리되었을 수 있습니다. 다시 시도하기 전에 포트폴리오를 확인하세요.",
  "reject.uncertain.ticket": "다시 확정해도 안전합니다. 같은 주문이 두 번 접수되지 않습니다.",

  // 상태
  "state.noAccount.title": "아직 거래 계좌가 없습니다",
  "state.noAccount.body": "연습하려면 데모 계좌를, 실제로 거래하려면 실계좌를 개설하세요.",
  "state.noAccount.action": "계좌 개설",
  "state.connecting": "거래 서버에 연결 중…",
  "state.readOnly": "이 계좌는 여기서 보기 전용입니다. 가격과 차트는 실시간이며 거래는 비활성화되어 있습니다.",
  "state.marketClosed.title": "시장 마감",
  "state.marketClosed.body": "{symbol}은(는) 다음 세션에 다시 열립니다. 개장 후 주문할 수 있습니다.",
  "state.streamError": "거래 서버에 연결할 수 없습니다",
  "state.streamErrorBody": "포지션과 주문은 서버에 안전하게 보관되어 있습니다. 계속 재연결을 시도합니다.",

  // 결과
  "toast.filled": "{side} {volume} {symbol} 체결",
  "toast.at": "@ {price}",
  "toast.placed": "{symbol} 대기 주문 완료",
  "toast.duplicate": "이미 #{ticket}(으)로 접수됨",
  "toast.duplicateBody": "이 주문은 이미 서버에 도달했습니다. 새로 열린 포지션은 없습니다.",
  "toast.closed": "포지션 #{ticket} 청산 완료",
  "toast.partial": "#{ticket} {volume}랏 청산 완료",
  "toast.modified": "#{ticket} 수정 완료",
  "toast.cancelled": "주문 #{ticket} 취소됨",

  // 앱 사용 중 엔진 알림
  "notify.sl": "손절매 도달",
  "notify.tp": "이익 실현 도달",
  "notify.order_filled": "대기 주문 체결",
  "notify.order_triggered": "주문 발동",
  "notify.margin_call": "마진콜",
  "notify.stop_out": "스톱아웃",
  "notify.order_rejected": "주문 거부",
  "notify.order_expired": "주문 만료",
  "notify.order_cancelled": "주문 취소",
};
export default mobileTrade;
