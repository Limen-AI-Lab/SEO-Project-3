/**
 * Article Status Constants
 * These constants define the state machine for article workflow.
 * Both Agency Portal and Client Portal must use these exact values.
 */

export const ARTICLE_STATUS = {
  // Title Phase
  NEEDS_TITLES: 'NEEDS_TITLES',
  AWAITING_REVIEW_TITLES: 'AWAITING_REVIEW_TITLES',
  TITLES_APPROVED: 'TITLES_APPROVED',
  NEEDS_TITLES_REVISION: 'NEEDS_TITLES_REVISION',
  
  // Outline Phase
  NEEDS_OUTLINE: 'NEEDS_OUTLINE',
  AWAITING_REVIEW_OUTLINE: 'AWAITING_REVIEW_OUTLINE',
  OUTLINE_APPROVED: 'OUTLINE_APPROVED',
  NEEDS_OUTLINE_REVISION: 'NEEDS_OUTLINE_REVISION',
  
  // Draft Phase
  NEEDS_DRAFT: 'NEEDS_DRAFT',
  AWAITING_REVIEW_DRAFT: 'AWAITING_REVIEW_DRAFT',
  DRAFT_APPROVED: 'DRAFT_APPROVED',
  NEEDS_DRAFT_REVISION: 'NEEDS_DRAFT_REVISION',
  
  // Published state
  PUBLISHED: 'PUBLISHED',
  
  // Deprecated: Use specific revision states instead
  // Kept for backward compatibility with existing data
  NEEDS_REVISION: 'NEEDS_REVISION',
} as const;

export type ArticleStatus = typeof ARTICLE_STATUS[keyof typeof ARTICLE_STATUS];
