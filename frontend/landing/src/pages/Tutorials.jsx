import { Clock, BarChart } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const Tutorials = () => {
  const courses = [
    {
      title: 'Forex Basics 101',
      description: 'Learn the fundamentals of forex trading from scratch. Perfect for complete beginners.',
      duration: '2 hours',
      level: 'Beginner',
      lessons: 12,
      icon: '📚'
    },
    {
      title: 'Technical Analysis Masterclass',
      description: 'Master chart patterns, indicators, and technical analysis strategies used by professionals.',
      duration: '4 hours',
      level: 'Intermediate',
      lessons: 20,
      icon: '📊'
    },
    {
      title: 'Risk Management & Psychology',
      description: 'Develop the mental discipline and risk management skills essential for trading success.',
      duration: '3 hours',
      level: 'Intermediate',
      lessons: 15,
      icon: '🧠'
    },
    {
      title: 'Algorithmic & Copy Trading',
      description: 'Learn to set up automated strategies and copy trading on TrustEdgeFX.',
      duration: '5 hours',
      level: 'Advanced',
      lessons: 25,
      icon: '🤖'
    }
  ]

  const getLevelColor = (level) => {
    switch (level) {
      case 'Beginner':
        return 'bg-green-500/20 text-green-400'
      case 'Intermediate':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'Advanced':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-primary-accent/20 text-primary-accent'
    }
  }

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Trading Tutorials</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Learn at your own pace with our comprehensive video courses and tutorials.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Featured Courses
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {courses.map((course, index) => (
              <ScrollRevealItem key={index}>
                <ScrollReveal variant="scaleUp" delay={index * 0.1}>
                  <Card className="p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="text-6xl">{course.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getLevelColor(course.level)}`}>
                            {course.level}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">{course.title}</h3>
                      </div>
                    </div>
                    <p className="text-text-secondary mb-6">{course.description}</p>
                    <div className="flex items-center gap-6 mb-6 text-text-secondary">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{course.duration}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart className="w-4 h-4" />
                        <span>{course.lessons} lessons</span>
                      </div>
                    </div>
                    <Button variant="primary" className="w-full" icon>
                      Start Learning
                    </Button>
                  </Card>
                </ScrollReveal>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <div className="glass-card p-12 text-center max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Why Learn with TrustEdgeFX?
              </h2>
              <div className="grid md:grid-cols-3 gap-8 mb-8">
                <div>
                  <div className="text-5xl mb-4">🎓</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Expert Instructors</h3>
                  <p className="text-text-secondary">Learn from professional traders with years of experience</p>
                </div>
                <div>
                  <div className="text-5xl mb-4">📱</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Learn Anywhere</h3>
                  <p className="text-text-secondary">Access courses on any device, anytime, anywhere</p>
                </div>
                <div>
                  <div className="text-5xl mb-4">🏆</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Practical Skills</h3>
                  <p className="text-text-secondary">Apply what you learn immediately in your trading</p>
                </div>
              </div>
              <Button variant="primary">Browse All Courses</Button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default Tutorials
