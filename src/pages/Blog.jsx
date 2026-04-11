import { useState } from 'react'
import { Calendar, ArrowRight } from 'lucide-react'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const Blog = () => {
  const [filter, setFilter] = useState('all')

  const posts = [
    {
      title: 'How to Trade EUR/USD in 2025',
      category: 'Forex',
      date: 'March 15, 2025',
      excerpt: 'Master the most traded currency pair with our comprehensive guide to EUR/USD trading strategies.',
      image: '📈'
    },
    {
      title: 'Understanding Leverage and Margin',
      category: 'Strategy',
      date: 'March 12, 2025',
      excerpt: 'Learn how leverage works, its benefits, risks, and how to use it effectively in your trading.',
      image: '⚖️'
    },
    {
      title: 'Top 5 Forex Strategies for Beginners',
      category: 'Forex',
      date: 'March 10, 2025',
      excerpt: 'Start your trading journey right with these proven strategies designed for new traders.',
      image: '🎯'
    },
    {
      title: 'What Moves Gold Prices?',
      category: 'News',
      date: 'March 8, 2025',
      excerpt: 'Discover the key factors that influence gold prices and how to trade this precious metal.',
      image: '🥇'
    },
    {
      title: 'Getting Started with Copy Trading',
      category: 'Platforms',
      date: 'March 5, 2025',
      excerpt: 'Learn how to follow expert traders and automatically replicate their strategies on TrustEdgeFX.',
      image: '💻'
    },
    {
      title: 'Risk Management: The Key to Long-Term Success',
      category: 'Strategy',
      date: 'March 1, 2025',
      excerpt: 'Protect your capital and maximize profits with proper risk management techniques.',
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
                    <button className="flex items-center gap-2 text-primary-accent hover:text-white transition-colors font-semibold">
                      Read More
                      <ArrowRight className="w-4 h-4" />
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
