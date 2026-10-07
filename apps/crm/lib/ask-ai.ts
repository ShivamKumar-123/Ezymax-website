// Where an "Ask Kalks AI" question can go (pure, tested in tests/ask-ai.test.mjs).
//
// The support service keeps ONE open conversation per client (index conversations_one_open: status <> 'resolved'),
// a client message always lands in that open conversation, and the bot only answers conversations in status "bot"
// (services/support/src/chat.rs). So:
//   - no conversation, or a resolved one  -> the message opens a new conversation, which the bot owns
//   - an open "bot" conversation          -> the bot answers in it
//   - an open "waiting" / "assigned" one   -> it belongs to a person: the bot will not answer there. The question is
//     held until the client chooses: close that request and ask the bot (a new bot conversation), or send it to the
//     team in the open request.

export type SupportStatus = "bot" | "waiting" | "assigned" | "resolved";

/** "bot": send now, the bot answers. "person": a request for a person is open, the client must choose first. */
export function askRoute(status: SupportStatus | null | undefined): "bot" | "person" {
  return status === "waiting" || status === "assigned" ? "person" : "bot";
}

/** An open conversation that's with (or queued for) a person. */
export function withPerson(status: SupportStatus | null | undefined): boolean {
  return status === "waiting" || status === "assigned";
}

/** While a bot answer is due: the conversation moved to people (the bot handed it over) — stop waiting for the bot. */
export function passedToTeam(waitingForBot: boolean, status: SupportStatus | null | undefined): boolean {
  return waitingForBot && withPerson(status);
}
