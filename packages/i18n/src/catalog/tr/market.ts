import type { NsMessages } from "../../core";

// Kalks Trader left panels: Piyasa Gözlemi (quotes list), segment chips and Gezgin.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Piyasa Gözlemi",
  collapse: "Daralt",
  "tab.symbols": "Semboller",
  "tab.details": "Ayrıntılar",
  "tab.favourites": "Favoriler",
  segmentAria: "Piyasa Gözlemi segmenti",
  searchPlaceholder: "Sembol ara",
  searchAria: "Piyasa Gözleminde ara",
  clear: "Temizle",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Sembol",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, puan",
  "col.change": "Değ%",

  // Row / hover card
  "row.title": "{name} · spread {spread}",
  "tip.low": "D", // Düşük
  "tip.high": "Y", // Yüksek
  "tip.spread": "Sprd",
  "tip.range": "Aral.",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "Henüz favori yok. Eklemek için bir sembole sağ tıklayın.",
  "empty.noMatch": "Eşleşen sembol yok.",
  "footer.count": "{shown} / {total} sembol",
  "footer.hint": "çift tık: grafik",

  // Context menu
  "menu.newOrder": "Yeni Emir",
  "menu.chartWindow": "Grafik Penceresi",
  "menu.openInActive": "Aktif grafikte aç",
  "menu.depth": "Piyasa Derinliği",
  "menu.specification": "Özellikler",
  "menu.removeFavourite": "Favorilerden kaldır",
  "menu.addFavourite": "Favorilere ekle",
  "menu.hide": "Gizle",
  "menu.showAll": "Tümünü Göster",

  // Toasts
  "toast.hidden": "{symbol} Piyasa Gözleminden gizlendi",
  "toast.hiddenDesc": "Tüm sembolleri bağlam menüsünden gösterebilirsiniz.",
  "toast.opened": "{symbol} aktif grafikte açıldı",

  // Segment chips (asset classes)
  "segment.favourites": "Favoriler",
  "segment.forex": "Forex",
  "segment.metals": "Metaller",
  "segment.indices": "Endeksler",
  "segment.energies": "Enerji",
  "segment.crypto": "Kripto",
  "segment.stocks": "Hisseler",
  "segment.aria": "Varlık sınıfı",
  "segment.title": { other: "{label} · {count} sembol" },

  // Navigator tree
  "nav.title": "Gezgin",
  "nav.indicators": "Göstergeler",
  "nav.strategies": "Stratejiler",
  "nav.scripts": "Scriptler",
  "nav.guest": "misafir",
  "nav.noAccount": "Henüz işlem hesabı yok",
  "nav.openAccount": "Hesap aç",
  "nav.openAccountTitle": "Kalks hesabınızı oluşturun (Müşteri Alanını açar)",
  "nav.signIn": "Giriş yap",
  "nav.signInTitle": "Müşteri Alanına giriş yapın",
  "nav.accountType.live": "gerçek",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Trend",
  "nav.category.oscillators": "Osilatörler",
  "nav.category.volatility": "Volatilite",
  "nav.category.volume": "Hacim",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · {symbol}, {tf} grafiğine eklemek için çift tıklayın veya Enter'a basın",
  "nav.strategyTitle": { other: "{server} · {login} · {count} işlem" },
  "nav.strategyRunning": "{name} zaten çalışıyor",
  "nav.strategyAttached": "{name} eklendi",
  "nav.strategyDesc": "{login} · {server} · bugünkü K/Z {pnl}",
  "nav.script.closeAll": "Tüm pozisyonları kapat",
  "nav.script.closeProfitable": "Kârdakileri kapat",
  "nav.script.closeLosing": "Zarardakileri kapat",
  "nav.script.deletePendings": "Tüm bekleyen emirleri sil",
  "nav.script.breakevenAll": "Tümünü başa baş yap (SL → giriş)",
  "nav.scriptTitle": "Mevcut hesapta çalıştırmak için çift tıklayın",
  "nav.scriptsReadOnly": "Salt okunur modda scriptler devre dışıdır",
};
export default market;
