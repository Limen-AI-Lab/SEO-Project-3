import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient.js';
import { ARTICLE_STATUS } from '../constants/status';
import { Check, X, MessageSquare, Loader2, AlertCircle } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  campaign_id: string;  // Added for multi-title approval
  proposed_titles: string[];
  outline_content: string | null;
  draft_content: string | null;
  status: string;
  client_comments: any[] | null;
}

const ClientReviewPage: React.FC = () => {
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [commentText, setCommentText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get articleId from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('articleId');
    
    if (!articleId) {
      setError('Missing article ID parameter. Please use ?articleId=xxx to access this page.');
      setIsLoading(false);
      return;
    }

    loadArticle(articleId);
  }, []);

  const loadArticle = async (articleId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();

      if (fetchError) {
        console.error('Error fetching article:', fetchError);
        setError(`Failed to fetch article: ${fetchError.message}`);
        setIsLoading(false);
        return;
      }

      if (!data) {
        setError('Article does not exist');
        setIsLoading(false);
        return;
      }

      setArticle(data);
      
      // Reset selected titles when loading a new article
      setSelectedTitles([]);
    } catch (err) {
      console.error('Unexpected error loading article:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addComment = async (comment: string) => {
    if (!article || !comment.trim()) return;

    try {
      const existingComments = article.client_comments || [];
      const newComment = {
        id: crypto.randomUUID(),
        author: 'Client',
        text: comment.trim(),
        timestamp: new Date().toISOString()
      };

      const updatedComments = [...existingComments, newComment];

      const { error: updateError } = await supabase
        .from('articles')
        .update({ client_comments: updatedComments })
        .eq('id', article.id);

      if (updateError) {
        console.error('Error adding comment:', updateError);
        alert(`Failed to add comment: ${updateError.message}`);
        return;
      }

      // Reload article to get updated comments
      await loadArticle(article.id);
      setCommentText('');
    } catch (err) {
      console.error('Unexpected error adding comment:', err);
      alert(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle approval for outline and draft (single article update)
  const handleApprove = async (newStatus: string) => {
    if (!article) return;

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from('articles')
        .update({ status: newStatus })
        .eq('id', article.id);

      if (updateError) {
        console.error('Error approving:', updateError);
        alert(`Failed to approve: ${updateError.message}`);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Successfully approved!');
      // Reload article to get updated status
      await loadArticle(article.id);
    } catch (err) {
      console.error('Unexpected error approving:', err);
      alert(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle multi-title approval - creates new articles for each selected title
  const handleApproveTitles = async () => {
    if (!article || selectedTitles.length === 0) {
      alert('Please select at least one title.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      // 1. Create new articles for each selected title
      const newArticles = selectedTitles.map(title => ({
        campaign_id: article.campaign_id,
        title: title,
        selected_title: title,
        status: ARTICLE_STATUS.NEEDS_OUTLINE, // Go directly to outline creation
        proposed_titles: article.proposed_titles, // Inherit all proposed titles
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('articles')
        .insert(newArticles);

      if (insertError) {
        console.error('Error creating new articles:', insertError);
        alert(`Failed to create articles: ${insertError.message}`);
        setIsSubmitting(false);
        return;
      }

      // 2. Delete the original article
      const { error: deleteError } = await supabase
        .from('articles')
        .delete()
        .eq('id', article.id);

      if (deleteError) {
        console.error('Error deleting original article:', deleteError);
        // Don't fail completely - articles were created successfully
        alert(`Note: New articles created, but failed to delete original article: ${deleteError.message}`);
      }

      setSuccessMessage(`Successfully approved ${selectedTitles.length} titles! Page will close in 3 seconds...`);
      
      // Close page or show completion after 3 seconds
      setTimeout(() => {
        // Try to close the window, or show a completed state
        try {
          window.close();
        } catch {
          // If window.close() doesn't work, just show a completion message
          setSuccessMessage('Approval complete! You can close this page.');
        }
      }, 3000);

    } catch (err) {
      console.error('Unexpected error approving titles:', err);
      alert(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle title selection (for checkbox multi-select)
  const handleToggleTitle = (title: string) => {
    setSelectedTitles(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const handleReject = async () => {
    if (!article || !commentText.trim()) {
      alert('Please enter rejection reason or modification suggestions first.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      // Add comment first
      const existingComments = article.client_comments || [];
      const newComment = {
        id: crypto.randomUUID(),
        author: 'Client',
        text: commentText.trim(),
        timestamp: new Date().toISOString()
      };
      const updatedComments = [...existingComments, newComment];

      // Determine the correct revision status based on current review phase
      let revisionStatus = ARTICLE_STATUS.NEEDS_DRAFT_REVISION; // Default fallback
      
      if (article.status === ARTICLE_STATUS.AWAITING_REVIEW_TITLES) {
        revisionStatus = ARTICLE_STATUS.NEEDS_TITLES_REVISION;
      } else if (article.status === ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE) {
        revisionStatus = ARTICLE_STATUS.NEEDS_OUTLINE_REVISION;
      } else if (article.status === ARTICLE_STATUS.AWAITING_REVIEW_DRAFT) {
        revisionStatus = ARTICLE_STATUS.NEEDS_DRAFT_REVISION;
      }

      // Update status to the appropriate revision state and add comment
      const { error: updateError } = await supabase
        .from('articles')
        .update({
          status: revisionStatus,
          client_comments: updatedComments
        })
        .eq('id', article.id);

      if (updateError) {
        console.error('Error rejecting:', updateError);
        alert(`Failed to reject: ${updateError.message}`);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Modification request submitted.');
      setCommentText('');
      // Reload article to get updated status
      await loadArticle(article.id);
    } catch (err) {
      console.error('Unexpected error rejecting:', err);
      alert(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || !article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 font-medium mb-2">Failed to Load</p>
          <p className="text-red-500 text-sm mb-4">{error || 'Article does not exist'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render based on status
  const renderReviewContent = () => {
    switch (article.status) {
      case ARTICLE_STATUS.AWAITING_REVIEW_TITLES:
        return renderTitleReview();
      case ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE:
        return renderOutlineReview();
      case ARTICLE_STATUS.AWAITING_REVIEW_DRAFT:
        return renderDraftReview();
      default:
        return renderOtherStatus();
    }
  };

  const renderTitleReview = () => {
    const titles = article.proposed_titles || [];
    
    if (titles.length === 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No titles available for review.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Please Select Titles</h2>
          <p className="text-slate-600 mb-6">
            Please check the titles you are satisfied with (multiple selection allowed). Each approved title will create an independent article:
          </p>
          
          <div className="space-y-3">
            {titles.map((title, index) => (
              <label
                key={index}
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedTitles.includes(title)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTitles.includes(title)}
                  onChange={() => handleToggleTitle(title)}
                  className="mt-1 mr-3 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="flex-1 text-slate-900 font-medium">{title}</span>
              </label>
            ))}
          </div>

          {/* Selected count indicator */}
          {selectedTitles.length > 0 && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-indigo-700 text-sm">
                Selected <span className="font-bold">{selectedTitles.length}</span> titles,
                will create <span className="font-bold">{selectedTitles.length}</span> independent articles after approval
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={handleApproveTitles}
            disabled={selectedTitles.length === 0 || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Check size={20} />
            )}
            {isSubmitting 
              ? 'Processing...' 
              : `Approve Selected Titles (${selectedTitles.length})`
            }
          </button>
        </div>
      </div>
    );
  };

  const renderOutlineReview = () => {
    const outline = article.outline_content || 'No outline content.';
    
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Outline Review</h2>
          
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-slate-700">{outline}</pre>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-2 block">Add Comment (Optional)</span>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Please enter your comments or suggestions..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32"
              />
            </label>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => handleApprove(ARTICLE_STATUS.OUTLINE_APPROVED)}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <Check size={20} />
            Approve Outline
          </button>
          <button
            onClick={handleReject}
            disabled={!commentText.trim() || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <X size={20} />
            Request Revision
          </button>
        </div>
      </div>
    );
  };

  const renderDraftReview = () => {
    const draft = article.draft_content || 'No draft content.';
    
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Draft Review</h2>
          
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap font-sans text-slate-700">{draft}</div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-2 block">Add Comment (Optional)</span>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Please enter your comments or suggestions..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32"
              />
            </label>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => handleApprove(ARTICLE_STATUS.DRAFT_APPROVED)}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <Check size={20} />
            Approve Draft
          </button>
          <button
            onClick={handleReject}
            disabled={!commentText.trim() || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <X size={20} />
            Request Revision
          </button>
        </div>
      </div>
    );
  };

  const renderOtherStatus = () => {
    const isCompleted = article.status === ARTICLE_STATUS.DRAFT_APPROVED;
    const isAgencyWorking = [
      ARTICLE_STATUS.NEEDS_TITLES,
      ARTICLE_STATUS.TITLES_APPROVED,
      ARTICLE_STATUS.OUTLINE_APPROVED,
      ARTICLE_STATUS.NEEDS_OUTLINE,
      ARTICLE_STATUS.NEEDS_DRAFT,
    ].includes(article.status as any);
    const isRevisionInProgress = [
      ARTICLE_STATUS.NEEDS_TITLES_REVISION,
      ARTICLE_STATUS.NEEDS_OUTLINE_REVISION,
      ARTICLE_STATUS.NEEDS_DRAFT_REVISION,
      ARTICLE_STATUS.NEEDS_REVISION, // Deprecated, kept for backward compatibility
    ].includes(article.status as any);

    return (
      <div className="text-center py-12">
        {isCompleted ? (
          <>
            <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Task Completed</h2>
            <p className="text-slate-600">This article has received final approval.</p>
          </>
        ) : isAgencyWorking ? (
          <>
            <Loader2 className="h-16 w-16 text-indigo-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Waiting for Agency Processing</h2>
            <p className="text-slate-600">Article is being processed by the agency, please wait...</p>
          </>
        ) : isRevisionInProgress ? (
          <>
            <MessageSquare className="h-16 w-16 text-amber-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Revision Required</h2>
            <p className="text-slate-600">Your revision request has been submitted, agency is processing...</p>
          </>
        ) : (
          <>
            <AlertCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Unknown Status</h2>
            <p className="text-slate-600">Current status: {article.status}</p>
          </>
        )}
      </div>
    );
  };

  // Render comments history
  const renderComments = () => {
    const comments = article.client_comments || [];
    
    if (comments.length === 0) return null;

    return (
      <div className="mt-8 pt-8 border-t border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare size={20} />
          Comment History
        </h3>
        <div className="space-y-4">
          {comments.map((comment: any, index: number) => (
            <div key={comment.id || index} className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-slate-900">{comment.author || 'Client'}</span>
                <span className="text-sm text-slate-500">
                  {comment.timestamp ? new Date(comment.timestamp).toLocaleString() : ''}
                </span>
              </div>
              <p className="text-slate-700">{comment.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{article.title}</h1>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
              {article.status}
            </span>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Review Content */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          {renderReviewContent()}
          {renderComments()}
        </div>
      </div>
    </div>
  );
};

export default ClientReviewPage;


