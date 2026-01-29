import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Article, ProjectStatus, Campaign, ARTICLE_STATUS } from '../types';
import { generateBlogTitles, suggestBlogKeywords, KeywordSuggestion } from '../services/geminiService';
import { Sparkles, Send, Trash2, Plus, ChevronDown, ChevronUp, Settings, Flame, X, Search } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  project: Article;
  campaign?: Campaign; 
  onUpdate: (updates: Partial<Article>) => Promise<void> | void;
}

interface KeywordTag {
  text: string;
  volume: 'High' | 'Medium' | 'Low' | 'Unknown';
}

const StageTitles: React.FC<Props> = ({ project, campaign, onUpdate }) => {
  const { showToast } = useToast();
  const { t } = useTranslation(['article', 'common']);
  const [titles, setTitles] = useState<string[]>(project.proposedTitles.length > 0 ? project.proposedTitles : ['', '', '']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  // Generation Settings State
  const [genTopic, setGenTopic] = useState(project.title);
  const [audience, setAudience] = useState('');
  const [targetCountries, setTargetCountries] = useState('');

  // Keyword State - initialize from saved targetKeywords if available
  const [selectedKeywords, setSelectedKeywords] = useState<KeywordTag[]>(() => {
    if (project.targetKeywords && project.targetKeywords.length > 0) {
      return project.targetKeywords.map(k => ({ text: k, volume: 'Unknown' as const }));
    }
    return [];
  });
  const [manualKeywordInput, setManualKeywordInput] = useState('');
  const [suggestedKeywords, setSuggestedKeywords] = useState<KeywordSuggestion[]>([]);
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);

  const [language, setLanguage] = useState(project.language || t('titles.defaultLanguage'));
  const [tone, setTone] = useState(project.tone || '');
  const [rules, setRules] = useState('');

  // Pre-fill from Campaign Context (only if no saved targetKeywords)
  useEffect(() => {
    if (campaign) {
      if (!audience) setAudience(campaign.targetAudience);
      
      // Initial keyword population: use saved targetKeywords first, then campaign keywords
      if (selectedKeywords.length === 0 && campaign.keywords.length > 0) {
        setSelectedKeywords(campaign.keywords.map(k => ({ text: k, volume: 'Unknown' as const })));
      }
      
      // Append strategy goals to rules if not already present
      if (!rules && campaign.strategyGoals) {
        setRules(`${t('titles.alignWithStrategy')}${campaign.strategyGoals}`);
      }
    }
  }, [campaign]);

  const handleTitleChange = (index: number, value: string) => {
    const newTitles = [...titles];
    newTitles[index] = value;
    setTitles(newTitles);
  };

  const addField = () => setTitles([...titles, '']);
  const removeField = (index: number) => setTitles(titles.filter((_, i) => i !== index));

  // --- Keyword Logic ---
  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = manualKeywordInput.trim();
      if (val && !selectedKeywords.some(k => k.text === val)) {
        setSelectedKeywords([...selectedKeywords, { text: val, volume: 'Unknown' }]);
        setManualKeywordInput('');
      }
    } else if (e.key === 'Backspace' && !manualKeywordInput && selectedKeywords.length > 0) {
      setSelectedKeywords(selectedKeywords.slice(0, -1));
    }
  };

  const removeKeyword = (idx: number) => {
    setSelectedKeywords(selectedKeywords.filter((_, i) => i !== idx));
  };

  const addSuggestion = (s: KeywordSuggestion) => {
    if (!selectedKeywords.some(k => k.text === s.keyword)) {
      setSelectedKeywords([...selectedKeywords, { text: s.keyword, volume: s.volume }]);
    }
    // Remove from suggestions list
    setSuggestedKeywords(suggestedKeywords.filter(k => k.keyword !== s.keyword));
  };

  const handleSuggestKeywords = async () => {
    if (!genTopic) {
      showToast(t('toasts.enterTopicFirst'), 'warning');
      return;
    }
    setIsSuggestingKeywords(true);
    const results = await suggestBlogKeywords(genTopic, audience, campaign?.clientName || 'Client');
    
    // Filter out ones we already have
    const activeTexts = selectedKeywords.map(k => k.text);
    const fresh = results.filter(r => !activeTexts.includes(r.keyword));
    
    setSuggestedKeywords(fresh);
    setIsSuggestingKeywords(false);
  };
  // ---------------------

  const handleGenerateAI = async () => {
    if (!genTopic) {
      showToast(t('toasts.enterTopicFirst'), 'warning');
      return;
    }

    setIsGenerating(true);
    const keywordsString = selectedKeywords.map(k => k.text).join(', ');

    // Collect Client strict_rules from campaign.clients
    const clientRules = campaign?.clients
      ?.map(c => c.defaultRules)
      .filter((r): r is string => !!r && r.trim() !== '')
      .join('\n') || '';
    
    // Combine: Client rules first, then existing rules
    const combinedRules = [clientRules, rules]
      .filter(r => r && r.trim() !== '')
      .join('\n');

    const generated = await generateBlogTitles({
      clientName: campaign?.clientName || "Client",
      topic: genTopic,
      targetAudience: audience || 'General Audience',
      keywords: keywordsString,
      language: language,
      tone: tone,
      rules: combinedRules
    });

    if (generated.length > 0) {
      setTitles(generated);
    }
    setIsGenerating(false);
  };

  const handleSaveDraft = async () => {
    try {
      await onUpdate({ 
        proposedTitles: titles.filter(title => title.trim() !== ''),
        language: language,
        tone: tone,
        targetKeywords: selectedKeywords.map(k => k.text)
      });
      showToast(t('toasts.progressSaved'), 'success');
    } catch (error) {
      console.error('Failed to save titles:', error);
    }
  };

  const handleSubmit = async () => {
    const validTitles = titles.filter(title => title.trim() !== '');
    if (validTitles.length === 0) {
      showToast(t('toasts.addAtLeastOneTitle'), 'warning');
      return;
    }
    
    // Update article status and save language/tone/keywords settings
    onUpdate({ 
      proposedTitles: validTitles,
      language: language,
      tone: tone,
      targetKeywords: selectedKeywords.map(k => k.text),
      status: ARTICLE_STATUS.AWAITING_REVIEW_TITLES // Use new status constant
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-2xl font-bold text-slate-900">{t('titles.stageTitle')}</h2>
           <p className="text-slate-500 mt-1">{t('titles.pageSubtitle')}</p>
        </div>
        <div className="relative group">
          <button 
            disabled
            className="px-4 py-2 bg-slate-100 text-slate-400 font-medium rounded-lg cursor-not-allowed border border-slate-200"
          >
            {t('titles.directGenerate')}
          </button>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
            {t('titles.comingSoon')}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></span>
          </span>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition border-b border-slate-100"
        >
           <div className="flex items-center gap-2 font-semibold text-slate-700">
             <Settings size={18} className="text-indigo-600" />
             {t('titles.aiSettings')}
           </div>
           {showConfig ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        
        {showConfig && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('titles.topicSubject')}</label>
              <input 
                type="text" 
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={t('titles.topicPlaceholder')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('titles.targetAudience')}</label>
              <input 
                type="text" 
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={t('titles.audiencePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('titles.targetCountries')}</label>
              <input 
                type="text" 
                value={targetCountries}
                onChange={(e) => setTargetCountries(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={t('titles.countriesPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('titles.targetLanguage')}</label>
              <div className="relative">
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-slate-700"
                >
                  <option value="English">{t('titles.languageEnglish')}</option>
                  <option value="Chinese">{t('titles.languageChinese')}</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('titles.tone')}</label>
              <input 
                type="text" 
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={t('titles.tonePlaceholder')}
              />
            </div>

            {/* Smart Keyword Researcher */}
            <div className="md:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-700">
                  {t('titles.targetKeywords')}
                </label>
                <button 
                  onClick={handleSuggestKeywords}
                  disabled={isSuggestingKeywords}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-full shadow-sm transition disabled:opacity-50"
                >
                  {isSuggestingKeywords ? (
                    <div className="animate-spin h-3 w-3 border-2 border-indigo-600 rounded-full border-t-transparent"></div>
                  ) : (
                    <Sparkles size={12} fill="currentColor" />
                  )}
                  {isSuggestingKeywords ? t('titles.researching') : t('titles.suggestKeywords')}
                </button>
              </div>

              {/* Tag Input Container */}
              <div 
                className="w-full min-h-[50px] bg-white border border-slate-300 rounded-lg p-2 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition shadow-sm"
                onClick={() => document.getElementById('keyword-input')?.focus()}
              >
                {selectedKeywords.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${tag.volume === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                  >
                    {tag.text}
                    {tag.volume === 'High' && <Flame size={10} className="text-orange-500 fill-orange-500" />}
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeKeyword(idx); }}
                      className="hover:bg-black/5 rounded-full p-0.5 ml-1 transition"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                
                <input 
                  id="keyword-input"
                  type="text" 
                  value={manualKeywordInput}
                  onChange={(e) => setManualKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  className="flex-1 min-w-[150px] outline-none text-sm bg-transparent py-1"
                  placeholder={selectedKeywords.length === 0 ? t('titles.keywordInputPlaceholder') : t('titles.addMorePlaceholder')}
                />
              </div>

              {/* Suggestions Panel */}
              {suggestedKeywords.length > 0 && (
                <div className="mt-3 animate-fade-in">
                  <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1">
                    <Search size={12} /> {t('titles.foundKeywords')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedKeywords.map((s, idx) => (
                      <button 
                        key={idx}
                        onClick={() => addSuggestion(s)}
                        className="group flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-full text-xs text-slate-600 hover:text-indigo-600 transition"
                      >
                        <Plus size={10} className="text-slate-400 group-hover:text-indigo-500" />
                        {s.keyword}
                        {s.volume === 'High' && <Flame size={10} className="text-orange-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('titles.strictRules')} <span className="text-xs text-slate-400 font-normal">{t('titles.optional')}</span></label>
              <textarea 
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                placeholder={t('titles.rulesPlaceholder')}
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
               <button 
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg shadow hover:shadow-md transition disabled:opacity-70 font-medium"
              >
                <Sparkles size={18} />
                {isGenerating ? t('titles.generatingWithGemini') : t('titles.generateWithGemini')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Generated Titles List */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4">{t('titles.proposedTitles')}</h3>
        <div className="space-y-4">
          {titles.map((title, index) => (
            <div key={index} className="flex items-center gap-3 animate-fade-in">
              <span className="text-slate-400 font-mono text-sm w-6 text-right">{index + 1}.</span>
              <input 
                type="text" 
                value={title}
                onChange={(e) => handleTitleChange(index, e.target.value)}
                placeholder={t('titles.titleInputPlaceholder')}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <button onClick={() => removeField(index)} className="text-slate-400 hover:text-red-500 p-2">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          
          <button onClick={addField} className="flex items-center gap-2 text-indigo-600 font-medium px-4 py-2 hover:bg-indigo-50 rounded-lg transition ml-9">
            <Plus size={18} />
            {t('titles.addAnotherTitle')}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex justify-end gap-4">
          <button onClick={handleSaveDraft} className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition">
            {t('titles.saveDraft')}
          </button>
          <button onClick={handleSubmit} className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition flex items-center gap-2 shadow-lg shadow-slate-900/20">
            <Send size={18} />
            {t('titles.submitToClient')}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageTitles;