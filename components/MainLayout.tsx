import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import CampaignDetail from './CampaignDetail';
import ProjectWorkspace from './ProjectWorkspace';
import KeywordDiscovery from './KeywordDiscovery';
import ClientManagement from './ClientManagement';
import InviteCodeManagement from './InviteCodeManagement';
import UserManagement from './UserManagement';
import { Layout, BookOpen, User, LogOut, Ticket, Users } from 'lucide-react';
import { ViewState } from '../types';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut, isAdminUser } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

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

  const handleSelectCampaign = (id: string) => {
    setSelectedCampaignId(id);
    setCurrentView(ViewState.CAMPAIGN_DETAIL);
  };

  const handleSelectArticle = (id: string) => {
    setSelectedArticleId(id);
    setCurrentView(ViewState.ARTICLE_WORKSPACE);
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

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
          {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">I</div>
          <span className="font-bold text-xl tracking-tight">Imprintly</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <button 
            onClick={handleBackToDashboard}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.DASHBOARD || currentView === ViewState.CAMPAIGN_DETAIL || currentView === ViewState.ARTICLE_WORKSPACE ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Layout size={18} />
            Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            <BookOpen size={18} />
            Asset Library
          </button>
          <button 
            onClick={() => setCurrentView(ViewState.CLIENTS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.CLIENTS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <User size={18} />
            Clients
          </button>
          
          {/* 邀请码管理 - 仅管理员可见 */}
          {isAdminUser && (
            <button 
              onClick={() => setCurrentView(ViewState.INVITE_CODES)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.INVITE_CODES ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Ticket size={18} />
              Invite Codes
            </button>
          )}
          
          {/* 用户管理 - 仅管理员可见 */}
          {isAdminUser && (
            <button 
              onClick={() => setCurrentView(ViewState.USERS)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${currentView === ViewState.USERS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Users size={18} />
              Users
            </button>
          )}
        </nav>

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
                <p className="text-xs text-slate-400">{isAdminUser ? 'Admin' : 'Agency Admin'}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              title="Sign Out"
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
              onBack={handleBackToCampaign}
            />
          </div>
        )}

        {currentView === ViewState.ARTICLE_WORKSPACE && selectedArticleId && (
          <ProjectWorkspace articleId={selectedArticleId} onBack={handleBackToCampaign} />
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
