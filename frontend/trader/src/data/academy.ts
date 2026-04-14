export const phases = [
  {
    id: 1,
    num: 'I',
    title: 'FOUNDATIONS',
    subtitle: 'The Bedrock of Forex',
    duration: '4-6 Weeks',
    level: 'BEGINNER',
    totalMinutes: 170,
    color: '#2196f3',
    description: 'Build an unshakeable foundation. No shortcuts. No skipping. Every professional trader started here.',
    modules: [
      { id: '1.1', title: 'What Is the Forex Market?', topics: 6, minutes: 20, level: 'BEGINNER' },
      { id: '1.2', title: 'Currency Pairs & Market Structure', topics: 6, minutes: 30, level: 'BEGINNER' },
      { id: '1.3', title: 'Trading Sessions & Timing', topics: 6, minutes: 20, level: 'BEGINNER' },
      { id: '1.4', title: 'Brokers, Platforms & Account Types', topics: 7, minutes: 35, level: 'BEGINNER' },
      { id: '1.5', title: 'Core Mechanics: Pips, Lots & Orders', topics: 7, minutes: 30, level: 'BEGINNER' },
      { id: '1.6', title: 'Risk & Money Management Fundamentals', topics: 6, minutes: 30, level: 'BEGINNER' },
    ],
    quiz: {
      title: 'PHASE I Quiz',
      questions: [
        {
          id: 1,
          question: 'What is the daily trading volume of the forex market?',
          options: ['$1.5 Trillion', '$4.5 Trillion', '$7.5 Trillion', '$10 Trillion'],
          correct: 2,
        },
        {
          id: 2,
          question: 'Which session has the highest trading volume?',
          options: ['Asian Session', 'London Session', 'New York Session', 'Sydney Session'],
          correct: 1,
        },
        {
          id: 3,
          question: 'What does a pip represent in forex trading?',
          options: ['1% price change', 'Smallest price increment', 'A trading strategy', 'A type of order'],
          correct: 1,
        },
      ],
    },
  },
  {
    id: 2,
    num: 'II',
    title: 'TECHNICAL ANALYSIS',
    subtitle: 'Reading the Chart Like a Map',
    duration: '6-8 Weeks',
    level: 'BEGINNER',
    totalMinutes: 210,
    color: '#2196f3',
    modules: [
      { id: '2.1', title: 'Introduction to Charts', topics: 6, minutes: 25, level: 'BEGINNER' },
      { id: '2.2', title: 'Support & Resistance', topics: 6, minutes: 30, level: 'BEGINNER' },
      { id: '2.3', title: 'Candlestick Patterns', topics: 7, minutes: 35, level: 'BEGINNER' },
      { id: '2.4', title: 'Trend Analysis', topics: 6, minutes: 25, level: 'BEGINNER' },
      { id: '2.5', title: 'Chart Patterns', topics: 6, minutes: 30, level: 'BEGINNER' },
      { id: '2.6', title: 'Technical Indicators', topics: 7, minutes: 35, level: 'BEGINNER' },
      { id: '2.7', title: 'Multi-Timeframe Analysis', topics: 5, minutes: 30, level: 'BEGINNER' },
    ],
    quiz: {
      title: 'PHASE II Quiz',
      questions: [
        {
          id: 1,
          question: "What does a 'doji' candlestick indicate?",
          options: ['Strong bullish momentum', 'Market indecision', 'Bearish reversal', 'Continuation pattern'],
          correct: 1,
        },
        {
          id: 2,
          question: "What is a 'double bottom' pattern?",
          options: ['Continuation pattern', 'Bearish reversal', 'Bullish reversal', 'Consolidation'],
          correct: 2,
        },
        {
          id: 3,
          question: 'Which indicator measures momentum?',
          options: ['Moving Average', 'Bollinger Bands', 'RSI', 'Fibonacci'],
          correct: 2,
        },
      ],
    },
  },
  {
    id: 3,
    num: 'III',
    title: 'PRICE ACTION',
    subtitle: 'Trading the Naked Chart',
    duration: '6-8 Weeks',
    level: 'INTERMEDIATE',
    totalMinutes: 195,
    color: '#2196f3',
    modules: [
      { id: '3.1', title: 'Market Structure & Order Flow', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '3.2', title: 'Supply & Demand Zones', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '3.3', title: 'Break of Structure (BOS)', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '3.4', title: 'Entry Techniques', topics: 6, minutes: 25, level: 'INTERMEDIATE' },
      { id: '3.5', title: 'Advanced Candlestick Reading', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '3.6', title: 'Building a Price Action Strategy', topics: 6, minutes: 35, level: 'INTERMEDIATE' },
    ],
    quiz: {
      title: 'PHASE III Quiz',
      questions: [
        {
          id: 1,
          question: "What does a 'Break of Structure' (BOS) indicate?",
          options: ['A pattern failure', 'Trend continuation', 'Market closure', 'Indicator divergence'],
          correct: 1,
        },
        {
          id: 2,
          question: "What is a 'fair value gap'?",
          options: ['Price gap between sessions', 'Imbalance in price delivery', 'Spread between bid/ask', 'Gap between indicators'],
          correct: 1,
        },
        {
          id: 3,
          question: 'Which is the best entry technique for price action?',
          options: ['Random entry', 'Confirmation at key level', 'Buying at resistance', 'Selling at support'],
          correct: 1,
        },
      ],
    },
  },
  {
    id: 4,
    num: 'IV',
    title: 'FUNDAMENTAL ANALYSIS',
    subtitle: 'The Economic Engine Behind Price',
    duration: '6-8 Weeks',
    level: 'INTERMEDIATE',
    totalMinutes: 0,
    color: '#2dd4bf',
    modules: [],
  },
  {
    id: 5,
    num: 'V',
    title: 'TRADING PSYCHOLOGY',
    subtitle: 'Master Your Mind, Master the Market',
    duration: '4-6 Weeks',
    level: 'INTERMEDIATE',
    totalMinutes: 0,
    color: '#f59e0b',
    modules: [],
  },
  {
    id: 6,
    num: 'VI',
    title: 'STRATEGY DEVELOPMENT',
    subtitle: 'Building Your Trading Edge',
    duration: '6-8 Weeks',
    level: 'ADVANCED',
    totalMinutes: 0,
    color: '#3b82f6',
    modules: [],
  },
  {
    id: 7,
    num: 'VII',
    title: 'ADVANCED CONCEPTS',
    subtitle: "The Professional's Toolkit",
    duration: '5-7 Weeks',
    level: 'ADVANCED',
    totalMinutes: 0,
    color: '#a855f7',
    modules: [],
  },
  {
    id: 8,
    num: 'VIII',
    title: 'PROFESSIONAL TRADING',
    subtitle: 'Trading as a Business',
    duration: 'Ongoing',
    level: 'ADVANCED',
    totalMinutes: 0,
    color: '#eab308',
    modules: [],
  },
];

export interface TopicBlock {
  type: 'definition' | 'keyConcept' | 'practiceTip' | 'comparison' | 'text' | 'timeline' | 'stats' | 'sessions' | 'hierarchy';
  content: string;
  comparisonData?: { left: { title: string; items: string[] }; right: { title: string; items: string[] } };
  timelineData?: { year: string; label: string; desc: string; icon: string }[];
  statsData?: { icon: string; value: string; label: string; sublabel: string }[];
  sessionsData?: { flag: string; city: string; hours: string }[];
  hierarchyData?: { icon: string; title: string; desc: string }[];
}

export interface TopicData {
  id: number;
  title: string;
  blocks: TopicBlock[];
}

export interface LessonData {
  topics: TopicData[];
  keyTakeaways: string[];
  studyNotes: string;
}

export const lessonContent: Record<string, LessonData> = {
  '1.1': {
    topics: [
      {
        id: 1,
        title: 'The forex market: what it is and how it works',
        blocks: [
          {
            type: 'text',
            content:
              'Currency exchange dates back thousands of years to ancient Mesopotamia, where money changers facilitated trade between different civilizations. The modern foreign exchange system, however, has its roots in the gold standard established in the 1870s. Under this system, countries pegged their currencies to a fixed amount of gold, creating stable exchange rates but limiting monetary policy flexibility.',
          },
          {
            type: 'text',
            content:
              'The gold standard collapsed during World War I as nations printed money to fund military operations. After World War II, the Bretton Woods Agreement (1944) established a new system where currencies were pegged to the US dollar, which itself was convertible to gold at $35 per ounce. This system created the International Monetary Fund (IMF) and World Bank.',
          },
          {
            type: 'keyConcept',
            content:
              'In 1971, President Nixon ended the dollar\'s convertibility to gold — an event known as the "Nixon Shock." This ushered in the era of floating exchange rates, where currency values are determined by supply and demand in the open market. This transition gave birth to the modern forex market as we know it today, creating opportunities for speculation and hedging that didn\'t exist under fixed-rate systems.',
          },
          {
            type: 'timeline',
            content: 'KEY HISTORICAL MILESTONES',
            timelineData: [
              { year: '1870s', label: 'Gold Standard', desc: 'Countries peg currencies to fixed gold amounts', icon: '🏅' },
              { year: '1914', label: 'WWI Collapse', desc: 'Nations abandon gold to fund war efforts', icon: '⚔️' },
              { year: '1944', label: 'Bretton Woods', desc: 'USD pegged to gold at $35/oz, other currencies to USD', icon: '🏛️' },
              { year: '1971', label: 'Nixon Shock', desc: 'End of gold convertibility, floating rates begin', icon: '💥' },
              { year: 'Today', label: 'Modern Forex', desc: '$7.5T daily volume, fully electronic trading', icon: '🌐' },
            ],
          },
        ],
      },
      {
        id: 2,
        title: 'How the global FX market operates 24/5',
        blocks: [
          {
            type: 'text',
            content:
              'The forex market operates 24 hours a day, five days a week, because it spans multiple time zones across the globe. Unlike stock exchanges with fixed opening and closing bells, forex trading begins when the Sydney market opens on Monday morning (Sunday evening in the US) and doesn\'t stop until New York closes on Friday afternoon.',
          },
          {
            type: 'text',
            content:
              'This continuous operation is possible because trading passes from one major financial center to the next as the Earth rotates. Sydney opens first, followed by Tokyo, then London, and finally New York. As one center winds down, the next picks up, creating an unbroken chain of liquidity.',
          },
          {
            type: 'keyConcept',
            content:
              'The market is "over-the-counter" (OTC), meaning there\'s no central exchange building. Instead, trading occurs electronically through a global network of banks, brokers, and financial institutions connected via the Electronic Broking Services (EBS) and Reuters platforms. This decentralized structure is what enables the 24-hour cycle — there\'s no single point that needs to "open" or "close."',
          },
          {
            type: 'sessions',
            content: 'GLOBAL TRADING SESSIONS',
            sessionsData: [
              { flag: '🇦🇺', city: 'Sydney', hours: '5PM–2AM EST' },
              { flag: '🇯🇵', city: 'Tokyo', hours: '7PM–4AM EST' },
              { flag: '🇬🇧', city: 'London', hours: '3AM–12PM EST' },
              { flag: '🇺🇸', city: 'New York', hours: '8AM–5PM EST' },
            ],
          },
        ],
      },
      {
        id: 3,
        title: 'Market participants: banks, institutions and retail traders',
        blocks: [
          {
            type: 'text',
            content:
              'The forex market has a clear hierarchy of participants. At the top sit the major global banks — JP Morgan, Deutsche Bank, Citigroup, UBS, and others — collectively known as the "interbank market." These banks trade directly with each other in massive volumes, often in lots of $10 million or more. They set the benchmark exchange rates that flow down to all other participants.',
          },
          {
            type: 'text',
            content:
              'Below the banks are institutional investors: hedge funds, pension funds, insurance companies, and multinational corporations. Hedge funds speculate on currency movements for profit, while corporations use forex to manage currency risk from international business operations. A US company paying European suppliers, for example, needs to convert dollars to euros.',
          },
          {
            type: 'keyConcept',
            content:
              'Central banks are unique participants who intervene in forex markets to implement monetary policy or stabilize their currency. The Bank of Japan, for instance, has historically intervened to weaken the yen when it strengthens too much against the dollar.',
          },
          {
            type: 'text',
            content:
              'Retail traders — individual traders like you — make up a small but growing segment, estimated at 5-6% of total market volume. Retail traders access the market through brokers who aggregate orders and connect to the interbank system.',
          },
          {
            type: 'hierarchy',
            content: 'MARKET PARTICIPANT HIERARCHY',
            hierarchyData: [
              { icon: '🏦', title: 'Central Banks', desc: 'Monetary policy & intervention' },
              { icon: '🏢', title: 'Major Banks', desc: 'Interbank market makers' },
              { icon: '📊', title: 'Institutional', desc: 'Hedge funds, pensions, corps' },
              { icon: '💻', title: 'Retail Brokers', desc: 'Aggregate client orders' },
              { icon: '👤', title: 'Retail Traders', desc: '5-6% of market volume' },
            ],
          },
        ],
      },
      {
        id: 4,
        title: 'The interbank market vs retail brokers',
        blocks: [
          {
            type: 'definition',
            content:
              'The interbank market is where the world\'s largest banks trade currencies directly with each other. This is the "wholesale" level of forex, with minimum transaction sizes typically starting at $1 million. Banks trade on ultra-tight spreads (sometimes less than 0.1 pips on major pairs) through platforms like EBS and Reuters Matching.',
          },
          {
            type: 'definition',
            content:
              'Retail brokers serve as intermediaries that give individual traders access to this market. They aggregate orders from thousands of clients and either pass them through to the interbank market (Straight-Through Processing or STP) or take the opposite side of the trade internally (Market Making). The broker adds a markup — the spread you see in your trading platform — which is wider than interbank rates but still far tighter than what was available before electronic trading.',
          },
          {
            type: 'comparison',
            content: 'BROKER MODELS',
            comparisonData: {
              left: {
                title: 'ECN / STP Broker',
                items: ['Direct market access', 'Variable spreads (tighter)', 'Commission-based pricing', 'No conflict of interest', 'Faster execution'],
              },
              right: {
                title: 'Market Maker',
                items: ['Internal order matching', 'Fixed spreads (wider)', 'Spread-based pricing', 'Potential conflict', 'Guaranteed fills'],
              },
            },
          },
          {
            type: 'practiceTip',
            content: 'Compare at least 3 regulated brokers on spreads, execution, and available pairs before committing to one platform.',
          },
        ],
      },
      {
        id: 5,
        title: 'Why forex is the largest market on Earth ($7.5T daily volume)',
        blocks: [
          {
            type: 'definition',
            content:
              'The Bank for International Settlements (BIS) Triennial Survey reported that daily forex turnover reached $7.5 trillion in 2022, making it by far the largest financial market in the world. To put this in perspective, the New York Stock Exchange trades roughly $25 billion per day — meaning forex dwarfs the world\'s largest stock exchange by a factor of 300.',
          },
          {
            type: 'text',
            content:
              'Several factors drive this enormous volume. First, every international business transaction requires currency conversion — when Toyota sells cars in America, dollars must eventually become yen. Global trade generates trillions in necessary currency exchanges annually. Second, investment flows between countries create constant demand — a US pension fund buying Japanese bonds needs to purchase yen.',
          },
          {
            type: 'text',
            content:
              'Third, central banks hold foreign currency reserves and periodically rebalance them. China alone holds over $3 trillion in foreign reserves. Fourth, speculative trading by banks, hedge funds, and retail traders adds significant volume as participants try to profit from exchange rate movements. Finally, hedging activity by multinational corporations protecting against adverse currency moves contributes substantially to daily volume.',
          },
          {
            type: 'keyConcept',
            content:
              'This massive liquidity is a major advantage for traders — it means you can enter and exit positions almost instantly in major pairs, with minimal slippage even during volatile markets.',
          },
          {
            type: 'stats',
            content: 'FOREX BY THE NUMBERS',
            statsData: [
              { icon: '📈', value: '$7.5T', label: 'Daily Volume', sublabel: 'BIS 2022 Survey' },
              { icon: '⚡', value: '300x', label: 'vs NYSE', sublabel: 'NYSE trades ~$25B/day' },
              { icon: '🌍', value: '170+', label: 'Currencies', sublabel: 'Traded worldwide' },
              { icon: '🕐', value: '24/5', label: 'Market Hours', sublabel: 'Sun 5pm–Fri 5pm EST' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Study where stop-loss clusters likely sit (above highs/below lows) and observe how price hunts those levels.',
          },
        ],
      },
      {
        id: 6,
        title: 'Centralized vs decentralized markets',
        blocks: [
          {
            type: 'text',
            content:
              'A centralized market, like the New York Stock Exchange (NYSE), operates through a single exchange where all buy and sell orders are routed. There\'s one official price at any given moment, a central order book showing all pending orders, and a regulatory body overseeing every transaction. This structure provides transparency and price consistency but creates a single point of failure and limits trading hours.',
          },
          {
            type: 'definition',
            content:
              'The forex market is decentralized (also called "over-the-counter" or OTC), meaning there\'s no single exchange, no central order book, and no universal price. Instead, prices are quoted by thousands of different participants — banks, brokers, and electronic platforms — simultaneously. Two banks in different cities might quote slightly different EUR/USD prices at the same millisecond.',
          },
          {
            type: 'keyConcept',
            content:
              'This decentralized structure has important implications for traders. On the positive side, it enables 24-hour trading, massive liquidity, and competitive pricing as participants compete for order flow. On the negative side, prices can vary between brokers (especially during volatile moments) and there\'s no central regulatory authority — regulation is country-by-country.',
          },
          {
            type: 'text',
            content:
              'As a retail trader, you should understand that your broker is your window into this decentralized network. The price you see is your broker\'s price, which may differ slightly from what another broker shows. This is normal and generally immaterial for most trading strategies.',
          },
          {
            type: 'comparison',
            content: 'CENTRALIZED vs DECENTRALIZED',
            comparisonData: {
              left: {
                title: 'Centralized (NYSE)',
                items: ['Single exchange location', 'Central order book', 'One official price', 'Fixed trading hours', 'Single regulator'],
              },
              right: {
                title: 'Decentralized (Forex)',
                items: ['Global network of dealers', 'No central order book', 'Prices vary by provider', '24-hour trading', 'Multi-jurisdiction'],
              },
            },
          },
        ],
      },
    ],
    keyTakeaways: [
      'Forex evolved from the gold standard (1870s) through Bretton Woods to today\'s $7.5T daily floating-rate market',
      'The market operates 24/5 as trading passes between Sydney, Tokyo, London, and New York sessions',
      'A hierarchy of participants — central banks → interbank → institutional → retail — determines price formation',
      'ECN/STP brokers offer direct market access; market makers internalize orders with fixed spreads',
      'High liquidity from global trade, investment flows, and speculation allows instant entry/exit with minimal slippage',
      'Decentralization means no single price — your broker\'s price may differ slightly from other providers',
    ],
    studyNotes:
      'This module covers the complete history and structure of the forex market across 6 topics (~20 min read). Focus on understanding WHY the market is decentralized and HOW that affects you as a retail trader. After reading, open your broker platform and observe the bid/ask spread on EUR/USD to see the broker markup in action.',
  },
};
