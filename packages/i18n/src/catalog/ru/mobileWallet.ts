import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is reused from
// the `wallet` and `common` namespaces; these are the phone-only strings.
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Доступно",
  "balance.otherAssets": "Другие активы",

  // Copy / share / paste controls
  copyAddress: "Копировать адрес",
  share: "Поделиться",
  paste: "Вставить",
  tokenContract: "Контракт токена",
  viewOnExplorer: "Открыть в обозревателе блоков",
  keep: "Оставить",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Мин. {min} USDT · подтверждений: {count}",
  "network.networkFee": "Комиссия сети {fee} USDT",
  "network.noNetworkFee": "Без комиссии сети",
  "network.paused": "Временно приостановлено",

  // Deposit
  "deposit.belowMin": "Минимальная сумма пополнения — {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Запрос {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Отправляйте только USDT {short}",
  "deposit.openWalletApp": "Открыть в приложении кошелька",
  "deposit.walletAppHint": "Откроет MetaMask или другое приложение кошелька с готовым переводом USDT для подтверждения.",
  "deposit.noWalletApp": "На этом телефоне нет приложения кошелька, которое может это открыть. Скопируйте адрес или отсканируйте QR-код.",
  "deposit.hashInvalid": "Хеш транзакции состоит из 64 символов (0–9, a–f), с префиксом 0x или без него.",
  "deposit.submitHash": "Отправить транзакцию",
  "deposit.sentHelp": "Вставьте хеш транзакции из Вашего кошелька или с биржи. Мы найдём её в сети и зачислим автоматически.",
  "deposit.expiredHelp": "Срок этого запроса истёк. Если Вы уже отправили USDT, укажите хеш транзакции ниже; если нет, начните новое пополнение.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Зачислено на Ваш кошелёк в {currency}",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "Отправьте из кошелька или с биржи",
  "how.sendText": "Скопируйте адрес или отсканируйте QR-код. В BNB Chain одно касание открывает MetaMask с готовым переводом.",
  "how.hashTitle": "Вставьте хеш транзакции",
  "how.hashText": "Мы проверим её в сети и зачислим после {bsc} подтверждений в BNB Chain или {tron} в TRON.",

  // Withdraw
  "withdraw.available": "Доступно к выводу",
  "withdraw.belowMin": "Минимальная сумма вывода — {min} USDT.",
  "withdraw.aboveMax": "Максимум за один вывод — {max} USDT.",
  "withdraw.paused": "Вывод временно приостановлен. Пожалуйста, попробуйте позже или обратитесь в поддержку.",
  "withdraw.cancelAction": "Отменить вывод",
  "withdraw.cancelConfirm": "Отменить этот вывод? Сумма вернётся на Ваш доступный баланс.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Корректный адрес {network}",
  "address.checksum": "В адресе опечатка: контрольная сумма не совпадает. Вставьте его заново из кошелька.",
  "address.otherNetwork": "Этот адрес из другой сети. Введите адрес в сети {network} ({short}) или смените сеть выше.",
  "address.contract": "Это контракт токена USDT, а не кошелёк. Введите адрес собственного кошелька.",

  // Email code confirmation sheet
  "stepup.willEmail": "Мы отправим Вам на почту 6-значный код для подтверждения. Ничего не будет отправлено, пока Вы его не введёте.",
  "stepup.sendCode": "Отправить код на почту",
  "stepup.codeLabel": "6-значный код",

  // Transfer
  "transfer.eyebrow": "Кошелёк ↔ счета",
  "transfer.swap": "Поменять направление",
  "transfer.freeMargin": "Свободная маржа",
  "transfer.marginLevel": "Уровень маржи",
  // {amount} is in USD
  "transfer.overWithdrawable": "Сейчас с этого счёта можно перевести до {amount} USD (открытые сделки сохраняют свою маржу).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "Будет зачислено {amount}",
  "transfer.arrives": "Зачисление",
  "transfer.confirmTitle": "Подтвердите перевод",
  "transfer.confirm": "Подтвердить перевод",

  // Transaction detail sheet
  "detail.confirmations": "Подтверждения",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Примечание",
  "detail.reason": "Причина",
  "detail.reference": "Номер",

  "error.staffReadOnly": "Это сеанс сотрудника только для чтения. Изменения запрещены.",
};
export default mobileWallet;
