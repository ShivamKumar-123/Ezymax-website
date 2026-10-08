import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "Dukungan",
  "page.subtitle": "Chat dengan Ezymex AI untuk jawaban instan. Minta berbicara dengan staf kapan saja dan tim kami akan melanjutkan dengan seluruh percakapan.",
  "email.prefer": "Lebih suka email?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "Kirim dari <email>{email}</email> dan sertakan ID klien Anda <id>{id}</id>.",
  "email.write": "Kirim email ke dukungan",
  "email.copyId": "Salin ID klien",
  clientId: "ID klien",
  notice: "Balasan dari tim kami juga muncul di lonceng notifikasi, dan kami mengirim email saat Anda tidak aktif. Ubah ini di Profil → Notifikasi.",
  "toast.copied": "{what} tersalin",
  "toast.copyFailed": "Tidak dapat menyalin, silakan pilih secara manual",

  // Conversation status
  "status.bot": "Asisten AI",
  "status.waiting": "Dalam antrean",
  "status.assigned": "Dengan agen",
  "status.resolved": "Berakhir",

  // Conversation history
  "history.title": "Percakapan Anda",
  "history.subtitle": "Transkrip disimpan di Client Area Anda",
  "history.emptyTitle": "Belum ada percakapan",
  "history.emptyText": "Ajukan pertanyaan di chat dan percakapan akan muncul di sini.",
  conversation: "Percakapan",
  "toast.openFailed": "Tidak dapat membuka percakapan",

  // Floating button
  "launcher.open": "Buka chat dukungan",
  "launcher.close": "Tutup chat dukungan",

  // Chat
  you: "Anda",
  agent: "Agen",
  // Fallback name for a team member without a name
  supportName: "Dukungan",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "Bagaimana cara memverifikasi identitas saya?",
  "quick.deposit": "Bagaimana cara deposit USDT?",
  "quick.withdrawal": "Kapan penarikan saya akan diterima?",
  "quick.stopOut": "Apa itu stop-out?",
  "header.supportTeam": "Tim dukungan",
  "header.agentSub": "Dukungan Klien · Ezymex",
  "header.connecting": "Menghubungkan Anda dengan agen…",
  "header.replySoon": "Tim kami akan segera membalas di sini",
  "header.helpCentre": "Jawaban pusat bantuan · staf dapat bergabung kapan saja",
  "header.instant": "Jawaban instan · staf dapat bergabung kapan saja",
  "chip.liveAgent": "Agen langsung",
  "menu.aria": "Opsi chat",
  "menu.talkToPerson": "Bicara dengan staf",
  "menu.endChat": "Akhiri chat",
  "menu.newChat": "Mulai chat baru",
  closeChat: "Tutup chat",
  unavailable: "Chat sedang tidak tersedia.",
  greeting: "Halo {name}.",
  "csat.question": "Bagaimana chat ini?",
  "csat.stars": { other: "{count} bintang" },
  "csat.placeholder": "Ada yang ingin ditambahkan? (opsional)",
  "csat.send": "Kirim penilaian",
  "csat.rated": "Anda menilai chat ini {rating}/5",
  "composer.attach": "Lampirkan file",
  "composer.messageTo": "Pesan untuk {name}…",
  "composer.newChat": "Mulai chat baru…",
  "composer.ask": "Tanyakan apa saja kepada {name}…",
  "composer.aria": "Pesan",
  disclaimer: "{name} dapat melakukan kesalahan dan tidak pernah memberikan saran investasi. Chat direkam untuk menjaga kualitas.",
  "toast.chattingWith": "Anda sedang chat dengan {name}",
  "toast.inQueue": "Anda dalam antrean untuk agen",
  "toast.notSent": "Pesan tidak terkirim",
  "toast.teamUnreachable": "Tidak dapat menghubungi tim",
  "toast.endFailed": "Tidak dapat mengakhiri chat",
  "toast.rateFailed": "Penilaian tidak tersimpan",
  "toast.thanks": "Terima kasih atas masukan Anda",
  "toast.fileTooLarge": "File terlalu besar",
  "toast.fileTooLargeText": "Ukuran file maksimal {mb} MB.",
  "toast.unsupported": "File tidak didukung",
  "toast.unsupportedText": "Lampirkan gambar (PNG, JPG, GIF, WEBP) atau PDF.",
  "toast.uploadFailed": "Unggahan gagal",
  "error.uploadFailed": "Unggahan gagal.",
};
export default support;
