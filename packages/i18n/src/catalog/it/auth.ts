import type { NsMessages } from "../../core";

const auth: NsMessages<"auth"> = {
  // Campi modulo condivisi
  "field.email": "Email",
  "field.emailOrViewer": "Email o ID visualizzatore",
  "field.password": "Password",
  "field.newPassword": "Nuova password",
  "field.firstName": "Nome",
  "field.lastName": "Cognome",
  "field.country": "Paese di residenza",
  "field.phone": "Telefono",
  "field.dateOfBirth": "Data di nascita",
  "field.referralCode": "Codice referral",
  "field.optionalHint": "facoltativo",
  "placeholder.email": "tu@esempio.com",
  "placeholder.createPassword": "Crea una password sicura",
  "togglePassword": "Mostra/nascondi password",

  // Passaggio OTP / codice
  "otp.didntGetIt": "Non l'hai ricevuto?",
  "otp.verifying": "Verifica in corso…",
  "otp.resendIn": "Invia di nuovo tra 0:{seconds}",
  "otp.sending": "Invio in corso…",
  "otp.resendCode": "Invia di nuovo il codice",
  "otp.devHint": "Modalità sviluppo: l'invio delle email non è ancora configurato. Il tuo codice è <code>{code}</code> (è anche nel log del gateway).",
  "toast.newCodeSent": "Nuovo codice inviato",
  "toast.checkEmail": "Controlla {email}",

  // Accesso con Google
  "google.continue": "Continua con Google",
  "google.signUp": "Registrati con Google",
  "google.opening": "Apertura di Google…",
  "google.orWithEmail": "oppure con email",
  "google.error.cancelled": "L'accesso con Google è stato annullato. Scegli un account per continuare oppure usa la tua email qui sotto.",
  "google.error.expired": "L'accesso con Google è scaduto o è stato aperto in un'altra scheda. Riprova.",
  "google.error.unverified": "L'indirizzo email del tuo account Google non è verificato. Verificalo con Google oppure usa la tua email qui sotto.",
  "google.error.conflict": "Questa email è già collegata a un altro account Google. Usa quell'account Google oppure accedi con la tua password.",
  "google.error.disabled": "Questo account è disattivato. Contatta l'assistenza.",
  "google.error.rate_limited": "Troppi tentativi di accesso. Attendi qualche minuto e riprova.",
  "google.error.unavailable": "L'accesso con Google non è disponibile al momento. Riprova tra poco oppure usa la tua email.",
  "google.error.failed": "Non è stato possibile accedere con Google. Riprova.",

  // Indicatore di sicurezza password
  "strength.rule": "Almeno 8 caratteri, maiuscola, numero e simbolo",
  "strength.tooWeak": "Troppo debole",
  "strength.weak": "Debole",
  "strength.fair": "Discreta",
  "strength.good": "Buona",
  "strength.strong": "Forte",

  // Scheda di accesso demo
  "demo.title": "Questa è la demo di Kalks",
  "demo.body": "Nessun account necessario. Ogni schermata usa dati di esempio.",
  "demo.enter": "Entra nella demo",

  // Pannello brand
  "brand.headline": "Opera sui mercati globali con precisione istituzionale.",
  "brand.body": "Forex, metalli, indici, energie, cripto e azioni: depositi istantanei in USDT, un unico account per fare trading, copiare e diventare partner.",
  "brand.previewAlt": "Dashboard dell'area clienti Kalks",

  // Accesso
  "login.title": "Bentornato",
  "login.subtitle": "Accedi alla tua area clienti Kalks.",
  "login.forgot": "Password dimenticata?",
  "login.signingIn": "Accesso in corso…",
  "login.signIn": "Accedi",
  "login.newToKalks": "Nuovo su Kalks? <link>Crea un account</link>",
  "login.verifyEmailTitle": "Verifica la tua email",
  "login.verifyDeviceTitle": "Conferma la tua identità",
  "login.emailNotVerified": "La tua email non è ancora verificata.",
  "login.newDevice": "Rilevato un nuovo dispositivo.",
  "login.codeSent": "Abbiamo inviato un codice di 6 cifre a <b>{email}</b>.",
  "login.verifyContinue": "Verifica e continua",
  "login.back": "← Indietro",

  // Registrazione
  "register.stepDetails": "Dati",
  "register.stepVerify": "Verifica email",
  "register.stepDone": "Fatto",
  "register.title": "Crea il tuo account Kalks",
  "register.subtitleDemo": "Apri subito una demo gratuita. Passa al reale quando vuoi.",
  "register.subtitle": "Registrati in un minuto e segui subito i mercati in tempo reale.",
  "register.emailTaken": "<signin>Accedi</signin> oppure <reset>reimposta la password</reset>.",
  "register.terms": "Ho più di 18 anni e accetto il <agreement>Contratto Cliente</agreement>, l'<risk>Informativa sui rischi</risk> e l'<privacy>Informativa sulla privacy</privacy>.",
  "register.creating": "Creazione account…",
  "register.create": "Crea account",
  "register.haveAccount": "Hai già un account? <link>Accedi</link>",
  "register.checkInbox": "Controlla la tua casella di posta",
  "register.enterCode": "Inserisci il codice di 6 cifre che abbiamo inviato a <b>{email}</b>.",
  "register.verifyEmail": "Verifica email",
  "register.welcome": "Benvenuto in Kalks, {name}",
  "register.readyDemo": "La tua email è verificata e il tuo account è pronto. Apri ora un conto demo oppure verifica la tua identità per passare al reale.",
  "register.ready": "La tua email è verificata e il tuo account è pronto. Segui subito i mercati in tempo reale; depositi e conti di trading saranno presto disponibili.",
  "register.openClientArea": "Apri l'area clienti",

  // Completamento profilo dopo la registrazione con Google
  "complete.stepGoogle": "Account Google",
  "complete.stepDetails": "I tuoi dati",
  "complete.loading": "Caricamento del profilo Google…",
  "complete.expiredTitle": "Ricominciamo",
  "complete.accountExists": "Il tuo account è già configurato. Continua con Google per accedere.",
  "complete.expired": "La registrazione con Google è scaduta o è stata completata in un'altra scheda. Continua con Google per riprendere da dove avevi lasciato.",
  "complete.preferEmail": "Preferisci l'email? <link>Registrati con l'email</link>",
  "complete.title": "Completa il tuo profilo",
  "complete.subtitle": "Alcuni dati necessari per ogni account Kalks. Ci vuole meno di un minuto.",
  "complete.googleAccount": "Account Google",
  "complete.emailTaken": "<signin>Accedi</signin> con la tua password oppure <reset>reimpostala</reset>.",
  "complete.ready": "Il tuo account è pronto e hai effettuato l'accesso con Google. Segui subito i mercati in tempo reale; depositi e conti di trading saranno presto disponibili.",
  "complete.notYou": "Non sei tu? <link>Usa un altro account Google</link>",

  // Password dimenticata / reimpostazione
  "forgot.backToSignIn": "Torna all'accesso",
  "forgot.titleReset": "Reimposta la password",
  "forgot.titleCode": "Inserisci il codice",
  "forgot.titleNew": "Imposta una nuova password",
  "forgot.intro": "Ti invieremo via email un codice di 6 cifre per reimpostare la password.",
  "forgot.codeSent": "Se esiste un account per <b>{email}</b>, gli abbiamo inviato un codice.",
  "forgot.passwordRule": "Usa almeno 8 caratteri combinando lettere, numeri e simboli.",
  "forgot.sendCode": "Invia codice",
  "forgot.updating": "Aggiornamento…",
  "forgot.update": "Aggiorna password",
  "forgot.toastUpdated": "Password aggiornata",
  "forgot.toastUpdatedBody": "Accedi con la tua nuova password.",

  // Conferma aggiuntiva (codice via email prima di modifiche sensibili)
  // {what} è una frase d'azione tradotta, es. "modificare la leva di #10000123"
  "stepup.intro": "Per {what}, inserisci il codice di 6 cifre che abbiamo inviato a <b>{email}</b>. Scade tra {minutes} minuti.",
  "stepup.spam": "Non l'hai ricevuto? Controlla la cartella spam.",
  "stepup.checking": "Verifica in corso…",
  "stepup.saving": "Salvataggio…",
  "stepup.sendAgain": "Invia di nuovo il codice",
  "stepup.sendingCode": "Invio di un codice di conferma alla tua email…",
};
export default auth;
