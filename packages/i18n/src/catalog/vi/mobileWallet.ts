import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (phone-only strings; the rest reuses `wallet` and `common`).
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Khả dụng",
  "balance.otherAssets": "Tài sản khác",

  // Copy / share / paste controls
  copyAddress: "Sao chép địa chỉ",
  share: "Chia sẻ",
  paste: "Dán",
  tokenContract: "Hợp đồng token",
  viewOnExplorer: "Xem trên blockchain",
  keep: "Giữ lại",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Tối thiểu {min} USDT · {count} xác nhận",
  "network.networkFee": "Phí mạng {fee} USDT",
  "network.noNetworkFee": "Không có phí mạng",
  "network.paused": "Tạm dừng",

  // Deposit
  "deposit.belowMin": "Số tiền nạp tối thiểu là {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Yêu cầu {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Chỉ gửi USDT {short}",
  "deposit.openWalletApp": "Mở trong ứng dụng ví",
  "deposit.walletAppHint": "Mở MetaMask hoặc ứng dụng ví khác với lệnh chuyển USDT này đã sẵn sàng để phê duyệt.",
  "deposit.noWalletApp": "Không có ứng dụng ví nào trên điện thoại này mở được. Hãy sao chép địa chỉ hoặc quét mã QR.",
  "deposit.hashInvalid": "Mã hash giao dịch gồm 64 ký tự (0–9, a–f), có hoặc không có 0x.",
  "deposit.submitHash": "Gửi giao dịch",
  "deposit.sentHelp": "Dán mã hash giao dịch từ ví hoặc sàn của bạn. Chúng tôi sẽ tìm giao dịch trên mạng và tự động ghi có.",
  "deposit.expiredHelp": "Yêu cầu này đã hết hạn. Nếu bạn đã gửi USDT, hãy gửi mã hash giao dịch bên dưới; nếu chưa, hãy bắt đầu lần nạp mới.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Đã ghi có vào ví của bạn bằng {currency}",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "Gửi từ ví hoặc sàn của bạn",
  "how.sendText": "Sao chép địa chỉ hoặc quét mã QR. Trên BNB Chain, chỉ một chạm là mở MetaMask với lệnh chuyển đã sẵn sàng.",
  "how.hashTitle": "Dán mã hash giao dịch",
  "how.hashText": "Chúng tôi xác minh trên mạng và ghi có sau {bsc} xác nhận trên BNB Chain hoặc {tron} trên TRON.",

  // Withdraw
  "withdraw.available": "Có thể rút",
  "withdraw.belowMin": "Số tiền rút tối thiểu là {min} USDT.",
  "withdraw.aboveMax": "Số tiền tối đa mỗi lần rút là {max} USDT.",
  "withdraw.paused": "Tính năng rút tiền đang tạm dừng. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.",
  "withdraw.cancelAction": "Hủy rút tiền",
  "withdraw.cancelConfirm": "Hủy lệnh rút tiền này? Số tiền sẽ được trả lại vào số dư khả dụng của bạn.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Địa chỉ {network} hợp lệ",
  "address.checksum": "Địa chỉ này có lỗi đánh máy: checksum không khớp. Hãy dán lại từ ví của bạn.",
  "address.otherNetwork": "Địa chỉ này thuộc mạng khác. Hãy nhập địa chỉ {network} ({short}), hoặc đổi mạng ở trên.",
  "address.contract": "Đây là hợp đồng token USDT, không phải ví. Hãy nhập địa chỉ ví của riêng bạn.",

  // Email code confirmation sheet
  "stepup.willEmail": "Chúng tôi sẽ gửi mã 6 chữ số qua email để xác nhận. Không có gì được gửi đi cho đến khi bạn nhập mã.",
  "stepup.sendCode": "Gửi mã qua email",
  "stepup.codeLabel": "Mã 6 chữ số",

  // Transfer
  "transfer.eyebrow": "Ví ↔ tài khoản",
  "transfer.swap": "Đổi chiều",
  "transfer.freeMargin": "Ký quỹ khả dụng",
  "transfer.marginLevel": "Mức ký quỹ",
  // {amount} is in USD
  "transfer.overWithdrawable": "Hiện có thể chuyển ra tối đa {amount} USD từ tài khoản này (lệnh đang mở vẫn giữ ký quỹ).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "Nhận được {amount}",
  "transfer.arrives": "Nhận được",
  "transfer.confirmTitle": "Xác nhận chuyển tiền",
  "transfer.confirm": "Xác nhận chuyển tiền",

  // Transaction detail sheet
  "detail.confirmations": "Xác nhận",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Ghi chú",
  "detail.reason": "Lý do",
  "detail.reference": "Tham chiếu",

  "error.staffReadOnly": "Đây là phiên chỉ xem của nhân viên. Không được phép thay đổi.",
};
export default mobileWallet;
