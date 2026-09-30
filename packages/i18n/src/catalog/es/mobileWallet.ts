import type { NsMessages } from "../../core";

// App móvil de Kalks: pantallas de la billetera (resumen, depósito, retiro, transferencia, historial). La mayoría de
// textos vienen de `wallet` y `common`; estos son solo del móvil. Se mantienen los nombres de marca y de redes:
// Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Cabecera del resumen: línea pequeña en mayúsculas sobre el título (activo y redes)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Disponible",
  "balance.otherAssets": "Otros activos",

  // Controles de copiar / compartir / pegar
  copyAddress: "Copiar dirección",
  share: "Compartir",
  paste: "Pegar",
  tokenContract: "Contrato del token",
  viewOnExplorer: "Ver en el explorador",
  keep: "Mantenerlo",

  // Selector de red (depósito / retiro); {min} es un importe, {count} un número de confirmaciones de bloque
  "network.depositDetail": "Mín. {min} USDT · {count} confirmaciones",
  "network.networkFee": "Comisión de red {fee} USDT",
  "network.noNetworkFee": "Sin comisión de red",
  "network.paused": "En pausa por ahora",

  // Depósito
  "deposit.belowMin": "El depósito mínimo es de {min} USDT.",
  // {id} son los primeros caracteres del ID de la solicitud de depósito
  "deposit.request": "Solicitud {id}",
  // Título del banner sobre el aviso de red; {short} es BEP20 o TRC20
  "deposit.onlyUsdt": "Envíe solo USDT {short}",
  "deposit.openWalletApp": "Abrir en la app de billetera",
  "deposit.walletAppHint": "Abre MetaMask u otra app de billetera con esta transferencia de USDT lista para aprobar.",
  "deposit.noWalletApp": "Ninguna app de billetera de este teléfono puede abrirlo. Copie la dirección o escanee el código QR.",
  "deposit.hashInvalid": "Un hash de transacción tiene 64 caracteres (0–9, a–f), con o sin 0x.",
  "deposit.submitHash": "Enviar transacción",
  "deposit.sentHelp": "Pegue el hash de la transacción desde su billetera o exchange. La buscamos en la red y la acreditamos automáticamente.",
  "deposit.expiredHelp": "Esta solicitud ha caducado. Si ya envió los USDT, envíe abajo el hash de la transacción; si no, inicie un nuevo depósito.",
  // Bajo el importe acreditado grande; {currency} es USDT
  "deposit.creditedBody": "Acreditado en su billetera en {currency}",
  // Cómo funcionan los depósitos en el móvil (pasos 2 y 3; los pasos 1 y 4 se comparten con el Área de clientes)
  "how.sendTitle": "Envíe desde su billetera o exchange",
  "how.sendText": "Copie la dirección o escanee el código QR. En BNB Chain, un toque abre MetaMask con la transferencia preparada.",
  "how.hashTitle": "Pegue el hash de la transacción",
  "how.hashText": "La verificamos en la red y la acreditamos tras {bsc} confirmaciones en BNB Chain o {tron} en TRON.",

  // Retiro
  "withdraw.available": "Disponible para retirar",
  "withdraw.belowMin": "El retiro mínimo es de {min} USDT.",
  "withdraw.aboveMax": "El máximo por retiro es de {max} USDT.",
  "withdraw.paused": "Los retiros están en pausa en este momento. Inténtelo más tarde o contacte con soporte.",
  "withdraw.cancelAction": "Cancelar retiro",
  "withdraw.cancelConfirm": "¿Cancelar este retiro? El importe vuelve a su saldo disponible.",

  // Comprobaciones de la dirección de destino; {network} es un nombre de red, {short} BEP20 / TRC20
  "address.valid": "Dirección de {network} válida",
  "address.checksum": "Esta dirección tiene un error: su suma de verificación no coincide. Péguela de nuevo desde su billetera.",
  "address.otherNetwork": "Esta dirección es de otra red. Introduzca una dirección de {network} ({short}) o cambie la red arriba.",
  "address.contract": "Este es el contrato del token USDT, no una billetera. Introduzca la dirección de su propia billetera.",

  // Hoja de confirmación con código por correo
  "stepup.willEmail": "Le enviaremos por correo un código de 6 dígitos para confirmar. No se envía nada hasta que lo introduzca.",
  "stepup.sendCode": "Enviarme el código",
  "stepup.codeLabel": "Código de 6 dígitos",

  // Transferencia
  "transfer.eyebrow": "Billetera ↔ cuentas",
  "transfer.swap": "Invertir dirección",
  "transfer.freeMargin": "Margen libre",
  "transfer.marginLevel": "Nivel de margen",
  // {amount} está en USD
  "transfer.overWithdrawable": "Ahora pueden salir de esta cuenta hasta {amount} USD (las operaciones abiertas conservan su margen).",
  // {amount} es p. ej. "USC 10,000.00"
  "transfer.arrivesAs": "Llega como {amount}",
  "transfer.arrives": "Llega",
  "transfer.confirmTitle": "Confirmar transferencia",
  "transfer.confirm": "Confirmar transferencia",

  // Hoja de detalle de la transacción
  "detail.confirmations": "Confirmaciones",
  // Etiqueta de una nota del Back Office en un ajuste u otro abono
  "detail.note": "Nota",
  "detail.reason": "Motivo",
  "detail.reference": "Referencia",

  "error.staffReadOnly": "Esta es una sesión de personal de solo lectura. No se permiten cambios.",
};
export default mobileWallet;
