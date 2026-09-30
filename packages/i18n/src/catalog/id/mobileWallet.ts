import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (phone-only strings; the rest comes from `wallet` and `common`).
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Tersedia",
  "balance.otherAssets": "Aset lainnya",

  // Copy / share / paste controls
  copyAddress: "Salin alamat",
  share: "Bagikan",
  paste: "Tempel",
  tokenContract: "Kontrak token",
  viewOnExplorer: "Lihat di explorer",
  keep: "Pertahankan",

  // Network picker; {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Min {min} USDT · {count} konfirmasi",
  "network.networkFee": "Biaya jaringan {fee} USDT",
  "network.noNetworkFee": "Tanpa biaya jaringan",
  "network.paused": "Dijeda sementara",

  // Deposit
  "deposit.belowMin": "Deposit minimum adalah {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Permintaan {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Kirim hanya USDT {short}",
  "deposit.openWalletApp": "Buka di aplikasi dompet",
  "deposit.walletAppHint": "Membuka MetaMask atau aplikasi dompet lain dengan transfer USDT ini siap untuk disetujui.",
  "deposit.noWalletApp": "Tidak ada aplikasi dompet di ponsel ini yang dapat membukanya. Salin alamat atau pindai kode QR sebagai gantinya.",
  "deposit.hashInvalid": "Hash transaksi terdiri dari 64 karakter (0–9, a–f), dengan atau tanpa 0x.",
  "deposit.submitHash": "Kirim transaksi",
  "deposit.sentHelp": "Tempel hash transaksi dari dompet atau exchange Anda. Kami menemukannya di jaringan dan mengkreditkannya secara otomatis.",
  "deposit.expiredHelp": "Permintaan ini telah kedaluwarsa. Jika Anda sudah mengirim USDT, kirim hash transaksinya di bawah; jika belum, mulai deposit baru.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Dikreditkan ke dompet Anda dalam {currency}",
  // How deposits work on the phone (steps 2 and 3)
  "how.sendTitle": "Kirim dari dompet atau exchange Anda",
  "how.sendText": "Salin alamat atau pindai kode QR. Di BNB Chain, sekali ketuk membuka MetaMask dengan transfer yang sudah siap.",
  "how.hashTitle": "Tempel hash transaksi",
  "how.hashText": "Kami memverifikasinya di jaringan dan mengkreditkannya setelah {bsc} konfirmasi di BNB Chain atau {tron} di TRON.",

  // Withdraw
  "withdraw.available": "Tersedia untuk ditarik",
  "withdraw.belowMin": "Penarikan minimum adalah {min} USDT.",
  "withdraw.aboveMax": "Maksimum per penarikan adalah {max} USDT.",
  "withdraw.paused": "Penarikan sedang dijeda. Silakan coba lagi nanti atau hubungi dukungan.",
  "withdraw.cancelAction": "Batalkan penarikan",
  "withdraw.cancelConfirm": "Batalkan penarikan ini? Jumlahnya kembali ke saldo tersedia Anda.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Alamat {network} valid",
  "address.checksum": "Alamat ini salah ketik: checksum-nya tidak cocok. Tempel lagi dari dompet Anda.",
  "address.otherNetwork": "Alamat ini berada di jaringan lain. Masukkan alamat {network} ({short}), atau ganti jaringan di atas.",
  "address.contract": "Ini adalah kontrak token USDT, bukan dompet. Masukkan alamat dompet Anda sendiri.",

  // Email code confirmation sheet
  "stepup.willEmail": "Kami mengirim kode 6 digit ke email Anda untuk konfirmasi. Tidak ada yang dikirim sampai Anda memasukkannya.",
  "stepup.sendCode": "Kirim kode ke email saya",
  "stepup.codeLabel": "Kode 6 digit",

  // Transfer
  "transfer.eyebrow": "Dompet ↔ akun",
  "transfer.swap": "Tukar arah",
  "transfer.freeMargin": "Margin bebas",
  "transfer.marginLevel": "Level margin",
  // {amount} is in USD
  "transfer.overWithdrawable": "Hingga {amount} USD dapat dipindahkan dari akun ini sekarang (transaksi terbuka tetap memerlukan marginnya).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "Tiba sebagai {amount}",
  "transfer.arrives": "Tiba",
  "transfer.confirmTitle": "Konfirmasi transfer",
  "transfer.confirm": "Konfirmasi transfer",

  // Transaction detail sheet
  "detail.confirmations": "Konfirmasi",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Catatan",
  "detail.reason": "Alasan",
  "detail.reference": "Referensi",

  "error.staffReadOnly": "Ini adalah sesi staf hanya baca. Perubahan tidak diizinkan.",
};
export default mobileWallet;
