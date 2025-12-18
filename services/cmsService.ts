/**
 * CMS Service
 * Handles publishing articles to the CMS database table
 */

import supabase from './supabaseClient.js';
import { CMSArticle } from '../types';

/**
 * Publish an article to the CMS
 * @param articleData - The article data to publish
 * @returns The published CMS article or null if failed
 */
export async function publishToCMS(articleData: Omit<CMSArticle, 'id' | 'created_at' | 'updated_at'>): Promise<CMSArticle | null> {
  try {
    const { data, error } = await supabase
      .from('cms_articles')
      .insert([{
        article_id: articleData.article_id,
        title: articleData.title,
        create_date: articleData.create_date,
        content: articleData.content,
        short_text: articleData.short_text,
        cover_image: articleData.cover_image || null,
        cms_category: articleData.cms_category || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error publishing to CMS:', error);
      throw new Error(`发布到CMS失败: ${error.message}`);
    }

    console.log('✅ Successfully published to CMS:', data);
    return data as CMSArticle;
  } catch (err) {
    console.error('Unexpected error in publishToCMS:', err);
    throw err;
  }
}

/**
 * Check if an article has already been published to CMS
 * @param articleId - The original article ID
 * @returns The existing CMS article or null
 */
export async function getPublishedCMSArticle(articleId: string): Promise<CMSArticle | null> {
  try {
    const { data, error } = await supabase
      .from('cms_articles')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking CMS article:', error);
      return null;
    }

    return data as CMSArticle | null;
  } catch (err) {
    console.error('Unexpected error in getPublishedCMSArticle:', err);
    return null;
  }
}

/**
 * Update an existing CMS article
 * @param cmsArticleId - The CMS article ID to update
 * @param updates - The fields to update
 * @returns The updated CMS article or null if failed
 */
export async function updateCMSArticle(
  cmsArticleId: string, 
  updates: Partial<Omit<CMSArticle, 'id' | 'article_id' | 'created_at' | 'updated_at'>>
): Promise<CMSArticle | null> {
  try {
    const { data, error } = await supabase
      .from('cms_articles')
      .update({
        ...updates,
        create_date: updates.create_date || new Date().toISOString()
      })
      .eq('id', cmsArticleId)
      .select()
      .single();

    if (error) {
      console.error('Error updating CMS article:', error);
      throw new Error(`更新CMS文章失败: ${error.message}`);
    }

    console.log('✅ Successfully updated CMS article:', data);
    return data as CMSArticle;
  } catch (err) {
    console.error('Unexpected error in updateCMSArticle:', err);
    throw err;
  }
}

/**
 * Get all CMS articles (for listing/export)
 * @returns Array of CMS articles
 */
export async function getAllCMSArticles(): Promise<CMSArticle[]> {
  try {
    const { data, error } = await supabase
      .from('cms_articles')
      .select('*')
      .order('create_date', { ascending: false });

    if (error) {
      console.error('Error fetching CMS articles:', error);
      return [];
    }

    return (data || []) as CMSArticle[];
  } catch (err) {
    console.error('Unexpected error in getAllCMSArticles:', err);
    return [];
  }
}

