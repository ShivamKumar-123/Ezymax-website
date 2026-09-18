import { useState } from 'react'
import { Calendar, ArrowRight } from 'lucide-react'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'
import { BRAND_NAME } from '@/lib/brand'

const Blog = () => {
  const [filter, setFilter] = useState('all')

  const [expanded, setExpanded] = useState(null)

  const posts = [
    {
      title: 'How to Trade EUR/USD in 2025',
      category: 'Forex',
      date: 'March 15, 2025',
      excerpt: 'Master the most traded currency pair with our comprehensive guide to EUR/USD trading strategies.',
      body: 'EUR/USD remains the world\'s most liquid currency pair, accounting for nearly 25% of daily forex volume. Successful traders watch ECB and Fed policy divergence, key technical levels around the 1.05–1.12 range, and macro releases like NFP and Eurozone CPI. Build a structured plan: identify the trend on the daily chart, refine entries on the 1H/15M, and always size positions so a single loss never exceeds 1–2% of your account. Combine this with disciplined risk management and you have an edge that compounds over months.',
      image: '📈'
    },
    {
      title: 'Understanding Leverage and Margin',
      category: 'Strategy',
      date: 'March 12, 2025',
      excerpt: 'Learn how leverage works, its benefits, risks, and how to use it effectively in your trading.',
      body: 'Leverage lets you control a large position with a small deposit — a 1:500 leverage means $1,000 of margin controls $500,000 of notional exposure. The upside is amplified returns; the downside is amplified losses. Margin call kicks in when account equity falls below 30% of used margin, and stop-out triggers at 0%. Treat leverage as a tool, not a multiplier: most professionals use only 5–10x effective leverage even when 500x is available. Always size positions based on stop-loss distance and account risk — never based on what leverage allows.',
      image: '⚖️'
    },
    {
      title: 'Top 5 Forex Strategies for Beginners',
      category: 'Forex',
      date: 'March 10, 2025',
      excerpt: 'Start your trading journey right with these proven strategies designed for new traders.',
      body: 'Five strategies that work for beginners: (1) Trend-following on the 4H chart using 50/200 EMAs; (2) Support/resistance bounces at key round numbers; (3) Breakout trading after consolidation patterns; (4) News fade trades after high-impact releases; (5) Carry trades on positive interest-rate differentials. Pick ONE and master it for 3 months before adding another. Track every trade in a journal with screenshots and notes. The traders who succeed are not the ones with the most strategies — they are the ones who consistently execute one strategy with discipline.',
      image: '🎯'
    },
    {
      title: 'What Moves Gold Prices?',
      category: 'News',
      date: 'March 8, 2025',
      excerpt: 'Discover the key factors that influence gold prices and how to trade this precious metal.',
      body: 'Gold prices respond to four primary drivers: (1) US dollar strength — gold is priced in USD, so a stronger dollar typically means lower gold; (2) Real interest rates — when inflation-adjusted yields rise, gold loses appeal as a non-yielding asset; (3) Geopolitical risk — gold is the classic safe haven during crises; (4) Central bank demand — emerging-market central banks have been net buyers for over a decade. To trade gold effectively, watch the DXY, 10-year TIPS yields, and the geopolitical headline flow. Spot prices typically move within $20–40 per day.',
      image: '🥇'
    },
    {
      title: 'Getting Started with Copy Trading',
      category: 'Platforms',
      date: 'March 5, 2025',
      excerpt: `Learn how to follow expert traders and automatically replicate their strategies on ${BRAND_NAME}.`,
      body: `Copy trading lets you mirror the trades of experienced traders automatically — when they open a position, the same trade fires in your account, scaled to your allocated capital. On ${BRAND_NAME}, browse the leader board sorted by long-term return, max drawdown, and win rate. Allocate a portion of your capital (never all of it) and choose 3–5 leaders with different strategies (trend, scalping, swing) for diversification. Review monthly: keep what works, drop what does not. Copy trading is not passive income — it is active portfolio management of human strategies.`,
      image: '💻'
    },
    {
      title: 'Risk Management: The Key to Long-Term Success',
      category: 'Strategy',
      date: 'March 1, 2025',
      excerpt: 'Protect your capital and maximize profits with proper risk management techniques.',
      body: 'The single biggest difference between traders who survive and those who blow up: position sizing. Rule one — never risk more than 1–2% of your account on a single trade. Rule two — always set a stop-loss BEFORE entering, never after. Rule three — keep a 1:2 minimum reward-to-risk ratio so even a 40% win rate is profitable. Rule four — never add to a losing position; that is how small losses become account-killers. Rule five — log every trade and review monthly. The market will pay you to be disciplined and punish you for being greedy. There is no exception.',
      image: '🛡️'
    }
  ]

  const categories = ['all', 'Forex', 'Strategy', 'News', 'Platforms']

  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter(post => post.category === filter)

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Trading Blog</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Expert insights, market analysis, and trading tips to help you succeed.
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

          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post, index) => (
              <ScrollRevealItem key={index}>
                <ScrollReveal variant={index % 2 === 0 ? 'fadeLeft' : 'fadeRight'} delay={index * 0.05}>
                  <Card className="overflow-hidden">
                    <div className="aspect-video bg-gradient-primary/20 flex items-center justify-center text-6xl mb-4">
                      {post.image}
                    </div>
                    <div className="inline-block bg-primary-accent/20 text-primary-accent px-3 py-1 rounded-full text-sm font-semibold mb-3">
                      {post.category}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{post.title}</h3>
                    <div className="flex items-center gap-2 text-text-secondary text-sm mb-3">
                      <Calendar className="w-4 h-4" />
                      <span>{post.date}</span>
                    </div>
                    <p className="text-text-secondary mb-4">{post.excerpt}</p>
                    {expanded === index && (
                      <p className="text-text-secondary mb-4 leading-relaxed border-l-2 border-primary-accent/60 pl-4">
                        {post.body}
                      </p>
                    )}
                    <button
                      onClick={() => setExpanded(expanded === index ? null : index)}
                      className="flex items-center gap-2 text-primary-accent hover:text-white transition-colors font-semibold"
                    >
                      {expanded === index ? 'Show Less' : 'Read More'}
                      <ArrowRight className={`w-4 h-4 transition-transform ${expanded === index ? 'rotate-90' : ''}`} />
                    </button>
                  </Card>
                </ScrollReveal>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>
    </div>
  )
}

export default Blog
