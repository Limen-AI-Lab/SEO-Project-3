/**
 * Article Status Constants
 * These constants define the state machine for article workflow.
 * Both Agency Portal and Client Portal must use these exact values.
 */

export const ARTICLE_STATUS = {
  // Agency working states
  NEEDS_TITLES: 'NEEDS_TITLES',
  TITLES_APPROVED: 'TITLES_APPROVED',
  OUTLINE_APPROVED: 'OUTLINE_APPROVED',
  DRAFT_APPROVED: 'DRAFT_APPROVED',
  
  // Client review states
  AWAITING_REVIEW_TITLES: 'AWAITING_REVIEW_TITLES',
  AWAITING_REVIEW_OUTLINE: 'AWAITING_REVIEW_OUTLINE',
  AWAITING_REVIEW_DRAFT: 'AWAITING_REVIEW_DRAFT',
  
  // Revision state
  NEEDS_REVISION: 'NEEDS_REVISION',
} as const;

export type ArticleStatus = typeof ARTICLE_STATUS[keyof typeof ARTICLE_STATUS];

