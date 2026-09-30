import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (phone-only strings; the rest reuse the `wallet` and `common` namespaces).
// Brand and network names stay as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "கிடைப்பது",
  "balance.otherAssets": "பிற சொத்துகள்",

  // Copy / share / paste controls
  copyAddress: "முகவரியை நகலெடு",
  share: "பகிர்",
  paste: "ஒட்டு",
  tokenContract: "டோக்கன் கான்ட்ராக்ட்",
  viewOnExplorer: "எக்ஸ்ப்ளோரரில் காண்க",
  keep: "வைத்திரு",

  // Network picker (deposit / withdraw)
  "network.depositDetail": "குறைந்தபட்சம் {min} USDT · {count} உறுதிப்படுத்தல்கள்",
  "network.networkFee": "நெட்வொர்க் கட்டணம் {fee} USDT",
  "network.noNetworkFee": "நெட்வொர்க் கட்டணம் இல்லை",
  "network.paused": "தற்போது நிறுத்தப்பட்டுள்ளது",

  // Deposit
  "deposit.belowMin": "குறைந்தபட்ச டெபாசிட் {min} USDT.",
  "deposit.request": "கோரிக்கை {id}",
  "deposit.onlyUsdt": "USDT {short} ஐ மட்டும் அனுப்புங்கள்",
  "deposit.openWalletApp": "வாலட் ஆப்பில் திற",
  "deposit.walletAppHint": "அங்கீகரிக்கத் தயாரான இந்த USDT பரிமாற்றத்துடன் MetaMask அல்லது வேறு வாலட் ஆப்பைத் திறக்கும்.",
  "deposit.noWalletApp": "இந்த ஃபோனில் உள்ள எந்த வாலட் ஆப்பாலும் இதைத் திறக்க முடியவில்லை. பதிலாக முகவரியை நகலெடுங்கள் அல்லது QR குறியீட்டை ஸ்கேன் செய்யுங்கள்.",
  "deposit.hashInvalid": "பரிவர்த்தனை ஹாஷில் 64 எழுத்துகள் (0–9, a–f) இருக்கும், 0x உடன் அல்லது இல்லாமல்.",
  "deposit.submitHash": "பரிவர்த்தனையைச் சமர்ப்பி",
  "deposit.sentHelp": "உங்கள் வாலட் அல்லது எக்ஸ்சேஞ்சிலிருந்து பரிவர்த்தனை ஹாஷை ஒட்டுங்கள். அதை நெட்வொர்க்கில் கண்டறிந்து தானாக வரவு வைப்போம்.",
  "deposit.expiredHelp": "இந்தக் கோரிக்கை காலாவதியானது. ஏற்கனவே USDT அனுப்பியிருந்தால், கீழே பரிவர்த்தனை ஹாஷைச் சமர்ப்பியுங்கள்; இல்லையெனில் புதிய டெபாசிட்டைத் தொடங்குங்கள்.",
  "deposit.creditedBody": "உங்கள் வாலட்டில் {currency} ஆக வரவு வைக்கப்பட்டது",
  // How deposits work on the phone (steps 2 and 3)
  "how.sendTitle": "உங்கள் வாலட் அல்லது எக்ஸ்சேஞ்சிலிருந்து அனுப்புங்கள்",
  "how.sendText": "முகவரியை நகலெடுங்கள் அல்லது QR குறியீட்டை ஸ்கேன் செய்யுங்கள். BNB Chain இல், ஒரே தட்டலில் பரிமாற்றம் தயாராக MetaMask திறக்கும்.",
  "how.hashTitle": "பரிவர்த்தனை ஹாஷை ஒட்டுங்கள்",
  "how.hashText": "அதை நெட்வொர்க்கில் சரிபார்த்து, BNB Chain இல் {bsc} அல்லது TRON இல் {tron} உறுதிப்படுத்தல்களுக்குப் பிறகு வரவு வைப்போம்.",

  // Withdraw
  "withdraw.available": "எடுக்கக் கிடைப்பது",
  "withdraw.belowMin": "குறைந்தபட்சப் பணம் எடுத்தல் {min} USDT.",
  "withdraw.aboveMax": "ஒரு முறைக்கு அதிகபட்சப் பணம் எடுத்தல் {max} USDT.",
  "withdraw.paused": "பணம் எடுத்தல்கள் தற்போது நிறுத்தப்பட்டுள்ளன. பின்னர் மீண்டும் முயலவும் அல்லது உதவிக் குழுவைத் தொடர்புகொள்ளவும்.",
  "withdraw.cancelAction": "பணம் எடுத்தலை ரத்துசெய்",
  "withdraw.cancelConfirm": "இந்தப் பணம் எடுத்தலை ரத்துசெய்யவா? தொகை உங்கள் கிடைக்கும் பேலன்ஸுக்குத் திரும்பும்.",

  // Destination address checks
  "address.valid": "சரியான {network} முகவரி",
  "address.checksum": "இந்த முகவரியில் எழுத்துப் பிழை உள்ளது: அதன் செக்சம் பொருந்தவில்லை. உங்கள் வாலட்டிலிருந்து மீண்டும் ஒட்டுங்கள்.",
  "address.otherNetwork": "இந்த முகவரி வேறு நெட்வொர்க்கில் உள்ளது. {network} ({short}) முகவரியை உள்ளிடவும், அல்லது மேலே நெட்வொர்க்கை மாற்றவும்.",
  "address.contract": "இது USDT டோக்கன் கான்ட்ராக்ட், வாலட் அல்ல. உங்கள் சொந்த வாலட் முகவரியை உள்ளிடவும்.",

  // Email code confirmation sheet
  "stepup.willEmail": "உறுதிப்படுத்த 6 இலக்கக் குறியீட்டை மின்னஞ்சலில் அனுப்புவோம். நீங்கள் அதை உள்ளிடும் வரை எதுவும் அனுப்பப்படாது.",
  "stepup.sendCode": "குறியீட்டை மின்னஞ்சலில் அனுப்பு",
  "stepup.codeLabel": "6 இலக்கக் குறியீடு",

  // Transfer
  "transfer.eyebrow": "வாலட் ↔ கணக்குகள்",
  "transfer.swap": "திசையை மாற்று",
  "transfer.freeMargin": "ஃப்ரீ மார்ஜின்",
  "transfer.marginLevel": "மார்ஜின் லெவல்",
  "transfer.overWithdrawable": "இப்போது இந்தக் கணக்கிலிருந்து {amount} USD வரை வெளியே மாற்றலாம் (திறந்த டிரேடுகள் அவற்றின் மார்ஜினை வைத்திருக்கும்).",
  "transfer.arrivesAs": "{amount} ஆக வந்துசேரும்",
  "transfer.arrives": "வந்துசேரும்",
  "transfer.confirmTitle": "பரிமாற்றத்தை உறுதிப்படுத்துங்கள்",
  "transfer.confirm": "பரிமாற்றத்தை உறுதிப்படுத்து",

  // Transaction detail sheet
  "detail.confirmations": "உறுதிப்படுத்தல்கள்",
  "detail.note": "குறிப்பு",
  "detail.reason": "காரணம்",
  "detail.reference": "குறிப்பு எண்",

  "error.staffReadOnly": "இது படிக்க-மட்டும் ஊழியர் அமர்வு. மாற்றங்கள் அனுமதிக்கப்படாது.",
};
export default mobileWallet;
