import type { NsMessages } from "../../core";

// Ezymex Trader left panels: Pemerhatian Pasaran (Market Watch), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Pemerhatian Pasaran",
  collapse: "Runtuhkan",
  "tab.symbols": "Simbol",
  "tab.details": "Butiran",
  "tab.favourites": "Kegemaran",
  segmentAria: "Segmen Pemerhatian Pasaran",
  searchPlaceholder: "Cari simbol",
  searchAria: "Cari dalam Pemerhatian Pasaran",
  clear: "Kosongkan",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Simbol",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, mata",
  "col.change": "Ubah%",

  // Row / hover card
  "row.title": "{name} · spread {spread}",
  "tip.low": "R",
  "tip.high": "T",
  "tip.spread": "Sprd",
  "tip.range": "Julat",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "Belum ada kegemaran. Klik kanan pada simbol untuk menambahnya.",
  "empty.favouritesTitle": "Belum ada kegemaran",
  "empty.noMatch": "Tiada simbol yang sepadan.",
  "footer.count": "{shown} / {total} simbol",
  "footer.hint": "dwiklik: carta",

  // Context menu
  "menu.newOrder": "Pesanan Baharu",
  "menu.chartWindow": "Tetingkap Carta",
  "menu.openInActive": "Buka dalam carta aktif",
  "menu.depth": "Kedalaman Pasaran",
  "menu.specification": "Spesifikasi",
  "menu.removeFavourite": "Alih keluar daripada Kegemaran",
  "menu.addFavourite": "Tambah ke Kegemaran",
  "menu.hide": "Sembunyi",
  "menu.showAll": "Tunjuk Semua",

  // Toasts
  "toast.hidden": "{symbol} disembunyikan daripada Pemerhatian Pasaran",
  "toast.hiddenDesc": "Tunjuk semua simbol daripada menu konteks.",
  "toast.opened": "{symbol} dibuka dalam carta aktif",

  // Segment chips (asset classes)
  "segment.favourites": "Kegemaran",
  "segment.forex": "Forex",
  "segment.metals": "Logam",
  "segment.indices": "Indeks",
  "segment.energies": "Tenaga",
  "segment.crypto": "Kripto",
  "segment.stocks": "Saham",
  "segment.aria": "Kelas aset",
  "segment.title": { other: "{label} · {count} simbol" },

  // Navigator tree
  "nav.title": "Navigator",
  "nav.indicators": "Penunjuk",
  "nav.strategies": "Strategi",
  "nav.scripts": "Skrip",
  "nav.guest": "tetamu",
  "nav.noAccount": "Belum ada akaun dagangan",
  "nav.openAccount": "Buka akaun",
  "nav.openAccountTitle": "Cipta akaun Ezymex anda (membuka Kawasan Pelanggan)",
  "nav.signIn": "Log masuk",
  "nav.signInTitle": "Log masuk ke Kawasan Pelanggan",
  "nav.accountType.live": "sebenar",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Trend",
  "nav.category.oscillators": "Pengayun",
  "nav.category.volatility": "Kemeruapan",
  "nav.category.volume": "Volum",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Dwiklik atau Enter untuk memasang pada {symbol}, {tf}",
  "nav.strategyTitle": { other: "{server} · {login} · {count} dagangan" },
  "nav.strategyRunning": "{name} sudah berjalan",
  "nav.strategyAttached": "{name} dipasang",
  "nav.strategyDesc": "{login} · {server} · U/R hari ini {pnl}",
  "nav.script.closeAll": "Tutup semua posisi",
  "nav.script.closeProfitable": "Tutup yang untung",
  "nav.script.closeLosing": "Tutup yang rugi",
  "nav.script.deletePendings": "Padam semua pesanan belum selesai",
  "nav.script.breakevenAll": "Pulang modal semua (SL → harga masuk)",
  "nav.scriptTitle": "Dwiklik untuk menjalankan pada akaun semasa",
  "nav.scriptsReadOnly": "Skrip dilumpuhkan dalam mod baca sahaja",
};
export default market;
