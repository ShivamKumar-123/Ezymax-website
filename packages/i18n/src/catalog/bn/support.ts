import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "সাপোর্ট",
  "page.subtitle": "তাৎক্ষণিক উত্তরের জন্য Ezymex AI-এর সাথে চ্যাট করুন। যেকোনো সময় একজন মানুষের সাথে কথা বলতে চাইলে আমাদের টিম পুরো কথোপকথনসহ দায়িত্ব নেবে।",
  "email.prefer": "ইমেইল পছন্দ করেন?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "<email>{email}</email> থেকে লিখুন এবং আপনার ক্লায়েন্ট ID <id>{id}</id> উল্লেখ করুন।",
  "email.write": "সাপোর্টে লিখুন",
  "email.copyId": "ক্লায়েন্ট ID কপি করুন",
  clientId: "ক্লায়েন্ট ID",
  notice: "আমাদের টিমের উত্তর নোটিফিকেশন বেলেও দেখা যায়, আর আপনি অনুপস্থিত থাকলে আমরা ইমেইল পাঠাই। প্রোফাইল → নোটিফিকেশন থেকে এটি পরিবর্তন করুন।",
  "toast.copied": "{what} কপি হয়েছে",
  "toast.copyFailed": "কপি করা যায়নি, অনুগ্রহ করে নিজে সিলেক্ট করুন",

  // Conversation status
  "status.bot": "AI সহকারী",
  "status.waiting": "সারিতে আছে",
  "status.assigned": "এজেন্টের সাথে",
  "status.resolved": "শেষ হয়েছে",

  // Conversation history
  "history.title": "আপনার কথোপকথন",
  "history.subtitle": "ট্রান্সক্রিপ্ট আপনার ক্লায়েন্ট এরিয়াতে সংরক্ষিত থাকে",
  "history.emptyTitle": "এখনও কোনো কথোপকথন নেই",
  "history.emptyText": "চ্যাটে একটি প্রশ্ন করুন, সেটি এখানে দেখা যাবে।",
  conversation: "কথোপকথন",
  "toast.openFailed": "কথোপকথনটি খোলা যায়নি",

  // Floating button
  "launcher.open": "সাপোর্ট চ্যাট খুলুন",
  "launcher.close": "সাপোর্ট চ্যাট বন্ধ করুন",

  // Chat
  you: "আপনি",
  agent: "এজেন্ট",
  // Fallback name for a team member without a name
  supportName: "সাপোর্ট",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "আমি কীভাবে আমার পরিচয় যাচাই করব?",
  "quick.deposit": "আমি কীভাবে USDT জমা করব?",
  "quick.withdrawal": "আমার উত্তোলন কখন পৌঁছাবে?",
  "quick.stopOut": "স্টপ-আউট কী?",
  "header.supportTeam": "সাপোর্ট টিম",
  "header.agentSub": "ক্লায়েন্ট সাপোর্ট · Ezymex",
  "header.connecting": "আপনাকে একজন এজেন্টের সাথে যুক্ত করা হচ্ছে…",
  "header.replySoon": "আমাদের টিম শীঘ্রই এখানে উত্তর দেবে",
  "header.helpCentre": "হেল্প সেন্টারের উত্তর · যেকোনো সময় একজন মানুষ যুক্ত হতে পারেন",
  "header.instant": "তাৎক্ষণিক উত্তর · যেকোনো সময় একজন মানুষ যুক্ত হতে পারেন",
  "chip.liveAgent": "লাইভ এজেন্ট",
  "menu.aria": "চ্যাট অপশন",
  "menu.talkToPerson": "একজন মানুষের সাথে কথা বলুন",
  "menu.endChat": "চ্যাট শেষ করুন",
  "menu.newChat": "নতুন চ্যাট শুরু করুন",
  closeChat: "চ্যাট বন্ধ করুন",
  unavailable: "চ্যাট এই মুহূর্তে উপলব্ধ নয়।",
  greeting: "হ্যালো {name}।",
  "csat.question": "এই চ্যাটটি কেমন ছিল?",
  "csat.stars": { one: "{count} স্টার", other: "{count} স্টার" },
  "csat.placeholder": "আর কিছু যোগ করতে চান? (ঐচ্ছিক)",
  "csat.send": "রেটিং পাঠান",
  "csat.rated": "আপনি এই চ্যাটকে {rating}/5 রেটিং দিয়েছেন",
  "composer.attach": "ফাইল সংযুক্ত করুন",
  "composer.messageTo": "{name}-কে বার্তা লিখুন…",
  "composer.newChat": "নতুন চ্যাট শুরু করুন…",
  "composer.ask": "{name}-কে যেকোনো প্রশ্ন করুন…",
  "composer.aria": "বার্তা",
  disclaimer: "{name} ভুল করতে পারে এবং কখনো বিনিয়োগ পরামর্শ দেয় না। মান নিশ্চিত করতে চ্যাট রেকর্ড করা হয়।",
  "toast.chattingWith": "আপনি {name}-এর সাথে চ্যাট করছেন",
  "toast.inQueue": "আপনি একজন এজেন্টের জন্য সারিতে আছেন",
  "toast.notSent": "বার্তা পাঠানো হয়নি",
  "toast.teamUnreachable": "টিমের সাথে যোগাযোগ করা যায়নি",
  "toast.endFailed": "চ্যাট শেষ করা যায়নি",
  "toast.rateFailed": "রেটিং সংরক্ষিত হয়নি",
  "toast.thanks": "আপনার মতামতের জন্য ধন্যবাদ",
  "toast.fileTooLarge": "ফাইল অনেক বড়",
  "toast.fileTooLargeText": "ফাইল সর্বোচ্চ {mb} MB পর্যন্ত হতে পারে।",
  "toast.unsupported": "অসমর্থিত ফাইল",
  "toast.unsupportedText": "একটি ছবি (PNG, JPG, GIF, WEBP) বা একটি PDF সংযুক্ত করুন।",
  "toast.uploadFailed": "আপলোড ব্যর্থ হয়েছে",
  "error.uploadFailed": "আপলোড ব্যর্থ হয়েছে।",
};
export default support;
