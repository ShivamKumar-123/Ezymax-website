# Profile and More (`src/features/profile`, `src/features/more`)

The More tab and everything under `/profile`. Same server APIs and rules as the Client Area (apps/crm), through
the mobile BFF (`/api/mobile/*`, bearer session).

| Route | Screen | Server |
|---|---|---|
| More tab | `more/MoreScreen.tsx` | `auth/me` (session), `menu` (native: broker modules, support email, legal links) |
| `/profile` | `ProfileScreen.tsx` | session record + `kyc` (address on file) |
| `/profile/verification` | `VerificationScreen.tsx` + `kyc/*` | `kyc`, `kyc/start`, `kyc/details`, `kyc/documents` (multipart), `kyc/submit` |
| `/profile/security` | `SecurityScreen.tsx` | `security/sessions`, `security/logins`, `security/requests` |
| `/profile/sessions`, `/profile/sign-ins` | FlashList screens | same |
| `/profile/password` | `PasswordScreen.tsx` | `auth/stepup*` (action `account_password`) + `auth/password` |
| `/profile/viewers`, `/profile/viewers/edit` | view-only logins | `security/viewers*` (create / new password: step-up `viewer_access`) |
| `/profile/language` | `LanguageScreen.tsx` | none (the app sends `X-Kalks-Locale`) |
| `/profile/notifications` | `NotificationsScreen.tsx` | `notifications/prefs` (push, in the app, email), `auth/marketing` |

## Decisions

- **Profile is read-only**, like the Client Area's live profile: there is no profile-edit API. Name and date of
  birth are corrected in the verification details step and locked after approval (D92); phone, address and email
  changes go through support (chat or email), with the rules shown on the screen.
- **KYC capture:** a guided camera (`expo-camera`) with the document outline or the selfie oval, the photo library
  (`expo-image-picker`) and files / PDFs (`expo-document-picker`). The instant checks are the Client Area's own
  maths (`kyc/checks.ts`: sharpness, glare, lighting, framing, passport MRZ, face in the oval, resolution, issue
  date), run on a down-scaled copy decoded with Skia (`kyc/pixels.ts`, canvas on the web preview). A failed check
  (resolution, a proof of address older than 3 months) blocks the upload; warnings don't. The results travel with
  the upload for the reviewer. Photos over 10 MB get a smaller JPEG copy; the gateway re-checks everything.
- **Company verification** is supported on the phone too (company, people, documents, selfie).
- **Step-up codes** use a sheet with its own code boxes on the kit's `SheetTextInput` (the sheet's own input on
  phones, so the sheet rises with the keyboard); the sheets with inputs are `scrollable` for short phones.
- **Legal links** come from `/api/mobile/menu`: the broker's website (its configured website domain, else the Client
  Area host without `app.`) + `/terms`, `/privacy`, `/risk-warning`, `/risk`, `/restricted-countries`, opened with
  `expo-web-browser`. Every session reads the menu, view-only logins too (the proxy judges it like `/auth/me`), so a
  white-label broker's viewers get the broker's pages and module switches; the app never falls back to a fixed
  website or support address (without the menu yet, Legal fetches it first; the support email choice waits for it).
- **RTL:** the app's layout flips at once (root direction). A switch between LTR and RTL languages also sets
  `I18nManager.forceRTL` and offers a restart (`reloadAppAsync` from `expo`); `initI18n` keeps the native direction
  in step with the language from the next start.
- **Notifications:** push, in the app and email per topic (services/support), one channel at a time behind pill
  chips so every topic keeps a full-width row on a 360 pt phone. A push goes out only while the topic is also on in
  the app (notify.rs), so the push switch shows both and turning a push on turns the topic on in the app too. The
  email switch of "News and offers" is the account's marketing consent (gateway), as in the Client Area. Each switch
  is saved on its own; a refused save puts back only that topic.
- **View-only logins and read-only staff sessions** see a banner and no change actions (the servers refuse them
  anyway); the More menu shows a view-only login only the sections it was given.
- **Green / red are money colours:** statuses use the off-white "ok" tone (done, on, verified; `tint.ts`), gold
  (waiting, attention), ember (refused, failed) and sand (in progress). The block colours are one ember family since
  the web palette, so a light-ember "verified" would not stand apart from an ember "not approved". Tints come from
  the tokens (`tint.ts`), never fixed rgba values.
- **Matte colour blocks:** secondary text on a block is `inkSoft` (`tint.ts`: ink at 78 %, at least 4.5:1 on every
  block colour; the kit's `ink2` is 3.7:1 on ember). The founder's art: "kyc pending" on the verification start hero
  (ember) and on the More card, "kyc pending" / "kyc approved" on the tracker, "security" on the Security hero and
  the view-only empty states.
- **Haptics** only for selection changes (switches, chips, choices) and pull-to-refresh, like the rest of the app.
- **Privacy on a shared phone:** the photos captured for verification are kept in memory only for the review list
  and forgotten on sign-out.
