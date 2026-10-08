import { describe, expect, it } from 'vitest';
import { impactLabel, relativeTime, sanitiseMarketNews } from './marketNews';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const CAL = 'https://app.ezymex.com/calendar';

const story = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Federal Reserve issues FOMC statement',
  summary: 'ignored',
  link: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261008a.htm',
  source: { id: 'fed', name: 'Federal Reserve', homepage: 'https://www.federalreserve.gov' },
  publishedAt: '2026-10-08T11:48:00Z',
  currencies: ['USD'],
  symbols: ['EURUSD', 'XAUUSD'],
  importance: 80,
  ...over,
});

const event = (over: Record<string, unknown> = {}) => ({
  id: 9,
  title: 'CPI y/y',
  currency: 'USD',
  country: 'us',
  startsAt: '2026-10-08T14:15:00Z',
  allDay: false,
  impact: 3,
  symbols: ['EURUSD'],
  ...over,
});

describe('sanitiseMarketNews', () => {
  it('maps headlines and upcoming events, events first', () => {
    const items = sanitiseMarketNews({ pinned: [], items: [story()] }, { events: [event()] }, CAL, NOW);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: 'event', title: 'CPI y/y', source: 'USD', url: CAL, impact: 3, currencies: ['USD'] });
    expect(items[1]).toMatchObject({
      kind: 'news',
      title: 'Federal Reserve issues FOMC statement',
      source: 'Federal Reserve',
      impact: null,
      symbols: ['EURUSD', 'XAUUSD'],
    });
    expect(items[1].url).toMatch(/^https:\/\/www\.federalreserve\.gov\//);
  });

  it('drops unsafe links, markup, past or all-day events, and duplicates', () => {
    const items = sanitiseMarketNews(
      {
        pinned: [story({ title: 'Duplicate <b>story</b>' })],
        items: [
          story({ title: 'Duplicate story' }),
          story({ title: 'Script link', link: 'javascript:alert(1)' }),
          story({ title: 'No date', publishedAt: 'yesterday' }),
          story({ title: '' }),
        ],
      },
      {
        events: [
          event({ title: 'Already out', startsAt: '2026-10-08T09:00:00Z' }),
          event({ title: 'Bank holiday', allDay: true }),
          event({ title: 'Bad impact', impact: 7 }),
        ],
      },
      CAL,
      NOW,
    );
    expect(items.map((i) => i.title)).toEqual(['Duplicate story']);
  });

  it('accepts the single-event shape of /v1/calendar/next and survives junk input', () => {
    expect(sanitiseMarketNews(null, { event: event() }, CAL, NOW)).toHaveLength(1);
    expect(sanitiseMarketNews('nope', 42, CAL, NOW)).toEqual([]);
    expect(sanitiseMarketNews({ items: [null, 1, 'x'] }, { events: 'x' }, CAL, NOW)).toEqual([]);
  });

  it('caps the title length and normalises codes', () => {
    const long = 'A'.repeat(300);
    const [item] = sanitiseMarketNews({ items: [story({ title: long, currencies: ['usd', 'EURO', 'jpy'] })] }, null, CAL, NOW);
    expect(item.title.length).toBeLessThanOrEqual(140);
    expect(item.title.endsWith('…')).toBe(true);
    expect(item.currencies).toEqual(['USD', 'JPY']);
  });
});

describe('formatting', () => {
  it('labels impact and relative times', () => {
    expect(impactLabel(3)).toBe('HIGH');
    expect(impactLabel(2)).toBe('MED');
    expect(impactLabel(null)).toBe('');
    expect(relativeTime('2026-10-08T14:15:00Z', NOW)).toBe('in 2h 15m');
    expect(relativeTime('2026-10-08T11:48:00Z', NOW)).toBe('12m ago');
    expect(relativeTime('2026-10-11T16:00:00Z', NOW)).toBe('in 3d 4h');
  });
});
