import { useState } from 'react'
import { Calendar, TrendingUp, ArrowRight } from 'lucide-react'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'
//
const MarketNews = () => {
  const [filter, setFilter] = useState('all')

  const news = [
    {
      title: 'Federal Reserve Holds Interest Rates Steady',
      category: 'Economy',
      date: 'March 20, 2025',
      time: '14:30 GMT',
      summary: 'The Fed maintains current rates amid mixed economic signals, impacting USD pairs across the board.',
      impact: 'High'
    },
    {
      title: 'Gold Surges to New Yearly High',
      category: 'Commodities',
      date: 'March 20, 2025',
      time: '12:15 GMT',
      summary: 'XAU/USD breaks through $2,100 resistance as safe-haven demand increases amid geopolitical tensions.',
      impact: 'High'
    },
    {
      title: 'EUR/USD Tests Key Support at 1.0800',
      category: 'Forex',
      date: 'March 20, 2025',
      time: '10:00 GMT',
      summary: 'Euro weakens against dollar as ECB signals potential rate cuts in upcoming meetings.',
      impact: 'Medium'
    },
    {
      title: 'Bitcoin Volatility Increases Ahead of Halving',
      category: 'Crypto',
      date: 'March 19, 2025',
      time: '16:45 GMT',
      summary: 'BTC/USD sees increased trading volume as market anticipates the upcoming halving event.',
      impact: 'Medium'
    },
    {
      title: 'Oil Prices Decline on Supply Concerns',
      category: 'Commodities',
      date: 'March 19, 2025',
      time: '13:20 GMT',
      summary: 'WTI crude falls below $75 as OPEC+ considers production increases.',
      impact: 'Medium'
    },
    {
      title: 'UK Inflation Data Beats Expectations',
      category: 'Economy',
      date: 'March 19, 2025',
      time: '09:30 GMT',
      summary: 'GBP strengthens as inflation comes in higher than forecast, reducing rate cut expectations.',
      impact: 'High'
    },
    {
      title: 'S&P 500 Reaches New All-Time High',
      category: 'Forex',
      date: 'March 18, 2025',
      time: '20:00 GMT',
      summary: 'US equity markets rally on strong corporate earnings and positive economic data.',
      impact: 'Low'
    },
    {
      title: 'Japanese Yen Weakens on BoJ Policy',
      category: 'Forex',
      date: 'March 18, 2025',
      time: '05:00 GMT',
      summary: 'USD/JPY climbs as Bank of Japan maintains ultra-loose monetary policy stance.',
      impact: 'Medium'
    }
  ]

  const categories = ['all', 'Forex', 'Commodities', 'Crypto', 'Economy']

  const filteredNews = filter === 'all'
    ? news
    : news.filter(item => item.category === filter)

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'High':
        return 'text-red-400'
      case 'Medium':
        return 'text-yellow-400'
      case 'Low':
        return 'text-green-400'
      default:
        return 'text-text-secondary'
    }
  }

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Market News</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Stay updated with the latest market news and analysis from around the world.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeIn">
            <div className="flex flex-wrap gap-4 justify-center mb-12">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilter(category)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all ${
                    filter === category
                      ? 'bg-primary-accent text-white'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </ScrollReveal>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <ScrollRevealGroup className="space-y-6">
                {filteredNews.map((item, index) => (
                  <ScrollRevealItem key={index}>
                    <Card className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="inline-block bg-primary-accent/20 text-primary-accent px-3 py-1 rounded-full text-sm font-semibold">
                          {item.category}
                        </div>
                        <div className={`font-semibold ${getImpactColor(item.impact)}`}>
                          {item.impact} Impact
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                      <div className="flex items-center gap-4 text-text-secondary text-sm mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{item.date}</span>
                        </div>
                        <span>•</span>
                        <span>{item.time}</span>
                      </div>
                      <p className="text-text-secondary mb-4">{item.summary}</p>
                      <button className="flex items-center gap-2 text-primary-accent hover:text-white transition-colors font-semibold">
                        Read More
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Card>
                  </ScrollRevealItem>
                ))}
              </ScrollRevealGroup>
            </div>

            <ScrollReveal variant="fadeRight" delay={0.2}>
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-accent" />
                    Economic Calendar
                  </h3>
                  <div className="space-y-4">
                    <div className="pb-4 border-b border-white/10">
                      <div className="text-text-secondary text-sm mb-1">Today, 14:30 GMT</div>
                      <div className="text-white font-semibold">US GDP Data</div>
                      <div className="text-red-400 text-sm">High Impact</div>
                    </div>
                    <div className="pb-4 border-b border-white/10">
                      <div className="text-text-secondary text-sm mb-1">Tomorrow, 09:30 GMT</div>
                      <div className="text-white font-semibold">UK Employment</div>
                      <div className="text-yellow-400 text-sm">Medium Impact</div>
                    </div>
                    <div className="pb-4 border-b border-white/10">
                      <div className="text-text-secondary text-sm mb-1">Tomorrow, 12:00 GMT</div>
                      <div className="text-white font-semibold">ECB Speech</div>
                      <div className="text-red-400 text-sm">High Impact</div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Quick Links</h3>
                  <div className="space-y-3">
                    <a href="#" className="block text-text-secondary hover:text-primary-accent transition-colors">
                      → Trading Strategies
                    </a>
                    <a href="#" className="block text-text-secondary hover:text-primary-accent transition-colors">
                      → Market Analysis
                    </a>
                    <a href="#" className="block text-text-secondary hover:text-primary-accent transition-colors">
                      → Educational Resources
                    </a>
                    <a href="#" className="block text-text-secondary hover:text-primary-accent transition-colors">
                      → Trading Platforms
                    </a>
                  </div>
                </Card>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  )
}

export default MarketNews
