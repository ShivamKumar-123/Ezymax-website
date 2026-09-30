import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is reused from
// the `wallet` and `common` namespaces. Brand and network names (Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON,
// MetaMask, USD, USC) stay as they are.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "ใช้ได้",
  "balance.otherAssets": "สินทรัพย์อื่น",

  // Copy / share / paste controls
  copyAddress: "คัดลอกที่อยู่",
  share: "แชร์",
  paste: "วาง",
  tokenContract: "คอนแทรกต์โทเคน",
  viewOnExplorer: "ดูบน Explorer",
  keep: "เก็บไว้",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "ขั้นต่ำ {min} USDT · ยืนยัน {count} ครั้ง",
  "network.networkFee": "ค่าธรรมเนียมเครือข่าย {fee} USDT",
  "network.noNetworkFee": "ไม่มีค่าธรรมเนียมเครือข่าย",
  "network.paused": "ระงับชั่วคราว",

  // Deposit
  "deposit.belowMin": "ฝากขั้นต่ำ {min} USDT",
  // {id} is the first characters of the deposit request id
  "deposit.request": "คำขอ {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "ส่งเฉพาะ USDT {short}",
  "deposit.openWalletApp": "เปิดในแอปวอลเล็ต",
  "deposit.walletAppHint": "เปิด MetaMask หรือแอปวอลเล็ตอื่น พร้อมรายการโอน USDT นี้ให้คุณอนุมัติ",
  "deposit.noWalletApp": "ไม่มีแอปวอลเล็ตในโทรศัพท์นี้ที่เปิดรายการนี้ได้ โปรดคัดลอกที่อยู่หรือสแกนคิวอาร์โค้ดแทน",
  "deposit.hashInvalid": "แฮชธุรกรรมมี 64 ตัวอักษร (0–9, a–f) จะมี 0x นำหน้าหรือไม่ก็ได้",
  "deposit.submitHash": "ส่งธุรกรรม",
  "deposit.sentHelp": "วางแฮชธุรกรรมจากวอลเล็ตหรือกระดานเทรดของคุณ เราจะค้นหาบนเครือข่ายและเข้าบัญชีให้อัตโนมัติ",
  "deposit.expiredHelp": "คำขอนี้หมดอายุแล้ว หากคุณส่ง USDT ไปแล้ว ให้ส่งแฮชธุรกรรมด้านล่าง หากยังไม่ได้ส่ง ให้เริ่มการฝากเงินใหม่",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "เข้าวอลเล็ตของคุณเป็น {currency} แล้ว",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "ส่งจากวอลเล็ตหรือกระดานเทรดของคุณ",
  "how.sendText": "คัดลอกที่อยู่หรือสแกนคิวอาร์โค้ด บน BNB Chain แตะครั้งเดียวจะเปิด MetaMask พร้อมรายการโอน",
  "how.hashTitle": "วางแฮชธุรกรรม",
  "how.hashText": "เราตรวจสอบบนเครือข่ายและเข้าบัญชีหลังการยืนยัน {bsc} ครั้งบน BNB Chain หรือ {tron} ครั้งบน TRON",

  // Withdraw
  "withdraw.available": "ถอนได้",
  "withdraw.belowMin": "ถอนขั้นต่ำ {min} USDT",
  "withdraw.aboveMax": "ถอนได้สูงสุด {max} USDT ต่อครั้ง",
  "withdraw.paused": "ขณะนี้ระงับการถอนเงินชั่วคราว โปรดลองอีกครั้งภายหลังหรือติดต่อฝ่ายสนับสนุน",
  "withdraw.cancelAction": "ยกเลิกการถอนเงิน",
  "withdraw.cancelConfirm": "ยกเลิกการถอนเงินนี้ใช่ไหม จำนวนเงินจะกลับเข้ายอดที่ใช้ได้ของคุณ",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "ที่อยู่ {network} ถูกต้อง",
  "address.checksum": "ที่อยู่นี้พิมพ์ผิด: checksum ไม่ตรงกัน โปรดวางใหม่จากวอลเล็ตของคุณ",
  "address.otherNetwork": "ที่อยู่นี้อยู่บนเครือข่ายอื่น โปรดกรอกที่อยู่ {network} ({short}) หรือเปลี่ยนเครือข่ายด้านบน",
  "address.contract": "นี่คือคอนแทรกต์โทเคน USDT ไม่ใช่วอลเล็ต โปรดกรอกที่อยู่วอลเล็ตของคุณเอง",

  // Email code confirmation sheet
  "stepup.willEmail": "เราจะส่งรหัส 6 หลักทางอีเมลเพื่อยืนยัน จะไม่มีการส่งเงินจนกว่าคุณจะกรอกรหัส",
  "stepup.sendCode": "ส่งรหัสทางอีเมล",
  "stepup.codeLabel": "รหัส 6 หลัก",

  // Transfer
  "transfer.eyebrow": "วอลเล็ต ↔ บัญชี",
  "transfer.swap": "สลับทิศทาง",
  "transfer.freeMargin": "ฟรีมาร์จิ้น",
  "transfer.marginLevel": "ระดับมาร์จิ้น",
  // {amount} is in USD
  "transfer.overWithdrawable": "ขณะนี้โอนออกจากบัญชีนี้ได้สูงสุด {amount} USD (เทรดที่เปิดอยู่ยังคงใช้มาร์จิ้น)",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "เข้าบัญชีเป็น {amount}",
  "transfer.arrives": "เข้าบัญชี",
  "transfer.confirmTitle": "ยืนยันการโอน",
  "transfer.confirm": "ยืนยันการโอน",

  // Transaction detail sheet
  "detail.confirmations": "การยืนยัน",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "หมายเหตุ",
  "detail.reason": "เหตุผล",
  "detail.reference": "อ้างอิง",

  "error.staffReadOnly": "นี่คือเซสชันเจ้าหน้าที่แบบอ่านอย่างเดียว ไม่สามารถเปลี่ยนแปลงข้อมูลได้",
};
export default mobileWallet;
