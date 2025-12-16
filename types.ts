
// Import status constants from shared constants file
import { ARTICLE_STATUS, ArticleStatus } from './constants/status';

// Keep ProjectStatus enum for backward compatibility, but use ARTICLE_STATUS values
// This allows gradual migration
export enum ProjectStatus {
  // Title Phase
  NEEDS_TITLES = ARTICLE_STATUS.NEEDS_TITLES,
  AWAITING_TITLE_APPROVAL = ARTICLE_STATUS.AWAITING_REVIEW_TITLES,
  TITLES_APPROVED = ARTICLE_STATUS.TITLES_APPROVED,
  NEEDS_TITLES_REVISION = ARTICLE_STATUS.NEEDS_TITLES_REVISION,
  
  // Outline Phase
  NEEDS_OUTLINE = ARTICLE_STATUS.NEEDS_OUTLINE,
  AWAITING_OUTLINE_APPROVAL = ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE,
  OUTLINE_APPROVED = ARTICLE_STATUS.OUTLINE_APPROVED,
  NEEDS_OUTLINE_REVISION = ARTICLE_STATUS.NEEDS_OUTLINE_REVISION,
  
  // Draft Phase
  NEEDS_DRAFT = ARTICLE_STATUS.NEEDS_DRAFT,
  AWAITING_DRAFT_APPROVAL = ARTICLE_STATUS.AWAITING_REVIEW_DRAFT,
  DRAFT_APPROVED = ARTICLE_STATUS.DRAFT_APPROVED,
  NEEDS_DRAFT_REVISION = ARTICLE_STATUS.NEEDS_DRAFT_REVISION,
  
  // Published state
  PUBLISHED = ARTICLE_STATUS.PUBLISHED,
  
  // Deprecated: Use specific revision states instead
  // Kept for backward compatibility with existing data
  NEEDS_REVISION = ARTICLE_STATUS.NEEDS_REVISION,
}

// Export the new status type for use in components
export type { ArticleStatus };
export { ARTICLE_STATUS };

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: Date;
}

// Contact person interface for client authentication
export interface Contact {
  id: string;
  client_id: string;
  name: string;
  email: string;
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  
  // Company Info
  industry?: string;
  website?: string;
  
  // Contact persons (multiple)
  contacts?: Contact[];
  
  // Legacy single contact fields (deprecated, use contacts[] instead)
  contactPerson?: string;
  email?: string;
  phone?: string;
  
  // AI Content Defaults (Smart Inheritance)
  defaultTone?: string;
  defaultRules?: string;
}

// New Interface for Historical Feedback Log
export interface ClientFeedbackHistory {
  id: string;
  clientId: string;
  campaignName: string;
  articleTitle: string;
  quotedContext: string;
  commentText: string;
  timestamp: Date;
}

export interface Campaign {
  id: string;
  name: string; // e.g. "Tax Season 2024"
  clientName?: string; // Deprecated: use clients[] instead
  clients?: Client[]; // Associated clients (many-to-many)
  strategyGoals: string;
  targetAudience: string;
  keywords: string[];
  createdAt: Date;
  status: 'ACTIVE' | 'ARCHIVED';
}

// OutlineSection interface for structured outline data
export interface OutlineSection {
  id: string;
  level: 'H1' | 'H2' | 'H3';
  title: string;
  description?: string;
  wordCountEstimate?: number;
}

// ContentBlock interface for structured draft content
// Used by both Agency Portal and Client Portal for unified content display
export interface ContentBlock {
  id: string;
  type: 'header' | 'paragraph' | 'quote' | 'image';
  content: string;
  src?: string;      // For images: URL or data URL
  caption?: string;  // For images: caption text
}

export interface Article {
  id: string;
  campaignId: string;
  title: string; // Working title or topic
  status: ProjectStatus;
  lastUpdated: Date;
  
  // Data for stages
  proposedTitles: string[];
  selectedTitle?: string;
  outlineContent?: string;
  outlineSections?: OutlineSection[]; // Structured outline for Client Portal
  draftContent?: string;              // Markdown format (backward compatible)
  draftBlocks?: ContentBlock[];       // Structured format for unified display
  
  // CMS Metadata
  slug?: string;
  category?: string;
  seoSummary?: string;
  seoIntro?: string;
  
  // Feedback
  clientComments: Comment[];
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  CAMPAIGN_DETAIL = 'CAMPAIGN_DETAIL',
  ARTICLE_WORKSPACE = 'ARTICLE_WORKSPACE',
  LIBRARY = 'LIBRARY',
  CLIENTS = 'CLIENTS'
}