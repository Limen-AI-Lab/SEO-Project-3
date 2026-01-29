import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Campaign, Article, ARTICLE_STATUS, ProjectStatus } from '../types';
import supabase from '../services/supabaseClient.js';
import { ArrowLeft, Home, ChevronRight, MapPin, Globe, HelpCircle, Sparkles, ChevronDown } from 'lucide-react';
import StatusBadge from './StatusBadge';
import StageTitlesKeyword from './StageTitlesKeyword';
import { generateBlogTopicIdeas, BlogTopicIdea } from '../services/geminiService';
import { useToast } from './Toast';

// Country codes list
const COUNTRY_CODES = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE',
  'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'PT', 'IE',
  'NZ', 'SG', 'HK', 'JP', 'KR', 'CN', 'TW', 'IN', 'MY', 'PH',
  'TH', 'VN', 'ID', 'BR', 'MX', 'AR', 'CL', 'CO', 'ZA', 'AE',
  'SA', 'IL', 'TR', 'RU', 'UA'
];

// Language codes list
const LANGUAGE_CODES = [
  'en', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ja',
  'ko', 'ar', 'hi', 'bn', 'pl', 'tr', 'vi', 'th', 'sv', 'da',
  'fi', 'no', 'cs', 'el', 'he', 'hu', 'id', 'ms', 'ro', 'sk',
  'uk', 'bg'
];

// Search pages options
const SEARCH_PAGE_VALUES = [1, 2, 3, 5];

// Time range options
const TIME_RANGE_VALUES = ['any', 'hour', 'day', 'week', 'month', 'year'];

interface Props {
  campaignId: string;
  articleId?: string;  // Optional: if provided, load existing article in edit mode
  onBack: () => void;
}

// Custom searchable dropdown component
const SearchableDropdown: React.FC<{
  options: { code?: string; value?: string | number; name?: string; label?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  searchable?: boolean;
  noResultsText?: string;
}> = ({ options, value, onChange, placeholder, icon, searchable = true, noResultsText = 'No results found' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(
    opt => (opt.code || opt.value?.toString()) === value
  );
  const displayValue = selectedOption?.name || selectedOption?.label || placeholder || '';

  const filteredOptions = searchable && search
    ? options.filter(opt => 
        (opt.name || opt.label || '').toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition"
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        {searchable && isOpen ? (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={displayValue}
            className="flex-1 outline-none text-sm bg-transparent"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm text-slate-700">{displayValue}</span>
        )}
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">{noResultsText}</div>
          ) : (
            filteredOptions.map((opt) => {
              const optValue = opt.code || opt.value?.toString() || '';
              const optLabel = opt.name || opt.label || '';
              return (
                <div
                  key={optValue}
                  onClick={() => {
                    onChange(optValue);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 transition ${
                    optValue === value ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-700'
                  }`}
                >
                  {optLabel}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// Simple dropdown component (non-searchable)
const SimpleDropdown: React.FC<{
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value.toString() === value.toString());
  const displayValue = selectedOption?.label || placeholder || '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition"
      >
        <span className="text-sm text-slate-700">{displayValue}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value.toString());
                setIsOpen(false);
              }}
              className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 transition ${
                opt.value.toString() === value.toString() ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-700'
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const KeywordDiscovery: React.FC<Props> = ({ campaignId, articleId, onBack }) => {
  const { showToast } = useToast();
  const { t } = useTranslation(['campaign', 'common']);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate translated options for dropdowns
  const COUNTRIES = COUNTRY_CODES.map(code => ({
    code,
    name: t(`countries.${code}`)
  }));

  const LANGUAGES = LANGUAGE_CODES.map(code => ({
    code,
    name: t(`languages.${code}`)
  }));

  const SEARCH_PAGES = SEARCH_PAGE_VALUES.map(value => ({
    value,
    label: t(`searchPages.${value}`)
  }));

  const TIME_RANGES = TIME_RANGE_VALUES.map(value => ({
    value,
    label: t(`timeRanges.${value}`)
  }));

  // Edit mode: when articleId is provided, we're editing an existing article
  const isEditMode = !!articleId;

  // Step management: 'keyword-input' or 'topic-selection'
  const [currentStep, setCurrentStep] = useState<'keyword-input' | 'topic-selection'>('keyword-input');
  
  // Form state (Step 1)
  const [keyword, setKeyword] = useState('');
  const [targetMarket, setTargetMarket] = useState('US');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [searchPages, setSearchPages] = useState('2');
  const [timeRange, setTimeRange] = useState('any');

  // Step 2 state
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [topicIdeas, setTopicIdeas] = useState<BlogTopicIdea[]>([]);
  const [createdArticle, setCreatedArticle] = useState<Article | null>(null);

  const MAX_KEYWORD_LENGTH = 100;

  // Load campaign data and existing article (if in edit mode)
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch campaign
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();

        if (campaignError) {
          console.error('Error fetching campaign:', campaignError);
          setError(`Failed to load campaign: ${campaignError.message}`);
          setIsLoading(false);
          return;
        }

        if (!campaignData) {
          setError('Campaign not found');
          setIsLoading(false);
          return;
        }

        // Map to Campaign interface
        const mappedCampaign: Campaign = {
          id: campaignData.id,
          name: campaignData.name,
          strategyGoals: campaignData.strategy_goals || '',
          targetAudience: '',
          keywords: [],
          createdAt: new Date(campaignData.created_at),
          status: 'ACTIVE' as const,
        };
        setCampaign(mappedCampaign);

        // Fetch associated clients through campaign_clients junction table
        const { data: clientAssociations } = await supabase
          .from('campaign_clients')
          .select('clients(id, name)')
          .eq('campaign_id', campaignId);

        if (clientAssociations && clientAssociations.length > 0) {
          // Get the first client's name
          const firstClient = clientAssociations[0] as any;
          if (firstClient?.clients?.name) {
            setClientName(firstClient.clients.name);
          }
        }

        // If in edit mode, load existing article and pre-fill keyword
        if (articleId) {
          const { data: articleData, error: articleError } = await supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single();

          if (articleError) {
            console.error('Error fetching article:', articleError);
            setError(`Failed to load article: ${articleError.message}`);
            setIsLoading(false);
            return;
          }

          if (articleData) {
            // Pre-fill keyword from source_keyword field
            if (articleData.source_keyword) {
              setKeyword(articleData.source_keyword);
            }
            // Pre-fill language if available
            if (articleData.language) {
              // Find language code from language name
              const langCode = LANGUAGES.find(l => l.name === articleData.language)?.code;
              if (langCode) {
                setTargetLanguage(langCode);
              }
            }
          }
        }

      } catch (err) {
        console.error('Unexpected error loading data:', err);
        setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [campaignId, articleId]);

  const handleGenerateIdeas = async () => {
    if (!keyword.trim()) {
      showToast(t('toasts.enterKeyword'), 'warning');
      return;
    }

    setIsGeneratingIdeas(true);

    try {
      // 1. Get target market and language display names
      const marketName = COUNTRIES.find(c => c.code === targetMarket)?.name || targetMarket;
      const languageName = LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;

      // 2. Call Gemini API to generate 10 topic ideas
      const ideas = await generateBlogTopicIdeas({
        keyword: keyword.trim(),
        targetMarket: marketName,
        targetLanguage: languageName
      });

      if (ideas.length === 0) {
        showToast(t('toasts.generateFailed'), 'error');
        setIsGeneratingIdeas(false);
        return;
      }

      setTopicIdeas(ideas);

      let resultArticle: Article;

      if (isEditMode && articleId) {
        // Edit mode: Update existing article with new keyword
        const updateData = {
          title: keyword.trim(),
          source_keyword: keyword.trim(),
          language: languageName,
          last_updated: new Date().toISOString()
        };

        const { data: updatedArticle, error: updateError } = await supabase
          .from('articles')
          .update(updateData)
          .eq('id', articleId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating article:', updateError);
          showToast(`Failed to update article: ${updateError.message}`, 'error');
          setIsGeneratingIdeas(false);
          return;
        }

        // Map to Article interface
        resultArticle = {
          id: updatedArticle.id,
          campaignId: updatedArticle.campaign_id,
          title: updatedArticle.title,
          status: updatedArticle.status as ProjectStatus,
          lastUpdated: new Date(updatedArticle.last_updated),
          proposedTitles: updatedArticle.proposed_titles || [],
          language: updatedArticle.language,
          sourceKeyword: updatedArticle.source_keyword,
          writingPath: updatedArticle.writing_path,
          clientComments: []
        };
      } else {
        // Create mode: Create new Article record in database
        const newArticle = {
          campaign_id: campaignId,
          title: keyword.trim(), // Working title is the keyword
          status: ARTICLE_STATUS.NEEDS_TITLES,
          proposed_titles: [],
          language: languageName,
          writing_path: 'keyword-driven',  // Mark as keyword-driven
          source_keyword: keyword.trim(),   // Save the original keyword
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };

        const { data: insertedArticle, error: insertError } = await supabase
          .from('articles')
          .insert(newArticle)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating article:', insertError);
          showToast(`Failed to create article: ${insertError.message}`, 'error');
          setIsGeneratingIdeas(false);
          return;
        }

        // Map to Article interface
        resultArticle = {
          id: insertedArticle.id,
          campaignId: insertedArticle.campaign_id,
          title: insertedArticle.title,
          status: insertedArticle.status as ProjectStatus,
          lastUpdated: new Date(insertedArticle.last_updated),
          proposedTitles: insertedArticle.proposed_titles || [],
          language: insertedArticle.language,
          sourceKeyword: insertedArticle.source_keyword,
          writingPath: insertedArticle.writing_path,
          clientComments: []
        };
      }

      setCreatedArticle(resultArticle);

      // Switch to Step 2
      setCurrentStep('topic-selection');

    } catch (err) {
      console.error('Unexpected error:', err);
      showToast(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  // Handle article updates from StageTitlesKeyword
  const handleArticleUpdate = async (updates: Partial<Article>) => {
    if (!createdArticle) return;

    try {
      // Map TypeScript fields to database fields
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.status !== undefined) {
        dbUpdates.status = updates.status;
      }
      if (updates.proposedTitles !== undefined) {
        dbUpdates.proposed_titles = updates.proposedTitles;
      }
      if (updates.language !== undefined) {
        dbUpdates.language = updates.language;
      }
      if (updates.tone !== undefined) {
        dbUpdates.tone = updates.tone;
      }

      const { error } = await supabase
        .from('articles')
        .update(dbUpdates)
        .eq('id', createdArticle.id);

      if (error) {
        console.error('Error updating article:', error);
        showToast(`Failed to update: ${error.message}`, 'error');
        return;
      }

      // Update local state
      setCreatedArticle(prev => prev ? { ...prev, ...updates } : null);

      // If status changed to AWAITING_REVIEW_TITLES, navigate back to campaign
      if (updates.status === ARTICLE_STATUS.AWAITING_REVIEW_TITLES) {
        showToast(t('toasts.titlesSubmitted'), 'success');
        onBack();
      }
    } catch (err) {
      console.error('Unexpected error updating article:', err);
      showToast(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  // Handle going back from Step 2 to Step 1
  const handleBackToKeyword = async () => {
    // Only delete the article if it was newly created (not in edit mode)
    // In edit mode, the article already exists and should be preserved
    if (createdArticle && !isEditMode) {
      await supabase
        .from('articles')
        .delete()
        .eq('id', createdArticle.id);
    }
    
    // Reset Step 2 state
    setTopicIdeas([]);
    setCreatedArticle(null);
    setCurrentStep('keyword-input');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">{t('keywordDiscovery.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition">
            <ArrowLeft size={16} />
            <span className="text-sm font-medium">{t('keywordDiscovery.back')}</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
            <p className="text-red-600 font-medium mb-2">{t('keywordDiscovery.failedToLoad')}</p>
            <p className="text-red-500 text-sm mb-4">{error || t('keywordDiscovery.dataNotFound')}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              {t('keywordDiscovery.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get language display name for passing to StageTitlesKeyword
  const languageName = LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;

  // Step 2: Show StageTitlesKeyword component
  if (currentStep === 'topic-selection' && createdArticle && topicIdeas.length > 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-2 flex-shrink-0 z-10">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="hover:text-indigo-600 cursor-pointer flex items-center gap-1">
              <Home size={10} /> {t('keywordDiscovery.breadcrumbHome')}
            </span>
            <ChevronRight size={10} />
            <span className="hover:text-indigo-600 cursor-pointer" onClick={onBack}>{t('keywordDiscovery.breadcrumbCampaigns')}</span>
            <ChevronRight size={10} />
            <span className="hover:text-indigo-600 cursor-pointer font-medium text-slate-700" onClick={onBack}>
              {campaign.name}
            </span>
            <ChevronRight size={10} />
            <span className="text-slate-400">{t('keywordDiscovery.breadcrumbKeywordDrivenWriting')}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBackToKeyword} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">{campaign.name}</h1>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>{clientName || t('keywordDiscovery.noClient')}</span>
                  <span>•</span>
                  <StatusBadge status={ARTICLE_STATUS.NEEDS_TITLES} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - StageTitlesKeyword */}
        <main className="flex-1 overflow-y-auto p-8">
          <StageTitlesKeyword
            project={createdArticle}
            campaign={campaign}
            keyword={keyword}
            language={languageName}
            topicIdeas={topicIdeas}
            onUpdate={handleArticleUpdate}
            onBack={handleBackToKeyword}
          />
        </main>
      </div>
    );
  }

  // Step 1: Keyword Input Form
  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-2 flex-shrink-0 z-10">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <span className="hover:text-indigo-600 cursor-pointer flex items-center gap-1">
            <Home size={10} /> {t('keywordDiscovery.breadcrumbHome')}
          </span>
          <ChevronRight size={10} />
          <span className="hover:text-indigo-600 cursor-pointer" onClick={onBack}>{t('keywordDiscovery.breadcrumbCampaigns')}</span>
          <ChevronRight size={10} />
          <span className="hover:text-indigo-600 cursor-pointer font-medium text-slate-700" onClick={onBack}>
            {campaign.name}
          </span>
          <ChevronRight size={10} />
          <span className="text-slate-400">{t('keywordDiscovery.breadcrumbKeywordDiscovery')}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{campaign.name}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>{clientName || t('keywordDiscovery.noClient')}</span>
                <span>•</span>
                <StatusBadge status={ARTICLE_STATUS.NEEDS_TITLES} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {t('keywordDiscovery.pageTitle')}
            </h2>

            {/* Keyword Input */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
                  <span className="text-red-500">*</span>
                  {t('keywordDiscovery.keywordLabel')}
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <span className="text-sm text-indigo-500 hover:underline cursor-pointer">
                  {t('keywordDiscovery.keywordExample')}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value.slice(0, MAX_KEYWORD_LENGTH))}
                  placeholder={t('keywordDiscovery.keywordPlaceholder')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {keyword.length}/{MAX_KEYWORD_LENGTH}
                </span>
              </div>
            </div>

            {/* Target Market & Language Row */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-2">
                  {t('keywordDiscovery.targetMarket')}
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SearchableDropdown
                  options={COUNTRIES}
                  value={targetMarket}
                  onChange={setTargetMarket}
                  placeholder={t('keywordDiscovery.selectCountry')}
                  icon={<MapPin size={16} />}
                  noResultsText={t('keywordDiscovery.noResultsFound')}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-2">
                  {t('keywordDiscovery.targetLanguage')}
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SearchableDropdown
                  options={LANGUAGES}
                  value={targetLanguage}
                  onChange={setTargetLanguage}
                  placeholder={t('keywordDiscovery.selectLanguage')}
                  icon={<Globe size={16} />}
                  noResultsText={t('keywordDiscovery.noResultsFound')}
                />
              </div>
            </div>

            {/* Search Pages & Time Range Row */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-2">
                  {t('keywordDiscovery.searchPages')}
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SimpleDropdown
                  options={SEARCH_PAGES}
                  value={searchPages}
                  onChange={setSearchPages}
                  placeholder={t('keywordDiscovery.selectPages')}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-2">
                  {t('keywordDiscovery.timeRange')}
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SimpleDropdown
                  options={TIME_RANGES}
                  value={timeRange}
                  onChange={setTimeRange}
                  placeholder={t('keywordDiscovery.selectTimeRange')}
                />
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
              <button
                onClick={handleGenerateIdeas}
                disabled={!keyword.trim() || isGeneratingIdeas}
                className={`
                  flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-white transition shadow-lg
                  ${keyword.trim() && !isGeneratingIdeas
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-indigo-500/25'
                    : 'bg-slate-300 cursor-not-allowed shadow-none'
                  }
                `}
              >
                {isGeneratingIdeas ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    {t('keywordDiscovery.generatingIdeas')}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    {t('keywordDiscovery.generateIdeas')}
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default KeywordDiscovery;

