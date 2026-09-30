import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Giá trực tiếp",
  "empty.favourites.title": "Chưa có mã yêu thích",
  "empty.favourites.body": "Nhấn giữ một mã bất kỳ để ghim vào đây.",
  "empty.favourites.action": "Xem Forex",
  "fav.added": "Đã thêm {symbol} vào yêu thích",
  "fav.removed": "Đã xóa {symbol} khỏi yêu thích",
  "a11y.row": "{symbol}, {name}. Mở biểu đồ; nhấn giữ để thêm hoặc xóa khỏi yêu thích.",
  "a11y.search": "Tìm mã",
  cancel: "Hủy",
  "status.connecting": "Đang kết nối nguồn giá…",
  "status.offline": "Tạm dừng giá: không có kết nối",
};
export default mobileMarkets;
