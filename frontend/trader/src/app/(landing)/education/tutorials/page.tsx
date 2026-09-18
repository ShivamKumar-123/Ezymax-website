'use client';

/**
 * Education → Platform Tutorials. Restyled onto the shared marketing design
 * system; the copy is written in the software-vendor voice.
 */
import { Clock, BarChart, GraduationCap, Smartphone, Trophy } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';

const COURSES: Array<{
  title: string; description: string; duration: string; level: Level; lessons: number; icon: string;
}> = [
  {
    title: 'Platform Onboarding 101',
    description: 'Get up and running with the trading terminal — layout, order tickets, watchlists, and account setup.',
    duration: '2 hours',
    level: 'Beginner',
    lessons: 12,
    icon: '📚',
  },
  {
    title: 'Charting & Terminal Deep Dive',
    description: 'Master the charting engine, indicators, and terminal features your clients use every day.',
    duration: '4 hours',
    level: 'Intermediate',
    lessons: 20,
    icon: '📊',
  },
  {
    title: 'Admin & Risk Controls',
    description: 'Configure account groups, leverage tiers, margin and stop-out rules from the admin back office.',
    duration: '3 hours',
    level: 'Intermediate',
    lessons: 15,
    icon: '🧠',
  },
  {
    title: 'Copy Trading & Algo Setup',
    description: `Set up the copy-trading and algorithmic modules ${BRAND_NAME} builds into your platform.`,
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
        title="Platform Tutorials"
        lead="Step-by-step guides to the platform and back office, for operators and their teams — learn it at your own pace."
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
        <SectionHeading kicker="Why Learn Here" title={`Why Learn the ${BRAND_NAME} Platform?`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: GraduationCap, title: 'Built by the Platform Team', body: 'Learn the platform from the people who build and support it' },
            { icon: Smartphone,    title: 'Learn Anywhere',            body: 'Access tutorials on any device, anytime, anywhere' },
            { icon: Trophy,        title: 'Ready to Configure',        body: 'Apply each lesson directly in your platform and back office' },
          ]}
        />
      </Section>

      <CtaBanner
        title="Browse All Courses"
        lead={`Work through the ${BRAND_NAME} platform tutorials at your own pace, then book a demo to see it live.`}
        primary={{ label: 'Browse All Courses', href: '/academy' }}
        secondary={{ label: 'Book a demo', href: '/company/contact' }}
      />
    </main>
  );
}
