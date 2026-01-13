
import React, { useState, useEffect, useRef } from 'react';
import { Article, ProjectStatus, ARTICLE_STATUS, RevisionHistoryEntry, Comment, ClientEdit } from '../types';
import { generateBlogDraft, refineBlogContent, generatePostMetadata, refineSection, suggestImagePlacement } from '../services/geminiService';
import { 
  Send, CheckCircle, Wand2, Sparkles, Globe, FileText, MessageSquare, 
  RefreshCw, LayoutTemplate, PenTool, PanelLeftClose, PanelLeftOpen, 
  PanelRightClose, PanelRightOpen, Maximize2, Minimize2, Eye, GitGraph, Code, ArrowRight, X,
  Paperclip, Image as ImageIcon, Trash2, ArrowUp, ArrowDown,
  History, ChevronDown, ChevronUp, Edit3, Plus, Minus, Undo2, RotateCcw, Save,
  Copy, Download, Settings, BookOpen, Bold, Italic, Underline, Strikethrough,
  Link2, Type, Eraser, List, Quote,
  Edit
} from 'lucide-react';
import { publishToCMS } from '../services/cmsService';
import supabase from '../services/supabaseClient.js';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { incrementUserUsedCount } from '../services/inviteService';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';

/**
 * Parse revision history edits to Comment[] format for display
 * @param historyEntry - A single revision history entry containing edits
 * @returns Array of Comment objects formatted for display
 */
function parseHistoryEdits(historyEntry: RevisionHistoryEntry): Comment[] {
  const comments: Comment[] = [];
  const timestamp = historyEntry.timestamp ? new Date(historyEntry.timestamp) : new Date();
  
  if (!historyEntry.edits || !Array.isArray(historyEntry.edits)) {
    return comments;
  }
  
  historyEntry.edits.forEach((edit, index) => {
    let editText = '';
    const actionType = edit.action_type;
    const editAuthor = edit.contact_name || 'Client';
    const editTimestamp = edit.created_at ? new Date(edit.created_at) : timestamp;
    
    // Format the edit content for display
    if (actionType === 'modify') {
      const oldContent = edit.original_content?.content || edit.original_content?.title || JSON.stringify(edit.original_content);
      const newContent = edit.suggested_content?.content || edit.suggested_content?.title || JSON.stringify(edit.suggested_content);
      const oldPreview = typeof oldContent === 'string' ? oldContent.substring(0, 50) : String(oldContent).substring(0, 50);
      editText = `[${oldPreview}${oldContent.length > 50 ? '...' : ''}] Modification Suggestion`;
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
        id: `history-edit-${edit.id || index}-${Date.now()}`,
        author: editAuthor,
        text: editText,
        timestamp: editTimestamp,
        editType: actionType
      });
    }
  });
  
  return comments;
}

interface Props {
  project: Article;
  onUpdate: (updates: Partial<Article>) => Promise<void> | void;
  cmsId?: string;
}

// Mock References Data
const MOCK_REFERENCES = [
  {
    id: 1,
    title: "The 9 Best AI SEO Agencies in 2025",
    snippet: "The 9 Best AI SEO Agencies in 2025; Digital Elevator - Best for SMBs · Small businesses to mid-market enterprise;...",
    date: "7 days ago",
    url: "#"
  },
  {
    id: 2,
    title: "8 AI SEO Tools We Absolutely Love Used By Experts",
    snippet: "Discover the best AI tools for scaling your SEO efforts, including ChatGPT, Semrush, and more, to enhance your content...",
    date: "7 days ago",
    url: "#"
  },
  {
    id: 3,
    title: "How AI is Changing SEO: What You Need to Know",
    snippet: "AI is revolutionizing search engine optimization. Learn how search engines are using AI and how you can adapt your strategy.",
    date: "2 weeks ago",
    url: "#"
  }
];

const StageDraft: React.FC<Props> = ({ project, onUpdate, cmsId }) => {
  const { user, isAdminUser } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  // We maintain 'blocks' as internal state, sync to 'content' (markdown) on save
  const [isSyncing, setIsSyncing] = useState(false);

  // Metadata State
  // slug and intro are removed from UI but kept in state for now to avoid breaking save logic immediately, 
  // though we will ignore them in UI.
  // actually, let's remove them from UI logic completely.
  const [summary, setSummary] = useState(project.seoSummary || '');
  const [coverImage, setCoverImage] = useState(project.coverImage || '');
  const [isUploading, setIsUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  // AI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isMetaGenerating, setIsMetaGenerating] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');
  
  // Multi-Modal AI State
  const [attachedFile, setAttachedFile] = useState<{ name: string, data: string, type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ anchor: string, reason: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'outline' | 'feedback' | 'configuration'>('outline');
  const [showHistory, setShowHistory] = useState(false);
  const [showReferencePopup, setShowReferencePopup] = useState(false);
  const [isRefineBarExpanded, setIsRefineBarExpanded] = useState(false);

  // --- Configuration State (Local UI only) ---
  const [articleRequirements, setArticleRequirements] = useState('');
  const [structureConfig, setStructureConfig] = useState({
    keyPoints: true,
    faq: true
  });

  // --- Editable Outline State ---
  const [editableOutline, setEditableOutline] = useState(project.outlineContent || '');
  const [outlineHistory, setOutlineHistory] = useState<string[]>([]); // History stack for undo
  const [originalOutline] = useState(project.outlineContent || ''); // Original outline for reset
  const [hasOutlineChanges, setHasOutlineChanges] = useState(false);

  // --- Draft Content State ---
  const [localDraftContent, setLocalDraftContent] = useState(project.draftContent || '');
  const editorRef = useRef<RichTextEditorRef>(null);

  // Copy Menu State
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');

  // Update local content when project changes (from parent/database)
  useEffect(() => {
    if (project.draftContent !== undefined) {
      setLocalDraftContent(project.draftContent);
    }
  }, [project.draftContent]);

  // --- Layout State ---
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(320);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  
  // --- Focus & View Mode State ---
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'preview' | 'visual'>('markdown');
  
  // --- Comment Navigation State ---
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sidebarRef = useRef<{ startX: number, startWidth: number } | null>(null);
  useEffect(() => {
    if (project.outlineContent && project.outlineContent !== editableOutline && !hasOutlineChanges) {
      setEditableOutline(project.outlineContent);
    }
  }, [project.outlineContent]);

  // --- Outline Editing Handlers ---
  const handleOutlineChange = (newContent: string) => {
    // Save current state to history before making changes
    setOutlineHistory(prev => [...prev, editableOutline]);
    setEditableOutline(newContent);
    setHasOutlineChanges(newContent !== project.outlineContent);
  };

  const handleUndoOutline = () => {
    if (outlineHistory.length > 0) {
      const previousState = outlineHistory[outlineHistory.length - 1];
      setOutlineHistory(prev => prev.slice(0, -1));
      setEditableOutline(previousState);
      setHasOutlineChanges(previousState !== project.outlineContent);
    }
  };

  const handleResetOutline = async () => {
    const isConfirmed = await confirm({
      title: 'Reset Outline',
      message: 'Are you sure you want to restore the original outline? All edits will be lost.',
      type: 'warning',
      confirmText: 'Reset',
    });

    if (isConfirmed) {
      setOutlineHistory(prev => [...prev, editableOutline]);
      setEditableOutline(originalOutline);
      setHasOutlineChanges(originalOutline !== project.outlineContent);
    }
  };

  const handleSaveOutline = () => {
    onUpdate({ outlineContent: editableOutline });
    setHasOutlineChanges(false);
    setOutlineHistory([]); // Clear history after save
  };

  useEffect(() => {
    // Initial sync or setup logic if needed
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [project.draftContent]);

  // --- Resizing Logic ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const delta = e.clientX - sidebarRef.current!.startX;
        const newWidth = Math.max(240, Math.min(500, sidebarRef.current!.startWidth + delta));
        setLeftWidth(newWidth);
      }
      if (isResizingRight) {
        const delta = sidebarRef.current!.startX - e.clientX;
        const newWidth = Math.max(240, Math.min(500, sidebarRef.current!.startWidth + delta));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      sidebarRef.current = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const startResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLeftCollapsed) return;
    setIsResizingLeft(true);
    sidebarRef.current = { startX: e.clientX, startWidth: leftWidth };
  };

  const startResizeRight = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isRightCollapsed) return;
    setIsResizingRight(true);
    sidebarRef.current = { startX: e.clientX, startWidth: rightWidth };
  };

  // --- Drag & Drop & File Handling ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files) as File[]);
    }
  };

  const handleFiles = (files: File[]) => {
    // If used via upload button, attach to AI Context
    // If dropped, insert into editor
    // For simplicity, we'll assume Drop = Insert, Paperclip = Attach to AI
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            // Check if this was a drop event or input change? 
            // We distinguish based on where the function is called.
            // But here we reuse the reader.
            
            // If called from the Editor Drop Zone
            // We insert an image block
          }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleEditorDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
       const reader = new FileReader();
       reader.onload = (ev) => {
         const src = ev.target?.result as string;
         const currentMd = localDraftContent;
         const imageMarkdown = `\n\n![${file.name}](${src})\n\n`;
         onUpdate({ draftContent: currentMd + imageMarkdown });
       };
       reader.readAsDataURL(file);
    }
  };

  const handleAiAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFile({
          name: file.name,
          data: ev.target?.result as string,
          type: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- AI Actions ---
  const handleGenerateDraft = async () => {
    if (!editableOutline.trim()) {
      showToast("No outline found. Please add an outline first.", 'error');
      return;
    }
    
    // Auto-save the edited outline before generating
    if (hasOutlineChanges) {
      onUpdate({ outlineContent: editableOutline });
      setHasOutlineChanges(false);
      setOutlineHistory([]);
    }
    
    setIsGenerating(true);
    const draft = await generateBlogDraft({
      title: project.selectedTitle || project.title, 
      outline: editableOutline, // Use the edited outline
      comments: project.clientComments, 
      clientName: "Client",
      wordCountRange: project.wordCountRange,
      perspective: project.perspective,
      language: project.language
    });
    if (draft) {
      onUpdate({ draftContent: draft });
      
      // Increment user used count after successful generation
      if (user?.id) {
        incrementUserUsedCount(user.id).catch(err => {
          console.error('Failed to increment user used count:', err);
        });
      }
    }
    setIsGenerating(false);
  };

  const handleRefine = async () => {
    if (!refineInstruction.trim()) return;
    
    // Multi-modal check
    if (attachedFile && attachedFile.type.startsWith('image/')) {
        setIsRefining(true);
        // Smart Insertion Logic
        const currentMd = project.draftContent || '';
        const suggestion = await suggestImagePlacement(currentMd, attachedFile.data, refineInstruction);
        
        if (suggestion && suggestion.suggestedTextAnchor) {
           setAiSuggestion({
             anchor: suggestion.suggestedTextAnchor,
             reason: suggestion.reason
           });
        } else {
           showToast("Could not determine placement. " + suggestion.reason, 'error');
        }
        setIsRefining(false);
        return;
    }

    // Standard Text Refinement
    setIsRefining(true);
    const currentMd = project.draftContent || '';
    const refined = await refineBlogContent(currentMd, refineInstruction);
    if (refined) {
      onUpdate({ draftContent: refined });
      setRefineInstruction('');
    }
    setIsRefining(false);
  };

  const confirmImageInsertion = () => {
    if (!aiSuggestion || !attachedFile) return;
    
    const currentMd = project.draftContent || '';
    const imageMarkdown = `\n\n![Inserted by AI](${attachedFile.data})\n\n`;
    
    // Find anchor text in markdown
    if (currentMd.includes(aiSuggestion.anchor)) {
      const newMd = currentMd.replace(aiSuggestion.anchor, `${aiSuggestion.anchor}${imageMarkdown}`);
      onUpdate({ draftContent: newMd });
    } else {
      showToast("Could not locate the anchor text to insert image. Inserting at the end.", 'warning');
      onUpdate({ draftContent: currentMd + imageMarkdown });
    }
    
      setAiSuggestion(null);
      setAttachedFile(null);
    setRefineInstruction('');
  };

  const handleGenerateMetadata = async () => {
    const md = project.draftContent || '';
    if (md.length < 100) {
      showToast("Write some content first.", 'warning');
      return;
    }
    setIsMetaGenerating(true);
    const meta = await generatePostMetadata(md, project.selectedTitle || project.title);
    if (meta) {
      setSummary(meta.summary);
    }
    setIsMetaGenerating(false);
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    // Basic validation
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      showToast("Only JPG, PNG, GIF, and WebP formats are supported.", 'error');
      return;
    }
    
    // File size validation (e.g., 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size must be less than 5MB.", 'error');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${project.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('cover_photo')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('cover_photo')
        .getPublicUrl(filePath);

      setCoverImage(data.publicUrl);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showToast(`Upload failed: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUploading(false);
      // Reset input
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const removeCoverImage = async () => {
    const isConfirmed = await confirm({
      title: 'Remove Cover Image',
      message: 'Remove cover image?',
      type: 'warning',
      confirmText: 'Remove'
    });
    
    if(isConfirmed) {
      setCoverImage('');
    }
  };

  const handleCopy = async (type: 'md' | 'txt') => {
    let textToCopy = '';
    
    if (type === 'md') {
      textToCopy = localDraftContent;
          } else {
      textToCopy = editorRef.current?.getPlainText() || localDraftContent.replace(/[#*`_~\[\]()]/g, ''); // Fallback strip
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('success');
      setCopyMenuOpen(false);
      showToast(`Content copied as ${type === 'md' ? 'Markdown' : 'Plain Text'}`, 'success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast("Copy failed", 'error');
    }
  };

  const handleDownloadContent = () => {
    const md = project.draftContent || '';
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.selectedTitle || project.title || 'draft'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveDraft = async () => {
    console.log('do Saving draft:', localDraftContent);
    // Clear any pending debounced updates
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    try {
      await onUpdate({ 
        draftContent: localDraftContent,
      category: cmsId || '',
      seoSummary: summary,
      coverImage
    });
      showToast("Progress saved successfully!", 'success');
    } catch (error) {
      console.error('Failed to save draft:', error);
      showToast("Failed to save progress.", 'error');
    }
  };

  const handleSubmitToClient = async () => {
    if (localDraftContent.trim().length < 100) {
      showToast("Draft is too short.", 'warning');
      return;
    }

    // Clear any pending debounced updates
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    await onUpdate({ 
      draftContent: localDraftContent,
      category: cmsId || '',
      seoSummary: summary,
      coverImage,
      status: ARTICLE_STATUS.AWAITING_REVIEW_DRAFT as unknown as ProjectStatus 
    });
    showToast("Submitted for review successfully!", 'success');
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishToCMS = async () => {
    // Validate required fields
    if (!summary) {
      showToast("Please fill in the Short Text summary before publishing.", 'warning');
      return;
    }

    // Get the markdown content
    const markdownContent = project.draftContent || '';
    if (!markdownContent || markdownContent.trim().length < 50) {
      showToast("Content is too short. Please complete the article content before publishing.", 'warning');
      return;
    }

    // Get the article title
    const articleTitle = project.selectedTitle || project.title;
    if (!articleTitle) {
      showToast("Article title cannot be empty.", 'error');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Publish to CMS',
      message: 'Are you sure you want to publish this content to CMS?',
      confirmText: 'Publish',
      type: 'default'
    });

    if (!isConfirmed) {
      return;
    }

    setIsPublishing(true);

    try {
      // Prepare CMS data
      const cmsData = {
        article_id: project.id,
        title: articleTitle,
        create_date: new Date().toISOString(), // Current date when publishing
        content: markdownContent, // Markdown formatted content
        short_text: summary, // Short Text from Metadata
        cover_image: coverImage || undefined,
        cms_category: cmsId || undefined
      };

      console.log('📤 Publishing to CMS:', cmsData);

      // Publish to CMS table
      const publishedArticle = await publishToCMS(cmsData);

      if (publishedArticle) {
        // Save draft and update status
        handleSaveDraft();
        onUpdate({ status: ProjectStatus.PUBLISHED });
        
        showToast(`✅ Article successfully published to CMS!`, 'success');
      }
    } catch (error: any) {
      console.error('❌ Publish to CMS failed:', error);
      showToast(`Publish failed: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const renderVisualStructure = (markdown: string) => {
    const lines = (markdown || '').split('\n');
    const headers = lines.filter(line => line.startsWith('#')).map(line => {
      const levelMatch = line.match(/^(#+)/);
      const level = levelMatch ? levelMatch[0].length : 0;
      return { level, text: line.replace(/^#+\s*/, '') };
    });

    return (
      <div className="flex flex-col gap-3 max-w-2xl mx-auto pb-6">
        <div className="text-center mb-8">
          <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold">Article Flow</h3>
        </div>
        {headers.length === 0 && <p className="text-slate-400 text-center italic">No headers found.</p>}
        {headers.map((h, i) => (
          <div key={i} className="flex items-center gap-4 group">
             <div className="flex flex-col items-center gap-1 w-12 flex-shrink-0">
               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border ${h.level === 1 ? 'bg-indigo-600 text-white border-indigo-600' : h.level === 2 ? 'bg-white text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                 H{h.level}
               </div>
               {i < headers.length - 1 && <div className="w-0.5 h-6 bg-slate-200 group-hover:bg-indigo-200 transition"></div>}
             </div>
             <div className={`flex-1 px-3 py-2 rounded-lg border ${h.level === 1 ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-200'} shadow-sm`}>
               <p className={`font-medium ${h.level === 1 ? 'text-indigo-900 text-base' : 'text-slate-700 text-sm'}`}>{h.text}</p>
             </div>
          </div>
        ))}
      </div>
    );
  };

  const isApproved = project.status === ProjectStatus.DRAFT_APPROVED || project.status === ProjectStatus.PUBLISHED;
  const isPublished = project.status === ProjectStatus.PUBLISHED;
  
  // 🔒 CMS 发布功能锁定控制
  // 当前：全局锁定，防止测试用户误触
  // 未来：可改为基于用户角色判断，如 !user?.isAdmin 或 !hasPermission('cms_publish')
  const isCMSPublishLocked = true;

  if (isPublished) {
    return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-fade-in">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <Globe size={48} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Successfully Published</h2>
            <p className="text-slate-500 mt-2 max-w-md">
                The article is now live on the Agency CMS. The client can now import it to their website.
            </p>
        </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden gap-1 transition-all relative">

      {/* --- LEFT COLUMN: Context --- */}
      <div 
        className={`flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out ${isResizingLeft ? 'duration-0' : ''}`}
        style={{ width: isLeftCollapsed ? '48px' : `${leftWidth}px` }}
      >
        {/* ... (Left Column Same as Before) ... */}
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col h-full">
          <div className={`flex items-center ${isLeftCollapsed ? 'justify-center py-4 flex-col gap-4' : 'justify-between px-2'} border-b border-slate-100 min-h-[50px]`}>
             {isLeftCollapsed ? (
               <button onClick={() => setIsLeftCollapsed(false)} className="text-slate-400 hover:text-indigo-600 transition">
                 <PanelLeftOpen size={20} />
               </button>
             ) : (
                <>
                  <div className="flex flex-1">
                    <button 
                      onClick={() => setActiveTab('configuration')}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${activeTab === 'configuration' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Settings size={16} /> 
                      <span className="hidden sm:inline">Config</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('outline')}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${activeTab === 'outline' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                      <FileText size={16} /> 
                      <span className="hidden sm:inline">Outline</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('feedback')}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${activeTab === 'feedback' ? 'text-amber-600 border-amber-600 bg-amber-50/30' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                      <MessageSquare size={16} /> 
                      <span className="hidden sm:inline">Feedback</span>
                      {project.clientComments.length > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full">{project.clientComments.length}</span>
                      )}
                    </button>
                  </div>
                  <button onClick={() => setIsLeftCollapsed(true)} className="ml-2 text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition">
                    <PanelLeftClose size={16} />
                  </button>
                </>
             )}
          </div>

          <div className="flex-1 overflow-hidden relative bg-slate-50/30">
             {isLeftCollapsed ? (
               <div className="h-full w-full flex flex-col items-center py-6 gap-8">
                 {/* Empty state when collapsed */}
               </div>
             ) : (
               <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                  {activeTab === 'configuration' && (
                    <div className="p-4 space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-700">Requirements for article</h3>
                        <textarea
                          value={articleRequirements}
                          onChange={(e) => setArticleRequirements(e.target.value)}
                          className="w-full h-32 p-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 focus:outline-none resize-none transition shadow-sm hover:border-slate-300 bg-white"
                          placeholder="My Brand Name is..."
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-700">Article structure</h3>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Add key points</span>
                          <button 
                            onClick={() => setStructureConfig(prev => ({...prev, keyPoints: !prev.keyPoints}))}
                            className={`w-11 h-6 rounded-full transition-colors relative ${structureConfig.keyPoints ? 'bg-indigo-600' : 'bg-slate-200'}`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${structureConfig.keyPoints ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">FAQ</span>
                          <button 
                            onClick={() => setStructureConfig(prev => ({...prev, faq: !prev.faq}))}
                            className={`w-11 h-6 rounded-full transition-colors relative ${structureConfig.faq ? 'bg-indigo-600' : 'bg-slate-200'}`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${structureConfig.faq ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'outline' && (
                    <div className="flex flex-col h-full">
                      {/* Outline Toolbar */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleUndoOutline}
                            disabled={outlineHistory.length === 0}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Undo last step"
                          >
                            <Undo2 size={14} />
                          </button>
                          <button
                            onClick={handleResetOutline}
                            disabled={editableOutline === originalOutline}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Reset to original outline"
                          >
                            <RotateCcw size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasOutlineChanges && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              Unsaved
                            </span>
                          )}
                          <button
                            onClick={handleSaveOutline}
                            disabled={!hasOutlineChanges}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Save outline"
                          >
                            <Save size={12} />
                            Save
                          </button>
                        </div>
                      </div>
                      
                      {/* Editable Outline Textarea */}
                      <textarea
                        value={editableOutline}
                        onChange={(e) => handleOutlineChange(e.target.value)}
                        readOnly={isApproved}
                        className={`flex-1 w-full resize-none outline-none border rounded-xl p-4 text-slate-700 font-mono text-xs leading-relaxed transition custom-scrollbar shadow-sm ${
                          isApproved 
                            ? 'bg-slate-50 border-slate-100 cursor-not-allowed text-slate-400' 
                            : 'bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-slate-300'
                        }`}
                        placeholder="Edit outline content here...&#10;&#10;# Heading&#10;## Subheading&#10;### Sub-subheading"
                        style={{ minHeight: '300px' }}
                      />
                      
                      {/* Edit Hint */}
                      <p className="text-[10px] text-slate-400 mt-2 text-center">
                        Edit the outline directly, AI will generate content based on the modified outline
                      </p>
                    </div>
                  )}

                  {activeTab === 'feedback' && (
                    <div className="space-y-4">
                      {/* Revision Round Badge */}
                      {project.revisionRound && project.revisionRound > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                          <History size={14} className="text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700">
                            Round {project.revisionRound} Review
                          </span>
                        </div>
                      )}
                      
                      {/* Current Round Comments */}
                      {project.clientComments.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <MessageSquare className="mx-auto mb-2 opacity-50" size={24} />
                            <p className="text-xs italic">No feedback provided yet.</p>
                          </div>
                        ) : (
                          project.clientComments.map((c: Comment) => {
                            // Determine style based on editType
                            let bgColor = 'bg-amber-50/50';
                            let borderColor = 'border-amber-100/60';
                            let avatarBg = 'bg-amber-200';
                            let avatarText = 'text-amber-800';
                            let icon = null;
                            
                            if (c.editType === 'modify') {
                              bgColor = 'bg-yellow-50';
                              borderColor = 'border-yellow-200';
                              avatarBg = 'bg-yellow-200';
                              avatarText = 'text-yellow-800';
                              icon = <Edit3 size={10} />;
                            } else if (c.editType === 'delete') {
                              bgColor = 'bg-red-50';
                              borderColor = 'border-red-200';
                              avatarBg = 'bg-red-200';
                              avatarText = 'text-red-800';
                              icon = <Minus size={10} />;
                            } else if (c.editType === 'add') {
                              bgColor = 'bg-green-50';
                              borderColor = 'border-green-200';
                              avatarBg = 'bg-green-200';
                              avatarText = 'text-green-800';
                              icon = <Plus size={10} />;
                            }
                            
                            return (
                              <div 
                                key={c.id} 
                                className={`${bgColor} p-3 rounded-lg border ${borderColor} shadow-sm relative group hover:shadow-md transition`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-1.5">
                                      <div className={`w-5 h-5 rounded-full ${avatarBg} flex items-center justify-center text-[10px] font-bold ${avatarText}`}>
                                          {icon || c.author.charAt(0)}
                                      </div>
                                      <span className="text-xs font-bold text-slate-700">{c.author}</span>
                                      {c.editType && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                          c.editType === 'modify' ? 'bg-yellow-100 text-yellow-700' :
                                          c.editType === 'delete' ? 'bg-red-100 text-red-700' :
                                          c.editType === 'add' ? 'bg-green-100 text-green-700' : ''
                                        }`}>
                                          {c.editType === 'modify' ? 'Modify' : c.editType === 'delete' ? 'Delete' : 'Add'}
                                        </span>
                                      )}
                                      {c.targetBlockId && (
                                        <ArrowRight size={10} className="text-indigo-400" />
                                      )}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{c.text}</p>
                                <p className="text-[10px] text-slate-400 mt-2 text-right">{c.timestamp.toLocaleDateString()}</p>
                              </div>
                            );
                          })
                        )}
                      
                      {/* Revision History Section */}
                      {project.revisionHistory && project.revisionHistory.length > 0 && (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="w-full flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                          >
                            <div className="flex items-center gap-2">
                              <History size={14} className="text-slate-500" />
                              <span className="text-xs font-medium text-slate-600">
                                Revision History ({project.revisionHistory.length} rounds)
                              </span>
                            </div>
                            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          
                          {showHistory && (
                            <div className="mt-3 space-y-4">
                              {project.revisionHistory.map((historyEntry: RevisionHistoryEntry, historyIndex: number) => (
                                <div key={historyIndex} className="border border-slate-200 rounded-lg overflow-hidden">
                                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-600">
                                        Round {historyEntry.round}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {historyEntry.timestamp ? new Date(historyEntry.timestamp).toLocaleDateString() : ''}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-3 space-y-2 bg-white/50">
                                    {/* General Comments from history */}
                                    {historyEntry.generalComments && (
                                      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                        <div className="font-semibold text-slate-700 mb-1">General Feedback:</div>
                                        {historyEntry.generalComments}
                                      </div>
                                    )}
                                    {/* Section/Content Comments from history */}
                                    {(historyEntry.sectionComments || historyEntry.contentComments || []).length > 0 && (
                                      <div className="space-y-2">
                                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                          Comments ({((historyEntry.sectionComments || []).length + (historyEntry.contentComments || []).length)})
                                        </div>
                                        {(historyEntry.sectionComments || historyEntry.contentComments || []).map((hc: any, hcIndex: number) => (
                                          <div key={hcIndex} className="text-xs text-slate-600 bg-amber-50/30 p-2 rounded border border-amber-100/50">
                                            {hc.targetId && <span className="text-[10px] text-slate-400 font-mono">[{hc.targetId}] </span>}
                                            {hc.text}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Edits from history - Detailed display */}
                                    {historyEntry.edits && historyEntry.edits.length > 0 && (
                                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-200">
                                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                          Edit Suggestions ({historyEntry.edits.length})
                                        </div>
                                        {parseHistoryEdits(historyEntry).map((editComment: Comment) => {
                                          // Determine style based on editType
                                          let bgColor = 'bg-amber-50/50';
                                          let borderColor = 'border-amber-100/60';
                                          let avatarBg = 'bg-amber-200';
                                          let avatarText = 'text-amber-800';
                                          let icon = null;
                                          
                                          if (editComment.editType === 'modify') {
                                            bgColor = 'bg-yellow-50';
                                            borderColor = 'border-yellow-200';
                                            avatarBg = 'bg-yellow-200';
                                            avatarText = 'text-yellow-800';
                                            icon = <Edit3 size={10} />;
                                          } else if (editComment.editType === 'delete') {
                                            bgColor = 'bg-red-50';
                                            borderColor = 'border-red-200';
                                            avatarBg = 'bg-red-200';
                                            avatarText = 'text-red-800';
                                            icon = <Minus size={10} />;
                                          } else if (editComment.editType === 'add') {
                                            bgColor = 'bg-green-50';
                                            borderColor = 'border-green-200';
                                            avatarBg = 'bg-green-200';
                                            avatarText = 'text-green-800';
                                            icon = <Plus size={10} />;
                                          }
                                          
                                          return (
                                            <div key={editComment.id} className={`${bgColor} p-3 rounded-lg border ${borderColor} shadow-sm`}>
                                              <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-1.5">
                                                  <div className={`w-5 h-5 rounded-full ${avatarBg} flex items-center justify-center text-[10px] font-bold ${avatarText}`}>
                                                    {icon || editComment.author.charAt(0)}
                                                  </div>
                                                  <span className="text-xs font-bold text-slate-700">{editComment.author}</span>
                                                  {editComment.editType && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                                      editComment.editType === 'modify' ? 'bg-yellow-100 text-yellow-700' :
                                                      editComment.editType === 'delete' ? 'bg-red-100 text-red-700' :
                                                      editComment.editType === 'add' ? 'bg-green-100 text-green-700' : ''
                                                    }`}>
                                                      {editComment.editType === 'modify' ? 'Modify' : editComment.editType === 'delete' ? 'Delete' : 'Add'}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{editComment.text}</p>
                                              <p className="text-[10px] text-slate-400 mt-2 text-right">
                                                {editComment.timestamp.toLocaleDateString()}
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
               </div>
             )}
          </div>

          {!isLeftCollapsed && (
            <div className="p-4 border-t border-slate-100 bg-white z-10 relative">
               <button 
                onClick={handleGenerateDraft} 
                disabled={isGenerating || isApproved}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all transform active:scale-95 ${
                  isApproved 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' 
                    : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg'
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> 
                    Generate Draft
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- RESIZER LEFT --- */}
      <div 
        className={`w-4 -mx-2 z-20 flex items-center justify-center cursor-col-resize group flex-shrink-0 select-none ${isLeftCollapsed ? 'pointer-events-none' : ''}`}
        onMouseDown={startResizeLeft}
      >
        <div className={`w-1 h-12 rounded-full transition-colors ${isResizingLeft ? 'bg-indigo-500' : 'bg-slate-200 group-hover:bg-indigo-400'} ${isLeftCollapsed ? 'opacity-0' : ''}`} />
      </div>

      {/* --- MIDDLE COLUMN: Editor --- */}
      <div className="flex-1 flex flex-col relative h-full min-w-[300px]">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden relative group">
          
          {/* Toolbar */}
          <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 md:px-6 bg-white shrink-0">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-slate-500">
                   <PenTool size={16} />
                   <span className="text-sm font-medium text-slate-900 hidden sm:inline">Drafting Canvas</span>
                </div>
                <div className="h-4 w-px bg-slate-200"></div>
                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                  {localDraftContent.split(/\s+/).filter(Boolean).length} words
                </span>
                <div className="h-4 w-px bg-slate-200 ml-1"></div>
                
                {/* Reference Menu in Main Toolbar */}
                <div className="relative">
                  <button
                     onClick={() => localDraftContent.trim() && setShowReferencePopup(!showReferencePopup)}
                     disabled={!localDraftContent.trim()}
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                       localDraftContent.trim() 
                         ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-100' 
                         : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                     }`}
                  >
                     <BookOpen size={14} />
                     Reference
                  </button>
                  
                  {/* Reference Popup */}
                  {showReferencePopup && (
                    <div className="absolute top-full left-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-left z-50">
                       <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4" />
                            <span className="text-xs font-bold text-slate-700">References ({MOCK_REFERENCES.length})</span>
                          </div>
                          <button onClick={() => setShowReferencePopup(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={14} />
                          </button>
                       </div>
                       <div className="p-2 bg-slate-50/30">
                          <p className="text-[10px] text-slate-500 px-2 py-1">Select articles from search results that match your chosen idea type.</p>
                          <div className="space-y-2 mt-1 max-h-80 overflow-y-auto">
                             {MOCK_REFERENCES.map(ref => (
                               <div key={ref.id} className="p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition cursor-pointer group">
                                  <a href={ref.url} className="block group-hover:text-indigo-700 transition">
                                    <h4 className="text-sm font-medium text-slate-800 mb-1 group-hover:text-indigo-700 line-clamp-1">{ref.title}</h4>
                                  </a>
                                  <p className="text-xs text-slate-600 line-clamp-3 mb-2 leading-relaxed">{ref.snippet}</p>
                                  <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Recommended</span>
                                     <span className="text-[10px] text-slate-400">| {ref.date}</span>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  )}
                </div>
             </div>
             
             {isFocusMode && (
                <div className="flex bg-slate-100 p-1 rounded-lg">
                   {/* <button onClick={() => setViewMode('markdown')} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'markdown' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Code size={12} /> Markdown</button> */}
                   <button onClick={() => setViewMode('preview')} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Edit size={12} /> Editor</button>
                   <button onClick={() => setViewMode('visual')} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'visual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><GitGraph size={12} /> Structure</button>
                </div>
             )}
             
             <div className="flex items-center gap-2">
               
               {/* Copy Content Dropdown moved from RichTextEditor */}
               <div className="relative">
               <button 
                   onClick={() => setCopyMenuOpen(!copyMenuOpen)}
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition"
               >
                    {copyStatus === 'success' ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copyStatus === 'success' ? 'Copied!' : 'Copy'}
                    <ChevronDown size={12} className={`transition-transform duration-200 ${copyMenuOpen ? 'rotate-180' : ''}`} />
               </button>
                 
                 {copyMenuOpen && (
                   <>
                     <div className="fixed inset-0 z-30" onClick={() => setCopyMenuOpen(false)} />
                     <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-2xl border border-slate-100 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                       <button 
                         onClick={() => handleCopy('md')} 
                         className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors group text-left"
                       >
                         <div className="p-1 rounded bg-slate-100 group-hover:bg-indigo-100 transition-colors">
                           <FileText size={14} />
                         </div>
                         <div className="flex flex-col items-start">
                           <span className="font-medium">Markdown</span>
                           <span className="text-[10px] text-slate-400 text-left">Preserve formatting</span>
                         </div>
                       </button>
                       <button 
                         onClick={() => handleCopy('txt')} 
                         className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors group text-left"
                       >
                         <div className="p-1 rounded bg-slate-100 group-hover:bg-indigo-100 transition-colors">
                           <Type size={14} />
                         </div>
                         <div className="flex flex-col items-start">
                           <span className="font-medium">Plain Text</span>
                           <span className="text-[10px] text-slate-400 text-left">Text only</span>
                         </div>
                       </button>
                     </div>
                   </>
                 )}
               </div>
               
               <button 
                 onClick={handleDownloadContent} 
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition"
                 title="Download TXT"
               >
                  <Download size={14} /> Download
               </button>

               <button onClick={() => setIsFocusMode(!isFocusMode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${isFocusMode ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  {isFocusMode ? <><Minimize2 size={14} /> Exit Focus</> : <><Maximize2 size={14} /> Focus</>}
               </button>
             </div>
          </div>

          {/* Editor Area */}
          <div 
             className="flex-1 relative bg-slate-50/30 overflow-hidden flex flex-col" 
             onDrop={handleEditorDrop}
             onDragOver={handleDragOver}
          >
            {isGenerating ? (
               <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-500 gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                  <p className="animate-pulse text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">AI is crafting your draft...</p>
               </div>
            ) : null}

            {/* RICH TEXT EDITOR VIEW (TipTap) */}
            {(viewMode === 'markdown' || !isFocusMode) ? (
              <div ref={editorScrollRef} className="flex-1 flex flex-col p-4 md:p-6 bg-slate-50/50 overflow-hidden">
                <RichTextEditor 
                  ref={editorRef}
                  content={localDraftContent} 
                  hideCopy={true}
                  fullWidth={isLeftCollapsed}
                  editable={!isApproved}
                  onChange={(markdown) => {
                    setLocalDraftContent(markdown);
                    // Debounce the update to database to avoid excessive network calls
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = setTimeout(() => {
                      onUpdate({ draftContent: markdown });
                    }, 1000); // 1 second debounce
                  }}
                  className="flex-1"
                  placeholder="Start writing your masterpiece..."
                />
              </div>
            ) : viewMode === 'preview' ? (
              /* Simplified Preview - still using TipTap for editing but with preview styling */
              <div className="flex-1 min-h-0 w-full p-4 md:p-8 bg-slate-50 overflow-y-auto">
                <RichTextEditor 
                  ref={editorRef}
                  content={localDraftContent} 
                  hideCopy={true}
                  fullWidth={true}
                  editable={!isApproved}
                  onChange={(markdown) => {
                    setLocalDraftContent(markdown);
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = setTimeout(() => {
                      onUpdate({ draftContent: markdown });
                    }, 1000);
                  }}
                  className="mx-auto max-w-6xl shadow-lg border-slate-100 min-h-[800px]"
                  placeholder="Start writing..."
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 w-full p-8 overflow-y-auto bg-slate-50/50">
                {renderVisualStructure(localDraftContent)}
              </div>
            )}
            
            {/* --- AI REFINE BAR (Multi-Modal) --- */}
            {!isApproved && (
              <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 transition-all duration-300 ${isRefineBarExpanded ? 'w-full max-w-xl px-4' : 'w-12'}`}>
                {/* AI Suggestion Card */}
                {aiSuggestion && isRefineBarExpanded && (
                  <div className="bg-white rounded-xl shadow-xl border border-indigo-200 p-4 mb-3 animate-in slide-in-from-bottom-5">
                    <div className="flex items-start gap-3">
                       <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><Sparkles size={18}/></div>
                       <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">Smart Insertion</p>
                          <p className="text-xs text-slate-600 mt-1">{aiSuggestion.reason}</p>
                          <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 italic">
                             "...{aiSuggestion.anchor}..."
                          </div>
                       </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                       <button onClick={() => setAiSuggestion(null)} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1">Cancel</button>
                       <button onClick={confirmImageInsertion} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 shadow-sm font-medium">Yes, Insert Image</button>
                    </div>
                  </div>
                )}

                {!isRefineBarExpanded ? (
                  <button 
                    onClick={() => setIsRefineBarExpanded(true)}
                    className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-indigo-600 hover:scale-110 transition-all group relative"
                    title="Ask AI to refine"
                  >
                    <Sparkles size={20} className="group-hover:animate-pulse" />
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      Ask AI
                    </div>
                  </button>
                ) : (
                  <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 ring-1 ring-black/5 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 relative">
                     {/* Attached File Preview */}
                     {attachedFile && (
                       <div className="absolute -top-10 left-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-md flex items-center gap-2 text-xs text-slate-700 animate-in slide-in-from-bottom-2">
                          <ImageIcon size={12} className="text-indigo-600" />
                          <span className="max-w-[150px] truncate font-medium">{attachedFile.name}</span>
                          <button onClick={() => setAttachedFile(null)} className="hover:text-red-500 transition"><X size={12} /></button>
                       </div>
                     )}

                     <div className="flex items-center gap-3">
                        <div className="relative">
                           <input 
                              type="file" 
                              hidden 
                              ref={fileInputRef} 
                              onChange={handleAiAttachment}
                              accept="image/*,.pdf" 
                           />
                           <button 
                              onClick={() => fileInputRef.current?.click()}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${attachedFile ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200'}`}
                              title="Attach File"
                           >
                              <Paperclip size={16} />
                           </button>
                        </div>
                        
                        <input 
                           type="text" 
                           autoFocus
                           value={refineInstruction}
                           onChange={(e) => setRefineInstruction(e.target.value)}
                           placeholder={attachedFile ? "Ask AI what to do with this file..." : "Ask AI to refine text..."}
                           className="flex-1 text-sm bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-400 px-1"
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') handleRefine();
                             if (e.key === 'Escape') setIsRefineBarExpanded(false);
                           }}
                        />
                        
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={handleRefine}
                            disabled={isRefining || (!refineInstruction && !attachedFile)}
                            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                          >
                            {isRefining ? 'Refining...' : 'Refine'}
                          </button>
                          <button 
                            onClick={() => setIsRefineBarExpanded(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                            title="Collapse"
                          >
                            <ChevronDown size={18} />
                          </button>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- RIGHT COLUMN: Metadata --- */}
      {!isFocusMode && (
        <div 
           className={`flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out ${isResizingRight ? 'duration-0' : ''}`}
           style={{ width: isRightCollapsed ? '48px' : `${rightWidth}px` }}
        >
          {/* ... (Metadata Sidebar Same as Before) ... */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden h-full">
             <div className={`flex items-center ${isRightCollapsed ? 'justify-center py-4 flex-col gap-4' : 'justify-between px-5 py-4'} border-b border-slate-100 min-h-[50px]`}>
                {isRightCollapsed ? (
                  <button onClick={() => setIsRightCollapsed(false)} className="text-slate-400 hover:text-indigo-600 transition">
                    <PanelRightOpen size={20} />
                  </button>
                ) : (
                  <>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wide">
                      <LayoutTemplate size={16} className="text-indigo-600" />
                      Metadata
                    </h3>
                     <div className="flex items-center gap-2">
                        <button 
                          onClick={handleGenerateMetadata}
                          disabled={isMetaGenerating || !(project.draftContent || '').trim()}
                          title="Auto-generate metadata"
                          className="p-1.5 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition disabled:opacity-50"
                        >
                          {isMetaGenerating ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14} />}
                        </button>
                      <button onClick={() => setIsRightCollapsed(true)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition">
                        <PanelRightClose size={16} />
                      </button>
                    </div>
                  </>
                )}
             </div>
             
             <div className="flex-1 overflow-hidden relative bg-slate-50/30">
               {isRightCollapsed ? (
                  <div className="h-full w-full flex flex-col items-center py-6 gap-8">
                    {/* <div className="writing-vertical-rl text-slate-400 font-medium tracking-wide uppercase text-xs">CMS Settings</div> */}
                  </div>
               ) : (
                 <div className="p-5 overflow-y-auto h-full flex flex-col custom-scrollbar">
                   <div className="space-y-5 flex-1">
                     {isAdminUser && (
                       <div className="group">
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 transition">Category</label>
                         <input 
                           type="text" 
                           value={cmsId || 'No CMS ID Linked'}
                           readOnly
                           disabled
                           className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-500 cursor-not-allowed transition shadow-sm font-medium"
                         />
                       </div>
                     )}

                     <div className="group">
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 group-focus-within:text-indigo-600 transition">Short Text</label>
                       <textarea 
                         rows={5}
                         value={summary}
                         onChange={(e) => setSummary(e.target.value)}
                         placeholder="Brief description (max 160 chars)..."
                         className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none resize-none transition shadow-sm hover:border-slate-300"
                       />
                       <p className={`text-[10px] text-right mt-1 transition ${summary.length > 160 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{summary.length}/160</p>
                     </div>

                     <div className="group">
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 group-focus-within:text-indigo-600 transition">Photo</label>
                       
                       <div className="border-2 border-dashed border-slate-200 rounded-lg p-1 transition hover:border-indigo-300 hover:bg-slate-50">
                         {coverImage ? (
                           <div className="relative w-full aspect-video rounded-md overflow-hidden group/image bg-slate-100">
                             <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition flex items-center justify-center gap-2">
                               <button 
                                 onClick={() => coverInputRef.current?.click()} 
                                 className="p-1.5 bg-white rounded-full text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 transition shadow-sm"
                                 title="Replace Image"
                               >
                                 <Edit3 size={14} />
                               </button>
                               <button 
                                 onClick={removeCoverImage}
                                 className="p-1.5 bg-white rounded-full text-slate-700 hover:text-red-600 hover:bg-red-50 transition shadow-sm"
                                 title="Remove Image"
                               >
                                 <Trash2 size={14} />
                               </button>
                             </div>
                           </div>
                         ) : (
                           <div 
                             onClick={() => !isUploading && coverInputRef.current?.click()}
                             className={`cursor-pointer w-full py-8 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 transition ${isUploading ? 'cursor-not-allowed opacity-70' : ''}`}
                           >
                             {isUploading ? (
                               <div className="flex flex-col items-center gap-2">
                                 <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
                                 <span className="text-xs">Uploading...</span>
                               </div>
                             ) : (
                               <>
                                 <ImageIcon size={24} strokeWidth={1.5} />
                                 <div className="text-center">
                                   <p className="text-xs font-medium">Upload Cover Image</p>
                                   <p className="text-[10px] opacity-70 mt-0.5">JPG, PNG, WebP</p>
                                 </div>
                               </>
                             )}
                           </div>
                         )}
                         <input 
                           type="file" 
                           ref={coverInputRef} 
                           onChange={handleCoverImageUpload} 
                           hidden 
                           accept="image/jpeg,image/png,image/gif,image/webp"
                         />
                       </div>
                     </div>
                   </div>

                   <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                      {/* Update Metadata / Save Progress Button */}
                      <div title={isApproved && isCMSPublishLocked ? 'Coming soon' : undefined}>
                        <button 
                          onClick={handleSaveDraft}
                          disabled={isApproved && isCMSPublishLocked}
                          className={`w-full py-2.5 font-medium rounded-lg border transition text-sm ${
                            isApproved && isCMSPublishLocked
                              ? 'text-slate-400 border-slate-200 bg-slate-50 cursor-not-allowed'
                              : 'text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          {isApproved ? 'Update Metadata' : 'Save Progress'}
                        </button>
                      </div>

                      {!isApproved ? (
                        <button 
                          onClick={handleSubmitToClient}
                          className="w-full py-2.5 bg-slate-900 text-white font-medium hover:bg-slate-800 rounded-lg shadow-lg shadow-slate-900/20 transition flex items-center justify-center gap-2 text-sm"
                        >
                          <Send size={16} />
                          Submit for Review
                        </button>
                      ) : (
                        <div className="space-y-3">
                           <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                              <div className="flex items-center justify-center gap-2 text-green-700 font-bold text-sm mb-1">
                                <CheckCircle size={16} />
                                Approved & Ready
                              </div>
                              <p className="text-xs text-green-600">Client has approved this content.</p>
                           </div>
                           
                           {/* Publish to CMS Button */}
                           <div title={isCMSPublishLocked ? 'Coming soon' : undefined}>
                             <button 
                               onClick={handlePublishToCMS}
                               disabled={isPublishing || isCMSPublishLocked}
                               className={`w-full py-2.5 font-medium rounded-lg shadow-lg transition flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed ${
                                 isCMSPublishLocked
                                   ? 'bg-slate-300 text-slate-500 shadow-slate-300/20'
                                   : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20 disabled:opacity-50'
                               }`}
                             >
                               {isPublishing ? (
                                 <>
                                   <RefreshCw size={16} className="animate-spin" />
                                   Publishing...
                                 </>
                               ) : (
                                 <>
                                   <Globe size={16} />
                                   Publish to CMS
                                 </>
                               )}
                             </button>
                           </div>
                        </div>
                      )}
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>
      )}
      
      {/* --- RESIZER RIGHT --- */}
      {!isFocusMode && (
        <div 
          className={`w-4 -mx-2 z-20 flex items-center justify-center cursor-col-resize group flex-shrink-0 select-none ${isRightCollapsed ? 'pointer-events-none' : ''}`}
          onMouseDown={startResizeRight}
        >
          <div className={`w-1 h-12 rounded-full transition-colors ${isResizingRight ? 'bg-indigo-500' : 'bg-slate-200 group-hover:bg-indigo-400'} ${isRightCollapsed ? 'opacity-0' : ''}`} />
        </div>
      )}
    </div>
  );
};

export default StageDraft;
