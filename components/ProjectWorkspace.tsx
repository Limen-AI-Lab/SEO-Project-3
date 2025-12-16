
import React, { useState, useEffect } from 'react';
import { Article, ProjectStatus, Campaign, ARTICLE_STATUS, Comment, ContentBlock } from '../types';
import supabase from '../services/supabaseClient.js';
import { ArrowLeft, Check, Lock, PlayCircle, ChevronRight, Home } from 'lucide-react';
import StatusBadge from './StatusBadge';
import StageTitles from './StageTitles';
import StageOutline from './StageOutline';
import StageDraft from './StageDraft';

/**
 * Parse client_comments from database (object format from Client Portal)
 * to Comment[] array format expected by Agency Portal components
 * 
 * @param rawComments - Raw client_comments from database
 * @param draftBlocks - Structured draft blocks for looking up referenced content
 */
function parseClientComments(rawComments: any, draftBlocks?: ContentBlock[]): Comment[] {
  if (!rawComments) return [];
  
  // Already in array format (backward compatible)
  if (Array.isArray(rawComments)) {
    return rawComments.map((c: any) => ({
      ...c,
      timestamp: c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)
    }));
  }
  
  // Convert object format (from Client Portal) to array format
  const comments: Comment[] = [];
  const reviewer = rawComments.reviewer || 'Client';
  const timestamp = rawComments.timestamp ? new Date(rawComments.timestamp) : new Date();
  
  // Add general comments first (most important)
  if (rawComments.generalComments && rawComments.generalComments.trim()) {
    comments.push({
      id: `general-${Date.now()}`,
      author: reviewer,
      text: rawComments.generalComments,
      timestamp
    });
  }
  
  // Add section comments (from outline review)
  if (rawComments.sectionComments && Array.isArray(rawComments.sectionComments)) {
    rawComments.sectionComments.forEach((sc: any, index: number) => {
      if (sc.text && sc.text.trim()) {
        comments.push({
          id: `section-${index}-${Date.now()}`,
          author: reviewer,
          text: sc.targetId ? `[段落 ${sc.targetId}] ${sc.text}` : sc.text,
          timestamp
        });
      }
    });
  }
  
  // Add content comments (from draft review) - with block content lookup
  if (rawComments.contentComments && Array.isArray(rawComments.contentComments)) {
    rawComments.contentComments.forEach((cc: any, index: number) => {
      if (cc.text && cc.text.trim()) {
        // Try to find the referenced block's content
        let preview = cc.targetId || '';
        if (draftBlocks && cc.targetId) {
          const referencedBlock = draftBlocks.find(block => block.id === cc.targetId);
          if (referencedBlock && referencedBlock.content) {
            // Show first 30 characters of the referenced content
            const contentPreview = referencedBlock.content.substring(0, 30);
            preview = contentPreview + (referencedBlock.content.length > 30 ? '...' : '');
          }
        }
        
        comments.push({
          id: `content-${index}-${Date.now()}`,
          author: reviewer,
          text: preview ? `[${preview}] ${cc.text}` : cc.text,
          timestamp
        });
      }
    });
  }
  
  // Add title notes (from title review)
  if (rawComments.titleNotes && typeof rawComments.titleNotes === 'object') {
    Object.entries(rawComments.titleNotes).forEach(([titleId, note]: [string, any]) => {
      if (note && String(note).trim()) {
        comments.push({
          id: `title-${titleId}-${Date.now()}`,
          author: reviewer,
          text: `[标题备注] ${note}`,
          timestamp
        });
      }
    });
  }
  
  return comments;
}

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
      const draftBlocks = articleData.draft_blocks || undefined;
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
        draftBlocks: draftBlocks,
        clientComments: parseClientComments(articleData.client_comments, draftBlocks)
      };
      setArticle(mappedArticle);

      // Fetch campaign from Supabase (without client relationship)
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
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

      // Fetch associated clients through campaign_clients junction table
      const { data: clientAssociations } = await supabase
        .from('campaign_clients')
        .select('clients(name)')
        .eq('campaign_id', campaignData.id);

      const clientNames = (clientAssociations || [])
        .filter((assoc: any) => assoc.clients)
        .map((assoc: any) => assoc.clients.name)
        .join(', ');

      // Map database fields to Campaign interface
      const mappedCampaign: Campaign = {
        id: campaignData.id,
        name: campaignData.name,
        clientName: clientNames || 'Unknown Client',
        strategyGoals: campaignData.strategy_goals || '',
        targetAudience: '',
        keywords: [],
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
      if (updates.outlineSections !== undefined) {
        dbUpdates.outline_sections = updates.outlineSections || null;
      }
      if (updates.draftContent !== undefined) {
        dbUpdates.draft_content = updates.draftContent || null;
      }
      if (updates.draftBlocks !== undefined) {
        dbUpdates.draft_blocks = updates.draftBlocks || null;
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
    
    // Stage 1: Titles (including title revision)
    if (
      statusStr === ARTICLE_STATUS.NEEDS_TITLES ||
      statusStr === ARTICLE_STATUS.AWAITING_REVIEW_TITLES ||
      statusStr === ARTICLE_STATUS.NEEDS_TITLES_REVISION ||
      statusStr === 'NEEDS_TITLES' ||
      statusStr === 'AWAITING_REVIEW_TITLES' ||
      statusStr === 'NEEDS_TITLES_REVISION'
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

    // Stage 2: Outline (after titles approved, including outline revision)
    if (
      statusStr === ARTICLE_STATUS.TITLES_APPROVED ||
      statusStr === ARTICLE_STATUS.NEEDS_OUTLINE ||
      statusStr === ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE ||
      statusStr === ARTICLE_STATUS.NEEDS_OUTLINE_REVISION ||
      statusStr === 'TITLES_APPROVED' ||
      statusStr === 'NEEDS_OUTLINE' ||
      statusStr === 'AWAITING_REVIEW_OUTLINE' ||
      statusStr === 'NEEDS_OUTLINE_REVISION'
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

    // Stage 3: Draft (after outline approved, including draft revision)
    // Note: NEEDS_REVISION (deprecated) is kept for backward compatibility and treated as draft revision
    if (
      statusStr === ARTICLE_STATUS.OUTLINE_APPROVED ||
      statusStr === ARTICLE_STATUS.NEEDS_DRAFT ||
      statusStr === ARTICLE_STATUS.AWAITING_REVIEW_DRAFT ||
      statusStr === ARTICLE_STATUS.DRAFT_APPROVED ||
      statusStr === ARTICLE_STATUS.NEEDS_DRAFT_REVISION ||
      statusStr === ARTICLE_STATUS.NEEDS_REVISION || // Deprecated, kept for backward compatibility
      statusStr === 'OUTLINE_APPROVED' ||
      statusStr === 'NEEDS_DRAFT' ||
      statusStr === 'AWAITING_REVIEW_DRAFT' ||
      statusStr === 'DRAFT_APPROVED' ||
      statusStr === 'NEEDS_DRAFT_REVISION' ||
      statusStr === 'NEEDS_REVISION' || // Deprecated
      statusStr === 'PUBLISHED'
    ) {
      return (
        <div className="h-full w-full overflow-hidden p-4 bg-slate-100">
          <StageDraft 
            project={article} 
            onUpdate={handleUpdate} 
          />
        </div>
      );
    }

    // Fallback: Default to titles stage
    return (
      <div className="h-full overflow-y-auto p-8">
        <StageTitles 
          project={article} 
          campaign={campaign}
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
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{article.selectedTitle || article.title}</h1>
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
