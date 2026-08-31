#include "core/Config.h"
#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>

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
    if (o.contains("token"))     c.token     = o.value("token").toString();
    if (o.contains("refreshToken")) c.refreshToken = o.value("refreshToken").toString();
    if (o.contains("accountId")) c.accountId = o.value("accountId").toString();
    if (o.contains("userName"))  c.userName  = o.value("userName").toString();
    if (o.contains("email"))     c.email     = o.value("email").toString();
    if (o.contains("theme"))     c.theme     = o.value("theme").toString("dark");
    if (o.contains("privacy"))   c.privacy   = o.value("privacy").toBool();
    if (o.contains("accountsJson")) c.accountsJson = o.value("accountsJson").toString();
    if (o.contains("apiKey"))    c.apiKey    = o.value("apiKey").toString();
    if (o.contains("apiSecret")) c.apiSecret = o.value("apiSecret").toString();
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
    if (o.contains("restBase") && !o.value("restBase").toString().isEmpty())
        c.restBase = o.value("restBase").toString();
    if (o.contains("wsUrl") && !o.value("wsUrl").toString().isEmpty())
        c.wsUrl = o.value("wsUrl").toString();
    return c;
}

bool Config::save() const {
    QJsonObject o;
    o["token"]        = token;
    o["refreshToken"] = refreshToken;
    o["accountId"]    = accountId;
    o["userName"]     = userName;
    o["email"]        = email;
    o["theme"]        = theme;
    o["privacy"]      = privacy;
    o["accountsJson"] = accountsJson;
    o["apiKey"]       = apiKey;
    o["apiSecret"]    = apiSecret;
    o["restBase"]     = restBase;
    o["wsUrl"]        = wsUrl;
    o["windowGeometry"] = windowGeometry;
    o["chartCount"]   = chartCount;
    o["chartSymbols"] = QJsonArray::fromStringList(chartSymbols);

    QFile f(filePath());
    if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate))
        return false;
    f.write(QJsonDocument(o).toJson(QJsonDocument::Indented));
    return true;
}
