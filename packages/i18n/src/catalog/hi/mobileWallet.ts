import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is reused from
// the `wallet` and `common` namespaces; these are the phone-only strings.
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "उपलब्ध",
  "balance.otherAssets": "अन्य एसेट",

  // Copy / share / paste controls
  copyAddress: "पता कॉपी करें",
  share: "शेयर करें",
  paste: "पेस्ट करें",
  tokenContract: "टोकन कॉन्ट्रैक्ट",
  viewOnExplorer: "एक्सप्लोरर पर देखें",
  keep: "रहने दें",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "न्यूनतम {min} USDT · {count} पुष्टियाँ",
  "network.networkFee": "नेटवर्क शुल्क {fee} USDT",
  "network.noNetworkFee": "कोई नेटवर्क शुल्क नहीं",
  "network.paused": "अभी रोका गया है",

  // Deposit
  "deposit.belowMin": "न्यूनतम जमा {min} USDT है।",
  // {id} is the first characters of the deposit request id
  "deposit.request": "अनुरोध {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "केवल USDT {short} भेजें",
  "deposit.openWalletApp": "वॉलेट ऐप में खोलें",
  "deposit.walletAppHint": "MetaMask या कोई दूसरा वॉलेट ऐप खोलता है, जिसमें यह USDT ट्रांसफ़र अप्रूव करने के लिए तैयार रहता है।",
  "deposit.noWalletApp": "इस फ़ोन का कोई वॉलेट ऐप इसे नहीं खोल सकता। इसकी जगह पता कॉपी करें या QR कोड स्कैन करें।",
  "deposit.hashInvalid": "ट्रांज़ैक्शन हैश में 64 अक्षर (0–9, a–f) होते हैं, 0x के साथ या उसके बिना।",
  "deposit.submitHash": "ट्रांज़ैक्शन सबमिट करें",
  "deposit.sentHelp": "अपने वॉलेट या एक्सचेंज से ट्रांज़ैक्शन हैश पेस्ट करें। हम इसे नेटवर्क पर ढूँढकर अपने-आप क्रेडिट कर देते हैं।",
  "deposit.expiredHelp": "यह अनुरोध एक्सपायर हो गया है। अगर आप USDT भेज चुके हैं, तो नीचे ट्रांज़ैक्शन हैश सबमिट करें; नहीं तो नई जमा शुरू करें।",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "आपके वॉलेट में {currency} में क्रेडिट हुआ",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "अपने वॉलेट या एक्सचेंज से भेजें",
  "how.sendText": "पता कॉपी करें या QR कोड स्कैन करें। BNB Chain पर, एक टैप में MetaMask तैयार ट्रांसफ़र के साथ खुल जाता है।",
  "how.hashTitle": "ट्रांज़ैक्शन हैश पेस्ट करें",
  "how.hashText": "हम इसे नेटवर्क पर वेरिफ़ाई करते हैं और BNB Chain पर {bsc} या TRON पर {tron} पुष्टियों के बाद क्रेडिट करते हैं।",

  // Withdraw
  "withdraw.available": "निकासी के लिए उपलब्ध",
  "withdraw.belowMin": "न्यूनतम निकासी {min} USDT है।",
  "withdraw.aboveMax": "प्रति निकासी अधिकतम {max} USDT है।",
  "withdraw.paused": "निकासी अभी रोकी गई है। कृपया बाद में कोशिश करें या सहायता टीम से संपर्क करें।",
  "withdraw.cancelAction": "निकासी रद्द करें",
  "withdraw.cancelConfirm": "यह निकासी रद्द करें? राशि आपके उपलब्ध बैलेंस में वापस आ जाएगी।",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "मान्य {network} पता",
  "address.checksum": "इस पते में टाइपिंग की गलती है: इसका चेकसम मेल नहीं खाता। इसे अपने वॉलेट से फिर से पेस्ट करें।",
  "address.otherNetwork": "यह पता किसी दूसरे नेटवर्क का है। {network} ({short}) पता डालें, या ऊपर नेटवर्क बदलें।",
  "address.contract": "यह USDT टोकन कॉन्ट्रैक्ट है, वॉलेट नहीं। अपने वॉलेट का पता डालें।",

  // Email code confirmation sheet
  "stepup.willEmail": "पुष्टि के लिए हम आपको 6-अंकों का कोड ईमेल करते हैं। कोड डालने तक कुछ नहीं भेजा जाता।",
  "stepup.sendCode": "मुझे कोड ईमेल करें",
  "stepup.codeLabel": "6-अंकों का कोड",

  // Transfer
  "transfer.eyebrow": "वॉलेट ↔ अकाउंट",
  "transfer.swap": "दिशा बदलें",
  "transfer.freeMargin": "फ़्री मार्जिन",
  "transfer.marginLevel": "मार्जिन लेवल",
  // {amount} is in USD
  "transfer.overWithdrawable": "इस अकाउंट से अभी {amount} USD तक निकल सकते हैं (खुले ट्रेड का मार्जिन बना रहता है)।",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "{amount} के रूप में पहुँचेगा",
  "transfer.arrives": "पहुँचेगा",
  "transfer.confirmTitle": "ट्रांसफ़र की पुष्टि करें",
  "transfer.confirm": "ट्रांसफ़र की पुष्टि करें",

  // Transaction detail sheet
  "detail.confirmations": "पुष्टियाँ",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "नोट",
  "detail.reason": "कारण",
  "detail.reference": "रेफ़रेंस",

  "error.staffReadOnly": "यह केवल-देखने वाला स्टाफ़ सेशन है। बदलाव की अनुमति नहीं है।",
};
export default mobileWallet;
