import type { NsMessages } from "../../core";

// Kalks mobile app: wallet screens (phone-only strings; the rest reuse `wallet` and `common`).
// Brand and network names stay as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Inapatikana",
  "balance.otherAssets": "Mali nyingine",

  // Copy / share / paste controls
  copyAddress: "Nakili anwani",
  share: "Shiriki",
  paste: "Bandika",
  tokenContract: "Mkataba wa tokeni",
  viewOnExplorer: "Tazama kwenye explorer",
  keep: "Uache",

  // Network picker (deposit / withdraw)
  "network.depositDetail": "Chini {min} USDT · uthibitisho {count}",
  "network.networkFee": "Ada ya mtandao {fee} USDT",
  "network.noNetworkFee": "Hakuna ada ya mtandao",
  "network.paused": "Imesitishwa kwa sasa",

  // Deposit
  "deposit.belowMin": "Uwekaji wa chini ni {min} USDT.",
  "deposit.request": "Ombi {id}",
  "deposit.onlyUsdt": "Tuma USDT {short} pekee",
  "deposit.openWalletApp": "Fungua kwenye programu ya pochi",
  "deposit.walletAppHint": "Hufungua MetaMask au programu nyingine ya pochi na uhamisho huu wa USDT ukiwa tayari kuidhinishwa.",
  "deposit.noWalletApp": "Hakuna programu ya pochi kwenye simu hii inayoweza kuufungua. Nakili anwani au changanua msimbo wa QR badala yake.",
  "deposit.hashInvalid": "Hash ya muamala ina herufi 64 (0–9, a–f), ikiwa na au bila 0x.",
  "deposit.submitHash": "Wasilisha muamala",
  "deposit.sentHelp": "Bandika hash ya muamala kutoka pochi yako au soko la kubadilishana. Tunaupata kwenye mtandao na kuuweka kiotomatiki.",
  "deposit.expiredHelp": "Ombi hili limeisha muda. Ikiwa tayari umetuma USDT, wasilisha hash ya muamala hapa chini; vinginevyo anzisha uwekaji mpya.",
  "deposit.creditedBody": "Imewekwa kwenye pochi yako kwa {currency}",
  // How deposits work on the phone (steps 2 and 3)
  "how.sendTitle": "Tuma kutoka pochi yako au soko la kubadilishana",
  "how.sendText": "Nakili anwani au changanua msimbo wa QR. Kwenye BNB Chain, mguso mmoja hufungua MetaMask na uhamisho ukiwa tayari.",
  "how.hashTitle": "Bandika hash ya muamala",
  "how.hashText": "Tunauthibitisha kwenye mtandao na kuuweka baada ya uthibitisho {bsc} kwenye BNB Chain au {tron} kwenye TRON.",

  // Withdraw
  "withdraw.available": "Inapatikana kutoa",
  "withdraw.belowMin": "Utoaji wa chini ni {min} USDT.",
  "withdraw.aboveMax": "Kiwango cha juu kwa kila utoaji ni {max} USDT.",
  "withdraw.paused": "Utoaji umesitishwa kwa sasa. Tafadhali jaribu tena baadaye au wasiliana na msaada.",
  "withdraw.cancelAction": "Ghairi utoaji",
  "withdraw.cancelConfirm": "Ghairi utoaji huu? Kiasi kitarudi kwenye salio lako linalopatikana.",

  // Destination address checks
  "address.valid": "Anwani sahihi ya {network}",
  "address.checksum": "Anwani hii ina kosa la uchapaji: checksum yake hailingani. Ibandike tena kutoka pochi yako.",
  "address.otherNetwork": "Anwani hii iko kwenye mtandao mwingine. Weka anwani ya {network} ({short}), au badilisha mtandao hapo juu.",
  "address.contract": "Huu ni mkataba wa tokeni ya USDT, si pochi. Weka anwani ya pochi yako mwenyewe.",

  // Email code confirmation sheet
  "stepup.willEmail": "Tunakutumia msimbo wa tarakimu 6 kwa barua pepe ili uthibitishe. Hakuna kinachotumwa hadi uuweke.",
  "stepup.sendCode": "Nitumie msimbo kwa barua pepe",
  "stepup.codeLabel": "Msimbo wa tarakimu 6",

  // Transfer
  "transfer.eyebrow": "Pochi ↔ akaunti",
  "transfer.swap": "Badilisha mwelekeo",
  "transfer.freeMargin": "Margin huru",
  "transfer.marginLevel": "Kiwango cha margin",
  "transfer.overWithdrawable": "Hadi {amount} USD zinaweza kutoka kwenye akaunti hii sasa (biashara zilizo wazi hubaki na margin yake).",
  "transfer.arrivesAs": "Inafika kama {amount}",
  "transfer.arrives": "Inafika",
  "transfer.confirmTitle": "Thibitisha uhamisho",
  "transfer.confirm": "Thibitisha uhamisho",

  // Transaction detail sheet
  "detail.confirmations": "Uthibitisho",
  "detail.note": "Dokezo",
  "detail.reason": "Sababu",
  "detail.reference": "Marejeo",

  "error.staffReadOnly": "Hiki ni kipindi cha wafanyakazi cha kusoma tu. Mabadiliko hayaruhusiwi.",
};
export default mobileWallet;
