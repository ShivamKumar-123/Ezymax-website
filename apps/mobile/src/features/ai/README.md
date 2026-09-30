# AI Trader (`/ai`)

The client describes a trading idea in plain words; the algo service's assistant (Claude, server side,
`services/algo/src/ai.rs`) turns it into an exact, validated strategy. The client reviews it as a card, edits the
key numbers, backtests it and deploys it on a demo or live account. Nothing trades until the client confirms in the
Deploy sheet, and the screen never gives advice (risk note on the intro, in the composer and in every sheet).

| Step | What happens | Server call (`/api/mobile/algo/*` = the web's `/api/algo/*`) |
|---|---|---|
| Describe | A message (or a suggestion pill; under a draft only the refinements it doesn't have yet: trailing stop, hours, risk sizing, a daily trade cap, buys only). With a draft in the conversation, the assistant edits that draft (`current`); otherwise it starts one. Context: the Trade tab's symbol, H1. The request can take up to a minute (static "Drafting…" bubble with a seconds counter; Stop drops the answer). A failed request shows why with "Try again", which replaces that exchange instead of repeating the message. | `POST algo/ai/strategy {prompt, symbol, timeframe, target: "visual", current?}` (240 s) |
| Review | The strategy card: name, symbol / timeframe / size, the rules in words ("EMA(20) crosses above EMA(50) and RSI(14) < 70"), stop, target, trailing, hours, limits, the service's notes, the assistant's questions (gold block) and assumptions, the rules as code. Earlier drafts collapse to one line. | – |
| Edit | Name, symbol (searchable list), timeframe, size (lots or risk %, max lots), stop / target / trailing (mode + value, ATR period), trades a day, daily loss cap, one position at a time. The service validates; its errors stay in the sheet and on the card. The rules themselves are changed by asking. | `POST algo/validate {kind: "visual", spec}` |
| Backtest | Period (limited per timeframe exactly like the service), starting balance, whose costs (an account's group or standard). The first run saves the strategy (origin `ai`, with the prompt); later changes become new versions of it; a Backtest and a Deploy started together share one save. The card polls the job (stage, progress, Cancel) and shows net profit, return, an equity line, trades, win rate, profit factor, max drawdown, Sharpe, the range the prices actually covered (`firstBar`–`lastBar`, like the full report; history can start after the requested start) and the simulation note; "Full report" opens `/algo/backtests/[id]` (warmed on press-in). | `POST algo/strategies` or `POST algo/strategies/{id}/versions`, `POST algo/backtests`, `GET algo/backtests/{id}`, `POST algo/backtests/{id}/cancel` |
| Deploy | Only from the Deploy sheet: the account (demo first), optional safety limits (lot multiplier, max open positions, daily loss), a real-money warning and a required tick on live accounts (asked again for another account), the broker's trading restrictions (the shared `RestrictionBanner`) and an account whose dealer switched trading off or to close-only (Deploy disabled). A retry after a lost answer finds the deployment the first attempt started (the service refuses a second one: `exists`). The card shows the deployment's live status from the Algo module's shared list (a gold "Running" block, a quiet "Stopped" card) and links to `/algo/strategies/[id]` (pause / stop / kill live there). | `POST algo/deployments {strategyId, versionId, login, risk}`, `GET algo/deployments` |

Server-side rules are the web's: the session's user (never the body), the broker's `algo` module switch, view-only
and read-only staff sessions refused by the proxy (the screen shows them a view-only / read-only state up front), the AI hourly allowance (`aiPerHour`), strategy / backtest /
deployment limits, account status, the engine's order checks (restrictions, margin, sessions). Covered by
`apps/crm/tests/mobile-ai.test.mjs`.

## Files

| File | |
|---|---|
| `api.ts` | Shapes (spec, built strategy, AI reply, backtest, deployment) and the calls. `prefetchAi()` warms the catalogue for a menu row's press-in. |
| `thread.ts` | The conversation store: kept on the phone per user (`kalks.ai.thread.<userId>`, last 40 items, removed on sign-out), outside the screen so a request keeps going when the client navigates away. One conversation = one strategy lineage (`strategyId`). Running backtests resume polling after a restart; a request cut off by closing the app becomes "ask again". Every confirmed save, run and deploy refreshes the Algo module's screens (`refreshAlgo()`: its query keys start with `algo:`). |
| `conversation.ts` | Pure helpers: replacing a failed exchange on "Try again", finding the deployment an earlier Deploy started. Tested in `scripts/ai-lib.test.mts`. |
| `spec.ts` | Rules, stops, sizes, limits in words (translated), the service's notes by message, backtest periods per timeframe, the refinements a draft doesn't have yet, the spec fingerprint (a saved version is reused while the spec is unchanged). Tested in `scripts/ai-lib.test.mts`. |
| `components/` | Intro, strategy / backtest / running cards, the Edit / Backtest / Deploy sheets, card buttons and the risk note. |
| `screens/AiTraderScreen.tsx` | The chat: FlashList anchored to the bottom (`maintainVisibleContentPosition`), memoised rows, suggestion pills, composer, sheets. |

## Chat building blocks (`src/features/chat`, shared with the support chat)

`MascotAvatar` (the mascot illustration framed on its head; the crop is identical in RTL), `InitialsAvatar`,
`ChatRow` / `Bubble` / `AuthorLine` / `SystemNote` / `DayDivider`, `Rich` (bold, bullets, numbered lists, https
links; never HTML), `Composer` (growing field, attach, send / stop; the text lives in the composer so typing never
re-renders the list), `Suggestions`, `ChatHeader` / `HeaderPill` / `BackButton`, `ActionSheet`, `ConfirmSheet`,
`SheetHeader`, `useKeyboardVisible`, `clock` / `dayLabel` (the reader's own clock).

## Measured (web preview, 390 × 844, local stack)

- While the assistant drafts: 1 commit a second of 11 fibers (only the counter bubble).
- Fast scroll of a conversation with strategy, backtest and running cards: 60 fps, 0 dropped frames, 0 React commits.
- Draft round trip on the local stack with Claude: 12–13 s.

## Decisions

- The visual spec (not DSL code) is the target: it is what the card can show and the edit sheet can change; the code is shown read-only.
- Deploy is never a single tap from the chat: the sheet names the version and account, defaults to demo and gates live accounts with a warning and a tick. The service starts the deployment at once (like the web); stopping lives in Algo.
- Accounts for the Deploy / Backtest sheets come from the shared `trading/accounts` cache (instant), not `algo/accounts`; the service checks ownership and status again.
- The conversation is local (the service keeps AI requests only as an audit log); strategies, versions, backtests and deployments are all server-side and visible in Algo and the Client Area.

Haptics follow the app's rule (selection and refresh only): no buzz on a server's answer or on ordinary taps.

## Known gaps

- The DSL (code) target of the assistant is not offered on the phone; code strategies are edited in the Client Area.
- Sessions (trading hours) and days are changed by asking the assistant, not in the edit sheet.
