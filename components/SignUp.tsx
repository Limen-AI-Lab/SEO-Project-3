import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Loader2, CheckCircle, Ticket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { validateInviteCode } from '../services/inviteService';

const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // 验证邀请码状态
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // 当邀请码输入变化时重置验证状态
  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value.toUpperCase());
    setCodeValidated(false);
    setCodeError(null);
  };

  // 验证邀请码
  const handleValidateCode = async () => {
    if (!inviteCode.trim()) {
      setCodeError('Please enter an invite code');
      return;
    }

    setIsValidatingCode(true);
    setCodeError(null);

    try {
      const result = await validateInviteCode(inviteCode);
      if (result.is_valid) {
        setCodeValidated(true);
        setCodeError(null);
      } else {
        setCodeValidated(false);
        setCodeError(result.error_message || 'Invalid invite code');
      }
    } catch (err) {
      setCodeError('Failed to validate invite code');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !inviteCode || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    // 验证邀请码（如果还没验证过）
    if (!codeValidated) {
      setIsValidatingCode(true);
      const result = await validateInviteCode(inviteCode);
      setIsValidatingCode(false);
      
      if (!result.is_valid) {
        setCodeError(result.error_message || 'Invalid invite code');
        return;
      }
      setCodeValidated(true);
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
      const { error: signUpError } = await signUp(email, password, inviteCode);
      
      if (signUpError) {
        setError(signUpError.message);
      } else {
        // Registration successful, show email verification message
        setRegistrationSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show success message after registration
  if (registrationSuccess) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-sans flex items-center justify-center min-h-screen p-4 transition-colors duration-300">
        <div className="w-full max-w-[420px] bg-card-light dark:bg-card-dark rounded-3xl shadow-soft dark:shadow-none dark:border dark:border-border-dark overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#E8F5E9] to-transparent dark:from-[#4CAF50]/20 dark:to-transparent pointer-events-none"></div>
          <div className="relative px-8 pt-10 pb-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Check Your Email</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
                We've sent a verification link to<br />
                <span className="font-semibold text-gray-700 dark:text-gray-300">{email}</span>
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                Please click the link in your email to verify your account and start using Imprintly.
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Didn't receive the email? Check your spam folder.
              </p>
              <Link 
                to="/" 
                className="inline-flex items-center justify-center py-3 px-6 border border-primary rounded-xl text-sm font-semibold text-primary hover:bg-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all"
              >
                Back to Sign In
              </Link>
              <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
                © 2024 Imprintly Inc. All rights reserved.
              </p>
            </div>
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
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Create your account to get started.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="email">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail size={20} />
                </div>
                <input
                  className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-shadow"
                  id="email"
                  name="email"
                  placeholder="name@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* 邀请码输入框 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="inviteCode">
                Invite Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Ticket size={20} />
                </div>
                <input
                  className={`block w-full pl-10 pr-24 py-2.5 border rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-shadow uppercase tracking-wider font-mono ${
                    codeError 
                      ? 'border-red-300 dark:border-red-700' 
                      : codeValidated 
                        ? 'border-green-300 dark:border-green-700' 
                        : 'border-border-light dark:border-border-dark'
                  }`}
                  id="inviteCode"
                  name="inviteCode"
                  placeholder="ABC123"
                  type="text"
                  maxLength={10}
                  value={inviteCode}
                  onChange={(e) => handleInviteCodeChange(e.target.value)}
                  disabled={loading}
                />
                {/* 验证按钮 */}
                <button
                  type="button"
                  onClick={handleValidateCode}
                  disabled={loading || isValidatingCode || !inviteCode.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: codeValidated ? '#10B981' : '#6366F1',
                    color: 'white'
                  }}
                >
                  {isValidatingCode ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : codeValidated ? (
                    <CheckCircle size={14} />
                  ) : (
                    'Verify'
                  )}
                </button>
              </div>
              {codeError && (
                <p className="mt-1 text-xs text-red-500">{codeError}</p>
              )}
              {codeValidated && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ Invite code verified</p>
              )}
              <p className="mt-1 text-xs text-gray-400">Required to create an account</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="password">Password</label>
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
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="confirmPassword">Confirm Password</label>
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
                disabled={loading || !codeValidated}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
              {!codeValidated && inviteCode && !codeError && (
                <p className="mt-2 text-xs text-center text-amber-600 dark:text-amber-400">
                  Please verify your invite code first
                </p>
              )}
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/" className="font-medium text-primary hover:text-primary-hover">Sign In</Link>
            </p>
            <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
              © 2024 Imprintly Inc. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
