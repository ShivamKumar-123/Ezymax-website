import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Phone-only strings; the
// rest comes from the `wallet` and `common` namespaces.
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "可用",
  "balance.otherAssets": "其他资产",

  // Copy / share / paste controls
  copyAddress: "复制地址",
  share: "分享",
  paste: "粘贴",
  tokenContract: "代币合约",
  viewOnExplorer: "在区块浏览器中查看",
  keep: "保留",

  // Network picker (deposit / withdraw)
  "network.depositDetail": "最低 {min} USDT · {count} 个确认",
  "network.networkFee": "网络手续费 {fee} USDT",
  "network.noNetworkFee": "无网络手续费",
  "network.paused": "暂停中",

  // Deposit
  "deposit.belowMin": "最低入金为 {min} USDT。",
  "deposit.request": "请求 {id}",
  "deposit.onlyUsdt": "请仅发送 USDT {short}",
  "deposit.openWalletApp": "在钱包应用中打开",
  "deposit.walletAppHint": "将打开 MetaMask 或其他钱包应用，此笔 USDT 转账已准备就绪，等待您批准。",
  "deposit.noWalletApp": "此手机上没有可以打开它的钱包应用。请改为复制地址或扫描二维码。",
  "deposit.hashInvalid": "交易哈希为 64 个字符（0–9、a–f），可带或不带 0x。",
  "deposit.submitHash": "提交交易",
  "deposit.sentHelp": "请粘贴您钱包或交易所中的交易哈希。我们会在网络上找到该笔交易并自动入账。",
  "deposit.expiredHelp": "此请求已过期。如果您已发送 USDT，请在下方提交交易哈希；否则请发起新的入金。",
  "deposit.creditedBody": "已以 {currency} 存入您的钱包",
  // How deposits work on the phone (steps 2 and 3)
  "how.sendTitle": "从您的钱包或交易所发送",
  "how.sendText": "复制地址或扫描二维码。在 BNB Chain 上，一键即可打开 MetaMask 并准备好转账。",
  "how.hashTitle": "粘贴交易哈希",
  "how.hashText": "我们会在网络上核实，并在 BNB Chain 上获得 {bsc} 个确认或在 TRON 上获得 {tron} 个确认后入账。",

  // Withdraw
  "withdraw.available": "可出金金额",
  "withdraw.belowMin": "最低出金为 {min} USDT。",
  "withdraw.aboveMax": "每笔出金最高为 {max} USDT。",
  "withdraw.paused": "出金目前已暂停。请稍后重试或联系客服。",
  "withdraw.cancelAction": "取消出金",
  "withdraw.cancelConfirm": "取消此笔出金？金额将退回您的可用余额。",

  // Destination address checks
  "address.valid": "有效的 {network} 地址",
  "address.checksum": "此地址有误：校验和不匹配。请从您的钱包重新粘贴。",
  "address.otherNetwork": "此地址属于其他网络。请输入 {network}（{short}）地址，或在上方切换网络。",
  "address.contract": "这是 USDT 代币合约地址，而非钱包地址。请输入您自己的钱包地址。",

  // Email code confirmation sheet
  "stepup.willEmail": "我们将通过邮件向您发送 6 位验证码以进行确认。在您输入验证码之前，不会发送任何资金。",
  "stepup.sendCode": "通过邮件发送验证码",
  "stepup.codeLabel": "6 位验证码",

  // Transfer
  "transfer.eyebrow": "钱包 ↔ 账户",
  "transfer.swap": "切换方向",
  "transfer.freeMargin": "可用预付款",
  "transfer.marginLevel": "预付款比例",
  "transfer.overWithdrawable": "目前最多可从此账户转出 {amount} USD（持仓交易会保留其所需预付款）。",
  "transfer.arrivesAs": "到账 {amount}",
  "transfer.arrives": "到账",
  "transfer.confirmTitle": "确认转账",
  "transfer.confirm": "确认转账",

  // Transaction detail sheet
  "detail.confirmations": "确认数",
  "detail.note": "备注",
  "detail.reason": "原因",
  "detail.reference": "参考号",

  "error.staffReadOnly": "这是只读的员工会话，不允许进行更改。",
};
export default mobileWallet;
