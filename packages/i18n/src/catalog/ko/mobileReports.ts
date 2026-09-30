import type { NsMessages } from "../../core";

// Kalks 모바일 앱 리포트: 명세서 (/reports/statements) 및 분석 (/reports/analytics)
// 대부분의 라벨은 Client Area의 portfolio.st.* / portfolio.an.* 키를 재사용하며, 모바일 전용 문구만 여기에 있습니다.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "리포트",
  "eyebrow.analytics": "리포트 · USD · 서버 시간",

  // 계좌 선택 (시트를 여는 카드)
  "account.title": "계좌",
  "account.choose": "계좌 선택",
  "account.allHint": { other: "실계좌 {count}개" },
  "account.change": "계좌 변경",

  // 명세서
  "st.day": "일",
  "st.pickDay": "날짜 선택",
  "st.pickFrom": "시작일",
  "st.pickTo": "종료일",
  "st.include": "포함 항목",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "준비 중…",
  "st.ready": "명세서 준비 완료",
  "st.saved": "{file}(으)로 저장됨",
  "st.shareTitle": "명세서 공유",
  "st.failed": "명세서를 다운로드하지 못했습니다",
  "st.offline": "오프라인 상태입니다. 명세서를 다운로드하려면 인터넷에 연결하세요.",
  "st.monthly.empty": "아직 월간 명세서가 없습니다.",
  "st.monthly.offline": "오프라인 상태입니다. 월간 명세서를 보려면 인터넷에 연결하세요.",
  "st.monthly.a11y": "{month}: 순손익 {net}, {trades}. 다운로드를 엽니다.",
  "st.month.title": "{month} 명세서",
  "st.month.formats": "다운로드 형식",
  "st.prevMonth": "이전 달",
  "st.nextMonth": "다음 달",

  // 분석: 상단 요약 및 통계 타일
  "an.hero.label": "순손익 · {period}",
  "an.hero.return": "수익률",
  "an.hero.trades": "거래",
  "an.hero.lots": "랏",
  "an.tile.sharpe": "샤프 지수",
  "an.tile.expectancy": "기대값",
  "an.tile.sortino": "소르티노 {value}",
  "an.tile.avgWinLoss": "평균 수익 / 손실",
  "an.tile.rr": "보상 : 위험 1 : {value}",
  "an.tile.holdSplit": "수익 거래 {win} · 손실 거래 {loss}",
  "an.tile.streaks": "연속",
  "an.tile.streaksSub": "연속 수익 / 손실",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "아직 거래 없음",

  // 분석: 곡선
  "an.curve.hint": "차트를 길게 눌러 일별 값을 확인하세요",
  "an.curve.drawdown": "손실폭",
  "an.curve.a11y": "{date} 평가 잔액 {equity}, 잔고 {balance}. 최대 손실폭 {drawdown}.",

  // 분석: 손익 캘린더 (서버 기준 일별 청산 거래 순손익)
  "an.cal.title": "손익 캘린더",
  "an.cal.subtitle": "서버 기준 일별 청산 거래 순손익",
  "an.cal.subtitleEstimated": "일별 잔고 변동, 입출금 제외",
  "an.cal.days": { other: "거래일 {count}일" },
  "an.cal.green": "수익일 {count}",
  "an.cal.red": "손실일 {count}",
  "an.cal.noTrades": "청산된 거래 없음",
  "an.cal.select": "날짜를 탭하여 결과 확인",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // 분석: 세부 분석
  "an.hour.byHour": "시간대별 순손익",
  "an.hour.byDayHour": "요일 × 시간",
  "an.hour.tap": "막대나 셀을 탭하여 상세 보기",
  "an.tapBar": "막대를 탭하여 상세 보기",
  "an.session.best": "최고",
  "an.session.asia": "아시아",
  "an.session.london": "런던",
  "an.session.overlap": "런던 / 뉴욕",
  "an.session.newYork": "뉴욕",
  "an.session.lateNewYork": "뉴욕 후반",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "현재 평가 잔액",
  "an.charges.total": "지불 비용",

  // 거래 행태 인사이트 (수치는 리포트 서비스에서 제공)
  "insight.overtrading.title": { other: "{count}일간 과도한 거래" },
  "insight.overtrading.text": "이날들에는 {limit}건 넘게 거래했습니다(평소 하루 {median}건). 해당 일의 순손익: {net}.",
  "insight.overtrading.tip": "하루 거래 상한을 {cap}건으로 정하세요.",
  "insight.revenge.title": { other: "보복성 거래 의심 {count}건" },
  "insight.revenge.text": "손실 청산 후 15분 이내에 같거나 더 큰 규모로 진입한 거래입니다. 승률 {rate}%, 합계 {net}.",
  "insight.revenge.tip": "손실 후에는 다음 거래 전에 15분간 쉬세요.",
  "insight.risk.title": "손실 거래당 위험",
  "insight.risk.text": { other: "손실 거래 1건당 평균 잔고의 {avg}%, 최대 {max}%를 잃었습니다. 2%를 초과한 손실은 {count}건입니다." },
  "insight.risk.tip": "손절매 시 손실이 잔고의 1–2%를 넘지 않도록 포지션 규모를 정하세요.",
  "insight.holdLosers.title": "손실 거래를 수익 거래보다 오래 보유합니다",
  "insight.holdLosers.text": "손실 거래는 평균 {loss}, 수익 거래는 {win} 동안 보유합니다.",
  "insight.holdLosers.tip": "진입할 때 손절매를 설정하고 그대로 두세요.",
  "insight.stopOut.title": { other: "스톱아웃 청산 {count}건" },
  "insight.stopOut.text": "포지션이 직접 설정한 손절매가 아닌 증거금 스톱아웃으로 청산되었습니다.",
  "insight.stopOut.tip": "포지션 규모를 줄여 증거금 수준을 마진콜 수준 위로 유지하세요.",
  "insight.slTp.title": "손절매 또는 이익 실현으로 청산된 거래",
  "insight.slTp.text": "이익 실현 {tp}건, 손절매 {sl}건, 나머지는 수동 또는 딜링 데스크에서 청산되었습니다.",
  "insight.slTp.tip": "계획된 청산은 결과를 일관되게 유지합니다.",
  "insight.session.title": "최고 세션: {session}",
  "insight.session.text": "거래 {trades}건, 승률 {rate}%. 가장 부진한 세션: {worst} ({net}).",
  "insight.session.tip": "{session} 세션에 집중하세요.",
  "insight.tip": "팁",

  // 상태
  "state.updating": "업데이트 중…",
  "state.stale": "저장된 데이터를 표시하고 있습니다. 아래로 당겨 새로 고치세요.",
  "state.notShared.title": "공유되지 않은 항목",
  "state.footer": "모든 금액은 USD 기준입니다(센트 계좌는 환산). 시간은 서버 시간 GMT+2 / GMT+3 기준입니다.",
  "state.footerStatements": "명세서는 계좌 통화(센트 계좌는 USC)로 작성됩니다. 시간은 서버 시간 GMT+2 / GMT+3 기준입니다.",
};
export default mobileReports;
