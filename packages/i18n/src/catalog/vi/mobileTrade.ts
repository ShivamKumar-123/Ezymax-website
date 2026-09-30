import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MetaTrader 5 wording used in the `order` namespace.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Chọn mã",
  searchSymbol: "Tìm mã",
  depth: "Độ sâu thị trường",
  alert: "Cảnh báo giá",
  news: "Tin tức về {symbol}", // a header button's accessibility label
  calendar: "Lịch kinh tế {currency}", // a header button's accessibility label, e.g. "EUR economic calendar"
  "account.chip": "{type} · #{login}",
  "account.manage": "Quản lý tài khoản",
  "account.open": "Mở tài khoản",

  // Chart
  "chart.indicators": "Chỉ báo",
  "chart.type.candles": "Nến",
  "chart.type.line": "Đường",
  "ind.ma": "Trung bình động 20",
  "ind.ema": "Trung bình động hàm mũ 50",
  "ind.bb": "Dải Bollinger 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Chưa có lịch sử biểu đồ cho mã này",
  "chart.hint": "Chụm để thu phóng · kéo để cuộn · nhấn giữ để hiện thước chữ thập · chạm hai lần để đặt lại",

  // Sell / Buy bar and ticket
  "bar.volume": "Lot",
  "ticket.title": "Lệnh mới",
  "ticket.confirmBuy": "Mua {volume} {symbol}",
  "ticket.confirmSell": "Bán {volume} {symbol}",
  "ticket.atMarket": "theo giá thị trường",
  "ticket.at": "tại {price}",
  "ticket.addSl": "Thêm cắt lỗ",
  "ticket.addTp": "Thêm chốt lời",
  "ticket.ifHit": "{money} nếu chạm",
  "ticket.required": "Ký quỹ",
  "ticket.pip": "Giá trị pip",
  "ticket.after": "Khả dụng sau",
  "ticket.notEnough": "Không đủ ký quỹ khả dụng cho khối lượng này.",
  "ticket.noSpecs": "Đang tải thông số hợp đồng…",
  "ticket.distance": "Cách {n} pip",
  "ticket.price": "Giá",

  // Rejections: a plain-language line under the reason (order.reject.<code>)
  "reject.no_money": "Ký quỹ khả dụng không đủ cho lệnh này. Hãy giảm khối lượng hoặc nạp thêm tiền vào tài khoản này.",
  "reject.insufficient_funds": "Ký quỹ khả dụng không đủ cho lệnh này. Hãy giảm khối lượng hoặc nạp thêm tiền vào tài khoản này.",
  "reject.market_closed": "Thị trường này hiện đang đóng cửa. Hãy thử lại khi thị trường mở cửa.",
  "reject.invalid_volume": "Hãy dùng khối lượng trong giới hạn và bước lot của mã này.",
  "reject.max_lot": "Khối lượng này vượt mức tối đa mỗi lệnh của tài khoản bạn.",
  "reject.close_only": "Tài khoản của bạn hiện chỉ có thể đóng lệnh, không thể mở lệnh mới.",
  "reject.symbol_close_only": "Mã này hiện chỉ có thể đóng lệnh, không thể mở lệnh mới.",
  "reject.trading_disabled": "Giao dịch đã bị tắt trên tài khoản này. Hãy liên hệ bộ phận hỗ trợ để biết chi tiết.",
  "reject.symbol_halted": "Giao dịch trên mã này đang tạm dừng. Vui lòng thử lại sau.",
  "reject.requote.title": "Giá đã thay đổi",
  "reject.requote": "Thị trường đã biến động trong lúc lệnh của bạn đang được gửi. Hãy kiểm tra giá mới và xác nhận lại.",
  "reject.invalid_sl": "Mức cắt lỗ nằm sai phía so với giá, hoặc quá gần giá.",
  "reject.invalid_tp": "Mức chốt lời nằm sai phía so với giá, hoặc quá gần giá.",
  "reject.invalid_price": "Giá này nằm sai phía thị trường đối với loại lệnh này.",
  "reject.off_market": "Giá này quá xa giá thị trường. Hãy kiểm tra lại giá trị.",
  "reject.stale_price": "Giá của mã này đang tạm dừng trong giây lát. Vui lòng thử lại sau giây lát.",
  "reject.no_price": "Hiện không có giá trực tiếp cho mã này.",
  "reject.read_only": "Đăng nhập này có thể xem tài khoản nhưng không thể giao dịch.",
  "reject.uncertain.title": "Máy chủ giao dịch không phản hồi",
  "reject.uncertain": "Lệnh có thể đã được thực hiện. Hãy kiểm tra Danh mục trước khi thử lại.",
  "reject.uncertain.ticket": "Xác nhận lại là an toàn: cùng một lệnh không thể được đặt hai lần.",

  // States
  "state.noAccount.title": "Chưa có tài khoản giao dịch",
  "state.noAccount.body": "Mở tài khoản demo để luyện tập, hoặc tài khoản thực để giao dịch bằng tiền thật.",
  "state.noAccount.action": "Mở tài khoản",
  "state.connecting": "Đang kết nối máy chủ giao dịch…",
  "state.readOnly": "Tài khoản này chỉ xem tại đây: giá và biểu đồ vẫn trực tiếp, giao dịch bị tắt.",
  "state.marketClosed.title": "Thị trường đóng cửa",
  "state.marketClosed.body": "{symbol} sẽ mở lại vào phiên tiếp theo. Có thể đặt lệnh khi thị trường mở cửa.",
  "state.streamError": "Không thể kết nối máy chủ giao dịch",
  "state.streamErrorBody": "Lệnh đang mở và lệnh chờ của bạn vẫn an toàn trên máy chủ. Chúng tôi đang tiếp tục kết nối lại.",

  // Results
  "toast.filled": "Lệnh {side} {volume} {symbol} đã khớp",
  "toast.at": "tại {price}",
  "toast.placed": "Đã đặt lệnh chờ {symbol}",
  "toast.duplicate": "Lệnh đã được đặt trước đó: #{ticket}",
  "toast.duplicateBody": "Lệnh này đã đến máy chủ trước đó; không có lệnh mới nào được mở.",
  "toast.closed": "Đã đóng lệnh #{ticket}",
  "toast.partial": "Đã đóng {volume} lot của #{ticket}",
  "toast.modified": "Đã cập nhật #{ticket}",
  "toast.cancelled": "Đã hủy lệnh #{ticket}",

  // Engine notifications while the app is open
  "notify.sl": "Chạm cắt lỗ",
  "notify.tp": "Chạm chốt lời",
  "notify.order_filled": "Lệnh chờ đã khớp",
  "notify.order_triggered": "Lệnh đã kích hoạt",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Lệnh bị từ chối",
  "notify.order_expired": "Lệnh đã hết hạn",
  "notify.order_cancelled": "Lệnh đã bị hủy",
};
export default mobileTrade;
