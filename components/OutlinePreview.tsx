/**
 * OutlinePreview Component
 * 
 * Displays a preview of the parsed outline in the same format
 * that clients will see in the Client Portal.
 */

import React from 'react';
import { OutlineSection } from '../services/outlineParser';
import { Eye, FileText } from 'lucide-react';

interface Props {
  sections: OutlineSection[];
  showStats?: boolean;
  className?: string;
}

const OutlinePreview: React.FC<Props> = ({ sections, showStats = true, className }) => {
  if (sections.length === 0) {
    return (
      <div className={`bg-slate-50 border border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center ${className || 'h-96'}`}>
        <FileText className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium">暂无大纲内容</p>
        <p className="text-slate-400 text-sm mt-2">
          使用 # ## ### 添加标题层级
        </p>
      </div>
    );
  }

  // Calculate stats
  const h1Count = sections.filter(s => s.level === 'H1').length;
  const h2Count = sections.filter(s => s.level === 'H2').length;
  const h3Count = sections.filter(s => s.level === 'H3').length;
  const totalWords = sections.reduce((sum, s) => sum + (s.wordCountEstimate || 0), 0);

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex flex-col ${className || 'h-96'}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-slate-600">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">客户端预览</span>
        </div>
        
        {showStats && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="px-2 py-1 bg-slate-800 text-white rounded">H1: {h1Count}</span>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">H2: {h2Count}</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded border">H3: {h3Count}</span>
            <span className="text-slate-400">|</span>
            <span>预估 ~{totalWords.toLocaleString()} 字</span>
          </div>
        )}
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sections.map((section, index) => (
          <div
            key={section.id || index}
            className="bg-white p-4 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                section.level === 'H1' 
                  ? 'bg-slate-800 text-white' 
                  : section.level === 'H2' 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {section.level}
              </span>
              {section.wordCountEstimate && (
                <span className="text-xs text-slate-400">
                  ~{section.wordCountEstimate}w
                </span>
              )}
            </div>
            
            <h3 className={`font-semibold text-slate-900 ${
              section.level === 'H1' 
                ? 'text-xl' 
                : section.level === 'H2' 
                  ? 'text-lg' 
                  : 'text-base'
            }`}>
              {section.title}
            </h3>
            
            {section.description && (
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                {section.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutlinePreview;




