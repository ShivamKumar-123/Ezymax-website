import type { NsMessages } from "../../core";

// App móvil de Kalks: Academia (fases, lector de capítulos, cuestionarios, exámenes finales, glosario, progreso y
// certificados). Solo los textos exclusivos del móvil; el resto viene de `academy`. Se mantiene "Kalks".
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Línea pequeña en mayúsculas sobre el título de la Academia
  eyebrow: "Academia Kalks",
  // Bajo el título; {count} = número de capítulos
  "home.subtitle": "{count} capítulos en ocho fases, con cuestionarios, exámenes finales y certificados.",
  // Cifras grandes del inicio de la Academia (etiquetas cortas bajo un número)
  "stats.chapters": "Capítulos",
  "stats.streakDays": "Días de racha",
  "stats.certificates": "Certificados",
  // {n} = número de fase, {title} = título de la fase
  "home.phaseA11y": "Fase {n}: {title}",

  // Lector de capítulos
  "reader.updated": "Actualizado el {date}",
  "reader.completedOn": "Completado el {date}",
  "reader.upNext": "A continuación",
  "reader.completeHint": "Apruebe el cuestionario para completar este capítulo.",
  "reader.zoomHint": "Abre el diagrama a pantalla completa",
  "reader.tapToZoom": "Toque para ampliar",
  "reader.zoomHelp": "Pellizque o toque dos veces para ampliar",

  // Practicar el ejercicio del capítulo en la pestaña Operar de la app; {login} = número de la cuenta demo
  "practice.title": "Practique en demo",
  "practice.onDemo": "Operar en la demo #{login}",

  // Pantalla del examen final
  "exam.answerAll": "Responda todas las preguntas para enviarlo.",

  // Glosario; "terms" es la etiqueta pequeña junto al número grande de términos
  "glossary.terms": { one: "término en lenguaje sencillo", many: "términos en lenguaje sencillo", other: "términos en lenguaje sencillo" },
  "glossary.letters": "Índice alfabético",
  "glossary.openTerm": "Abre la definición",

  // Certificados
  "cert.share": "Compartir",
  // Texto compartido; {brand} = nombre del bróker, {n} = número de fase, {title} = título de la fase, {url} = enlace de verificación
  "cert.shareText": "Mi certificado de la Academia {brand}, fase {n} ({title}): {url}",
  "cert.imageA11y": "Certificado de la fase {n}",

  // Etiquetas de accesibilidad
  "a11y.glossary": "Abrir el glosario",
  "a11y.progress": "Mi progreso",
  "a11y.contents": "Contenido del capítulo",

  // Estados
  "state.viewer.title": "No compartido con usted",
  "state.viewer.body": "La Academia no forma parte de lo que se compartió con este acceso de solo lectura.",
  "state.disabled.title": "No disponible",
  "state.disabled.body": "La Academia no está disponible en su cuenta.",
};
export default mobileAcademy;
