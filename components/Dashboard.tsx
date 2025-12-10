
import React, { useState, useEffect, useRef } from 'react';
import { Campaign, Article, Client } from '../types';
import { getCampaigns, createCampaign, getArticlesByCampaign, getClients, addClient, deleteClient } from '../services/store';
import { generateCampaignKeywords } from '../services/geminiService';
import supabase from '../services/supabaseClient.js';
import CircularProgress from './CircularProgress';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowRight, Plus, Search, X, Briefcase, Target, Users, Sparkles, Tag, ChevronDown, Check, Trash2 } from 'lucide-react';

interface Props {
  onSelectCampaign: (id: string) => void;
}

const Dashboard: React.FC<Props> = ({ onSelectCampaign }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Campaign Form State
  const [campName, setCampName] = useState('');
  
  // Client Management State
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const [strategy, setStrategy] = useState('');
  const [audience, setAudience] = useState('');
  
  // Keyword Module State
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch campaigns
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*, clients(name)')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching campaigns:', error);
        } else if (data) {
          // Map database fields to Campaign interface
          const mappedCampaigns: Campaign[] = data.map((camp: any) => ({
            id: camp.id,
            name: camp.name,
            clientName: camp.clients?.name || '',
            strategyGoals: camp.strategy_goals || '',
            targetAudience: '', // Not in DB schema yet
            keywords: [], // Not in DB schema yet
            createdAt: new Date(camp.created_at),
            status: 'ACTIVE' as const // Default status
          }));
          setCampaigns(mappedCampaigns);
        }
      } catch (err) {
        console.error('Unexpected error fetching campaigns:', err);
      }

      // Fetch clients from Supabase
      try {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });

        if (clientsError) {
          console.error('Error fetching clients:', clientsError);
          // Fallback to local clients if Supabase fails
          setAvailableClients(getClients());
        } else if (clientsData) {
          // Map database fields to Client interface
          const mappedClients: Client[] = clientsData.map((client: any) => ({
            id: client.id,
            name: client.name,
            defaultTone: client.tone_of_voice || undefined,
            defaultRules: client.strict_rules || undefined
          }));
          setAvailableClients(mappedClients);
        } else {
          // No clients in database, use empty array
          setAvailableClients([]);
        }
      } catch (err) {
        console.error('Unexpected error fetching clients:', err);
        // Fallback to local clients on error
        setAvailableClients(getClients());
      }
    };

    fetchData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateCampaign = async () => {
    if (!campName || selectedClients.length === 0) return;
    
    try {
      // Use the first selected client's ID for the database (schema uses single client_id FK)
      const clientId = selectedClients[0].id;
      
      // Validate client_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clientId)) {
        alert(`错误：选中的客户 ID 格式无效。请确保客户数据已同步到数据库。\n\n当前 ID: ${clientId}\n\n请先在"Clients"页面创建客户。`);
        console.error('Invalid client_id format:', clientId);
        return;
      }

      // Verify client exists in database
      const { data: clientCheck, error: clientCheckError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .single();

      if (clientCheckError || !clientCheck) {
        alert(`错误：选中的客户在数据库中不存在。\n\n请先在"Clients"页面创建客户，然后重试。\n\n错误详情: ${clientCheckError?.message || 'Client not found'}`);
        console.error('Client not found in database:', clientId, clientCheckError);
        return;
      }
      
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          client_id: clientId,
          name: campName,
          strategy_goals: strategy || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating campaign:', error);
        
        // Provide more specific error messages
        let errorMessage = '创建 Campaign 失败。';
        if (error.code === '23503') {
          errorMessage = '错误：外键约束失败。选中的客户可能不存在于数据库中。\n\n请先在"Clients"页面创建客户。';
        } else if (error.code === '23505') {
          errorMessage = '错误：Campaign 名称已存在。请使用不同的名称。';
        } else if (error.message) {
          errorMessage = `错误：${error.message}`;
        }
        
        alert(errorMessage);
        return;
      }

      if (data) {
        // Refetch campaigns from Supabase
        const { data: campaignsData, error: fetchError } = await supabase
          .from('campaigns')
          .select('*, clients(name)')
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching campaigns after create:', fetchError);
        } else if (campaignsData) {
          const mappedCampaigns: Campaign[] = campaignsData.map((camp: any) => ({
            id: camp.id,
            name: camp.name,
            clientName: camp.clients?.name || '',
            strategyGoals: camp.strategy_goals || '',
            targetAudience: '',
            keywords: [],
            createdAt: new Date(camp.created_at),
            status: 'ACTIVE' as const
          }));
          setCampaigns(mappedCampaigns);
        }

        setIsModalOpen(false);
        resetForm();
        onSelectCampaign(data.id);
      }
    } catch (err) {
      console.error('Unexpected error creating campaign:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}\n\n请检查控制台获取更多信息。`);
    }
  };

  const resetForm = () => {
    setCampName('');
    setSelectedClients([]);
    setClientSearchTerm('');
    setStrategy('');
    setAudience('');
    setKeywords([]);
    setKeywordInput('');
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
      alert("Please fill in the Campaign Name and Strategy Goals first so the AI has context.");
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
    if(confirm("Are you sure you want to delete this client?")) {
      deleteClient(id);
      setAvailableClients(getClients());
      setSelectedClients(selectedClients.filter(c => c.id !== id));
    }
  };

  // Filter clients for dropdown
  const filteredClients = availableClients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // Stats Calculation
  const totalCampaigns = campaigns.length;
  // This is a bit inefficient for large datasets but fine for mock
  const allArticles = campaigns.flatMap(c => getArticlesByCampaign(c.id));
  const activeArticles = allArticles.filter(a => !a.status.includes('PUBLISHED')).length;
  const publishedArticles = allArticles.filter(a => a.status.includes('PUBLISHED')).length;

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
             <p className="text-3xl font-bold text-slate-900 mt-1">{activeArticles}</p>
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
            const campArticles = getArticlesByCampaign(camp.id);
            const activeCount = campArticles.filter(a => !a.status.includes('PUBLISHED')).length;
            
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
                
                <div className="flex items-center gap-8">
                   <div className="text-right">
                      <p className="text-xs text-slate-400 font-medium uppercase">Production</p>
                      <p className="text-lg font-semibold text-slate-700">{activeCount} Articles</p>
                   </div>
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
                        {availableClients.length === 0 ? '请先在 Clients 页面创建客户' : 'Select Client(s)...'}
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
                            <div className="text-slate-500 mb-2 font-medium">数据库中还没有客户</div>
                            <div className="text-slate-400 text-xs">
                              请先在 "Clients" 页面创建客户，然后才能创建 Campaign。
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

              {/* AI-Powered Keyword Module */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 transition-all">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Tag size={14} className="text-indigo-600" />
                    Seed Keywords
                  </label>
                  
                  <button 
                    onClick={handleGenerateKeywords}
                    disabled={isGeneratingKeywords || (!campName && !strategy)}
                    className="flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-600 hover:text-indigo-700 hover:border-indigo-300 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingKeywords ? (
                      <div className="animate-spin h-3 w-3 border-2 border-indigo-600 rounded-full border-t-transparent"></div>
                    ) : (
                      <Sparkles size={12} fill="currentColor" />
                    )}
                    {isGeneratingKeywords ? 'Analyzing...' : 'Generate via AI'}
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-2 min-h-[80px] flex flex-wrap gap-2 items-start focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition">
                  {keywords.map((kw, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full text-xs font-medium animate-in fade-in zoom-in duration-200">
                      {kw}
                      <button 
                        onClick={() => removeKeyword(idx)}
                        className="hover:text-indigo-900 hover:bg-indigo-200 rounded-full p-0.5 transition"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <input 
                    type="text" 
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleAddKeyword}
                    placeholder={keywords.length === 0 ? "Type keyword & press Enter, or use AI..." : "Add another..."}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-1 px-1 text-slate-700 placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-right">
                  Press <strong>Enter</strong> to add tag. Click <strong>Generate</strong> to auto-fill.
                </p>
              </div>
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
                disabled={!campName || selectedClients.length === 0 || availableClients.length === 0}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:shadow-none transition flex items-center gap-2"
                title={availableClients.length === 0 ? '请先在 Clients 页面创建客户' : ''}
              >
                <Plus size={18} />
                Start Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
