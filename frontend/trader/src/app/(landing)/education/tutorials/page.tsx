'use client';

/**
 * Education → Trading Tutorials. Restyled onto the shared marketing design
 * system; every line of copy is carried over from the previous page.
 */
import { Clock, BarChart, GraduationCap, Smartphone, Trophy } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';

const COURSES: Array<{
  title: string; description: string; duration: string; level: Level; lessons: number; icon: string;
}> = [
  {
    title: 'Forex Basics 101',
    description: 'Learn the fundamentals of forex trading from scratch. Perfect for complete beginners.',
    duration: '2 hours',
    level: 'Beginner',
    lessons: 12,
    icon: '📚',
  },
  {
    title: 'Technical Analysis Masterclass',
    description: 'Master chart patterns, indicators, and technical analysis strategies used by professionals.',
    duration: '4 hours',
    level: 'Intermediate',
    lessons: 20,
    icon: '📊',
  },
  {
    title: 'Position Sizing & Psychology',
    description: 'Build the discipline and position-sizing habits that keep a trading account intact.',
    duration: '3 hours',
    level: 'Intermediate',
    lessons: 15,
    icon: '🧠',
  },
  {
    title: 'Algorithmic & Copy Trading',
    description: `Learn to set up automated strategies and copy trading on ${BRAND_NAME}.`,
    duration: '5 hours',
    level: 'Advanced',
    lessons: 25,
    icon: '🤖',
  },
];

function levelColor(level: Level): string {
  if (level === 'Beginner') return 'var(--mk-up)';
  if (level === 'Intermediate') return 'var(--mk-accent)';
  return 'var(--mk-down)';
}

export default function TutorialsPage() {
  return (
    <main>
      <PageHero
        kicker="Education"
        title="Trading Tutorials"
        lead="Learn at your own pace with our comprehensive video courses and tutorials."
        primary={{ label: 'Browse All Courses', href: '/academy' }}
      />

      <Section raised>
        <SectionHeading kicker="Courses" title="Featured Courses" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
          {COURSES.map((course) => (
            <article key={course.title} className="mk-card mk-card--hover flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <span
                  className="inline-flex h-14 w-14 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', fontSize: '1.75rem' }}
                  aria-hidden
                >
                  {course.icon}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <span
                    className="self-start rounded-full px-2.5 py-1 font-bold uppercase"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      border: `1px solid ${levelColor(course.level)}`,
                      color: levelColor(course.level),
                    }}
                  >
                    {course.level}
                  </span>
                  <h3 className="mk-h3">{course.title}</h3>
                </div>
              </div>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{course.description}</p>
              <div
                className="flex items-center gap-6 flex-wrap"
                style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}
              >
                <span className="inline-flex items-center gap-2"><Clock size={15} /> {course.duration}</span>
                <span className="inline-flex items-center gap-2"><BarChart size={15} /> {course.lessons} lessons</span>
              </div>
              <a href="/academy" className="mk-btn mk-btn--primary w-full mt-auto">Start Learning</a>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Why Learn Here" title={`Why Learn with ${BRAND_NAME}?`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: GraduationCap, title: 'Expert Instructors', body: 'Learn from professional traders with years of experience' },
            { icon: Smartphone,    title: 'Learn Anywhere',     body: 'Access courses on any device, anytime, anywhere' },
            { icon: Trophy,        title: 'Practical Skills',   body: 'Apply what you learn immediately in your trading' },
          ]}
        />
      </Section>

      <CtaBanner
        title="Browse All Courses"
        lead={`Work through the ${BRAND_NAME} curriculum at your own pace, then apply it on a live or demo account.`}
        primary={{ label: 'Browse All Courses', href: '/academy' }}
        secondary={{ label: 'Open Account', href: '/auth/register' }}
      />
    </main>
  );
}
