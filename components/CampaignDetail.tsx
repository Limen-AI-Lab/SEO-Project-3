
import React, { useState, useEffect } from 'react';
import { Campaign, Article, ProjectStatus, ARTICLE_STATUS } from '../types';
import supabase from '../services/supabaseClient.js';
import StatusBadge from './StatusBadge';
import { ArrowLeft, Plus, Search, Target, Users, Tag } from 'lucide-react';

interface Props {
  campaignId: string;
  onBack: () => void;
  onSelectArticle: (articleId: string) => void;
}

const CampaignDetail: React.FC<Props> = ({ campaignId, onBack, onSelectArticle }) => {
  const [campaign, setCampaign] = useState<Campaign | undefined>(undefined);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal State for New Article
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch campaign from Supabase
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*, clients(name)')
        .eq('id', campaignId)
        .single();

      if (campaignError) {
        console.error('Error fetching campaign:', campaignError);
        setError(`获取 Campaign 失败：${campaignError.message}`);
        setIsLoading(false);
        return;
      }

      if (!campaignData) {
        setError('Campaign 不存在');
        setIsLoading(false);
        return;
      }

      // Map database fields to Campaign interface
      const mappedCampaign: Campaign = {
        id: campaignData.id,
        name: campaignData.name,
        clientName: campaignData.clients?.name || '',
        strategyGoals: campaignData.strategy_goals || '',
        targetAudience: '', // Not in DB schema yet
        keywords: [], // Not in DB schema yet
        createdAt: new Date(campaignData.created_at),
        status: 'ACTIVE' as const
      };
      setCampaign(mappedCampaign);

      // Fetch articles from Supabase
      const { data: articlesData, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (articlesError) {
        console.error('Error fetching articles:', articlesError);
        setArticles([]);
      } else if (articlesData) {
        // Map database fields to Article interface
          const mappedArticles: Article[] = articlesData.map((article: any) => ({
            id: article.id,
            campaignId: article.campaign_id,
            title: article.title,
            status: (article.status as ProjectStatus) || ARTICLE_STATUS.NEEDS_TITLES,
            lastUpdated: article.last_updated ? new Date(article.last_updated) : new Date(article.created_at),
            proposedTitles: article.proposed_titles || [],
            selectedTitle: article.selected_title || undefined,
            outlineContent: article.outline_content || undefined,
            draftContent: article.draft_content || undefined,
            clientComments: article.client_comments ? (Array.isArray(article.client_comments) ? article.client_comments : []) : []
          }));
        setArticles(mappedArticles);
      } else {
        setArticles([]);
      }
    } catch (err) {
      console.error('Unexpected error loading data:', err);
      setError(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const handleCreateArticle = async () => {
    if (!newTopic.trim()) return;

    try {
      const { data, error } = await supabase
        .from('articles')
        .insert({
          campaign_id: campaignId,
          title: newTopic.trim(),
          status: ARTICLE_STATUS.NEEDS_TITLES, // Use new status constant
          proposed_titles: [],
          client_comments: []
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating article:', error);
        alert(`创建文章失败：${error.message}`);
        return;
      }

      if (data) {
        setIsModalOpen(false);
        setNewTopic('');
        // Refresh list to show the new article
        await loadData();
        // Optional: Jump straight to it
        // onSelectArticle(data.id);
      }
    } catch (err) {
      console.error('Unexpected error creating article:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition w-fit mb-4">
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium mb-2">加载失败</p>
          <p className="text-red-500 text-sm">{error || 'Campaign 不存在'}</p>
          <button 
            onClick={loadData} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumb / Header */}
      <div className="flex flex-col gap-6">
         <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition w-fit">
            <ArrowLeft size={16} />
            <span className="text-sm font-medium">Back to Dashboard</span>
         </button>

         <div className="flex justify-between items-start">
            <div>
               <h1 className="text-3xl font-bold text-slate-900">{campaign.name}</h1>
               <div className="flex items-center gap-2 mt-2 text-slate-500">
                  <span className="font-medium text-slate-700">{campaign.clientName}</span>
                  <span>•</span>
                  <span>Campaign</span>
               </div>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-md"
            >
              <Plus size={18} />
              New Article
            </button>
         </div>
      </div>

      {/* Campaign Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-indigo-600 font-bold text-sm uppercase tracking-wide">
               <Target size={16} /> Strategy
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">{campaign.strategyGoals || "No strategy defined."}</p>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-indigo-600 font-bold text-sm uppercase tracking-wide">
               <Users size={16} /> Audience
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">{campaign.targetAudience || "General Audience"}</p>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-indigo-600 font-bold text-sm uppercase tracking-wide">
               <Tag size={16} /> Keywords
            </div>
            <div className="flex flex-wrap gap-2">
               {campaign.keywords.length > 0 ? (
                 campaign.keywords.map((k, i) => (
                   <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">{k}</span>
                 ))
               ) : (
                 <span className="text-slate-400 text-sm italic">No keywords set.</span>
               )}
            </div>
         </div>
      </div>

      {/* Articles List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Campaign Articles</h2>
          <div className="relative">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
             <input 
               type="text" 
               placeholder="Search articles..." 
               className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
             />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
           {articles.length === 0 ? (
             <div className="p-12 text-center text-slate-400">
                <p>No articles in this campaign yet.</p>
                <button onClick={() => setIsModalOpen(true)} className="text-indigo-600 hover:underline mt-2">Create the first article</button>
             </div>
           ) : (
             articles.map((article) => (
               <div 
                 key={article.id}
                 onClick={() => onSelectArticle(article.id)}
                 className="p-6 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer group"
               >
                 <div className="flex-1">
                   <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-slate-900">{article.title}</h3>
                      <StatusBadge status={article.status} />
                   </div>
                   <p className="text-sm text-slate-500">Last updated {article.lastUpdated.toLocaleDateString()}</p>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    {article.clientComments.length > 0 && (
                      <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                         <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                         {article.clientComments.length} Comments
                      </div>
                    )}
                 </div>
               </div>
             ))
           )}
        </div>
      </div>

      {/* New Article Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100">
               <h3 className="text-lg font-bold text-slate-900">Add New Article</h3>
            </div>
            <div className="p-6">
               <label className="block text-sm font-medium text-slate-700 mb-1">Article Topic / Working Title</label>
               <input 
                 type="text" 
                 value={newTopic}
                 onChange={(e) => setNewTopic(e.target.value)}
                 placeholder="e.g. 5 Tips for Tax Compliance"
                 className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                 autoFocus
               />
               <p className="text-xs text-slate-500 mt-2">This will be added to the <strong>{campaign.name}</strong> campaign.</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-white rounded-lg transition">Cancel</button>
               <button onClick={handleCreateArticle} disabled={!newTopic} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create Article</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignDetail;
