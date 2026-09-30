import type { NsMessages } from "../../core";

// App móvel da Kalks: telas da carteira (visão geral, depósito, saque, transferência, histórico). A maioria dos textos
// vem dos namespaces `wallet` e `common`; aqui ficam só os textos do celular.
// Nomes de marcas e redes mantidos: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Cabeçalho da visão geral: linha pequena em maiúsculas acima do título (ativo e redes)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Disponível",
  "balance.otherAssets": "Outros ativos",

  // Copiar / compartilhar / colar
  copyAddress: "Copiar endereço",
  share: "Compartilhar",
  paste: "Colar",
  tokenContract: "Contrato do token",
  viewOnExplorer: "Ver no explorador de blocos",
  keep: "Manter",

  // Seletor de rede (depósito / saque); {min} é um valor, {count} um número de confirmações de bloco
  "network.depositDetail": "Mín. {min} USDT · {count} confirmações",
  "network.networkFee": "Taxa de rede {fee} USDT",
  "network.noNetworkFee": "Sem taxa de rede",
  "network.paused": "Pausada por enquanto",

  // Depósito
  "deposit.belowMin": "O depósito mínimo é de {min} USDT.",
  // {id} são os primeiros caracteres do ID da solicitação de depósito
  "deposit.request": "Solicitação {id}",
  // Título do aviso acima do alerta de rede; {short} é BEP20 ou TRC20
  "deposit.onlyUsdt": "Envie apenas USDT {short}",
  "deposit.openWalletApp": "Abrir no app da carteira",
  "deposit.walletAppHint": "Abre o MetaMask ou outro app de carteira com esta transferência de USDT pronta para aprovar.",
  "deposit.noWalletApp": "Nenhum app de carteira deste celular consegue abrir o link. Copie o endereço ou escaneie o QR code.",
  "deposit.hashInvalid": "Um hash de transação tem 64 caracteres (0–9, a–f), com ou sem 0x.",
  "deposit.submitHash": "Enviar transação",
  "deposit.sentHelp": "Cole o hash da transação da sua carteira ou corretora. Nós a encontramos na rede e creditamos automaticamente.",
  "deposit.expiredHelp": "Esta solicitação expirou. Se você já enviou o USDT, informe o hash da transação abaixo; caso contrário, inicie um novo depósito.",
  // Abaixo do valor creditado em destaque; {currency} é USDT
  "deposit.creditedBody": "Creditado na sua carteira em {currency}",
  // Como funcionam os depósitos no celular (etapas 2 e 3; as etapas 1 e 4 vêm da Área do Cliente)
  "how.sendTitle": "Envie da sua carteira ou corretora",
  "how.sendText": "Copie o endereço ou escaneie o QR code. Na BNB Chain, um toque abre o MetaMask com a transferência pronta.",
  "how.hashTitle": "Cole o hash da transação",
  "how.hashText": "Nós o verificamos na rede e creditamos após {bsc} confirmações na BNB Chain ou {tron} na TRON.",

  // Saque
  "withdraw.available": "Disponível para saque",
  "withdraw.belowMin": "O saque mínimo é de {min} USDT.",
  "withdraw.aboveMax": "O máximo por saque é de {max} USDT.",
  "withdraw.paused": "Os saques estão pausados no momento. Tente novamente mais tarde ou entre em contato com o suporte.",
  "withdraw.cancelAction": "Cancelar saque",
  "withdraw.cancelConfirm": "Cancelar este saque? O valor volta para seu saldo disponível.",

  // Verificação do endereço de destino; {network} é o nome da rede, {short} BEP20 / TRC20
  "address.valid": "Endereço {network} válido",
  "address.checksum": "Este endereço tem um erro de digitação: o checksum não confere. Cole-o novamente da sua carteira.",
  "address.otherNetwork": "Este endereço é de outra rede. Informe um endereço {network} ({short}) ou troque a rede acima.",
  "address.contract": "Este é o contrato do token USDT, não uma carteira. Informe o endereço da sua própria carteira.",

  // Confirmação com código por e-mail
  "stepup.willEmail": "Enviaremos um código de 6 dígitos por e-mail para confirmar. Nada é enviado até você digitá-lo.",
  "stepup.sendCode": "Enviar o código por e-mail",
  "stepup.codeLabel": "Código de 6 dígitos",

  // Transferência
  "transfer.eyebrow": "Carteira ↔ contas",
  "transfer.swap": "Inverter direção",
  "transfer.freeMargin": "Margem livre",
  "transfer.marginLevel": "Nível de margem",
  // {amount} está em USD
  "transfer.overWithdrawable": "Até {amount} USD podem sair desta conta agora (as negociações abertas mantêm sua margem).",
  // {amount} é, por exemplo, "USC 10,000.00"
  "transfer.arrivesAs": "Chega como {amount}",
  "transfer.arrives": "Chegada",
  "transfer.confirmTitle": "Confirmar transferência",
  "transfer.confirm": "Confirmar transferência",

  // Detalhes da transação
  "detail.confirmations": "Confirmações",
  // Rótulo de uma observação do Back Office em um ajuste ou outro crédito
  "detail.note": "Observação",
  "detail.reason": "Motivo",
  "detail.reference": "Referência",

  "error.staffReadOnly": "Esta é uma sessão da equipe somente leitura. Alterações não são permitidas.",
};
export default mobileWallet;
