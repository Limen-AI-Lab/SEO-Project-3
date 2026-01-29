import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 导入中文翻译文件
import zhCommon from './locales/zh/common.json';
import zhAuth from './locales/zh/auth.json';
import zhDashboard from './locales/zh/dashboard.json';
import zhCampaign from './locales/zh/campaign.json';
import zhArticle from './locales/zh/article.json';
import zhClient from './locales/zh/client.json';
import zhAdmin from './locales/zh/admin.json';
import zhStatus from './locales/zh/status.json';
import zhErrors from './locales/zh/errors.json';

// 导入英文翻译文件
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enCampaign from './locales/en/campaign.json';
import enArticle from './locales/en/article.json';
import enClient from './locales/en/client.json';
import enAdmin from './locales/en/admin.json';
import enStatus from './locales/en/status.json';
import enErrors from './locales/en/errors.json';

// 定义资源
const resources = {
  zh: {
    common: zhCommon,
    auth: zhAuth,
    dashboard: zhDashboard,
    campaign: zhCampaign,
    article: zhArticle,
    client: zhClient,
    admin: zhAdmin,
    status: zhStatus,
    errors: zhErrors,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    campaign: enCampaign,
    article: enArticle,
    client: enClient,
    admin: enAdmin,
    status: enStatus,
    errors: enErrors,
  },
};

// 从 localStorage 获取语言设置，默认中文
const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && (savedLanguage === 'zh' || savedLanguage === 'en')) {
      return savedLanguage;
    }
  }
  return 'zh'; // 默认中文
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'zh',
    
    // 命名空间配置
    ns: ['common', 'auth', 'dashboard', 'campaign', 'article', 'client', 'admin', 'status', 'errors'],
    defaultNS: 'common',
    
    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
    },
    
    react: {
      useSuspense: false, // 禁用 Suspense 以避免闪烁
    },
  });

// 监听语言变化，保存到 localStorage
i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', lng);
  }
});

export default i18n;
