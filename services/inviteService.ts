import supabase from './supabaseClient.js';

// 邀请码状态类型
export type InviteCodeStatus = 'active' | 'paused' | 'revoked';

// 邀请码接口
export interface InviteCode {
  id: string;
  code: string;
  status: InviteCodeStatus;
  max_uses: number;
  used_count: number;
  valid_from: string;
  valid_to: string;
  created_by: string | null;
  note: string | null;
  article_quota: number; // 使用此邀请码注册的用户的初始文章配额
  created_at: string;
  updated_at: string;
}

// 兑换记录接口
export interface InviteRedemption {
  id: string;
  invite_code_id: string;
  redeemer_user_id: string | null;
  redeemed_email: string;
  state: 'completed' | 'failed';
  fail_reason: string | null;
  created_at: string;
}

// 验证结果接口
export interface ValidateResult {
  is_valid: boolean;
  error_message: string | null;
  code_id: string | null;
}

// 用户配额接口
export interface UserQuota {
  used_count: number;
  max_quota: number;
  remaining: number;
}

// 管理员邮箱
export const ADMIN_EMAIL = 'lufei.zhan@limenlab.ai';

/**
 * 检查用户是否是管理员
 */
export const isAdmin = (email: string | undefined): boolean => {
  return email === ADMIN_EMAIL;
};

/**
 * 验证邀请码是否有效
 */
export const validateInviteCode = async (code: string): Promise<ValidateResult> => {
  try {
    const { data, error } = await supabase
      .rpc('validate_invite_code', { input_code: code.toUpperCase() });
    
    if (error) {
      console.error('Error validating invite code:', error);
      return { is_valid: false, error_message: 'Failed to validate invite code', code_id: null };
    }
    
    if (data && data.length > 0) {
      return data[0];
    }
    
    return { is_valid: false, error_message: 'Invalid invite code', code_id: null };
  } catch (err) {
    console.error('Error validating invite code:', err);
    return { is_valid: false, error_message: 'An error occurred', code_id: null };
  }
};

/**
 * 兑换邀请码（注册完成后调用）
 */
export const redeemInviteCode = async (
  code: string,
  userEmail: string,
  userId: string
): Promise<{ success: boolean; error_message: string | null }> => {
  try {
    const { data, error } = await supabase
      .rpc('redeem_invite_code', {
        input_code: code.toUpperCase(),
        user_email: userEmail,
        user_id: userId
      });
    
    if (error) {
      console.error('Error redeeming invite code:', error);
      return { success: false, error_message: 'Failed to redeem invite code' };
    }
    
    if (data && data.length > 0) {
      return data[0];
    }
    
    return { success: false, error_message: 'Unknown error' };
  } catch (err) {
    console.error('Error redeeming invite code:', err);
    return { success: false, error_message: 'An error occurred' };
  }
};

/**
 * 获取用户文章配额
 */
export const getUserArticleQuota = async (userId: string): Promise<UserQuota | null> => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_article_quota', { user_id: userId });
    
    if (error) {
      console.error('Error getting user quota:', error);
      return null;
    }
    
    if (data && data.length > 0) {
      return {
        used_count: Number(data[0].used_count),
        max_quota: Number(data[0].max_quota),
        remaining: Number(data[0].remaining)
      };
    }
    
    // 默认配额
    return { used_count: 0, max_quota: 10, remaining: 10 };
  } catch (err) {
    console.error('Error getting user quota:', err);
    return null;
  }
};

/**
 * 检查用户是否可以创建新文章
 */
export const canCreateArticle = async (userId: string): Promise<{ allowed: boolean; message: string }> => {
  const quota = await getUserArticleQuota(userId);
  
  if (!quota) {
    return { allowed: false, message: 'Unable to check quota' };
  }
  
  if (quota.remaining <= 0) {
    return { 
      allowed: false, 
      message: `You have reached your article limit (${quota.max_quota} articles). Please upgrade to create more articles.`
    };
  }
  
  return { allowed: true, message: '' };
};

// ============================================
// 管理员功能
// ============================================

/**
 * 生成随机邀请码字符串
 */
const generateCodeString = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 批量生成邀请码
 */
export const generateInviteCodes = async (
  count: number,
  options: {
    maxUses?: number;
    validDays?: number;
    note?: string;
    articleQuota?: number; // 使用此邀请码注册的用户的初始文章配额
  } = {}
): Promise<{ success: boolean; codes: InviteCode[]; error?: string }> => {
  const { maxUses = 10, validDays = 30, note = '', articleQuota = 10 } = options;
  
  try {
    const codes: string[] = [];
    const existingCodes = new Set<string>();
    
    // 获取已存在的邀请码
    const { data: existing } = await supabase
      .from('invite_codes')
      .select('code');
    
    if (existing) {
      existing.forEach(e => existingCodes.add(e.code));
    }
    
    // 生成不重复的邀请码
    while (codes.length < count) {
      const code = generateCodeString();
      if (!existingCodes.has(code) && !codes.includes(code)) {
        codes.push(code);
      }
    }
    
    // 计算有效期
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + validDays);
    
    // 批量插入
    const insertData = codes.map(code => ({
      code,
      status: 'active' as InviteCodeStatus,
      max_uses: maxUses,
      used_count: 0,
      valid_from: validFrom.toISOString(),
      valid_to: validTo.toISOString(),
      note: note || null,
      article_quota: articleQuota
    }));
    
    const { data, error } = await supabase
      .from('invite_codes')
      .insert(insertData)
      .select();
    
    if (error) {
      console.error('Error generating invite codes:', error);
      return { success: false, codes: [], error: error.message };
    }
    
    return { success: true, codes: data || [] };
  } catch (err) {
    console.error('Error generating invite codes:', err);
    return { success: false, codes: [], error: 'An error occurred' };
  }
};

/**
 * 获取所有邀请码列表
 */
export const getAllInviteCodes = async (): Promise<InviteCode[]> => {
  try {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching invite codes:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching invite codes:', err);
    return [];
  }
};

/**
 * 更新邀请码状态
 */
export const updateInviteCodeStatus = async (
  codeId: string,
  status: InviteCodeStatus
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('invite_codes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', codeId);
    
    if (error) {
      console.error('Error updating invite code status:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error updating invite code status:', err);
    return false;
  }
};

/**
 * 更新邀请码设置
 */
export const updateInviteCode = async (
  codeId: string,
  updates: {
    max_uses?: number;
    valid_to?: string;
    note?: string;
    article_quota?: number;
  }
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('invite_codes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', codeId);
    
    if (error) {
      console.error('Error updating invite code:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error updating invite code:', err);
    return false;
  }
};

/**
 * 删除邀请码
 */
export const deleteInviteCode = async (codeId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('invite_codes')
      .delete()
      .eq('id', codeId);
    
    if (error) {
      console.error('Error deleting invite code:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error deleting invite code:', err);
    return false;
  }
};

/**
 * 获取邀请码的兑换记录
 */
export const getRedemptionsByCode = async (codeId: string): Promise<InviteRedemption[]> => {
  try {
    const { data, error } = await supabase
      .from('invite_redemptions')
      .select('*')
      .eq('invite_code_id', codeId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching redemptions:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching redemptions:', err);
    return [];
  }
};

/**
 * 获取所有兑换记录
 */
export const getAllRedemptions = async (): Promise<(InviteRedemption & { invite_code?: InviteCode })[]> => {
  try {
    const { data, error } = await supabase
      .from('invite_redemptions')
      .select(`
        *,
        invite_codes (*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching all redemptions:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching all redemptions:', err);
    return [];
  }
};

// ============================================
// 用户配额管理功能
// ============================================

// 用户配额信息接口
export interface UserWithQuota {
  user_id: string;
  user_email: string;
  created_at: string;
  invite_code: string | null;
  initial_quota: number;
  bonus_quota: number;
  total_quota: number;
  used_count: number;
  remaining: number;
}

/**
 * 获取所有用户及其配额信息（管理员用）
 */
export const getAllUsersWithQuota = async (): Promise<UserWithQuota[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_all_users_with_quota');
    
    if (error) {
      console.error('Error fetching users with quota:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching users with quota:', err);
    return [];
  }
};

/**
 * 管理员更新用户配额
 */
export const updateUserQuota = async (
  userId: string,
  newTotalQuota: number
): Promise<{ success: boolean; error_message: string | null }> => {
  try {
    const { data, error } = await supabase
      .rpc('admin_update_user_quota', {
        target_user_id: userId,
        new_total_quota: newTotalQuota
      });
    
    if (error) {
      console.error('Error updating user quota:', error);
      return { success: false, error_message: error.message };
    }
    
    if (data && data.length > 0) {
      return data[0];
    }
    
    return { success: true, error_message: null };
  } catch (err) {
    console.error('Error updating user quota:', err);
    return { success: false, error_message: 'An error occurred' };
  }
};

