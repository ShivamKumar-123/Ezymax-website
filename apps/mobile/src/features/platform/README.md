# Platform (`src/features/platform`)

Phone-level features of the app: the notifications inbox, push notifications, the app lock (Face ID / fingerprint /
the phone's passcode), "Continue with Google" and links that open the app.

| Route | Screen |
|---|---|
| `/notifications` | Inbox (`notifications/InboxScreen.tsx`) |
| `/settings/app-lock` | App lock settings (`lock/AppLockScreen.tsx`) |
| `/lock` | Locks the app now and returns to where it was (`lock/LockRoute.tsx`); with the lock off it opens the settings |
| `/google-profile` (signed out) | Profile step after a first Google sign-in (`google/GoogleProfileScreen.tsx`) |
| `+native-intent`, `+not-found` | Incoming links (`app/+native-intent.tsx`), links that match no screen (`NotFoundScreen.tsx`) |

`PlatformRoot` is mounted once in `app/(app)/_layout.tsx`, next to the navigator. It renders only overlays: the lock,
the in-app push banner and the push soft ask.

## Notifications inbox

The Client Area bell's inbox (services/support `/v1/notifications/me`, through `/api/mobile/notifications`), so reading
on the phone reads on the web.
- **Grouping:** by the reader's local day (Today, Yesterday, dates), newest first.
- **Controls:** All / Unread, mark all read, and a settings shortcut to Profile › Notifications.
- **Tapping a row:** marks it read and opens its screen (`links.ts` maps the producers' Client Area paths to app routes).
  A row with no screen opens its full text in a sheet (it scrolls: a body can be 2,000 characters), with "Open link"
  for web pages.
- **Unread count:** one place for the whole app, the Home bell's query (`home/bell`), plus the app icon badge.
- **Performance:** FlashList with fixed-height memoised rows. The screen opens on the cached first page, then refreshes:
  every 60 s while open (the support stream brings new notifications and reads at once), when a push arrives and when
  the connection comes back. Older pages load as you scroll and stay loaded when a notification arrives live.
- **Offline:** a saved page shows with a line saying it is saved; with nothing saved, the connection-lost state.
- **Colours:** routine notices neutral grey, good news warm off-white, attention gold, urgent ember (green and red
  stay for money).
- **View-only logins:** they have no inbox (the server refuses it) and see a notice instead.

## Push notifications

**Server side.** services/support `src/push.rs` (see its README › Mobile push). Every in-app notification of a client
also goes to their registered phones through the Expo push service:
- sent in batches of 100, retried with backoff;
- receipts checked after 15 minutes;
- dead tokens dropped.

It is behind `SUPPORT_PUSH_ENABLED` (on in production, set by `deploy/deploy.sh`).

**Preferences.** A client gets a push when the category's in-app switch is on and so is its `push` preference.
- The `push` preference defaults to on, except News and offers: marketing pushes are opt-in (App Store guideline 4.5.4).
- The server stores `prefs[category].push`. The Profile › Notifications screen can show it as a third column.

**App side** (`push/`):
- **Asking for the permission.** The app never asks on its own.
  - The soft ask (`PushAskSheet`) shows on Home from the second launch. It shows at most three times, two weeks apart, and
    only while the system has never asked.
  - The inbox shows the same offer as a card.
  - The system prompt follows only "Turn on notifications". After "Don't allow", the card opens the phone's settings
    instead.
- **Registering.** With the permission granted, the Expo token goes to `POST /api/mobile/push/register`:
  - once a day, and whenever the token or the client changes;
  - never for view-only logins; the BFF also refuses staff sessions.
  If the permission is later turned off in the phone's settings, the phone is unregistered.
- **Signing out** removes the phone:
  - the client's own row while the session is valid;
  - after the session ended, the server matches the token with the installation id;
  - it waits at most 6 s (sign-out never hangs on a bad connection); a removal that failed is retried while signed
    out (at the next start and whenever the app comes back) and before the next registration.
  Delivered notifications and the badge are cleared too.
- **A push while the app is open.** It updates the inbox and the badge, and slides in an in-app banner. There is no
  banner when the app is locked or the inbox is on screen. Tap the banner to open it; swipe it up (it follows the
  finger) or wait 4.5 s to dismiss it.
- **Tapping a push**, including the tap that launched the app:
  - it opens the notification's screen and marks it read;
  - a push whose link is a web page (or that has no screen) opens the inbox with that notification's full text: the
    link is followed from the server's copy, never from the push payload, so a push that didn't come from our server
    can't open a page inside the app;
  - a push meant for someone who has since signed out on the phone is ignored, and isn't presented while the app is
    open.
- **Android channels:** `alerts` (margin call, stop-out, price alerts, security), `activity` (everything else) and `news` (offers).

## App lock

`lock/`, expo-local-authentication. The system prompt uses Face ID, Touch ID, fingerprint or face unlock, with the
phone's passcode as the fallback. Nothing biometric reaches the app.

When it asks:
- **Cold start** with a saved session: the lock covers the first frame.
- **Coming back** after the chosen time in the background: immediately, 1, 5 or 15 minutes, or 1 hour (default 1 minute).
- **Never** right after a password sign-in.

The lock is a layer above everything, including bottom sheets and modal screens. It appears at once and fades out in
180 ms after an unlock.
- **iOS:** react-native-screens' `FullWindowOverlay` (on the app's window, above every presented view controller). A
  React Native `<Modal>` is presented by its screen's view controller, and UIKit refuses to present it while a
  native-stack modal (Algo deploy, copy-trading forms …) is open, so the lock would silently not appear.
- **Android and the web preview:** a React Native `<Modal>` (a dialog window above the activity).
- A focused text field loses the keyboard when the lock or the cover appears.
- On short phones (iPhone SE, 360 x 640) the heading and art are smaller and the screen scrolls, so Unlock and Sign out
  are always reachable.

Other behaviour:
- **App switcher:** while the lock is on, the app switcher shows a cover instead of balances.
- **Escape hatch:** "Sign out" on the lock screen is the way out for someone who can't unlock.
- **Turning it on or off**, and choosing a longer "Lock again after" time, needs the owner to confirm.
- **A phone whose screen lock was removed** can't confirm anyone: the lock screen offers Sign out, and after the
  password sign-in the app lock is switched off (with a note) instead of locking the owner out again.
- **Scope:** the setting belongs to the phone (kv `kalks.appLock`). View-only logins can use it too.

## Continue with Google

`google/`. Uses the OAuth 2.0 authorization-code flow with PKCE (S256), `state` and a nonce, via expo-auth-session in the
phone's system browser, with the app's own Google OAuth client.
- **The code never becomes a token in the app.** The app sends the code, the PKCE verifier and the nonce to
  `POST /api/mobile/auth/google` (`apps/crm/lib/google-mobile.ts`). The BFF redeems the code with Google and verifies the
  ID token exactly like the web flow. It checks the JWKS signature, iss, aud (the platform's client id), azp, exp, nonce
  and email_verified. Then the gateway signs in, links the Google account, or starts the profile step (`/v1/auth/google`).
- **A new person** completes the profile on `/google-profile`: country, phone, date of birth, terms and an optional
  partner code. This calls `POST /api/mobile/auth/google/complete`.
- **For the sign-in / sign-up screens:** include `<GoogleSignIn />` (or `mode="signUp" referral={ref}`). It renders
  nothing until the build has a client id for the platform. It is also hidden in Expo Go, whose bundle id Google
  wouldn't accept.

### Founder steps (Google)

1. **Google Cloud console** (the project of the Client Area's web client) › APIs & Services › Credentials. Create:
   - **iOS client:** bundle ID `com.kalkstrade.app`.
   - **Android client:** package `com.kalkstrade.app`, plus the SHA-1 of the signing key (EAS: `npx eas-cli credentials`
     › Android › the keystore's SHA-1; add the Play App Signing SHA-1 too once the app is on Play). In the client's
     Advanced settings, enable **Custom URI scheme**.
2. **App build env** (eas.json `env` or EAS secrets): `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`,
   `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.
3. **Client Area server** (`apps/crm/.env.production.local`): `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` (the same
   ids). Then restart `kalks-crm`.
4. The Google redirect is `com.kalkstrade.app:/oauthredirect`: the app's own scheme (app.json `scheme`, which iOS also
   registers from the bundle id). No console setting is needed for it.
5. The broker's `google_login` feature must be on (Back Office › Settings › Features), as for the web.

### Founder steps (push)

1. `cd apps/mobile && npx eas-cli init` links an EAS project and writes `extra.eas.projectId` into app.json. Push
   tokens need it.
2. **iOS:** `npx eas-cli credentials` › iOS › Push Notifications › let EAS create the APNs key (or upload one).
3. **Android:** create a Firebase project for `com.kalkstrade.app`, then upload its FCM V1 service-account key in
   `npx eas-cli credentials` › Android › Push Notifications (FCM V1).
4. **Optional:** turn on "Enhanced push security" in the Expo project and put the access token in the server's
   `.env.local` as `SUPPORT_EXPO_ACCESS_TOKEN`.
5. Build a development or production build: remote pushes don't work in Expo Go on Android. Sign in, allow
   notifications, and send yourself one:
   ```bash
   curl -s localhost:8100/v1/notify -H "x-kalks-internal: $SUPPORT_INTERNAL_TOKEN" -H 'content-type: application/json' \
     -d '{"type":"system.test","userId":<your id>,"title":"Hello","body":"Push works","link":"/wallet"}'
   ```

## Links into the app

- **`kalks://<path>`** opens the matching screen: the app's own paths (`/partner/clients/41`, `/algo/deployments/12`,
  `/academy/<phase>/exam` …) and the Client Area paths the app names differently (`/portfolio/history` → Portfolio,
  `/portfolio/analytics` → Reports, `/social/copy` → My copies, `/social/investments` → PAMM › My investments,
  `/developer/webhooks` → Algo › API keys, `/academy/phase/<slug>` → the phase …, `links.ts`). Screens that only act
  (deploy, subscribe, invest, edit) are never link targets. Only the query parameters a screen reads survive
  (`?symbol=`, `?login=&period=`, `?intent=` …). From a notification, `/trade?symbol=X` opens the Trade tab on X.
- **Signed out:** a link to a signed-in screen shows sign-in first, then opens right after it.
- **Unknown paths** show "Nothing to open here" with a way Home.
- **Google's OAuth redirect** is left to the auth session (the router ignores it).
- **https links** of the app's own Client Area host are already mapped the same way (`+native-intent`). They start opening
  the app once the domain is associated:
  - **iOS:** app.json `ios.associatedDomains: ["applinks:app.kalkstrade.com"]`. The Client Area serves
    `/.well-known/apple-app-site-association` (`{"applinks":{"details":[{"appIDs":["<TEAMID>.com.kalkstrade.app"],"components":[{"/":"/wallet*"},…]}]}}`,
    `application/json`, no redirect).
  - **Android:** app.json `android.intentFilters` with `autoVerify: true` for `https://app.kalkstrade.com`. The Client
    Area serves `/.well-known/assetlinks.json` with the release key's SHA-256.

  This needs the Apple Team ID and the signing certificate, so it waits for the store builds.

## Web preview

A browser has no push notifications or Face ID. The preview shows the lock as unavailable, and hides the push offer
and the Google button.

`EXPO_PUBLIC_WEB_DEVICE_DEMO=1` turns on a simulated phone for screenshots and end-to-end checks. The simulated phone
has:
- a Face ID prompt that confirms (or answers what localStorage `kalks.demo.auth` says);
- a push permission that was never asked.

`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` shows the Google button on the web preview. In that case the redirect lands on
`/google-profile`.

## Tests

- `node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/platform-links.test.mts`: link mapping,
  day grouping, lock timing.
- `node --test apps/crm/tests/mobile-platform.test.mjs`: push routes (view-only, staff and signed-out rules) and the
  mobile Google sign-in (PKCE exchange, token checks, profile step).
- `cargo test -p support`: the push queue against a stub push service (batches, DeviceNotRegistered, backoff, split
  batches, receipts, phones changing hands, sign-out, clean-up).
