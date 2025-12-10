
import React from 'react';
import { ProjectStatus, ARTICLE_STATUS } from '../types';
import { CheckCircle, Clock, Edit3, FileText, Send, AlertCircle } from 'lucide-react';

interface Props {
  status: ProjectStatus | string;
}

const StatusBadge: React.FC<Props> = ({ status }) => {
  const getConfig = () => {
    // Handle both ProjectStatus enum and string status values
    const statusStr = typeof status === 'string' ? status : status;
    
    switch (statusStr) {
      case ProjectStatus.NEEDS_TITLES:
      case ARTICLE_STATUS.NEEDS_TITLES:
        return { color: 'bg-red-100 text-red-700 border-red-200', icon: <Edit3 size={14} />, label: 'Needs Titles' };
      
      case ProjectStatus.AWAITING_TITLE_APPROVAL:
      case ARTICLE_STATUS.AWAITING_REVIEW_TITLES:
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} />, label: 'Client Reviewing Titles' };
      
      case ProjectStatus.TITLES_APPROVED:
      case ARTICLE_STATUS.TITLES_APPROVED:
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <FileText size={14} />, label: 'Ready for Outline' };
      
      case ProjectStatus.NEEDS_OUTLINE:
      case ProjectStatus.OUTLINE_APPROVED:
      case ARTICLE_STATUS.OUTLINE_APPROVED:
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Edit3 size={14} />, label: 'Ready for Draft' };
      
      case ProjectStatus.AWAITING_OUTLINE_APPROVAL:
      case ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE:
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} />, label: 'Client Reviewing Outline' };
      
      case ProjectStatus.NEEDS_DRAFT:
        return { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Edit3 size={14} />, label: 'Drafting Content' };
      
      case ProjectStatus.AWAITING_DRAFT_APPROVAL:
      case ARTICLE_STATUS.AWAITING_REVIEW_DRAFT:
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} />, label: 'Client Reviewing Draft' };
      
      case ProjectStatus.DRAFT_APPROVED:
      case ARTICLE_STATUS.DRAFT_APPROVED:
        return { color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={14} />, label: 'Approved - Ready to Publish' };
      
      case ProjectStatus.NEEDS_REVISION:
      case ARTICLE_STATUS.NEEDS_REVISION:
        return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertCircle size={14} />, label: 'Needs Revision' };
      
      case ProjectStatus.PUBLISHED:
        return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Send size={14} />, label: 'Published' };
      
      default:
        return { color: 'bg-gray-100 text-gray-700', icon: <Clock size={14} />, label: statusStr };
    }
  };

  const config = getConfig();

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
};

export default StatusBadge;
