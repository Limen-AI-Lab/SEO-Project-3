
import { Article, Campaign, ProjectStatus, Client, ClientFeedbackHistory } from '../types';

// Mock Data: Clients
let clients: Client[] = [
  { 
    id: 'cl1', 
    name: 'TechStart Legal',
    industry: 'Legal Tech / Crypto',
    contactPerson: 'Sarah Jenkins',
    email: 'sarah@techstart.legal',
    defaultTone: 'Professional, Authoritative, yet Accessible',
    defaultRules: 'Do not provide specific investment advice. Always include a disclaimer about changing regulations.'
  },
  { 
    id: 'cl2', 
    name: 'Cape Town Wealth',
    industry: 'Financial Advisory',
    contactPerson: 'David Ross',
    email: 'd.ross@ctwealth.co.za',
    defaultTone: 'Sophisticated, Exclusive, Trustworthy',
    defaultRules: 'Use British English spelling (S not Z). Focus on high-net-worth individual concerns.'
  },
  { 
    id: 'cl3', 
    name: 'Jozi Enterprise',
    industry: 'Small Business Consulting',
    contactPerson: 'Thabo Mbeki',
    defaultTone: 'Energetic, Encouraging, Simple',
    defaultRules: 'Keep sentences short. Focus on practical, actionable advice for SMEs.'
  },
  { id: 'cl4', name: 'Pretoria Tax Partners', industry: 'Tax Accounting' },
  { id: 'cl5', name: 'Durban Financial', industry: 'Investments' }
];

// Mock Data: Campaigns
const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    name: 'Crypto Regulation Push 2024',
    clientName: 'TechStart Legal',
    strategyGoals: 'Establish authority in crypto compliance for startups.',
    targetAudience: 'Tech Founders, CFOs, Crypto Startups',
    keywords: ['crypto tax', 'compliance', 'web3 regulations'],
    createdAt: new Date('2023-10-01'),
    status: 'ACTIVE'
  },
  {
    id: 'c2',
    name: 'Q4 Exporter Awareness',
    clientName: 'Cape Town Wealth',
    strategyGoals: 'Educate exporters on VAT benefits to drive consulting leads.',
    targetAudience: 'Export Business Owners, Logistics Managers',
    keywords: ['VAT', 'exports', 'zero-rated'],
    createdAt: new Date('2023-10-15'),
    status: 'ACTIVE'
  },
  {
    id: 'c3',
    name: 'Small Business Tax Season',
    clientName: 'Jozi Enterprise',
    strategyGoals: 'Capture SEO traffic for SME tax filing queries.',
    targetAudience: 'SME Owners in South Africa',
    keywords: ['SME tax', 'deductions', 'SARS filing'],
    createdAt: new Date('2023-09-20'),
    status: 'ACTIVE'
  }
];

// Mock Data: Articles
const MOCK_ARTICLES: Article[] = [
  {
    id: 'a1',
    campaignId: 'c1',
    title: 'Crypto Tax Regulations 2024',
    status: ProjectStatus.NEEDS_DRAFT,
    lastUpdated: new Date(),
    proposedTitles: [
      'Crypto Tax 101: A Guide for Startups',
      'Navigating 2024 Crypto Regulations',
      'Bitcoin and the Taxman'
    ],
    selectedTitle: 'Navigating 2024 Crypto Regulations',
    outlineContent: '# Introduction\n- Brief overview of the crypto market growth in 2023.\n- The importance of compliance for startups.\n\n# Key Regulatory Changes in 2024\n- New reporting requirements for exchanges.\n- Classification of tokens (Utility vs Security).\n\n# Tax Implications for Holders\n- Capital gains tax updates.\n- Staking rewards and income tax.\n\n# How to Prepare\n- Record keeping best practices.\n- Software tools for tracking.\n\n# Conclusion\n- Summary of key takeaways.\n- Call to action for consulting.',
    draftContent: '',
    clientComments: [
      {
        id: 'cm1',
        author: 'Mike (Client)',
        text: 'Please make sure to distinguish between casual traders and businesses.',
        timestamp: new Date('2023-10-27')
      },
      {
        id: 'cm2',
        author: 'Mike (Client)',
        text: 'Include a section on NFTs if possible.',
        timestamp: new Date('2023-10-27')
      }
    ]
  },
  {
    id: 'a2',
    campaignId: 'c2',
    title: 'VAT Exemptions for Exporters',
    status: ProjectStatus.TITLES_APPROVED,
    lastUpdated: new Date('2023-10-25'),
    proposedTitles: [
      'Understanding VAT Exemptions: A Guide for Exporters',
      'How to Handle VAT as an International Seller',
      '5 Common VAT Mistakes Exporters Make'
    ],
    selectedTitle: 'Understanding VAT Exemptions: A Guide for Exporters',
    clientComments: [
      {
        id: 'cm3',
        author: 'Client',
        text: 'Please emphasize the zero-rating rules specifically.',
        timestamp: new Date('2023-10-25')
      }
    ]
  },
  {
    id: 'a3',
    campaignId: 'c3',
    title: 'Small Business Tax Incentives',
    status: ProjectStatus.PUBLISHED,
    lastUpdated: new Date('2023-10-20'),
    proposedTitles: [],
    selectedTitle: 'Top 5 Incentives for SMEs',
    outlineContent: '...',
    draftContent: 'Final content published.',
    slug: 'sme-tax-incentives',
    category: 'Business Tax',
    clientComments: []
  },
  {
    id: 'a4',
    campaignId: 'c1',
    title: 'DeFi Tax Implications',
    status: ProjectStatus.NEEDS_TITLES,
    lastUpdated: new Date('2023-10-28'),
    proposedTitles: [],
    clientComments: []
  }
];

let campaigns = [...MOCK_CAMPAIGNS];
let articles = [...MOCK_ARTICLES];

// Client Operations
export const getClients = (): Client[] => {
  return clients;
};

export const addClient = (name: string, extraData?: Partial<Client>): Client => {
  const newClient: Client = {
    id: Date.now().toString(),
    name,
    ...extraData
  };
  clients = [...clients, newClient];
  return newClient;
};

export const updateClient = (id: string, updates: Partial<Client>): Client => {
  clients = clients.map(c => c.id === id ? { ...c, ...updates } : c);
  return clients.find(c => c.id === id)!;
};

export const deleteClient = (id: string) => {
  clients = clients.filter(c => c.id !== id);
};

// Campaign Operations
export const getCampaigns = (): Campaign[] => {
  return campaigns;
};

export const getCampaignById = (id: string): Campaign | undefined => {
  return campaigns.find(c => c.id === id);
};

export const createCampaign = (
  name: string, 
  clientName: string, 
  strategy: string, 
  audience: string, 
  keywords: string[]
): Campaign => {
  const newCampaign: Campaign = {
    id: Date.now().toString(),
    name,
    clientName,
    strategyGoals: strategy,
    targetAudience: audience,
    keywords,
    createdAt: new Date(),
    status: 'ACTIVE'
  };
  campaigns = [newCampaign, ...campaigns];
  return newCampaign;
};

// Article Operations
export const getArticlesByCampaign = (campaignId: string): Article[] => {
  return articles.filter(a => a.campaignId === campaignId);
};

export const getArticleById = (id: string): Article | undefined => {
  return articles.find(a => a.id === id);
};

export const updateArticle = (id: string, updates: Partial<Article>): Article => {
  articles = articles.map(a => (a.id === id ? { ...a, ...updates, lastUpdated: new Date() } : a));
  return articles.find(a => a.id === id)!;
};

export const createArticle = (
  campaignId: string, 
  topic: string, 
  initialStatus: ProjectStatus = ProjectStatus.NEEDS_TITLES,
  selectedTitle?: string
): Article => {
  const newArticle: Article = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    campaignId,
    title: selectedTitle || topic, // If we have a selected title, that becomes the main display title
    status: initialStatus,
    lastUpdated: new Date(),
    proposedTitles: [],
    selectedTitle: selectedTitle,
    clientComments: []
  };
  articles = [newArticle, ...articles];
  return newArticle;
};

// Simulation
export const simulateClientApproval = (id: string) => {
  const a = getArticleById(id);
  if (!a) return;

  // 1. FORKING LOGIC: If we are in the "Title Approval" phase
  if (a.status === ProjectStatus.AWAITING_TITLE_APPROVAL) {
    if (a.proposedTitles.length > 0) {
      // Fork each proposed title into a new Article
      a.proposedTitles.forEach((title) => {
        createArticle(
          a.campaignId,
          title, // Use title as topic
          ProjectStatus.NEEDS_OUTLINE, // Jump straight to outline
          title // Set as selected title
        );
      });
      
      articles = articles.filter(art => art.id !== id);
    } else {
      updateArticle(id, { status: ProjectStatus.NEEDS_OUTLINE });
    }
    return;
  }

  // 2. Standard Logic for other stages
  let nextStatus = a.status;
  
  // DIRECT TRANSITION: From Outline Review to Drafting
  if (a.status === ProjectStatus.AWAITING_OUTLINE_APPROVAL) {
    nextStatus = ProjectStatus.NEEDS_DRAFT;
  }
  
  if (a.status === ProjectStatus.AWAITING_DRAFT_APPROVAL) nextStatus = ProjectStatus.DRAFT_APPROVED;

  updateArticle(id, { status: nextStatus });
};

// Mock Feedback History Generator
export const getClientFeedbackHistory = (clientId: string): ClientFeedbackHistory[] => {
  // In a real app, this would query the backend for all comments across all articles 
  // where the campaign.client matches this clientId.
  // For dev/demo, we return static mock data to populate the UI.
  
  return [
    {
      id: 'h1',
      clientId,
      campaignName: 'Crypto Regulation Push 2024',
      articleTitle: 'Crypto Tax Regulations 2024',
      quotedContext: '...implies that all NFTs are securities...',
      commentText: 'Be careful here. Not all NFTs are securities. Use "may be considered" instead.',
      timestamp: new Date('2023-11-15')
    },
    {
       id: 'h2',
       clientId,
       campaignName: 'Q4 Exporter Awareness',
       articleTitle: 'VAT Exemptions for Exporters',
       quotedContext: '...cheap solutions for logistics...',
       commentText: 'Don\'t use "cheap". It sounds low quality. Use "cost-effective".',
       timestamp: new Date('2023-10-28')
    },
     {
       id: 'h3',
       clientId,
       campaignName: 'Crypto Regulation Push 2024',
       articleTitle: 'DeFi Tax Implications',
       quotedContext: '...users must report every transaction...',
       commentText: 'Add a disclaimer that they should consult a professional tax advisor.',
       timestamp: new Date('2023-11-02')
    },
    {
       id: 'h4',
       clientId,
       campaignName: 'Small Business Tax Season',
       articleTitle: 'Top 5 Incentives for SMEs',
       quotedContext: '...SARS will automatically deduct...',
       commentText: 'Incorrect. They must file for this deduction. Please correct.',
       timestamp: new Date('2023-09-22')
    }
  ];
};