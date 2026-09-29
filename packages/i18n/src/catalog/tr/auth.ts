import type { NsMessages } from "../../core";

const auth: NsMessages<"auth"> = {
  // Shared form fields
  "field.email": "E-posta",
  "field.emailOrViewer": "E-posta veya izleyici ID",
  "field.password": "Şifre",
  "field.newPassword": "Yeni şifre",
  "field.firstName": "Ad",
  "field.lastName": "Soyad",
  "field.country": "İkamet ülkesi",
  "field.phone": "Telefon",
  "field.dateOfBirth": "Doğum tarihi",
  "field.referralCode": "Referans kodu",
  "field.optionalHint": "isteğe bağlı",
  "placeholder.email": "siz@ornek.com",
  "placeholder.createPassword": "Güçlü bir şifre oluşturun",
  "togglePassword": "Şifreyi göster/gizle",

  // Shared OTP / code step
  "otp.didntGetIt": "Kod gelmedi mi?",
  "otp.verifying": "Doğrulanıyor…",
  "otp.resendIn": "0:{seconds} sonra tekrar gönder",
  "otp.sending": "Gönderiliyor…",
  "otp.resendCode": "Kodu tekrar gönder",
  "otp.devHint": "Geliştirici modu: e-posta gönderimi henüz yapılandırılmadı. Kodunuz <code>{code}</code> (gateway günlüğünde de yer alır).",
  "toast.newCodeSent": "Yeni kod gönderildi",
  "toast.checkEmail": "{email} adresini kontrol edin",

  // Google sign-in
  "google.continue": "Google ile devam et",
  "google.signUp": "Google ile kaydol",
  "google.opening": "Google açılıyor…",
  "google.orWithEmail": "veya e-posta ile",
  "google.error.cancelled": "Google ile giriş iptal edildi. Devam etmek için bir hesap seçin veya aşağıdan e-postanızı kullanın.",
  "google.error.expired": "Google ile girişin süresi doldu veya başka bir sekmede açıldı. Lütfen tekrar deneyin.",
  "google.error.unverified": "Google hesabınızın e-posta adresi doğrulanmamış. Google üzerinden doğrulayın veya aşağıdan e-postanızı kullanın.",
  "google.error.conflict": "Bu e-posta farklı bir Google hesabına bağlı. O Google hesabını kullanın veya şifrenizle giriş yapın.",
  "google.error.disabled": "Bu hesap devre dışı. Lütfen destek ekibiyle iletişime geçin.",
  "google.error.rate_limited": "Çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.",
  "google.error.unavailable": "Google ile giriş şu anda kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin veya e-postanızı kullanın.",
  "google.error.failed": "Google ile girişinizi gerçekleştiremedik. Lütfen tekrar deneyin.",

  // Password strength meter
  "strength.rule": "En az 8 karakter, büyük harf, rakam ve sembol",
  "strength.tooWeak": "Çok zayıf",
  "strength.weak": "Zayıf",
  "strength.fair": "Orta",
  "strength.good": "İyi",
  "strength.strong": "Güçlü",

  // Demo entry card (demo builds only)
  "demo.title": "Bu, Kalks demosudur",
  "demo.body": "Hesap gerekmez. Tüm ekranlar örnek verilerle çalışır.",
  "demo.enter": "Demoya gir",

  // Auth layout brand panel
  "brand.headline": "Küresel piyasalarda kurumsal hassasiyetle işlem yapın.",
  "brand.body": "Forex, metaller, endeksler, enerji, kripto ve hisse senetleri: anında USDT ile fonlama, işlem, kopyalama ve ortaklık için tek hesap.",
  "brand.previewAlt": "Kalks müşteri alanı gösterge paneli",

  // Sign in
  "login.title": "Tekrar hoş geldiniz",
  "login.subtitle": "Kalks müşteri alanınıza giriş yapın.",
  "login.forgot": "Şifrenizi mi unuttunuz?",
  "login.signingIn": "Giriş yapılıyor…",
  "login.signIn": "Giriş yap",
  "login.newToKalks": "Kalks'ta yeni misiniz? <link>Hesap oluşturun</link>",
  "login.verifyEmailTitle": "E-postanızı doğrulayın",
  "login.verifyDeviceTitle": "Siz olduğunuzu doğrulayın",
  "login.emailNotVerified": "E-postanız henüz doğrulanmadı.",
  "login.newDevice": "Yeni cihaz algılandı.",
  "login.codeSent": "<b>{email}</b> adresine 6 haneli bir kod gönderdik.",
  "login.verifyContinue": "Doğrula ve devam et",
  "login.back": "← Geri",

  // Sign up
  "register.stepDetails": "Bilgiler",
  "register.stepVerify": "E-posta doğrulama",
  "register.stepDone": "Tamam",
  "register.title": "Kalks hesabınızı oluşturun",
  "register.subtitleDemo": "Hemen ücretsiz bir demo hesap açın. Hazır olduğunuzda gerçek hesaba geçin.",
  "register.subtitle": "Bir dakikada kaydolun ve canlı piyasaları hemen takip edin.",
  "register.emailTaken": "<signin>Giriş yapın</signin> veya <reset>şifrenizi sıfırlayın</reset>.",
  "register.terms": "18 yaşından büyük olduğumu ve <agreement>Müşteri Sözleşmesi</agreement>, <risk>Risk Bildirimi</risk> ile <privacy>Gizlilik Politikası</privacy>'nı kabul ettiğimi onaylıyorum.",
  "register.creating": "Hesap oluşturuluyor…",
  "register.create": "Hesap oluştur",
  "register.haveAccount": "Zaten hesabınız var mı? <link>Giriş yapın</link>",
  "register.checkInbox": "Gelen kutunuzu kontrol edin",
  "register.enterCode": "<b>{email}</b> adresine gönderdiğimiz 6 haneli kodu girin.",
  "register.verifyEmail": "E-postayı doğrula",
  "register.welcome": "Kalks'a hoş geldiniz, {name}",
  "register.readyDemo": "E-postanız doğrulandı ve hesabınız hazır. Şimdi bir demo hesap açın veya gerçek hesaba geçmek için kimliğinizi doğrulayın.",
  "register.ready": "E-postanız doğrulandı ve hesabınız hazır. Bir işlem hesabı açın, cüzdanınıza para yatırın ve işlem yapmaya başlayın.",
  "register.openClientArea": "Müşteri alanını aç",

  // Complete profile after Google sign-up
  "complete.stepGoogle": "Google hesabı",
  "complete.stepDetails": "Bilgileriniz",
  "complete.loading": "Google profiliniz yükleniyor…",
  "complete.expiredTitle": "Yeniden başlayalım",
  "complete.accountExists": "Hesabınız zaten oluşturulmuş. Giriş yapmak için Google ile devam edin.",
  "complete.expired": "Google ile kaydınızın süresi doldu veya başka bir sekmede tamamlandı. Kaldığınız yerden devam etmek için Google ile devam edin.",
  "complete.preferEmail": "E-postayı mı tercih edersiniz? <link>E-posta ile kaydolun</link>",
  "complete.title": "Profilinizi tamamlayın",
  "complete.subtitle": "Her Kalks hesabı için gereken birkaç bilgi. Bir dakikadan kısa sürer.",
  "complete.googleAccount": "Google hesabı",
  "complete.emailTaken": "Bunun yerine şifrenizle <signin>giriş yapın</signin> veya <reset>şifrenizi sıfırlayın</reset>.",
  "complete.ready": "Hesabınız hazır ve Google ile oturum açıldı. Bir işlem hesabı açın, cüzdanınıza para yatırın ve işlem yapmaya başlayın.",
  "complete.notYou": "Siz değil misiniz? <link>Başka bir Google hesabı kullanın</link>",

  // Forgot / reset password
  "forgot.backToSignIn": "Girişe dön",
  "forgot.titleReset": "Şifrenizi sıfırlayın",
  "forgot.titleCode": "Kodu girin",
  "forgot.titleNew": "Yeni şifre belirleyin",
  "forgot.intro": "Şifrenizi sıfırlamanız için size 6 haneli bir kod e-postalayacağız.",
  "forgot.codeSent": "<b>{email}</b> için bir hesap varsa, bu adrese bir kod gönderdik.",
  "forgot.passwordRule": "Harf, rakam ve sembollerden oluşan en az 8 karakter kullanın.",
  "forgot.sendCode": "Kod gönder",
  "forgot.updating": "Güncelleniyor…",
  "forgot.update": "Şifreyi güncelle",
  "forgot.toastUpdated": "Şifre güncellendi",
  "forgot.toastUpdatedBody": "Yeni şifrenizle giriş yapın.",

  // Step-up confirmation dialog
  // {what} is a translated action phrase
  "stepup.intro": "{what} için <b>{email}</b> adresine gönderdiğimiz 6 haneli kodu girin. Kodun süresi {minutes} dakika içinde dolar.",
  "stepup.spam": "Kod gelmedi mi? Spam klasörünüzü kontrol edin.",
  "stepup.checking": "Kontrol ediliyor…",
  "stepup.saving": "Kaydediliyor…",
  "stepup.sendAgain": "Kodu tekrar gönder",
  "stepup.sendingCode": "E-postanıza onay kodu gönderiliyor…",
  "otp.digit": "Rakam {n}/{total}",
};
export default auth;
