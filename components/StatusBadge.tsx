
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectStatus, ARTICLE_STATUS } from '../types';
import { CheckCircle, Clock, Edit3, FileText, Send, AlertCircle } from 'lucide-react';

interface Props {
  status: ProjectStatus | string;
}

const StatusBadge: React.FC<Props> = ({ status }) => {
  const { t } = useTranslation('status');
  
  const getConfig = () => {
    // Handle both ProjectStatus enum and string status values
    const statusStr = typeof status === 'string' ? status : status;
    
    switch (statusStr) {
      // Title Phase
      case ARTICLE_STATUS.NEEDS_TITLES:
      case 'NEEDS_TITLES':
        return { color: 'bg-red-100 text-red-700 border-red-200', icon: <Edit3 size={14} />, labelKey: 'article.NEEDS_TITLES' };
      
      case ARTICLE_STATUS.AWAITING_REVIEW_TITLES:
      case 'AWAITING_REVIEW_TITLES':
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} />, labelKey: 'article.AWAITING_REVIEW_TITLES' };
      
      case ARTICLE_STATUS.TITLES_APPROVED:
      case 'TITLES_APPROVED':
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <FileText size={14} />, labelKey: 'article.TITLES_APPROVED' };
      
      case ARTICLE_STATUS.NEEDS_TITLES_REVISION:
      case 'NEEDS_TITLES_REVISION':
        return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertCircle size={14} />, labelKey: 'article.NEEDS_TITLES_REVISION' };
      
      // Outline Phase
      case ARTICLE_STATUS.NEEDS_OUTLINE:
      case 'NEEDS_OUTLINE':
        return { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Edit3 size={14} />, labelKey: 'article.NEEDS_OUTLINE' };
      
      case ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE:
      case 'AWAITING_REVIEW_OUTLINE':
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} />, labelKey: 'article.AWAITING_REVIEW_OUTLINE' };
      
      case ARTICLE_STATUS.OUTLINE_APPROVED:
      case 'OUTLINE_APPROVED':
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <FileText size={14} />, labelKey: 'article.OUTLINE_APPROVED' };
      
      case ARTICLE_STATUS.NEEDS_OUTLINE_REVISION:
      case 'NEEDS_OUTLINE_REVISION':
        return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertCircle size={14} />, labelKey: 'article.NEEDS_OUTLINE_REVISION' };
      
      // Draft Phase
      case ARTICLE_STATUS.NEEDS_DRAFT:
      case 'NEEDS_DRAFT':
        return { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Edit3 size={14} />, labelKey: 'article.NEEDS_DRAFT' };
      
      case ARTICLE_STATUS.AWAITING_REVIEW_DRAFT:
      case 'AWAITING_REVIEW_DRAFT':
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} />, labelKey: 'article.AWAITING_REVIEW_DRAFT' };
      
      case ARTICLE_STATUS.DRAFT_APPROVED:
      case 'DRAFT_APPROVED':
        return { color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={14} />, labelKey: 'article.DRAFT_APPROVED' };
      
      case ARTICLE_STATUS.NEEDS_DRAFT_REVISION:
      case 'NEEDS_DRAFT_REVISION':
        return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertCircle size={14} />, labelKey: 'article.NEEDS_DRAFT_REVISION' };
      
      // Published state
      case ARTICLE_STATUS.PUBLISHED:
      case 'PUBLISHED':
        return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Send size={14} />, labelKey: 'article.PUBLISHED' };
      
      // Deprecated: Kept for backward compatibility
      case ARTICLE_STATUS.NEEDS_REVISION:
      case 'NEEDS_REVISION':
        return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertCircle size={14} />, labelKey: 'article.NEEDS_REVISION' };
      
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <Clock size={14} />, labelKey: null };
    }
  };

  const config = getConfig();
  const label = config.labelKey ? t(config.labelKey) : status;

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      {label}
    </span>
  );
};

export default StatusBadge;
