import supabase from './supabaseClient.js';

// 管理员用户接口
export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

// 缓存管理员邮箱列表，避免频繁查询数据库
let adminEmailsCache: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 从数据库获取所有管理员邮箱
 */
export const fetchAdminEmails = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('email');
    
    if (error) {
      console.error('Error fetching admin emails:', error);
      // 如果表不存在，返回默认管理员
      return ['lufei.zhan@limenlab.ai'];
    }
    
    return data?.map(row => row.email.toLowerCase()) || ['lufei.zhan@limenlab.ai'];
  } catch (err) {
    console.error('Error fetching admin emails:', err);
    return ['lufei.zhan@limenlab.ai'];
  }
};

/**
 * 检查用户是否是管理员（带缓存）
 */
export const checkIsAdmin = async (email: string | undefined): Promise<boolean> => {
  if (!email) return false;
  
  const now = Date.now();
  
  // 如果缓存过期或不存在，重新获取
  if (!adminEmailsCache || now - cacheTimestamp > CACHE_DURATION) {
    adminEmailsCache = await fetchAdminEmails();
    cacheTimestamp = now;
  }
  
  return adminEmailsCache.includes(email.toLowerCase());
};

/**
 * 同步检查是否是管理员（使用缓存，如果缓存为空则使用默认值）
 */
export const isAdminSync = (email: string | undefined): boolean => {
  if (!email) return false;
  
  // 如果有缓存，使用缓存
  if (adminEmailsCache) {
    return adminEmailsCache.includes(email.toLowerCase());
  }
  
  // 如果没有缓存，使用默认管理员邮箱
  return email.toLowerCase() === 'lufei.zhan@limenlab.ai';
};

/**
 * 清除缓存（当管理员列表变更时调用）
 */
export const clearAdminCache = (): void => {
  adminEmailsCache = null;
  cacheTimestamp = 0;
};

/**
 * 获取所有管理员列表
 */
export const getAllAdmins = async (): Promise<AdminUser[]> => {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching admins:', err);
    return [];
  }
};

/**
 * 添加管理员
 */
export const addAdmin = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('admin_users')
      .insert({ email: email.toLowerCase() });
    
    if (error) {
      console.error('Error adding admin:', error);
      return { success: false, error: error.message };
    }
    
    clearAdminCache();
    return { success: true };
  } catch (err) {
    console.error('Error adding admin:', err);
    return { success: false, error: 'An error occurred' };
  }
};

/**
 * 移除管理员
 */
export const removeAdmin = async (adminId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', adminId);
    
    if (error) {
      console.error('Error removing admin:', error);
      return { success: false, error: error.message };
    }
    
    clearAdminCache();
    return { success: true };
  } catch (err) {
    console.error('Error removing admin:', err);
    return { success: false, error: 'An error occurred' };
  }
};
