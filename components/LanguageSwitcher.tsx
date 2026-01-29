import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ArrowLeftRight } from 'lucide-react';

interface LanguageSwitcherProps {
  /** 显示样式：sidebar（侧边栏底部）或 standalone（独立按钮，用于公共页面右上角） */
  variant?: 'sidebar' | 'standalone';
  /** 自定义类名 */
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'sidebar',
  className = '' 
}) => {
  const { i18n } = useTranslation();
  
  const currentLang = i18n.language;
  const isZh = currentLang === 'zh' || currentLang.startsWith('zh-');
  
  const toggleLanguage = () => {
    const newLang = isZh ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };
  
  if (variant === 'standalone') {
    // 公共页面右上角的独立按钮样式
    return (
      <button
        onClick={toggleLanguage}
        className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700 ${className}`}
        title={isZh ? 'Switch to English' : '切换到中文'}
      >
        <Globe size={16} className="text-slate-500" />
        <span>{isZh ? 'EN' : '中文'}</span>
      </button>
    );
  }
  
  // 侧边栏底部样式 - 显示当前语言 + 切换图标
  return (
    <button
      onClick={toggleLanguage}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition text-slate-600 hover:bg-slate-50 hover:text-slate-900 ${className}`}
      title={isZh ? 'Switch to English' : '切换到中文'}
    >
      <Globe size={18} className="text-slate-500" />
      <span>{isZh ? '中文' : 'English'}</span>
      <ArrowLeftRight size={14} className="ml-auto text-slate-400" />
    </button>
  );
};

export default LanguageSwitcher;
