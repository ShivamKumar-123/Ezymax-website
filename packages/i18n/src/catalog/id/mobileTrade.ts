import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the `order` namespace (Buy, Sell, Stop loss, Take profit, pip, lot kept as in MT5).
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Pilih simbol",
  searchSymbol: "Cari simbol",
  depth: "Kedalaman pasar",
  alert: "Peringatan harga",
  news: "Berita tentang {symbol}", // a header button's accessibility label
  calendar: "Kalender ekonomi {currency}", // a header button's accessibility label, e.g. "Kalender ekonomi EUR"
  "account.chip": "{type} · #{login}",
  "account.manage": "Kelola akun",
  "account.open": "Buka akun",

  // Chart (indicator names stay as they are)
  "chart.indicators": "Indikator",
  "chart.type.candles": "Candle",
  "chart.type.line": "Garis",
  "ind.ma": "Moving average 20",
  "ind.ema": "Exponential MA 50",
  "ind.bb": "Bollinger Bands 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Belum ada riwayat grafik untuk simbol ini",
  "chart.hint": "Cubit untuk memperbesar · seret untuk menggeser · tekan lama untuk crosshair · ketuk dua kali untuk reset",

  // Sell / Buy bar and ticket
  "bar.volume": "Lot",
  "ticket.title": "Order baru",
  "ticket.confirmBuy": "Buy {volume} {symbol}",
  "ticket.confirmSell": "Sell {volume} {symbol}",
  "ticket.atMarket": "pada harga pasar",
  "ticket.at": "di {price}",
  "ticket.addSl": "Tambah stop loss",
  "ticket.addTp": "Tambah take profit",
  "ticket.ifHit": "{money} jika tersentuh",
  "ticket.required": "Margin",
  "ticket.pip": "Nilai pip",
  "ticket.after": "Sisa margin bebas",
  "ticket.notEnough": "Margin bebas tidak cukup untuk volume ini.",
  "ticket.noSpecs": "Memuat detail kontrak…",
  "ticket.distance": "berjarak {n} pip",
  "ticket.price": "Harga",

  // Rejections: a plain-language line under the reason (order.reject.<code>)
  "reject.no_money": "Margin bebas Anda tidak cukup untuk order ini. Kurangi volume atau tambah dana ke akun ini.",
  "reject.insufficient_funds": "Margin bebas Anda tidak cukup untuk order ini. Kurangi volume atau tambah dana ke akun ini.",
  "reject.market_closed": "Pasar ini sedang tutup. Coba lagi saat pasar buka.",
  "reject.invalid_volume": "Gunakan volume dalam batas dan langkah lot simbol ini.",
  "reject.max_lot": "Volume ini melebihi maksimum per order untuk akun Anda.",
  "reject.close_only": "Akun Anda saat ini hanya dapat menutup posisi, tidak dapat membuka posisi baru.",
  "reject.symbol_close_only": "Simbol ini saat ini hanya dapat ditutup, tidak dapat dibuka.",
  "reject.trading_disabled": "Trading dinonaktifkan di akun ini. Hubungi dukungan untuk detailnya.",
  "reject.symbol_halted": "Trading pada simbol ini dijeda. Coba lagi nanti.",
  "reject.requote.title": "Harga bergerak",
  "reject.requote": "Pasar bergerak saat order Anda sedang dikirim. Periksa harga baru lalu konfirmasi lagi.",
  "reject.invalid_sl": "Stop loss berada di sisi harga yang salah, atau terlalu dekat dengan harga.",
  "reject.invalid_tp": "Take profit berada di sisi harga yang salah, atau terlalu dekat dengan harga.",
  "reject.invalid_price": "Harga ini berada di sisi pasar yang salah untuk jenis order ini.",
  "reject.off_market": "Harga ini terlalu jauh dari pasar. Periksa nilainya.",
  "reject.stale_price": "Harga untuk simbol ini dijeda sejenak. Coba lagi sebentar lagi.",
  "reject.no_price": "Saat ini tidak ada harga live untuk simbol ini.",
  "reject.read_only": "Login ini dapat melihat akun tetapi tidak dapat trading.",
  "reject.uncertain.title": "Tidak ada jawaban dari server trading",
  "reject.uncertain": "Order mungkin sudah terkirim. Periksa Portofolio sebelum mencoba lagi.",
  "reject.uncertain.ticket": "Aman untuk konfirmasi lagi: order yang sama tidak dapat dipasang dua kali.",

  // States
  "state.noAccount.title": "Belum ada akun trading",
  "state.noAccount.body": "Buka akun demo untuk berlatih, atau akun live untuk trading sungguhan.",
  "state.noAccount.action": "Buka akun",
  "state.connecting": "Menghubungkan ke server trading…",
  "state.readOnly": "Akun ini hanya-lihat di sini: harga dan grafik live, trading nonaktif.",
  "state.marketClosed.title": "Pasar tutup",
  "state.marketClosed.body": "{symbol} dibuka kembali pada sesi berikutnya. Order dapat dipasang setelah pasar buka.",
  "state.streamError": "Tidak dapat terhubung ke server trading",
  "state.streamErrorBody": "Posisi dan order Anda aman di server. Kami terus mencoba menghubungkan kembali.",

  // Results
  "toast.filled": "{side} {volume} {symbol} tereksekusi",
  "toast.at": "di {price}",
  "toast.placed": "Pending order {symbol} dipasang",
  "toast.duplicate": "Sudah dipasang sebagai #{ticket}",
  "toast.duplicateBody": "Order ini sudah sampai ke server sebelumnya; tidak ada posisi baru yang dibuka.",
  "toast.closed": "Posisi #{ticket} ditutup",
  "toast.partial": "{volume} lot dari #{ticket} ditutup",
  "toast.modified": "#{ticket} diperbarui",
  "toast.cancelled": "Order #{ticket} dibatalkan",

  // Engine notifications while the app is open
  "notify.sl": "Stop loss tersentuh",
  "notify.tp": "Take profit tersentuh",
  "notify.order_filled": "Pending order tereksekusi",
  "notify.order_triggered": "Order terpicu",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Order ditolak",
  "notify.order_expired": "Order kedaluwarsa",
  "notify.order_cancelled": "Order dibatalkan",
};
export default mobileTrade;
