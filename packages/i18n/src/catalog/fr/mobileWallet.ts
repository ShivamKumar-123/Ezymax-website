import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Phone-only strings; the rest
// is reused from `wallet` and `common`. Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20,
// BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Disponible",
  "balance.otherAssets": "Autres actifs",

  // Copy / share / paste controls
  copyAddress: "Copier l'adresse",
  share: "Partager",
  paste: "Coller",
  tokenContract: "Contrat du jeton",
  viewOnExplorer: "Voir dans l'explorateur",
  keep: "Le conserver",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Min. {min} USDT · {count} confirmations",
  "network.networkFee": "Frais de réseau {fee} USDT",
  "network.noNetworkFee": "Sans frais de réseau",
  "network.paused": "Suspendu pour le moment",

  // Deposit
  "deposit.belowMin": "Le dépôt minimum est de {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Demande {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Envoyez uniquement des USDT {short}",
  "deposit.openWalletApp": "Ouvrir dans l'app portefeuille",
  "deposit.walletAppHint": "Ouvre MetaMask ou une autre app de portefeuille avec ce transfert USDT prêt à être approuvé.",
  "deposit.noWalletApp": "Aucune app de portefeuille de ce téléphone ne peut l'ouvrir. Copiez plutôt l'adresse ou scannez le QR code.",
  "deposit.hashInvalid": "Un hash de transaction comporte 64 caractères (0–9, a–f), avec ou sans 0x.",
  "deposit.submitHash": "Soumettre la transaction",
  "deposit.sentHelp": "Collez le hash de la transaction depuis votre portefeuille ou votre plateforme d'échange. Nous la retrouvons sur le réseau et la créditons automatiquement.",
  "deposit.expiredHelp": "Cette demande a expiré. Si vous avez déjà envoyé les USDT, soumettez le hash de la transaction ci-dessous ; sinon, lancez un nouveau dépôt.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Crédité sur votre portefeuille en {currency}",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "Envoyez depuis votre portefeuille ou plateforme",
  "how.sendText": "Copiez l'adresse ou scannez le QR code. Sur BNB Chain, une seule touche ouvre MetaMask avec le transfert prêt.",
  "how.hashTitle": "Collez le hash de la transaction",
  "how.hashText": "Nous le vérifions sur le réseau et le créditons après {bsc} confirmations sur BNB Chain ou {tron} sur TRON.",

  // Withdraw
  "withdraw.available": "Disponible au retrait",
  "withdraw.belowMin": "Le retrait minimum est de {min} USDT.",
  "withdraw.aboveMax": "Le maximum par retrait est de {max} USDT.",
  "withdraw.paused": "Les retraits sont suspendus pour le moment. Veuillez réessayer plus tard ou contacter l'assistance.",
  "withdraw.cancelAction": "Annuler le retrait",
  "withdraw.cancelConfirm": "Annuler ce retrait ? Le montant revient sur votre solde disponible.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Adresse {network} valide",
  "address.checksum": "Cette adresse contient une faute de frappe : sa somme de contrôle ne correspond pas. Collez-la à nouveau depuis votre portefeuille.",
  "address.otherNetwork": "Cette adresse appartient à un autre réseau. Saisissez une adresse {network} ({short}), ou changez de réseau ci-dessus.",
  "address.contract": "Il s'agit du contrat du jeton USDT, pas d'un portefeuille. Saisissez l'adresse de votre propre portefeuille.",

  // Email code confirmation sheet
  "stepup.willEmail": "Nous vous envoyons par e-mail un code à 6 chiffres pour confirmer. Rien n'est envoyé tant que vous ne l'avez pas saisi.",
  "stepup.sendCode": "M'envoyer le code",
  "stepup.codeLabel": "Code à 6 chiffres",

  // Transfer
  "transfer.eyebrow": "Portefeuille ↔ comptes",
  "transfer.swap": "Inverser le sens",
  "transfer.freeMargin": "Marge libre",
  "transfer.marginLevel": "Niveau de marge",
  // {amount} is in USD
  "transfer.overWithdrawable": "Jusqu'à {amount} USD peuvent quitter ce compte maintenant (les trades ouverts conservent leur marge).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "Arrive en {amount}",
  "transfer.arrives": "Arrivée",
  "transfer.confirmTitle": "Confirmer le transfert",
  "transfer.confirm": "Confirmer le transfert",

  // Transaction detail sheet
  "detail.confirmations": "Confirmations",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Note",
  "detail.reason": "Motif",
  "detail.reference": "Référence",

  "error.staffReadOnly": "Session du personnel en lecture seule. Les modifications ne sont pas autorisées.",
};
export default mobileWallet;
