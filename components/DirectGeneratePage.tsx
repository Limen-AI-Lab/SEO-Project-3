import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Check, X, AlertCircle, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { Article, ArticlePerspective, ARTICLE_STATUS, WORD_COUNT_LIMITS, HEADING_COUNT_LIMITS } from '../types';
import { generateBlogOutline, generateBlogDraft } from '../services/geminiService';
import supabase from '../services/supabaseClient.js';
import { useToast } from './Toast';

interface TitleConfig {
  id: string;
  title: string;
  selected: boolean;
  wordCountMin: number;
  wordCountMax: number;
  h2Count: number;
  h3Count: number;
  perspective: ArticlePerspective;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  generatedArticleId?: string;
}

interface Props {
  articleId: string;
  onBack: () => void;
  onComplete: () => void; // Called when generation is done, to navigate to campaign
}

const DirectGeneratePage: React.FC<Props> = ({ articleId, onBack, onComplete }) => {
  const { t } = useTranslation(['article', 'common']);
  const { showToast } = useToast();
  
  // Original article data
  const [originalArticle, setOriginalArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Title configurations
  const [titleConfigs, setTitleConfigs] = useState<TitleConfig[]>([]);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState(-1);
  const [currentStep, setCurrentStep] = useState<'idle' | 'outline' | 'draft'>('idle');
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Load original article data
  useEffect(() => {
    loadArticle();
  }, [articleId]);

  const loadArticle = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();

      if (error) throw error;

      const article: Article = {
        id: data.id,
        campaignId: data.campaign_id,
        title: data.title,
        status: data.status,
        lastUpdated: new Date(data.last_updated),
        proposedTitles: data.proposed_titles || [],
        language: data.language,
        tone: data.tone,
        targetKeywords: data.target_keywords || [],
        clientComments: [],
      };

      setOriginalArticle(article);

      // Initialize title configs from proposed titles
      const configs: TitleConfig[] = article.proposedTitles
        .filter(t => t && t.trim())
        .map((title, index) => ({
          id: `title-${index}-${Date.now()}`,
          title,
          selected: true,
          wordCountMin: 1000,
          wordCountMax: 2000,
          h2Count: 5,
          h3Count: 0,
          perspective: 'third' as ArticlePerspective,
          status: 'pending',
        }));

      setTitleConfigs(configs);
    } catch (err) {
      console.error('Failed to load article:', err);
      showToast('Failed to load article', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle title selection
  const toggleSelection = (id: string) => {
    setTitleConfigs(prev =>
      prev.map(config =>
        config.id === id ? { ...config, selected: !config.selected } : config
      )
    );
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    const allSelected = titleConfigs.every(c => c.selected);
    setTitleConfigs(prev =>
      prev.map(config => ({ ...config, selected: !allSelected }))
    );
  };

  // Update title config
  const updateConfig = (id: string, updates: Partial<TitleConfig>) => {
    setTitleConfigs(prev =>
      prev.map(config =>
        config.id === id ? { ...config, ...updates } : config
      )
    );
  };

  // Add new title
  const addTitle = () => {
    const newConfig: TitleConfig = {
      id: `title-new-${Date.now()}`,
      title: '',
      selected: true,
      wordCountMin: 1000,
      wordCountMax: 2000,
      h2Count: 5,
      h3Count: 0,
      perspective: 'third',
      status: 'pending',
    };
    setTitleConfigs(prev => [...prev, newConfig]);
  };

  // Remove title
  const removeTitle = (id: string) => {
    setTitleConfigs(prev => prev.filter(config => config.id !== id));
  };

  // Retry failed generation
  const retryFailed = (id: string) => {
    updateConfig(id, { status: 'pending', error: undefined });
  };

  // Get selected titles count
  const selectedCount = titleConfigs.filter(c => c.selected && c.title.trim()).length;

  // Generate articles
  const handleGenerate = async () => {
    const selectedConfigs = titleConfigs.filter(c => c.selected && c.title.trim());
    
    if (selectedConfigs.length === 0) {
      showToast(t('directGenerate.noTitleSelected'), 'warning');
      return;
    }

    setIsGenerating(true);
    setCompletedCount(0);
    setFailedCount(0);

    // Process each title sequentially
    for (let i = 0; i < selectedConfigs.length; i++) {
      const config = selectedConfigs[i];
      setCurrentGeneratingIndex(titleConfigs.findIndex(c => c.id === config.id));
      
      // Update status to generating
      updateConfig(config.id, { status: 'generating' });

      try {
        // Step 1: Generate outline structure
        setCurrentStep('outline');
        const outlineResult = await generateBlogOutline({
          selectedTitle: config.title,
          language: originalArticle?.language || 'English',
          perspective: config.perspective,
          wordCountMin: config.wordCountMin,
          wordCountMax: config.wordCountMax,
          h2Count: config.h2Count,
          h3Count: config.h3Count,
        });

        if (!outlineResult.content) {
          throw new Error('Failed to generate outline structure');
        }

        // Step 2: Generate draft content
        setCurrentStep('draft');
        const draftResult = await generateBlogDraft({
          title: config.title,
          outline: outlineResult.content,
          comments: [],
          clientName: '',
          wordCountMin: config.wordCountMin,
          wordCountMax: config.wordCountMax,
          perspective: config.perspective,
          language: originalArticle?.language || 'English',
          tone: originalArticle?.tone,
          keywords: originalArticle?.targetKeywords,
        });

        if (!draftResult.content) {
          throw new Error('Failed to generate draft content');
        }

        // Create new article in database
        // Status is OUTLINE_APPROVED so user can see draft and submit for review
        const { data: newArticle, error: insertError } = await supabase
          .from('articles')
          .insert({
            campaign_id: originalArticle?.campaignId,
            title: config.title,
            selected_title: config.title,
            status: ARTICLE_STATUS.OUTLINE_APPROVED,
            language: originalArticle?.language,
            tone: originalArticle?.tone,
            target_keywords: originalArticle?.targetKeywords || [],
            word_count_min: config.wordCountMin,
            word_count_max: config.wordCountMax,
            h2_count: config.h2Count,
            h3_count: config.h3Count,
            perspective: config.perspective,
            draft_content: draftResult.content,
            writing_path: 'direct-generate',
            generation_count: 1,
            proposed_titles: [],
            outline_content: null,
            outline_sections: null,
            draft_blocks: null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        updateConfig(config.id, { 
          status: 'completed', 
          generatedArticleId: newArticle.id 
        });
        setCompletedCount(prev => prev + 1);

      } catch (err) {
        console.error(`Failed to generate article for "${config.title}":`, err);
        updateConfig(config.id, { 
          status: 'failed', 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
        setFailedCount(prev => prev + 1);
      }
    }

    setCurrentStep('idle');
    setCurrentGeneratingIndex(-1);
    setIsGenerating(false);

    // Delete original article if at least one succeeded
    const successCount = titleConfigs.filter(c => c.status === 'completed').length;
    if (successCount > 0) {
      try {
        await supabase.from('articles').delete().eq('id', articleId);
      } catch (err) {
        console.error('Failed to delete original article:', err);
      }
    }

    // Show completion toast
    if (failedCount === 0) {
      showToast(t('directGenerate.generationComplete'), 'success');
    } else {
      showToast(
        t('directGenerate.partialSuccess', { success: successCount, failed: failedCount }),
        'warning'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!originalArticle) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Article not found</p>
      </div>
    );
  }

  const allCompleted = isGenerating === false && completedCount > 0 && 
    titleConfigs.filter(c => c.selected && c.title.trim()).every(c => c.status === 'completed' || c.status === 'failed');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
              disabled={isGenerating}
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {t('directGenerate.title')}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {originalArticle.title}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Inherited Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              {t('directGenerate.inheritedSettings')}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{t('directGenerate.language')}:</span>
                <span className="font-medium text-slate-700">{originalArticle.language || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{t('directGenerate.tone')}:</span>
                <span className="font-medium text-slate-700">{originalArticle.tone || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{t('directGenerate.keywords')}:</span>
                <span className="font-medium text-slate-700">
                  {originalArticle.targetKeywords?.join(', ') || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Title List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {t('directGenerate.titlesToGenerate')}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  disabled={isGenerating}
                >
                  {titleConfigs.every(c => c.selected)
                    ? t('directGenerate.deselectAll')
                    : t('directGenerate.selectAll')}
                </button>
                <button
                  onClick={addTitle}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  disabled={isGenerating}
                >
                  <Plus size={16} />
                  {t('directGenerate.addTitle')}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {titleConfigs.map((config, index) => (
                <TitleConfigRow
                  key={config.id}
                  config={config}
                  index={index}
                  isGenerating={isGenerating}
                  isCurrentGenerating={currentGeneratingIndex === index}
                  currentStep={currentStep}
                  onToggleSelection={() => toggleSelection(config.id)}
                  onUpdateConfig={(updates) => updateConfig(config.id, updates)}
                  onRemove={() => removeTitle(config.id)}
                  onRetry={() => retryFailed(config.id)}
                  t={t}
                />
              ))}

              {titleConfigs.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-500">
                  <p>{t('directGenerate.noTitleSelected')}</p>
                  <button
                    onClick={addTitle}
                    className="mt-4 flex items-center gap-2 mx-auto text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <Plus size={18} />
                    {t('directGenerate.addTitle')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress Section (when generating) */}
          {isGenerating && (
            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span className="font-medium text-indigo-900">
                  {t('directGenerate.progress', { 
                    current: completedCount + failedCount + 1, 
                    total: selectedCount 
                  })}
                </span>
              </div>
              {currentGeneratingIndex >= 0 && titleConfigs[currentGeneratingIndex] && (
                <div className="text-sm text-indigo-700">
                  <p className="font-medium mb-1">
                    {t('directGenerate.generatingArticle', { 
                      title: titleConfigs[currentGeneratingIndex].title.substring(0, 50) + 
                        (titleConfigs[currentGeneratingIndex].title.length > 50 ? '...' : '')
                    })}
                  </p>
                  <p className="text-indigo-600">
                    {currentStep === 'outline' && t('directGenerate.step1')}
                    {currentStep === 'draft' && t('directGenerate.step2')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Completion Section */}
          {allCompleted && (
            <div className="bg-green-50 rounded-xl border border-green-100 p-6 text-center">
              <Check className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                {t('directGenerate.allCompleted')}
              </h3>
              <p className="text-sm text-green-700 mb-4">
                {failedCount > 0
                  ? t('directGenerate.partialSuccess', { success: completedCount, failed: failedCount })
                  : t('directGenerate.generationComplete')}
              </p>
              <button
                onClick={onComplete}
                className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
              >
                {t('directGenerate.returnToCampaign')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!allCompleted && (
        <div className="bg-white border-t border-slate-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || selectedCount === 0}
              className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('directGenerate.generating')}
                </>
              ) : (
                t('directGenerate.generateButton', { count: selectedCount })
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Title Config Row Component
interface TitleConfigRowProps {
  config: TitleConfig;
  index: number;
  isGenerating: boolean;
  isCurrentGenerating: boolean;
  currentStep: 'idle' | 'outline' | 'draft';
  onToggleSelection: () => void;
  onUpdateConfig: (updates: Partial<TitleConfig>) => void;
  onRemove: () => void;
  onRetry: () => void;
  t: (key: string, options?: any) => string;
}

// Calculate H2 count based on word count range
const calculateH2Count = (minWords: number, maxWords: number): number => {
  const middleValue = (minWords + maxWords) / 2;
  const calculated = Math.round(middleValue / 300);
  // Clamp to valid range
  return Math.max(HEADING_COUNT_LIMITS.H2_MIN, Math.min(HEADING_COUNT_LIMITS.H2_MAX, calculated));
};

const TitleConfigRow: React.FC<TitleConfigRowProps> = ({
  config,
  index,
  isGenerating,
  isCurrentGenerating,
  currentStep,
  onToggleSelection,
  onUpdateConfig,
  onRemove,
  onRetry,
  t,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Local state for number inputs (allows free typing without immediate validation)
  const [localWordCountMin, setLocalWordCountMin] = useState(String(config.wordCountMin));
  const [localWordCountMax, setLocalWordCountMax] = useState(String(config.wordCountMax));
  const [localH2Count, setLocalH2Count] = useState(String(config.h2Count));
  const [localH3Count, setLocalH3Count] = useState(String(config.h3Count));

  // Sync local state when config changes from parent
  useEffect(() => {
    setLocalWordCountMin(String(config.wordCountMin));
    setLocalWordCountMax(String(config.wordCountMax));
    setLocalH2Count(String(config.h2Count));
    setLocalH3Count(String(config.h3Count));
  }, [config.wordCountMin, config.wordCountMax, config.h2Count, config.h3Count]);

  // Handle word count min blur - validate and auto-calculate H2
  const handleWordCountMinBlur = () => {
    const value = parseInt(localWordCountMin) || WORD_COUNT_LIMITS.MIN;
    const clampedValue = Math.max(WORD_COUNT_LIMITS.MIN, Math.min(WORD_COUNT_LIMITS.MAX, value));
    setLocalWordCountMin(String(clampedValue));
    
    // Auto-calculate H2 based on new word count range
    const newH2Count = calculateH2Count(clampedValue, config.wordCountMax);
    setLocalH2Count(String(newH2Count));
    
    onUpdateConfig({ 
      wordCountMin: clampedValue,
      h2Count: newH2Count
    });
  };

  // Handle word count max blur - validate and auto-calculate H2
  const handleWordCountMaxBlur = () => {
    const value = parseInt(localWordCountMax) || WORD_COUNT_LIMITS.MAX;
    const clampedValue = Math.max(WORD_COUNT_LIMITS.MIN, Math.min(WORD_COUNT_LIMITS.MAX, value));
    setLocalWordCountMax(String(clampedValue));
    
    // Auto-calculate H2 based on new word count range
    const newH2Count = calculateH2Count(config.wordCountMin, clampedValue);
    setLocalH2Count(String(newH2Count));
    
    onUpdateConfig({ 
      wordCountMax: clampedValue,
      h2Count: newH2Count
    });
  };

  // Handle H2 count blur - validate only
  const handleH2CountBlur = () => {
    const value = parseInt(localH2Count) || 5;
    const clampedValue = Math.max(HEADING_COUNT_LIMITS.H2_MIN, Math.min(HEADING_COUNT_LIMITS.H2_MAX, value));
    setLocalH2Count(String(clampedValue));
    onUpdateConfig({ h2Count: clampedValue });
  };

  // Handle H3 count blur - validate only
  const handleH3CountBlur = () => {
    const value = parseInt(localH3Count) || 0;
    const clampedValue = Math.max(HEADING_COUNT_LIMITS.H3_MIN, Math.min(HEADING_COUNT_LIMITS.H3_MAX, value));
    setLocalH3Count(String(clampedValue));
    onUpdateConfig({ h3Count: clampedValue });
  };

  const getStatusIcon = () => {
    switch (config.status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'generating':
        return <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className={`transition ${isCurrentGenerating ? 'bg-indigo-50/50' : ''}`}>
      {/* Title Row */}
      <div className="px-6 py-4 flex items-start gap-4">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={config.selected}
            onChange={onToggleSelection}
            disabled={isGenerating || config.status === 'completed'}
            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>

        {/* Title Input */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-mono text-sm">{index + 1}.</span>
            <input
              type="text"
              value={config.title}
              onChange={(e) => onUpdateConfig({ title: e.target.value })}
              placeholder={t('directGenerate.titlePlaceholder')}
              disabled={isGenerating || config.status === 'completed'}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition disabled:opacity-60"
            />
            {getStatusIcon()}
            {config.status === 'failed' && (
              <button
                onClick={onRetry}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                title={t('directGenerate.retry')}
              >
                <RefreshCw size={16} />
              </button>
            )}
            {!isGenerating && config.status !== 'completed' && (
              <button
                onClick={onRemove}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <ChevronDown 
                size={16} 
                className={`transform transition ${isExpanded ? 'rotate-180' : ''}`} 
              />
            </button>
          </div>

          {/* Error Message */}
          {config.status === 'failed' && config.error && (
            <p className="mt-2 text-sm text-red-600 ml-8">{config.error}</p>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      {isExpanded && config.status !== 'completed' && (
        <div className="px-6 pb-4 pl-16">
          <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Word Count Min */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('directGenerate.wordCountMin')}
              </label>
              <input
                type="number"
                value={localWordCountMin}
                onChange={(e) => setLocalWordCountMin(e.target.value)}
                onBlur={handleWordCountMinBlur}
                min={WORD_COUNT_LIMITS.MIN}
                max={WORD_COUNT_LIMITS.MAX}
                disabled={isGenerating}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>

            {/* Word Count Max */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('directGenerate.wordCountMax')}
              </label>
              <input
                type="number"
                value={localWordCountMax}
                onChange={(e) => setLocalWordCountMax(e.target.value)}
                onBlur={handleWordCountMaxBlur}
                min={WORD_COUNT_LIMITS.MIN}
                max={WORD_COUNT_LIMITS.MAX}
                disabled={isGenerating}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>

            {/* H2 Count */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('directGenerate.h2Count')}
              </label>
              <input
                type="number"
                value={localH2Count}
                onChange={(e) => setLocalH2Count(e.target.value)}
                onBlur={handleH2CountBlur}
                min={HEADING_COUNT_LIMITS.H2_MIN}
                max={HEADING_COUNT_LIMITS.H2_MAX}
                disabled={isGenerating}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>

            {/* H3 Count */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('directGenerate.h3Count')}
              </label>
              <input
                type="number"
                value={localH3Count}
                onChange={(e) => setLocalH3Count(e.target.value)}
                onBlur={handleH3CountBlur}
                min={HEADING_COUNT_LIMITS.H3_MIN}
                max={HEADING_COUNT_LIMITS.H3_MAX}
                disabled={isGenerating}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>

            {/* Perspective */}
            <div className="col-span-2 md:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('directGenerate.perspective')}
              </label>
              <div className="flex gap-4">
                {(['first', 'second', 'third'] as ArticlePerspective[]).map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`perspective-${config.id}`}
                      value={p}
                      checked={config.perspective === p}
                      onChange={() => onUpdateConfig({ perspective: p })}
                      disabled={isGenerating}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <span className="text-sm text-slate-700">
                      {t(`directGenerate.perspective${p.charAt(0).toUpperCase() + p.slice(1)}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectGeneratePage;
