// Ask Ezymex AI routing (lib/ask-ai.ts): `node --test apps/crm/tests`.
// Guards the production bug of 2026-10-07: questions asked while a request for a person was open were appended to
// that "waiting" conversation, which the bot never answers, so the card waited forever.

import { test } from "node:test";
import assert from "node:assert/strict";
import { askRoute, passedToTeam, withPerson } from "../lib/ask-ai.ts";

test("a question goes to the bot when there is no open request for a person", () => {
  assert.equal(askRoute(null), "bot");
  assert.equal(askRoute(undefined), "bot");
  assert.equal(askRoute("bot"), "bot");
  // a resolved conversation is closed: the next message opens a new one, which the bot owns
  assert.equal(askRoute("resolved"), "bot");
});

test("a question is held while a request for a person is open (the bot never answers there)", () => {
  assert.equal(askRoute("waiting"), "person");
  assert.equal(askRoute("assigned"), "person");
});

test("an open request for a person is shown only for waiting / assigned conversations", () => {
  assert.deepEqual(["bot", "waiting", "assigned", "resolved", null].map(withPerson), [false, true, true, false, false]);
});

test("waiting for the bot stops when the conversation is handed over to the team", () => {
  assert.equal(passedToTeam(true, "waiting"), true);
  assert.equal(passedToTeam(true, "assigned"), true);
  assert.equal(passedToTeam(true, "bot"), false);
  assert.equal(passedToTeam(false, "waiting"), false);
});
