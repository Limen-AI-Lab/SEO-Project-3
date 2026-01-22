
import React, { useState, useEffect, useRef } from 'react';
import { Campaign, Client } from '../types';
import { getCampaigns, createCampaign, getClients, addClient, deleteClient } from '../services/store';
import { generateCampaignKeywords } from '../services/geminiService';
import { generateCampaignReviewLink, copyToClipboard } from '../services/linkService';
import { createCampaignWithClients, getAllCampaignsWithClients, updateCampaign, deleteCampaign, updateCampaignClients } from '../services/campaignService';
import { getAllClientsWithContacts } from '../services/clientService';
import { getUserArticleQuota, UserQuota } from '../services/inviteService';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabaseClient.js';
import CircularProgress from './CircularProgress';
import Modal from './Modal';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowRight, Plus, Search, X, Briefcase, Target, Users, Sparkles, Tag, ChevronDown, Check, Trash2, Link2, CheckCircle, Pencil, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface Props {
  onSelectCampaign: (id: string) => void;
}

const Dashboard: React.FC<Props> = ({ onSelectCampaign }) => {
  const { user, isAdminUser } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Article counts per campaign (fetched from Supabase)
  const [articleCounts, setArticleCounts] = useState<Record<string, number>>({});
  const [articleTotals, setArticleTotals] = useState<{ active: number; published: number }>({ active: 0, published: 0 });
  
  // 用户配额
  const [userQuota, setUserQuota] = useState<UserQuota | null>(null);
  
  // Toast state for link copy feedback
  const [copyToast, setCopyToast] = useState<{ show: boolean; campaignId: string | null }>({ show: false, campaignId: null });
  
  // New Campaign Form State
  const [campName, setCampName] = useState('');
  
  // Client Management State
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const [strategy, setStrategy] = useState('');
  const [audience, setAudience] = useState('');
  const [cmsId, setCmsId] = useState<string>('');
  
  // Keyword Module State
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);

  // Edit Campaign Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editCampName, setEditCampName] = useState('');
  const [editSelectedClients, setEditSelectedClients] = useState<Client[]>([]);
  const [editStrategy, setEditStrategy] = useState('');
  const [editAudience, setEditAudience] = useState('');
  const [editCmsId, setEditCmsId] = useState<string>('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [editKeywordInput, setEditKeywordInput] = useState('');
  const [isEditGeneratingKeywords, setIsEditGeneratingKeywords] = useState(false);
  const [editClientSearchTerm, setEditClientSearchTerm] = useState('');
  const [isEditClientDropdownOpen, setIsEditClientDropdownOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);

  // Custom Modal States for alerts and confirms
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'warning' | 'info' | 'success' }>({
    isOpen: false, title: '', message: '', type: 'info'
  });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'warning' | 'error'; onConfirm: () => void }>({
    isOpen: false, title: '', message: '', type: 'warning', onConfirm: () => {}
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const editDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch campaigns with multi-client support
      try {
        const campaignsWithClients = await getAllCampaignsWithClients();
        setCampaigns(campaignsWithClients);
        
        // Fetch article counts for each campaign from Supabase
        if (campaignsWithClients.length > 0) {
          const campaignIds = campaignsWithClients.map(c => c.id);
          const { data: articles, error: articlesError } = await supabase
            .from('articles')
            .select('campaign_id, status, outline_content')
            .in('campaign_id', campaignIds);
          
          if (!articlesError && articles) {
            // Count articles per campaign (excluding PUBLISHED and those without outline)
            const counts: Record<string, number> = {};
            campaignIds.forEach(id => counts[id] = 0);
            let activeTotal = 0;
            let publishedTotal = 0;
            articles.forEach(article => {
              // Skip articles with empty or null outline_content
              if (!article.outline_content || article.outline_content.trim() === '') {
                return;
              }

              const isPublished = !!article.status?.includes('PUBLISHED');
              if (isPublished) {
                publishedTotal += 1;
              } else {
                activeTotal += 1;
                counts[article.campaign_id] = (counts[article.campaign_id] || 0) + 1;
              }
            });
            setArticleCounts(counts);
            setArticleTotals({ active: activeTotal, published: publishedTotal });
          }
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        // If new method fails, just show empty campaigns
        // This likely means migration hasn't been run yet
        setCampaigns([]);
      }

      // Fetch clients with contacts
      try {
        const clientsWithContacts = await getAllClientsWithContacts();
        setAvailableClients(clientsWithContacts);
      } catch (err) {
        console.error('Error fetching clients:', err);
        // Fallback to local clients if Supabase fails
    setAvailableClients(getClients());
      }

      // 获取用户配额
      if (user?.id) {
        const quota = await getUserArticleQuota(user.id);
        setUserQuota(quota);
      }
    };

    fetchData();
  }, [user?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
      if (editDropdownRef.current && !editDropdownRef.current.contains(event.target as Node)) {
        setIsEditClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateCampaign = async () => {
    if (!campName) return;
    
    try {
      // Validate selected client IDs are valid UUIDs (only if clients are selected)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalidClients = selectedClients.filter(c => !uuidRegex.test(c.id));
      
      if (selectedClients.length > 0 && invalidClients.length > 0) {
        showAlert('Invalid Client ID', 'Some selected client IDs have invalid format. Please ensure client data is synced to the database and create clients in the "Clients" page first.', 'error');
        return;
      }

      const clientIds = selectedClients.map(c => c.id);
      
      // Try to use the new multi-client creation method
      try {
        const newCampaign = await createCampaignWithClients(
          {
            name: campName,
            strategyGoals: strategy,
            targetAudience: audience,
            keywords,
            cmsId: cmsId || undefined
          },
          clientIds
        );

        if (newCampaign) {
          // Refetch all campaigns
          const campaignsWithClients = await getAllCampaignsWithClients();
          setCampaigns(campaignsWithClients);
          
    setIsModalOpen(false);
    resetForm();
          onSelectCampaign(newCampaign.id);
          return;
        }
      } catch (newMethodErr: any) {
        console.error('New multi-client method failed, falling back to old method:', newMethodErr);
        
        // If it's a table not found error, fall back to old method
        if (!newMethodErr.message?.includes('campaign_clients')) {
          throw newMethodErr;
        }
      }

      // If new method failed, it means migration hasn't been run
      // Show error message to user
      showAlert('Database Migration Incomplete', 'Please run the migration script in Supabase SQL Editor. See console for details.', 'error');
      console.error('Campaign creation failed: campaign_clients table not found or client_id column still exists.');
      console.log('Please run the database migration script in Supabase.');
      return;
    } catch (err) {
      console.error('Unexpected error creating campaign:', err);
      showAlert('Creation Failed', `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}. Please check console for more information.`, 'error');
    }
  };

  const resetForm = () => {
    setCampName('');
    setSelectedClients([]);
    setClientSearchTerm('');
    setStrategy('');
    setAudience('');
    setCmsId('');
    setKeywords([]);
    setKeywordInput('');
  };

  // Handle copy campaign review link
  const handleCopyCampaignLink = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation(); // Prevent triggering onSelectCampaign
    const link = generateCampaignReviewLink(campaignId);
    const success = await copyToClipboard(link);
    if (success) {
      setCopyToast({ show: true, campaignId });
      setTimeout(() => setCopyToast({ show: false, campaignId: null }), 2000);
    }
  };

  // Keyword Logic
  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = keywordInput.trim();
      if (val && !keywords.includes(val)) {
        setKeywords([...keywords, val]);
        setKeywordInput('');
      }
    } else if (e.key === 'Backspace' && !keywordInput && keywords.length > 0) {
      setKeywords(keywords.slice(0, -1));
    }
  };

  const removeKeyword = (idx: number) => {
    setKeywords(keywords.filter((_, i) => i !== idx));
  };

  const handleGenerateKeywords = async () => {
    if (!campName && !strategy) {
      showAlert('Missing Information', 'Please fill in Campaign Name and Strategy Goals first so AI has enough context to generate keywords.', 'warning');
      return;
    }
    setIsGeneratingKeywords(true);
    // Use the first selected client's name for generation context
    const clientContext = selectedClients.map(c => c.name).join(', ');
    const generated = await generateCampaignKeywords(campName, clientContext, strategy, audience);
    
    // Merge new keywords with existing ones (avoid duplicates)
    const uniqueNew = generated.filter(k => !keywords.includes(k));
    setKeywords([...keywords, ...uniqueNew]);
    setIsGeneratingKeywords(false);
  };

  // Client Management Logic
  const handleToggleClient = (client: Client) => {
    if (selectedClients.find(c => c.id === client.id)) {
      setSelectedClients(selectedClients.filter(c => c.id !== client.id));
    } else {
      setSelectedClients([...selectedClients, client]);
    }
    // Keep dropdown open for multi-select
  };

  // Removed handleCreateClient logic as requested

  const handleDeleteClient = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    showConfirm('Delete Client', 'Are you sure you want to delete this client? This action cannot be undone.', () => {
      deleteClient(id);
      setAvailableClients(getClients());
      setSelectedClients(selectedClients.filter(c => c.id !== id));
    }, 'warning');
  };

  // Edit Campaign Functions
  const openEditModal = (e: React.MouseEvent, campaign: Campaign) => {
    e.stopPropagation();
    setEditingCampaign(campaign);
    setEditCampName(campaign.name);
    setEditSelectedClients(campaign.clients || []);
    setEditStrategy(campaign.strategyGoals || '');
    setEditAudience(campaign.targetAudience || '');
    setEditCmsId(campaign.cmsId || '');
    setEditKeywords(campaign.keywords || []);
    setEditKeywordInput('');
    setEditClientSearchTerm('');
    setIsEditClientDropdownOpen(false);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCampaign(null);
    setEditCampName('');
    setEditSelectedClients([]);
    setEditStrategy('');
    setEditAudience('');
    setEditCmsId('');
    setEditKeywords([]);
    setEditKeywordInput('');
    setEditClientSearchTerm('');
  };

  const handleEditToggleClient = (client: Client) => {
    if (editSelectedClients.find(c => c.id === client.id)) {
      setEditSelectedClients(editSelectedClients.filter(c => c.id !== client.id));
    } else {
      setEditSelectedClients([...editSelectedClients, client]);
    }
  };

  const handleEditAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = editKeywordInput.trim();
      if (val && !editKeywords.includes(val)) {
        setEditKeywords([...editKeywords, val]);
        setEditKeywordInput('');
      }
    } else if (e.key === 'Backspace' && !editKeywordInput && editKeywords.length > 0) {
      setEditKeywords(editKeywords.slice(0, -1));
    }
  };

  const removeEditKeyword = (idx: number) => {
    setEditKeywords(editKeywords.filter((_, i) => i !== idx));
  };

  const handleEditGenerateKeywords = async () => {
    if (!editCampName && !editStrategy) {
      showAlert('Missing Information', 'Please fill in Campaign Name and Strategy Goals first so AI has enough context to generate keywords.', 'warning');
      return;
    }
    setIsEditGeneratingKeywords(true);
    const clientContext = editSelectedClients.map(c => c.name).join(', ');
    const generated = await generateCampaignKeywords(editCampName, clientContext, editStrategy, editAudience);
    const uniqueNew = generated.filter(k => !editKeywords.includes(k));
    setEditKeywords([...editKeywords, ...uniqueNew]);
    setIsEditGeneratingKeywords(false);
  };

  const handleSaveEdit = async () => {
    if (!editingCampaign || !editCampName || editSelectedClients.length === 0) return;
    
    setIsSavingEdit(true);
    try {
      // Update campaign fields
      await updateCampaign(editingCampaign.id, {
        name: editCampName,
        strategyGoals: editStrategy,
        targetAudience: editAudience,
        keywords: editKeywords,
        cmsId: (editCmsId as any) || undefined
      });

      // Update associated clients
      const clientIds = editSelectedClients.map(c => c.id);
      await updateCampaignClients(editingCampaign.id, clientIds);

      // Refetch all campaigns
      const campaignsWithClients = await getAllCampaignsWithClients();
      setCampaigns(campaignsWithClients);
      
      closeEditModal();
    } catch (err) {
      console.error('Error saving campaign:', err);
      showAlert('Save Failed', `${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleListDeleteCampaign = (e: React.MouseEvent, camp: Campaign) => {
    e.stopPropagation();
    
    const articleCount = articleCounts[camp.id] || 0;
    const confirmMsg = articleCount > 0 
      ? `This will also delete ${articleCount} articles under this Campaign, and cannot be recovered!`
      : 'This action cannot be undone!';
    
    showConfirm(
      `Delete "${camp.name}"`,
      confirmMsg,
      async () => {
    setIsDeletingCampaign(true);
    try {
          await deleteCampaign(camp.id);
      
      // Refetch all campaigns
      const campaignsWithClients = await getAllCampaignsWithClients();
      setCampaigns(campaignsWithClients);
      
      // Also refresh article counts
      if (campaignsWithClients.length > 0) {
        const campaignIds = campaignsWithClients.map(c => c.id);
        const { data: articles, error: articlesError } = await supabase
          .from('articles')
          .select('campaign_id, status')
          .in('campaign_id', campaignIds);
        
        if (!articlesError && articles) {
          const counts: Record<string, number> = {};
          campaignIds.forEach(id => counts[id] = 0);
          let activeTotal = 0;
          let publishedTotal = 0;
          articles.forEach(article => {
            const isPublished = !!article.status?.includes('PUBLISHED');
            if (isPublished) {
              publishedTotal += 1;
            } else {
              activeTotal += 1;
              counts[article.campaign_id] = (counts[article.campaign_id] || 0) + 1;
            }
          });
          setArticleCounts(counts);
          setArticleTotals({ active: activeTotal, published: publishedTotal });
        }
      } else {
        setArticleCounts({});
        setArticleTotals({ active: 0, published: 0 });
      }
    } catch (err) {
      console.error('Error deleting campaign:', err);
      showAlert('Delete Failed', `${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsDeletingCampaign(false);
    }
      },
      'error'
    );
  };

  // Filter clients for edit dropdown
  const filteredEditClients = availableClients.filter(c => 
    c.name.toLowerCase().includes(editClientSearchTerm.toLowerCase())
  );

  // Helper functions for custom modals
  const showAlert = (title: string, message: string, type: 'error' | 'warning' | 'info' | 'success' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'error' = 'warning') => {
    setConfirmModal({ isOpen: true, title, message, type, onConfirm });
  };

  // Filter clients for dropdown
  const filteredClients = availableClients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // Stats Calculation
  const totalCampaigns = campaigns.length;
  const activeArticles = articleTotals.active;
  const publishedArticles = articleTotals.published;
  const maxQuota = userQuota?.max_quota ?? 10;
  const calculatedRemaining = maxQuota - activeArticles;
  console.log('---calculatedRemaining---', calculatedRemaining);

  const chartData = [
    { name: 'Active', value: activeArticles },
    { name: 'Published', value: publishedArticles },
  ];
  const COLORS = ['#818cf8', '#34d399'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaign Dashboard</h1>
          <p className="text-slate-500 mt-2">Manage strategic content campaigns and client goals.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-md"
        >
          <Plus size={18} />
          New Campaign
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Active Campaigns</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{totalCampaigns}</p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
            <Briefcase size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
             <p className="text-sm font-medium text-slate-500">Articles in Production</p>
             <div className="flex items-baseline gap-2 mt-1">
               <p className="text-3xl font-bold text-slate-900">{userQuota?.used_count ?? 0}</p>
               <p className="text-lg text-slate-400">/ {userQuota?.max_quota ?? 10}</p>
               <div className="relative group">
                 <Info size={16} className="text-blue-500 cursor-help" />
                 <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                   Counting rule: After clicking "Generate Draft", the number of articles will be counted.
                   <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                 </div>
               </div>
             </div>
             {userQuota && calculatedRemaining <= 0 && (
               <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                 <AlertCircle size={12} />
                 Quota reached
               </p>
             )}
             {userQuota && calculatedRemaining > 0 && calculatedRemaining <= 3 && (
               <p className="text-xs text-amber-500 mt-1">{calculatedRemaining} remaining</p>
             )}
          </div>
          <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
             <div className="text-lg font-bold">Aa</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <p className="text-sm font-medium text-slate-500 mb-2">Content Output</p>
           <div className="h-24 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} layout="vertical">
                 <XAxis type="number" hide />
                 <XAxis type="category" dataKey="name" hide />
                 <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Campaign List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Recent Campaigns</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search campaigns..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {campaigns.map((camp) => {
            const activeCount = articleCounts[camp.id] || 0;
            
            return (
              <div 
                key={camp.id} 
                onClick={() => onSelectCampaign(camp.id)}
                className="p-6 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">{camp.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                      {camp.status}
                    </span>
                    <button
                      onClick={(e) => openEditModal(e, camp)}
                      className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 text-xs font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 bg-white shadow-sm transition-all"
                      title="Edit Campaign"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    {isAdminUser && (
                      <div onClick={(e) => e.stopPropagation()} className="ml-2 relative inline-flex items-center">
                         <div className="invisible px-2 pr-8 py-1 text-xs font-medium whitespace-nowrap">
                           {(() => {
                             const options: Record<string, string> = {
                               '': 'No CMS ID',
                               'advisories': 'advisories',
                               'bam': 'bam',
                               'fbpsnews': 'fbpsnews',
                               'solutions': 'solutions'
                             };
                             return options[camp.cmsId || ''] || 'No CMS ID';
                           })()}
                         </div>
                         <select
                           value={camp.cmsId || ''}
                           onChange={async (e) => {
                             const newId = e.target.value || null;
                             const updatedCampaigns = campaigns.map(c => 
                               c.id === camp.id ? { ...c, cmsId: newId as any } : c
                             );
                             setCampaigns(updatedCampaigns);
                             try {
                               await updateCampaign(camp.id, { cmsId: newId as any });
                             } catch (err) {
                               console.error('Failed to update CMS ID', err);
                               showAlert('Update Failed', 'Unable to update CMS ID.', 'error');
                             }
                           }}
                           className="absolute inset-0 w-full h-full px-2 pr-8 py-1 rounded border border-slate-300 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer hover:bg-slate-50 bg-white shadow-sm transition-all"
                         >
                           <option value="">No CMS ID</option>
                           <option value="advisories">advisories</option>
                           <option value="bam">bam</option>
                           <option value="fbpsnews">fbpsnews</option>
                           <option value="solutions">solutions</option>
                         </select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                    <Briefcase size={14} />
                    <span>{camp.clientName}</span>
                    <span className="mx-1">•</span>
                    <span>Created {camp.createdAt.toLocaleDateString()}</span>
                  </div>
                  {camp.strategyGoals && (
                    <p className="text-sm text-slate-600 italic line-clamp-1 max-w-2xl">"{camp.strategyGoals}"</p>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                   <div className="text-right">
                      <p className="text-xs text-slate-400 font-medium uppercase">Production</p>
                      <p className="text-lg font-semibold text-slate-700">{activeCount} Articles</p>
                   </div>
                   
                   {/* Campaign Review Link Button */}
                   <button
                     onClick={(e) => handleCopyCampaignLink(e, camp.id)}
                     className="relative p-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"
                     title="Copy client review link"
                   >
                     {copyToast.show && copyToast.campaignId === camp.id ? (
                       <CheckCircle size={18} className="text-green-500" />
                     ) : (
                       <Link2 size={18} />
                     )}
                     {copyToast.show && copyToast.campaignId === camp.id && (
                       <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                         Link copied!
                       </span>
                     )}
                   </button>

                   <button
                     onClick={(e) => handleListDeleteCampaign(e, camp)}
                     className="p-2 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all"
                     title="Delete Campaign"
                   >
                     <Trash2 size={18} />
                   </button>
                   
                   <ArrowRight className="text-slate-300 group-hover:text-indigo-600 transition" size={20} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Setup New Campaign</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name</label>
                  <input 
                    type="text" 
                    value={campName}
                    onChange={(e) => setCampName(e.target.value)}
                    placeholder="e.g. Tax Season 2024"
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                </div>
                
                {/* Client Multi-Select Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                  
                  {/* Dropdown Trigger & Display */}
                  <div 
                    onClick={() => setIsClientDropdownOpen(true)}
                    className="w-full min-h-[42px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 cursor-pointer flex flex-wrap items-center gap-1.5"
                  >
                    {selectedClients.map((client) => (
                      <span key={client.id} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                        {client.name}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleToggleClient(client); }}
                          className="hover:text-indigo-900 rounded-full"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    
                    {selectedClients.length === 0 && (
                      <span className="text-slate-400 text-sm py-1">
                        {availableClients.length === 0 ? 'Please add clients in Clients page' : 'Select Client(s)...'}
                      </span>
                    )}

                    <div className="flex-1 text-right ml-auto">
                       <ChevronDown size={16} className="text-slate-400 inline-block" />
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  {isClientDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      {/* Search Bar */}
                      <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            autoFocus
                            value={clientSearchTerm}
                            onChange={(e) => setClientSearchTerm(e.target.value)}
                            placeholder="Search clients..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* List */}
                      <div className="max-h-48 overflow-y-auto">
                        {filteredClients.length === 0 && clientSearchTerm && (
                           <div className="px-4 py-3 text-sm text-slate-400 text-center italic border-t border-slate-100">
                             Client not found.
                           </div>
                        )}
                        
                        {filteredClients.map(client => {
                          const isSelected = selectedClients.some(c => c.id === client.id);
                          return (
                            <div 
                              key={client.id}
                              onClick={() => handleToggleClient(client)}
                              className={`px-4 py-2.5 text-sm flex items-center justify-between cursor-pointer transition group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                   {isSelected && <Check size={10} className="text-white" />}
                                </div>
                                {client.name}
                              </div>
                              <button 
                                onClick={(e) => handleDeleteClient(e, client.id)}
                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                                title="Delete Client"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                        
                        {filteredClients.length === 0 && !clientSearchTerm && availableClients.length === 0 && (
                          <div className="px-4 py-3 text-sm text-center">
                            <div className="text-slate-500 mb-2 font-medium">No clients in database yet</div>
                            <div className="text-slate-400 text-xs">
                              Please create clients in "Clients" page first before creating a Campaign.
                            </div>
                          </div>
                        )}
                        
                        {filteredClients.length === 0 && !clientSearchTerm && availableClients.length > 0 && (
                          <div className="px-4 py-3 text-sm text-slate-400 text-center italic">
                            No clients found.
                          </div>
                        )}
                      </div>
                      
                      {/* Footer Actions */}
                      {!clientSearchTerm && (
                        <div className="bg-slate-50 p-2 border-t border-slate-100">
                           <button 
                             onClick={() => {/* Redirect logic would go here, simplified to focus input for now */}}
                             className="w-full py-1.5 text-xs text-slate-500 font-medium hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition"
                           >
                             Manage Clients
                           </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Target size={14} /> Strategy Goals
                  </div>
                </label>
                <textarea 
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  placeholder="What is the primary objective? e.g. 'Establish authority in crypto compliance'"
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Users size={14} /> Target Audience
                  </div>
                </label>
                <input 
                  type="text" 
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. Small Business Owners, CFOs"
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {isAdminUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CMS ID
                  </label>
                  <select
                    value={cmsId}
                    onChange={(e) => setCmsId(e.target.value)}
                    className="w-full px-4 pr-10 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Select CMS ID...</option>
                    <option value="advisories">advisories</option>
                    <option value="bam">bam</option>
                    <option value="fbpsnews">fbpsnews</option>
                    <option value="solutions">solutions</option>
                  </select>
                </div>
              )}

            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateCampaign}
                disabled={!campName}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:shadow-none transition flex items-center gap-2"
              >
                <Plus size={18} />
                Start Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {isEditModalOpen && editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Edit Campaign</h3>
              <button 
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div 
              className="p-6 space-y-5 max-h-[75vh] overflow-y-auto"
              onClick={() => setIsEditClientDropdownOpen(false)}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name</label>
                  <input 
                    type="text" 
                    value={editCampName}
                    onChange={(e) => setEditCampName(e.target.value)}
                    placeholder="e.g. Tax Season 2024"
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                </div>
                
                {/* Client Multi-Select Dropdown for Edit */}
                <div className="relative" ref={editDropdownRef} onClick={(e) => e.stopPropagation()}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                  
                  <div 
                    onClick={() => setIsEditClientDropdownOpen(!isEditClientDropdownOpen)}
                    className="w-full min-h-[42px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 cursor-pointer flex flex-wrap items-center gap-1.5"
                  >
                    {editSelectedClients.map((client) => (
                      <span key={client.id} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                        {client.name}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditToggleClient(client); }}
                          className="hover:text-indigo-900 rounded-full"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    
                    {editSelectedClients.length === 0 && (
                      <span className="text-slate-400 text-sm py-1">
                        {availableClients.length === 0 ? 'Please add clients in Clients page' : 'Select Client(s)...'}
                      </span>
                    )}

                    <div className="flex-1 text-right ml-auto">
                       <ChevronDown size={16} className="text-slate-400 inline-block" />
                    </div>
                  </div>

                  {isEditClientDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            autoFocus
                            value={editClientSearchTerm}
                            onChange={(e) => setEditClientSearchTerm(e.target.value)}
                            placeholder="Search clients..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        {filteredEditClients.length === 0 && editClientSearchTerm && (
                           <div className="px-4 py-3 text-sm text-slate-400 text-center italic border-t border-slate-100">
                             Client not found.
                           </div>
                        )}
                        
                        {filteredEditClients.map(client => {
                          const isSelected = editSelectedClients.some(c => c.id === client.id);
                          return (
                            <div 
                              key={client.id}
                              onClick={() => handleEditToggleClient(client)}
                              className={`px-4 py-2.5 text-sm flex items-center justify-between cursor-pointer transition group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                   {isSelected && <Check size={10} className="text-white" />}
                                </div>
                                {client.name}
                              </div>
                            </div>
                          );
                        })}
                        
                        {filteredEditClients.length === 0 && !editClientSearchTerm && availableClients.length === 0 && (
                          <div className="px-4 py-3 text-sm text-center">
                            <div className="text-slate-500 mb-2 font-medium">No clients in database yet</div>
                            <div className="text-slate-400 text-xs">
                              Please create clients in "Clients" page first.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Target size={14} /> Strategy Goals
                  </div>
                </label>
                <textarea 
                  value={editStrategy}
                  onChange={(e) => setEditStrategy(e.target.value)}
                  placeholder="What is the primary objective? e.g. 'Establish authority in crypto compliance'"
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Users size={14} /> Target Audience
                  </div>
                </label>
                <input 
                  type="text" 
                  value={editAudience}
                  onChange={(e) => setEditAudience(e.target.value)}
                  placeholder="e.g. Small Business Owners, CFOs"
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {isAdminUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CMS ID
                  </label>
                  <select
                    value={editCmsId}
                    onChange={(e) => setEditCmsId(e.target.value)}
                    className="w-full px-4 pr-10 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Select CMS ID...</option>
                    <option value="advisories">advisories</option>
                    <option value="bam">bam</option>
                    <option value="fbpsnews">fbpsnews</option>
                    <option value="solution">solution</option>
                  </select>
                </div>
              )}

            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              {/* Cancel and Save on the right */}
                <button 
                  onClick={closeEditModal}
                  disabled={isSavingEdit || isDeletingCampaign}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  disabled={!editCampName || editSelectedClients.length === 0 || isSavingEdit || isDeletingCampaign}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:shadow-none transition flex items-center gap-2"
                >
                  {isSavingEdit ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                  ) : (
                    <Check size={18} />
                  )}
                  Save
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        type={alertModal.type}
        size="sm"
        footer={
          <button
            onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            OK
          </button>
        }
      >
        <p>{alertModal.message}</p>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        type={confirmModal.type}
        size="sm"
        closeOnOutsideClick={false}
        footer={
          <>
            <button
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal({ ...confirmModal, isOpen: false });
              }}
              className={`px-4 py-2 font-medium rounded-lg transition ${
                confirmModal.type === 'error' 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              OK
            </button>
          </>
        }
      >
        <p>{confirmModal.message}</p>
      </Modal>
    </div>
  );
};

export default Dashboard;
