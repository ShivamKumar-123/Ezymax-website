import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is reused from
// the `wallet` and `common` namespaces; these are the phone-only strings. Brand and network names stay as they are.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "利用可能",
  "balance.otherAssets": "その他の資産",

  // Copy / share / paste controls
  copyAddress: "アドレスをコピー",
  share: "共有",
  paste: "貼り付け",
  tokenContract: "トークンコントラクト",
  viewOnExplorer: "エクスプローラーで表示",
  keep: "キャンセルしない",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "最低 {min} USDT · {count}承認",
  "network.networkFee": "ネットワーク手数料 {fee} USDT",
  "network.noNetworkFee": "ネットワーク手数料なし",
  "network.paused": "一時停止中",

  // Deposit
  "deposit.belowMin": "最低入金額は {min} USDT です。",
  // {id} is the first characters of the deposit request id
  "deposit.request": "リクエスト {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "USDT {short}のみを送金",
  "deposit.openWalletApp": "ウォレットアプリで開く",
  "deposit.walletAppHint": "MetaMaskなどのウォレットアプリが、このUSDT送金を承認できる状態で開きます。",
  "deposit.noWalletApp": "この端末には対応するウォレットアプリがありません。代わりにアドレスをコピーするか、QRコードをスキャンしてください。",
  "deposit.hashInvalid": "トランザクションハッシュは64文字（0–9、a–f）です。0xの有無は問いません。",
  "deposit.submitHash": "トランザクションを送信",
  "deposit.sentHelp": "ウォレットまたは取引所からトランザクションハッシュを貼り付けてください。ネットワーク上で検出し、自動的に反映します。",
  "deposit.expiredHelp": "このリクエストは期限切れです。USDTを送金済みの場合は、下からトランザクションハッシュを送信してください。未送金の場合は、新しい入金を開始してください。",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "{currency}でウォレットに反映されました",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "ウォレットまたは取引所から送金",
  "how.sendText": "アドレスをコピーするか、QRコードをスキャンしてください。BNB Chainでは、ワンタップで送金を準備した状態のMetaMaskが開きます。",
  "how.hashTitle": "トランザクションハッシュを貼り付け",
  "how.hashText": "ネットワーク上で確認し、BNB Chainでは{bsc}回、TRONでは{tron}回の承認後に反映します。",

  // Withdraw
  "withdraw.available": "出金可能額",
  "withdraw.belowMin": "最低出金額は {min} USDT です。",
  "withdraw.aboveMax": "1回あたりの最大出金額は {max} USDT です。",
  "withdraw.paused": "現在、出金を一時停止しています。後ほどもう一度お試しいただくか、サポートまでお問い合わせください。",
  "withdraw.cancelAction": "出金をキャンセル",
  "withdraw.cancelConfirm": "この出金をキャンセルしますか？金額は利用可能残高に戻ります。",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "有効な{network}アドレス",
  "address.checksum": "このアドレスには入力ミスがあります（チェックサムが一致しません）。ウォレットからもう一度貼り付けてください。",
  "address.otherNetwork": "このアドレスは別のネットワークのものです。{network}（{short}）のアドレスを入力するか、上でネットワークを切り替えてください。",
  "address.contract": "これはウォレットではなく、USDTのトークンコントラクトです。ご自身のウォレットアドレスを入力してください。",

  // Email code confirmation sheet
  "stepup.willEmail": "確認用の6桁のコードをメールでお送りします。コードを入力するまで送信されません。",
  "stepup.sendCode": "コードをメールで受け取る",
  "stepup.codeLabel": "6桁のコード",

  // Transfer
  "transfer.eyebrow": "ウォレット ↔ 口座",
  "transfer.swap": "方向を入れ替え",
  "transfer.freeMargin": "余剰証拠金",
  "transfer.marginLevel": "証拠金維持率",
  // {amount} is in USD
  "transfer.overWithdrawable": "現在この口座から移動できるのは最大 {amount} USD です（保有中の取引の証拠金は維持されます）。",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "{amount}として着金",
  "transfer.arrives": "着金",
  "transfer.confirmTitle": "振替の確認",
  "transfer.confirm": "振替を確定",

  // Transaction detail sheet
  "detail.confirmations": "承認数",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "備考",
  "detail.reason": "理由",
  "detail.reference": "参照番号",

  "error.staffReadOnly": "これは閲覧専用のスタッフセッションです。変更はできません。",
};
export default mobileWallet;
