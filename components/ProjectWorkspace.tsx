
import React, { useState, useEffect } from 'react';
import { Article, ProjectStatus, Campaign, ARTICLE_STATUS, Comment, ContentBlock, ClientEdit, RevisionHistoryEntry } from '../types';
import supabase from '../services/supabaseClient.js';
import { ArrowLeft, Check, Lock, PlayCircle, ChevronRight, Home, CheckCircle, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import StageTitles from './StageTitles';
import StageOutline from './StageOutline';
import StageDraft from './StageDraft';
import Modal from './Modal';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

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
          text: sc.targetId ? `[Paragraph ${sc.targetId}] ${sc.text}` : sc.text,
          timestamp,
          targetBlockId: sc.targetId || undefined
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
          timestamp,
          targetBlockId: cc.targetId || undefined
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
          text: `[Title Note] ${note}`,
          timestamp
        });
      }
    });
  }
  
  // Add edit suggestions (from outline/content review)
  if (rawComments.edits && Array.isArray(rawComments.edits)) {
    rawComments.edits.forEach((edit: ClientEdit, index: number) => {
      let editText = '';
      const actionType = edit.action_type;
      const editAuthor = edit.contact_name || reviewer;
      const editTimestamp = edit.created_at ? new Date(edit.created_at) : timestamp;
      
      // Format the edit content for display
      if (actionType === 'modify') {
        // Extract content text for display
        const oldContent = edit.original_content?.content || edit.original_content?.title || JSON.stringify(edit.original_content);
        const newContent = edit.suggested_content?.content || edit.suggested_content?.title || JSON.stringify(edit.suggested_content);
        const oldPreview = typeof oldContent === 'string' ? oldContent.substring(0, 50) : String(oldContent).substring(0, 50);
        const newPreview = typeof newContent === 'string' ? newContent.substring(0, 50) : String(newContent).substring(0, 50);
        editText = `[${oldPreview}${oldContent.length > 50 ? '...' : ''}] Title Modification`;
      } else if (actionType === 'delete') {
        const deletedContent = edit.original_content?.content || edit.original_content?.title || JSON.stringify(edit.original_content);
        const deletePreview = typeof deletedContent === 'string' ? deletedContent.substring(0, 50) : String(deletedContent).substring(0, 50);
        editText = `[${deletePreview}${deletedContent.length > 50 ? '...' : ''}] Deletion Suggestion`;
      } else if (actionType === 'add') {
        const addedContent = edit.suggested_content?.content || edit.suggested_content?.title || JSON.stringify(edit.suggested_content);
        const addPreview = typeof addedContent === 'string' ? addedContent.substring(0, 50) : String(addedContent).substring(0, 50);
        editText = `[New Content] ${addPreview}${addedContent.length > 50 ? '...' : ''}`;
      }
      
      if (editText) {
        comments.push({
          id: `edit-${edit.id || index}-${Date.now()}`,
          author: editAuthor,
          text: editText,
          timestamp: editTimestamp,
          editType: actionType,
          targetBlockId: edit.target_id || undefined
        });
      }
    });
  }
  
  return comments;
}

/**
 * Apply client edit suggestions to content blocks
 * This function modifies the content blocks based on client's edit suggestions
 * 
 * @param originalBlocks - Original content blocks from database
 * @param edits - Array of client edit suggestions
 * @returns Modified content blocks with edits applied
 */
function applyClientEdits(originalBlocks: ContentBlock[] | undefined, edits: ClientEdit[] | undefined): ContentBlock[] {
  if (!originalBlocks || !Array.isArray(originalBlocks)) {
    return [];
  }
  
  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    return originalBlocks;
  }
  
  // Create a copy to avoid mutating the original
  let modifiedBlocks: ContentBlock[] = [...originalBlocks];
  
  // Process edits in order: first deletions, then modifications, then additions
  const deletions = edits.filter(e => e.action_type === 'delete');
  const modifications = edits.filter(e => e.action_type === 'modify');
  const additions = edits.filter(e => e.action_type === 'add');
  
  // Step 1: Apply deletions (remove blocks)
  deletions.forEach(edit => {
    modifiedBlocks = modifiedBlocks.filter(block => block.id !== edit.target_id);
  });
  
  // Step 2: Apply modifications (replace blocks)
  modifications.forEach(edit => {
    const blockIndex = modifiedBlocks.findIndex(block => block.id === edit.target_id);
    if (blockIndex !== -1 && edit.suggested_content) {
      // Convert suggested_content to ContentBlock format
      const suggestedBlock: ContentBlock = {
        id: edit.target_id,
        type: edit.suggested_content.type || modifiedBlocks[blockIndex].type,
        content: edit.suggested_content.content || edit.suggested_content.title || '',
        level: edit.suggested_content.level,
        src: edit.suggested_content.src,
        caption: edit.suggested_content.caption
      };
      modifiedBlocks[blockIndex] = suggestedBlock;
    }
  });
  
  // Step 3: Apply additions (insert new blocks)
  // For additions, we need to determine where to insert
  // If target_id exists in current blocks, insert after it; otherwise append to end
  additions.forEach(edit => {
    if (edit.suggested_content) {
      const newBlock: ContentBlock = {
        id: edit.target_id || `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: edit.suggested_content.type || 'paragraph',
        content: edit.suggested_content.content || edit.suggested_content.title || '',
        level: edit.suggested_content.level,
        src: edit.suggested_content.src,
        caption: edit.suggested_content.caption
      };
      
      // Try to find insertion point (after the target_id if it exists)
      const targetIndex = modifiedBlocks.findIndex(block => block.id === edit.target_id);
      if (targetIndex !== -1) {
        modifiedBlocks.splice(targetIndex + 1, 0, newBlock);
      } else {
        // If target_id doesn't exist, append to end
        modifiedBlocks.push(newBlock);
      }
    }
  });
  
  return modifiedBlocks;
}

interface Props {
  articleId: string;
  onBack: () => void; // Navigates back to Campaign Detail
}

const ProjectWorkspace: React.FC<Props> = ({ articleId, onBack }) => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [article, setArticle] = useState<Article | undefined>(undefined);
  const [campaign, setCampaign] = useState<Campaign | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'default' | 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: React.ReactNode;
    onConfirm?: () => void;
    confirmText?: string;
    showCancel?: boolean;
  }>({
    isOpen: false,
    type: 'default',
    title: '',
    message: null,
    showCancel: false
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
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
        setError(`Failed to fetch article: ${articleError.message}`);
        setIsLoading(false);
        return;
      }

      if (!articleData) {
        setError('Article does not exist');
        setIsLoading(false);
        return;
      }

      // Map database fields to Article interface
      const originalDraftBlocks = articleData.draft_blocks || undefined;
      
      // Extract client edits from client_comments
      const clientEdits: ClientEdit[] = articleData.client_comments?.edits || [];
      
      // Apply client edits to draft blocks
      const modifiedDraftBlocks = applyClientEdits(originalDraftBlocks, clientEdits);
      
      // Use modified blocks if edits were applied, otherwise use original
      const draftBlocksToUse = clientEdits.length > 0 ? modifiedDraftBlocks : originalDraftBlocks;
      
      // If the first block is a header and was modified, update the title
      let displayTitle = articleData.title;
      if (draftBlocksToUse && draftBlocksToUse.length > 0) {
        const firstBlock = draftBlocksToUse[0];
        if (firstBlock.type === 'header' && firstBlock.content) {
          displayTitle = firstBlock.content;
        }
      }
      
      const mappedArticle: Article = {
        id: articleData.id,
        campaignId: articleData.campaign_id,
        title: displayTitle,
        // Ensure status is always a ProjectStatus value
        status: (articleData.status as ProjectStatus) || ProjectStatus.NEEDS_TITLES,
        lastUpdated: articleData.last_updated ? new Date(articleData.last_updated) : new Date(articleData.created_at),
        proposedTitles: articleData.proposed_titles || [],
        selectedTitle: articleData.selected_title || undefined,
        outlineContent: articleData.outline_content || undefined,
        draftContent: articleData.draft_content || undefined,
        draftBlocks: draftBlocksToUse,
        clientComments: parseClientComments(articleData.client_comments, draftBlocksToUse),
        // Revision tracking
        revisionRound: articleData.revision_round || 1,
        revisionHistory: articleData.revision_history || [],
        coverImage: articleData.cover_image || undefined,
        generationCount: articleData.generation_count || 0
      };
      
      setArticle(mappedArticle);

      // Only fetch campaign if we don't have it yet or it's a full refresh
      if (!campaign || showLoading) {
      // Fetch campaign from Supabase (without client relationship)
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', mappedArticle.campaignId)
        .single();

      if (campaignError) {
        console.error('Error fetching campaign:', campaignError);
        setError(`Failed to fetch Campaign: ${campaignError.message}`);
        setIsLoading(false);
        return;
      }

      if (!campaignData) {
        setError('Campaign does not exist');
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
        status: 'ACTIVE' as const,
        cmsId: campaignData.cms_id
      };
      setCampaign(mappedCampaign);
      }
    } catch (err) {
      console.error('Unexpected error loading data:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      if (showLoading) setIsLoading(false);
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
          <p className="text-slate-500">Loading...</p>
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
            <span className="text-sm font-medium">Back</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
            <p className="text-red-600 font-medium mb-2">Failed to Load</p>
            <p className="text-red-500 text-sm mb-4">{error || 'Data does not exist'}</p>
            <button 
              onClick={() => loadData()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Retry
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
      if (updates.slug !== undefined) {
        dbUpdates.slug = updates.slug;
      }
      if (updates.category !== undefined) {
        dbUpdates.category = updates.category;
      }
      if (updates.seoSummary !== undefined) {
        dbUpdates.seo_summary = updates.seoSummary;
      }
      if (updates.seoIntro !== undefined) {
        dbUpdates.seo_intro = updates.seoIntro;
      }
      if (updates.coverImage !== undefined) {
        dbUpdates.cover_image = updates.coverImage;
      }
      if (updates.language !== undefined) {
        dbUpdates.language = updates.language;
      }
      if (updates.tone !== undefined) {
        dbUpdates.tone = updates.tone;
      }
      if (updates.generationCount !== undefined) {
        dbUpdates.generation_count = updates.generationCount;
      }
      
      // last_updated will be automatically updated by trigger

      const { error } = await supabase
        .from('articles')
        .update(dbUpdates)
        .eq('id', article.id);

      if (error) {
        console.error('Error updating article:', error);
        showToast(`Failed to update article: ${error.message}`, 'error');
        return;
      }

      // Reload data to get the latest state without full-page loading flash
      await loadData(false);
    } catch (err) {
      console.error('Unexpected error updating article:', err);
      showToast(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDeleteArticle = async () => {
    if (!article) return;

    const confirmed = await confirm({
      title: 'Delete Article',
      message: `Are you sure you want to delete "${article.selectedTitle || article.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      try {
        const { error } = await supabase
          .from('articles')
          .delete()
          .eq('id', article.id);

        if (error) {
          console.error('Error deleting article:', error);
          showToast(`Failed to delete article: ${error.message}`, 'error');
          return;
        }

        showToast('Article deleted successfully', 'success');
        onBack(); // Go back to campaign page
      } catch (err) {
        console.error('Unexpected error deleting article:', err);
        showToast('An unexpected error occurred', 'error');
      }
    }
  };

  /**
   * Handle Client Approved for Titles - implements forking logic
   * Creates N articles (one for each proposed title) with TITLES_APPROVED status
   */
  const handleClientApprovedTitles = async () => {
    if (!article || !article.proposedTitles || article.proposedTitles.length === 0) {
      setModalConfig({
        isOpen: true,
        type: 'warning',
        title: 'Cannot Approve',
        message: 'No titles available to approve',
        confirmText: 'OK'
      });
      return;
    }

    const titlesToApprove = article.proposedTitles.filter(t => t && t.trim() !== '');
    
    if (titlesToApprove.length === 0) {
      setModalConfig({
        isOpen: true,
        type: 'warning',
        title: 'Cannot Approve',
        message: 'No valid titles available to approve',
        confirmText: 'OK'
      });
      return;
    }

    setModalConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirm Approval',
      message: (
        <div className="space-y-2">
          <p>Are you sure you want to approve all <span className="font-bold text-slate-900">{titlesToApprove.length}</span> titles?</p>
          <p className="text-sm text-slate-500">This will create {titlesToApprove.length} independent articles, each entering "Needs Outline" status.</p>
        </div>
      ),
      showCancel: true,
      confirmText: 'Confirm Approval',
      onConfirm: async () => {
        try {
          console.log('📝 Client Approved Titles - Starting forking process...');
          console.log('Titles to approve:', titlesToApprove);

          // Create new articles for each title (forking logic)
          const newArticles = titlesToApprove.map((title) => ({
            campaign_id: article.campaignId,
            title: title,
            selected_title: title,
            status: ARTICLE_STATUS.TITLES_APPROVED,
            proposed_titles: [title],
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          }));

          // Insert all new articles
          const { data: insertedArticles, error: insertError } = await supabase
            .from('articles')
            .insert(newArticles)
            .select();

          if (insertError) {
            console.error('Error creating forked articles:', insertError);
            setModalConfig({
              isOpen: true,
              type: 'error',
              title: 'Failed to Create Articles',
              message: insertError.message,
              confirmText: 'Close'
            });
            return;
          }

          console.log('✅ Created forked articles:', insertedArticles);

          // Delete the original article (it has been forked)
          const { error: deleteError } = await supabase
            .from('articles')
            .delete()
            .eq('id', article.id);

          if (deleteError) {
            console.error('Error deleting original article:', deleteError);
          }

          setModalConfig({
            isOpen: true,
            type: 'success',
            title: 'Approval Successful',
            message: (
              <div className="space-y-3">
                 <div className="flex items-center gap-2 text-green-700 font-medium">
                   <p>✅ Successfully approved {titlesToApprove.length} titles!</p>
                 </div>
                 <p className="text-slate-600">Created <span className="font-bold">{titlesToApprove.length}</span> new articles. Please return to Campaign to view them.</p>
              </div>
            ),
            showCancel: false,
            confirmText: 'Back to Campaign',
            onConfirm: () => {
               closeModal();
               onBack();
            }
          });

        } catch (err) {
          console.error('Unexpected error in client approved titles:', err);
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Operation Failed',
            message: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            confirmText: 'Close'
          });
        }
      }
    });
  };

  /**
   * Check if current status is title review stage
   */
  const isTitleReviewStage = () => {
    const currentStatus = article?.status as unknown as string;
    return currentStatus === (ARTICLE_STATUS.AWAITING_REVIEW_TITLES as string) || 
           currentStatus === (ProjectStatus.AWAITING_TITLE_APPROVAL as unknown as string) ||
           currentStatus === 'AWAITING_REVIEW_TITLES';
  };

  /**
   * Handle simple approval for Outline and Draft stages
   */
  const handleForceApprove = async () => {
    if (!article) return;

    try {
      const currentStatus = article.status as unknown as string;
      
      // For title approval, use the forking function
      if (currentStatus === (ProjectStatus.AWAITING_TITLE_APPROVAL as unknown as string) || 
          currentStatus === (ARTICLE_STATUS.AWAITING_REVIEW_TITLES as string) ||
          currentStatus === 'AWAITING_REVIEW_TITLES') {
        await handleClientApprovedTitles();
        return;
      }

      let nextStatus = currentStatus;

      // DIRECT TRANSITION: From Outline Review to Drafting
      if (currentStatus === (ProjectStatus.AWAITING_OUTLINE_APPROVAL as unknown as string) || 
          currentStatus === (ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE as string)) {
        nextStatus = ARTICLE_STATUS.OUTLINE_APPROVED;
      } else if (currentStatus === (ProjectStatus.AWAITING_DRAFT_APPROVAL as unknown as string) || 
                 currentStatus === (ARTICLE_STATUS.AWAITING_REVIEW_DRAFT as string)) {
        nextStatus = ARTICLE_STATUS.DRAFT_APPROVED;
      }

      const { error } = await supabase
        .from('articles')
        .update({ status: nextStatus })
        .eq('id', article.id);

      if (error) {
        console.error('Error updating article status:', error);
        showToast(`Failed to update status: ${error.message}`, 'error');
        return;
      }

      // Reload data to get the latest state
      await loadData();
    } catch (err) {
      console.error('Unexpected error in force approve:', err);
      showToast(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const renderStage = () => {
    const statusStr = article.status as unknown as string;
    
    // Stage 1: Titles (including title revision)
    if (
      statusStr === (ARTICLE_STATUS.NEEDS_TITLES as string) ||
      statusStr === (ARTICLE_STATUS.AWAITING_REVIEW_TITLES as string) ||
      statusStr === (ARTICLE_STATUS.NEEDS_TITLES_REVISION as string) ||
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
      statusStr === (ARTICLE_STATUS.TITLES_APPROVED as string) ||
      statusStr === (ARTICLE_STATUS.NEEDS_OUTLINE as string) ||
      statusStr === (ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE as string) ||
      statusStr === (ARTICLE_STATUS.NEEDS_OUTLINE_REVISION as string) ||
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
      statusStr === (ARTICLE_STATUS.OUTLINE_APPROVED as string) ||
      statusStr === (ARTICLE_STATUS.NEEDS_DRAFT as string) ||
      statusStr === (ARTICLE_STATUS.AWAITING_REVIEW_DRAFT as string) ||
      statusStr === (ARTICLE_STATUS.DRAFT_APPROVED as string) ||
      statusStr === (ARTICLE_STATUS.NEEDS_DRAFT_REVISION as string) ||
      statusStr === (ARTICLE_STATUS.NEEDS_REVISION as string) || // Deprecated, kept for backward compatibility
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
            cmsId={campaign.cmsId}
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

  const isLocked = (article.status as unknown as string).includes('AWAITING') || 
                   (article.status as unknown as string).includes('REVIEW');

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
               <>
                 {/* Main Client Approved Button */}
                 <button 
                   onClick={isTitleReviewStage() ? handleClientApprovedTitles : handleForceApprove}
                   className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition shadow-sm"
                 >
                   <CheckCircle size={16} />
                   Client Approved
                 </button>
                 {/* DEV button for quick simulation */}
                 <button 
                   onClick={handleForceApprove}
                   className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded border border-purple-200 hover:bg-purple-200 transition"
                 >
                   <PlayCircle size={14} />
                   DEV: Simulate
                 </button>
               </>
            )}
            <button 
              onClick={handleDeleteArticle}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
              title="Delete Article"
            >
              <Trash2 size={20} />
            </button>
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
               <p className="text-slate-500 mb-4">
                 This article is currently locked while {campaign.clientName} reviews your submission.
               </p>
               
               {/* Client Approved Button - Skip client review */}
               <div className="mt-6 pt-6 border-t border-slate-100">
                 <p className="text-xs text-slate-400 mb-3">Or skip client review:</p>
                 <button 
                   onClick={isTitleReviewStage() ? handleClientApprovedTitles : handleForceApprove}
                   className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-600/20"
                 >
                   <CheckCircle size={20} />
                   {isTitleReviewStage() ? 'Client Approved (Approve All Titles)' : 'Client Approved'}
                 </button>
                 <p className="text-[10px] text-slate-400 mt-2">
                   {isTitleReviewStage() 
                     ? `Will approve ${article.proposedTitles?.length || 0} titles and create corresponding articles` 
                     : 'Simulate client approval, proceed directly to next stage'}
                 </p>
               </div>
             </div>
          </div>
        ) : null}

        {renderStage()}
      </main>

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        type={modalConfig.type}
        footer={
          <>
            {modalConfig.showCancel && (
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => {
                if (modalConfig.onConfirm) {
                  modalConfig.onConfirm();
                } else {
                  closeModal();
                }
              }}
              className={`px-4 py-2 text-white rounded-lg transition shadow-sm ${
                modalConfig.type === 'error' ? 'bg-red-600 hover:bg-red-700' :
                modalConfig.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                modalConfig.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {modalConfig.confirmText || 'OK'}
            </button>
          </>
        }
      >
        {modalConfig.message}
      </Modal>
    </div>
  );
};

export default ProjectWorkspace;
