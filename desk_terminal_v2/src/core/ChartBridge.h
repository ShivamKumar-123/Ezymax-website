#pragma once
#include <QObject>
#include <QString>
#include <QQueue>
#include <QHash>
#include "core/Models.h"

class ApiClient;
class PriceStream;

// Bridge object exposed to the TradingView web layer over QWebChannel as `sc`.
// The JS datafeed calls requestBars() and listens to barsReady()/tick();
// the native side pushes symbol metadata and selection changes down.
class ChartBridge : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString symbolsJson    READ symbolsJson    NOTIFY symbolsChanged)
    Q_PROPERTY(QString currentSymbol  READ currentSymbol  NOTIFY symbolChanged)
    Q_PROPERTY(QString positionsJson  READ positionsJson  NOTIFY positionsChanged)
    Q_PROPERTY(QString theme          READ theme          NOTIFY themeChanged)
    // True while this pane is one of several. The web layer drops the drawing
    // toolbar and the bottom date-range bar in that state — in a quarter-sized
    // pane they cost more room than they earn.
    Q_PROPERTY(bool    compact        READ compact        NOTIFY compactChanged)
public:
    ChartBridge(ApiClient* api, PriceStream* stream, QObject* parent = nullptr);

    QString symbolsJson()   const { return m_symbolsJson; }
    QString currentSymbol() const { return m_currentSymbol; }
    QString positionsJson() const { return m_positionsJson; }
    QString theme()         const { return m_theme; }
    bool    compact()       const { return m_compact; }

    void setTheme(const QString& theme);   // "dark" | "light"
    // Rebuilds the chart with a reduced chrome set. Costly (the widget is torn
    // down and recreated), so it is only called when the value actually flips.
    void setCompact(bool compact);

    void setSymbols(const QVector<SymbolSpec>& symbols);  // called by MainWindow
    void setCurrentSymbol(const QString& symbol);          // watchlist selection
    void setPositions(const QVector<OpenPosition>& positions);  // account poll

    // JS -> C++: ask for history. Answered asynchronously via barsReady().
    Q_INVOKABLE void requestBars(const QString& symbol, const QString& timeframe,
                                 double fromSec, double toSec, const QString& reqId);

    // JS (chart overlay) -> C++: set one bracket ("sl" | "tp") on a live
    // position, or close it. level <= 0 asks to remove. Answered via positionOp().
    Q_INVOKABLE void modifyBracket(const QString& positionId, const QString& kind, double level);
    Q_INVOKABLE void closePosition(const QString& positionId);

    // JS -> C++: a TradingView dialog (Indicators, settings, …) opened or
    // closed. Those render INSIDE the chart iframe, so the native one-click
    // strip floating over the web view would otherwise cover them permanently.
    Q_INVOKABLE void setOverlayHidden(bool hidden);

    // JS -> C++: the trader picked a symbol inside the chart's own search box,
    // rather than from the Market Watch. Without this the native side never
    // learns, keeps filtering ticks to the old symbol, and the newly chosen one
    // draws its history and then sits frozen.
    Q_INVOKABLE void chartSymbolPicked(const QString& symbol);

signals:
    void symbolsChanged();
    void symbolChanged(const QString& symbol);
    // Raised only for an in-chart pick, so the pane can retitle itself. Kept
    // separate from symbolChanged, which is the C++ -> JS direction; reusing it
    // would send the symbol straight back to the chart that just set it.
    void symbolPickedInChart(const QString& symbol);
    void positionsChanged();
    void themeChanged(const QString& theme);
    void compactChanged(bool compact);
    void barsReady(const QString& reqId, const QString& barsJson);
    void tick(const QString& symbol, double bid, double ask, double tsMs);
    // Result of a modifyBrackets()/closePosition() call, back to the broker adapter.
    void positionOp(const QString& positionId, const QString& op, bool ok, const QString& message);
    // Raised when a chart dialog opens/closes, so the host can hide the strip.
    void overlayHiddenChanged(bool hidden);

private slots:
    void onBarsReceived(const QString& symbol, const QString& timeframe, const QVector<Bar>& bars);
    void onTick(const Quote& q);

private:
    // Replays the last known quote for `symbol` as a tick, so the web datafeed
    // knows the symbol's spread the moment the chart switches to it.
    //
    // Without this the datafeed was blind on every symbol switch: onTick()
    // forwards only the CURRENT symbol, so a symbol the chart has just moved to
    // has never been seen over the WebChannel and its spread is unknown. The
    // datafeed waits 1.5 s for a first tick before giving up and handing the
    // chart MID-basis history — and the correction it then ran (the library's
    // onResetCacheNeededCallback) makes the charting library drop the series'
    // realtime subscription WITHOUT re-creating it. The result was the reported
    // bug: after switching instruments the candle stopped moving, permanently.
    //
    // Priming the spread up front means history is delivered on the right (BID)
    // basis first time, so that correction never has to run at all.
    void primeSpread(const QString& symbol);

    ApiClient*   m_api;
    PriceStream* m_stream;
    QString      m_symbolsJson = "[]";
    QString      m_positionsJson = "[]";
    QString      m_currentSymbol;
    bool         m_compact = false;
    QString      m_theme = "dark";

    // Last quote seen for EVERY symbol, not just the charted one — the cache
    // primeSpread() replays from. Storing a struct per symbol (~60) is cheap;
    // it is the *emitting* of every symbol that was expensive, and onTick()
    // still filters that.
    QHash<QString, Quote> m_lastQuotes;

    // Correlate async /bars responses (which carry only symbol+tf) back to the
    // JS reqId that asked, FIFO per (symbol,timeframe).
    struct Pending { QString key; QString reqId; };
    QQueue<Pending> m_pending;
};
