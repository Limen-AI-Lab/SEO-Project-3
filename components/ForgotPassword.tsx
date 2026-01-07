import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ForgotPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await resetPassword(email);
      
      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-sans flex items-center justify-center min-h-screen p-4 transition-colors duration-300">
        <div className="w-full max-w-[420px] bg-card-light dark:bg-card-dark rounded-3xl shadow-soft dark:shadow-none dark:border dark:border-border-dark overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F0F0FE] to-transparent dark:from-[#544AED]/20 dark:to-transparent pointer-events-none"></div>
          <div className="relative px-8 pt-10 pb-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Check Your Email</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                We've sent a password reset link to<br />
                <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </p>
            </div>

            <div className="text-center">
              <Link 
                to="/" 
                className="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover"
              >
                <ArrowLeft size={16} className="mr-1" />
                Back to Sign In
              </Link>
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
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Enter your email to reset your password.</p>
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

            <div>
              <button 
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-primary/30 hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed" 
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <Link 
              to="/" 
              className="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover"
            >
              <ArrowLeft size={16} className="mr-1" />
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
};

export default ForgotPassword;

