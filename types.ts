
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
  editType?: 'modify' | 'delete' | 'add'; // For edit suggestions
  targetBlockId?: string; // Reference to the content block this comment relates to
}

// Client edit suggestion from Client Portal
export interface ClientEdit {
  id: string;
  article_id: string;
  contact_email: string;
  contact_name: string;
  edit_type: 'outline' | 'content';
  target_id: string;
  action_type: 'modify' | 'delete' | 'add';
  original_content: any;
  suggested_content: any;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

// Single revision history entry
export interface RevisionHistoryEntry {
  round: number;
  action: string;
  reviewer: string;
  timestamp: string;
  archived_at: string;
  sectionComments?: Array<{ targetId: string; text: string }>;
  contentComments?: Array<{ targetId: string; text: string }>;
  generalComments?: string;
  edits?: ClientEdit[];
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
  cmsId?: 'advisories' | 'bam' | 'fbpsnews' | 'solution' | null;
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
  
  // Content Settings (from Title Generation stage)
  language?: string;  // Target language for content (e.g., "English", "Chinese")
  tone?: string;      // Tone of voice for content
  
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
  coverImage?: string; // URL for article cover image
  
  // Feedback
  clientComments: Comment[];
  
  // Revision tracking
  revisionRound?: number;                    // Current revision round (1 = first review)
  revisionHistory?: RevisionHistoryEntry[];  // History of all previous reviews
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  CAMPAIGN_DETAIL = 'CAMPAIGN_DETAIL',
  ARTICLE_WORKSPACE = 'ARTICLE_WORKSPACE',
  LIBRARY = 'LIBRARY',
  CLIENTS = 'CLIENTS'
}

// CMS Article interface for published content
export interface CMSArticle {
  id?: string;
  article_id: string;
  title: string;
  create_date: string; // ISO date string
  content: string; // Markdown content
  short_text: string;
  cover_image?: string;
  cms_category?: string;
  created_at?: string;
  updated_at?: string;
}