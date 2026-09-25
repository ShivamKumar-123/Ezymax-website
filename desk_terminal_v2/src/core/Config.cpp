#include "core/Config.h"
#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>

#ifdef Q_OS_WIN
#  ifndef NOMINMAX
#    define NOMINMAX   // keep windows.h's min/max macros away from Qt/std
#  endif
#  include <windows.h>
#  include <wincrypt.h>
#endif

// H-INF-6: secrets at rest.
//
// The session token, the 7-day refresh token and the algo API key/secret used
// to sit in config.json in plaintext — anything that could read the file (other
// local accounts, malware, a synced/backed-up profile) got a live session. On
// Windows they are now encrypted with DPAPI (CryptProtectData), which binds the
// ciphertext to the current Windows user: another account, or a copy of the
// file on another machine, cannot decrypt it. On every platform the file is
// also written owner-read/write only.
//
// Stored form: "dpapi:<base64>". A value without the prefix is a legacy
// plaintext entry — it is read once and re-written encrypted on the next save.
namespace {
const QLatin1String kDpapiPrefix("dpapi:");

QString protectSecret(const QString& plain) {
    if (plain.isEmpty()) return plain;
#ifdef Q_OS_WIN
    QByteArray in = plain.toUtf8();
    DATA_BLOB inBlob;
    inBlob.pbData = reinterpret_cast<BYTE*>(in.data());
    inBlob.cbData = static_cast<DWORD>(in.size());
    DATA_BLOB outBlob{};
    if (CryptProtectData(&inBlob, L"SwissCresta Terminal", nullptr, nullptr, nullptr,
                         CRYPTPROTECT_UI_FORBIDDEN, &outBlob)) {
        const QByteArray enc(reinterpret_cast<const char*>(outBlob.pbData),
                             static_cast<int>(outBlob.cbData));
        LocalFree(outBlob.pbData);
        return QString(kDpapiPrefix) + QString::fromLatin1(enc.toBase64());
    }
    // Never fall back to writing the secret in plaintext: an empty value just
    // means the user signs in again next launch.
    return QString();
#else
    return plain;   // non-Windows: protected by the owner-only file mode below
#endif
}

QString unprotectSecret(const QString& stored) {
    if (!stored.startsWith(kDpapiPrefix)) return stored;   // legacy plaintext
#ifdef Q_OS_WIN
    QByteArray enc = QByteArray::fromBase64(stored.mid(kDpapiPrefix.size()).toLatin1());
    DATA_BLOB inBlob;
    inBlob.pbData = reinterpret_cast<BYTE*>(enc.data());
    inBlob.cbData = static_cast<DWORD>(enc.size());
    DATA_BLOB outBlob{};
    if (CryptUnprotectData(&inBlob, nullptr, nullptr, nullptr, nullptr,
                           CRYPTPROTECT_UI_FORBIDDEN, &outBlob)) {
        const QString plain = QString::fromUtf8(reinterpret_cast<const char*>(outBlob.pbData),
                                                static_cast<int>(outBlob.cbData));
        SecureZeroMemory(outBlob.pbData, outBlob.cbData);
        LocalFree(outBlob.pbData);
        return plain;
    }
#endif
    // Can't decrypt (different user / machine, or a non-Windows build reading a
    // Windows file) → treat as signed out.
    return QString();
}
} // namespace

QString Config::filePath() {
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppConfigLocation);
    if (dir.isEmpty())
        dir = QDir::homePath() + "/.swisscresta-terminal";
    QDir().mkpath(dir);
    return dir + "/config.json";
}

// NO legacy config migration — deliberately.
//
// This build is the SwissCresta white-label of the TuskaEx terminal, and those
// are two *different platforms*, not a rename of one. A TuskaEx token or API
// key authenticates nothing against api.swisscresta.com, and adopting one would
// also drag its endpoints in, pointing this build at another broker's API. So a
// SwissCresta install starts with a clean config and a real sign-in.
//
// For the same reason nothing deletes those files either: the TuskaEx terminal
// may still be installed on this machine and its config is its own. The two
// write to different AppConfig folders (organisation name in main.cpp), so they
// coexist without either touching the other's session.

Config Config::load() {
    Config c;
    QFile f(filePath());
    if (!f.open(QIODevice::ReadOnly))
        return c; // defaults

    const QJsonObject o = QJsonDocument::fromJson(f.readAll()).object();
    if (o.contains("token"))     c.token     = unprotectSecret(o.value("token").toString());
    if (o.contains("refreshToken")) c.refreshToken = unprotectSecret(o.value("refreshToken").toString());
    if (o.contains("accountId")) c.accountId = o.value("accountId").toString();
    if (o.contains("userName"))  c.userName  = o.value("userName").toString();
    if (o.contains("email"))     c.email     = o.value("email").toString();
    if (o.contains("theme"))     c.theme     = o.value("theme").toString("dark");
    if (o.contains("privacy"))   c.privacy   = o.value("privacy").toBool();
    if (o.contains("accountsJson")) c.accountsJson = o.value("accountsJson").toString();
    if (o.contains("apiKey"))    c.apiKey    = unprotectSecret(o.value("apiKey").toString());
    if (o.contains("apiSecret")) c.apiSecret = unprotectSecret(o.value("apiSecret").toString());
    // Clamped on the way in: a hand-edited or corrupt file must not put the
    // grid into a state setChartCount() would reject anyway.
    if (o.contains("windowGeometry")) c.windowGeometry = o.value("windowGeometry").toString();
    if (o.contains("chartCount"))
        c.chartCount = qBound(1, o.value("chartCount").toInt(1), 4);
    if (o.contains("chartSymbols")) {
        c.chartSymbols.clear();
        for (const QJsonValue& v : o.value("chartSymbols").toArray())
            c.chartSymbols << v.toString();
    }
    // H-INF-6: only accept a file-supplied endpoint if it uses TLS (https/wss),
    // unless --allow-insecure was passed. A plaintext override is ignored so the
    // secure default stands, never silently downgrading the connection.
    if (o.contains("restBase") && !o.value("restBase").toString().isEmpty()) {
        const QString v = o.value("restBase").toString();
        if (isSecureRest(v)) c.restBase = v;
    }
    if (o.contains("wsUrl") && !o.value("wsUrl").toString().isEmpty()) {
        const QString v = o.value("wsUrl").toString();
        if (isSecureWs(v)) c.wsUrl = v;
    }
    return c;
}

namespace { bool g_allowInsecure = false; }

void Config::setAllowInsecure(bool v) { g_allowInsecure = v; }
bool Config::allowInsecure() { return g_allowInsecure; }

bool Config::isSecureRest(const QString& url) {
    return g_allowInsecure || url.startsWith("https://", Qt::CaseInsensitive);
}

bool Config::isSecureWs(const QString& url) {
    return g_allowInsecure || url.startsWith("wss://", Qt::CaseInsensitive);
}

bool Config::save() const {
    QJsonObject o;
    o["token"]        = protectSecret(token);
    o["refreshToken"] = protectSecret(refreshToken);
    o["accountId"]    = accountId;
    o["userName"]     = userName;
    o["email"]        = email;
    o["theme"]        = theme;
    o["privacy"]      = privacy;
    o["accountsJson"] = accountsJson;
    o["apiKey"]       = protectSecret(apiKey);
    o["apiSecret"]    = protectSecret(apiSecret);
    o["restBase"]     = restBase;
    o["wsUrl"]        = wsUrl;
    o["windowGeometry"] = windowGeometry;
    o["chartCount"]   = chartCount;
    o["chartSymbols"] = QJsonArray::fromStringList(chartSymbols);

    QFile f(filePath());
    if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate))
        return false;
    f.write(QJsonDocument(o).toJson(QJsonDocument::Indented));
    f.close();
    // Owner read/write only (0600 on macOS/Linux): other local accounts must not
    // be able to read the session. Windows relies on DPAPI + the per-user
    // AppData ACL; this call is harmless there.
    f.setPermissions(QFileDevice::ReadOwner | QFileDevice::WriteOwner);
    return true;
}
