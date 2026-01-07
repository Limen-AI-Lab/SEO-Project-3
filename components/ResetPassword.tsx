import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabaseClient.js';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid session from the reset password link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setValidSession(!!session);
    };

    // Listen for auth state changes (when user clicks the reset link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setValidSession(true);
        }
      }
    );

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(password);
      
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (validSession === null) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-sans flex items-center justify-center min-h-screen p-4 transition-colors duration-300">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 size={24} className="animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Show error if no valid session
  if (!validSession) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-sans flex items-center justify-center min-h-screen p-4 transition-colors duration-300">
        <div className="w-full max-w-[420px] bg-card-light dark:bg-card-dark rounded-3xl shadow-soft dark:shadow-none dark:border dark:border-border-dark overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F0F0FE] to-transparent dark:from-[#544AED]/20 dark:to-transparent pointer-events-none"></div>
          <div className="relative px-8 pt-10 pb-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Invalid or Expired Link</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
            </div>

            <Link 
              to="/forgot-password"
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-primary/30 hover:shadow-primary/50"
            >
              Request New Link
            </Link>

            <div className="mt-6 text-center">
              <Link to="/" className="text-sm font-medium text-primary hover:text-primary-hover">
                Back to Sign In
              </Link>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
              © 2024 Imprintly Inc. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show success message
  if (success) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-sans flex items-center justify-center min-h-screen p-4 transition-colors duration-300">
        <div className="w-full max-w-[420px] bg-card-light dark:bg-card-dark rounded-3xl shadow-soft dark:shadow-none dark:border dark:border-border-dark overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F0F0FE] to-transparent dark:from-[#544AED]/20 dark:to-transparent pointer-events-none"></div>
          <div className="relative px-8 pt-10 pb-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Password Updated!</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Your password has been successfully updated. Redirecting to dashboard...
              </p>
            </div>

            <div className="flex justify-center">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>

            <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
              © 2024 Imprintly Inc. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-sans flex items-center justify-center min-h-screen p-4 transition-colors duration-300">
      <div className="w-full max-w-[420px] bg-card-light dark:bg-card-dark rounded-3xl shadow-soft dark:shadow-none dark:border dark:border-border-dark overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F0F0FE] to-transparent dark:from-[#544AED]/20 dark:to-transparent pointer-events-none"></div>
        <div className="relative px-8 pt-10 pb-8">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center mb-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md mr-3">
                <span className="text-white text-xl font-bold font-display">I</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Imprintly</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Enter your new password below.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="password">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={20} />
                </div>
                <input
                  className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-shadow tracking-widest"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Must be at least 6 characters</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="confirmPassword">Confirm New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={20} />
                </div>
                <input
                  className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-shadow tracking-widest"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="••••••••"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <button 
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-primary/30 hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed" 
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
            © 2024 Imprintly Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

