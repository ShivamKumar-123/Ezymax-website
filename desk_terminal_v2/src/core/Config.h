#pragma once
#include <QString>
#include <QStringList>

// Persists connection settings (API key/secret + endpoints) to a JSON file
// in the user's app-config directory. The secrets (token, refreshToken,
// apiKey, apiSecret) are encrypted at rest with DPAPI on Windows, and the
// file is written owner-read/write only on every platform (see Config.cpp).
class Config {
public:
    // Terminal login (email/password → JWT). Preferred.
    QString token;         // JWT — access token, expires in ~45 minutes
    // The pt_refresh cookie from sign-in, used to mint a new access token
    // without asking for the password again. It is SINGLE USE: every refresh
    // returns a replacement and invalidates this one, so whatever comes back
    // must be stored here or the next refresh fails with 401.
    //
    // Worth knowing: this is a 7-day credential sitting in a plaintext file
    // next to the access token. It is no worse than what was already here, but
    // it is longer-lived — the file is the whole session.
    QString refreshToken;
    QString accountId;     // selected trading account id
    QString userName;      // display name from the login response
    QString email;         // the address signed in with (prefills the login form)
    QString accountsJson = "[]";   // [{account_id, account_number, is_demo, currency}]

    // UI preferences
    QString theme   = "light"; // "dark" | "light" — light mirrors the MT5 layout
    bool    privacy = false;   // mask balances / account numbers on screen

    // Chart grid, restored on the next launch. A trader who set up a 2x2 of
    // four instruments should not have to rebuild it every session — the
    // terminal used to always reopen on a single chart.
    // chartSymbols is left-to-right for the visible panes; a short or empty
    // list just means those panes open on the default symbol.
    int         chartCount = 1;   // 1..4
    QStringList chartSymbols;

    // Window size, position and maximised state, restored on the next launch.
    //
    // Base64 of QMainWindow::saveGeometry(), which already encodes the
    // maximised/full-screen flag alongside the normal-state rectangle — so one
    // field covers both, and un-maximising restores the right size.
    //
    // Empty means "never launched before", and the terminal opens MAXIMISED.
    // It used to open at a hard-coded 1360x840 every time, which is small on a
    // trading monitor and taller than a 768/800px laptop screen, so the first
    // thing anyone did on every launch was maximise it by hand.
    QString windowGeometry;

    // Legacy bot auth (still supported for a pasted API key).
    QString apiKey;
    QString apiSecret;

    // REST base, e.g. https://api.swisscresta.com/api/algo
    QString restBase = "https://api.swisscresta.com/api/algo";
    // WebSocket URL, e.g. wss://api.swisscresta.com/ws/algo/prices
    // WebSockets only work on the api. host — trade.swisscresta.com proxies REST
    // but its nginx block does not upgrade the connection.
    QString wsUrl    = "wss://api.swisscresta.com/ws/algo/prices";

    bool hasToken() const {
        return !token.trimmed().isEmpty() && !accountId.trimmed().isEmpty();
    }
    bool hasCredentials() const {
        return hasToken() ||
               (!apiKey.trimmed().isEmpty() && !apiSecret.trimmed().isEmpty());
    }

    static QString filePath();   // resolved config file location
    static Config  load();       // load from disk (defaults if missing)
    bool           save() const; // write to disk; returns success

    // H-INF-6: the terminal must refuse plaintext endpoints (http:// / ws://)
    // so credentials never cross an unencrypted link. A dev may opt out with the
    // --allow-insecure CLI flag (main() calls setAllowInsecure(true)). When
    // insecure is NOT allowed, a non-https restBase / non-wss wsUrl loaded from
    // the config file is rejected and the secure default is kept.
    static void setAllowInsecure(bool v);
    static bool allowInsecure();
    static bool isSecureRest(const QString& url);  // https:// (or allowed)
    static bool isSecureWs(const QString& url);    // wss:// (or allowed)

    // There is deliberately NO migration from the TuskaEx build
    // this terminal was white-labelled from — see the note in Config.cpp before
    // adding one back.
};
