import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      navigate('/dashboard');
    }
  };

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
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Manage strategic content campaigns.</p>
          </div>
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
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300" htmlFor="password">Password</label>
                <a className="text-sm font-medium text-primary hover:text-primary-hover transition-colors" href="#">Forgot Password?</a>
              </div>
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
                />
              </div>
            </div>
            <div className="flex items-center">
              <input className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded-full dark:border-gray-600 dark:bg-gray-700" id="remember-me" name="remember-me" type="checkbox" />
              <label className="ml-2.5 block text-sm text-gray-600 dark:text-gray-400" htmlFor="remember-me">
                Remember me
              </label>
            </div>
            <div>
              <button className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-primary/30 hover:shadow-primary/50" type="submit">
                Sign In
              </button>
            </div>
          </form>
          <div className="relative mt-8 mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card-light dark:bg-card-dark text-gray-500 dark:text-gray-400">Or continue with</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center px-4 py-2.5 border border-border-light dark:border-border-dark rounded-xl shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors" type="button">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"></path>
                <path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853"></path>
                <path d="M5.50253 14.3003C4.99987 12.8099 4.99987 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC05"></path>
                <path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335"></path>
              </svg>
              Google
            </button>
            <button className="flex items-center justify-center px-4 py-2.5 border border-border-light dark:border-border-dark rounded-xl shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors" type="button">
              <svg className="h-5 w-5 mr-2 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"></path>
              </svg>
              SSO
            </button>
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <a className="font-medium text-primary hover:text-primary-hover" href="#">Request Access</a>
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

export default Login;

