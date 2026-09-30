import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MT5 Malay localisation (see the `order` namespace): Henti rugi, Ambil untung.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Pilih simbol",
  searchSymbol: "Cari simbol",
  depth: "Kedalaman pasaran",
  alert: "Amaran harga",
  news: "Berita tentang {symbol}", // a header button's accessibility label
  calendar: "Kalendar ekonomi {currency}", // a header button's accessibility label, e.g. "Kalendar ekonomi EUR"
  "account.chip": "{type} · #{login}",
  "account.manage": "Urus akaun",
  "account.open": "Buka akaun",

  // Chart
  "chart.indicators": "Penunjuk",
  "chart.type.candles": "Lilin",
  "chart.type.line": "Garisan",
  "ind.ma": "Purata bergerak 20",
  "ind.ema": "MA eksponen 50",
  "ind.bb": "Bollinger Bands 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Belum ada sejarah carta untuk simbol ini",
  "chart.hint": "Cubit untuk zum · seret untuk skrol · tekan dan tahan untuk garis silang · ketik dua kali untuk set semula",

  // Sell / Buy bar and ticket
  "bar.volume": "Lot",
  "ticket.title": "Pesanan baharu",
  "ticket.confirmBuy": "Beli {volume} {symbol}",
  "ticket.confirmSell": "Jual {volume} {symbol}",
  "ticket.atMarket": "pada harga pasaran",
  "ticket.at": "pada {price}",
  "ticket.addSl": "Tambah henti rugi",
  "ticket.addTp": "Tambah ambil untung",
  "ticket.ifHit": "{money} jika tercapai",
  "ticket.required": "Margin",
  "ticket.pip": "Nilai pip",
  "ticket.after": "Bebas selepas",
  "ticket.notEnough": "Margin bebas tidak mencukupi untuk volum ini.",
  "ticket.noSpecs": "Memuatkan butiran kontrak…",
  "ticket.distance": "{n} pip jauhnya",
  "ticket.price": "Harga",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "Margin bebas anda tidak mencukupi untuk pesanan ini. Kurangkan volum atau tambah dana ke akaun ini.",
  "reject.insufficient_funds": "Margin bebas anda tidak mencukupi untuk pesanan ini. Kurangkan volum atau tambah dana ke akaun ini.",
  "reject.market_closed": "Pasaran ini ditutup buat masa ini. Cuba lagi apabila ia dibuka.",
  "reject.invalid_volume": "Gunakan volum dalam had dan langkah lot simbol ini.",
  "reject.max_lot": "Volum ini melebihi maksimum setiap pesanan untuk akaun anda.",
  "reject.close_only": "Akaun anda boleh menutup posisi tetapi tidak boleh membuka posisi baharu buat masa ini.",
  "reject.symbol_close_only": "Simbol ini boleh ditutup tetapi tidak boleh dibuka buat masa ini.",
  "reject.trading_disabled": "Dagangan dimatikan pada akaun ini. Hubungi sokongan untuk butiran.",
  "reject.symbol_halted": "Dagangan pada simbol ini dijeda. Cuba lagi kemudian.",
  "reject.requote.title": "Harga telah berubah",
  "reject.requote": "Pasaran bergerak semasa pesanan anda sedang dihantar. Semak harga baharu dan sahkan sekali lagi.",
  "reject.invalid_sl": "Henti rugi berada di sebelah harga yang salah, atau terlalu dekat dengannya.",
  "reject.invalid_tp": "Ambil untung berada di sebelah harga yang salah, atau terlalu dekat dengannya.",
  "reject.invalid_price": "Harga ini berada di sebelah pasaran yang salah untuk jenis pesanan ini.",
  "reject.off_market": "Harga ini terlalu jauh dari pasaran. Semak nilainya.",
  "reject.stale_price": "Harga untuk simbol ini dijeda seketika. Cuba lagi sebentar lagi.",
  "reject.no_price": "Tiada harga langsung untuk simbol ini buat masa ini.",
  "reject.read_only": "Log masuk ini boleh melihat akaun tetapi tidak boleh berdagang.",
  "reject.uncertain.title": "Tiada jawapan daripada pelayan dagangan",
  "reject.uncertain": "Ia mungkin telah berjaya. Semak Portfolio sebelum anda cuba lagi.",
  "reject.uncertain.ticket": "Mengesahkan sekali lagi adalah selamat: pesanan yang sama tidak boleh diletakkan dua kali.",

  // States
  "state.noAccount.title": "Belum ada akaun dagangan",
  "state.noAccount.body": "Buka akaun demo untuk berlatih, atau akaun sebenar untuk berdagang secara sebenar.",
  "state.noAccount.action": "Buka akaun",
  "state.connecting": "Menyambung ke pelayan dagangan…",
  "state.readOnly": "Akaun ini lihat sahaja di sini: harga dan carta adalah langsung, dagangan dimatikan.",
  "state.marketClosed.title": "Pasaran ditutup",
  "state.marketClosed.body": "{symbol} dibuka semula pada sesi seterusnya. Pesanan boleh diletakkan sebaik sahaja ia dibuka.",
  "state.streamError": "Tidak dapat menghubungi pelayan dagangan",
  "state.streamErrorBody": "Posisi dan pesanan anda selamat pada pelayan. Kami terus cuba menyambung semula.",

  // Results
  "toast.filled": "{side} {volume} {symbol} dilaksanakan",
  "toast.at": "pada {price}",
  "toast.placed": "Pesanan belum selesai {symbol} diletakkan",
  "toast.duplicate": "Sudah diletakkan sebagai #{ticket}",
  "toast.duplicateBody": "Pesanan ini telah sampai ke pelayan sebelum ini; tiada apa-apa yang baharu dibuka.",
  "toast.closed": "Posisi #{ticket} ditutup",
  "toast.partial": "{volume} lot daripada #{ticket} ditutup",
  "toast.modified": "#{ticket} dikemas kini",
  "toast.cancelled": "Pesanan #{ticket} dibatalkan",

  // Engine notifications while the app is open
  "notify.sl": "Henti rugi tercapai",
  "notify.tp": "Ambil untung tercapai",
  "notify.order_filled": "Pesanan belum selesai dilaksanakan",
  "notify.order_triggered": "Pesanan dicetuskan",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Pesanan ditolak",
  "notify.order_expired": "Pesanan tamat tempoh",
  "notify.order_cancelled": "Pesanan dibatalkan",
};
export default mobileTrade;
