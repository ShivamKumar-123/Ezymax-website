import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history); phone-only strings.
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Verfügbar",
  "balance.otherAssets": "Weitere Assets",

  // Copy / share / paste controls
  copyAddress: "Adresse kopieren",
  share: "Teilen",
  paste: "Einfügen",
  tokenContract: "Token-Contract",
  viewOnExplorer: "Im Explorer ansehen",
  keep: "Behalten",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Min. {min} USDT · {count} Bestätigungen",
  "network.networkFee": "Netzwerkgebühr {fee} USDT",
  "network.noNetworkFee": "Keine Netzwerkgebühr",
  "network.paused": "Vorübergehend pausiert",

  // Deposit
  "deposit.belowMin": "Die Mindesteinzahlung beträgt {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Anfrage {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Nur USDT {short} senden",
  "deposit.openWalletApp": "In Wallet-App öffnen",
  "deposit.walletAppHint": "Öffnet MetaMask oder eine andere Wallet-App mit dieser USDT-Überweisung, bereit zur Freigabe.",
  "deposit.noWalletApp": "Keine Wallet-App auf diesem Gerät kann sie öffnen. Kopieren Sie stattdessen die Adresse oder scannen Sie den QR-Code.",
  "deposit.hashInvalid": "Ein Transaktions-Hash hat 64 Zeichen (0–9, a–f), mit oder ohne 0x.",
  "deposit.submitHash": "Transaktion einreichen",
  "deposit.sentHelp": "Fügen Sie den Transaktions-Hash aus Ihrer Wallet oder Börse ein. Wir finden die Transaktion im Netzwerk und schreiben sie automatisch gut.",
  "deposit.expiredHelp": "Diese Anfrage ist abgelaufen. Wenn Sie die USDT bereits gesendet haben, reichen Sie unten den Transaktions-Hash ein; andernfalls starten Sie eine neue Einzahlung.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Ihrer Wallet in {currency} gutgeschrieben",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "Aus Wallet oder Börse senden",
  "how.sendText": "Kopieren Sie die Adresse oder scannen Sie den QR-Code. Auf BNB Chain öffnet ein Tippen MetaMask mit der vorbereiteten Überweisung.",
  "how.hashTitle": "Transaktions-Hash einfügen",
  "how.hashText": "Wir prüfen die Transaktion im Netzwerk und schreiben sie nach {bsc} Bestätigungen auf BNB Chain oder {tron} auf TRON gut.",

  // Withdraw
  "withdraw.available": "Auszahlbar",
  "withdraw.belowMin": "Die Mindestauszahlung beträgt {min} USDT.",
  "withdraw.aboveMax": "Das Maximum pro Auszahlung beträgt {max} USDT.",
  "withdraw.paused": "Auszahlungen sind derzeit pausiert. Bitte versuchen Sie es später erneut oder wenden Sie sich an den Support.",
  "withdraw.cancelAction": "Auszahlung stornieren",
  "withdraw.cancelConfirm": "Diese Auszahlung stornieren? Der Betrag wird Ihrem verfügbaren Guthaben wieder gutgeschrieben.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Gültige Adresse auf {network}",
  "address.checksum": "Diese Adresse enthält einen Tippfehler: Die Prüfsumme stimmt nicht. Fügen Sie sie erneut aus Ihrer Wallet ein.",
  "address.otherNetwork": "Diese Adresse gehört zu einem anderen Netzwerk. Geben Sie eine Adresse auf {network} ({short}) ein oder wechseln Sie oben das Netzwerk.",
  "address.contract": "Das ist der USDT-Token-Contract, keine Wallet. Geben Sie Ihre eigene Wallet-Adresse ein.",

  // Email code confirmation sheet
  "stepup.willEmail": "Wir senden Ihnen zur Bestätigung einen 6-stelligen Code per E-Mail. Gesendet wird erst, wenn Sie ihn eingeben.",
  "stepup.sendCode": "Code per E-Mail senden",
  "stepup.codeLabel": "6-stelliger Code",

  // Transfer
  "transfer.eyebrow": "Wallet ↔ Konten",
  "transfer.swap": "Richtung tauschen",
  "transfer.freeMargin": "Freie Margin",
  "transfer.marginLevel": "Margin-Level",
  // {amount} is in USD
  "transfer.overWithdrawable": "Derzeit können bis zu {amount} USD von diesem Konto übertragen werden (offene Trades behalten ihre Margin).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "Gutschrift als {amount}",
  "transfer.arrives": "Eingang",
  "transfer.confirmTitle": "Übertrag bestätigen",
  "transfer.confirm": "Übertrag bestätigen",

  // Transaction detail sheet
  "detail.confirmations": "Bestätigungen",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Vermerk",
  "detail.reason": "Grund",
  "detail.reference": "Referenz",

  "error.staffReadOnly": "Dies ist eine schreibgeschützte Mitarbeitersitzung. Änderungen sind nicht erlaubt.",
};
export default mobileWallet;
