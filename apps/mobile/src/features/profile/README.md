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
| `/profile/notifications` | `NotificationsScreen.tsx` | `notifications/prefs`, `auth/marketing` |

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
- **Step-up codes** use a sheet with its own code boxes on `BottomSheetTextInput`, so the sheet rises with the
  keyboard.
- **Legal links** come from `/api/mobile/menu`: the broker's website (its configured website domain, else the Client
  Area host without `app.`) + `/terms`, `/privacy`, `/risk-warning`, `/risk`, `/restricted-countries`, opened with
  `expo-web-browser`.
- **RTL:** the app's layout flips at once (root direction). A switch between LTR and RTL languages also sets
  `I18nManager.forceRTL` and offers a restart (`reloadAppAsync` from `expo`); `initI18n` keeps the native direction
  in step with the language from the next start.
- **Notifications:** in-app and email per topic (services/support); the email switch of "News and offers" is the
  account's marketing consent (gateway), as in the Client Area. Push is phase 2.
- **View-only logins and read-only staff sessions** see a banner and no change actions (the servers refuse them
  anyway); the More menu shows a view-only login only the sections it was given.
- **Green / red are money colours:** sign-in results, statuses and destructive actions use mint / gold / ember.
