import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks.
// Keep as they are: Kalks, Algo, API, USDT, USD, indicator names, symbols, timeframes, "R", DD, SL / TP.
// Titles marked (display) are shown in tall display type: keep them short.
// "Deployment" = one strategy version running on one trading account ("triển khai").
// "Kill switch" = an emergency stop ("công tắc dừng khẩn cấp").
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "chưa bao giờ",
  // {n} days, compact
  days: "{n} ngày",
  lot: "lot",
  // How long a trade was held: p = minutes, g = hours, n = days (compact)
  "dur.m": "{m}p",
  "dur.h": "{h}g",
  "dur.hm": "{h}g {m}p",
  "dur.d": "{d}n",
  "dur.dh": "{d}n {h}g",
  nTrades: { other: "{count} giao dịch" },
  readOnly: "Đăng nhập này có thể xem chiến lược nhưng không thể thay đổi gì.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo không khả dụng", // (display)
  "state.unavailable.text": "Chúng tôi không thể kết nối với dịch vụ chiến lược. Chiến lược của bạn vẫn tiếp tục chạy trên máy chủ; vui lòng thử lại sau giây lát.",
  "state.disabled.title": "Không khả dụng", // (display)
  "state.disabled.text": "Tính năng này không khả dụng cho tài khoản của bạn.",
  "state.notFound.title": "Không tìm thấy", // (display)
  "state.notFound.text": "Mục này có thể đã bị xóa, hoặc liên kết không đúng.",
  "state.back": "Quay lại Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Công tắc dừng khẩn cấp của bạn đang bật. Hãy tắt công tắc trên màn hình Algo trước khi chạy lại chiến lược.",
  "error.haltedPlatform": "Giao dịch tự động hiện đang bị sàn tạm dừng. Vui lòng thử lại sau.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "Bạn có thể chạy tối đa {n} chiến lược cùng lúc. Hãy dừng một chiến lược trước.",
  "error.accountStatus": "Tài khoản này hiện không thể giao dịch.",
  "error.alreadyRunning": "Phiên bản này đã đang chạy trên tài khoản đó.",
  "error.invalidStrategy": "Hãy sửa lỗi của chiến lược trước (trong khu vực khách hàng hoặc với AI Trader).",
  "error.state": "Trạng thái đã thay đổi. Kéo xuống để xem trạng thái hiện tại.",
  "error.queueFull": "Bạn đã có 3 backtest đang chờ hoặc đang chạy. Hãy đợi một backtest hoàn tất.",
  "error.dailyLimit": "Bạn đã đạt giới hạn {n} backtest hôm nay.",
  "error.ownListing": "Bạn không thể đăng ký chiến lược của chính mình.",
  "error.subscribed": "Bạn đã đăng ký chiến lược này.",
  "error.cloneNotAllowed": "Tác giả không cho phép nhân bản; thay vào đó hãy sao chép vào tài khoản của bạn.",
  // {amount} in USDT
  "error.insufficientFunds": "Số dư ví của bạn dưới {amount} USDT. Hãy nạp USDT để đăng ký.",
  "error.insufficientFundsPlain": "Số dư ví của bạn quá thấp. Hãy nạp USDT để đăng ký.",
  "error.inactive": "Gói đăng ký này không còn hoạt động.",
  "error.archiveRunning": "Hãy dừng các triển khai của chiến lược này trước khi lưu trữ.",
  "error.archived": "Chiến lược này đã được lưu trữ.",
  "error.finished": "Backtest này đã hoàn tất.",
  "error.revoked": "Khóa này đã bị thu hồi.",
  "error.notFound": "Mục này không còn nữa.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "Backtest {tf} chỉ bao gồm tối đa {days} ngày. Hãy chọn khoảng thời gian ngắn hơn.",
  "error.balanceRange": "Số dư ban đầu phải từ 100 đến 10,000,000.",
  "error.dates": "Ngày bắt đầu phải trước ngày kết thúc.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Giao dịch tự động",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "Đang chạy",
  "home.heroRunning": { other: "chiến lược giao dịch 24/7 trên máy chủ" },
  "home.heroRealized": "Lãi/lỗ đã thực hiện",
  "home.heroOpen": "Đang mở",
  // closed trades so far
  "home.heroTrades": "Giao dịch",
  "home.qaAi": "Tạo bằng AI",
  "home.qaAiHint": "Mô tả ý tưởng, nhận quy tắc chính xác",
  "home.qaMarket": "Chợ chiến lược",
  "home.qaMarketHint": "Sao chép chiến lược đã xác minh",
  "home.qaKeys": "Khóa API & webhook",
  "home.qaKeysHint": "Mức sử dụng, thu hồi, cảnh báo gần đây",
  "home.running": "Triển khai", // (display)
  "home.runningSub": { zero: "Hiện không có gì đang chạy", other: "{count} đang chạy" },
  // {n} = count shown on the filter pill
  "home.filterActive": "Đang hoạt động · {n}",
  "home.filterAll": "Tất cả · {n}",
  "home.strategies": "Chiến lược của tôi", // (display)
  "home.strategiesSub": { zero: "Chưa lưu chiến lược nào", other: "Đã lưu {count}" },
  "home.newWithAi": "Tạo mới bằng AI",
  "home.backtests": "Backtest", // (display)
  "home.backtestsSub": "Các lần chạy gần nhất, mới nhất trước",
  "home.emptyDeps": "Chưa có gì được chạy. Hãy mở một chiến lược của bạn bên dưới và triển khai trên tài khoản demo trước.",
  "home.emptyActive": "Hiện không có gì đang chạy. Chiến lược đã dừng nằm trong mục Tất cả.",
  "home.showAll": "Hiện tất cả",
  "home.emptyStrats": "Bạn chưa có chiến lược riêng. Hãy mô tả ý tưởng cho AI Trader để biến thành quy tắc chính xác mà bạn có thể kiểm thử.",
  "home.browseMarket": "Khám phá chợ chiến lược",
  "home.emptyBts": "Chưa có backtest. Hãy mở một chiến lược và chạy backtest trên lịch sử giá thực.",
  "home.startEyebrow": "Bắt đầu",
  "home.startTitle": "Vận hành chiến lược", // (display)
  "home.step1": "Mô tả ý tưởng cho AI Trader: ý tưởng trở thành quy tắc chính xác mà bạn có thể đọc và thay đổi.",
  "home.step2": "Backtest quy tắc trên lịch sử giá thực, với chi phí của tài khoản bạn.",
  "home.step3": "Chạy 24/7 trên tài khoản demo trước. Tạm dừng, dừng hoặc hủy bất cứ lúc nào.",
  "home.footnote": "Chiến lược chạy liên tục trên máy chủ Kalks, trên nến đã đóng, với cùng các bước kiểm tra lệnh như giao dịch thủ công: ký quỹ, giờ thị trường, giới hạn của bạn. Xây dựng và chỉnh sửa chiến lược với AI Trader hoặc trong khu vực khách hàng.",
  "home.openWeb": "Mở trình tạo chiến lược trên web",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Công tắc dừng khẩn cấp",
  "kill.cardBody": "Dừng mọi chiến lược cùng lúc và chặn lệnh webhook và API.",
  "kill.stopAll": "Dừng tất cả",
  "kill.onTitle": "Công tắc dừng khẩn cấp đang bật",
  // {at} = date and time
  "kill.onSince": "Từ {at}. Chiến lược đã dừng; lệnh webhook và API bị chặn.",
  "kill.onBody": "Chiến lược đã dừng; lệnh webhook và API bị chặn.",
  "kill.release": "Tắt công tắc",
  "kill.title": "Dừng mọi thứ?", // (display)
  "kill.body": {
    zero: "Mọi chiến lược dừng ngay lập tức, và lệnh webhook và API bị chặn cho đến khi bạn tắt công tắc.",
    other: "{count} chiến lược đang chạy sẽ dừng ngay lập tức, và lệnh webhook và API bị chặn cho đến khi bạn tắt công tắc.",
  },
  "kill.alsoClose": "Đồng thời đóng các lệnh của chúng",
  "kill.alsoCloseHint": "Đóng theo giá thị trường mọi lệnh được mở bởi chiến lược, webhook hoặc API trên tất cả tài khoản của bạn. Các lệnh thủ công của bạn vẫn được giữ.",
  "kill.confirm": "Dừng tất cả ngay",
  "kill.doneTitle": "Đã dừng tất cả", // (display)
  "kill.stopped": "Đã dừng chiến lược",
  "kill.doneBody": "Công tắc dừng khẩn cấp vẫn bật cho đến khi bạn tắt. Chiến lược đã dừng sẽ không tự khởi động lại.",
  "kill.releaseTitle": "Tắt công tắc dừng khẩn cấp?", // (display)
  "kill.releaseBody": "Lệnh webhook và API được cho phép trở lại. Chiến lược đã dừng vẫn giữ trạng thái dừng: hãy triển khai lại khi bạn sẵn sàng.",
  "kill.releasedTitle": "Đã tắt công tắc", // (display)
  "kill.releasedBody": "Lệnh webhook và API được cho phép trở lại. Hãy triển khai một chiến lược để bắt đầu.",
  "kill.globalTitle": "Giao dịch tự động đang tạm dừng",
  "kill.globalBody": "Sàn đã tạm dừng mọi chiến lược, lệnh webhook và API. Các lệnh đang mở vẫn giữ các mức cắt lỗ.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Đang chạy",
  "dep.status.paused": "Tạm dừng",
  "dep.status.stopped": "Đã dừng",
  "dep.status.killed": "Đã hủy",
  "dep.status.error": "Lỗi",
  "dep.realized": "Lãi/lỗ đã thực hiện",
  "dep.trades": "Giao dịch",
  "dep.winRate": "Tỷ lệ thắng",
  "dep.open": "Đang mở",
  "dep.orders": "Lệnh",
  "dep.openNow": "Đang mở",
  // {ago} = "5 minutes ago"
  "dep.lastCheck": "Kiểm tra nến gần nhất: {ago}",
  // {since} = start date
  "dep.lastCheckSince": "Kiểm tra nến gần nhất: {ago} · chạy từ {since}",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "Đã dừng: {reason}",
  "dep.stoppedTitle": "Đã dừng {at}",
  "dep.errorTitle": "Chiến lược gặp lỗi",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Triển khai · {account}",
  "dep.marketplaceCopy": "Bản sao từ chợ chiến lược",
  "dep.openStrategy": "Mở chiến lược",
  "dep.openSubscription": "Mở đăng ký của tôi",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct} trên {amount}",
  "dep.curveA11y": "Số dư theo ngày trong {days} ngày, đã thực hiện {pnl}",
  "dep.tabLog": "Nhật ký · {n}",
  "dep.tabTrades": "Giao dịch · {n}",
  "dep.tabSetup": "Thiết lập",
  "dep.noLogs": "Chưa có nhật ký: nến đóng đầu tiên dùng để khởi động.",
  "dep.noTrades": "Chưa có giao dịch.",
  "dep.older": "Tải mục cũ hơn",
  "dep.logStart": "Đây là mục đầu tiên.",
  "dep.rules": "Quy tắc",
  "dep.rulesHidden": "Tác giả giữ bí mật quy tắc: chiến lược chạy trên tài khoản của bạn đúng như khi được đăng.",
  "dep.lotMultiplier": "Hệ số nhân lot",
  "dep.maxLots": "Lot tối đa mỗi lệnh",
  "dep.maxOpen": "Số lệnh mở tối đa",
  "dep.dailyLoss": "Giới hạn lỗ trong ngày",
  "dep.started": "Bắt đầu",
  "dep.startBalance": "Số dư ban đầu",
  "dep.setupNote": "Mỗi triển khai chạy đúng một phiên bản: lưu phiên bản mới không làm thay đổi triển khai. Hãy triển khai phiên bản mới để chuyển đổi.",

  "ctl.pause": "Tạm dừng",
  "ctl.resume": "Tiếp tục",
  "ctl.stop": "Dừng",
  "ctl.kill": "Hủy",
  "ctl.killNow": "Hủy ngay",
  "ctl.closePositions": "Đóng lệnh",
  "ctl.pauseTitle": "Tạm dừng?", // (display)
  "ctl.pauseBody": "Không vào lệnh mới. Lệnh đang mở vẫn giữ cắt lỗ, mục tiêu và hòa vốn. Tiếp tục bất cứ khi nào bạn muốn.",
  "ctl.resumeTitle": "Tiếp tục?", // (display)
  "ctl.resumeBody": "Chiến lược giao dịch lại từ nến đóng tiếp theo.",
  "ctl.stopTitle": "Dừng?", // (display)
  "ctl.stopBody": "Chiến lược dừng hẳn: không vào lệnh mới. Để chạy lại, hãy triển khai lại.",
  "ctl.keepTitle": "Giữ các lệnh đang mở",
  "ctl.keepText": { other: "{count} lệnh đang mở vẫn giữ cắt lỗ và mục tiêu; bạn tự quản lý chúng." },
  "ctl.closeAllTitle": "Đóng ngay",
  "ctl.closeAllText": { other: "{count} lệnh đang mở sẽ được đóng theo giá thị trường." },
  "ctl.killTitle": "Hủy ngay?", // (display)
  "ctl.killBody": "Công tắc dừng khẩn cấp dừng chiến lược này ngay lập tức, và theo mặc định đóng các lệnh do chiến lược mở theo giá thị trường.",
  "ctl.killClose": "Đóng các lệnh của chiến lược",
  "ctl.killCloseHint": "Theo giá thị trường, ngay bây giờ. Tắt để giữ lệnh mở cùng mức cắt lỗ.",
  "ctl.closeTitle": "Đóng các lệnh của chiến lược?", // (display)
  "ctl.closeBody": { other: "{count} lệnh do chiến lược này mở sẽ được đóng theo giá thị trường. Chiến lược vẫn tiếp tục chạy." },
  "ctl.done.pause": "Đã tạm dừng", // (display)
  "ctl.done.resume": "Đang chạy lại", // (display)
  "ctl.done.stop": "Đã dừng", // (display)
  "ctl.done.kill": "Đã hủy", // (display)
  "ctl.done.close": "Đã đóng lệnh", // (display)
  "ctl.donePause": "Không vào lệnh mới cho đến khi bạn tiếp tục.",
  "ctl.doneResume": "Chiến lược giao dịch lại từ nến đóng tiếp theo.",
  "ctl.doneClosed": { other: "Đã đóng {count} lệnh." },
  "ctl.doneKept": "Các lệnh đang mở (nếu có) vẫn được giữ cùng mức cắt lỗ và mục tiêu.",
  "ctl.doneNothing": "Không có lệnh nào đang mở để đóng.",
  "ctl.closedLabel": "Đã đóng",
  "ctl.failedLabel": "Không thể đóng",
  "ctl.failedTitle": { other: "{count} lệnh không thể đóng" },
  "ctl.failedBody": "Thị trường có thể đang đóng cửa. Hãy đóng lệnh từ Danh mục khi giao dịch mở lại.",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "Đây là bản sao từ chợ chiến lược: dừng không kết thúc gói đăng ký. Để ngừng thanh toán, hãy hủy tại Chợ chiến lược › Đăng ký.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Chiến lược · v{version}",
  "strat.runningN": { other: "{count} đang chạy" },
  "strat.draft": "Bản nháp",
  "strat.ready": "Sẵn sàng",
  "strat.errors": { other: "{count} lỗi" },
  "strat.archivedTag": "Đã lưu trữ",
  "strat.lastBacktest": "Backtest gần nhất",
  "strat.backtested": "backtest",
  "strat.notTested": "Chưa backtest", // (display)
  "strat.notTestedBody": "Kiểm thử quy tắc trên lịch sử giá thực, với chi phí của tài khoản bạn, trước khi chạy.",
  "strat.runFirst": "Chạy backtest",
  "strat.openReport": "Mở báo cáo đầy đủ",
  "strat.deployV": "Triển khai v{version}",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "Hãy sửa các lỗi này trước khi kiểm thử hoặc triển khai",
  "strat.line": "Dòng {n}:",
  "strat.rules": "Quy tắc", // (display)
  "strat.rulesSub": "Được kiểm tra trên mỗi nến đã đóng",
  "strat.rulesCodeSub": "Tín hiệu của mã, được kiểm tra trên mỗi nến đã đóng",
  "strat.showCode": "Hiện dạng mã",
  "strat.risk": "Rủi ro", // (display)
  "strat.riskSub": "Khối lượng, cắt lỗ, giờ giao dịch và giới hạn",
  "strat.editVisual": "Để thay đổi quy tắc, hãy hỏi AI Trader hoặc chỉnh sửa trong khu vực khách hàng; mỗi thay đổi được lưu thành một phiên bản mới.",
  "strat.editCode": "Chiến lược dạng mã được chỉnh sửa trong khu vực khách hàng trên web; mỗi thay đổi được lưu thành một phiên bản mới.",
  "strat.openWeb": "Sửa mã trên web",
  "strat.deployments": "Triển khai", // (display)
  "strat.deploymentsSub": { zero: "Không chạy ở đâu cả", other: "{count} triển khai" },
  "strat.notRunning": "Chưa chạy. Hãy triển khai trên tài khoản demo trước để xem chiến lược giao dịch thực tế ra sao.",
  "strat.backtests": "Backtest", // (display)
  "strat.backtestsSub": { zero: "Chưa có", other: "{count} lần chạy" },
  "strat.runNew": "Chạy mới",
  "strat.noBacktests": "Chưa có backtest.",
  "strat.versions": "Phiên bản", // (display)
  "strat.versionsSub": { other: "{count} phiên bản" },
  "strat.current": "Hiện tại",
  "strat.archive": "Lưu trữ",
  "strat.archiveTitle": "Lưu trữ?", // (display)
  "strat.archiveBody": "“{name}” sẽ rời khỏi danh sách của bạn. Các backtest và triển khai trước đây vẫn nằm trong lịch sử.",
  "strat.archived": "Đã lưu trữ “{name}”",

  "kind.visual": "Quy tắc trực quan",
  "kind.code": "Mã",
  // Where a strategy came from
  "origin.ai": "AI Trader",
  "origin.template": "Mẫu",
  "origin.manual": "Tự xây dựng",
  "origin.marketplace": "Chợ chiến lược",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Mua khi",
  "rules.sell": "Bán khi",
  "rules.exitBuy": "Đóng lệnh mua khi",
  "rules.exitSell": "Đóng lệnh bán khi",
  "rules.and": "và",
  "rules.or": "hoặc",
  // {tf} = timeframe, e.g. "on H4"
  "rules.onTf": "trên {tf}",
  "rules.noRules": "Chưa có quy tắc vào lệnh.",
  "rules.size": "Khối lượng",
  "rules.stop": "Cắt lỗ",
  "rules.target": "Chốt lời",
  "rules.trailing": "Trailing",
  "rules.window": "Giờ giao dịch",
  "rules.limits": "Giới hạn",
  "rules.none": "Không",
  "rules.lots": "{lots} lot",
  "rules.riskPct": "Rủi ro {pct}% mỗi giao dịch",
  "rules.maxLots": "tối đa {lots} lot",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "hòa vốn tại {v} điểm (+{o})",
  "rules.allDay": "Cả ngày",
  "rules.perDay": { other: "{count} giao dịch mỗi ngày" },
  "rules.dailyLoss": "Dừng trong ngày khi lỗ {amount}",
  "rules.oneAtATime": "Mỗi lần một lệnh",
  "rules.closeOutside": "Đóng lệnh ngoài khung giờ",
  "rules.noLimits": "Không giới hạn hằng ngày",
  "op.crossesAbove": "cắt lên",
  "op.crossesBelow": "cắt xuống",
  "dist.pips": "{v} pip",
  "dist.points": "{v} điểm",
  "dist.price": "tại {v}",
  "dist.percent": "{v}% giá",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "mức {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Đóng cửa",
  "field.open": "Mở cửa",
  "field.high": "Cao",
  "field.low": "Thấp",
  "field.hl2": "Giá trung vị",
  "field.hlc3": "Giá điển hình",
  "field.ohlc4": "Giá trung bình",
  "field.volume": "Khối lượng",
  "pattern.bullish": "Nến tăng",
  "pattern.bearish": "Nến giảm",
  "pattern.bullish_engulfing": "Nhấn chìm tăng",
  "pattern.bearish_engulfing": "Nhấn chìm giảm",
  "pattern.hammer": "Nến búa",
  "pattern.shooting_star": "Nến sao băng",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "Inside bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "Tín hiệu MACD",
  "ind.macd_hist": "Histogram MACD",
  "ind.bb_upper": "Dải trên Bollinger",
  "ind.bb_middle": "Dải giữa Bollinger",
  "ind.bb_lower": "Dải dưới Bollinger",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastic %K",
  "ind.stoch_d": "Stochastic %D",
  "ind.highest": "Đỉnh cao nhất",
  "ind.lowest": "Đáy thấp nhất",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Động lượng",
  "ind.roc": "ROC",
  "ind.stddev": "Độ lệch chuẩn",
  "note.noDailyLimit": "Không giới hạn số giao dịch mỗi ngày",
  "note.noStop": "Không có cắt lỗ: lệnh không được bảo vệ",
  "note.riskNeedsStop": "Khối lượng theo rủi ro cần có cắt lỗ",
  "note.rrNeedsStop": "Chốt lời theo R cần có cắt lỗ",
  "note.noEntry": "Chưa có quy tắc vào lệnh: hãy thêm điều kiện mua hoặc bán",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Triển khai · v{version}",
  "deploy.title": "Chạy 24/7", // (display)
  "deploy.body": "“{name}” v{version} giao dịch {symbol} trên mỗi nến {tf} đã đóng, trên máy chủ Kalks, kể cả khi điện thoại của bạn tắt. Tạm dừng, dừng hoặc hủy bất cứ lúc nào.",
  "deploy.account": "Tài khoản",
  "deploy.equity": "Vốn {amount}",
  "deploy.noAccounts": "Bạn cần một tài khoản giao dịch đang hoạt động. Hãy mở tài khoản demo để thử chiến lược mà không gặp rủi ro.",
  "deploy.openAccount": "Mở tài khoản",
  "deploy.multiplier": "Hệ số nhân lot",
  "deploy.multiplierHint": "Điều chỉnh khối lượng mọi lệnh. 1× giao dịch đúng khối lượng của chiến lược.",
  "deploy.maxOpen": "Số lệnh mở tối đa",
  "deploy.maxOpenHint": "Giới hạn bổ sung ngoài quy tắc của chiến lược.",
  "deploy.strategyDefault": "Theo quy tắc chiến lược",
  "deploy.dailyLoss": "Giới hạn lỗ trong ngày",
  "deploy.dailyLossHint": "Khi tổng lỗ đã đóng và đang mở trong ngày chạm mức này, không vào lệnh mới cho đến ngày mai (giờ máy chủ).",
  "deploy.off": "Tắt",
  "deploy.custom": "Tùy chỉnh",
  "deploy.dailyLossAmount": "Mức lỗ mỗi ngày",
  "deploy.lossInvalid": "Nhập số tiền lớn hơn 0.",
  "deploy.liveTitle": "Tiền thật",
  "deploy.liveBody": "Đây là tài khoản thực. Chiến lược đặt lệnh thật bằng tiền thật và có thể thua lỗ.",
  "deploy.ack": "Tôi hiểu rằng chiến lược giao dịch bằng tiền thật trên tài khoản thực của tôi và tôi chịu trách nhiệm về việc này.",
  "deploy.note": "Giao dịch tự động có thể thua lỗ. Backtest là mô phỏng và không dự đoán kết quả tương lai. Đây không phải lời khuyên tài chính.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Triển khai trên {account}",
  "deploy.doneTitle": "Đang chạy", // (display)
  "deploy.doneBody": "“{name}” v{version} đang chạy trên {account}.",
  "deploy.warmup": "Nến {tf} đóng đầu tiên dùng để khởi động; lệnh có thể bắt đầu từ nến tiếp theo.",
  "deploy.open": "Mở triển khai",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "Đang chờ",
  "bt.status.running": "Đang chạy",
  "bt.status.done": "Hoàn tất",
  "bt.status.failed": "Thất bại",
  "bt.status.cancelled": "Đã hủy",
  "bt.stage.queued": "Đang chờ tài nguyên xử lý",
  "bt.stage.loading": "Đang tải lịch sử giá",
  "bt.stage.m1": "Đang tải nến phút",
  "bt.stage.simulating": "Đang mô phỏng giao dịch",
  "bt.stage.running": "Đang chạy",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Backtest #{id} · v{version}",
  "bt.title": "Backtest", // (display)
  "bt.start": "Ban đầu {amount}",
  "bt.runningNote": "Backtest chạy trên máy chủ: bạn có thể rời màn hình này và quay lại sau.",
  "bt.failed": "Backtest thất bại",
  "bt.cancelled": "Đã hủy", // (display)
  "bt.runAgain": "Chạy lại",
  "bt.net": "Lợi nhuận ròng",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} trên {amount}",
  "bt.pf": "Hệ số lợi nhuận",
  "bt.winRate": "Tỷ lệ thắng",
  "bt.winsOf": "{wins}/{trades}",
  "bt.maxDd": "Sụt giảm tối đa",
  "bt.maxDdShort": "DD tối đa",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Giao dịch",
  "bt.longShort": "{long} mua · {short} bán",
  "bt.expectancy": "Kỳ vọng",
  "bt.perTrade": "mỗi giao dịch",
  "bt.equity": "Vốn", // (display)
  "bt.drawdown": "Sụt giảm",
  "bt.legendEquity": "Vốn",
  "bt.legendBalance": "Số dư",
  "bt.legendStart": "Ban đầu",
  "bt.noCurve": "Không đủ nến để vẽ đường cong.",
  "bt.scrubHint": "Kéo trên biểu đồ, hoặc chạm và giữ, để xem từng điểm.",
  "bt.curveA11y": "Vốn từ {from} đến {to}; sụt giảm tối đa {dd}",
  "bt.monthly": "Hằng tháng", // (display)
  "bt.monthlySub": "Lợi suất mỗi tháng, % số dư",
  "bt.noTradesMonth": "không có giao dịch",
  "bt.statistics": "Thống kê", // (display)
  "bt.tradeList": "Giao dịch", // (display)
  "bt.tradeListSub": "Mới nhất trước, sau chi phí",
  "bt.truncated": "{n} giao dịch đầu tiên, mới nhất trước",
  "bt.fAll": "Tất cả · {n}",
  "bt.fWins": "Thắng · {n}",
  "bt.fLosses": "Thua · {n}",
  "bt.noTrades": "Quy tắc không phát sinh giao dịch nào trong khoảng thời gian này.",
  "bt.data": "Dữ liệu & chi phí", // (display)
  "bt.m1Bars": "Nến phút (trong nến)",
  "bt.since": "từ {date}",
  "bt.signals": "Tín hiệu",
  "bt.signalsValue": "{buy} mua · {sell} bán · {exits} thoát",
  "bt.skipped": "Bỏ qua: {reason}",
  "bt.model": "Mô hình",
  "bt.group": "Loại tài khoản",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} điểm ({source})",
  "bt.commission": "Hoa hồng",
  "bt.perLot": "{amount} mỗi lot",
  "bt.swaps": "Swap",
  "bt.swapsOn": "Tính ở mỗi lần qua đêm",
  "bt.swapsOff": "Không tính (miễn swap)",
  "bt.conversion": "Quy đổi lãi/lỗ",
  "bt.usdBase": "USD là tiền cơ sở: theo giá thoát lệnh",
  "bt.usdQuoted": "Định giá bằng USD",
  "bt.currentRate": "Theo tỷ giá hiện tại ({rate})",
  "bt.simNote": "Backtest #{id} là mô phỏng trên giá quá khứ: khớp lệnh tại giá mở của nến kế tiếp, cắt lỗ và mục tiêu theo đường đi OHLC (dùng nến phút nếu có), với spread, hoa hồng và swap của loại tài khoản bạn. Kết quả quá khứ không dự đoán kết quả tương lai.",
  // History sources and skip reasons from the service
  "source.native": "gốc",
  "source.built_from_M1": "dựng từ M1",
  "source.built_from_M5": "dựng từ M5",
  "source.built_from_M15": "dựng từ M15",
  "source.built_from_M30": "dựng từ M30",
  "source.built_from_H1": "dựng từ H1",
  "skip.outside_trading_window": "ngoài giờ giao dịch",
  "skip.position_already_open": "đã có lệnh đang mở",
  "skip.daily_trade_limit": "giới hạn giao dịch trong ngày",
  "skip.max_daily_loss": "giới hạn lỗ trong ngày",
  "skip.market_closed": "thị trường đóng cửa",
  "skip.20_open_positions": "đã có 20 lệnh đang mở",
  "skip.buy_and_sell_on_the_same_bar": "mua và bán trên cùng một nến",
  "skip.stop_distance_not_ready": "khoảng cách cắt lỗ chưa sẵn sàng",
  "skip.SL_level_on_the_wrong_side": "mức cắt lỗ nằm sai phía",
  "skip.volume_below_the_minimum_lot": "khối lượng dưới lot tối thiểu",
  "spreadSource.group_quote": "báo giá trực tiếp của loại tài khoản bạn",
  "spreadSource.catalogue": "spread danh mục",
  "spreadSource.fixed": "cố định",

  "btNew.title": "Chạy backtest", // (display)
  "btNew.period": "Khoảng thời gian",
  "btNew.balance": "Số dư ban đầu",
  "btNew.other": "Khác",
  "btNew.amount": "Số tiền",
  "btNew.costs": "Chi phí theo",
  "btNew.accountType": "Loại tài khoản",
  "btNew.myAccount": "Tài khoản của tôi",
  "btNew.costsGroupHint": "Spread, hoa hồng và swap của loại tài khoản đó.",
  "btNew.costsAccountHint": "Spread, hoa hồng và swap theo nhóm của tài khoản đó.",
  "btNew.noAccounts": "Bạn chưa có tài khoản giao dịch nào đang hoạt động.",
  "btNew.run": "Chạy backtest",
  "btNew.note": "Khoảng thời gian dài nhất tùy thuộc vào khung thời gian. Có thể chạy tối đa 3 backtest cùng lúc.",

  "period.p1m": "1T",
  "period.p3m": "3T",
  "period.p6m": "6T",
  "period.p1y": "1N",
  "period.p2y": "2N",
  "period.p5y": "5N",

  // Trade exit reasons (server codes)
  "exit.sl": "Cắt lỗ",
  "exit.tp": "Chốt lời",
  "exit.trailing": "Trailing stop",
  "exit.breakeven": "Hòa vốn",
  "exit.signal": "Tín hiệu",
  "exit.exit_rule": "Quy tắc thoát",
  "exit.session": "Ngoài giờ",
  "exit.end_of_test": "Kết thúc kiểm thử",
  "exit.stop_out": "Stop out",
  "exit.kill": "Dừng khẩn cấp",
  "exit.stopped": "Đã dừng",
  "exit.client": "Đã đóng",
  "exit.close": "Đã đóng",

  "stat.balance": "Số dư",
  "stat.gross": "Tổng lãi / lỗ",
  "stat.cagr": "Tăng trưởng hằng năm (CAGR)",
  "stat.avgWinLoss": "Lãi / lỗ trung bình",
  "stat.largest": "Lãi / lỗ lớn nhất",
  "stat.payoff": "Tỷ lệ lãi/lỗ",
  "stat.long": "Lệnh mua · tỷ lệ thắng",
  "stat.short": "Lệnh bán · tỷ lệ thắng",
  "stat.streaks": "Chuỗi thắng / thua dài nhất",
  "stat.maxDd": "Sụt giảm tối đa",
  "stat.recovery": "Hệ số phục hồi",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Số nến giữ trung bình",
  "stat.exposure": "Thời gian trên thị trường",
  "stat.costs": "Hoa hồng / swap / spread",
  "stat.bars": "Số nến đã kiểm thử",
  "stat.cpu": "Thời gian tính",
  "stat.seconds": "{s} giây",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Nến",
  "log.signal": "Tín hiệu",
  "log.order": "Lệnh",
  "log.close": "Đóng",
  "log.manage": "Quản lý",
  "log.error": "Lỗi",
  "log.info": "Thông tin",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Chiến lược nội bộ · Vận hành bởi Kalks",
  "house.disclosure":
    "Chiến lược nội bộ do Kalks vận hành: một tài khoản thực thuộc sở hữu của sàn chạy chiến lược này. Thành tích chỉ gồm các giao dịch thực của chính nó kể từ khi bắt đầu; không có gì được mô phỏng hay bổ sung ngược.",
  "market.eyebrow": "Chợ chiến lược",
  "market.title": "Chợ", // (display)
  "market.subtitle": "Chiến lược có thành tích đã xác minh từ tài khoản Kalks thật. Sao chép một chiến lược vào tài khoản của bạn, hoặc nhân bản quy tắc khi tác giả cho phép.",
  "market.browse": "Khám phá",
  "market.subs": "Đăng ký",
  "market.subsN": "Đăng ký · {n}",
  "market.mine": "Bài đăng của bạn",
  "market.search": "Tìm chiến lược, tác giả…",
  "market.clear": "Xóa tìm kiếm",
  "market.all": "Tất cả",
  "market.free": "Miễn phí",
  "market.paid": "Trả phí",
  "market.newest": "Mới nhất",
  "market.topRated": "Đánh giá cao nhất",
  "market.popular": "Phổ biến",
  // {price} in USDT
  "market.perMonth": "{price} USDT/tháng",
  "market.by": "bởi {author}",
  "market.return": "Lợi suất",
  "market.winRate": "Tỷ lệ thắng",
  "market.maxDd": "DD tối đa",
  "market.trades": "Giao dịch",
  // {type} = live / demo
  "market.verified": "{type} đã xác minh",
  "market.verifiedDays": "{type} đã xác minh · {days} ngày",
  // a track record younger than a day
  "market.verifiedNew": "{type} đã xác minh · chưa đến một ngày",
  "market.subscribed": "Đã đăng ký",
  "market.ratings": { zero: "Chưa có đánh giá", other: "{count} đánh giá" },
  "market.subscribers": { other: "{count} người đăng ký" },
  "market.emptyTitle": "Chưa có chiến lược nào", // (display)
  "market.emptyText": "Chiến lược sẽ xuất hiện tại đây khi tác giả đăng cùng thành tích đã xác minh.",
  "market.noMatchTitle": "Không có kết quả", // (display)
  "market.noMatchText": "Hãy thử từ khóa hoặc bộ lọc khác.",
  "market.noSubsTitle": "Chưa có đăng ký", // (display)
  "market.noSubsText": "Chiến lược bạn sao chép hoặc nhân bản từ chợ sẽ hiển thị tại đây.",
  "market.disclaimer": "Hiệu suất trong quá khứ không đảm bảo kết quả tương lai. Thành tích đến từ tài khoản thực hoặc demo trên Kalks và được ghi nhãn tương ứng. Phí nền tảng cho đăng ký trả phí: {pct}%.",
  "market.houseFootnote": "Chiến lược nội bộ chạy trên tài khoản thực thuộc sở hữu của sàn; thành tích chỉ gồm các giao dịch thực của chính chúng.",
  "market.earned": "Đã kiếm được",
  "market.fees": "Phí nền tảng",
  "market.payments": "Thanh toán",
  "market.publishWeb": "Việc đăng chiến lược (kèm thành tích đã xác minh) và chỉnh sửa bài đăng được thực hiện trong khu vực khách hàng trên web.",
  "market.openWeb": "Mở chợ chiến lược trên web",

  // Listing statuses (server values)
  "listing.pending": "Đang xét duyệt",
  "listing.approved": "Đã đăng",
  "listing.rejected": "Bị từ chối",
  "listing.suspended": "Bị tạm ngưng",
  "listing.unlisted": "Đã gỡ",
  "listing.eyebrow": "Chợ chiến lược · {symbol} {tf}",
  "listing.verified": "Thành tích {type} đã xác minh",
  "listing.cloneAllowed": "Cho phép nhân bản",
  "listing.trackReturn": "Lợi suất đã xác minh",
  "listing.net": "Ròng",
  "listing.noCurve": "Đường cong theo ngày sẽ xuất hiện sau hai ngày giao dịch.",
  "listing.curveA11y": "Vốn theo ngày trong {days} ngày, lợi suất {ret}",
  "listing.trackNote": "Từ triển khai của chính tác giả trên Kalks kể từ {since}, được tính từ các giao dịch đã đóng trên máy chủ giao dịch: không bao giờ do tác giả nhập.",
  "listing.btSimulated": "Backtest · mô phỏng",
  "listing.btNote": "Cho thấy các quy tắc sẽ giao dịch thế nào trên giá quá khứ với chi phí của loại tài khoản này. Không thuộc thành tích thực ở trên.",
  "listing.btA11y": "Đường vốn backtest (mô phỏng)",
  "listing.about": "Giới thiệu", // (display)
  "listing.risk": "Rủi ro", // (display)
  "listing.rules": "Quy tắc", // (display)
  "listing.rulesPrivate": "Quy tắc được giữ bí mật: hãy sao chép chiến lược để chạy trên tài khoản của bạn.",
  "listing.reviews": "Đánh giá · {n}", // (display)
  "listing.noReviews": "Chưa có đánh giá.",
  "listing.subscribeFree": "Đăng ký miễn phí",
  "listing.subscribePaid": "Đăng ký · {price} USDT / tháng",
  "listing.copying": "Đang sao chép trên {login}",
  "listing.clonedTo": "Đã nhân bản vào chiến lược của bạn",
  "listing.openDeployment": "Mở triển khai",
  "listing.openStrategy": "Mở chiến lược",
  "listing.cancel": "Hủy",
  "listing.cancelConfirm": "Hủy đăng ký",
  "listing.keep": "Giữ lại",
  "listing.cancelTitle": "Hủy đăng ký?", // (display)
  "listing.cancelCopy": "Chiến lược sẽ dừng trên tài khoản của bạn ngay bây giờ. Các lệnh đang mở vẫn được giữ cùng mức cắt lỗ và mục tiêu.",
  "listing.cancelClone": "Gói đăng ký kết thúc. Chiến lược đã nhân bản vẫn nằm trong danh sách của bạn.",
  // {date} = end of the paid period
  "listing.cancelPaid": "Gói vẫn hoạt động đến {date} và sẽ không gia hạn. Không hoàn tiền cho kỳ hiện tại.",
  "listing.cancelled": "Đã hủy đăng ký",
  "listing.cancelledPaid": "Sẽ không gia hạn",
  "listing.yours": "Bài đăng của bạn",
  "listing.manageWeb": "Quản lý trên web",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Đăng ký",
  "sub.title": "Đăng ký",
  "sub.body": "bởi {author} · {symbol} {tf}",
  "sub.how": "Cách thức",
  "sub.copyTitle": "Sao chép vào tài khoản của tôi",
  "sub.copyText": "Đúng phiên bản của tác giả chạy trên tài khoản của bạn, 24/7. Quy tắc được giữ bí mật.",
  "sub.copyTextOpen": "Đúng phiên bản của tác giả chạy trên tài khoản của bạn, 24/7.",
  "sub.cloneTitle": "Nhân bản quy tắc",
  "sub.cloneText": "Quy tắc trở thành một chiến lược của bạn: tự kiểm thử, thay đổi và triển khai.",
  "sub.multiplierHint": "Điều chỉnh khối lượng lệnh của chiến lược trên tài khoản của bạn.",
  "sub.price": "Giá",
  "sub.dueNow": "Thanh toán ngay",
  "sub.wallet": "Ví (khả dụng)",
  "sub.renewal": "Gia hạn",
  "sub.noCharge": "Miễn phí, không bị trừ tiền",
  "sub.shortTitle": "Không đủ USDT",
  "sub.shortBody": "Ví của bạn cần có ít nhất {amount} USDT khả dụng.",
  "sub.deposit": "Nạp tiền",
  "sub.liveBody": "Chiến lược đặt lệnh thật bằng tiền thật trên tài khoản này và có thể thua lỗ.",
  "sub.ackPay": "Trừ {price} USDT từ ví Kalks của tôi ngay bây giờ và mỗi 30 ngày cho đến khi tôi hủy.",
  "sub.doneTitle": "Đã đăng ký", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}” đang chạy trên {account}.",
  "sub.doneClone": "“{title}” giờ là một chiến lược của bạn.",
  "sub.charged": "Đã trừ {amount} USDT từ ví của bạn.",
  // the answer to a subscribe request was lost (connection, timeout): the app re-reads the listing before a retry
  "sub.noAnswer": "Chúng tôi chưa nhận được phản hồi. Gói đăng ký có thể đã được thực hiện.",
  "sub.checkingTitle": "Đang kiểm tra gói đăng ký",
  "sub.checkingBody": "Phản hồi bị mất trên đường truyền. Chúng tôi đang kiểm tra với máy chủ trước khi bạn có thể thử lại, để bạn không bao giờ bị trừ tiền hai lần.",
  "sub.noAnswerRetry": "Vẫn chưa có phản hồi và không có gói đăng ký mới nào trên tài khoản của bạn. Bạn có thể thử lại.",
  "sub.notThrough": "Giao dịch không thành công và bạn không bị trừ tiền (khoản đã trừ sẽ được hoàn về ví). Bạn có thể thử lại.",
  "sub.unfinished": "Gói vẫn đang được thiết lập trên máy chủ. Hãy kiểm tra Chợ chiến lược › Đăng ký và lịch sử ví, hoặc liên hệ bộ phận hỗ trợ, trước khi thử lại.",
  "sub.free": "Đăng ký miễn phí: không bị trừ tiền.",
  "sub.copyOn": "sao chép trên {login}",
  "sub.cloned": "đã nhân bản",
  "sub.renews": "gia hạn {date}",
  "sub.ends": "kết thúc {date}",
  "sub.status.active": "Đang hoạt động",
  "sub.status.cancelled": "Đã hủy",
  "sub.status.expired": "Đã hết hạn",
  "sub.status.past_due": "Quá hạn thanh toán",

  "review.title": "Đánh giá", // (display)
  "review.rating": "Đánh giá của bạn",
  "review.stars": { other: "{count} sao" },
  "review.comment": "Nhận xét (không bắt buộc)",
  "review.placeholder": "Chiến lược giao dịch thế nào với bạn?",
  "review.post": "Đăng đánh giá",
  "review.saved": "Đã lưu đánh giá",
  "review.rate": "Đánh giá",
  "review.edit": "Sửa đánh giá",
  "review.you": "Bạn",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Nhà phát triển",
  "keys.title": "API", // (display)
  "keys.subtitle": "Khóa cho chương trình giao dịch của riêng bạn và URL webhook cho cảnh báo (TradingView và các công cụ khác).",
  "keys.requests24h": "Yêu cầu · 24 giờ qua",
  "keys.errors": "Lỗi",
  // requests refused by the rate limit
  "keys.limited": "Bị giới hạn",
  "keys.p50": "Trung vị",
  "keys.writes": "Lệnh",
  "keys.keys": "Khóa API", // (display)
  "keys.keysSub": "{n} đang hoạt động · tối đa 20",
  "keys.none": "Chưa có khóa API. Hãy tạo trong khu vực khách hàng trên web.",
  "keys.status.active": "Đang hoạt động",
  "keys.status.revoked": "Đã thu hồi",
  "keys.status.expired": "Đã hết hạn",
  "keys.scope.read": "Đọc",
  "keys.scope.trade": "Giao dịch",
  // {ips} = list of IP addresses
  "keys.ips": "Chỉ từ {ips}",
  "keys.anyIp": "Từ mọi địa chỉ IP",
  "keys.expires": "Hết hạn {date}",
  "keys.noExpiry": "Không bao giờ hết hạn",
  "keys.lastUsed": "dùng lần cuối: {ago}",
  "keys.revoke": "Thu hồi",
  "keys.revokeTitle": "Thu hồi khóa này?", // (display)
  "keys.revokeBody": "“{name}” ({id}) sẽ ngừng hoạt động ngay lập tức với mọi chương trình đang dùng. Không thể hoàn tác thao tác này.",
  "keys.revoked": "Đã thu hồi “{name}”",
  "keys.webTitle": "Tạo trên web",
  "keys.webBody": "Khóa và webhook mới được tạo trong khu vực khách hàng: secret của khóa và URL của webhook chỉ hiển thị một lần, tại đó bạn có thể sao chép vào công cụ giao dịch của mình.",
  "keys.openWeb": "Mở khu vực khách hàng",
  "keys.killHint": "Cần dừng mọi thứ? Công tắc dừng khẩn cấp trên màn hình Algo sẽ dừng mọi chiến lược và chặn lệnh webhook và API.",

  "hooks.title": "Webhook", // (display)
  "hooks.sub": "{n}/tối đa 20",
  "hooks.none": "Chưa có webhook. Hãy tạo trong khu vực khách hàng trên web.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { other: "{count} tài khoản" },
  "hooks.today": { zero: "không có cảnh báo hôm nay", other: "{count} cảnh báo hôm nay" },
  "hooks.used": "dùng lần cuối: {ago}",
  "hooks.on": "Bật",
  "hooks.off": "Tắt",
  "hooks.switch": "Bật webhook “{name}”",
  "hooks.passphrase": "Yêu cầu passphrase",
  "hooks.noPassphrase": "Không có passphrase",
  "hooks.delete": "Xóa",
  "hooks.deleteTitle": "Xóa webhook này?", // (display)
  "hooks.deleteBody": "“{name}” và URL bí mật của nó sẽ ngừng hoạt động ngay lập tức; cảnh báo gửi đến sẽ bị từ chối. Không thể hoàn tác thao tác này.",
  "hooks.deleted": "Đã xóa “{name}”",
  "hooks.alerts": "Cảnh báo gần đây", // (display)
  "hooks.alertsSub": "Mỗi cảnh báo kèm kết quả trên từng tài khoản",
  // Alert statuses (server values)
  "hooks.status.accepted": "Đã chấp nhận",
  "hooks.status.partial": "Hoàn tất một phần",
  "hooks.status.failed": "Thất bại",
  "hooks.status.received": "Đã nhận",
  "hooks.status.rejected": "Bị từ chối",
  "hooks.status.blocked": "Bị chặn (dừng khẩn cấp)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "đã khớp",
  "hooks.result.pending": "đã đặt lệnh",
  "hooks.result.closed": "đã đóng",
  "hooks.result.nothing_to_close": "không có gì để đóng",
  "hooks.result.rejected": "bị từ chối",
};
export default mobileAlgo;
