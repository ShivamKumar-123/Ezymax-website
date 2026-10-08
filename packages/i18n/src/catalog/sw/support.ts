import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page. "Ezymex" and "Ezymex AI" stay as they are.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "Msaada",
  "page.subtitle": "Zungumza na Ezymex AI kupata majibu papo hapo. Omba mtu wakati wowote na timu yetu itaendelea na mazungumzo yote.",
  "email.prefer": "Unapendelea barua pepe?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "Andika kutoka <email>{email}</email> na ujumuishe kitambulisho chako cha mteja <id>{id}</id>.",
  "email.write": "Andikia msaada",
  "email.copyId": "Nakili kitambulisho cha mteja",
  clientId: "Kitambulisho cha mteja",
  notice: "Majibu ya timu yetu pia huonekana kwenye kengele ya arifa, na tunakutumia barua pepe ukiwa haupo. Badilisha hili kwenye Wasifu → Arifa.",
  "toast.copied": "{what} imenakiliwa",
  "toast.copyFailed": "Imeshindwa kunakili, tafadhali ichague badala yake",

  // Conversation status
  "status.bot": "Msaidizi wa AI",
  "status.waiting": "Kwenye foleni",
  "status.assigned": "Na wakala",
  "status.resolved": "Yamekwisha",

  // Conversation history
  "history.title": "Mazungumzo yako",
  "history.subtitle": "Nakala za mazungumzo huhifadhiwa kwenye Eneo lako la Mteja",
  "history.emptyTitle": "Bado hakuna mazungumzo",
  "history.emptyText": "Uliza swali kwenye gumzo na litaonekana hapa.",
  conversation: "Mazungumzo",
  "toast.openFailed": "Imeshindwa kufungua mazungumzo",

  // Floating button
  "launcher.open": "Fungua gumzo la msaada",
  "launcher.close": "Funga gumzo la msaada",

  // Chat
  you: "Wewe",
  agent: "Wakala",
  // Fallback name for a team member without a name
  supportName: "Msaada",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "Ninathibitishaje utambulisho wangu?",
  "quick.deposit": "Ninawekaje USDT?",
  "quick.withdrawal": "Utoaji wangu utafika lini?",
  "quick.stopOut": "Stop-out ni nini?",
  "header.supportTeam": "Timu ya msaada",
  "header.agentSub": "Msaada kwa Wateja · Ezymex",
  "header.connecting": "Tunakuunganisha na wakala…",
  "header.replySoon": "Timu yetu itajibu hapa hivi karibuni",
  "header.helpCentre": "Majibu ya kituo cha msaada · mtu anaweza kujiunga wakati wowote",
  "header.instant": "Hujibu papo hapo · mtu anaweza kujiunga wakati wowote",
  "chip.liveAgent": "Wakala hai",
  "menu.aria": "Chaguo za gumzo",
  "menu.talkToPerson": "Zungumza na mtu",
  "menu.endChat": "Maliza gumzo",
  "menu.newChat": "Anza gumzo jipya",
  closeChat: "Funga gumzo",
  unavailable: "Gumzo halipatikani kwa sasa.",
  greeting: "Habari {name}.",
  "csat.question": "Gumzo hili lilikuwaje?",
  "csat.stars": { one: "Nyota {count}", other: "Nyota {count}" },
  "csat.placeholder": "Kuna cha kuongeza? (hiari)",
  "csat.send": "Tuma tathmini",
  "csat.rated": "Umetathmini gumzo hili {rating}/5",
  "composer.attach": "Ambatisha faili",
  "composer.messageTo": "Ujumbe kwa {name}…",
  "composer.newChat": "Anza gumzo jipya…",
  "composer.ask": "Muulize {name} chochote…",
  "composer.aria": "Ujumbe",
  disclaimer: "{name} anaweza kukosea na hatoi kamwe ushauri wa uwekezaji. Mazungumzo hurekodiwa kwa ajili ya ubora.",
  "toast.chattingWith": "Unazungumza na {name}",
  "toast.inQueue": "Uko kwenye foleni ya wakala",
  "toast.notSent": "Ujumbe haukutumwa",
  "toast.teamUnreachable": "Imeshindwa kuifikia timu",
  "toast.endFailed": "Imeshindwa kumaliza gumzo",
  "toast.rateFailed": "Tathmini haijahifadhiwa",
  "toast.thanks": "Asante kwa maoni yako",
  "toast.fileTooLarge": "Faili ni kubwa mno",
  "toast.fileTooLargeText": "Faili zinaweza kuwa hadi MB {mb}.",
  "toast.unsupported": "Faili haitumiki",
  "toast.unsupportedText": "Ambatisha picha (PNG, JPG, GIF, WEBP) au PDF.",
  "toast.uploadFailed": "Upakiaji umeshindwa",
  "error.uploadFailed": "Upakiaji umeshindwa.",
};
export default support;
