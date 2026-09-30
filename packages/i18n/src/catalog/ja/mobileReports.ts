import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile), Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "レポート",
  "eyebrow.analytics": "レポート · USD · サーバー時間",

  // Account picker (a card that opens a sheet)
  "account.title": "口座",
  "account.choose": "口座を選択",
  "account.allHint": { other: "リアル口座 {count}件" },
  "account.change": "口座を変更",

  // Statements
  "st.day": "日",
  "st.pickDay": "日付を選択",
  "st.pickFrom": "開始日",
  "st.pickTo": "終了日",
  "st.include": "含める項目",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "準備中…",
  "st.ready": "取引報告書の準備ができました",
  "st.saved": "{file}として保存しました",
  "st.shareTitle": "取引報告書を共有",
  "st.failed": "取引報告書をダウンロードできませんでした",
  "st.offline": "オフラインです。取引報告書をダウンロードするには接続してください。",
  "st.monthly.empty": "月次取引報告書はまだありません。",
  "st.monthly.offline": "オフラインです。月次取引報告書を表示するには接続してください。",
  "st.monthly.a11y": "{month}：純損益 {net}、{trades}。ダウンロードを開きます。",
  "st.month.title": "{month}の取引報告書",
  "st.month.formats": "ダウンロード形式",
  "st.prevMonth": "前月",
  "st.nextMonth": "翌月",

  // Analytics: hero and stat tiles
  "an.hero.label": "純損益 · {period}",
  "an.hero.return": "リターン",
  "an.hero.trades": "取引数",
  "an.hero.lots": "ロット",
  "an.tile.sharpe": "シャープレシオ",
  "an.tile.expectancy": "期待値",
  "an.tile.sortino": "ソルティノ {value}",
  "an.tile.avgWinLoss": "平均利益 / 損失",
  "an.tile.rr": "リスクリワード 1 : {value}",
  "an.tile.holdSplit": "勝ち {win} · 負け {loss}",
  "an.tile.streaks": "連勝・連敗",
  "an.tile.streaksSub": "最大連勝 / 最大連敗",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "取引はまだありません",

  // Analytics: curves
  "an.curve.hint": "チャートを長押しすると各日の値を確認できます",
  "an.curve.drawdown": "ドローダウン",
  "an.curve.a11y": "{date}の有効証拠金 {equity}、残高 {balance}。最大ドローダウン {drawdown}。",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "損益カレンダー",
  "an.cal.subtitle": "サーバー日ごとの決済済み取引の純損益",
  "an.cal.subtitleEstimated": "日次の残高変動（入出金を除く）",
  "an.cal.days": { other: "取引日 {count}日" },
  "an.cal.green": "プラス {count}日",
  "an.cal.red": "マイナス {count}日",
  "an.cal.noTrades": "決済済み取引なし",
  "an.cal.select": "日付をタップすると結果を表示します",
  "an.cal.a11yDay": "{date}：{net}、{trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "時間帯別の純損益",
  "an.hour.byDayHour": "曜日 × 時間",
  "an.hour.tap": "バーまたはセルをタップすると詳細を表示します",
  "an.tapBar": "バーをタップすると詳細を表示します",
  "an.session.best": "最良",
  "an.session.asia": "アジア",
  "an.session.london": "ロンドン",
  "an.session.overlap": "ロンドン / ニューヨーク",
  "an.session.newYork": "ニューヨーク",
  "an.session.lateNewYork": "ニューヨーク後半",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "現在の有効証拠金",
  "an.charges.total": "支払手数料",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { other: "過剰取引の日が{count}日" },
  "insight.overtrading.text": "これらの日には{limit}件を超える取引を行いました（通常は1日{median}件）。これらの日の純損益：{net}。",
  "insight.overtrading.tip": "1日の取引数の上限を{cap}件に設定しましょう。",
  "insight.revenge.title": { other: "リベンジトレードの可能性 {count}件" },
  "insight.revenge.text": "損失で決済してから15分以内に、同じかそれ以上のサイズで建てた取引です。勝率は{rate}%、合計損益は{net}でした。",
  "insight.revenge.tip": "損失の後は、次の取引まで15分間を空けましょう。",
  "insight.risk.title": "負け取引1件あたりのリスク",
  "insight.risk.text": { other: "負け取引1件あたりの損失は平均で残高の{avg}%、最大で{max}%でした。2%を超えた損失は{count}件です。" },
  "insight.risk.tip": "ストップロスでの損失が残高の1〜2%以内に収まるよう、ポジションサイズを調整しましょう。",
  "insight.holdLosers.title": "負け取引を勝ち取引より長く保有しています",
  "insight.holdLosers.text": "平均保有時間は、負け取引が{loss}、勝ち取引が{win}です。",
  "insight.holdLosers.tip": "取引を建てる際にストップロスを設定し、そのまま維持しましょう。",
  "insight.stopOut.title": { other: "ストップアウトによる決済 {count}件" },
  "insight.stopOut.text": "ご自身のストップロスではなく、証拠金のストップアウトによってポジションが決済されました。",
  "insight.stopOut.tip": "ポジションを小さくして、証拠金維持率をマージンコール水準より上に保ちましょう。",
  "insight.slTp.title": "ストップロスまたはテイクプロフィットで決済された取引",
  "insight.slTp.text": "テイクプロフィットで{tp}件、ストップロスで{sl}件、残りは手動またはディーリングデスクによる決済です。",
  "insight.slTp.tip": "計画的な決済が、安定した結果につながります。",
  "insight.session.title": "最良のセッション：{session}",
  "insight.session.text": "{trades}件の取引で勝率{rate}%。最も弱いセッション：{worst}（{net}）。",
  "insight.session.tip": "{session}セッションに集中しましょう。",
  "insight.tip": "ヒント",

  // States
  "state.updating": "更新中…",
  "state.stale": "保存済みのデータを表示しています。下に引いて更新してください。",
  "state.notShared.title": "共有されていません",
  "state.footer": "金額はすべてUSD（セント口座は換算済み）。時間はサーバー時間（GMT+2 / GMT+3）です。",
  "state.footerStatements": "取引報告書は口座通貨で表示されます（セント口座はUSC）。時間はサーバー時間（GMT+2 / GMT+3）です。",
};
export default mobileReports;
