import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse portfolio.st.* / portfolio.an.*; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Berichte",
  "eyebrow.analytics": "Berichte · USD · Serverzeit",

  // Account picker (a card that opens a sheet)
  "account.title": "Konto",
  "account.choose": "Konto wählen",
  "account.allHint": { one: "{count} Live-Konto", other: "{count} Live-Konten" },
  "account.change": "Konto wechseln",

  // Statements
  "st.day": "Tag",
  "st.pickDay": "Tag wählen",
  "st.pickFrom": "Startdatum",
  "st.pickTo": "Enddatum",
  "st.include": "Einschließen",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Wird erstellt…",
  "st.ready": "Kontoauszug bereit",
  "st.saved": "Gespeichert als {file}",
  "st.shareTitle": "Kontoauszug teilen",
  "st.failed": "Der Kontoauszug konnte nicht heruntergeladen werden",
  "st.offline": "Sie sind offline. Stellen Sie eine Verbindung her, um Kontoauszüge herunterzuladen.",
  "st.monthly.empty": "Noch keine Monatsauszüge.",
  "st.monthly.offline": "Sie sind offline. Stellen Sie eine Verbindung her, um die monatlichen Kontoauszüge zu sehen.",
  "st.monthly.a11y": "{month}: netto {net}, {trades}. Öffnet die Downloads.",
  "st.month.title": "Kontoauszug {month}",
  "st.month.formats": "Herunterladen als",
  "st.prevMonth": "Vorheriger Monat",
  "st.nextMonth": "Nächster Monat",

  // Analytics: hero and stat tiles
  "an.hero.label": "Netto-P&L · {period}",
  "an.hero.return": "Rendite",
  "an.hero.trades": "Trades",
  "an.hero.lots": "Lots",
  "an.tile.sharpe": "Sharpe Ratio",
  "an.tile.expectancy": "Erwartungswert",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Ø Gewinn / Verlust",
  "an.tile.rr": "Chance : Risiko 1 : {value}",
  "an.tile.holdSplit": "Gewinner {win} · Verlierer {loss}",
  "an.tile.streaks": "Serien",
  "an.tile.streaksSub": "Gewinne / Verluste in Folge",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Noch kein Trade",

  // Analytics: curves
  "an.curve.hint": "Halten Sie den Chart gedrückt, um jeden Tag zu sehen",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Eigenkapital {equity}, Kontostand {balance} am {date}. Maximaler Drawdown {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "P&L-Kalender",
  "an.cal.subtitle": "Nettoergebnis geschlossener Trades pro Servertag",
  "an.cal.subtitleEstimated": "Tägliche Kontostandsänderung, bereinigt um Ein- und Auszahlungen",
  "an.cal.days": { one: "{count} Handelstag", other: "{count} Handelstage" },
  "an.cal.green": "{count} grün",
  "an.cal.red": "{count} rot",
  "an.cal.noTrades": "Keine geschlossenen Trades",
  "an.cal.select": "Tippen Sie auf einen Tag, um sein Ergebnis zu sehen",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "Netto-P&L nach Stunde",
  "an.hour.byDayHour": "Wochentag × Stunde",
  "an.hour.tap": "Tippen Sie auf einen Balken oder eine Zelle für Details",
  "an.tapBar": "Tippen Sie auf einen Balken für Details",
  "an.session.best": "Beste",
  "an.session.asia": "Asien",
  "an.session.london": "London",
  "an.session.overlap": "London / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "New York spät",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Eigenkapital aktuell",
  "an.charges.total": "Gezahlte Gebühren",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "Overtrading an {count} Tag", other: "Overtrading an {count} Tagen" },
  "insight.overtrading.text": "An diesen Tagen haben Sie mehr als {limit} Trades platziert (an einem typischen Tag {median}). Nettoergebnis an diesen Tagen: {net}.",
  "insight.overtrading.tip": "Legen Sie ein Tageslimit von {cap} Trades fest.",
  "insight.revenge.title": { one: "{count} möglicher Revenge-Trade", other: "{count} mögliche Revenge-Trades" },
  "insight.revenge.text": "Trades, die innerhalb von 15 Minuten nach einem Verlust mit gleicher oder höherer Größe eröffnet wurden. Sie waren in {rate}% der Fälle profitabel, insgesamt {net}.",
  "insight.revenge.tip": "Pausieren Sie nach einem Verlust 15 Minuten vor dem nächsten Trade.",
  "insight.risk.title": "Risiko pro Verlust-Trade",
  "insight.risk.text": {
    one: "Ein Verlust-Trade kostete im Schnitt {avg}% Ihres Kontostands, höchstens {max}%. {count} Verlust lag über 2%.",
    other: "Ein Verlust-Trade kostete im Schnitt {avg}% Ihres Kontostands, höchstens {max}%. {count} Verluste lagen über 2%.",
  },
  "insight.risk.tip": "Wählen Sie die Positionsgröße so, dass ein Stop Loss höchstens 1–2% des Kontostands kostet.",
  "insight.holdLosers.title": "Verlierer werden länger gehalten als Gewinner",
  "insight.holdLosers.text": "Verlust-Trades bleiben im Schnitt {loss} offen, Gewinner {win}.",
  "insight.holdLosers.tip": "Setzen Sie beim Eröffnen einen Stop Loss und lassen Sie ihn stehen.",
  "insight.stopOut.title": { one: "{count} Schließung durch Stop Out", other: "{count} Schließungen durch Stop Out" },
  "insight.stopOut.text": "Positionen wurden durch den Margin-Stop-Out geschlossen, nicht durch Ihren eigenen Stop Loss.",
  "insight.stopOut.tip": "Halten Sie das Margin-Level mit kleineren Positionen über dem Margin-Call-Level.",
  "insight.slTp.title": "Durch Stop Loss oder Take Profit geschlossene Trades",
  "insight.slTp.text": "{tp} durch Take Profit, {sl} durch Stop Loss, der Rest manuell oder durch den Dealing Desk geschlossen.",
  "insight.slTp.tip": "Geplante Ausstiege sorgen für beständige Ergebnisse.",
  "insight.session.title": "Beste Sitzung: {session}",
  "insight.session.text": "{trades} Trades mit {rate}% Trefferquote. Schwächste: {worst} ({net}).",
  "insight.session.tip": "Konzentrieren Sie sich auf die Sitzung {session}.",
  "insight.tip": "Tipp",

  // States
  "state.updating": "Wird aktualisiert…",
  "state.stale": "Gespeicherte Daten werden angezeigt. Zum Aktualisieren nach unten ziehen.",
  "state.notShared.title": "Nicht für Sie freigegeben",
  "state.footer": "Alle Beträge in USD (Cent-Konten umgerechnet). Zeiten in Serverzeit, GMT+2 / GMT+3.",
  "state.footerStatements": "Kontoauszüge in der Kontowährung (USC bei Cent-Konten). Zeiten in Serverzeit, GMT+2 / GMT+3.",
};
export default mobileReports;
