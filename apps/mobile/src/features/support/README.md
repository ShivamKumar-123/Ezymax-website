# Support chat (`/support`, `/support/history`, `/support/[id]`)

Live chat with the Kalks AI help bot and the support team, on the support service (`services/support`) through
the Client Area BFF (`/api/mobile/support/*` = the web's `/api/support/*`: the client comes from the session, the
bot sees only the knowledge base and this conversation).

- **Bot first, streamed.** A question gets the bot's answer word by word (`bot.typing` → `bot.delta` → `message`),
  with the help articles it used as chips. The bot hands over by itself on payments, complaints, security and
  account actions; "Talk to a person" (pill or menu) does it on request.
- **Agents live.** The header shows who you're talking to (Kalks AI, the queue, the agent's name and initials);
  system notes show queued / joined / ended; "<agent> is typing…" while they type; the client's typing is sent to
  the agent (at most every 3 s, only while a person is in the chat).
- **Attachments.** Photo (library, HEIC delivered as JPEG) or file (PDF / image), checked like the service (PNG,
  JPG, GIF, WEBP, PDF, up to the broker's limit), uploaded as the raw body with its name and progress. Images show
  as thumbnails loaded with the session (memory cache only: the files are private) and open full screen; PDFs open
  in the share sheet (written to the app cache, removed on sign-out).
- **End and rate.** End the chat from the menu; a finished chat offers 1–5 stars and a comment; "Start new chat".
- **History.** Every conversation (subject, date, status, rating), warmed after the first paint; a transcript opens
  read-only, warmed on press-in; an open one offers "Continue in chat".
- **Open to content.** The chat home (`support/me`) and the history are persisted queries; the stream and every
  action update them with the server's answers (never optimistic). Loading bubbles, offline (connection-lost art),
  error, view-only and "not found" states.

## Realtime (`stream.ts`, `url.ts`)

One WebSocket for the app, opened on the first subscriber with a one-time ticket
(`POST support/stream-ticket`), closed 15 s after the last one leaves and after 30 s in the background;
reconnects with backoff, at once when the network or the app comes back, and reloads after a reconnect or a server
`resync`. The URL is the ticket's when it is public, otherwise `wss://<Client Area host>/support/stream` (Caddy in
production, `scripts/dev-relay.mjs` locally): a phone can't use the loopback URL a development BFF hands out.
Notification frames (`notification`, `notifications.read`) arrive on the same connection: the notifications inbox
can subscribe with `supportStream.subscribe(fn)` instead of opening a second socket.

Streamed words are joined and shown once per frame in their own small store, so a word re-renders only the
streaming bubble.

## Measured (web preview, 390 × 844, local stack)

- While the bot streams an answer: 43 commits, p50 14 / p90 50 fibers per commit (the streaming bubble), the
  largest (227) when the final message replaces it.
- Fast scroll of a long conversation: 60 fps, 0 dropped frames, 4 commits of 14 fibers (list windowing).

## Decisions

- Header status is the short translated label (AI assistant / In queue / Live agent / Ended); the longer lines are
  in the conversation's system notes.
- System notes come from the service in English; other languages get them from the catalog by their kind.
- `prefetchSupport()` (`api.ts`) warms the chat for a menu row or "Contact support" press-in.
