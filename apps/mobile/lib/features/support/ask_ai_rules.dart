// Where an "Ask Kalks AI" question can go (port of apps/crm/lib/ask-ai.ts, pure; tested like
// apps/crm/tests/ask-ai.test.mjs in test/c1_support_test.dart).
//
// The support service keeps ONE open conversation per client (status <> 'resolved'), a client message always lands in
// that open conversation, and the bot only answers conversations in status "bot". So:
//   - no conversation, or a resolved one  -> the message opens a new conversation, which the bot owns
//   - an open "bot" conversation          -> the bot answers in it
//   - an open "waiting" / "assigned" one  -> it belongs to a person: the bot will not answer there. The question is
//     held until the client chooses: close that request and ask the bot (a new bot conversation), or send it to the
//     team in the open request.
import 'support_models.dart';

enum AskRoute { bot, person }

/// bot: send now, the bot answers. person: a request for a person is open, the client must choose first.
AskRoute askRoute(ConvStatus? status) => withPerson(status) ? AskRoute.person : AskRoute.bot;

/// An open conversation that's with (or queued for) a person.
bool withPerson(ConvStatus? status) => status == 'waiting' || status == 'assigned';

/// While a bot answer is due: the conversation moved to people (the bot handed it over), so stop waiting for the bot.
bool passedToTeam(bool waitingForBot, ConvStatus? status) => waitingForBot && withPerson(status);
