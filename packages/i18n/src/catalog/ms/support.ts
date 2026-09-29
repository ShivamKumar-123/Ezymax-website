import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "Sokongan",
  "page.subtitle": "Berbual dengan Kalks AI untuk jawapan segera. Minta untuk bercakap dengan orang pada bila-bila masa dan pasukan kami akan mengambil alih bersama keseluruhan perbualan.",
  "email.prefer": "Lebih suka e-mel?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "Tulis daripada <email>{email}</email> dan sertakan ID pelanggan anda <id>{id}</id>.",
  "email.write": "Tulis kepada sokongan",
  "email.copyId": "Salin ID pelanggan",
  clientId: "ID pelanggan",
  notice: "Balasan daripada pasukan kami juga dipaparkan dalam loceng pemberitahuan, dan kami akan menghantar e-mel kepada anda apabila anda tiada. Tukar tetapan ini di bawah Profil → Pemberitahuan.",
  "toast.copied": "{what} disalin",
  "toast.copyFailed": "Tidak dapat menyalin, sila pilihnya secara manual",

  // Conversation status
  "status.bot": "Pembantu AI",
  "status.waiting": "Dalam giliran",
  "status.assigned": "Bersama ejen",
  "status.resolved": "Tamat",

  // Conversation history
  "history.title": "Perbualan anda",
  "history.subtitle": "Transkrip disimpan dalam Kawasan Pelanggan anda",
  "history.emptyTitle": "Belum ada perbualan",
  "history.emptyText": "Tanya soalan dalam sembang dan ia akan dipaparkan di sini.",
  conversation: "Perbualan",
  "toast.openFailed": "Tidak dapat membuka perbualan",

  // Floating button
  "launcher.open": "Buka sembang sokongan",
  "launcher.close": "Tutup sembang sokongan",

  // Chat
  you: "Anda",
  agent: "Ejen",
  // Fallback name for a team member without a name
  supportName: "Sokongan",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "Bagaimanakah saya mengesahkan identiti saya?",
  "quick.deposit": "Bagaimanakah saya membuat deposit USDT?",
  "quick.withdrawal": "Bilakah pengeluaran saya akan tiba?",
  "quick.stopOut": "Apakah itu stop-out?",
  "header.supportTeam": "Pasukan sokongan",
  "header.agentSub": "Sokongan Pelanggan · Kalks",
  "header.connecting": "Menghubungkan anda dengan ejen…",
  "header.replySoon": "Pasukan kami akan membalas di sini tidak lama lagi",
  "header.helpCentre": "Jawapan pusat bantuan · orang boleh menyertai bila-bila masa",
  "header.instant": "Jawapan segera · orang boleh menyertai bila-bila masa",
  "chip.liveAgent": "Ejen langsung",
  "menu.aria": "Pilihan sembang",
  "menu.talkToPerson": "Bercakap dengan orang",
  "menu.endChat": "Tamatkan sembang",
  "menu.newChat": "Mulakan sembang baharu",
  closeChat: "Tutup sembang",
  unavailable: "Sembang tidak tersedia buat masa ini.",
  greeting: "Hai {name}.",
  "csat.question": "Bagaimanakah sembang ini?",
  "csat.stars": { other: "{count} bintang" },
  "csat.placeholder": "Ada apa-apa untuk ditambah? (pilihan)",
  "csat.send": "Hantar penilaian",
  "csat.rated": "Anda menilai sembang ini {rating}/5",
  "composer.attach": "Lampirkan fail",
  "composer.messageTo": "Mesej kepada {name}…",
  "composer.newChat": "Mulakan sembang baharu…",
  "composer.ask": "Tanya {name} apa sahaja…",
  "composer.aria": "Mesej",
  disclaimer: "{name} boleh melakukan kesilapan dan tidak sekali-kali memberikan nasihat pelaburan. Sembang dirakam untuk tujuan kualiti.",
  "toast.chattingWith": "Anda sedang berbual dengan {name}",
  "toast.inQueue": "Anda dalam giliran untuk ejen",
  "toast.notSent": "Mesej tidak dihantar",
  "toast.teamUnreachable": "Tidak dapat menghubungi pasukan",
  "toast.endFailed": "Tidak dapat menamatkan sembang",
  "toast.rateFailed": "Penilaian tidak disimpan",
  "toast.thanks": "Terima kasih atas maklum balas anda",
  "toast.fileTooLarge": "Fail terlalu besar",
  "toast.fileTooLargeText": "Saiz fail maksimum ialah {mb} MB.",
  "toast.unsupported": "Fail tidak disokong",
  "toast.unsupportedText": "Lampirkan imej (PNG, JPG, GIF, WEBP) atau PDF.",
  "toast.uploadFailed": "Muat naik gagal",
  "error.uploadFailed": "Muat naik gagal.",
};
export default support;
