import type { NsMessages } from "../../core";

// App móvil de Kalks: estructura de la app, bienvenida y estados comunes a todas las pantallas.
const mobile: NsMessages<"mobile"> = {
  // Barra de pestañas (una palabra corta cada una)
  "tab.home": "Inicio",
  "tab.markets": "Mercados",
  "tab.trade": "Operar",
  "tab.portfolio": "Cartera",
  "tab.more": "Más",

  // Bienvenida (3 diapositivas). Títulos en mayúsculas grandes: cortos
  "onboarding.skip": "Omitir",
  "onboarding.next": "Siguiente",
  "onboarding.getStarted": "Empezar",
  "onboarding.haveAccount": "Ya tengo una cuenta",
  "onboarding.welcome.title": "Entre en los mercados",
  "onboarding.welcome.body": "Forex, metales, índices, energías, cripto y acciones en una sola cuenta, con financiación instantánea en USDT.",
  "onboarding.markets.title": "Cada tick, en vivo",
  "onboarding.markets.body": "Precios bid y ask reales, sus propios gráficos y compra y venta con un solo toque, todo pensado para el móvil.",
  "onboarding.security.title": "Todo bajo llave",
  "onboarding.security.body": "Códigos por correo en dispositivos nuevos, códigos de confirmación para los retiros y una bóveda segura para su sesión.",
  // Contador de diapositivas, p. ej. "1 de 3"
  "onboarding.step": "{n} de {total}",

  // Estados compartidos
  "state.offline.title": "Sin conexión",
  "state.offline.body": "Compruebe su conexión a internet. Los precios y su cuenta se reconectan automáticamente.",
  "state.reconnecting": "Reconectando…",
  "state.error.title": "Algo salió mal",
  "state.error.body": "No pudimos cargar esto. Deslice hacia abajo o toque para reintentar.",
  "state.maintenance.title": "En mantenimiento",
  "state.maintenance.body": "Estamos actualizando Kalks. Sus posiciones y fondos están seguros. Vuelva en unos minutos.",
  "state.sessionExpired": "Su sesión ha finalizado. Vuelva a iniciar sesión.",
  "state.updated": "Actualizado {time}",
  "state.pullToRefresh": "Deslice para actualizar",

  viewOnly: "Acceso de solo lectura",
  viewOnlyBody: "Con este acceso puede ver las cuentas compartidas, pero no hacer cambios.",

  // Etiquetas cortas comunes
  "action.retry": "Reintentar",
  "action.openWeb": "Abrir en el Área de clientes",
  "action.signOut": "Cerrar sesión",
  "action.seeAll": "Ver todo",
  "a11y.close": "Cerrar",
  "a11y.back": "Atrás",
};
export default mobile;
