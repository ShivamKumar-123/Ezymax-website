// Keys for this namespace. English is the source; translations live in ../<lang>/support.ts.
// Client Area support: live chat, launcher, support page.
// Keep "Kalks" and "Kalks AI" as they are. {placeholders} are filled in by the app.
const support = {
  // Support page
  "page.title": "Support",
  "page.subtitle": "Chat with Kalks AI for instant answers. Ask for a person at any time and our team takes over with the full conversation.",
  "email.prefer": "Prefer email?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "Write from <email>{email}</email> and include your client ID <id>{id}</id>.",
  "email.write": "Write to support",
  "email.copyId": "Copy client ID",
  clientId: "Client ID",
  notice: "Replies from our team also appear in the notifications bell, and we email you when you're away. Change this under Profile → Notifications.",
  "toast.copied": "{what} copied",
  "toast.copyFailed": "Couldn't copy, please select it instead",

  // Conversation status
  "status.bot": "AI assistant",
  "status.waiting": "In queue",
  "status.assigned": "With an agent",
  "status.resolved": "Ended",

  // Conversation history
  "history.title": "Your conversations",
  "history.subtitle": "Transcripts are kept in your Client Area",
  "history.emptyTitle": "No conversations yet",
  "history.emptyText": "Ask a question in the chat and it will appear here.",
  conversation: "Conversation",
  "toast.openFailed": "Couldn't open the conversation",

  // Floating button
  "launcher.open": "Open support chat",
  "launcher.close": "Close support chat",

  // Chat
  you: "You",
  agent: "Agent",
  // Fallback name for a team member without a name
  supportName: "Support",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "How do I verify my identity?",
  "quick.deposit": "How do I deposit USDT?",
  "quick.withdrawal": "When will my withdrawal arrive?",
  "quick.stopOut": "What is a stop-out?",
  "header.supportTeam": "Support team",
  "header.agentSub": "Client Support · Kalks",
  "header.connecting": "Connecting you with an agent…",
  "header.replySoon": "Our team will reply here soon",
  "header.helpCentre": "Help centre answers · a person can join anytime",
  "header.instant": "Answers instantly · a person can join anytime",
  "chip.liveAgent": "Live agent",
  "menu.aria": "Chat options",
  "menu.talkToPerson": "Talk to a person",
  "menu.endChat": "End chat",
  "menu.newChat": "Start new chat",
  closeChat: "Close chat",
  unavailable: "Chat is unavailable right now.",
  greeting: "Hi {name}.",
  "csat.question": "How was this chat?",
  "csat.stars": { one: "{count} star", other: "{count} stars" },
  "csat.placeholder": "Anything to add? (optional)",
  "csat.send": "Send rating",
  "csat.rated": "You rated this chat {rating}/5",
  "composer.attach": "Attach file",
  "composer.messageTo": "Message {name}…",
  "composer.newChat": "Start a new chat…",
  "composer.ask": "Ask {name} anything…",
  "composer.aria": "Message",
  disclaimer: "{name} can make mistakes and never gives investment advice. Chats are recorded for quality.",
  "toast.chattingWith": "You're chatting with {name}",
  "toast.inQueue": "You're in the queue for an agent",
  "toast.notSent": "Message not sent",
  "toast.teamUnreachable": "Couldn't reach the team",
  "toast.endFailed": "Couldn't end the chat",
  "toast.rateFailed": "Rating not saved",
  "toast.thanks": "Thanks for your feedback",
  "toast.fileTooLarge": "File too large",
  "toast.fileTooLargeText": "Files can be up to {mb} MB.",
  "toast.unsupported": "Unsupported file",
  "toast.unsupportedText": "Attach an image (PNG, JPG, GIF, WEBP) or a PDF.",
  "toast.uploadFailed": "Upload failed",
  "error.uploadFailed": "Upload failed.",
};
export default support;
