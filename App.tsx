
import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import CampaignDetail from './components/CampaignDetail';
import ProjectWorkspace from './components/ProjectWorkspace';
import ClientManagement from './components/ClientManagement';
import { Layout, BookOpen, User } from 'lucide-react';
import { ViewState } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">T</div>
          <span className="font-bold text-xl tracking-tight">TaxFlow</span>
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
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">JD</div>
            <div>
              <p className="text-sm font-medium text-slate-900">John Doe</p>
              <p className="text-xs text-slate-400">Agency Admin</p>
            </div>
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
      </div>
    </div>
  );
};

export default App;
