import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements and Analytics. Most labels reuse portfolio.st.* / portfolio.an.*.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Báo cáo",
  "eyebrow.analytics": "Báo cáo · USD · giờ máy chủ",

  // Account picker (a card that opens a sheet)
  "account.title": "Tài khoản",
  "account.choose": "Chọn tài khoản",
  "account.allHint": { other: "{count} tài khoản thực" },
  "account.change": "Đổi tài khoản",

  // Statements
  "st.day": "Ngày",
  "st.pickDay": "Chọn ngày",
  "st.pickFrom": "Ngày bắt đầu",
  "st.pickTo": "Ngày kết thúc",
  "st.include": "Bao gồm",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Đang chuẩn bị…",
  "st.ready": "Sao kê đã sẵn sàng",
  "st.saved": "Đã lưu thành {file}",
  "st.shareTitle": "Chia sẻ sao kê",
  "st.failed": "Không thể tải sao kê",
  "st.offline": "Bạn đang ngoại tuyến. Hãy kết nối mạng để tải sao kê.",
  "st.monthly.empty": "Chưa có sao kê tháng nào.",
  "st.monthly.offline": "Bạn đang ngoại tuyến. Hãy kết nối mạng để xem sao kê hằng tháng.",
  "st.monthly.a11y": "{month}: ròng {net}, {trades}. Mở mục tải xuống.",
  "st.month.title": "Sao kê {month}",
  "st.month.formats": "Tải xuống dạng",
  "st.prevMonth": "Tháng trước",
  "st.nextMonth": "Tháng sau",

  // Analytics: hero and stat tiles
  "an.hero.label": "Lãi/lỗ ròng · {period}",
  "an.hero.return": "Lợi suất",
  "an.hero.trades": "Giao dịch",
  "an.hero.lots": "Lot",
  "an.tile.sharpe": "Tỷ lệ Sharpe",
  "an.tile.expectancy": "Kỳ vọng",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Lãi / lỗ TB",
  "an.tile.rr": "Lợi nhuận : rủi ro 1 : {value}",
  "an.tile.holdSplit": "Lệnh lãi {win} · lệnh lỗ {loss}",
  "an.tile.streaks": "Chuỗi",
  "an.tile.streaksSub": "Thắng / thua liên tiếp",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Chưa có giao dịch",

  // Analytics: curves
  "an.curve.hint": "Chạm và giữ biểu đồ để xem từng ngày",
  "an.curve.drawdown": "Sụt giảm",
  "an.curve.a11y": "Vốn {equity}, số dư {balance} ngày {date}. Sụt giảm tối đa {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "Lịch lãi/lỗ",
  "an.cal.subtitle": "Kết quả ròng của giao dịch đã đóng theo ngày máy chủ",
  "an.cal.subtitleEstimated": "Thay đổi số dư hằng ngày, đã loại trừ nạp và rút tiền",
  "an.cal.days": { other: "{count} ngày giao dịch" },
  "an.cal.green": "{count} ngày lãi",
  "an.cal.red": "{count} ngày lỗ",
  "an.cal.noTrades": "Không có giao dịch đã đóng",
  "an.cal.select": "Chạm vào một ngày để xem kết quả",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "Lãi/lỗ ròng theo giờ",
  "an.hour.byDayHour": "Ngày trong tuần × giờ",
  "an.hour.tap": "Chạm vào cột hoặc ô để xem chi tiết",
  "an.tapBar": "Chạm vào cột để xem chi tiết",
  "an.session.best": "Tốt nhất",
  "an.session.asia": "Châu Á",
  "an.session.london": "London",
  "an.session.overlap": "London / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "Cuối phiên New York",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Vốn hiện tại",
  "an.charges.total": "Chi phí đã trả",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { other: "Giao dịch quá mức trong {count} ngày" },
  "insight.overtrading.text": "Trong những ngày này, bạn đã thực hiện hơn {limit} giao dịch (một ngày thông thường của bạn là {median}). Kết quả ròng trong những ngày đó: {net}.",
  "insight.overtrading.tip": "Đặt giới hạn {cap} giao dịch mỗi ngày.",
  "insight.revenge.title": { other: "{count} giao dịch có thể là trả thù" },
  "insight.revenge.text": "Các giao dịch được mở trong vòng 15 phút sau khi đóng một lệnh lỗ, với khối lượng bằng hoặc lớn hơn. Tỷ lệ thắng của chúng là {rate}%, tổng cộng {net}.",
  "insight.revenge.tip": "Hãy nghỉ 15 phút sau một lệnh lỗ trước khi vào lệnh tiếp theo.",
  "insight.risk.title": "Rủi ro mỗi lệnh lỗ",
  "insight.risk.text": { other: "Trung bình mỗi lệnh lỗ làm mất {avg}% số dư, tối đa {max}%. {count} lệnh lỗ vượt quá 2%." },
  "insight.risk.tip": "Chọn khối lượng sao cho mỗi lần chạm cắt lỗ chỉ mất tối đa 1–2% số dư.",
  "insight.holdLosers.title": "Lệnh lỗ được giữ lâu hơn lệnh lãi",
  "insight.holdLosers.text": "Lệnh lỗ được giữ trung bình {loss}, lệnh lãi {win}.",
  "insight.holdLosers.tip": "Đặt cắt lỗ ngay khi mở lệnh và giữ nguyên mức đó.",
  "insight.stopOut.title": { other: "{count} lần đóng do stop out" },
  "insight.stopOut.text": "Các lệnh bị đóng do stop out ký quỹ, không phải do cắt lỗ của chính bạn.",
  "insight.stopOut.tip": "Giữ mức ký quỹ trên ngưỡng margin call bằng các lệnh có khối lượng nhỏ hơn.",
  "insight.slTp.title": "Giao dịch đóng bằng cắt lỗ hoặc chốt lời",
  "insight.slTp.text": "{tp} bằng chốt lời, {sl} bằng cắt lỗ, số còn lại được đóng thủ công hoặc bởi bộ phận giao dịch.",
  "insight.slTp.tip": "Điểm thoát lệnh có kế hoạch giúp kết quả ổn định.",
  "insight.session.title": "Phiên tốt nhất: {session}",
  "insight.session.text": "{trades} giao dịch với tỷ lệ thắng {rate}%. Kém nhất: {worst} ({net}).",
  "insight.session.tip": "Hãy tập trung vào phiên {session}.",
  "insight.tip": "Mẹo",

  // States
  "state.updating": "Đang cập nhật…",
  "state.stale": "Đang hiển thị dữ liệu đã lưu. Kéo xuống để làm mới.",
  "state.notShared.title": "Không được chia sẻ với bạn",
  "state.footer": "Mọi số tiền tính bằng USD (tài khoản cent đã quy đổi). Thời gian theo giờ máy chủ, GMT+2 / GMT+3.",
  "state.footerStatements": "Sao kê tính theo tiền tệ của tài khoản (USC đối với tài khoản cent). Thời gian theo giờ máy chủ, GMT+2 / GMT+3.",
};
export default mobileReports;
