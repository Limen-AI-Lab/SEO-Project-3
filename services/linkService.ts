/**
 * Link Service for generating client review links
 */

// Get client portal URL from environment variable or use default
const CLIENT_PORTAL_URL = import.meta.env.VITE_CLIENT_PORTAL_URL || 'http://localhost:5174';

// Debug: Log the CLIENT_PORTAL_URL to verify environment variable is loaded
console.log('🔗 CLIENT_PORTAL_URL:', CLIENT_PORTAL_URL);

/**
 * Generate a client review link for an article (legacy - for backward compatibility)
 * @param articleId - The UUID of the article
 * @returns The full URL for client review
 */
export const generateClientReviewLink = (articleId: string): string => {
  return `${CLIENT_PORTAL_URL}/review?articleId=${articleId}`;
};

/**
 * Generate a campaign review link for all articles in a campaign
 * @param campaignId - The UUID of the campaign
 * @returns The full URL for campaign review dashboard
 */
export const generateCampaignReviewLink = (campaignId: string): string => {
  return `${CLIENT_PORTAL_URL}/review?campaignId=${campaignId}`;
};

/**
 * Generate a specific article review link within a campaign context
 * @param campaignId - The UUID of the campaign
 * @param articleId - The UUID of the article
 * @returns The full URL for specific article review with campaign context
 */
export const generateCampaignArticleReviewLink = (campaignId: string, articleId: string): string => {
  return `${CLIENT_PORTAL_URL}/review?campaignId=${campaignId}&articleId=${articleId}`;
};

/**
 * Copy link to clipboard
 * @param link - The link to copy
 * @returns Promise that resolves when link is copied
 */
export const copyToClipboard = async (link: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch (err) {
    console.error('Failed to copy link:', err);
    // Fallback: create a temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = link;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      document.body.removeChild(textarea);
      return false;
    }
  }
};

