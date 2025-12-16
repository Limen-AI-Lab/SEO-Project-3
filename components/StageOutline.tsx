
import React, { useState, useEffect } from 'react';
import { Article, ProjectStatus, ARTICLE_STATUS, Campaign } from '../types';
import { Send, AlignLeft, Sparkles, MessageSquare, Wand2, Copy, Check, Eye, Edit3, AlertTriangle, Download } from 'lucide-react';
import { generateBlogOutline, refineBlogOutline } from '../services/geminiService';
import { generateClientReviewLink, copyToClipboard } from '../services/linkService';
import { getCampaignWithClients } from '../services/campaignService';
import { 
  parseMarkdownOutline, 
  validateMarkdownOutline,
  OutlineSection 
} from '../services/outlineParser';
import OutlinePreview from './OutlinePreview';

interface Props {
  project: Article;
  onUpdate: (updates: Partial<Article>) => void;
}

const StageOutline: React.FC<Props> = ({ project, onUpdate }) => {
  const [outline, setOutline] = useState(project.outlineContent || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // New states for preview and validation
  const [showPreview, setShowPreview] = useState(false);
  const [parsedOutline, setParsedOutline] = useState<OutlineSection[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Real-time parsing and validation
  useEffect(() => {
    if (outline.trim()) {
      const sections = parseMarkdownOutline(outline);
      setParsedOutline(sections);
      
      const validation = validateMarkdownOutline(outline);
      setValidationErrors(validation.errors);
      setValidationWarnings(validation.warnings);
    } else {
      setParsedOutline([]);
      setValidationErrors([]);
      setValidationWarnings([]);
    }
  }, [outline]);

  const handleSubmit = () => {
    // Validate before submitting
    const validation = validateMarkdownOutline(outline);
    if (!validation.valid) {
      alert('大纲格式有误：\n' + validation.errors.join('\n'));
      return;
    }

    if (outline.trim().length < 10) {
      return alert("Please provide a more detailed outline.");
    }

    // Parse to structured format
    const sections = parseMarkdownOutline(outline);
    
    // Save both markdown and structured data
    onUpdate({ 
      outlineContent: outline,
      outlineSections: sections, // Structured data for Client Portal
      status: ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE
    });
    
    // Generate review link
    const link = generateClientReviewLink(project.id);
    setReviewLink(link);
    setLinkCopied(false);
  };

  const handleCopyLink = async () => {
    if (!reviewLink) return;
    const success = await copyToClipboard(reviewLink);
    if (success) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } else {
      alert('Failed to copy link. Please copy manually.');
    }
  };

  const handleSaveDraft = () => {
    // Save both markdown and structured data
    const sections = parseMarkdownOutline(outline);
    onUpdate({ 
      outlineContent: outline,
      outlineSections: sections 
    });
  };

  const handleAiGenerate = async () => {
    if (outline.trim().length > 10) {
      if (!confirm("This will overwrite the current outline. Continue?")) return;
    }
    
    setIsGenerating(true);
    
    try {
      // Fetch campaign information for context
      const campaign = await getCampaignWithClients(project.campaignId);
      
      // Build comprehensive params object with all available context
      const params = {
        selectedTitle: project.selectedTitle || project.title,
        campaignGoals: campaign?.strategyGoals,
        keywords: campaign?.keywords,
        targetAudience: campaign?.targetAudience,
        clientComments: project.clientComments
      };
      
      const generated = await generateBlogOutline(params);
      if (generated) {
        setOutline(generated);
      }
    } catch (error) {
      console.error('Failed to generate outline:', error);
    }
    
    setIsGenerating(false);
  };

  const handleAiRefine = async () => {
    if (!aiInstruction.trim()) return;
    
    setIsRefining(true);
    const refined = await refineBlogOutline(outline, aiInstruction);
    if (refined) {
      setOutline(refined);
      setAiInstruction('');
    }
    setIsRefining(false);
  };

  const handleExportMarkdown = () => {
    if (!outline.trim()) {
      alert('大纲内容为空，无法导出');
      return;
    }
    
    const blob = new Blob([outline], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `outline-${project.selectedTitle || project.title}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
           <div className="bg-green-100 p-2 rounded-full text-green-700">
              <AlignLeft size={24} />
           </div>
           <div>
             <h3 className="text-green-900 font-semibold">Approved Title Selected</h3>
             <p className="text-green-800 mt-1 text-lg font-bold">"{project.selectedTitle}"</p>
             <p className="text-green-700 text-sm mt-2">Please build the structure based on this direction.</p>
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Editor Column */}
        <div className="flex-1 space-y-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[700px]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Outline Builder</h2>
                <p className="text-slate-500 text-sm mt-1">Define headers and key points.</p>
              </div>
              <button 
                onClick={handleAiGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg shadow hover:shadow-md transition disabled:opacity-70 text-sm font-medium"
              >
                {isGenerating ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                ) : (
                  <Sparkles size={16} />
                )}
                {isGenerating ? 'Drafting...' : 'Generate with Gemini'}
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  showPreview 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {showPreview ? (
                  <>
                    <Edit3 size={16} />
                    编辑模式
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    预览模式
                  </>
                )}
              </button>
              
              {/* 导出按钮 */}
              <button
                onClick={handleExportMarkdown}
                disabled={!outline.trim()}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={16} />
                导出文本
              </button>
              
              <div className="flex-1" />
              
              {parsedOutline.length > 0 && (
                <span className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg">
                  <Check size={14} />
                  已识别 {parsedOutline.length} 个段落
                </span>
              )}
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 font-medium text-sm mb-2">
                  <AlertTriangle size={16} />
                  格式错误
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {validationErrors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && validationErrors.length === 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800 font-medium text-sm mb-2">
                  <AlertTriangle size={16} />
                  建议
                </div>
                <ul className="text-sm text-amber-700 space-y-1">
                  {validationWarnings.map((warn, i) => (
                    <li key={i}>• {warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Refinement Bar */}
            {!showPreview && (
            <div className="flex gap-2 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="relative flex-1">
                   <Wand2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                      type="text" 
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      placeholder="Ask AI to adjust (e.g. 'Add a section on Tax Fraud', 'Make it shorter')..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAiRefine()}
                   />
                </div>
                <button 
                  onClick={handleAiRefine}
                  disabled={isRefining || !aiInstruction.trim()}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  {isRefining ? 'Refining...' : 'Refine'}
                </button>
            </div>
            )}

            {/* Editor or Preview */}
            <div className="flex-1 min-h-0">
              {!showPreview ? (
            <textarea 
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
                  className="w-full h-full p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition resize-none font-mono text-sm leading-relaxed"
                  placeholder={`使用 Markdown 格式输入大纲：

# 主标题
描述内容方向

## 第一节：核心概念
- 要点一
- 要点二

### 子主题 1.1
具体说明

## 第二节：深入分析
...`}
                />
              ) : (
                <OutlinePreview sections={parsedOutline} showStats={true} className="h-full" />
              )}
            </div>
          </div>

          {/* Review Link Display */}
          {reviewLink && (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-indigo-900 mb-1">Client Review Link:</p>
                  <p className="text-xs text-indigo-700 break-all">{reviewLink}</p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex-shrink-0"
                >
                  {linkCopied ? (
                    <>
                      <Check size={16} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button 
              onClick={handleSaveDraft}
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition"
            >
              Save Draft
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={validationErrors.length > 0}
              className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition flex items-center gap-2 shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
              Send Outline
            </button>
          </div>
        </div>

        {/* Client Feedback Sidebar */}
        <div className="w-full lg:w-80 space-y-6">
           {/* Feedback Card */}
           <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-4">
                  <MessageSquare size={18} />
                  <h3>Client Feedback</h3>
              </div>
              
              {project.clientComments.length === 0 ? (
                 <p className="text-sm text-amber-700/70 italic">
                   No specific comments from the client on this project yet. Use the approved title as your main guide.
                 </p>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                   {project.clientComments.map((comment) => (
                      <div key={comment.id} className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                         <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-700">{comment.author}</span>
                            <span className="text-[10px] text-slate-400">{comment.timestamp.toLocaleDateString()}</span>
                         </div>
                         <p className="text-sm text-slate-600">{comment.text}</p>
                      </div>
                   ))}
                </div>
              )}
           </div>

           {/* Project Context Info */}
           <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
               <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Article Details</h3>
               <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-slate-400 block text-xs">Working Title</span>
                    <span className="font-medium text-slate-900">{project.title}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs">Status</span>
                    <span className="font-medium text-blue-600">Outline Development</span>
                  </div>
               </div>
           </div>

           {/* Format Guide */}
           <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
               <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">格式指南</h3>
               <div className="text-xs text-slate-600 space-y-2 font-mono">
                  <p><span className="bg-slate-800 text-white px-1.5 py-0.5 rounded">H1</span> # 主标题</p>
                  <p><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">H2</span> ## 章节标题</p>
                  <p><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border">H3</span> ### 子章节</p>
                  <p className="text-slate-400 mt-3">描述文字放在标题下一行</p>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StageOutline;
