# News and economic calendar (mobile)

Market news and the economic calendar in the Kalks app. Server side it is the Client Area news BFF (`apps/crm/app/api/news/[...path]`, reached as `/api/mobile/news/*` through the proxy rewrite) in front of `services/news`, so the app shows exactly what the web Client Area shows: the broker's pinned and hidden stories, the same tags, tone and importance, the same calendar and the same reminder and alert rules. No new server route was needed.

## Screens

| Route | Screen | What it does |
|---|---|---|
| `/news` | `screens/NewsScreen.tsx` | Editorial front page: the daily AI brief (periwinkle block: mood, headline, the first point, "Read the full brief", calendar note, instruments to watch), importance pills (All / Important / Top stories) and the active filters as removable chips, the lead story as a colour block (a pinned story in gold, else the most important story of the last two days in ember), then every story as a row: category kicker, source, age, headline, tone and importance chips, instruments. Infinite scroll with the service's `before` cursor. The filter sheet adds tone, currency and instrument (instruments in today's headlines first). |
| `/news/[id]` | `screens/StoryScreen.tsx` | The headline, source and publication time, the publisher's teaser only (licensing: never the full article), "Read at <source>" in the in-app browser (`expo-web-browser`), the tagged instruments with live bid and daily change (tap: the Trade tab's chart, candles warmed on press-in), the currencies (tap: that currency's calendar), more stories on the same instrument, share. |
| `/calendar` | `screens/CalendarScreen.tsx` | The week grouped by day under sticky day headings, in the phone's time zone with the server time noted (or in server time, from the filter sheet), actual / forecast / previous on every row (actual in the currency's direction versus forecast), impact stripes and bars, a reminder bell on every future release, the now line. A fixed day strip jumps between days and follows the scroll; Earlier / Later switch weeks. The next high-impact release counts down above the list. A row opens the event sheet: both clocks, a countdown, the three figures, the release history, instruments to watch, "<currency> news", and the reminder with its lead time (5, 15, 30 or 60 minutes). The bell icon opens the high-impact alerts subscription. |

Links in: Home's headlines (`/news`, `/news/[id]`), the More tab (`/news`, `/calendar`), and the calendar reminder notifications (`/calendar`). Links other modules can use:

- `/news?symbol=XAUUSD` or `/news?currency=USD`: the feed filtered to one instrument or currency (not saved as the reader's filters);
- `/calendar?currency=USD`: the calendar filtered to one currency;
- `/calendar?event=<id>`: opens that event's sheet.

## Data

- **Reads:** `useQuery(…, { persist: true })` with the keys in `api.ts` (`news/…`), so every screen opens on the cached answer and refreshes in the background.
  - Polls run only while the screen is in front (`useIsFocused`): feed every 2 minutes, brief every 15, calendar and the next high-impact release every 5.
  - The fetchers keep unchanged stories and events as the same objects (structural sharing), so a poll with nothing new re-renders no row.
  - Older feed pages, and first pages a refresh replaced, stay merged for the filter, so new stories slide in on top without moving what is on screen.
  - While another filter or week loads, the previous answer stays on screen dimmed; if it can't load, its error state (offline, unavailable, view-only) shows with a retry, and the filter row / week buttons stay in reach. A reader scrolled past the filter row lands back on it when the filters change; the calendar goes back to today's releases.
- **Opening a story needs no request:** a row's press-in puts the list's copy of the story in the story cache and warms "More on …". The stories seen are forgotten on sign-out (the next client may be another broker's).
- **Reminders** (`reminders.ts`) are toggled optimistically (a reminder is not a money action):
  - the bell flips with a selection haptic (the pressed control gives the one haptic: bell and lead-time pills the selection tick, buttons their tap);
  - a refusal flips it back with the server's reason (no error buzz: haptics are for selection, refresh, fills and closes);
  - each bell subscribes to its own event id.
  - The service only returns event ids, so the lead time picked on this phone is kept in the cached `me/calendar` answer. A reminder set on the web or another phone shows "Reminder on" with no lead time selected until one is picked (which moves it).
  - The event sheet keeps its state per event (keyed on the event id).
- **Alerts:** the high-impact subscription (`PUT` / `DELETE me/calendar/alerts`) works the same way. The whole row is the switch (the switch itself only shows the state), so one tap is one request; the server's answer is kept.
- **Who may write:** view-only logins get no bells, alerts or reminder controls, and the proxy refuses their writes anyway (`viewer_read_only`). A view-only login without the Dashboard section gets the view-only state. Read-only staff sessions are refused by the proxy (`staff_read_only`); the bell flips back and shows the reason.

## Layout

- Story rows have one of three fixed heights, from the headline's estimated line count at this width (`StoryRow.tsx`). The instrument tags on a row's chips line are estimated the same way from the tone and importance labels and the width (`tagsThatFit`), and the rest fold into "+N", so the line never ends in a cut chip on a 360 pt phone or in a longer language.
- The lead-time pills (reminder and alert sheets) use narrow padding (`LEAD_PILL`), so four fit on one line at 360 pt.
- Words in figure slots ("Pending") are set in the text face: the tabular mono face has no glyphs for most scripts.

## Time

- The calendar week is the server week (Monday 00:00 to Sunday 24:00 server time, New York close).
- In "your time" rows are grouped by the phone's calendar day. A day at the edge of the week only shows when it has events.
- Clock times are 24-hour with Latin digits, like the rest of the trading screens. Weekday and month names follow the reader's language.
- A minute clock (`clock.ts`) drives relative ages, the past-row dimming and the now line; the countdowns tick on a one-second clock. Both are leaf subscribers.
- Dimming (past releases, days without matching events) sits on a view inside the pressable: `PressableScale` animates its own opacity for press and disabled feedback, which would override an opacity in its style.

## Performance (web preview, headless Chromium, iPhone-size viewport, against the local stack)

Rendered components are counted like React DevTools does: only the updated part of the tree.

| What | Result |
|---|---|
| Feed fast scroll, including an infinite-scroll page load | 59.7 fps, 1 of 208 frames over 25 ms, p50 4 components rendered per commit (max 376, the appended page) |
| Feed idle for 5 s | 0 commits (the ages update once a minute, on the minute) |
| Story open from a row | headline on screen 106–156 ms after the tap, including Playwright overhead (load average 12–13 on 8 cores); no request |
| Story idle with live prices | only the two price texts render: 8 components per commit |
| Calendar fast scroll across sticky headings | 60 fps, 0 frames over 25 ms, p50 6 components per commit |
| Calendar idle | one commit a second, the countdown: 4 components |

## Strings

- `packages/i18n/src/catalog/en/mobileNews.ts`, in English; the translation pass adds the other languages.
- Everything the web Client Area already says (tone, impact, calendar columns, brief, alerts, relative ages) comes from the translated `news.*` keys.
