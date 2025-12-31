import React, { useState, useEffect, useRef } from 'react';
import { Campaign, Client, ARTICLE_STATUS } from '../types';
import supabase from '../services/supabaseClient.js';
import { ArrowLeft, Home, ChevronRight, MapPin, Globe, Search, HelpCircle, Sparkles, ChevronDown } from 'lucide-react';
import StatusBadge from './StatusBadge';

// Standard country list with English names
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'IN', name: 'India' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
];

// Standard language list with English names
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'cs', name: 'Czech' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'ro', name: 'Romanian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'bg', name: 'Bulgarian' },
];

// Search pages options
const SEARCH_PAGES = [
  { value: 1, label: '1 Page' },
  { value: 2, label: '2 Pages' },
  { value: 3, label: '3 Pages' },
  { value: 5, label: '5 Pages' },
];

// Time range options
const TIME_RANGES = [
  { value: 'any', label: 'Any Time' },
  { value: 'hour', label: 'Past Hour' },
  { value: 'day', label: 'Past 24 Hours' },
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
  { value: 'year', label: 'Past Year' },
];

interface Props {
  campaignId: string;
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
}> = ({ options, value, onChange, placeholder, icon, searchable = true }) => {
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
            <div className="px-4 py-3 text-sm text-slate-400">No results found</div>
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

const KeywordDiscovery: React.FC<Props> = ({ campaignId, onBack }) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [keyword, setKeyword] = useState('');
  const [targetMarket, setTargetMarket] = useState('US');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [searchPages, setSearchPages] = useState('2');
  const [timeRange, setTimeRange] = useState('any');

  const MAX_KEYWORD_LENGTH = 100;

  // Load campaign data
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

      } catch (err) {
        console.error('Unexpected error loading data:', err);
        setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [campaignId]);

  const handleGenerateIdeas = () => {
    // Placeholder - functionality to be added later
    console.log('Generate Ideas clicked', {
      keyword,
      targetMarket,
      targetLanguage,
      searchPages,
      timeRange,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
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
            <span className="text-sm font-medium">Back</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
            <p className="text-red-600 font-medium mb-2">Failed to load</p>
            <p className="text-red-500 text-sm mb-4">{error || 'Data not found'}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-2 flex-shrink-0 z-10">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <span className="hover:text-indigo-600 cursor-pointer flex items-center gap-1">
            <Home size={10} /> Home
          </span>
          <ChevronRight size={10} />
          <span className="hover:text-indigo-600 cursor-pointer" onClick={onBack}>Campaigns</span>
          <ChevronRight size={10} />
          <span className="hover:text-indigo-600 cursor-pointer font-medium text-slate-700" onClick={onBack}>
            {campaign.name}
          </span>
          <ChevronRight size={10} />
          <span className="text-slate-400">Keyword Discovery</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{campaign.name}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>{clientName || 'No client'}</span>
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
              Enter a Keyword to Discover Ideas
            </h2>

            {/* Keyword Input */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
                  <span className="text-red-500">*</span>
                  A Keyword
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <span className="text-sm text-indigo-500 hover:underline cursor-pointer">
                  Example: AI SEO tool
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value.slice(0, MAX_KEYWORD_LENGTH))}
                  placeholder="Enter a primary keyword or long-tail keyword"
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
                  Target Market
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SearchableDropdown
                  options={COUNTRIES}
                  value={targetMarket}
                  onChange={setTargetMarket}
                  placeholder="Select country"
                  icon={<MapPin size={16} />}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-2">
                  Target Language
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SearchableDropdown
                  options={LANGUAGES}
                  value={targetLanguage}
                  onChange={setTargetLanguage}
                  placeholder="Select language"
                  icon={<Globe size={16} />}
                />
              </div>
            </div>

            {/* Search Pages & Time Range Row */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-2">
                  Search Pages
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SimpleDropdown
                  options={SEARCH_PAGES}
                  value={searchPages}
                  onChange={setSearchPages}
                  placeholder="Select pages"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-2">
                  Time Range
                  <HelpCircle size={14} className="text-slate-400 cursor-help" />
                </label>
                <SimpleDropdown
                  options={TIME_RANGES}
                  value={timeRange}
                  onChange={setTimeRange}
                  placeholder="Select time range"
                />
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
              <button
                onClick={handleGenerateIdeas}
                disabled={!keyword.trim()}
                className={`
                  flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-white transition shadow-lg
                  ${keyword.trim()
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-indigo-500/25'
                    : 'bg-slate-300 cursor-not-allowed shadow-none'
                  }
                `}
              >
                <Sparkles size={18} />
                Generate Ideas
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default KeywordDiscovery;

