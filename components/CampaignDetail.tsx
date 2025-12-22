
import React, { useState, useEffect } from 'react';
import { Campaign, Article, ProjectStatus, ARTICLE_STATUS, Client } from '../types';
import supabase from '../services/supabaseClient.js';
import { generateCampaignReviewLink, copyToClipboard } from '../services/linkService';
import { getCampaignWithClients, addClientToCampaign, removeClientFromCampaign } from '../services/campaignService';
import { getAllClientsWithContacts } from '../services/clientService';
import StatusBadge from './StatusBadge';
import { ArrowLeft, Plus, Search, Target, Users, Tag, Link2, CheckCircle, Copy, X, Building, Trash2 } from 'lucide-react';

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
  
  // Link copy state
  const [linkCopied, setLinkCopied] = useState(false);
  
  // State for creating new article
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);

  // Client Management State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [isAddingClient, setIsAddingClient] = useState(false);

  // Handle copy campaign review link
  const handleCopyLink = async () => {
    const link = generateCampaignReviewLink(campaignId);
    const success = await copyToClipboard(link);
    if (success) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try to fetch campaign with multi-client support
      let mappedCampaign: Campaign | null = null;
      
      try {
        mappedCampaign = await getCampaignWithClients(campaignId);
      } catch (newMethodErr) {
        console.log('New method failed, falling back to old method:', newMethodErr);
      }
      
      // Fallback to old method if new method fails
      if (!mappedCampaign) {
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
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

        mappedCampaign = {
          id: campaignData.id,
          name: campaignData.name,
          clientName: 'Unknown Client',
          strategyGoals: campaignData.strategy_goals || '',
          targetAudience: '',
          keywords: [],
          createdAt: new Date(campaignData.created_at),
          status: 'ACTIVE' as const
        };
      }
      
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

  // Load available clients when opening client modal
  const openClientModal = async () => {
    try {
      const clients = await getAllClientsWithContacts();
      setAvailableClients(clients);
      setIsClientModalOpen(true);
    } catch (err) {
      console.error('Error loading clients:', err);
      alert('Failed to load clients');
    }
  };

  // Handle adding a client to the campaign
  const handleAddClient = async (clientId: string) => {
    setIsAddingClient(true);
    try {
      await addClientToCampaign(campaignId, clientId);
      await loadData(); // Refresh campaign data
    } catch (err: any) {
      console.error('Error adding client:', err);
      alert(err.message || 'Failed to add client');
    } finally {
      setIsAddingClient(false);
    }
  };

  // Handle removing a client from the campaign
  const handleRemoveClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to remove this client from the campaign? Their contacts will no longer be able to access this campaign.')) return;
    
    try {
      await removeClientFromCampaign(campaignId, clientId);
      await loadData(); // Refresh campaign data
    } catch (err: any) {
      console.error('Error removing client:', err);
      alert(err.message || 'Failed to remove client');
    }
  };

  // Get clients not yet associated with the campaign
  const getUnassociatedClients = () => {
    const associatedIds = (campaign?.clients || []).map(c => c.id);
    return availableClients.filter(c => !associatedIds.includes(c.id));
  };

  const handleCreateArticle = async () => {
    if (isCreatingArticle) return;
    
    setIsCreatingArticle(true);

    try {
      // Use campaign name as default topic - user can modify it in Title Generation page
      const defaultTopic = campaign?.name || 'New Article';
      
      const { data, error } = await supabase
        .from('articles')
        .insert({
          campaign_id: campaignId,
          title: defaultTopic,
          status: ARTICLE_STATUS.NEEDS_TITLES,
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
        // Navigate directly to the article workspace (Title Generation page)
        onSelectArticle(data.id);
      }
    } catch (err) {
      console.error('Unexpected error creating article:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCreatingArticle(false);
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
                  {campaign.clients && campaign.clients.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">
                        {campaign.clients.map(c => c.name).join(', ')}
                      </span>
                      <span className="text-indigo-600 text-xs font-medium px-2 py-0.5 bg-indigo-50 rounded-full">
                        {campaign.clients.length} Client{campaign.clients.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="font-medium text-slate-700">{campaign.clientName || 'No clients'}</span>
                  )}
                  <span>•</span>
                  <span>Campaign</span>
               </div>
            </div>
            <div className="flex items-center gap-3">
               {/* Manage Clients Button */}
               <button 
                 onClick={openClientModal}
                 className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition border bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                 title="Manage associated clients"
               >
                 <Building size={18} />
                 Manage Clients
               </button>
               
               {/* Client Review Link Button */}
               <button 
                 onClick={handleCopyLink}
                 className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition border ${
                   linkCopied 
                     ? 'bg-green-50 border-green-200 text-green-600' 
                     : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                 }`}
                 title="Copy client review link for this campaign"
               >
                 {linkCopied ? (
                   <>
                     <CheckCircle size={18} />
                     Link Copied!
                   </>
                 ) : (
                   <>
                     <Link2 size={18} />
                     Client Review Link
                   </>
                 )}
               </button>
               
            <button 
              onClick={handleCreateArticle}
              disabled={isCreatingArticle}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingArticle ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  New Article
                </>
              )}
            </button>
            </div>
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
                <button 
                  onClick={handleCreateArticle} 
                  disabled={isCreatingArticle}
                  className="text-indigo-600 hover:underline mt-2 disabled:opacity-50"
                >
                  {isCreatingArticle ? 'Creating...' : 'Create the first article'}
                </button>
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
                      <h3 className="font-medium text-slate-900">{article.selectedTitle || article.title}</h3>
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

      {/* Manage Clients Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
               <div>
                 <h3 className="text-lg font-bold text-slate-900">Manage Associated Clients</h3>
                 <p className="text-sm text-slate-500 mt-0.5">Add or remove clients from this campaign</p>
               </div>
               <button 
                 onClick={() => setIsClientModalOpen(false)} 
                 className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition"
               >
                 <X size={20} />
               </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
               {/* Currently Associated Clients */}
               <div className="mb-6">
                 <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                   <Users size={14} className="text-indigo-600" />
                   Associated Clients ({campaign.clients?.length || 0})
                 </h4>
                 
                 {campaign.clients && campaign.clients.length > 0 ? (
                   <div className="space-y-2">
                     {campaign.clients.map(client => (
                       <div 
                         key={client.id} 
                         className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 group hover:border-slate-300 transition"
                       >
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                             {client.name.charAt(0).toUpperCase()}
                           </div>
                           <div>
                             <div className="font-medium text-slate-800">{client.name}</div>
                             {client.contacts && client.contacts.length > 0 && (
                               <div className="text-xs text-slate-500">
                                 {client.contacts.length} contact{client.contacts.length > 1 ? 's' : ''} with portal access
                               </div>
                             )}
                           </div>
                         </div>
                         <button 
                           onClick={() => handleRemoveClient(client.id)}
                           className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100"
                           title="Remove from campaign"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="text-center py-6 text-slate-400 text-sm italic border border-dashed border-slate-200 rounded-lg">
                     No clients associated with this campaign yet.
                   </div>
                 )}
               </div>

               {/* Available Clients to Add */}
               {getUnassociatedClients().length > 0 && (
                 <div>
                   <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                     <Plus size={14} className="text-green-600" />
                     Add Client
                   </h4>
                   <div className="space-y-2">
                     {getUnassociatedClients().map(client => (
                       <div 
                         key={client.id} 
                         className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-200 transition cursor-pointer group"
                         onClick={() => handleAddClient(client.id)}
                       >
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition">
                             {client.name.charAt(0).toUpperCase()}
                           </div>
                           <div>
                             <div className="font-medium text-slate-700 group-hover:text-indigo-600 transition">{client.name}</div>
                             {client.contacts && client.contacts.length > 0 && (
                               <div className="text-xs text-slate-500">
                                 {client.contacts.length} contact{client.contacts.length > 1 ? 's' : ''}
                               </div>
                             )}
                           </div>
                         </div>
                         <div className="flex items-center gap-2 text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                           {isAddingClient ? (
                             <div className="animate-spin h-4 w-4 border-2 border-indigo-600 rounded-full border-t-transparent"></div>
                           ) : (
                             <>
                               <Plus size={16} />
                               <span className="text-sm font-medium">Add</span>
                             </>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {getUnassociatedClients().length === 0 && availableClients.length > 0 && (
                 <div className="text-center py-4 text-slate-500 text-sm bg-slate-50 rounded-lg">
                   All available clients have been added to this campaign.
                 </div>
               )}

               {availableClients.length === 0 && (
                 <div className="text-center py-4 text-amber-600 text-sm bg-amber-50 rounded-lg border border-amber-200">
                   No clients found. Please create clients in the Clients page first.
                 </div>
               )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
               <button 
                 onClick={() => setIsClientModalOpen(false)} 
                 className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
               >
                 Done
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignDetail;
