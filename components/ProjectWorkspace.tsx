
import React, { useState, useEffect } from 'react';
import { Article, ProjectStatus, Campaign, ARTICLE_STATUS } from '../types';
import supabase from '../services/supabaseClient.js';
import { ArrowLeft, Check, Lock, PlayCircle, ChevronRight, Home } from 'lucide-react';
import StatusBadge from './StatusBadge';
import StageTitles from './StageTitles';
import StageOutline from './StageOutline';
import StageDraft from './StageDraft';

interface Props {
  articleId: string;
  onBack: () => void; // Navigates back to Campaign Detail
}

const ProjectWorkspace: React.FC<Props> = ({ articleId, onBack }) => {
  const [article, setArticle] = useState<Article | undefined>(undefined);
  const [campaign, setCampaign] = useState<Campaign | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch article from Supabase
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();

      if (articleError) {
        console.error('Error fetching article:', articleError);
        setError(`获取文章失败：${articleError.message}`);
        setIsLoading(false);
        return;
      }

      if (!articleData) {
        setError('文章不存在');
        setIsLoading(false);
        return;
      }

      // Map database fields to Article interface
      const mappedArticle: Article = {
        id: articleData.id,
        campaignId: articleData.campaign_id,
        title: articleData.title,
        status: (articleData.status as ProjectStatus) || ARTICLE_STATUS.NEEDS_TITLES,
        lastUpdated: articleData.last_updated ? new Date(articleData.last_updated) : new Date(articleData.created_at),
        proposedTitles: articleData.proposed_titles || [],
        selectedTitle: articleData.selected_title || undefined,
        outlineContent: articleData.outline_content || undefined,
        draftContent: articleData.draft_content || undefined,
        clientComments: articleData.client_comments ? (Array.isArray(articleData.client_comments) ? articleData.client_comments : []) : []
      };
      setArticle(mappedArticle);

      // Fetch campaign from Supabase
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*, clients(name)')
        .eq('id', mappedArticle.campaignId)
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
    } catch (err) {
      console.error('Unexpected error loading data:', err);
      setError(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [articleId]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !article || !campaign) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition">
            <ArrowLeft size={16} />
            <span className="text-sm font-medium">返回</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
            <p className="text-red-600 font-medium mb-2">加载失败</p>
            <p className="text-red-500 text-sm mb-4">{error || '数据不存在'}</p>
            <button 
              onClick={loadData} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdate = async (updates: Partial<Article>) => {
    if (!article) return;

    try {
      // Map TypeScript fields to database fields
      const dbUpdates: any = {};
      
      if (updates.status !== undefined) {
        dbUpdates.status = updates.status;
      }
      if (updates.title !== undefined) {
        dbUpdates.title = updates.title;
      }
      if (updates.selectedTitle !== undefined) {
        dbUpdates.selected_title = updates.selectedTitle || null;
      }
      if (updates.proposedTitles !== undefined) {
        dbUpdates.proposed_titles = updates.proposedTitles;
      }
      if (updates.outlineContent !== undefined) {
        dbUpdates.outline_content = updates.outlineContent || null;
      }
      if (updates.draftContent !== undefined) {
        dbUpdates.draft_content = updates.draftContent || null;
      }
      if (updates.clientComments !== undefined) {
        dbUpdates.client_comments = updates.clientComments;
      }
      
      // last_updated will be automatically updated by trigger

      const { error } = await supabase
        .from('articles')
        .update(dbUpdates)
        .eq('id', article.id);

      if (error) {
        console.error('Error updating article:', error);
        alert(`更新文章失败：${error.message}`);
        return;
      }

      // Reload data to get the latest state
      await loadData();
    } catch (err) {
      console.error('Unexpected error updating article:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleForceApprove = async () => {
    if (!article) return;

    try {
      const statusStr = typeof article.status === 'string' ? article.status : article.status;
      let nextStatus = statusStr;

      // DIRECT TRANSITION: From Outline Review to Drafting
      if (statusStr === ProjectStatus.AWAITING_OUTLINE_APPROVAL || 
          statusStr === ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE) {
        nextStatus = ARTICLE_STATUS.OUTLINE_APPROVED;
      } else if (statusStr === ProjectStatus.AWAITING_DRAFT_APPROVAL || 
                 statusStr === ARTICLE_STATUS.AWAITING_REVIEW_DRAFT) {
        nextStatus = ARTICLE_STATUS.DRAFT_APPROVED;
      } else if (statusStr === ProjectStatus.AWAITING_TITLE_APPROVAL || 
                 statusStr === ARTICLE_STATUS.AWAITING_REVIEW_TITLES) {
        // For title approval, move to approved state
        // Note: Forking logic (creating multiple articles) is not implemented here
        nextStatus = ARTICLE_STATUS.TITLES_APPROVED;
      }

      const { error } = await supabase
        .from('articles')
        .update({ status: nextStatus })
        .eq('id', article.id);

      if (error) {
        console.error('Error updating article status:', error);
        alert(`更新状态失败：${error.message}`);
        return;
      }

      // Reload data to get the latest state
      await loadData();
    } catch (err) {
      console.error('Unexpected error in force approve:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const renderStage = () => {
    const statusStr = typeof article.status === 'string' ? article.status : article.status;
    
    // Stage 1: Titles
    if (
      statusStr === ProjectStatus.NEEDS_TITLES || 
      statusStr === ARTICLE_STATUS.NEEDS_TITLES ||
      statusStr === ProjectStatus.AWAITING_TITLE_APPROVAL ||
      statusStr === ARTICLE_STATUS.AWAITING_REVIEW_TITLES ||
      statusStr === ARTICLE_STATUS.NEEDS_REVISION // If revision needed during title stage
    ) {
      return (
        <div className="h-full overflow-y-auto p-8">
          <StageTitles 
            project={article} 
            campaign={campaign}
            onUpdate={handleUpdate} 
          />
        </div>
      );
    }

    // Stage 2: Outline
    if (
      statusStr === ProjectStatus.TITLES_APPROVED || 
      statusStr === ARTICLE_STATUS.TITLES_APPROVED ||
      statusStr === ProjectStatus.NEEDS_OUTLINE ||
      statusStr === ProjectStatus.OUTLINE_APPROVED ||
      statusStr === ARTICLE_STATUS.OUTLINE_APPROVED ||
      statusStr === ProjectStatus.AWAITING_OUTLINE_APPROVAL ||
      statusStr === ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE
    ) {
      return (
        <div className="h-full overflow-y-auto p-8">
          <StageOutline 
            project={article} 
            onUpdate={handleUpdate} 
          />
        </div>
      );
    }

    // Stage 3: Draft (Fallthrough for NEEDS_DRAFT and beyond)
    // Use full width fluid layout
    return (
      <div className="h-full w-full overflow-hidden p-4 bg-slate-100">
        <StageDraft 
          project={article} 
          onUpdate={handleUpdate} 
        />
      </div>
    );
  };

  const isLocked = typeof article.status === 'string' 
    ? article.status.includes('AWAITING') || article.status.includes('REVIEW')
    : article.status.toString().includes('AWAITING');

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-2 flex-shrink-0 z-10">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
           <span className="hover:text-indigo-600 cursor-pointer flex items-center gap-1"><Home size={10} /> Home</span>
           <ChevronRight size={10} />
           <span className="hover:text-indigo-600 cursor-pointer" onClick={onBack}>Campaigns</span>
           <ChevronRight size={10} />
           <span className="hover:text-indigo-600 cursor-pointer font-medium text-slate-700" onClick={onBack}>{campaign.name}</span>
           <ChevronRight size={10} />
           <span className="text-slate-400">Article Workspace</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{article.title}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>{campaign.clientName}</span>
                <span>•</span>
                <StatusBadge status={article.status} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isLocked && (
               <button 
                 onClick={handleForceApprove}
                 className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded border border-purple-200 hover:bg-purple-200 transition"
               >
                 <PlayCircle size={14} />
                 DEV: Simulate Client Approval
               </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {isLocked ? (
          <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
             <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border border-slate-100">
               <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Lock size={32} />
               </div>
               <h2 className="text-xl font-bold text-slate-900 mb-2">Awaiting Client Review</h2>
               <p className="text-slate-500 mb-6">
                 This article is currently locked while {campaign.clientName} reviews your submission.
               </p>
             </div>
          </div>
        ) : null}

        {renderStage()}
      </main>
    </div>
  );
};

export default ProjectWorkspace;
