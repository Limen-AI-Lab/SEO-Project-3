
import React, { useState, useEffect } from 'react';
import { Article, ProjectStatus, ARTICLE_STATUS, Campaign, WordCountRange, ArticlePerspective, WORD_COUNT_CONFIG, PERSPECTIVE_CONFIG } from '../types';
import { Send, AlignLeft, Sparkles, MessageSquare, Wand2, Eye, Edit3, AlertTriangle, Download, Pencil, EyeOff, X, Save, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { generateBlogOutline, refineBlogOutline, GenerationResult } from '../services/geminiService';
import { getCampaignWithClients } from '../services/campaignService';
import { 
  parseMarkdownOutline, 
  validateMarkdownOutline,
  OutlineSection 
} from '../services/outlineParser';
import OutlinePreview from './OutlinePreview';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

interface Props {
  project: Article;
  onUpdate: (updates: Partial<Article>) => Promise<void> | void;
}

const StageOutline: React.FC<Props> = ({ project, onUpdate }) => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [outline, setOutline] = useState(project.outlineContent || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  
  // Generation settings states
  const [wordCountRange, setWordCountRange] = useState<WordCountRange>(project.wordCountRange || '1000-2000');
  const [perspective, setPerspective] = useState<ArticlePerspective>(project.perspective || 'third');
  
  // New states for preview and validation
  const [showPreview, setShowPreview] = useState(false);
  const [parsedOutline, setParsedOutline] = useState<OutlineSection[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(project.selectedTitle || '');

  // Feedback ignore/edit state (local, not persisted)
  const [ignoredFeedbackIds, setIgnoredFeedbackIds] = useState<string[]>([]);
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editedFeedbackText, setEditedFeedbackText] = useState<string>('');

  // Reference module state
  const [isReferencesExpanded, setIsReferencesExpanded] = useState(true);

  const mockReferences = [
    {
      id: 5,
      title: "How to Choose the Right VR Headset for Your Needs",
      snippet: "For gaming: Look for headsets with a high refresh rate (90Hz or above), wide field of view, and precise tracking. These features ensure immersive gameplay...",
      type: "Guide",
      date: "Oct 20, 2025",
      url: "#"
    },
    {
      id: 6,
      title: "How to Choose the Right VR Headset: A Complete Guide",
      snippet: "1. Define Your Usage Needs. Before choosing a VR headset, it's essential to clarify your intended use. 2. Types of VR Headsets: Tethered vs. Standalone...",
      type: "Manual",
      date: "Nov 26, 2024",
      url: "#"
    },
    {
      id: 10,
      title: "How to Choose the Right VR Headset? - TechTips",
      snippet: "To determine the right VR-headset, it is helpful to first think about whether you want to use a VR-headset with or without a PC. This defines the category...",
      type: "Review",
      date: "Dec 15, 2024",
      url: "#"
    }
  ];

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

  // Title editing handlers
  const handleTitleSave = () => {
    if (editedTitle.trim()) {
      onUpdate({ selectedTitle: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle(project.selectedTitle || '');
    setIsEditingTitle(false);
  };

  // Feedback ignore/edit handlers
  const handleIgnoreFeedback = (feedbackId: string) => {
    if (ignoredFeedbackIds.includes(feedbackId)) {
      setIgnoredFeedbackIds(ignoredFeedbackIds.filter(id => id !== feedbackId));
    } else {
      setIgnoredFeedbackIds([...ignoredFeedbackIds, feedbackId]);
    }
  };

  const handleStartEditFeedback = (feedbackId: string, currentText: string) => {
    setEditingFeedbackId(feedbackId);
    setEditedFeedbackText(currentText);
  };

  const handleSaveFeedbackEdit = () => {
    if (editingFeedbackId && editedFeedbackText.trim()) {
      const updatedComments = project.clientComments.map(c =>
        c.id === editingFeedbackId ? { ...c, text: editedFeedbackText.trim() } : c
      );
      onUpdate({ clientComments: updatedComments });
    }
    setEditingFeedbackId(null);
    setEditedFeedbackText('');
  };

  const handleCancelFeedbackEdit = () => {
    setEditingFeedbackId(null);
    setEditedFeedbackText('');
  };

  const handleSubmit = () => {
    // Validate before submitting
    const validation = validateMarkdownOutline(outline);
    if (!validation.valid) {
      showToast('Outline format error: ' + validation.errors.join(', '), 'error');
      return;
    }

    if (outline.trim().length < 10) {
      showToast("Please provide a more detailed outline.", 'warning');
      return;
    }

    // Parse to structured format
    const sections = parseMarkdownOutline(outline);
    
    // Save both markdown and structured data
    onUpdate({ 
      outlineContent: outline,
      outlineSections: sections, // Structured data for Client Portal
      status: ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE 
    });
  };

  const handleSaveDraft = async () => {
    try {
      // Save both markdown and structured data
      const sections = parseMarkdownOutline(outline);
      await onUpdate({ 
        outlineContent: outline,
        outlineSections: sections 
      });
      showToast("Progress saved successfully!", 'success');
    } catch (error) {
      console.error('Failed to save outline:', error);
    }
  };

  const handleAiGenerate = async () => {
    if (outline.trim().length > 10) {
      const isConfirmed = await confirm({
        title: 'Overwrite Outline',
        message: 'This will overwrite the current outline. Continue?',
        type: 'warning',
        confirmText: 'Overwrite'
      });
      if (!isConfirmed) return;
    }
    
    setIsGenerating(true);
    
    try {
      // Fetch campaign information for context
      const campaign = await getCampaignWithClients(project.campaignId);
      
      // Filter out ignored feedback before passing to AI
      const activeComments = project.clientComments.filter(
        c => !ignoredFeedbackIds.includes(c.id)
      );
      
      // Build comprehensive params object with all available context
      // Use edited title if available, otherwise fall back to project title
      const params = {
        selectedTitle: editedTitle || project.selectedTitle || project.title,
        campaignGoals: campaign?.strategyGoals,
        keywords: campaign?.keywords,
        targetAudience: campaign?.targetAudience,
        clientComments: activeComments,
        language: project.language,  // Pass target language for outline generation
        wordCountRange: wordCountRange,  // Pass word count range for H2 count
        perspective: perspective  // Pass perspective for writing style
      };
      
      const result = await generateBlogOutline(params);
      if (result.content) {
        setOutline(result.content);
        
        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach(warning => {
            showToast(warning, 'warning');
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate outline:', error);
      showToast('Failed to generate outline', 'error');
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
      showToast('Outline is empty, cannot export', 'warning');
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
           <div className="flex-1">
             <h3 className="text-green-900 font-semibold">Approved Title Selected</h3>
             {isEditingTitle ? (
               <div className="mt-2 flex items-center gap-2">
                 <input
                   type="text"
                   value={editedTitle}
                   onChange={(e) => setEditedTitle(e.target.value)}
                   className="flex-1 px-3 py-2 text-lg font-bold text-green-800 bg-white border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                   autoFocus
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') handleTitleSave();
                     if (e.key === 'Escape') handleTitleCancel();
                   }}
                 />
                 <button
                   onClick={handleTitleSave}
                   className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                   title="Save"
                 >
                   <Save size={18} />
                 </button>
                 <button
                   onClick={handleTitleCancel}
                   className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition"
                   title="Cancel"
                 >
                   <X size={18} />
                 </button>
               </div>
             ) : (
               <div className="mt-1 flex items-center gap-2 group">
                 <p className="text-green-800 text-lg font-bold">"{project.selectedTitle}"</p>
                 <button
                   onClick={() => {
                     setEditedTitle(project.selectedTitle || '');
                     setIsEditingTitle(true);
                   }}
                   className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition opacity-0 group-hover:opacity-100"
                   title="Edit title"
                 >
                   <Pencil size={16} />
                 </button>
               </div>
             )}
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
              <div className="flex items-center gap-3">
                {/* Word Count Range Selector */}
                <select
                  value={wordCountRange}
                  onChange={(e) => {
                    const newValue = e.target.value as WordCountRange;
                    setWordCountRange(newValue);
                    onUpdate({ wordCountRange: newValue });
                  }}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {Object.entries(WORD_COUNT_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
                
                {/* Perspective Selector */}
                <select
                  value={perspective}
                  onChange={(e) => {
                    const newValue = e.target.value as ArticlePerspective;
                    setPerspective(newValue);
                    onUpdate({ perspective: newValue });
                  }}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {Object.entries(PERSPECTIVE_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
                
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
                    Edit Mode
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    Preview
                  </>
                )}
              </button>
              
              {/* Export button */}
              <button
                onClick={handleExportMarkdown}
                disabled={!outline.trim()}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={16} />
                Export
              </button>
              
              <div className="flex-1" />
              
              {parsedOutline.length > 0 && (
                <span className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg">
                  <Check size={14} />
                  {parsedOutline.length} sections detected
                </span>
              )}
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 font-medium text-sm mb-2">
                  <AlertTriangle size={16} />
                  Format Errors
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
                  Suggestions
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
                  placeholder={`Enter outline in Markdown format:

# Main Title
Describe the content direction

## Section 1: Core Concepts
- Key point one
- Key point two

### Subtopic 1.1
Specific details

## Section 2: Deep Dive
...`}
                />
              ) : (
                <OutlinePreview sections={parsedOutline} showStats={true} className="h-full" />
              )}
            </div>
          </div>

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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <MessageSquare size={18} />
                  <h3>Client Feedback</h3>
                </div>
                {ignoredFeedbackIds.length > 0 && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {ignoredFeedbackIds.length} ignored
                  </span>
                )}
              </div>
              
              {project.clientComments.length === 0 ? (
                 <p className="text-sm text-amber-700/70 italic">
                   No specific comments from the client on this project yet. Use the approved title as your main guide.
                 </p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                   {project.clientComments.map((comment) => {
                      const isIgnored = ignoredFeedbackIds.includes(comment.id);
                      const isEditing = editingFeedbackId === comment.id;
                      
                      return (
                        <div 
                          key={comment.id} 
                          className={`p-3 rounded-lg border shadow-sm transition ${
                            isIgnored 
                              ? 'bg-slate-50 border-slate-200 opacity-60' 
                              : 'bg-white border-amber-100'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">{comment.author}</span>
                              {isIgnored && (
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  Ignored
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{comment.timestamp.toLocaleDateString()}</span>
                          </div>
                          
                          {isEditing ? (
                            <div className="mt-2">
                              <textarea
                                value={editedFeedbackText}
                                onChange={(e) => setEditedFeedbackText(e.target.value)}
                                className="w-full p-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={handleCancelFeedbackEdit}
                                  className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveFeedbackEdit}
                                  className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 transition"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className={`text-sm ${isIgnored ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                {comment.text}
                              </p>
                              
                              {/* Action buttons */}
                              <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => handleStartEditFeedback(comment.id, comment.text)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                                  title="Edit feedback"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleIgnoreFeedback(comment.id)}
                                  className={`p-1.5 rounded transition ${
                                    isIgnored 
                                      ? 'text-green-600 hover:bg-green-50' 
                                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                  }`}
                                  title={isIgnored ? 'Include in AI generation' : 'Ignore in AI generation'}
                                >
                                  {isIgnored ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                   })}
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

           {/* References Module */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <button 
                 onClick={() => setIsReferencesExpanded(!isReferencesExpanded)}
                 className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition text-left"
               >
                 <div className="flex items-center gap-2">
                   <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">References</h3>
                   <span className="text-xs font-normal text-slate-500 normal-case bg-white border border-slate-200 px-1.5 py-0.5 rounded-full">3</span>
                 </div>
                 <div className="text-slate-400">
                   {isReferencesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                 </div>
               </button>
               
               {isReferencesExpanded && (
                 <div className="p-5 pt-2 space-y-5">
                    <p className="text-xs text-slate-500 mb-4">
                      Select relevant ideas from search results matching your topic.
                    </p>
                    {mockReferences.map((ref) => (
                      <div key={ref.id} className="group">
                        <div className="flex items-start gap-3">
                           <span className="text-sm font-medium text-slate-400 min-w-[1.25rem]">{ref.id}</span>
                           <div>
                             <a href={ref.url} className="block text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline mb-1 leading-snug">
                               {ref.title}
                             </a>
                             <p className="text-xs text-slate-600 line-clamp-3 mb-2 leading-relaxed">
                               {ref.snippet}
                             </p>
                             <div className="flex items-center gap-2 text-[10px] text-slate-400">
                               <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                 {ref.type}
                               </span>
                               <span>{ref.date}</span>
                             </div>
                           </div>
                        </div>
                      </div>
                    ))}
                 </div>
               )}
           </div>

           {/* Format Guide */}
           <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
               <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Format Guide</h3>
               <div className="text-xs text-slate-600 space-y-2 font-mono">
                  <p><span className="bg-slate-800 text-white px-1.5 py-0.5 rounded">H1</span> # Main Title</p>
                  <p><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">H2</span> ## Section</p>
                  <p><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border">H3</span> ### Subsection</p>
                  <p className="text-slate-400 mt-3">Add description below headers</p>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StageOutline;
