// Keys for this namespace. English is the source; translations live in ../<lang>/mobileWallet.ts.
// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is shared with
// the Client Area and reused from the `wallet` and `common` namespaces; these are the phone-only strings.
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Available",
  "balance.otherAssets": "Other assets",

  // Copy / share / paste controls
  copyAddress: "Copy address",
  share: "Share",
  paste: "Paste",
  tokenContract: "Token contract",
  viewOnExplorer: "View on explorer",
  keep: "Keep it",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Min {min} USDT · {count} confirmations",
  "network.networkFee": "Network fee {fee} USDT",
  "network.noNetworkFee": "No network fee",
  "network.paused": "Paused for now",

  // Deposit
  "deposit.belowMin": "The minimum deposit is {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Request {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Send only USDT {short}",
  "deposit.openWalletApp": "Open in wallet app",
  "deposit.walletAppHint": "Opens MetaMask or another wallet app with this USDT transfer ready to approve.",
  "deposit.noWalletApp": "No wallet app on this phone can open it. Copy the address or scan the QR code instead.",
  "deposit.hashInvalid": "A transaction hash has 64 characters (0–9, a–f), with or without 0x.",
  "deposit.submitHash": "Submit transaction",
  "deposit.sentHelp": "Paste the transaction hash from your wallet or exchange. We find it on the network and credit it automatically.",
  "deposit.expiredHelp": "This request has expired. If you already sent the USDT, submit the transaction hash below; otherwise start a new deposit.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Credited to your wallet in {currency}",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "Send from your wallet or exchange",
  "how.sendText": "Copy the address or scan the QR code. On BNB Chain, one tap opens MetaMask with the transfer ready.",
  "how.hashTitle": "Paste the transaction hash",
  "how.hashText": "We verify it on the network and credit it after {bsc} confirmations on BNB Chain or {tron} on TRON.",

  // Withdraw
  "withdraw.available": "Available to withdraw",
  "withdraw.belowMin": "The minimum withdrawal is {min} USDT.",
  "withdraw.aboveMax": "The maximum per withdrawal is {max} USDT.",
  "withdraw.paused": "Withdrawals are paused at the moment. Please try again later or contact support.",
  "withdraw.cancelAction": "Cancel withdrawal",
  "withdraw.cancelConfirm": "Cancel this withdrawal? The amount goes back to your available balance.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Valid {network} address",
  "address.checksum": "This address has a typo: its checksum doesn't match. Paste it again from your wallet.",
  "address.otherNetwork": "This address is on another network. Enter a {network} ({short}) address, or switch the network above.",
  "address.contract": "This is the USDT token contract, not a wallet. Enter your own wallet address.",

  // Email code confirmation sheet
  "stepup.willEmail": "We email you a 6-digit code to confirm. Nothing is sent until you enter it.",
  "stepup.sendCode": "Email me the code",
  "stepup.codeLabel": "6-digit code",

  // Transfer
  "transfer.eyebrow": "Wallet ↔ accounts",
  "transfer.swap": "Swap direction",
  "transfer.freeMargin": "Free margin",
  "transfer.marginLevel": "Margin level",
  // {amount} is in USD
  "transfer.overWithdrawable": "Up to {amount} USD can leave this account now (open trades keep their margin).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "Arrives as {amount}",
  "transfer.arrives": "Arrives",
  "transfer.confirmTitle": "Confirm transfer",
  "transfer.confirm": "Confirm transfer",

  // Transaction detail sheet
  "detail.confirmations": "Confirmations",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Note",
  "detail.reason": "Reason",
  "detail.reference": "Reference",

  "error.staffReadOnly": "This is a read-only staff session. Changes are not allowed.",
};
export default mobileWallet;
