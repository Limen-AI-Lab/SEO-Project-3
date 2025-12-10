import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient.js';
import { ARTICLE_STATUS } from '../constants/status';
import { Check, X, MessageSquare, Loader2, AlertCircle } from 'lucide-react';

interface Article {
  id: string;
  title: string;
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
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get articleId from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('articleId');
    
    if (!articleId) {
      setError('缺少文章ID参数。请使用 ?articleId=xxx 访问此页面。');
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
        setError(`获取文章失败：${fetchError.message}`);
        setIsLoading(false);
        return;
      }

      if (!data) {
        setError('文章不存在');
        setIsLoading(false);
        return;
      }

      setArticle(data);
      
      // If status is AWAITING_REVIEW_TITLES and there are proposed titles, select the first one by default
      if (data.status === ARTICLE_STATUS.AWAITING_REVIEW_TITLES && data.proposed_titles && data.proposed_titles.length > 0) {
        setSelectedTitle(data.proposed_titles[0]);
      }
    } catch (err) {
      console.error('Unexpected error loading article:', err);
      setError(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
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
        alert(`添加评论失败：${updateError.message}`);
        return;
      }

      // Reload article to get updated comments
      await loadArticle(article.id);
      setCommentText('');
    } catch (err) {
      console.error('Unexpected error adding comment:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleApprove = async (newStatus: string, selectedTitleText?: string) => {
    if (!article) return;

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const updates: any = { status: newStatus };
      
      // If approving titles, also update the title field
      if (newStatus === ARTICLE_STATUS.TITLES_APPROVED && selectedTitleText) {
        updates.title = selectedTitleText;
      }

      const { error: updateError } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', article.id);

      if (updateError) {
        console.error('Error approving:', updateError);
        alert(`批准失败：${updateError.message}`);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('已成功批准！');
      // Reload article to get updated status
      await loadArticle(article.id);
    } catch (err) {
      console.error('Unexpected error approving:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!article || !commentText.trim()) {
      alert('请先输入拒绝原因或修改建议。');
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

      // Update status to NEEDS_REVISION and add comment
      const { error: updateError } = await supabase
        .from('articles')
        .update({
          status: ARTICLE_STATUS.NEEDS_REVISION,
          client_comments: updatedComments
        })
        .eq('id', article.id);

      if (updateError) {
        console.error('Error rejecting:', updateError);
        alert(`拒绝失败：${updateError.message}`);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('已提交修改请求。');
      setCommentText('');
      // Reload article to get updated status
      await loadArticle(article.id);
    } catch (err) {
      console.error('Unexpected error rejecting:', err);
      alert(`发生意外错误：${err instanceof Error ? err.message : 'Unknown error'}`);
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
          <p className="text-slate-500">加载中...</p>
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
          <p className="text-red-600 font-medium mb-2">加载失败</p>
          <p className="text-red-500 text-sm mb-4">{error || '文章不存在'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            重试
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
          <p className="text-yellow-800">暂无可供审查的标题。</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">请选择一个标题</h2>
          <p className="text-slate-600 mb-6">请从以下标题中选择一个您最满意的：</p>
          
          <div className="space-y-3">
            {titles.map((title, index) => (
              <label
                key={index}
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedTitle === title
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="title"
                  value={title}
                  checked={selectedTitle === title}
                  onChange={(e) => setSelectedTitle(e.target.value)}
                  className="mt-1 mr-3"
                />
                <span className="flex-1 text-slate-900 font-medium">{title}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => handleApprove(ARTICLE_STATUS.TITLES_APPROVED, selectedTitle)}
            disabled={!selectedTitle || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <Check size={20} />
            批准所选标题
          </button>
        </div>
      </div>
    );
  };

  const renderOutlineReview = () => {
    const outline = article.outline_content || '暂无大纲内容。';
    
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">大纲审查</h2>
          
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-slate-700">{outline}</pre>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-2 block">添加评论（可选）</span>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="请输入您的意见或建议..."
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
            批准大纲
          </button>
          <button
            onClick={handleReject}
            disabled={!commentText.trim() || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <X size={20} />
            请求修改
          </button>
        </div>
      </div>
    );
  };

  const renderDraftReview = () => {
    const draft = article.draft_content || '暂无草稿内容。';
    
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">草稿审查</h2>
          
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap font-sans text-slate-700">{draft}</div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-2 block">添加评论（可选）</span>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="请输入您的意见或建议..."
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
            批准草稿
          </button>
          <button
            onClick={handleReject}
            disabled={!commentText.trim() || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <X size={20} />
            请求修改
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
    ].includes(article.status as any);

    return (
      <div className="text-center py-12">
        {isCompleted ? (
          <>
            <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">任务已完成</h2>
            <p className="text-slate-600">此文章已获得最终批准。</p>
          </>
        ) : isAgencyWorking ? (
          <>
            <Loader2 className="h-16 w-16 text-indigo-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">等待机构处理</h2>
            <p className="text-slate-600">文章正在由机构处理中，请稍候...</p>
          </>
        ) : article.status === ARTICLE_STATUS.NEEDS_REVISION ? (
          <>
            <MessageSquare className="h-16 w-16 text-amber-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">需要修改</h2>
            <p className="text-slate-600">您的修改请求已提交，机构正在处理中...</p>
          </>
        ) : (
          <>
            <AlertCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">未知状态</h2>
            <p className="text-slate-600">当前状态：{article.status}</p>
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
          评论历史
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

