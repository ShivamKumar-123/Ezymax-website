import TradingPageTemplate from '../components/TradingPageTemplate'

const Crypto = () => {
  const data = {
    title: 'Crypto CFDs — Trade the Future',
    subtitle: 'Trade Bitcoin, Ethereum, and top altcoins as CFDs without owning the asset.',
    stats: [
      { label: 'Spread From', value: '0.5%' },
      { label: 'Leverage', value: '1:50' },
      { label: 'Cryptocurrencies', value: '25+' },
      { label: 'Market Hours', value: '24/7' }
    ],
    about: {
      title: 'Why Trade Crypto CFDs?',
      description: 'Cryptocurrency CFDs allow you to speculate on the price movements of Bitcoin, Ethereum, and other digital assets without the complexity of owning and storing them. Trade crypto 24/7 with leverage, go long or short, and benefit from TrustEdgeFX\'s secure platform and competitive spreads. Perfect for traders who want exposure to the crypto market with the flexibility of traditional CFD trading.'
    },
    instruments: [
      { symbol: 'BTC/USD (Bitcoin)', spread: '0.5%', leverage: '1:50', margin: '2.0%' },
      { symbol: 'ETH/USD (Ethereum)', spread: '0.6%', leverage: '1:50', margin: '2.0%' },
      { symbol: 'SOL/USD (Solana)', spread: '0.8%', leverage: '1:25', margin: '4.0%' },
      { symbol: 'XRP/USD (Ripple)', spread: '0.7%', leverage: '1:25', margin: '4.0%' },
      { symbol: 'BNB/USD (Binance)', spread: '0.7%', leverage: '1:25', margin: '4.0%' },
      { symbol: 'ADA/USD (Cardano)', spread: '0.8%', leverage: '1:25', margin: '4.0%' }
    ],
    benefits: [
      {
        icon: '🔐',
        title: 'No Wallet Needed',
        description: 'Trade crypto CFDs without the hassle of managing wallets, private keys, or exchange accounts.'
      },
      {
        icon: '⚡',
        title: '24/7 Trading',
        description: 'Access cryptocurrency markets around the clock, every day of the week with instant execution.'
      },
      {
        icon: '📉',
        title: 'Go Long or Short',
        description: 'Profit from both rising and falling crypto prices with the ability to short sell any instrument.'
      }
    ]
  }

  return <TradingPageTemplate {...data} />
}

export default Crypto
