import type { NsMessages } from "../../core";

const auth: NsMessages<"auth"> = {
  // Shared form fields
  "field.email": "Barua pepe",
  "field.emailOrViewer": "Barua pepe au kitambulisho cha mtazamaji",
  "field.password": "Nenosiri",
  "field.newPassword": "Nenosiri jipya",
  "field.firstName": "Jina la kwanza",
  "field.lastName": "Jina la mwisho",
  "field.country": "Nchi unayoishi",
  "field.phone": "Simu",
  "field.dateOfBirth": "Tarehe ya kuzaliwa",
  "field.referralCode": "Msimbo wa rufaa",
  "field.optionalHint": "si lazima",
  "placeholder.email": "you@example.com",
  "placeholder.createPassword": "Unda nenosiri imara",
  "togglePassword": "Onyesha au ficha nenosiri",

  // Shared OTP / code step
  "otp.didntGetIt": "Hukuupokea?",
  "otp.verifying": "Inathibitisha…",
  "otp.resendIn": "Tuma tena baada ya 0:{seconds}",
  "otp.sending": "Inatuma…",
  "otp.resendCode": "Tuma msimbo tena",
  "otp.devHint": "Hali ya uundaji: utumaji wa barua pepe bado haujasanidiwa. Msimbo wako ni <code>{code}</code> (pia uko kwenye kumbukumbu za gateway).",
  "toast.newCodeSent": "Msimbo mpya umetumwa",
  "toast.checkEmail": "Angalia {email}",

  // Google sign-in
  "google.continue": "Endelea na Google",
  "google.signUp": "Jisajili kwa Google",
  "google.opening": "Inafungua Google…",
  "google.orWithEmail": "au kwa barua pepe",
  "google.error.cancelled": "Kuingia kwa Google kumeghairiwa. Chagua akaunti ili kuendelea, au tumia barua pepe yako hapa chini.",
  "google.error.expired": "Muda wa kuingia kwa Google umeisha au ulifunguliwa kwenye kichupo kingine. Tafadhali jaribu tena.",
  "google.error.unverified": "Anwani ya barua pepe ya akaunti yako ya Google haijathibitishwa. Ithibitishe kwa Google, au tumia barua pepe yako hapa chini.",
  "google.error.conflict": "Barua pepe hii tayari imeunganishwa na akaunti nyingine ya Google. Tumia akaunti hiyo ya Google, au ingia kwa nenosiri lako.",
  "google.error.disabled": "Akaunti hii imezimwa. Tafadhali wasiliana na msaada.",
  "google.error.rate_limited": "Majaribio mengi mno ya kuingia. Tafadhali subiri dakika chache kisha ujaribu tena.",
  "google.error.unavailable": "Kuingia kwa Google hakupatikani kwa sasa. Tafadhali jaribu tena baada ya muda mfupi, au tumia barua pepe yako.",
  "google.error.failed": "Hatukuweza kukuingiza kwa Google. Tafadhali jaribu tena.",

  // Password strength meter
  "strength.rule": "Herufi 8+, herufi kubwa, namba na alama",
  "strength.tooWeak": "Dhaifu sana",
  "strength.weak": "Dhaifu",
  "strength.fair": "Wastani",
  "strength.good": "Nzuri",
  "strength.strong": "Imara",

  // Demo entry card (demo builds only)
  "demo.title": "Hii ni demo ya Kalks",
  "demo.body": "Huhitaji akaunti. Kila skrini inatumia data ya mfano.",
  "demo.enter": "Ingia kwenye demo",

  // Auth layout brand panel
  "brand.headline": "Fanya biashara katika masoko ya dunia kwa usahihi wa kitaasisi.",
  "brand.body": "Forex, metali, fahirisi, nishati, crypto na hisa — ufadhili wa papo hapo kwa USDT, akaunti moja kwa biashara, kunakili na ushirika.",
  "brand.previewAlt": "Dashibodi ya eneo la mteja la Kalks",

  // Sign in
  "login.title": "Karibu tena",
  "login.subtitle": "Ingia kwenye eneo lako la mteja la Kalks.",
  "login.forgot": "Umesahau nenosiri?",
  "login.signingIn": "Inaingia…",
  "login.signIn": "Ingia",
  "login.newToKalks": "Mgeni kwenye Kalks? <link>Fungua akaunti</link>",
  "login.verifyEmailTitle": "Thibitisha barua pepe yako",
  "login.verifyDeviceTitle": "Thibitisha kuwa ni wewe",
  "login.emailNotVerified": "Barua pepe yako bado haijathibitishwa.",
  "login.newDevice": "Kifaa kipya kimegunduliwa.",
  "login.codeSent": "Tumetuma msimbo wa tarakimu 6 kwa <b>{email}</b>.",
  "login.verifyContinue": "Thibitisha na uendelee",
  "login.back": "← Rudi",

  // Sign up
  "register.stepDetails": "Maelezo",
  "register.stepVerify": "Thibitisha barua pepe",
  "register.stepDone": "Imekamilika",
  "register.title": "Fungua akaunti yako ya Kalks",
  "register.subtitleDemo": "Fungua demo ya bure papo hapo. Anza biashara halisi wakati wowote ukiwa tayari.",
  "register.subtitle": "Jisajili kwa dakika moja na ufuatilie masoko moja kwa moja mara moja.",
  "register.emailTaken": "<signin>Ingia</signin> au <reset>weka upya nenosiri lako</reset>.",
  "register.terms": "Nina umri wa zaidi ya miaka 18 na ninakubali <agreement>Mkataba wa Mteja</agreement>, <risk>Taarifa ya Hatari</risk> na <privacy>Sera ya Faragha</privacy>.",
  "register.creating": "Inafungua akaunti…",
  "register.create": "Fungua akaunti",
  "register.haveAccount": "Tayari una akaunti? <link>Ingia</link>",
  "register.checkInbox": "Angalia kikasha chako",
  "register.enterCode": "Weka msimbo wa tarakimu 6 tuliotuma kwa <b>{email}</b>.",
  "register.verifyEmail": "Thibitisha barua pepe",
  "register.welcome": "Karibu Kalks, {name}",
  "register.readyDemo": "Barua pepe yako imethibitishwa na akaunti yako iko tayari. Fungua akaunti ya demo sasa, au thibitisha utambulisho wako ili uanze biashara halisi.",
  "register.ready": "Barua pepe yako imethibitishwa na akaunti yako iko tayari. Fuatilia masoko moja kwa moja sasa; ufadhili na akaunti za biashara zinakuja hivi karibuni.",
  "register.openClientArea": "Fungua eneo la mteja",

  // Complete profile after Google sign-up
  "complete.stepGoogle": "Akaunti ya Google",
  "complete.stepDetails": "Maelezo yako",
  "complete.loading": "Inapakia wasifu wako wa Google…",
  "complete.expiredTitle": "Tuanze upya",
  "complete.accountExists": "Akaunti yako tayari imesanidiwa. Endelea na Google ili kuingia.",
  "complete.expired": "Usajili wako wa Google umeisha muda au ulikamilishwa kwenye kichupo kingine. Endelea na Google ili uendelee ulipoishia.",
  "complete.preferEmail": "Unapendelea barua pepe? <link>Jisajili kwa barua pepe</link>",
  "complete.title": "Kamilisha wasifu wako",
  "complete.subtitle": "Maelezo machache tunayohitaji kwa kila akaunti ya Kalks. Inachukua chini ya dakika moja.",
  "complete.googleAccount": "Akaunti ya Google",
  "complete.emailTaken": "<signin>Ingia</signin> kwa nenosiri lako badala yake, au <reset>liweke upya</reset>.",
  "complete.ready": "Akaunti yako iko tayari na umeingia kwa Google. Fuatilia masoko moja kwa moja sasa; ufadhili na akaunti za biashara zinakuja hivi karibuni.",
  "complete.notYou": "Si wewe? <link>Tumia akaunti nyingine ya Google</link>",

  // Forgot / reset password
  "forgot.backToSignIn": "Rudi kwenye kuingia",
  "forgot.titleReset": "Weka upya nenosiri lako",
  "forgot.titleCode": "Weka msimbo",
  "forgot.titleNew": "Weka nenosiri jipya",
  "forgot.intro": "Tutakutumia msimbo wa tarakimu 6 kwa barua pepe ili uweke upya nenosiri lako.",
  "forgot.codeSent": "Ikiwa akaunti ipo kwa <b>{email}</b>, tumeitumia msimbo.",
  "forgot.passwordRule": "Tumia angalau herufi 8 zenye mchanganyiko wa herufi, namba na alama.",
  "forgot.sendCode": "Tuma msimbo",
  "forgot.updating": "Inasasisha…",
  "forgot.update": "Sasisha nenosiri",
  "forgot.toastUpdated": "Nenosiri limesasishwa",
  "forgot.toastUpdatedBody": "Ingia kwa nenosiri lako jipya.",

  // Step-up confirmation dialog (emailed code before sensitive changes)
  "stepup.intro": "Ili {what}, weka msimbo wa tarakimu 6 tuliotuma kwa <b>{email}</b>. Unaisha baada ya dakika {minutes}.",
  "stepup.spam": "Hukuupokea? Angalia folda yako ya barua taka.",
  "stepup.checking": "Inakagua…",
  "stepup.saving": "Inahifadhi…",
  "stepup.sendAgain": "Tuma msimbo tena",
  "stepup.sendingCode": "Inatuma msimbo wa uthibitisho kwa barua pepe yako…",
};
export default auth;
