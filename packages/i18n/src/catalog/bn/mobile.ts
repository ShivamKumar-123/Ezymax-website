import type { NsMessages } from "../../core";

// Kalks mobile app: app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "হোম",
  "tab.markets": "মার্কেট",
  "tab.trade": "ট্রেড",
  "tab.portfolio": "পোর্টফোলিও",
  "tab.more": "আরও",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "এড়িয়ে যান",
  "onboarding.next": "পরবর্তী",
  "onboarding.getStarted": "শুরু করুন",
  "onboarding.haveAccount": "আমার অ্যাকাউন্ট আছে",
  "onboarding.welcome.title": "মার্কেটে পা রাখুন",
  "onboarding.welcome.body": "ফরেক্স, মেটাল, সূচক, এনার্জি, ক্রিপ্টো ও স্টক এক অ্যাকাউন্টে, তাৎক্ষণিক USDT ফান্ডিংসহ।",
  "onboarding.markets.title": "প্রতিটি টিক, লাইভ",
  "onboarding.markets.body": "আসল বিড ও আস্ক প্রাইস, আপনার নিজের চার্ট আর এক ট্যাপে ক্রয় ও বিক্রয়, ফোনের জন্যই তৈরি।",
  "onboarding.security.title": "সম্পূর্ণ সুরক্ষিত",
  "onboarding.security.body": "নতুন ডিভাইসে ইমেইল কোড, উত্তোলনে নিশ্চিতকরণ কোড এবং আপনার সেশনের জন্য সুরক্ষিত ভল্ট।",
  // Slide counter, e.g. "1 of 3"
  "onboarding.step": "{total}-এর মধ্যে {n}",

  // Shared states
  "state.offline.title": "সংযোগ বিচ্ছিন্ন",
  "state.offline.body": "আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন। প্রাইস ও আপনার অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে আবার সংযুক্ত হবে।",
  "state.reconnecting": "আবার সংযোগ করা হচ্ছে…",
  "state.error.title": "কিছু একটা ভুল হয়েছে",
  "state.error.body": "এটি লোড করা যায়নি। আবার চেষ্টা করতে নিচে টানুন বা ট্যাপ করুন।",
  "state.maintenance.title": "রক্ষণাবেক্ষণ চলছে",
  "state.maintenance.body": "আমরা Kalks আপগ্রেড করছি। আপনার পজিশন ও ফান্ড নিরাপদ আছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার দেখুন।",
  "state.sessionExpired": "আপনার সেশন শেষ হয়েছে। অনুগ্রহ করে আবার সাইন ইন করুন।",
  "state.updated": "আপডেট: {time}",
  "state.pullToRefresh": "রিফ্রেশ করতে নিচে টানুন",

  viewOnly: "শুধু দেখার অ্যাক্সেস",
  viewOnlyBody: "এই লগইন শেয়ার করা অ্যাকাউন্ট দেখতে পারে, কিন্তু কোনো পরিবর্তন করতে পারে না।",

  // Common short labels
  "action.retry": "আবার চেষ্টা করুন",
  "action.openWeb": "ক্লায়েন্ট এরিয়ায় খুলুন",
  "action.signOut": "সাইন আউট",
  "action.seeAll": "সব দেখুন",
  "a11y.close": "বন্ধ করুন",
  "a11y.back": "ফিরে যান",
};
export default mobile;
