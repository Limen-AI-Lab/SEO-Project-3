import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsEmailNotVerified(false);

    if (!email || !password) {
      setError(t('auth:errors.fillAllFields'));
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        // Check if error is due to email not being verified
        const errorMessage = signInError.message.toLowerCase();
        if (errorMessage.includes('email not confirmed') || errorMessage.includes('email_not_confirmed')) {
          setIsEmailNotVerified(true);
        } else {
          setError(signInError.message);
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-sans flex items-center justify-center min-h-screen p-4 transition-colors duration-300">
      {/* 语言切换按钮 */}
      <LanguageSwitcher variant="standalone" />
      
      <div className="w-full max-w-[420px] bg-card-light dark:bg-card-dark rounded-3xl shadow-soft dark:shadow-none dark:border dark:border-border-dark overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F0F0FE] to-transparent dark:from-[#544AED]/20 dark:to-transparent pointer-events-none"></div>
        <div className="relative px-8 pt-10 pb-8">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center mb-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md mr-3">
                <span className="text-white text-xl font-bold font-display">I</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{t('common:app.name')}</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t('auth:login.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {isEmailNotVerified && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-start">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                    {t('auth:emailVerification.title')}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {t('auth:emailVerification.message')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="email">{t('common:labels.email')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail size={20} />
                </div>
                <input
                  className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-shadow"
                  id="email"
                  name="email"
                  placeholder={t('auth:login.emailPlaceholder')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300" htmlFor="password">{t('common:labels.password')}</label>
                <Link to="/forgot-password" className="text-sm font-medium text-primary hover:text-primary-hover transition-colors">{t('auth:login.forgotPassword')}</Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={20} />
                </div>
                <input
                  className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-shadow tracking-widest"
                  id="password"
                  name="password"
                  placeholder={t('auth:login.passwordPlaceholder')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="flex items-center">
              <input className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded-full dark:border-gray-600 dark:bg-gray-700" id="remember-me" name="remember-me" type="checkbox" />
              <label className="ml-2.5 block text-sm text-gray-600 dark:text-gray-400" htmlFor="remember-me">
                {t('auth:login.rememberMe')}
              </label>
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
                    {t('auth:login.signingIn')}
                  </>
                ) : (
                  t('common:buttons.signIn')
                )}
              </button>
            </div>
          </form>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('auth:login.noAccount')}{' '}
              <Link to="/signup" className="font-medium text-primary hover:text-primary-hover">{t('common:buttons.signUp')}</Link>
            </p>
            <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
              {t('auth:copyright')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
