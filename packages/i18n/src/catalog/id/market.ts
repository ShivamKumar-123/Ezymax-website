import type { NsMessages } from "../../core";

// Ezymex Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Market Watch",
  collapse: "Ciutkan",
  "tab.symbols": "Simbol",
  "tab.details": "Detail",
  "tab.favourites": "Favorit",
  segmentAria: "Segmen Market Watch",
  searchPlaceholder: "Cari simbol",
  searchAria: "Cari di Market Watch",
  clear: "Hapus",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Simbol",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, poin",
  "col.change": "Chg%",

  // Row / hover card
  "row.title": "{name} · spread {spread}",
  "tip.low": "L",
  "tip.high": "H",
  "tip.spread": "Sprd",
  "tip.range": "Rng",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "Belum ada favorit. Klik kanan simbol untuk menambahkannya.",
  "empty.favouritesTitle": "Belum ada favorit",
  "empty.noMatch": "Tidak ada simbol yang cocok.",
  "footer.count": "{shown} / {total} simbol",
  "footer.hint": "klik ganda: grafik",

  // Context menu
  "menu.newOrder": "Order Baru",
  "menu.chartWindow": "Jendela Grafik",
  "menu.openInActive": "Buka di grafik aktif",
  "menu.depth": "Kedalaman Pasar",
  "menu.specification": "Spesifikasi",
  "menu.removeFavourite": "Hapus dari Favorit",
  "menu.addFavourite": "Tambah ke Favorit",
  "menu.hide": "Sembunyikan",
  "menu.showAll": "Tampilkan Semua",

  // Toasts
  "toast.hidden": "{symbol} disembunyikan dari Market Watch",
  "toast.hiddenDesc": "Tampilkan semua simbol dari menu konteks.",
  "toast.opened": "{symbol} dibuka di grafik aktif",

  // Segment chips (asset classes)
  "segment.favourites": "Favorit",
  "segment.forex": "Forex",
  "segment.metals": "Logam",
  "segment.indices": "Indeks",
  "segment.energies": "Energi",
  "segment.crypto": "Kripto",
  "segment.stocks": "Saham",
  "segment.aria": "Kelas aset",
  "segment.title": { other: "{label} · {count} simbol" },

  // Navigator tree
  "nav.title": "Navigator",
  "nav.indicators": "Indikator",
  "nav.strategies": "Strategi",
  "nav.scripts": "Skrip",
  "nav.guest": "tamu",
  "nav.noAccount": "Belum ada akun trading",
  "nav.openAccount": "Buka akun",
  "nav.openAccountTitle": "Buat akun Ezymex Anda (membuka Client Area)",
  "nav.signIn": "Masuk",
  "nav.signInTitle": "Masuk ke Client Area",
  "nav.accountType.live": "live",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Tren",
  "nav.category.oscillators": "Osilator",
  "nav.category.volatility": "Volatilitas",
  "nav.category.volume": "Volume",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Klik ganda atau Enter untuk memasang ke {symbol}, {tf}",
  "nav.strategyTitle": { other: "{server} · {login} · {count} transaksi" },
  "nav.strategyRunning": "{name} sudah berjalan",
  "nav.strategyAttached": "{name} terpasang",
  "nav.strategyDesc": "{login} · {server} · P&L hari ini {pnl}",
  "nav.script.closeAll": "Tutup semua posisi",
  "nav.script.closeProfitable": "Tutup yang profit",
  "nav.script.closeLosing": "Tutup yang rugi",
  "nav.script.deletePendings": "Hapus semua pending",
  "nav.script.breakevenAll": "Breakeven semua (SL → entri)",
  "nav.scriptTitle": "Klik ganda untuk menjalankan di akun saat ini",
  "nav.scriptsReadOnly": "Skrip dinonaktifkan dalam mode hanya baca",
};
export default market;
