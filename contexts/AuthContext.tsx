import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import supabase from '../services/supabaseClient.js';
import { redeemInviteCode, isAdmin, ADMIN_EMAIL } from '../services/inviteService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdminUser: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, inviteCode?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 检查当前用户是否是管理员
  const isAdminUser = isAdmin(user?.email);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, inviteCode?: string) => {
    try {
      // 如果没有邀请码，返回错误
      if (!inviteCode) {
        return { error: new Error('Invite code is required') };
      }

      // 首先创建用户
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Email verification is required - redirect to dashboard after verification
          emailRedirectTo: `${import.meta.env.VITE_APP_URL}/dashboard`,
          data: {
            invite_code: inviteCode
          }
        },
      });

      if (error) {
        return { error: error as Error };
      }

      // 用户创建成功后，兑换邀请码
      if (data.user) {
        const redeemResult = await redeemInviteCode(inviteCode, email, data.user.id);
        
        if (!redeemResult.success) {
          // 邀请码兑换失败，但用户已创建
          // 这种情况应该很少发生，因为我们在注册前已经验证过邀请码
          console.error('Failed to redeem invite code:', redeemResult.error_message);
          // 我们仍然让用户注册成功，只是记录错误
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.VITE_APP_URL}/reset-password`,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    session,
    loading,
    isAdminUser,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
