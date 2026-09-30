import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles shown in tall display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "Nhận vốn", // display
  "home.subtitle": "Vượt qua thử thách, nhận tài khoản được cấp vốn và giữ đến {split}% lợi nhuận. Mọi tài khoản prop đều là tài khoản mô phỏng.",
  "home.subtitleNoSplit": "Vượt qua thử thách, nhận tài khoản được cấp vốn và giữ một phần lợi nhuận. Mọi tài khoản prop đều là tài khoản mô phỏng.",
  "home.payouts": "Chi trả",
  "home.payoutsReady": "Sẵn sàng {amount}",
  "home.payoutsNone": "Chưa có khoản sẵn sàng",
  "home.certificates": "Chứng chỉ",
  "home.certCount": { other: "Đã nhận {count}" },
  "home.mine": "Thử thách của bạn",
  "home.past": "Thử thách trước đây",
  "home.showAll": "Hiện tất cả {count}",
  "home.yourCertificates": "Chứng chỉ của bạn",
  "home.plans": "Chọn thử thách của bạn",
  "home.newChallenge": "Bắt đầu thử thách mới",
  "home.emptyTitle": "Chưa có thử thách nào", // display
  "home.emptyBody": "Các gói thử thách mới đang được chuẩn bị. Vui lòng quay lại sau.",
  "home.mineError": "Không thể tải thử thách của bạn.",
  "home.plansError": "Không thể tải các gói thử thách.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "Cách hoạt động",
  "how.1.title": "Chọn gói",
  "how.1.body": "Chọn mô hình và quy mô tài khoản. Phí được trừ một lần từ ví USDT của bạn.",
  "how.2.title": "Đạt mục tiêu",
  "how.2.body": "Đạt mục tiêu lợi nhuận trong giới hạn lỗ trong ngày và sụt giảm, qua số ngày giao dịch tối thiểu.",
  "how.3.title": "Nhận vốn",
  "how.3.body": "Khi vượt qua, tài khoản được cấp vốn sẽ tự động mở kèm chứng chỉ để chia sẻ.",
  "how.4.title": "Nhận chi trả",
  "how.4.body": "Yêu cầu phần lợi nhuận của bạn về ví USDT sau mỗi chu kỳ chi trả.",
  "how.enforce": "Giới hạn được kiểm tra trên máy chủ mỗi giây, theo vốn. Bạn được cảnh báo khi đạt 50%, 75% và 90% giới hạn lỗ trong ngày; vi phạm sẽ đóng tất cả lệnh và kết thúc thử thách.",

  // Plan models
  "type.oneStep": "1 bước",
  "type.twoStep": "2 bước",
  "type.instant": "Tức thì",
  "typeText.oneStep": "Một giai đoạn đánh giá. Đạt mục tiêu, tuân thủ giới hạn và được cấp vốn.",
  "typeText.twoStep": "Hai giai đoạn đánh giá với mục tiêu thấp hơn và giới hạn rộng hơn.",
  "typeText.instant": "Không cần đánh giá. Bắt đầu ngay với tài khoản được cấp vốn và giới hạn chặt hơn.",

  // Plan card
  "plan.refundable": "Được hoàn phí",
  "plan.fee": "Phí",
  "plan.account": "Tài khoản",
  "plan.leverage": "Đòn bẩy 1:{n}",
  "plan.target": "Mục tiêu",
  "plan.dailyLoss": "Lỗ trong ngày",
  "plan.maxDD": "Sụt giảm tối đa",
  "plan.static": "cố định",
  "plan.trailing": "trượt",
  "plan.start": "Bắt đầu · {fee}",

  // Checkout
  "checkout.eyebrow": "Thanh toán",
  "checkout.fee": "Phí một lần",
  "checkout.chargedRefund": "Thanh toán từ ví USDT của bạn. Được hoàn lại cùng lần chi trả đầu tiên.",
  "checkout.chargedNoRefund": "Thanh toán từ ví USDT của bạn. Không hoàn lại.",
  "checkout.walletBalance": "Số dư ví: {balance} USDT",
  "checkout.shortTitle": "Ví của bạn không đủ để trả phí",
  "checkout.short": "Bạn có {balance} USDT. Hãy nạp thêm {missing} USDT để thanh toán thử thách này.",
  "checkout.rules": "Quy tắc",
  "checkout.limitsNote": "Các giới hạn tính theo phần trăm số dư ban đầu. Vi phạm giới hạn lỗ trong ngày hoặc sụt giảm tối đa sẽ khiến tài khoản thất bại và đóng tất cả lệnh theo giá thị trường. Ngày giao dịch được đặt lại lúc 17:00 New York.",
  "checkout.agree": "Tôi đã đọc các quy tắc và hiểu rằng tài khoản là mô phỏng và sẽ tự động thất bại khi vi phạm giới hạn lỗ.",
  "checkout.pay": "Thanh toán {fee}",
  "checkout.retry": "Thử lại · {fee}",
  "checkout.paying": "Đang thanh toán…",
  "checkout.goToMine": "Xem thử thách của tôi",
  "checkout.readyTitle": "Bạn đã tham gia", // display
  "checkout.readyBody": "Đã thanh toán {fee} từ ví USDT và tài khoản {size} {phase} của bạn đã được mở. Các quy tắc có hiệu lực từ bây giờ.",
  "checkout.savePasswords": "Hãy lưu các mật khẩu này ngay: chúng chỉ hiển thị một lần và chúng tôi không lưu trữ. Bạn luôn có thể giao dịch tài khoản này từ ứng dụng mà không cần chúng.",
  "checkout.passwordsShown": "Mật khẩu giao dịch đã được hiển thị khi giao dịch mua này được xác nhận lần đầu. Bạn có thể giao dịch tài khoản này từ ứng dụng mà không cần chúng.",
  "checkout.viewChallenge": "Xem thử thách",
  "checkout.readOnly": "Phiên này không thể mua thử thách.",

  // Account credentials
  "cred.login": "Số đăng nhập",
  "cred.server": "Máy chủ",
  "cred.password": "Mật khẩu giao dịch",
  "cred.investorPassword": "Mật khẩu nhà đầu tư (chỉ xem)",
  "cred.show": "Hiện mật khẩu",
  "cred.hide": "Ẩn mật khẩu",
  "copied": "Đã sao chép {what}",
  "a11y.copy": "Sao chép {what}",

  // Challenge statuses
  "status.pendingPayment": "Chờ thanh toán",
  "status.provisioning": "Đang mở tài khoản",
  "status.active": "Đang hoạt động",
  "status.funded": "Đã cấp vốn",
  "status.failed": "Thất bại",
  "status.closed": "Đã đóng",
  "status.paymentFailed": "Thanh toán thất bại",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · Đang hoạt động",
  "stage.failed": "{phase} · Thất bại",
  "phaseStatus.provisioning": "Đang mở",
  "phaseStatus.active": "Đang chạy",
  "phaseStatus.passed": "Đã vượt qua",
  "phaseStatus.failed": "Thất bại",
  "phaseStatus.closed": "Đã đóng",

  // Challenge cards (Prop home)
  "card.target": "Mục tiêu lợi nhuận",
  "card.profit": "Lợi nhuận",
  "card.equity": "Vốn {amount}",
  "card.dailyLeft": "Lỗ trong ngày còn {amount}",
  "card.opening": "Tài khoản giao dịch của bạn đang được mở. Quá trình này mất vài giây.",

  // Dashboard
  "dash.equity": "Vốn",
  "dash.balance": "Số dư",
  "dash.floating": "Thả nổi",
  "dash.open": "Đang mở",
  "dash.sinceStart": "từ khi bắt đầu giai đoạn",
  "dash.rules": "Quy tắc",
  "dash.rulesTitle": "Quy tắc của thử thách này",
  "dash.notFound": "Không tìm thấy thử thách", // display
  "dash.notFoundBody": "Thử thách có thể đã được mở bằng một đăng nhập khác.",
  "dash.backToProp": "Quay lại Prop",
  "live.live": "Trực tiếp",
  "live.connecting": "Đang kết nối…",
  "live.offline": "Ngoại tuyến",
  // {time}: date and time of the last rule check
  "live.updated": "Kiểm tra lúc {time}",
  // {time}: when the phase ended
  "live.final": "Kết quả cuối · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Lỗ trong ngày",
  "rule.maxDrawdown": "Sụt giảm tối đa",
  "rule.profitTarget": "Mục tiêu lợi nhuận",
  "rule.tradingDays": "Ngày giao dịch",
  "rule.timeLimit": "Giới hạn thời gian",
  "rule.weekendHolding": "Giữ lệnh cuối tuần",
  "rule.newsWindow": "Khung giờ tin tức",
  "rule.bannedStrategy": "Chiến lược bị cấm",
  "rule.consistency": "Nhất quán",
  "rule.riskDesk": "Quyết định của bộ phận rủi ro",
  "ruleState.ok": "Đang tiến hành",
  "ruleState.passed": "Đạt",
  "ruleState.failed": "Vi phạm",
  "ruleState.off": "Tắt",

  // Gauges
  "target.ofTarget": "mục tiêu",
  "target.of": "Mục tiêu {amount} ({pct}%)",
  "target.left": "Còn {amount}",
  "target.reachedBy": "Đã đạt, vượt {amount}",
  "limit.left": "Còn {amount}",
  "limit.breachAt": "Vi phạm tại {amount}",
  "days": { other: "{count} ngày" },
  "days.of": "{v}/{min}",
  "days.count": { other: "{count} ngày" },
  "days.met": "Đã đạt tối thiểu",
  "days.toGo": { other: "Còn {count} ngày" },
  "days.noMinimum": "Không có tối thiểu",
  "time.left": "Còn {d} ngày {h} giờ",
  "time.deadline": "Kết thúc {date}",
  "consistency.rule": "Ngày tốt nhất ≤ {pct}% lợi nhuận",
  "consistency.noProfit": "Chưa có lợi nhuận",
  "reset.title": "Lỗ trong ngày đặt lại sau",
  "reset.note": "17:00 New York, mỗi ngày giao dịch",

  // Funded account: payout window ring
  "payoutHero.title": "Chi trả tiếp theo",
  "payoutHero.share": "Phần của bạn đến nay",
  "payoutHero.open": "Đang mở", // display
  "payoutHero.ready": "Sẵn sàng", // display
  "payoutHero.days": { other: "{count} ngày" }, // display
  "payoutHero.eligible": "Đủ điều kiện ngay với tỷ lệ chia {split}% của bạn.",
  "payoutHero.opens": "Khung chi trả mở vào {date}.",
  "payoutHero.later": "Yêu cầu chi trả khi bạn có lợi nhuận đủ điều kiện.",

  // Big states
  "hero.opening.title": "Đang mở tài khoản", // display
  "hero.opening.body": "Thanh toán đã được xác nhận và tài khoản giao dịch đang được thiết lập. Trang này tự cập nhật.",
  "hero.closed.title": "Thử thách đã đóng", // display
  "hero.closed.body": "Không thể mở tài khoản giao dịch cho thử thách này, nên thử thách đã được đóng và phí đã được hoàn về ví USDT của bạn. Liên hệ bộ phận hỗ trợ nếu bạn có câu hỏi.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. Phí đã được hoàn về ví USDT của bạn.",
  "hero.failed.title": "{phase} thất bại", // display
  "hero.failed.on": "Kết thúc {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Tất cả lệnh đã được đóng và tài khoản bị vô hiệu hóa.",
  "hero.failed.ruleBreached": "Đã vi phạm một quy tắc",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}: đã vi phạm giới hạn",
  "hero.failed.new": "Bắt đầu thử thách mới",
  "hero.passed.title": "Đã vượt qua {phase}", // display
  "hero.passed.on": "Vượt qua ngày {date}.",
  "hero.passed.next": "Tài khoản {phase} của bạn đã được mở.",
  "hero.passed.nextLogin": "Tài khoản {phase} của bạn đã được mở (#{login}).",
  "hero.passed.opening": "Tài khoản tiếp theo đang được mở.",
  "hero.passed.certificate": "Xem chứng chỉ",
  "hero.passed.goNext": "Đến {phase}",
  "hero.funded.title": "Đã cấp vốn", // display
  "hero.funded.body": "Giao dịch trên tài khoản được cấp vốn và nhận {split}% lợi nhuận qua các lần chi trả.",
  "hero.funded.certificate": "Xem chứng chỉ cấp vốn của bạn",

  // Warnings while trading
  "warn.lossUsed": "Đã dùng {pct}% giới hạn lỗ hôm nay",
  "warn.lossUsedBody": "Vốn bằng hoặc thấp hơn {floor} sẽ khiến tài khoản thất bại và đóng tất cả lệnh. Còn lại hôm nay: {left}.",
  "warn.weekend": "Đóng lệnh cuối tuần",
  "warn.weekendBody": "Gói này không cho phép giữ lệnh qua cuối tuần: lệnh đang mở được đóng lúc 16:45 thứ Sáu giờ New York.",

  // Actions
  "action.openTrade": "Mở trong Giao dịch",
  "action.trade": "Giao dịch",
  "action.tradeBlocked": "Chỉ có thể giao dịch trên tài khoản đang chạy của thử thách đang hoạt động.",
  "action.payouts": "Chi trả",
  "action.support": "Liên hệ hỗ trợ",

  // Equity chart
  "chart.title": "Đường vốn",
  "chart.start": "Ban đầu",
  "chart.target": "Mục tiêu",
  "chart.ddFloor": "Sụt giảm tối đa",
  "chart.dailyFloor": "Lỗ trong ngày",
  "chart.now": "Hiện tại",
  "chart.empty": "Đường vốn sẽ xuất hiện sau vài phút giao dịch đầu tiên.",

  // Trading stats
  "stats.title": "Thống kê giao dịch",
  "stats.trades": "Giao dịch",
  "stats.winRate": "Tỷ lệ thắng",
  "stats.profitFactor": "Hệ số lợi nhuận",
  "stats.avgWin": "Lãi TB",
  "stats.avgLoss": "Lỗ TB",
  "stats.lots": "Lot",
  "stats.bestDay": "Ngày tốt nhất {date}: {amount}",

  // Rule log
  "events.title": "Nhật ký quy tắc",
  "events.empty": "Không có cảnh báo hay vi phạm. Hãy tiếp tục duy trì.",
  "events.equity": "vốn {amount}",
  "events.limit": "giới hạn {amount}",
  "severity.breach": "Vi phạm",
  "severity.violation": "Sai phạm",
  "severity.warning": "Cảnh báo",
  "severity.info": "Thông tin",

  // Closed trades
  "trades.title": "Giao dịch đã đóng",
  "trades.all": "Tất cả {count}",
  "trades.count": { other: "{count} giao dịch đã đóng" },
  "trades.empty": "Chưa có giao dịch đã đóng.",
  "trades.buy": "Mua",
  "trades.sell": "Bán",
  // compact durations
  "duration.s": "{s} giây",
  "duration.ms": "{m} phút {s} giây",
  "duration.hm": "{h} giờ {m} phút",
  "duration.dh": "{d} ngày {h} giờ",

  // Account details
  "account.title": "Tài khoản",
  "account.split": "Phần chia của bạn",
  "account.initial": "Số dư ban đầu",
  "account.started": "Bắt đầu giai đoạn",
  "account.ended": "Kết thúc",
  "account.deadline": "Hạn chót",
  "account.passwordNote": "Mật khẩu giao dịch chỉ hiển thị một lần khi mua. Nút Mở trong Giao dịch sẽ đăng nhập bạn vào tài khoản này mà không cần mật khẩu.",

  // Payouts
  "payouts.title": "Chi trả", // display
  "payouts.available": "Khả dụng ngay",
  "payouts.eligibleCount": { other: "{eligible}/{count} tài khoản được cấp vốn đủ điều kiện" },
  "payouts.requests": { other: "{count} yêu cầu" },
  "payouts.count": { other: "{count} lần chi trả" },
  "payouts.paidToDate": "Đã chi trả đến nay",
  "payouts.funded": "Tài khoản được cấp vốn",
  "payouts.account": "{size} được cấp vốn", // display
  "payouts.quote": "Báo giá chi trả",
  "payouts.eligibleNow": "Đủ điều kiện ngay",
  "payouts.notYet": "Chưa đủ điều kiện",
  "payouts.toWallet": "vào ví của bạn",
  "payouts.yourSplit": "Phần chia của bạn",
  "payouts.firmShare": "Phần của công ty",
  "payouts.alreadyRefunded": "Đã hoàn lại",
  "payouts.withFirst": "Cùng lần chi trả đầu tiên",
  "payouts.opens": "Mở ngày {date}.",
  "payouts.minimum": "Tối thiểu {amount}.",
  "payouts.kycNote": "Hãy xác minh danh tính để yêu cầu khoản chi trả này.",
  "payouts.kycPendingNote": "Bạn có thể yêu cầu khoản chi trả này sau khi xác minh danh tính được duyệt.",
  "payouts.readOnly": "Phiên này không thể yêu cầu chi trả.",
  "payouts.request": "Yêu cầu chi trả",
  // opens the account's live rule dashboard; short: it shares a row with Trade
  "payouts.dashboard": "Quy tắc",
  "payouts.history": "Lịch sử",
  "payouts.historyEmpty": "Chưa có khoản chi trả nào.",
  "payouts.emptyTitle": "Chưa có tài khoản được cấp vốn", // display
  "payouts.emptyBody": "Vượt qua thử thách để nhận tài khoản được cấp vốn. Yêu cầu chi trả tại đây khi tài khoản có lợi nhuận đủ điều kiện.",
  "payouts.emptyAction": "Nhận vốn",
  "payoutStatus.pending": "Đang xét duyệt",
  "payoutStatus.approved": "Đã duyệt",
  "payoutStatus.paid": "Đã chi trả",
  "payoutStatus.rejected": "Bị từ chối",
  "payoutStatus.failed": "Thất bại",
  "split.title": "Chia lợi nhuận và tăng vốn",
  "split.upTo": "Đến {pct}% khi tăng vốn",
  "split.cycle": "Chi trả",
  // {days} e.g. "14 days"
  "split.first": "Lần đầu sau {days}",
  "split.firstNow": "Ngay từ ngày đầu",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "Đạt {profit}% lợi nhuận trong {months} và tài khoản tăng thêm {increase}%, tối đa {cap}.",
  "scaling.none": "Gói này không tăng vốn tài khoản.",
  "months": { other: "{count} tháng" },

  // Payout request sheet
  "request.eyebrow": "Yêu cầu chi trả",
  "request.profit": "Lợi nhuận trên tài khoản",
  "request.share": "Phần của bạn ({pct}%)",
  "request.feeRefund": "Hoàn phí thử thách",
  "request.total": "Tổng chuyển vào ví",
  "request.note": "Toàn bộ lợi nhuận hiện tại sẽ được trừ khỏi tài khoản giao dịch ngay bây giờ, để không bị mất do giao dịch trong lúc xét duyệt. Sau khi được duyệt, phần của bạn được ghi có vào ví USDT; nếu yêu cầu bị từ chối, lợi nhuận sẽ được hoàn lại vào tài khoản.",
  "request.submit": "Yêu cầu {amount}",
  "request.done": "Đã yêu cầu chi trả",
  "request.doneBody": "{amount} sẽ được chuyển vào ví USDT của bạn sau khi được duyệt.",

  // Identity verification (payouts)
  "kyc.verified": "Đã xác minh danh tính: khoản chi trả có thể được duyệt.",
  "kyc.pendingTitle": "Xác minh đang được xét duyệt",
  "kyc.pendingText": "Xác minh của bạn đang được xét duyệt. Bạn có thể yêu cầu chi trả sau khi danh tính được xác minh.",
  "kyc.requiredTitle": "Xác minh danh tính",
  "kyc.requiredText": "Chỉ nhà giao dịch đã xác minh mới được chi trả. Hãy xác minh trước lần chi trả đầu tiên.",
  "kyc.rejectedText": "Xác minh của bạn bị từ chối. Hãy gửi lại để nhận chi trả.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "Khung chi trả chưa mở.",
  "blocker.belowMinimum": "Lợi nhuận thấp hơn mức chi trả tối thiểu.",
  "blocker.positionsOpen": "Hãy đóng tất cả lệnh đang mở để yêu cầu chi trả.",
  "blocker.payoutPending": "Đã có một yêu cầu chi trả đang được xét duyệt.",
  "blocker.consistency": "Chưa đáp ứng quy tắc nhất quán: ngày tốt nhất của bạn chiếm tỷ trọng quá lớn trong lợi nhuận.",

  // Certificates
  "certs.title": "Chứng chỉ", // display
  "certs.subtitle": "Mỗi giai đoạn bạn vượt qua, mỗi tài khoản được cấp vốn và mỗi lần chi trả đều mang lại một chứng chỉ mà ai cũng có thể xác minh.",
  "certs.kind.pass": "Đã vượt qua giai đoạn",
  "certs.kind.funded": "Nhà giao dịch được cấp vốn",
  "certs.kind.payout": "Chi trả",
  "certs.revoked": "Đã thu hồi",
  "certs.revokedBody": "Chứng chỉ này đã bị Kalks thu hồi và không còn hiệu lực, nên không thể chia sẻ.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "Số {code}",
  "certs.shareImage": "Chia sẻ hình ảnh",
  "certs.shareLink": "Chia sẻ liên kết",
  "certs.copyLink": "Sao chép liên kết",
  "certs.linkCopied": "Đã sao chép liên kết xác minh",
  "certs.shareTitle": "Chứng chỉ Kalks Prop của tôi",
  "certs.shareMessage": "Chứng chỉ Kalks Prop của tôi. Xác minh tại đây:",
  "certs.shareFailed": "Không thể chia sẻ chứng chỉ. Vui lòng thử lại.",
  "certs.shareUnavailable": "Thiết bị này không hỗ trợ chia sẻ.",
  "certs.emptyTitle": "Chưa có chứng chỉ", // display
  "certs.emptyBody": "Vượt qua một giai đoạn thử thách để nhận chứng chỉ đầu tiên, kèm liên kết công khai mà ai cũng có thể xác minh.",
  "certs.emptyAction": "Xem các thử thách",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "Quy mô tài khoản",
  "profitSplit": "Chia lợi nhuận",
  "feeRefund": "Hoàn phí",
  "nonRefundable": "Không hoàn lại",
  "leverage": "Đòn bẩy",
  "none": "Không có",
  "allowed": "Được phép",
  "notAllowed": "Không được phép",
  "noTimeLimit": "Không giới hạn thời gian",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "Mục tiêu {phase}",
  "rules.phaseMinDays": "Số ngày tối thiểu {phase}",
  "rules.phaseTimeLimit": "Giới hạn thời gian {phase}",
  "rules.evaluation": "Đánh giá",
  "rules.evaluationNone": "Không có, được cấp vốn ngay từ ngày đầu",
  "rules.dailyLoss": "Giới hạn lỗ trong ngày",
  "rules.dailyLossBalance": "{pct}% · {amount} · tính từ số dư lúc 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · tính từ giá trị cao hơn giữa số dư và vốn lúc 17:00 New York",
  "rules.ddStatic": "{pct}% cố định",
  "rules.ddTrailing": "{pct}% trượt",
  "rules.ddLocks": "{dd}, khóa tại mức ban đầu",
  // ≤ = at most
  "rules.consistencyValue": "Ngày tốt nhất ≤ {pct}% tổng lợi nhuận",
  "rules.news": "Giao dịch tin tức",
  "rules.newsBlocked": "Không trong khoảng ±{min} phút quanh tin tức ảnh hưởng cao",
  "rules.newsBlockedFails": "Không trong khoảng ±{min} phút quanh tin tức ảnh hưởng cao (vi phạm sẽ khiến tài khoản thất bại)",
  "rules.weekendClosed": "Lệnh được đóng lúc 16:45 thứ Sáu giờ New York",
  "rules.ea": "Expert Advisor",
  "rules.banned": "Chiến lược bị cấm",
  "rules.splitScaling": "{split}%, tăng dần đến {max}%",
  "rules.firstPayout": "Chi trả đầu tiên",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "Sau {days}, sau đó {freq} · tối thiểu {min}",
  "rules.refunded": "Hoàn lại cùng lần chi trả đầu tiên",

  // Banned trading strategies
  "banned.hft": "Giao dịch tần suất cao",
  "banned.latencyArbitrage": "Chênh lệch giá do độ trễ",
  "banned.tickScalping": "Scalping theo tick",
  "banned.crossAccountCopying": "Sao chép giữa các tài khoản",
  "banned.crossAccountHedging": "Phòng hộ giữa các tài khoản",
  "banned.martingale": "Martingale",
  "banned.grid": "Giao dịch lưới",

  // Payout cycle, lower case: used inside sentences ("then weekly")
  "payoutFreq.weekly": "hằng tuần",
  "payoutFreq.biWeekly": "2 tuần một lần",
  "payoutFreq.monthly": "hằng tháng",
  "payoutFreq.onDemand": "theo yêu cầu",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Nạp tiền",
  "errorLink.verify": "Xác minh danh tính",
  "error.insufficientFunds": "Số dư ví USDT của bạn không đủ để trả phí này. Hãy nạp USDT và thử lại.",
  "error.kycRequired": "Hãy xác minh danh tính trước khi yêu cầu chi trả.",
  "error.paymentPending": "Chúng tôi chưa thể xác nhận thanh toán từ ví. Vui lòng thử lại sau một phút: bạn sẽ không bị trừ tiền hai lần.",
  "error.paymentFailed": "Thanh toán từ ví không thành công. Bạn chưa bị trừ tiền.",
  "error.walletPending": "Ví chưa xác nhận. Vui lòng thử lại sau một phút.",
  "error.walletRejected": "Ví đã từ chối khoản thanh toán này. Vui lòng liên hệ bộ phận hỗ trợ.",
  "error.provisioning": "Đã nhận thanh toán. Tài khoản giao dịch của bạn vẫn đang được mở: tài khoản sẽ xuất hiện trong mục thử thách của bạn trong vòng một phút.",
  "error.planUnavailable": "Gói hoặc quy mô này không còn khả dụng. Vui lòng chọn lựa chọn khác.",
  "error.notYetEligible": "Tài khoản này chưa đủ điều kiện chi trả.",
  "error.belowMinimum": "Lợi nhuận thấp hơn mức chi trả tối thiểu.",
  "error.positionsOpen": "Hãy đóng tất cả lệnh đang mở trước khi yêu cầu chi trả.",
  "error.payoutPending": "Đã có một yêu cầu chi trả cho tài khoản này đang được xét duyệt.",
  "error.consistency": "Chưa đáp ứng quy tắc nhất quán: ngày tốt nhất của bạn chiếm tỷ trọng quá lớn trong lợi nhuận.",
  "error.notFunded": "Chi trả chỉ khả dụng cho tài khoản được cấp vốn.",
  "error.accountUnavailable": "Chúng tôi không thể mở tài khoản giao dịch cho thử thách này nên phí đã được hoàn về ví USDT của bạn. Liên hệ bộ phận hỗ trợ nếu tình trạng này tiếp diễn.",
  "error.idempotencyConflict": "Phiên thanh toán này đã được dùng cho một giao dịch mua khác. Hãy đóng lại và bắt đầu lại.",
  "error.notActive": "Thử thách này không hoạt động.",
  "error.accountLimit": "Bạn đã đạt số lượng tài khoản prop tối đa. Liên hệ bộ phận hỗ trợ để nâng giới hạn.",
  "error.staffReadOnly": "Đây là phiên chỉ xem của nhân viên. Không được phép thay đổi.",
  "error.engine": "Máy chủ giao dịch không phản hồi. Vui lòng thử lại sau ít phút.",
  "error.generic": "Đã xảy ra lỗi. Vui lòng thử lại.",
  "load.title": "Prop không khả dụng", // display
  "load.body": "Chúng tôi không thể kết nối dịch vụ prop. Tài khoản của bạn vẫn an toàn; vui lòng thử lại sau giây lát.",
};
export default mobileProp;
