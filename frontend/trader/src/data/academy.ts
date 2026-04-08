export const phases = [
  {
    id: 1,
    num: 'I',
    title: 'FOUNDATIONS',
    subtitle: 'The Bedrock of Forex',
    duration: '8-8 Weeks',
    level: 'BEGINNER',
    totalMinutes: 170,
    color: '#00e676',
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
    color: '#00e676',
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
    color: '#00e676',
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
  type: 'definition' | 'keyConcept' | 'practiceTip' | 'comparison' | 'text';
  content: string;
  comparisonData?: { left: { title: string; items: string[] }; right: { title: string; items: string[] } };
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
            type: 'definition',
            content:
              'The foreign exchange market (forex or FX) is a global decentralized marketplace where currencies are traded. It is the largest and most liquid financial market in the world, with a daily trading volume exceeding $7.5 trillion.',
          },
          {
            type: 'text',
            content:
              'Unlike stock markets that have central exchanges, forex operates 24 hours a day, 5 days a week across major financial centers worldwide — from Sydney to Tokyo to London to New York.',
          },
          {
            type: 'keyConcept',
            content:
              'The forex market never sleeps during the business week. When one major market closes, another opens, creating a continuous flow of trading activity across the globe.',
          },
        ],
      },
      {
        id: 2,
        title: 'Major currency pairs and their characteristics',
        blocks: [
          {
            type: 'definition',
            content:
              'Major currency pairs include EUR/USD, GBP/USD, USD/JPY, and USD/CHF. These pairs have the highest trading volumes and tightest spreads.',
          },
          {
            type: 'text',
            content:
              'The EUR/USD alone accounts for roughly 28% of daily forex volume. Major pairs always include the US dollar on one side.',
          },
          {
            type: 'practiceTip',
            content:
              'Start by focusing on 2-3 major pairs. Understanding their behavior deeply is more valuable than spreading attention across dozens of instruments.',
          },
        ],
      },
      {
        id: 3,
        title: 'Market participants: banks, institutions, retail traders',
        blocks: [
          {
            type: 'definition',
            content:
              "The forex market has a clear hierarchy of participants. At the top sit the major global banks — JP Morgan, Deutsche Bank, Citigroup, UBS, and others — collectively known as the 'interbank market.' These banks trade directly with each other in massive volumes, often in lots of $10 million or more.",
          },
          {
            type: 'text',
            content:
              'Below the banks are institutional investors: hedge funds, pension funds, insurance companies, and multinational corporations. Hedge funds speculate on currency movements for profit, while corporations use forex to manage currency risk from international business operations.',
          },
          {
            type: 'text',
            content:
              'Central banks are unique participants who intervene in forex to implement monetary policy or stabilize their currency. The Bank of Japan, for instance, has historically intervened to weaken the yen when it strengthens too much against the dollar.',
          },
          {
            type: 'text',
            content:
              'Retail traders — individual traders like you — make up a small but growing segment, estimated at 5-6% of total market volume. Retail traders access the market through brokers who aggregate orders and connect to the interbank system.',
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
              "The interbank market is where the world's largest banks trade currencies directly with each other. This is the 'wholesale' level of forex, with minimum transaction sizes typically starting at $1 million.",
          },
          {
            type: 'definition',
            content:
              'Retail brokers serve as intermediaries that give individual traders access to this market. They aggregate orders from thousands of clients and either pass them through to the interbank market (Straight-Through Processing or STP) or take the opposite side of the trade internally (Market Making).',
          },
          {
            type: 'keyConcept',
            content:
              "Understanding this distinction matters because your broker's model affects your trading costs, execution speed, and potential conflicts of interest. An ECN broker connects you more directly to the interbank market with variable spreads, while a market maker provides fixed spreads but may trade against your positions internally.",
          },
          {
            type: 'comparison',
            content: 'BROKER MODELS',
            comparisonData: {
              left: {
                title: 'ECN / STP Broker',
                items: [
                  'Direct market access',
                  'Variable spreads (tighter)',
                  'Commission-based pricing',
                  'No conflict of interest',
                  'Faster execution',
                ],
              },
              right: {
                title: 'Market Maker',
                items: [
                  'Internal order matching',
                  'Fixed spreads (wider)',
                  'Spread-based pricing',
                  'Potential conflict',
                  'Guaranteed fills',
                ],
              },
            },
          },
          {
            type: 'practiceTip',
            content: 'Compare at least 3 regulated brokers on spreads, execution, and available pairs before committing.',
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
              "The forex market's massive size is driven by global trade, investment flows, central bank interventions, and speculative trading.",
          },
          {
            type: 'keyConcept',
            content:
              'High liquidity means tighter spreads and more efficient price discovery. As a retail trader, this benefits you through lower transaction costs and the ability to enter/exit positions with minimal slippage.',
          },
        ],
      },
      {
        id: 6,
        title: 'Centralized vs decentralized markets',
        blocks: [
          {
            type: 'definition',
            content:
              'Unlike stock exchanges which operate from a central location, the forex market is completely decentralized. Trading occurs electronically over-the-counter (OTC) through a network of banks, brokers, and institutions across the globe.',
          },
          {
            type: 'keyConcept',
            content:
              "Decentralization means there is no single 'forex price' — prices can vary slightly between providers. This is why choosing a reputable, well-connected broker matters.",
          },
          {
            type: 'practiceTip',
            content:
              'Always verify your broker is regulated by a reputable authority (FCA, ASIC, CySEC) to ensure fair pricing and fund protection.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Forex is the largest financial market with $7.5T daily volume',
      'The market operates 24/5 across global time zones',
      'Retail traders access the market through brokers connected to the interbank system',
      'Understanding broker models (ECN vs Market Maker) helps you minimize costs',
    ],
    studyNotes:
      'This module contains 6 core topics with an estimated reading time of 25 minutes. Dedicate focused study sessions to each concept before moving forward. Comprehension without application is theory — always test each concept on a demo account.',
  },
};
