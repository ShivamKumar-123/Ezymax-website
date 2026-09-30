import type { NsMessages } from "../../core";

// App móvil de Kalks: inicio de sesión, registro y restablecimiento de contraseña (la mayoría de textos vienen de `auth`).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Crear una cuenta",
  "signIn.newHere": "¿Es nuevo en Kalks?",
  "signUp.eyebrow": "Abra su cuenta",
  "signUp.haveAccount": "¿Ya tiene una cuenta?",
  "signUp.signIn": "Iniciar sesión",
  "signUp.dobPlaceholder": "AAAA-MM-DD",
  "signUp.dobHint": "Debe tener 18 años o más.",
  "signUp.phonePlaceholder": "Número de teléfono",
  "signUp.marketing": "Quiero recibir por correo consejos de trading, novedades y ofertas. Puedo darme de baja cuando quiera.",
  "signUp.chooseCountry": "Elija su país",
  "signUp.continue": "Continuar a Kalks",
  "forgot.eyebrow": "Restablecer contraseña",
  "forgot.continue": "Continuar",
  "otp.eyebrow": "Verificación de seguridad",
  "otp.wrongEmail": "Usar otro correo",
  googleSoon: "El inicio de sesión con Google está disponible en el Área de clientes web.",
};
export default mobileAuth;
