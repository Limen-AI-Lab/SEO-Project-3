
// Import status constants from shared constants file
import { ARTICLE_STATUS, ArticleStatus } from './constants/status';

// Keep ProjectStatus enum for backward compatibility, but use ARTICLE_STATUS values
// This allows gradual migration
export enum ProjectStatus {
  NEEDS_TITLES = ARTICLE_STATUS.NEEDS_TITLES,
  AWAITING_TITLE_APPROVAL = ARTICLE_STATUS.AWAITING_REVIEW_TITLES, // Mapped to new constant
  TITLES_APPROVED = ARTICLE_STATUS.TITLES_APPROVED,
  
  NEEDS_OUTLINE = ARTICLE_STATUS.OUTLINE_APPROVED, // Mapped: after outline approval, ready for draft
  AWAITING_OUTLINE_APPROVAL = ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE,
  OUTLINE_APPROVED = ARTICLE_STATUS.OUTLINE_APPROVED,
  
  NEEDS_DRAFT = ARTICLE_STATUS.OUTLINE_APPROVED, // Mapped: after outline approval, ready for draft
  AWAITING_DRAFT_APPROVAL = ARTICLE_STATUS.AWAITING_REVIEW_DRAFT,
  DRAFT_APPROVED = ARTICLE_STATUS.DRAFT_APPROVED,
  
  NEEDS_REVISION = ARTICLE_STATUS.NEEDS_REVISION,
  
  PUBLISHED = 'PUBLISHED' // Legacy status, can be mapped to DRAFT_APPROVED
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

export interface Client {
  id: string;
  name: string;
  
  // Company Info
  industry?: string;
  website?: string;
  
  // Contact Info
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
  clientName: string;
  strategyGoals: string;
  targetAudience: string;
  keywords: string[];
  createdAt: Date;
  status: 'ACTIVE' | 'ARCHIVED';
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
  draftContent?: string;
  
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