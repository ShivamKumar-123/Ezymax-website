// Keys for this namespace. English is the source; translations live in ../<lang>/mobilePlatform.ts.
// Kalks mobile app (apps/mobile, src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Reused from other namespaces: dashboard.notifications.* (inbox title, mark all read, empty state), auth.google.*
// and auth.complete.* (Google sign-in), profile.notifications.cat.* (topic names), common.*.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "Inbox",
  "inbox.unread": { one: "{count} unread", other: "{count} unread" },
  "inbox.caughtUp": "All caught up",
  "inbox.filter.unread": "Unread",
  "inbox.markedAll": "All marked as read",
  "inbox.emptyUnread.title": "All caught up",
  "inbox.emptyUnread.body": "You've read every notification. New ones appear here as they arrive.",
  "inbox.loadMoreFailed": "Couldn't load older notifications. Tap to try again.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "You're offline. These are the notifications saved on this phone.",
  // Row accessibility: "Unread. Deposit credited. 100 USDT was credited. 2 minutes ago"
  "inbox.a11y.unread": "Unread",
  "inbox.a11y.settings": "Notification settings",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Open link",
  "inbox.detail.received": "Received {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Notifications",
  "push.ask.title": "Know the moment it happens",
  "push.ask.body": "Deposits credited, withdrawals paid, margin calls, stop-outs and support replies, straight to your lock screen.",
  "push.ask.point.money": "Deposits and withdrawals",
  "push.ask.point.risk": "Margin calls and stop-outs",
  "push.ask.point.support": "Replies from support",
  "push.ask.allow": "Turn on notifications",
  "push.ask.later": "Not now",
  "push.ask.note": "You choose the topics in Profile › Notifications. Offers are only sent if you turn them on.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "now",
  "push.ask.sampleTitle": "Deposit credited",
  "push.ask.sampleBody": "250.00 USDT was credited to your wallet.",
  "push.card.title": "Turn on push notifications",
  "push.card.body": "Get deposits, fills and margin calls on your lock screen.",
  "push.card.action": "Turn on",
  "push.card.deniedTitle": "Push notifications are off",
  "push.card.deniedBody": "Allow notifications for Kalks in your phone's settings to get them on your lock screen.",
  "push.card.deniedAction": "Open settings",
  "push.card.dismiss": "Hide",
  "push.enabled": "Push notifications are on",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Margin calls and security",
  "push.channel.alertsHint": "Margin call and stop-out warnings, your price alerts, new sign-ins",
  "push.channel.activity": "Account activity",
  "push.channel.activityHint": "Deposits, withdrawals, fills, verification and support replies",
  "push.channel.news": "News and offers",
  "push.channel.newsHint": "Promotions and product news you opted in to",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "New notification: {title}. Double tap to open.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "Locked",
  "lock.title": "Welcome back",
  "lock.subtitle": "Unlock to see your accounts and balances.",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "Unlock with {method}",
  "lock.unlock": "Unlock",
  "lock.prompt": "Unlock Kalks",
  "lock.promptSubtitle": "Confirm it's you",
  "lock.failed": "That didn't work. Try again.",
  "lock.lockout": "Too many attempts. Unlock your phone with its passcode, then try again.",
  "lock.noScreenLock": "Your phone has no screen lock any more, so Kalks can't confirm it's you. Sign out and sign in with your password.",
  "lock.notYou": "Not you, or can't unlock?",
  "lock.signOut": "Sign out",
  "lock.signOutTitle": "Sign out of Kalks?",
  "lock.signOutBody": "You'll sign in again with your email and password. Your positions and funds are not affected.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "fingerprint",
  "lock.method.face": "face unlock",
  "lock.method.iris": "iris",
  "lock.method.passcode": "passcode",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Security",
  "settings.title": "App lock",
  "settings.subtitle": "Keep Kalks locked with {method} when it opens and after it has been in the background.",
  "settings.toggle": "Lock Kalks",
  "settings.toggleHint": "Uses {method}, with your phone's passcode as the fallback",
  "settings.on": "App lock is on",
  "settings.off": "App lock is off",
  "settings.after": "Lock again after",
  "settings.afterHint": "How long Kalks may stay in the background before it asks again. It always asks when it starts.",
  "settings.timeout.0": "Immediately",
  "settings.timeout.60": "1 minute",
  "settings.timeout.300": "5 minutes",
  "settings.timeout.900": "15 minutes",
  "settings.timeout.3600": "1 hour",
  "settings.privacy": "While app lock is on, the app switcher shows a cover instead of your balances.",
  "settings.lockNow": "Lock now",
  "settings.confirmOn": "Confirm to turn on app lock",
  "settings.confirmOff": "Confirm to turn off app lock",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Confirm to change when Kalks locks",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "This phone has no screen lock, so Kalks can't confirm it's you. Set one up in your phone's settings to use app lock again.",
  "settings.notConfirmed": "Not confirmed, nothing changed",
  "settings.unavailableTitle": "Set up a screen lock first",
  "settings.unavailableBody": "App lock uses your phone's Face ID, fingerprint or passcode. Turn one on in your phone's settings, then come back.",
  "settings.webTitle": "Available in the app",
  "settings.webBody": "App lock works in the Kalks app for iPhone and Android.",
  "settings.thisPhone": "Applies to this phone only",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "Nothing to open here",
  "link.notFound.body": "This link doesn't match a screen in the app. It may be old, or meant for the Client Area on the web.",
  "link.notFound.home": "Go to Home",
  "link.openFailed": "Couldn't open this link.",
};
export default mobilePlatform;
