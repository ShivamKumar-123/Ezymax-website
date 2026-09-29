import type { NsMessages } from "../../core";

const auth: NsMessages<"auth"> = {
  // Shared form fields
  "field.email": "البريد الإلكتروني",
  "field.emailOrViewer": "البريد الإلكتروني أو معرّف المشاهد",
  "field.password": "كلمة المرور",
  "field.newPassword": "كلمة المرور الجديدة",
  "field.firstName": "الاسم الأول",
  "field.lastName": "اسم العائلة",
  "field.country": "بلد الإقامة",
  "field.phone": "الهاتف",
  "field.dateOfBirth": "تاريخ الميلاد",
  "field.referralCode": "رمز الإحالة",
  "field.optionalHint": "اختياري",
  "placeholder.email": "you@example.com",
  "placeholder.createPassword": "أنشئ كلمة مرور قوية",
  "togglePassword": "إظهار/إخفاء كلمة المرور",

  // Shared OTP / code step
  "otp.didntGetIt": "لم يصلك الرمز؟",
  "otp.verifying": "جارٍ التحقق…",
  "otp.resendIn": "إعادة الإرسال خلال 0:{seconds}",
  "otp.sending": "جارٍ الإرسال…",
  "otp.resendCode": "إعادة إرسال الرمز",
  "otp.devHint": "وضع التطوير: لم يتم إعداد إرسال البريد الإلكتروني بعد. رمزك هو <code>{code}</code> (وهو موجود أيضًا في سجل البوابة).",
  "toast.newCodeSent": "تم إرسال رمز جديد",
  "toast.checkEmail": "تحقق من {email}",

  // Google sign-in
  "google.continue": "المتابعة باستخدام Google",
  "google.signUp": "التسجيل باستخدام Google",
  "google.opening": "جارٍ فتح Google…",
  "google.orWithEmail": "أو بالبريد الإلكتروني",
  "google.error.cancelled": "تم إلغاء تسجيل الدخول عبر Google. اختر حسابًا للمتابعة، أو استخدم بريدك الإلكتروني أدناه.",
  "google.error.expired": "انتهت مهلة تسجيل الدخول عبر Google أو تم فتحه في علامة تبويب أخرى. يرجى المحاولة مرة أخرى.",
  "google.error.unverified": "عنوان البريد الإلكتروني لحسابك في Google غير موثّق. وثّقه لدى Google، أو استخدم بريدك الإلكتروني أدناه.",
  "google.error.conflict": "هذا البريد الإلكتروني مرتبط بالفعل بحساب Google آخر. استخدم حساب Google ذلك، أو سجّل الدخول بكلمة المرور.",
  "google.error.disabled": "هذا الحساب معطّل. يرجى التواصل مع الدعم.",
  "google.error.rate_limited": "محاولات تسجيل دخول كثيرة جدًا. يرجى الانتظار بضع دقائق والمحاولة مرة أخرى.",
  "google.error.unavailable": "تسجيل الدخول عبر Google غير متاح حاليًا. يرجى المحاولة بعد قليل، أو استخدم بريدك الإلكتروني.",
  "google.error.failed": "تعذّر تسجيل دخولك عبر Google. يرجى المحاولة مرة أخرى.",

  // Password strength meter
  "strength.rule": "8 أحرف أو أكثر، حرف كبير، رقم ورمز",
  "strength.tooWeak": "ضعيفة جدًا",
  "strength.weak": "ضعيفة",
  "strength.fair": "مقبولة",
  "strength.good": "جيدة",
  "strength.strong": "قوية",

  // Demo entry card (demo builds only)
  "demo.title": "هذه هي النسخة التجريبية من Kalks",
  "demo.body": "لا حاجة إلى حساب. جميع الشاشات تعمل ببيانات نموذجية.",
  "demo.enter": "دخول النسخة التجريبية",

  // Auth layout brand panel
  "brand.headline": "تداول في الأسواق العالمية بدقة مؤسسية.",
  "brand.body": "الفوركس والمعادن والمؤشرات والطاقة والعملات المشفرة والأسهم — تمويل فوري عبر USDT، وحساب واحد للتداول والنسخ والشراكة.",
  "brand.previewAlt": "لوحة تحكم منطقة العملاء في Kalks",

  // Sign in
  "login.title": "مرحبًا بعودتك",
  "login.subtitle": "سجّل الدخول إلى منطقة العملاء في Kalks.",
  "login.forgot": "نسيت كلمة المرور؟",
  "login.signingIn": "جارٍ تسجيل الدخول…",
  "login.signIn": "تسجيل الدخول",
  "login.newToKalks": "جديد في Kalks؟ <link>أنشئ حسابًا</link>",
  "login.verifyEmailTitle": "تحقّق من بريدك الإلكتروني",
  "login.verifyDeviceTitle": "تأكيد هويتك",
  "login.emailNotVerified": "لم يتم التحقق من بريدك الإلكتروني بعد.",
  "login.newDevice": "تم اكتشاف جهاز جديد.",
  "login.codeSent": "أرسلنا رمزًا مكوّنًا من 6 أرقام إلى <b>{email}</b>.",
  "login.verifyContinue": "تحقّق وتابع",
  "login.back": "→ رجوع",

  // Sign up
  "register.stepDetails": "البيانات",
  "register.stepVerify": "التحقق من البريد",
  "register.stepDone": "تم",
  "register.title": "أنشئ حسابك في Kalks",
  "register.subtitleDemo": "افتح حسابًا تجريبيًا مجانيًا فورًا، وانتقل إلى الحساب الحقيقي متى كنت مستعدًا.",
  "register.subtitle": "سجّل خلال دقيقة وتابع الأسواق المباشرة على الفور.",
  "register.emailTaken": "<signin>سجّل الدخول</signin> أو <reset>أعد تعيين كلمة المرور</reset>.",
  "register.terms": "أقرّ بأن عمري يزيد عن 18 عامًا وأوافق على <agreement>اتفاقية العميل</agreement> و<risk>الإفصاح عن المخاطر</risk> و<privacy>سياسة الخصوصية</privacy>.",
  "register.creating": "جارٍ إنشاء الحساب…",
  "register.create": "إنشاء حساب",
  "register.haveAccount": "لديك حساب بالفعل؟ <link>سجّل الدخول</link>",
  "register.checkInbox": "تحقّق من صندوق الوارد",
  "register.enterCode": "أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى <b>{email}</b>.",
  "register.verifyEmail": "تحقّق من البريد",
  "register.welcome": "مرحبًا بك في Kalks، {name}",
  "register.readyDemo": "تم التحقق من بريدك الإلكتروني وحسابك جاهز. افتح حسابًا تجريبيًا الآن، أو تحقّق من هويتك للانتقال إلى التداول الحقيقي.",
  "register.ready": "تم التحقق من بريدك الإلكتروني وحسابك جاهز. تابع الأسواق المباشرة الآن؛ التمويل وحسابات التداول قادمة قريبًا.",
  "register.openClientArea": "فتح منطقة العملاء",

  // Complete profile after Google sign-up
  "complete.stepGoogle": "حساب Google",
  "complete.stepDetails": "بياناتك",
  "complete.loading": "جارٍ تحميل ملفك في Google…",
  "complete.expiredTitle": "لنبدأ من جديد",
  "complete.accountExists": "حسابك مُعدّ بالفعل. تابع باستخدام Google لتسجيل الدخول.",
  "complete.expired": "انتهت صلاحية تسجيلك عبر Google أو تم إكماله في علامة تبويب أخرى. تابع باستخدام Google لإكمال ما بدأته.",
  "complete.preferEmail": "تفضّل البريد الإلكتروني؟ <link>سجّل بالبريد الإلكتروني</link>",
  "complete.title": "أكمل ملفك الشخصي",
  "complete.subtitle": "بعض البيانات التي نحتاجها لكل حساب في Kalks. يستغرق ذلك أقل من دقيقة.",
  "complete.googleAccount": "حساب Google",
  "complete.emailTaken": "<signin>سجّل الدخول</signin> بكلمة المرور بدلًا من ذلك، أو <reset>أعد تعيينها</reset>.",
  "complete.ready": "حسابك جاهز وتم تسجيل دخولك عبر Google. تابع الأسواق المباشرة الآن؛ التمويل وحسابات التداول قادمة قريبًا.",
  "complete.notYou": "لست أنت؟ <link>استخدم حساب Google آخر</link>",

  // Forgot / reset password
  "forgot.backToSignIn": "العودة إلى تسجيل الدخول",
  "forgot.titleReset": "إعادة تعيين كلمة المرور",
  "forgot.titleCode": "أدخل الرمز",
  "forgot.titleNew": "تعيين كلمة مرور جديدة",
  "forgot.intro": "سنرسل إليك رمزًا مكوّنًا من 6 أرقام عبر البريد الإلكتروني لإعادة تعيين كلمة المرور.",
  "forgot.codeSent": "إذا كان هناك حساب مرتبط بـ <b>{email}</b>، فقد أرسلنا إليه رمزًا.",
  "forgot.passwordRule": "استخدم 8 أحرف على الأقل تجمع بين الحروف والأرقام والرموز.",
  "forgot.sendCode": "إرسال الرمز",
  "forgot.updating": "جارٍ التحديث…",
  "forgot.update": "تحديث كلمة المرور",
  "forgot.toastUpdated": "تم تحديث كلمة المرور",
  "forgot.toastUpdatedBody": "سجّل الدخول بكلمة المرور الجديدة.",

  // Step-up confirmation dialog (emailed code before sensitive changes)
  "stepup.intro": "لتأكيد {what}، أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى <b>{email}</b>. تنتهي صلاحيته خلال {minutes} دقيقة.",
  "stepup.spam": "لم يصلك الرمز؟ تحقّق من مجلد الرسائل غير المرغوب فيها.",
  "stepup.checking": "جارٍ التحقق…",
  "stepup.saving": "جارٍ الحفظ…",
  "stepup.sendAgain": "إرسال الرمز مرة أخرى",
  "stepup.sendingCode": "جارٍ إرسال رمز التأكيد إلى بريدك الإلكتروني…",
};
export default auth;
