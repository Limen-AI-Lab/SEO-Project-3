import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Dashboard from './Dashboard';
import CampaignDetail from './CampaignDetail';
import ProjectWorkspace from './ProjectWorkspace';
import KeywordDiscovery from './KeywordDiscovery';
import DirectGeneratePage from './DirectGeneratePage';
import ClientManagement from './ClientManagement';
import InviteCodeManagement from './InviteCodeManagement';
import UserManagement from './UserManagement';
import LanguageSwitcher from './LanguageSwitcher';
import { Layout, User, LogOut, Ticket, Users, Menu, X as CloseIcon } from 'lucide-react';
import { ViewState, ARTICLE_STATUS } from '../types';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabaseClient.js';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut, isAdminUser } = useAuth();
  const { t } = useTranslation(['common', 'admin']);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get user initials from email
  const getUserInitials = (email: string | undefined) => {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    if (parts.length >= 2) {
      return parts.substring(0, 2).toUpperCase();
    }
    return parts.charAt(0).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNavClick = (view: ViewState) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  const handleSelectCampaign = (id: string) => {
    setSelectedCampaignId(id);
    setCurrentView(ViewState.CAMPAIGN_DETAIL);
  };

  const handleSelectArticle = async (id: string) => {
    try {
      // Query database to get article's writing_path and status
      const { data: article, error } = await supabase
        .from('articles')
        .select('writing_path, status, campaign_id')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching article:', error);
        // Fallback to default behavior
        setSelectedArticleId(id);
        setCurrentView(ViewState.ARTICLE_WORKSPACE);
        return;
      }

      // Set the campaign ID for KeywordDiscovery
      if (article?.campaign_id) {
        setSelectedCampaignId(article.campaign_id);
      }

      // Check if it's a keyword-driven article in NEEDS_TITLES status
      if (article?.writing_path === 'keyword-driven' && article?.status === ARTICLE_STATUS.NEEDS_TITLES) {
        // Navigate to KeywordDiscovery with articleId
        setSelectedArticleId(id);
        setCurrentView(ViewState.KEYWORD_DISCOVERY);
      } else {
        // Default: navigate to ArticleWorkspace
        setSelectedArticleId(id);
        setCurrentView(ViewState.ARTICLE_WORKSPACE);
      }
    } catch (err) {
      console.error('Unexpected error in handleSelectArticle:', err);
      // Fallback to default behavior
      setSelectedArticleId(id);
      setCurrentView(ViewState.ARTICLE_WORKSPACE);
    }
  };

  const handleBackToDashboard = () => {
    setSelectedCampaignId(null);
    setCurrentView(ViewState.DASHBOARD);
  };

  const handleBackToCampaign = () => {
    setSelectedArticleId(null);
    setCurrentView(ViewState.CAMPAIGN_DETAIL);
  };

  const handleKeywordDiscovery = () => {
    setCurrentView(ViewState.KEYWORD_DISCOVERY);
  };

  const handleDirectGenerate = (articleId: string) => {
    setSelectedArticleId(articleId);
    setCurrentView(ViewState.DIRECT_GENERATE);
  };

  const handleDirectGenerateComplete = () => {
    // Go back to campaign detail after direct generation completes
    setSelectedArticleId(null);
    setCurrentView(ViewState.CAMPAIGN_DETAIL);
  };

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900 flex-col md:flex-row">
          {/* Mobile Header */}
          <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">I</div>
              <span className="font-bold text-lg tracking-tight">{t('common:app.name')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSignOut}
                className="p-2 text-slate-400 hover:text-slate-600"
                title={t('common:buttons.signOut')}
              >
                <LogOut size={20} />
              </button>
              <button 
                onClick={toggleMobileMenu}
                className="p-2 text-slate-600"
              >
                {isMobileMenuOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </header>

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 bg-slate-900/50 z-40 transition-opacity" onClick={() => setIsMobileMenuOpen(false)}>
              <div 
                className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col p-6 animate-in slide-in-from-right duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="font-bold text-xl">{t('common:labels.settings')}</span>
                  <button onClick={() => setIsMobileMenuOpen(false)}>
                    <CloseIcon size={24} className="text-slate-400" />
                  </button>
                </div>
                <nav className="flex-1 space-y-2">
                  <button 
                    onClick={() => handleNavClick(ViewState.DASHBOARD)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.DASHBOARD || currentView === ViewState.CAMPAIGN_DETAIL || currentView === ViewState.ARTICLE_WORKSPACE ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Layout size={18} />
                    {t('dashboard:nav', { defaultValue: 'Dashboard' })}
                  </button>
                  <button 
                    onClick={() => handleNavClick(ViewState.CLIENTS)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.CLIENTS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <User size={18} />
                    {t('client:nav', { defaultValue: 'Clients' })}
                  </button>
                  {isAdminUser && (
                    <button 
                      onClick={() => handleNavClick(ViewState.INVITE_CODES)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.INVITE_CODES ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Ticket size={18} />
                      {t('admin:nav.inviteCodes', { defaultValue: 'Invite Codes' })}
                    </button>
                  )}
                  {isAdminUser && (
                    <button 
                      onClick={() => handleNavClick(ViewState.USERS)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.USERS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Users size={18} />
                      {t('admin:nav.users', { defaultValue: 'Users' })}
                    </button>
                  )}
                </nav>
                {/* 语言切换 - 位于账户信息上方 */}
                <div className="pb-4">
                  <LanguageSwitcher variant="sidebar" />
                </div>
                <div className="pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                      {getUserInitials(user?.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                      <p className="text-xs text-slate-400">{isAdminUser ? t('admin:user.admin') : t('admin:user.agencyAdmin')}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all"
                  >
                    <LogOut size={18} />
                    {t('common:buttons.signOut')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sidebar (Desktop) */}
          <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex z-20 flex-shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">I</div>
          <span className="font-bold text-xl tracking-tight">{t('common:app.name')}</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <button 
            onClick={handleBackToDashboard}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.DASHBOARD || currentView === ViewState.CAMPAIGN_DETAIL || currentView === ViewState.ARTICLE_WORKSPACE ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Layout size={18} />
            {t('dashboard:nav', { defaultValue: 'Dashboard' })}
          </button>
          <button 
            onClick={() => setCurrentView(ViewState.CLIENTS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.CLIENTS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <User size={18} />
            {t('client:nav', { defaultValue: 'Clients' })}
          </button>
          
          {/* 邀请码管理 - 仅管理员可见 */}
          {isAdminUser && (
            <button 
              onClick={() => setCurrentView(ViewState.INVITE_CODES)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.INVITE_CODES ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Ticket size={18} />
              {t('admin:nav.inviteCodes', { defaultValue: 'Invite Codes' })}
            </button>
          )}
          
          {/* 用户管理 - 仅管理员可见 */}
          {isAdminUser && (
            <button 
              onClick={() => setCurrentView(ViewState.USERS)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.USERS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Users size={18} />
              {t('admin:nav.users', { defaultValue: 'Users' })}
            </button>
          )}
        </nav>

        {/* 语言切换 - 位于账户信息上方 */}
        <div className="px-4 pb-2">
          <LanguageSwitcher variant="sidebar" />
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                {getUserInitials(user?.email)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate" title={user?.email || ''}>
                  {user?.email || 'User'}
                </p>
                <p className="text-xs text-slate-400">{isAdminUser ? t('admin:user.admin') : t('admin:user.agencyAdmin')}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              title={t('common:buttons.signOut')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main View */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {currentView === ViewState.DASHBOARD && (
          <div className="h-full overflow-y-auto">
            <Dashboard onSelectCampaign={handleSelectCampaign} />
          </div>
        )}
        
        {currentView === ViewState.CAMPAIGN_DETAIL && selectedCampaignId && (
          <div className="h-full overflow-y-auto">
             <CampaignDetail 
               campaignId={selectedCampaignId} 
               onBack={handleBackToDashboard}
               onSelectArticle={handleSelectArticle}
               onKeywordDiscovery={handleKeywordDiscovery}
             />
          </div>
        )}

        {currentView === ViewState.KEYWORD_DISCOVERY && selectedCampaignId && (
          <div className="h-full overflow-y-auto">
            <KeywordDiscovery
              campaignId={selectedCampaignId}
              articleId={selectedArticleId || undefined}
              onBack={handleBackToCampaign}
            />
          </div>
        )}

        {currentView === ViewState.ARTICLE_WORKSPACE && selectedArticleId && (
          <ProjectWorkspace 
            articleId={selectedArticleId} 
            onBack={handleBackToCampaign} 
            onDirectGenerate={handleDirectGenerate}
          />
        )}

        {currentView === ViewState.DIRECT_GENERATE && selectedArticleId && (
          <DirectGeneratePage
            articleId={selectedArticleId}
            onBack={() => {
              setCurrentView(ViewState.ARTICLE_WORKSPACE);
            }}
            onComplete={handleDirectGenerateComplete}
          />
        )}

        {currentView === ViewState.CLIENTS && (
          <div className="h-full overflow-y-auto">
            <ClientManagement />
          </div>
        )}

        {currentView === ViewState.INVITE_CODES && isAdminUser && (
          <div className="h-full overflow-y-auto">
            <InviteCodeManagement />
          </div>
        )}

        {currentView === ViewState.USERS && isAdminUser && (
          <div className="h-full overflow-y-auto">
            <UserManagement />
          </div>
        )}
      </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
};

export default MainLayout;
