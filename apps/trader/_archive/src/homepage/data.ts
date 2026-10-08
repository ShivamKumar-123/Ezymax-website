import { CRM_LOGIN, CRM_REGISTER } from '@/lib/crm';
/**
 * Homepage content. Layout and copy follow the reference design 1:1;
 * only the brand name is ours. Links map onto the routes that already
 * exist in this app.
 */
export const BRAND = 'Ezymex';

export interface NavLink {
  label: string;
  href: string;
}
export interface NavItem {
  label: string;
  href: string;
  children?: NavLink[];
}

/** Menu exactly as in the reference: Home▾ About Services▾ Pages▾ Contact */
export const NAV: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    children: [
      { label: 'Home', href: '/' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Markets', href: '/markets' },
      { label: 'Download App', href: '/download' },
    ],
  },
  { label: 'About', href: '/company/about' },
  {
    label: 'Services',
    href: '/services/education',
    children: [
      { label: 'Education', href: '/services/education' },
      { label: 'Market Research', href: '/services/market-research' },
      { label: 'Portfolio Management', href: '/services/portfolio-management' },
      { label: 'ICO (Coming Soon)', href: '/services/ico-coming-soon' },
    ],
  },
  {
    label: 'Pages',
    href: '/account-types',
    children: [
      { label: 'Account Types', href: '/account-types' },
      { label: 'Web Platform', href: '/platforms/web' },
      { label: 'Copy Trading', href: '/platforms/copy-trading' },
      { label: 'Referral Program', href: '/products/referral' },
      { label: 'Academy', href: '/academy/blogs' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  { label: 'Contact', href: '/company/contact' },
];

export const LOGIN_HREF = CRM_LOGIN;
export const SIGNUP_HREF = CRM_REGISTER;

export const HERO = {
  title: ['Simplify your SaaS', 'solution with AI'],
  sub: 'Our AI SAAS tool is a cloud-based software delivery model. It helps businesses forecast demand for products and services and optimize inventory management and supply chain operations.',
  primary: 'Get started for free',
  secondary: 'Learn more',
};

export const TRUST_LINE = 'Companies of all sizes trust us to find AI SaaS critical to their growth and innovation';

export const LOGOS = ['Sitemark', 'Greenish', 'luminous', 'Network', 'umbrella'];

export const FEATURES_HEADING = ['Core features that', 'make it valuable'];

export const FEATURES = [
  { title: 'Resource Flexibility', text: 'This is an excellent option for people & small businesses who are starting out.' },
  { title: 'Managed Services', text: 'This is an excellent option for people & small businesses who are starting out.' },
  { title: 'Web-Based Access', text: 'This is an excellent option for people & small businesses who are starting out.' },
  { title: 'Resource Flexibility', text: 'This is an excellent option for people & small businesses who are starting out.' },
];

export const ACCESSIBLE = {
  heading: ['Accessible to a', 'wider audience'],
  paragraphs: [
    'Advanced AI capabilities accessible to a broader audience, including small & medium-sized businesses and individuals who may not have the resources or expertise to develop.',
    'Advanced AI capabilities accessible to a broader audience, including small & medium-sized businesses and individuals who may not have the resources or expertise to develop.',
  ],
};

export const QUICK_DEPLOY = {
  heading: ['Providing quick', 'deploy solutions'],
  text: 'Our AI SaaS solutions can be quickly deployed, enabling users to start benefiting from AI capabilities without lengthy setup and development times in fast-paced industries.',
  bullets: [
    'Ready-to-use AI capabilities system',
    'Users can quickly integrate AI features',
    'Time savings translate to cost savings',
  ],
};

export const AI_POWERED = {
  heading: ['AI-powered that', 'streamline tasks'],
  text: 'As your business grows or your AI SaaS needs change, you can easily adjust your subscription level to match those needs. This flexibility ensures that AI remains an asset.',
  stats: [
    { value: '92%', label: 'Customer service inquiries' },
    { value: '75%', label: 'Using financial institutions' },
  ],
};

export const PRICING_HEADING = ['Cost-effectively', 'build any software'];

export const PLANS = [
  { name: 'Beginner', seats: 'Up to 10 members', price: '$25', text: 'This is an excellent option for people & small businesses who are starting out.' },
  { name: 'Starter', seats: 'Up to 50 members', price: '$89', text: 'This plan is suitable for e-commerce stores as well as professional blogs.' },
  { name: 'Pro', seats: 'Up to 100 members', price: '$199', text: 'Ideal for handling complicated projects enterprise-level projects, and websites.' },
];

export const TESTIMONIALS_HEADING = ['Positive feedback', 'from our users'];

export const TESTIMONIALS = [
  { quote: 'This AI SaaS tool has revolutionized the way we process and analyze data. This is a game-changer for our business.', name: 'Max Weber', role: 'HR Manager' },
  { quote: 'It answers immediately, and we’ve seen a significant reduction in response time. Our customers love it and so do we!', name: 'Douglas Smith', role: 'Businessman' },
  { quote: 'It is accurate, fast and supports multiple languages support. It is a must for any international business success.', name: 'Abraham Maslo', role: 'Founder @ Marketing Company' },
  { quote: 'Security is a top concern for us, and AI SaaS takes it seriously. It’s a reassuring layer of protection for our organization.', name: 'Jack Fayol', role: 'HR Manager' },
  { quote: 'We were concerned about integrating their APIs were well documented, and their support team was super cool.', name: 'Karen Lynn', role: 'Software Engineer' },
  { quote: 'The return on investment has exceeded our expectations. It’s an investment in the future of our business.', name: 'Henry Ochi', role: 'Bank Manager' },
];

export const MARQUEE_TEXT = 'Start building software';

export const FOOTER = {
  mission:
    'Our mission is to harness the power of AI to solve complex business challenges & and enhance user experiences across digital platforms.',
  website: 'www.example.com',
  primary: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/company/about' },
    { label: 'Services', href: '/services/education' },
    { label: 'Pricing', href: '/account-types' },
    { label: 'Contact', href: '/company/contact' },
  ],
  utility: [
    { label: 'Signup', href: '/auth/register' },
    { label: 'Login', href: '/auth/login' },
    { label: '404 Not Found', href: '/404' },
    { label: 'Password Reset', href: '/auth/reset-password' },
  ],
};
