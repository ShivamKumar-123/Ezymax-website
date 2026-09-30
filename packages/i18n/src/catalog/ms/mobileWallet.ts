import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Phone-only strings; the rest
// reuses the `wallet` and `common` namespaces.
// Brand and network names stay as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Tersedia",
  "balance.otherAssets": "Aset lain",

  // Copy / share / paste controls
  copyAddress: "Salin alamat",
  share: "Kongsi",
  paste: "Tampal",
  tokenContract: "Kontrak token",
  viewOnExplorer: "Lihat di penjelajah",
  keep: "Kekalkan",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Min {min} USDT · {count} pengesahan",
  "network.networkFee": "Yuran rangkaian {fee} USDT",
  "network.noNetworkFee": "Tiada yuran rangkaian",
  "network.paused": "Dijeda buat masa ini",

  // Deposit
  "deposit.belowMin": "Deposit minimum ialah {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Permintaan {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Hantar hanya USDT {short}",
  "deposit.openWalletApp": "Buka dalam aplikasi dompet",
  "deposit.walletAppHint": "Membuka MetaMask atau aplikasi dompet lain dengan pindahan USDT ini sedia untuk diluluskan.",
  "deposit.noWalletApp": "Tiada aplikasi dompet pada telefon ini yang boleh membukanya. Salin alamat atau imbas kod QR sebaliknya.",
  "deposit.hashInvalid": "Hash transaksi mempunyai 64 aksara (0–9, a–f), dengan atau tanpa 0x.",
  "deposit.submitHash": "Hantar transaksi",
  "deposit.sentHelp": "Tampal hash transaksi dari dompet atau bursa anda. Kami menemuinya pada rangkaian dan mengkreditkannya secara automatik.",
  "deposit.expiredHelp": "Permintaan ini telah tamat tempoh. Jika anda sudah menghantar USDT, hantar hash transaksi di bawah; jika tidak, mulakan deposit baharu.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Dikreditkan ke dompet anda dalam {currency}",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "Hantar dari dompet atau bursa anda",
  "how.sendText": "Salin alamat atau imbas kod QR. Pada BNB Chain, satu ketikan membuka MetaMask dengan pindahan yang sedia.",
  "how.hashTitle": "Tampal hash transaksi",
  "how.hashText": "Kami mengesahkannya pada rangkaian dan mengkreditkannya selepas {bsc} pengesahan pada BNB Chain atau {tron} pada TRON.",

  // Withdraw
  "withdraw.available": "Tersedia untuk dikeluarkan",
  "withdraw.belowMin": "Pengeluaran minimum ialah {min} USDT.",
  "withdraw.aboveMax": "Maksimum setiap pengeluaran ialah {max} USDT.",
  "withdraw.paused": "Pengeluaran dijeda buat masa ini. Sila cuba lagi kemudian atau hubungi sokongan.",
  "withdraw.cancelAction": "Batalkan pengeluaran",
  "withdraw.cancelConfirm": "Batalkan pengeluaran ini? Jumlahnya akan dikembalikan ke baki tersedia anda.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Alamat {network} yang sah",
  "address.checksum": "Alamat ini mempunyai kesilapan taip: checksumnya tidak sepadan. Tampalkannya semula dari dompet anda.",
  "address.otherNetwork": "Alamat ini berada pada rangkaian lain. Masukkan alamat {network} ({short}), atau tukar rangkaian di atas.",
  "address.contract": "Ini ialah kontrak token USDT, bukan dompet. Masukkan alamat dompet anda sendiri.",

  // Email code confirmation sheet
  "stepup.willEmail": "Kami akan menghantar kod 6 digit ke e-mel anda untuk pengesahan. Tiada apa-apa dihantar sehingga anda memasukkannya.",
  "stepup.sendCode": "E-melkan kod kepada saya",
  "stepup.codeLabel": "Kod 6 digit",

  // Transfer
  "transfer.eyebrow": "Dompet ↔ akaun",
  "transfer.swap": "Tukar arah",
  "transfer.freeMargin": "Margin bebas",
  "transfer.marginLevel": "Tahap margin",
  // {amount} is in USD
  "transfer.overWithdrawable": "Sehingga {amount} USD boleh dikeluarkan dari akaun ini sekarang (dagangan terbuka mengekalkan marginnya).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "Diterima sebagai {amount}",
  "transfer.arrives": "Diterima",
  "transfer.confirmTitle": "Sahkan pindahan",
  "transfer.confirm": "Sahkan pindahan",

  // Transaction detail sheet
  "detail.confirmations": "Pengesahan",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Nota",
  "detail.reason": "Sebab",
  "detail.reference": "Rujukan",

  "error.staffReadOnly": "Ini ialah sesi kakitangan baca sahaja. Perubahan tidak dibenarkan.",
};
export default mobileWallet;
