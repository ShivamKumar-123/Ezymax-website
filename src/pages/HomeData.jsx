import {
  Zap, Shield, Globe, Cpu, Target, Droplet, Activity,
  DollarSign, Layers, Monitor, Smartphone, Server,
  TrendingUp, Heart, BarChart3, Gem, LineChart, Bitcoin,
  Newspaper, FileText, Radio, BrainCircuit, Calendar,
  Calculator, HardDrive, BookOpen, CandlestickChart,
  Crosshair, Video, Mic, Library, Landmark, CreditCard,
  Wallet, CircleDollarSign, QrCode, Moon,
  Award, BarChart2
} from 'lucide-react'

export const whyFeatures = [
  { icon: <Droplet size={20} />, title: 'Institutional-Grade Liquidity', desc: 'We connect traders to deep liquidity pools sourced from premium financial institutions, ensuring minimal slippage and competitive pricing.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <Zap size={20} />, title: 'Ultra-Fast Execution', desc: 'Our advanced matching engines are optimized for millisecond execution speeds, making it ideal for scalpers, day traders, and algorithmic strategies.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <Target size={20} />, title: 'Transparent Pricing', desc: 'We operate with a fair and transparent pricing model. No hidden fees, no manipulation — just clean execution.', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <Globe size={20} />, title: 'Multi-Asset Access', desc: 'Trade multiple asset classes from one account with seamless platform integration across forex, indices, commodities, stocks, and crypto.', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <Cpu size={20} />, title: 'Advanced Technology', desc: 'Our platform integrates professional charting tools, customizable indicators, real-time market data, and AI-powered insights.', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
]

export const marketAssets = [
  { label: 'Forex', icon: <DollarSign size={24} />, desc: 'Trade over 60+ currency pairs including major, minor, and exotic pairs with competitive spreads and flexible leverage options.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { label: 'Indices', icon: <BarChart3 size={24} />, desc: 'Access global stock indices from the US, Europe, and Asia, allowing you to trade entire economies in one position.', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { label: 'Commodities', icon: <Gem size={24} />, desc: 'Diversify with precious metals like Gold and Silver, as well as energy products including Crude Oil and Natural Gas.', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { label: 'Stocks', icon: <LineChart size={24} />, desc: 'Trade shares of leading global companies with real-time pricing and margin flexibility.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { label: 'Cryptocurrencies', icon: <Bitcoin size={24} />, desc: 'Access major digital assets with secure execution and competitive trading conditions.', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
]

export const platforms = [
  { icon: <Monitor size={22} />, name: 'WebTrader', tag: 'Browser-Based', desc: 'A browser-based trading platform that requires no downloads. Access markets instantly from any device with full charting functionality and advanced order types.', color: 'text-primary-accent', bg: 'bg-primary-accent/10', border: 'border-primary-accent/20' },
  { icon: <Smartphone size={22} />, name: 'Mobile Trading App', tag: 'iOS & Android', desc: 'Trade on the go with full account management, price alerts, real-time data, and intuitive navigation.', color: 'text-primary-purple', bg: 'bg-primary-purple/10', border: 'border-primary-purple/20' },
  { icon: <Server size={22} />, name: 'Desktop Terminal', tag: 'Professional Grade', desc: 'Professional-grade platform designed for advanced traders requiring algorithmic trading, API integration, and enhanced customization.', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
]

export const platformFeatures = [
  '100+ Technical Indicators', 'Multi-Chart Layout', 'One-Click Trading',
  'Automated Trading Support', 'Economic Calendar Integration', 'Risk Management Tools',
]

export const accounts = [
  { name: 'Standard', badge: 'Beginner', badgeColor: 'bg-blue-500/20 text-blue-400', minDeposit: '$100', spreads: 'From 1.5 pips', commission: 'Zero commission', desc: 'Designed for new traders entering the financial markets. Competitive spreads and a simple pricing model ideal for beginners and swing traders.', features: ['Competitive spreads', 'Zero commission', 'Full platform access', '24/5 support'], cta: 'Open Standard', highlight: false },
  { name: 'ECN Raw', badge: 'Popular', badgeColor: 'bg-primary-accent/20 text-primary-accent', minDeposit: '$500', spreads: 'From 0.0 pips', commission: 'Fixed low commission', desc: 'Built for traders who demand tight spreads and institutional pricing. Connects directly to liquidity providers with minimal markups.', features: ['Raw spreads from 0.0', 'Ultra-low commission', 'Scalping allowed', 'Priority execution'], cta: 'Open ECN Raw', highlight: true },
  { name: 'Pro', badge: 'Advanced', badgeColor: 'bg-primary-purple/20 text-primary-purple', minDeposit: '$5,000', spreads: 'Ultra-tight', commission: 'Reduced', desc: 'Tailored for experienced traders seeking enhanced trading conditions. Includes advanced analytics tools and premium support access.', features: ['Tightest spreads', 'Priority execution', 'Advanced analytics', 'Dedicated support'], cta: 'Open Pro', highlight: false },
  { name: 'VIP', badge: 'Exclusive', badgeColor: 'bg-violet-500/20 text-violet-400', minDeposit: 'Custom', spreads: 'Custom pricing', commission: 'Negotiable', desc: 'Institutional-level account for high-volume traders. Personalized trading experience with enhanced support and execution priority.', features: ['Personal manager', 'Exclusive pricing', 'Institutional liquidity', 'Custom solutions'], cta: 'Contact Us', highlight: false },
]

export const tradingConditions = [
  { icon: <Activity size={20} />, title: 'No Dealing Desk (NDD)', desc: 'Orders are routed directly to liquidity providers without manual intervention, ensuring transparent and conflict-free trading.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <DollarSign size={20} />, title: 'Spreads & Commissions', desc: 'We offer both spread-only accounts and raw spread accounts with commission structures. Competitive pricing across all instruments.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <Layers size={20} />, title: 'Flexible Leverage', desc: 'Flexible leverage options available depending on account type and regulatory jurisdiction. Traders are encouraged to manage risk responsibly.', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <Shield size={20} />, title: 'Risk Management', desc: 'Stop Loss & Take Profit, Trailing Stop, Negative Balance Protection, and Margin Call Alerts built into every account.', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
]

export const toolsResearch = [
  { icon: <Newspaper size={20} />, label: 'Daily Market Analysis', desc: 'Expert daily insights on global markets', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <FileText size={20} />, label: 'Technical & Fundamental Reports', desc: 'In-depth research reports', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <Radio size={20} />, label: 'Trading Signals', desc: 'Real-time actionable trade signals', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <BrainCircuit size={20} />, label: 'AI-Powered Market Insights', desc: 'Machine learning driven analysis', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <Calendar size={20} />, label: 'Economic Calendar', desc: 'Track key market-moving events', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <Calculator size={20} />, label: 'Risk & Position Size Calculator', desc: 'Manage risk with precision', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <HardDrive size={20} />, label: 'VPS Hosting', desc: 'Ultra-low latency for algo trading', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
]

export const educationItems = [
  { icon: <BookOpen size={20} />, label: 'Beginner Guides', desc: 'Start your trading journey with confidence', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <CandlestickChart size={20} />, label: 'Forex Basics', desc: 'Master the fundamentals of forex trading', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <Crosshair size={20} />, label: 'Advanced Trading Strategies', desc: 'Refine your edge with proven strategies', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <Video size={20} />, label: 'Video Tutorials', desc: 'Learn visually at your own pace', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { icon: <Mic size={20} />, label: 'Weekly Live Webinars', desc: 'Interactive sessions with expert traders', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <Library size={20} />, label: 'E-books & Trading Manuals', desc: 'Comprehensive reference materials', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
]

export const paymentMethods = [
  { name: 'Bank Transfer', icon: <Landmark size={24} />, color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { name: 'Credit / Debit Cards', icon: <CreditCard size={24} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'Skrill', icon: <Wallet size={24} />, color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { name: 'Neteller', icon: <CircleDollarSign size={24} />, color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
  { name: 'Crypto Payments', icon: <Bitcoin size={24} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'UPI / Local Transfer', icon: <QrCode size={24} />, color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
]

export const stats = [
  { value: 99.9, suffix: '%', label: 'Server Uptime', decimals: 1 },
  { value: 60, suffix: '+', label: 'Trading Instruments', decimals: 0 },
  { value: 24, suffix: '/5', label: 'Customer Support', decimals: 0 },
  { value: 0.0, suffix: ' pips', label: 'Spreads From', decimals: 1 },
]

export const testimonials = [
  { quote: "TrustEdgeFX provides one of the fastest executions I've experienced. The platform is clean and the spreads are consistently tight.", author: 'Michael R.', role: 'Professional Forex Trader', rating: 5 },
  { quote: "Clean platform, tight spreads, and reliable support. I've been trading with TrustEdgeFX for over a year and the experience has been excellent.", author: 'Sarah K.', role: 'Active Forex Trader', rating: 5 },
  { quote: "The ECN Raw account is perfect for my scalping strategy. Zero requotes and lightning-fast execution every time.", author: 'David L.', role: 'Scalp Trader', rating: 5 },
]

export const faqs = [
  { q: 'How do I open a trading account?', a: 'Opening an account is simple. Click "Open Account", complete the registration form, verify your identity, and fund your account. The entire process takes less than 10 minutes.' },
  { q: 'What is the minimum deposit?', a: 'The minimum deposit for a Standard account is $100. ECN Raw accounts require $500, and Pro accounts require $5,000. VIP accounts have custom requirements.' },
  { q: 'Are client funds segregated?', a: 'Yes. All client funds are held in segregated accounts with top-tier banks, completely separate from company operational funds.' },
  { q: 'What trading platforms are available?', a: 'We offer WebTrader (browser-based), a Mobile App (iOS & Android), and a Desktop Terminal for professional traders.' },
  { q: 'Do you offer a demo account?', a: 'Yes, we offer a free demo account with virtual funds so you can practice trading without any risk.' },
]
