import { useEffect, useRef } from 'react'

export default function TickerTape() {
  const container = useRef(null)

  useEffect(() => {
    if (!container.current) return
    container.current.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    container.current.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'FX:EURUSD', title: 'EUR/USD' },
        { proName: 'FX:GBPUSD', title: 'GBP/USD' },
        { proName: 'FX:USDJPY', title: 'USD/JPY' },
        { proName: 'FX:AUDUSD', title: 'AUD/USD' },
        { proName: 'OANDA:XAUUSD', title: 'Gold' },
        { proName: 'BINANCE:BTCUSDT', title: 'BTC/USDT' },
        { proName: 'BINANCE:ETHUSDT', title: 'ETH/USDT' },
        { proName: 'CAPITALCOM:US30', title: 'US30' },
        { proName: 'FX:USDCHF', title: 'USD/CHF' },
        { proName: 'FX:USDCAD', title: 'USD/CAD' },
        { proName: 'OANDA:XAGUSD', title: 'Silver' },
        { proName: 'CAPITALCOM:US500', title: 'S&P 500' }
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en'
    })

    container.current.appendChild(script)
  }, [])

  return (
    <div className="w-full bg-primary-bg border-y border-white/[0.06]">
      <div
        className="tradingview-widget-container"
        ref={container}
      />
    </div>
  )
}
