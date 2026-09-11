export type Lang = 'fr' | 'en' | 'ja' | 'zh'

export const LANG_STORAGE_KEY = 'swisscresta-lang'

/** Menu order + display metadata for the language picker. */
export const LANGS: { code: Lang; label: string; nativeName: string }[] = [
  { code: 'en', label: 'EN', nativeName: 'English' },
  { code: 'fr', label: 'FR', nativeName: 'Français' },
  { code: 'ja', label: 'JA', nativeName: '日本語' },
  { code: 'zh', label: 'ZH', nativeName: '中文' },
]

type DictNode = string | { [key: string]: DictNode }

interface Dict {
  fr: Record<string, DictNode>
  en: Record<string, DictNode>
  ja: Record<string, DictNode>
  zh: Record<string, DictNode>
}

/**
 * Marketing copy, one block per language.
 *
 * These briefly all pointed at the English block. The site had been ported
 * from a template whose French, Japanese and Chinese blocks were translations
 * of BROKER marketing — "Swiss bank, publicly listed", "backed by Swiss
 * regulation" — none of it true of SetupFX. Correcting only English would
 * have left those claims standing in three languages, so every code was
 * aliased to English as a stop-gap. The side effect was that the language
 * picker changed state but never changed a word, which reads as broken.
 * These are the real translations.
 */

const en: Record<string, DictNode> = {
  capabilityNote: {
    lead: 'These are platform capabilities, not services we run.',
    body: 'Every feature listed here is something we build into your platform and hand over with it. SetupFX does not operate a brokerage, hold client funds, route client orders or execute trades — your own licensed entity does, under your brand.',
  },
  nav: {
    markets: 'Solutions',
    platforms: 'Platforms',
    partners: 'White Label',
    policy: 'Support',
    about: 'About',
    contact: 'Contact',
    login: 'Client Login',
    signup: 'Book a Demo',
    lang: 'EN',
  },
  hero: {
    eyebrow: 'Software Development Company',
    headlineA: 'Trading platforms',
    headlineB: 'built for brokers',
    headlineC: 'and prop firms.',
    sub: 'We build the technology behind trading businesses — platforms, back offices and risk engines, branded as yours and supported long after launch.',
    ctaOpen: 'Book a free demo',
    ctaDemo: 'View platforms',
  },
  bank: {
    titleA: 'Your brand,',
    titleB: 'our engine.',
    lead: 'You bring the licence, the clients and the brand. We bring the terminal, the back office and the risk engine — delivered under your identity, on your domain, with your colours.',
    sub: 'Every platform ships with the pieces a trading business actually runs on: liquidity routing, managed-account structures and copy trading, all administered from one back office.',
    eyebrow: 'What ships with it',
    cards: {
      metals: { title: 'Liquidity Bridge', body: 'Route order flow to your own liquidity providers, or run it internally.' },
      currency: { title: 'MAM / PAMM', body: 'Managed accounts with unit-based accounting and high-water-mark fees.' },
      cfds: { title: 'Copy Trading', body: 'Followers mirror a master account, with performance fees handled for you.' },
    },
    explore: 'Explore',
  },
  platforms: {
    eyebrow: 'Our platforms',
    titleA: 'Three platforms.',
    titleB: 'One engineering team.',
    lead1: 'Built in-house, deployed white-label worldwide, and typically live in',
    lead2: 'weeks',
    pick: 'Choose your platform',
    explore: 'Explore',
  },
  pricing: {
    from: 'Delivery from',
    pips: 'weeks',
    eyebrow: 'Services',
    titleA: 'What we',
    titleB: 'do best',
    lead: 'Three things, done properly. We build the platform, brand it as yours, connect it to everything it needs, and keep it running after launch.',
    sub: 'No template resold as bespoke. The stack is ours, so what you ask for is what gets built.',
    cards: {
      c1: { t: 'Trading Platform Development', b: 'Complete terminals, back office and risk systems.' },
      c2: { t: 'White Label Solution', b: 'Fully branded platforms delivered under your identity.' },
      c3: { t: 'Integration Services', b: 'Payments, KYC, liquidity, CRM and third-party APIs.' },
    },
    explore: 'Explore',
  },
  securities: {
    eyebrow: 'After launch',
    titleA: 'We do not disappear',
    titleB: 'at go-live',
    lead: 'Monitoring, updates and enhancement cycles once you are trading. The team that wrote the code is the team that answers when something needs attention.',
    regulated: '',
    explore: 'Explore',
  },
  crypto: {
    eyebrow: 'AI & Algorithmic Trading',
    titleA: 'Strategies your',
    titleB: 'clients can build.',
    lead: 'An AI strategy builder, backtesting and live algorithmic execution — shipped inside your platform, under your brand, so your traders automate without leaving it.',
    regulated: '',
    explore: 'Explore',
  },
  steps: {
    titleA: 'From first call to',
    titleB: 'live platform',
    cta: 'Book a free demo',
    s1: { t: 'Tell us what you are building', d: 'A short call to map your markets, your instruments and how you want flow handled. No obligation.', tag: 'Discovery' },
    s2: { t: 'We build and brand it', d: 'Your platform, your identity, your domain — with the integrations your business depends on wired in.', tag: 'Build & brand' },
    s3: { t: 'Go live, and keep going', d: 'Deployment, handover and the monitoring and enhancement cycles that follow.', tag: 'Launch & support' },
  },
  about: {
    eyebrow: 'Who we are',
    titleA: 'An in-house team.',
    titleB: 'Not a reseller.',
    lead: 'We write the engine we sell. That is why a change you ask for is a change we can make — rather than a feature request filed with somebody else’s vendor.',
    learnMore: 'Learn more',
  },
  follow: {
    title: 'Find us online',
  },
  footerLinks: {
    eyebrow: 'Get in touch',
    lead: 'Tell us what you are building. We reply within one business day.',
    cols: {
      client: { h: 'Platforms', l1: 'Global Trading Platform', l2: 'AI Trading Platform' },
      partner: { h: 'Services', l1: 'White Label Solution' },
      help: { h: 'Company', l1: 'About Us', l2: 'Contact' },
    },
  },
  disclaimer: {
    title: 'Disclaimer',
    p1: 'SetupFX is a software development company. We build and license trading technology — platforms, back offices, risk engines and related integrations — to licensed brokerages, proprietary trading firms and other regulated operators.',
    p2: 'We are not a broker, exchange or financial institution. We do not provide financial, investment, tax or advisory services, we do not solicit or accept investments, and we make no representation about the returns any trading activity may produce. Any platform operated by one of our clients is operated by that client, under their own licence and their own regulatory obligations — not ours.',
    p3: 'Trading leveraged products carries a significant risk of loss and is not suitable for everyone. Nothing on this site is an offer, solicitation or recommendation to trade. If you are evaluating a trading business, take independent legal and regulatory advice for your jurisdiction.',
    p4: '',
    hq: 'Contact:',
    hqAddr: 'setupfx24.com',
    copyright: '© 2026 SetupFX. All rights reserved.',
    links: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      risk: 'Disclaimer',
      vuln: 'Vulnerability Disclosure',
    },
  },
}

const fr: Record<string, DictNode> = {
  capabilityNote: {
    lead: 'Ce sont des fonctionnalités de la plateforme, pas des services que nous exploitons.',
    body: 'Chaque fonctionnalité listée ici est intégrée à votre plateforme et vous est livrée avec elle. SetupFX n’exploite aucun courtier, ne détient aucun fonds client, ne route aucun ordre et n’exécute aucune transaction — c’est votre propre entité agréée qui le fait, sous votre marque.',
  },
  nav: {
    markets: 'Solutions',
    platforms: 'Plateformes',
    partners: 'Marque blanche',
    policy: 'Support',
    about: 'À propos',
    contact: 'Contact',
    login: 'Espace client',
    signup: 'Demander une démo',
    lang: 'FR',
  },
  hero: {
    eyebrow: 'Société de développement logiciel',
    headlineA: 'Des plateformes de trading',
    headlineB: 'conçues pour les courtiers',
    headlineC: 'et les prop firms.',
    sub: 'Nous construisons la technologie qui fait tourner les sociétés de trading — plateformes, back-offices et moteurs de risque, à votre marque et accompagnés bien après la mise en ligne.',
    ctaOpen: 'Demander une démo gratuite',
    ctaDemo: 'Voir les plateformes',
  },
  bank: {
    titleA: 'Votre marque,',
    titleB: 'notre moteur.',
    lead: 'Vous apportez la licence, les clients et la marque. Nous apportons le terminal, le back-office et le moteur de risque — livrés sous votre identité, sur votre domaine, à vos couleurs.',
    sub: 'Chaque plateforme est livrée avec ce dont une société de trading a réellement besoin : routage de liquidité, comptes gérés et copy trading, le tout administré depuis un seul back-office.',
    eyebrow: 'Ce qui est inclus',
    cards: {
      metals: { title: 'Pont de liquidité', body: 'Routez le flux d’ordres vers vos propres fournisseurs de liquidité, ou traitez-le en interne.' },
      currency: { title: 'MAM / PAMM', body: 'Comptes gérés avec comptabilité en parts et commissions à high-water mark.' },
      cfds: { title: 'Copy trading', body: 'Les suiveurs répliquent un compte maître, les commissions de performance sont gérées pour vous.' },
    },
    explore: 'Découvrir',
  },
  platforms: {
    eyebrow: 'Nos plateformes',
    titleA: 'Trois plateformes.',
    titleB: 'Une seule équipe technique.',
    lead1: 'Développées en interne, déployées en marque blanche dans le monde entier, et en ligne en général en',
    lead2: 'quelques semaines',
    pick: 'Choisissez votre plateforme',
    explore: 'Découvrir',
  },
  pricing: {
    from: 'Livraison en',
    pips: 'semaines',
    eyebrow: 'Services',
    titleA: 'Ce que nous',
    titleB: 'faisons le mieux',
    lead: 'Trois choses, faites correctement. Nous construisons la plateforme, l’habillons à votre marque, la connectons à tout ce dont elle a besoin, et la maintenons après le lancement.',
    sub: 'Aucun template revendu comme du sur-mesure. La technologie est la nôtre : ce que vous demandez est ce qui est construit.',
    cards: {
      c1: { t: 'Développement de plateformes', b: 'Terminaux complets, back-office et systèmes de risque.' },
      c2: { t: 'Solution en marque blanche', b: 'Plateformes entièrement personnalisées, livrées sous votre identité.' },
      c3: { t: 'Services d’intégration', b: 'Paiements, KYC, liquidité, CRM et API tierces.' },
    },
    explore: 'Découvrir',
  },
  securities: {
    eyebrow: 'Après le lancement',
    titleA: 'Nous ne disparaissons pas',
    titleB: 'le jour de la mise en ligne',
    lead: 'Supervision, mises à jour et cycles d’amélioration une fois en production. L’équipe qui a écrit le code est celle qui répond quand quelque chose demande attention.',
    regulated: '',
    explore: 'Découvrir',
  },
  crypto: {
    eyebrow: 'IA et trading algorithmique',
    titleA: 'Des stratégies que vos',
    titleB: 'clients peuvent créer.',
    lead: 'Un créateur de stratégies IA, du backtesting et de l’exécution algorithmique en direct — intégrés à votre plateforme, sous votre marque, pour que vos traders automatisent sans la quitter.',
    regulated: '',
    explore: 'Découvrir',
  },
  steps: {
    titleA: 'Du premier appel à',
    titleB: 'la plateforme en ligne',
    cta: 'Demander une démo gratuite',
    s1: { t: 'Dites-nous ce que vous construisez', d: 'Un court échange pour cartographier vos marchés, vos instruments et la gestion du flux. Sans engagement.', tag: 'Cadrage' },
    s2: { t: 'Nous construisons et habillons', d: 'Votre plateforme, votre identité, votre domaine — avec les intégrations dont votre activité dépend.', tag: 'Développement' },
    s3: { t: 'Mise en ligne, et ensuite', d: 'Déploiement, transfert de compétences, puis supervision et cycles d’amélioration.', tag: 'Lancement et support' },
  },
  about: {
    eyebrow: 'Qui nous sommes',
    titleA: 'Une équipe interne.',
    titleB: 'Pas un revendeur.',
    lead: 'Nous écrivons le moteur que nous vendons. C’est pourquoi une modification que vous demandez est une modification que nous pouvons faire — plutôt qu’une demande déposée chez le fournisseur d’un autre.',
    learnMore: 'En savoir plus',
  },
  follow: {
    title: 'Nous suivre',
  },
  footerLinks: {
    eyebrow: 'Nous contacter',
    lead: 'Dites-nous ce que vous construisez. Nous répondons sous un jour ouvré.',
    cols: {
      client: { h: 'Plateformes', l1: 'Global Trading Platform', l2: 'AI Trading Platform' },
      partner: { h: 'Services', l1: 'Solution en marque blanche' },
      help: { h: 'Société', l1: 'À propos', l2: 'Contact' },
    },
  },
  disclaimer: {
    title: 'Avertissement',
    p1: 'SetupFX est une société de développement logiciel. Nous concevons et cédons sous licence des technologies de trading — plateformes, back-offices, moteurs de risque et intégrations associées — à des courtiers agréés, des sociétés de trading pour compte propre et d’autres opérateurs régulés.',
    p2: 'Nous ne sommes ni un courtier, ni une bourse, ni un établissement financier. Nous ne fournissons aucun service financier, d’investissement, fiscal ou de conseil, nous ne sollicitons ni n’acceptons d’investissements, et nous ne formulons aucune promesse quant aux résultats d’une activité de trading. Toute plateforme exploitée par l’un de nos clients l’est par ce client, sous sa propre licence et ses propres obligations réglementaires — pas les nôtres.',
    p3: 'Le trading de produits à effet de levier comporte un risque de perte important et ne convient pas à tout le monde. Rien sur ce site ne constitue une offre, une sollicitation ou une recommandation de trader. Si vous évaluez un projet de société de trading, consultez un conseil juridique et réglementaire indépendant dans votre juridiction.',
    p4: '',
    hq: 'Contact :',
    hqAddr: 'setupfx24.com',
    copyright: '© 2026 SetupFX. Tous droits réservés.',
    links: {
      privacy: 'Politique de confidentialité',
      terms: 'Conditions d’utilisation',
      risk: 'Avertissement',
      vuln: 'Divulgation de vulnérabilité',
    },
  },
}

const ja: Record<string, DictNode> = {
  capabilityNote: {
    lead: 'これらはプラットフォームの機能であり、当社が運営するサービスではありません。',
    body: 'ここに挙げた機能はすべて、御社のプラットフォームに組み込んでお渡しするものです。SetupFX はブローカー業務を行わず、顧客資金の預託、注文のルーティング、取引の執行のいずれも行いません。それらを行うのは、御社のブランドのもとで免許を持つ御社の事業体です。',
  },
  nav: {
    markets: 'ソリューション',
    platforms: 'プラットフォーム',
    partners: 'ホワイトラベル',
    policy: 'サポート',
    about: '会社概要',
    contact: 'お問い合わせ',
    login: 'クライアントログイン',
    signup: 'デモを予約',
    lang: 'JA',
  },
  hero: {
    eyebrow: 'ソフトウェア開発会社',
    headlineA: 'ブローカーと',
    headlineB: 'プロップファームのための',
    headlineC: 'トレーディングプラットフォーム。',
    sub: '取引ビジネスを支える技術を開発しています。プラットフォーム、バックオフィス、リスクエンジンを御社のブランドで提供し、リリース後も長くサポートします。',
    ctaOpen: '無料デモを予約',
    ctaDemo: 'プラットフォームを見る',
  },
  bank: {
    titleA: '御社のブランド、',
    titleB: '当社のエンジン。',
    lead: 'ライセンス、顧客、ブランドは御社が。ターミナル、バックオフィス、リスクエンジンは当社が。御社の名義・ドメイン・カラーで提供します。',
    sub: 'どのプラットフォームにも、取引ビジネスの運営に実際に必要な機能が揃っています。流動性ルーティング、運用口座の仕組み、コピートレード — すべて一つのバックオフィスから管理できます。',
    eyebrow: '標準搭載',
    cards: {
      metals: { title: '流動性ブリッジ', body: '注文フローを自社の流動性プロバイダーへ振り分けるか、社内で処理します。' },
      currency: { title: 'MAM / PAMM', body: '口数ベースの会計とハイウォーターマーク方式の報酬に対応した運用口座。' },
      cfds: { title: 'コピートレード', body: 'フォロワーがマスター口座を複製し、成功報酬の計算も自動で処理します。' },
    },
    explore: '詳しく見る',
  },
  platforms: {
    eyebrow: 'プラットフォーム',
    titleA: '3つのプラットフォーム。',
    titleB: '1つの開発チーム。',
    lead1: '自社開発、ホワイトラベルで世界各地に導入。稼働までの目安は',
    lead2: '数週間',
    pick: 'プラットフォームを選ぶ',
    explore: '詳しく見る',
  },
  pricing: {
    from: '導入期間',
    pips: '週間',
    eyebrow: 'サービス',
    titleA: '当社が最も',
    titleB: '得意とすること',
    lead: '3つのことを、確実に。プラットフォームを構築し、御社のブランドを適用し、必要なシステムと接続し、稼働後も維持します。',
    sub: 'テンプレートをオーダーメイドと偽って販売することはありません。技術は自社のものなので、ご依頼どおりに作れます。',
    cards: {
      c1: { t: 'プラットフォーム開発', b: 'ターミナル、バックオフィス、リスク管理システム一式。' },
      c2: { t: 'ホワイトラベル', b: '御社の名義で、完全にブランド化して提供します。' },
      c3: { t: '各種連携', b: '決済、KYC、流動性、CRM、外部API との接続。' },
    },
    explore: '詳しく見る',
  },
  securities: {
    eyebrow: '稼働後',
    titleA: '公開したら終わり、',
    titleB: 'ではありません',
    lead: '稼働後の監視、アップデート、改善サイクル。コードを書いたチームが、そのまま問い合わせに対応します。',
    regulated: '',
    explore: '詳しく見る',
  },
  crypto: {
    eyebrow: 'AI・アルゴリズム取引',
    titleA: '御社の顧客が自分で',
    titleB: '作れる戦略を。',
    lead: 'AI戦略ビルダー、バックテスト、アルゴリズムの実運用を御社のプラットフォーム内に、御社のブランドで搭載。トレーダーは画面を離れずに自動化できます。',
    regulated: '',
    explore: '詳しく見る',
  },
  steps: {
    titleA: '最初のご相談から',
    titleB: '稼働まで',
    cta: '無料デモを予約',
    s1: { t: '構想をお聞かせください', d: '対象市場、銘柄、注文フローの扱い方を短時間で整理します。ご契約の義務はありません。', tag: 'ヒアリング' },
    s2: { t: '開発とブランド適用', d: '御社のプラットフォーム、御社の名義、御社のドメイン。必要な外部連携も組み込みます。', tag: '開発' },
    s3: { t: '稼働、そしてその後', d: '導入、引き継ぎ、その後の監視と改善サイクル。', tag: '公開とサポート' },
  },
  about: {
    eyebrow: '私たちについて',
    titleA: '自社開発チームです。',
    titleB: '再販業者ではありません。',
    lead: '販売するエンジンを自分たちで書いています。だからこそ、ご要望の変更をその場で実装できます。他社ベンダーへ要望を出して待つ必要はありません。',
    learnMore: '詳しく見る',
  },
  follow: {
    title: 'フォローする',
  },
  footerLinks: {
    eyebrow: 'お問い合わせ',
    lead: '構想をお聞かせください。1営業日以内にご返信します。',
    cols: {
      client: { h: 'プラットフォーム', l1: 'Global Trading Platform', l2: 'AI Trading Platform' },
      partner: { h: 'サービス', l1: 'ホワイトラベル' },
      help: { h: '会社情報', l1: '会社概要', l2: 'お問い合わせ' },
    },
  },
  disclaimer: {
    title: '免責事項',
    p1: 'SetupFX はソフトウェア開発会社です。プラットフォーム、バックオフィス、リスクエンジンおよび関連する連携機能といった取引技術を開発し、認可を受けたブローカー、自己勘定取引会社、その他の規制対象事業者へライセンス提供しています。',
    p2: '当社はブローカー、取引所、金融機関のいずれでもありません。金融、投資、税務、助言に関するサービスは提供せず、投資の勧誘も受け入れも行わず、取引による収益について一切の表明を行いません。当社のクライアントが運営するプラットフォームは、そのクライアント自身のライセンスと規制上の義務のもとで運営されるものであり、当社の責任範囲ではありません。',
    p3: 'レバレッジ商品の取引には大きな損失リスクがあり、すべての方に適しているわけではありません。本サイトの内容は、取引の申し込み、勧誘、推奨のいずれでもありません。取引事業の立ち上げを検討される場合は、該当する法域の法務・規制の専門家にご相談ください。',
    p4: '',
    hq: 'お問い合わせ:',
    hqAddr: 'setupfx24.com',
    copyright: '© 2026 SetupFX. All rights reserved.',
    links: {
      privacy: 'プライバシーポリシー',
      terms: '利用規約',
      risk: '免責事項',
      vuln: '脆弱性の報告',
    },
  },
}

const zh: Record<string, DictNode> = {
  capabilityNote: {
    lead: '以下均为平台功能，而非我们运营的服务。',
    body: '此处列出的每一项功能，都是我们内置于您的平台并随平台一并交付的。SetupFX 不经营经纪业务，不持有客户资金，不进行订单路由，也不执行交易——这些均由您自己持牌的实体以您的品牌开展。',
  },
  nav: {
    markets: '解决方案',
    platforms: '平台',
    partners: '白标',
    policy: '支持',
    about: '关于我们',
    contact: '联系我们',
    login: '客户登录',
    signup: '预约演示',
    lang: 'ZH',
  },
  hero: {
    eyebrow: '软件开发公司',
    headlineA: '为经纪商',
    headlineB: '与自营交易公司',
    headlineC: '打造的交易平台。',
    sub: '我们构建交易业务背后的技术——交易平台、后台系统与风控引擎，以您的品牌交付，上线后长期提供支持。',
    ctaOpen: '预约免费演示',
    ctaDemo: '查看平台',
  },
  bank: {
    titleA: '您的品牌，',
    titleB: '我们的引擎。',
    lead: '牌照、客户与品牌由您掌握；终端、后台与风控引擎由我们提供——以您的名义、您的域名、您的配色交付。',
    sub: '每套平台都包含交易业务真正依赖的模块：流动性路由、资管账户结构与跟单交易，全部在同一个后台中管理。',
    eyebrow: '标准配置',
    cards: {
      metals: { title: '流动性桥接', body: '将订单流路由至您自己的流动性提供商，或在内部处理。' },
      currency: { title: 'MAM / PAMM', body: '基于份额核算的资管账户，支持高水位线业绩报酬。' },
      cfds: { title: '跟单交易', body: '跟随者复制主账户交易，业绩报酬由系统自动处理。' },
    },
    explore: '了解更多',
  },
  platforms: {
    eyebrow: '我们的平台',
    titleA: '三套平台。',
    titleB: '一支技术团队。',
    lead1: '自主研发，以白标形式部署于全球，通常上线时间为',
    lead2: '数周',
    pick: '选择适合的平台',
    explore: '了解更多',
  },
  pricing: {
    from: '交付周期',
    pips: '周',
    eyebrow: '服务',
    titleA: '我们最擅长的',
    titleB: '三件事',
    lead: '三件事，做到位。我们构建平台、贴上您的品牌、接入所需的各项系统，并在上线后持续维护。',
    sub: '不会把模板当作定制来卖。技术栈是我们自己的，所以您提出的需求就是我们实现的内容。',
    cards: {
      c1: { t: '交易平台开发', b: '完整的交易终端、后台与风控系统。' },
      c2: { t: '白标解决方案', b: '完全品牌化的平台，以您的身份交付。' },
      c3: { t: '系统对接服务', b: '支付、KYC、流动性、CRM 与第三方 API。' },
    },
    explore: '了解更多',
  },
  securities: {
    eyebrow: '上线之后',
    titleA: '上线并不是',
    titleB: '合作的终点',
    lead: '投入运行后的监控、更新与迭代。写代码的团队，就是您遇到问题时对接的团队。',
    regulated: '',
    explore: '了解更多',
  },
  crypto: {
    eyebrow: 'AI 与算法交易',
    titleA: '让您的客户',
    titleB: '自己构建策略。',
    lead: 'AI 策略构建器、回测与算法实盘执行——内置于您的平台、以您的品牌呈现，交易者无需离开平台即可实现自动化。',
    regulated: '',
    explore: '了解更多',
  },
  steps: {
    titleA: '从初次沟通到',
    titleB: '平台上线',
    cta: '预约免费演示',
    s1: { t: '告诉我们您要做什么', d: '一次简短沟通，梳理您的市场、交易品种以及订单流的处理方式。无任何义务。', tag: '需求梳理' },
    s2: { t: '我们开发并完成品牌化', d: '您的平台、您的品牌、您的域名——并接入业务所依赖的各项系统。', tag: '开发与品牌化' },
    s3: { t: '上线，并持续运行', d: '部署、交接，以及之后的监控与迭代周期。', tag: '上线与支持' },
  },
  about: {
    eyebrow: '关于我们',
    titleA: '自有研发团队。',
    titleB: '不是代理商。',
    lead: '我们所销售的引擎由我们自己编写。因此您提出的改动，我们可以直接实现，而不是把需求提交给别人的供应商再等待。',
    learnMore: '了解更多',
  },
  follow: {
    title: '关注我们',
  },
  footerLinks: {
    eyebrow: '联系我们',
    lead: '告诉我们您要做什么。我们会在一个工作日内回复。',
    cols: {
      client: { h: '平台', l1: 'Global Trading Platform', l2: 'AI Trading Platform' },
      partner: { h: '服务', l1: '白标解决方案' },
      help: { h: '公司', l1: '关于我们', l2: '联系我们' },
    },
  },
  disclaimer: {
    title: '免责声明',
    p1: 'SetupFX 是一家软件开发公司。我们开发交易技术，并以许可方式提供给持牌经纪商、自营交易公司及其他受监管的运营方，内容包括交易平台、后台系统、风控引擎及相关对接。',
    p2: '我们不是经纪商、交易所或金融机构。我们不提供金融、投资、税务或咨询服务，不招揽亦不接受投资，也不对任何交易活动可能产生的收益作出任何陈述。我们的客户所运营的平台，由该客户依其自身牌照与监管义务运营，与我们无关。',
    p3: '杠杆产品交易存在重大亏损风险，并不适合所有人。本网站的任何内容均不构成交易要约、招揽或建议。若您正在评估交易业务，请就您所在司法辖区咨询独立的法律与合规意见。',
    p4: '',
    hq: '联系方式：',
    hqAddr: 'setupfx24.com',
    copyright: '© 2026 SetupFX. 保留所有权利。',
    links: {
      privacy: '隐私政策',
      terms: '服务条款',
      risk: '免责声明',
      vuln: '漏洞披露',
    },
  },
}

export const dict: Dict = { fr, en, ja, zh }
