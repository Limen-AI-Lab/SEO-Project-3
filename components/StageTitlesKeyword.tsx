import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Article, Campaign, ARTICLE_STATUS } from '../types';
import { generateKeywordDrivenTitles, BlogTopicIdea } from '../services/geminiService';
import { Sparkles, Send, Trash2, Plus, ChevronDown, ChevronUp, Settings, Check } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  project: Article;
  campaign?: Campaign;
  keyword: string;
  language: string;  // From KeywordDiscovery (Figure 1)
  topicIdeas: BlogTopicIdea[];  // 10 topic ideas from AI
  onUpdate: (updates: Partial<Article>) => void;
  onBack: () => void;  // Go back to KeywordDiscovery step 1
}

const StageTitlesKeyword: React.FC<Props> = ({ 
  project, 
  campaign, 
  keyword, 
  language, 
  topicIdeas, 
  onUpdate,
  onBack
}) => {
  const { showToast } = useToast();
  const { t } = useTranslation(['article', 'common']);
  
  // Selected topic idea (one of the 10)
  const [selectedTopicIndex, setSelectedTopicIndex] = useState<number | null>(null);
  
  // Generated titles
  const [titles, setTitles] = useState<string[]>(
    project.proposedTitles.length > 0 ? project.proposedTitles : []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Configuration panel
  const [showConfig, setShowConfig] = useState(true);
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [rules, setRules] = useState('');

  // Pre-fill from Campaign Context
  React.useEffect(() => {
    if (campaign) {
      if (!audience && campaign.targetAudience) {
        setAudience(campaign.targetAudience);
      }
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

  const handleGenerateAI = async () => {
    if (selectedTopicIndex === null) {
      showToast(t('toasts.selectTopicFirst'), 'warning');
      return;
    }

    const selectedTopic = topicIdeas[selectedTopicIndex];
    
    setIsGenerating(true);
    
    const generated = await generateKeywordDrivenTitles({
      keyword,
      selectedTopicIdea: selectedTopic,
      targetAudience: audience || 'General Audience',
      tone,
      rules: rules || undefined,
      language
    });

    if (generated.length > 0) {
      setTitles(generated);
    } else {
      showToast(t('toasts.generateFailed'), 'error');
    }
    setIsGenerating(false);
  };

  const handleSaveDraft = () => {
    onUpdate({ 
      proposedTitles: titles.filter(title => title.trim() !== ''),
      language: language,
      tone: tone
    });
    showToast(t('toasts.draftSaved'), 'success');
  };

  const handleSubmit = async () => {
    const validTitles = titles.filter(title => title.trim() !== '');
    if (validTitles.length === 0) {
      showToast(t('toasts.addAtLeastOneTitle'), 'warning');
      return;
    }
    
    onUpdate({ 
      proposedTitles: validTitles,
      language: language,
      tone: tone,
      status: ARTICLE_STATUS.AWAITING_REVIEW_TITLES
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('keywordDriven.pageTitle')}</h2>
          <p className="text-slate-500 mt-1">
            {t('keywordDriven.pageSubtitle', { keyword })}
          </p>
        </div>
        <button 
          onClick={onBack}
          className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition"
        >
          {t('keywordDriven.backToKeyword')}
        </button>
      </div>

      {/* Topic Ideas Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600" />
            {t('keywordDriven.recommendedTopics')}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {t('keywordDriven.selectTopicHint')}
          </p>
        </div>
        
        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
          {topicIdeas.map((idea, index) => (
            <button
              key={index}
              onClick={() => setSelectedTopicIndex(index)}
              className={`
                w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200
                ${selectedTopicIndex === index 
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm' 
                  : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {t('keywordDriven.writeABlogPost', { type: idea.type, topic: idea.topic })}
                </div>
                {selectedTopicIndex === index && (
                  <div className="ml-3 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
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
            {t('keywordDriven.titleGenSettings')}
          </div>
          {showConfig ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        
        {showConfig && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* Keyword Display (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('keywordDriven.primaryKeyword')}</label>
              <div className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                {keyword}
              </div>
            </div>

            {/* Language Display (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('titles.targetLanguage')}</label>
              <div className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                {language}
              </div>
            </div>

            {/* Target Audience */}
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

            {/* Tone of Voice */}
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

            {/* Strict Content Rules */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('titles.strictRules')} <span className="text-xs text-slate-400 font-normal">{t('titles.optional')}</span>
              </label>
              <textarea 
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                placeholder={t('titles.rulesPlaceholder')}
              />
            </div>

            {/* Generate Button */}
            <div className="md:col-span-2 flex justify-end">
              <button 
                onClick={handleGenerateAI}
                disabled={isGenerating || selectedTopicIndex === null}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-lg shadow transition font-medium
                  ${selectedTopicIndex !== null && !isGenerating
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
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
        
        {titles.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t('keywordDriven.selectTopicPrompt')}</p>
          </div>
        ) : (
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
        )}

        {titles.length > 0 && (
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
        )}
      </div>
    </div>
  );
};

export default StageTitlesKeyword;

