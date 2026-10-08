import type { NsMessages } from "../../core";

// Ezymex Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Theo dõi thị trường",
  collapse: "Thu gọn",
  "tab.symbols": "Mã",
  "tab.details": "Chi tiết",
  "tab.favourites": "Yêu thích",
  segmentAria: "Nhóm Theo dõi thị trường",
  searchPlaceholder: "Tìm mã",
  searchAria: "Tìm trong Theo dõi thị trường",
  clear: "Xóa",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Mã",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, điểm",
  "col.change": "%TĐ",

  // Row / hover card
  "row.title": "{name} · spread {spread}",
  "tip.low": "T",
  "tip.high": "C",
  "tip.spread": "Sprd",
  "tip.range": "Biên",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "Chưa có mã yêu thích. Nhấp chuột phải vào một mã để thêm.",
  "empty.favouritesTitle": "Chưa có mã yêu thích",
  "empty.noMatch": "Không có mã phù hợp.",
  "footer.count": "{shown} / {total} mã",
  "footer.hint": "nhấp đúp: biểu đồ",

  // Context menu
  "menu.newOrder": "Lệnh mới",
  "menu.chartWindow": "Cửa sổ biểu đồ",
  "menu.openInActive": "Mở trong biểu đồ hiện tại",
  "menu.depth": "Độ sâu thị trường",
  "menu.specification": "Thông số kỹ thuật",
  "menu.removeFavourite": "Xóa khỏi Yêu thích",
  "menu.addFavourite": "Thêm vào Yêu thích",
  "menu.hide": "Ẩn",
  "menu.showAll": "Hiện tất cả",

  // Toasts
  "toast.hidden": "Đã ẩn {symbol} khỏi Theo dõi thị trường",
  "toast.hiddenDesc": "Hiện lại tất cả mã từ menu chuột phải.",
  "toast.opened": "Đã mở {symbol} trong biểu đồ hiện tại",

  // Segment chips (asset classes)
  "segment.favourites": "Yêu thích",
  "segment.forex": "Forex",
  "segment.metals": "Kim loại",
  "segment.indices": "Chỉ số",
  "segment.energies": "Năng lượng",
  "segment.crypto": "Tiền mã hóa",
  "segment.stocks": "Cổ phiếu",
  "segment.aria": "Loại tài sản",
  "segment.title": { other: "{label} · {count} mã" },

  // Navigator tree
  "nav.title": "Bộ điều hướng",
  "nav.indicators": "Chỉ báo",
  "nav.strategies": "Chiến lược",
  "nav.scripts": "Script",
  "nav.guest": "khách",
  "nav.noAccount": "Chưa có tài khoản giao dịch",
  "nav.openAccount": "Mở tài khoản",
  "nav.openAccountTitle": "Tạo tài khoản Ezymex (mở khu vực khách hàng)",
  "nav.signIn": "Đăng nhập",
  "nav.signInTitle": "Đăng nhập khu vực khách hàng",
  "nav.accountType.live": "thực",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Xu hướng",
  "nav.category.oscillators": "Dao động",
  "nav.category.volatility": "Biến động",
  "nav.category.volume": "Khối lượng",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Nhấp đúp hoặc Enter để gắn vào {symbol}, {tf}",
  "nav.strategyTitle": { other: "{server} · {login} · {count} giao dịch" },
  "nav.strategyRunning": "{name} đang chạy",
  "nav.strategyAttached": "Đã gắn {name}",
  "nav.strategyDesc": "{login} · {server} · Lãi/lỗ hôm nay {pnl}",
  "nav.script.closeAll": "Đóng tất cả lệnh",
  "nav.script.closeProfitable": "Đóng lệnh có lãi",
  "nav.script.closeLosing": "Đóng lệnh thua lỗ",
  "nav.script.deletePendings": "Xóa tất cả lệnh chờ",
  "nav.script.breakevenAll": "Hòa vốn tất cả (SL → giá vào)",
  "nav.scriptTitle": "Nhấp đúp để chạy trên tài khoản hiện tại",
  "nav.scriptsReadOnly": "Script bị tắt ở chế độ chỉ xem",
};
export default market;
