import { useEffect, useRef, memo } from 'react'

const CHART_HEIGHT = 700

function TradingViewWidget({ symbol = 'FX:EURUSD' }) {
  const container = useRef(null)

  useEffect(() => {
    if (!container.current) return
    container.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: '100%',
      height: CHART_HEIGHT,
      symbol: symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      backgroundColor: 'rgba(10, 14, 26, 1)',
      gridColor: 'rgba(255, 255, 255, 0.04)',
    })

    const widgetContainer = document.createElement('div')
    widgetContainer.className = 'tradingview-widget-container__widget'
    widgetContainer.style.height = `${CHART_HEIGHT}px`
    widgetContainer.style.width = '100%'

    container.current.appendChild(widgetContainer)
    container.current.appendChild(script)
  }, [symbol])

  return (
    <div
      className="tradingview-widget-container rounded-lg overflow-hidden border border-white/[0.08]"
      ref={container}
      style={{ height: `${CHART_HEIGHT}px`, width: '100%' }}
    />
  )
}

export default memo(TradingViewWidget)
