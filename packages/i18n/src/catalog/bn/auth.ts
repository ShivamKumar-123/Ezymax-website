import type { NsMessages } from "../../core";

const auth: NsMessages<"auth"> = {
  // Shared form fields
  "field.email": "ইমেইল",
  "field.emailOrViewer": "ইমেইল বা ভিউয়ার আইডি",
  "field.password": "পাসওয়ার্ড",
  "field.newPassword": "নতুন পাসওয়ার্ড",
  "field.firstName": "নামের প্রথম অংশ",
  "field.lastName": "নামের শেষ অংশ",
  "field.country": "বসবাসের দেশ",
  "field.phone": "ফোন",
  "field.dateOfBirth": "জন্ম তারিখ",
  "field.referralCode": "রেফারেল কোড",
  "field.optionalHint": "ঐচ্ছিক",
  "placeholder.email": "you@example.com",
  "placeholder.createPassword": "একটি শক্তিশালী পাসওয়ার্ড দিন",
  "togglePassword": "পাসওয়ার্ড দেখান/লুকান",

  // Shared OTP / code step
  "otp.didntGetIt": "কোড পাননি?",
  "otp.verifying": "যাচাই করা হচ্ছে…",
  "otp.resendIn": "0:{seconds} পরে আবার পাঠান",
  "otp.sending": "পাঠানো হচ্ছে…",
  "otp.resendCode": "কোড আবার পাঠান",
  "otp.devHint": "ডেভ মোড: ইমেইল পাঠানো এখনো কনফিগার করা হয়নি। আপনার কোড <code>{code}</code> (গেটওয়ে লগেও আছে)।",
  "toast.newCodeSent": "নতুন কোড পাঠানো হয়েছে",
  "toast.checkEmail": "{email} দেখুন",

  // Google sign-in
  "google.continue": "Google দিয়ে চালিয়ে যান",
  "google.signUp": "Google দিয়ে সাইন আপ করুন",
  "google.opening": "Google খোলা হচ্ছে…",
  "google.orWithEmail": "অথবা ইমেইল দিয়ে",
  "google.error.cancelled": "Google সাইন-ইন বাতিল করা হয়েছে। চালিয়ে যেতে একটি অ্যাকাউন্ট বেছে নিন, অথবা নিচে আপনার ইমেইল ব্যবহার করুন।",
  "google.error.expired": "আপনার Google সাইন-ইনের সময় শেষ হয়ে গেছে অথবা এটি অন্য ট্যাবে খোলা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
  "google.error.unverified": "আপনার Google অ্যাকাউন্টের ইমেইল ঠিকানা যাচাই করা হয়নি। Google-এ এটি যাচাই করুন, অথবা নিচে আপনার ইমেইল ব্যবহার করুন।",
  "google.error.conflict": "এই ইমেইলটি ইতিমধ্যে অন্য একটি Google অ্যাকাউন্টের সাথে যুক্ত। সেই Google অ্যাকাউন্ট ব্যবহার করুন, অথবা পাসওয়ার্ড দিয়ে সাইন ইন করুন।",
  "google.error.disabled": "এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অনুগ্রহ করে সাপোর্টে যোগাযোগ করুন।",
  "google.error.rate_limited": "অনেকবার সাইন-ইনের চেষ্টা করা হয়েছে। কয়েক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।",
  "google.error.unavailable": "Google সাইন-ইন এই মুহূর্তে উপলব্ধ নয়। কিছুক্ষণ পরে আবার চেষ্টা করুন, অথবা আপনার ইমেইল ব্যবহার করুন।",
  "google.error.failed": "Google দিয়ে আপনাকে সাইন ইন করানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",

  // Password strength meter
  "strength.rule": "8+ অক্ষর, বড় হাতের অক্ষর, সংখ্যা ও চিহ্ন",
  "strength.tooWeak": "খুব দুর্বল",
  "strength.weak": "দুর্বল",
  "strength.fair": "মোটামুটি",
  "strength.good": "ভালো",
  "strength.strong": "শক্তিশালী",

  // Demo entry card (demo builds only)
  "demo.title": "এটি Kalks ডেমো",
  "demo.body": "কোনো অ্যাকাউন্টের প্রয়োজন নেই। প্রতিটি স্ক্রিন নমুনা ডেটায় চলে।",
  "demo.enter": "ডেমোতে প্রবেশ করুন",

  // Auth layout brand panel
  "brand.headline": "প্রাতিষ্ঠানিক নির্ভুলতায় বৈশ্বিক মার্কেটে ট্রেড করুন।",
  "brand.body": "ফরেক্স, মেটাল, সূচক, এনার্জি, ক্রিপ্টো ও স্টক — তাৎক্ষণিক USDT ফান্ডিং, ট্রেডিং, কপি ও পার্টনারশিপের জন্য একটি অ্যাকাউন্ট।",
  "brand.previewAlt": "Kalks ক্লায়েন্ট এরিয়া ড্যাশবোর্ড",

  // Sign in
  "login.title": "আবার স্বাগতম",
  "login.subtitle": "আপনার Kalks ক্লায়েন্ট এরিয়ায় সাইন ইন করুন।",
  "login.forgot": "পাসওয়ার্ড ভুলে গেছেন?",
  "login.signingIn": "সাইন ইন হচ্ছে…",
  "login.signIn": "সাইন ইন",
  "login.newToKalks": "Kalks-এ নতুন? <link>অ্যাকাউন্ট তৈরি করুন</link>",
  "login.verifyEmailTitle": "আপনার ইমেইল যাচাই করুন",
  "login.verifyDeviceTitle": "নিশ্চিত করুন যে এটি আপনি",
  "login.emailNotVerified": "আপনার ইমেইল এখনো যাচাই করা হয়নি।",
  "login.newDevice": "নতুন ডিভাইস শনাক্ত হয়েছে।",
  "login.codeSent": "আমরা <b>{email}</b>-এ একটি 6-সংখ্যার কোড পাঠিয়েছি।",
  "login.verifyContinue": "যাচাই করে চালিয়ে যান",
  "login.back": "← ফিরে যান",

  // Sign up
  "register.stepDetails": "বিবরণ",
  "register.stepVerify": "ইমেইল যাচাই",
  "register.stepDone": "সম্পন্ন",
  "register.title": "আপনার Kalks অ্যাকাউন্ট তৈরি করুন",
  "register.subtitleDemo": "এখনই একটি ফ্রি ডেমো খুলুন। প্রস্তুত হলে যেকোনো সময় লাইভে যান।",
  "register.subtitle": "এক মিনিটে সাইন আপ করুন এবং সঙ্গে সঙ্গে লাইভ মার্কেট দেখুন।",
  "register.emailTaken": "<signin>সাইন ইন করুন</signin> অথবা <reset>পাসওয়ার্ড রিসেট করুন</reset>।",
  "register.terms": "আমার বয়স 18-এর বেশি এবং আমি <agreement>ক্লায়েন্ট চুক্তি</agreement>, <risk>ঝুঁকি প্রকাশ</risk> ও <privacy>গোপনীয়তা নীতি</privacy>-তে সম্মত।",
  "register.creating": "অ্যাকাউন্ট তৈরি হচ্ছে…",
  "register.create": "অ্যাকাউন্ট তৈরি করুন",
  "register.haveAccount": "ইতিমধ্যে অ্যাকাউন্ট আছে? <link>সাইন ইন করুন</link>",
  "register.checkInbox": "আপনার ইনবক্স দেখুন",
  "register.enterCode": "<b>{email}</b>-এ পাঠানো 6-সংখ্যার কোডটি লিখুন।",
  "register.verifyEmail": "ইমেইল যাচাই করুন",
  "register.welcome": "Kalks-এ স্বাগতম, {name}",
  "register.readyDemo": "আপনার ইমেইল যাচাই হয়েছে এবং অ্যাকাউন্ট প্রস্তুত। এখনই একটি ডেমো অ্যাকাউন্ট খুলুন, অথবা লাইভে যেতে আপনার পরিচয় যাচাই করুন।",
  "register.ready": "আপনার ইমেইল যাচাই হয়েছে এবং অ্যাকাউন্ট প্রস্তুত। এখনই লাইভ মার্কেট দেখুন; ফান্ডিং ও ট্রেডিং অ্যাকাউন্ট শীঘ্রই আসছে।",
  "register.openClientArea": "ক্লায়েন্ট এরিয়া খুলুন",

  // Complete profile after Google sign-up
  "complete.stepGoogle": "Google অ্যাকাউন্ট",
  "complete.stepDetails": "আপনার বিবরণ",
  "complete.loading": "আপনার Google প্রোফাইল লোড হচ্ছে…",
  "complete.expiredTitle": "আবার শুরু করা যাক",
  "complete.accountExists": "আপনার অ্যাকাউন্ট ইতিমধ্যে তৈরি আছে। সাইন ইন করতে Google দিয়ে চালিয়ে যান।",
  "complete.expired": "আপনার Google সাইন-আপের মেয়াদ শেষ হয়েছে অথবা অন্য ট্যাবে সম্পন্ন হয়েছে। যেখানে ছেড়েছিলেন সেখান থেকে শুরু করতে Google দিয়ে চালিয়ে যান।",
  "complete.preferEmail": "ইমেইল পছন্দ করেন? <link>ইমেইল দিয়ে সাইন আপ করুন</link>",
  "complete.title": "আপনার প্রোফাইল সম্পূর্ণ করুন",
  "complete.subtitle": "প্রতিটি Kalks অ্যাকাউন্টের জন্য কয়েকটি তথ্য প্রয়োজন। এক মিনিটেরও কম সময় লাগবে।",
  "complete.googleAccount": "Google অ্যাকাউন্ট",
  "complete.emailTaken": "এর পরিবর্তে পাসওয়ার্ড দিয়ে <signin>সাইন ইন করুন</signin>, অথবা <reset>পাসওয়ার্ড রিসেট করুন</reset>।",
  "complete.ready": "আপনার অ্যাকাউন্ট প্রস্তুত এবং Google দিয়ে সাইন ইন করা হয়েছে। এখনই লাইভ মার্কেট দেখুন; ফান্ডিং ও ট্রেডিং অ্যাকাউন্ট শীঘ্রই আসছে।",
  "complete.notYou": "আপনি নন? <link>অন্য Google অ্যাকাউন্ট ব্যবহার করুন</link>",

  // Forgot / reset password
  "forgot.backToSignIn": "সাইন ইনে ফিরে যান",
  "forgot.titleReset": "আপনার পাসওয়ার্ড রিসেট করুন",
  "forgot.titleCode": "কোডটি লিখুন",
  "forgot.titleNew": "নতুন পাসওয়ার্ড সেট করুন",
  "forgot.intro": "পাসওয়ার্ড রিসেট করতে আমরা আপনাকে একটি 6-সংখ্যার কোড ইমেইল করব।",
  "forgot.codeSent": "<b>{email}</b>-এর জন্য কোনো অ্যাকাউন্ট থাকলে আমরা সেখানে একটি কোড পাঠিয়েছি।",
  "forgot.passwordRule": "অক্ষর, সংখ্যা ও চিহ্ন মিলিয়ে অন্তত 8টি অক্ষর ব্যবহার করুন।",
  "forgot.sendCode": "কোড পাঠান",
  "forgot.updating": "আপডেট হচ্ছে…",
  "forgot.update": "পাসওয়ার্ড আপডেট করুন",
  "forgot.toastUpdated": "পাসওয়ার্ড আপডেট হয়েছে",
  "forgot.toastUpdatedBody": "নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন।",

  // Step-up confirmation dialog (emailed code before sensitive changes)
  // {what} is a translated action phrase such as "#10000123-এর লিভারেজ পরিবর্তন"
  "stepup.intro": "{what} নিশ্চিত করতে <b>{email}</b>-এ পাঠানো 6-সংখ্যার কোডটি লিখুন। এর মেয়াদ {minutes} মিনিট।",
  "stepup.spam": "কোড পাননি? আপনার স্প্যাম ফোল্ডার দেখুন।",
  "stepup.checking": "যাচাই করা হচ্ছে…",
  "stepup.saving": "সংরক্ষণ হচ্ছে…",
  "stepup.sendAgain": "কোডটি আবার পাঠান",
  "stepup.sendingCode": "আপনার ইমেইলে একটি নিশ্চিতকরণ কোড পাঠানো হচ্ছে…",
};
export default auth;
