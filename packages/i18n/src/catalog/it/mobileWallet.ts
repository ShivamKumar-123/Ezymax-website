import type { NsMessages } from "../../core";

// App mobile Kalks: schermate wallet (panoramica, deposito, prelievo, trasferimento, cronologia). Gran parte dei testi
// riusa `wallet` e `common`. Nomi di brand e reti invariati: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Intestazione della panoramica: piccola riga in maiuscolo sopra il titolo
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Disponibile",
  "balance.otherAssets": "Altri asset",

  // Copia / condividi / incolla
  copyAddress: "Copia indirizzo",
  share: "Condividi",
  paste: "Incolla",
  tokenContract: "Contratto del token",
  viewOnExplorer: "Vedi sull'explorer",
  keep: "Mantieni",

  // Selettore di rete; {min} è un importo, {count} un numero di conferme
  "network.depositDetail": "Min {min} USDT · {count} conferme",
  "network.networkFee": "Commissione di rete {fee} USDT",
  "network.noNetworkFee": "Nessuna commissione di rete",
  "network.paused": "Sospesa al momento",

  // Deposito
  "deposit.belowMin": "Il deposito minimo è di {min} USDT.",
  // {id} sono i primi caratteri dell'id della richiesta di deposito
  "deposit.request": "Richiesta {id}",
  // Titolo del banner sopra l'avviso di rete; {short} è BEP20 o TRC20
  "deposit.onlyUsdt": "Invia solo USDT {short}",
  "deposit.openWalletApp": "Apri nell'app wallet",
  "deposit.walletAppHint": "Apre MetaMask o un'altra app wallet con questo trasferimento USDT pronto da approvare.",
  "deposit.noWalletApp": "Nessuna app wallet su questo telefono può aprirlo. Copia l'indirizzo o scansiona il codice QR.",
  "deposit.hashInvalid": "Un hash di transazione ha 64 caratteri (0–9, a–f), con o senza 0x.",
  "deposit.submitHash": "Invia transazione",
  "deposit.sentHelp": "Incolla l'hash della transazione dal tuo wallet o exchange. Lo troviamo sulla rete e lo accreditiamo automaticamente.",
  "deposit.expiredHelp": "Questa richiesta è scaduta. Se hai già inviato gli USDT, inserisci l'hash della transazione qui sotto; altrimenti avvia un nuovo deposito.",
  // Sotto l'importo accreditato; {currency} è USDT
  "deposit.creditedBody": "Accreditato sul tuo wallet in {currency}",
  // Come funzionano i depositi sul telefono (passaggi 2 e 3)
  "how.sendTitle": "Invia dal tuo wallet o exchange",
  "how.sendText": "Copia l'indirizzo o scansiona il codice QR. Su BNB Chain, un tocco apre MetaMask con il trasferimento pronto.",
  "how.hashTitle": "Incolla l'hash della transazione",
  "how.hashText": "Lo verifichiamo sulla rete e lo accreditiamo dopo {bsc} conferme su BNB Chain o {tron} su TRON.",

  // Prelievo
  "withdraw.available": "Disponibile per il prelievo",
  "withdraw.belowMin": "Il prelievo minimo è di {min} USDT.",
  "withdraw.aboveMax": "Il massimo per prelievo è di {max} USDT.",
  "withdraw.paused": "I prelievi sono sospesi al momento. Riprova più tardi o contatta l'assistenza.",
  "withdraw.cancelAction": "Annulla prelievo",
  "withdraw.cancelConfirm": "Annullare questo prelievo? L'importo torna nel tuo saldo disponibile.",

  // Controlli sull'indirizzo di destinazione; {network} è il nome della rete, {short} BEP20 / TRC20
  "address.valid": "Indirizzo {network} valido",
  "address.checksum": "Questo indirizzo contiene un errore: il checksum non corrisponde. Incollalo di nuovo dal tuo wallet.",
  "address.otherNetwork": "Questo indirizzo è su un'altra rete. Inserisci un indirizzo {network} ({short}) oppure cambia la rete qui sopra.",
  "address.contract": "Questo è il contratto del token USDT, non un wallet. Inserisci l'indirizzo del tuo wallet.",

  // Conferma con codice via email
  "stepup.willEmail": "Ti inviamo via email un codice di 6 cifre per confermare. Nulla viene inviato finché non lo inserisci.",
  "stepup.sendCode": "Inviami il codice",
  "stepup.codeLabel": "Codice di 6 cifre",

  // Trasferimento
  "transfer.eyebrow": "Wallet ↔ conti",
  "transfer.swap": "Inverti direzione",
  "transfer.freeMargin": "Margine libero",
  "transfer.marginLevel": "Livello di margine",
  // {amount} è in USD
  "transfer.overWithdrawable": "Ora possono uscire da questo conto fino a {amount} USD (le operazioni aperte mantengono il loro margine).",
  // {amount} è ad es. "USC 10,000.00"
  "transfer.arrivesAs": "Arriva come {amount}",
  "transfer.arrives": "Arrivo",
  "transfer.confirmTitle": "Conferma trasferimento",
  "transfer.confirm": "Conferma trasferimento",

  // Dettaglio della transazione
  "detail.confirmations": "Conferme",
  // Etichetta di una nota del Back Office su una rettifica o altro accredito
  "detail.note": "Nota",
  "detail.reason": "Motivo",
  "detail.reference": "Riferimento",

  "error.staffReadOnly": "Questa è una sessione staff in sola lettura. Le modifiche non sono consentite.",
};
export default mobileWallet;
