
import React, { useState, useEffect, useRef } from 'react';
import { Article, ProjectStatus, ARTICLE_STATUS, ContentBlock } from '../types';
import { generateBlogDraft, refineBlogContent, generatePostMetadata, refineSection, suggestImagePlacement } from '../services/geminiService';
import { 
  Send, CheckCircle, Wand2, Sparkles, Globe, FileText, MessageSquare, 
  RefreshCw, LayoutTemplate, PenTool, PanelLeftClose, PanelLeftOpen, 
  PanelRightClose, PanelRightOpen, Maximize2, Minimize2, Eye, GitGraph, Code, ArrowRight, X,
  Paperclip, Image as ImageIcon, Trash2, ArrowUp, ArrowDown, MoveVertical, Copy, Check
} from 'lucide-react';
import { generateClientReviewLink, copyToClipboard } from '../services/linkService';

interface Props {
  project: Article;
  onUpdate: (updates: Partial<Article>) => void;
}

// Block structure for the Visual Editor
interface EditorBlock {
  id: string;
  type: 'text' | 'image';
  content: string; // Text content or Data URL
  src?: string; // For images
  caption?: string;
  size?: 'small' | 'medium' | 'large';
}

const StageDraft: React.FC<Props> = ({ project, onUpdate }) => {
  // We maintain 'blocks' as internal state, sync to 'content' (markdown) on save
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Metadata State
  const [slug, setSlug] = useState(project.slug || '');
  const [category, setCategory] = useState(project.category || '');
  const [summary, setSummary] = useState(project.seoSummary || '');
  const [intro, setIntro] = useState(project.seoIntro || '');
  
  // AI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isMetaGenerating, setIsMetaGenerating] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');
  
  // Multi-Modal AI State
  const [attachedFile, setAttachedFile] = useState<{ name: string, data: string, type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ anchor: string, reason: string } | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [activeTab, setActiveTab] = useState<'outline' | 'feedback'>('outline');

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

  // --- Floating Toolbar State ---
  const [selectionState, setSelectionState] = useState<{
    start: number;
    end: number;
    text: string;
    showToolbar: boolean;
    toolbarMode: 'icon' | 'input';
    top: number;
    left: number;
    blockId: string | null;
  }>({
    start: 0,
    end: 0,
    text: '',
    showToolbar: false,
    toolbarMode: 'icon',
    top: 0,
    left: 0,
    blockId: null
  });
  const [quickRefineInput, setQuickRefineInput] = useState('');
  const [isQuickRefining, setIsQuickRefining] = useState(false);

  const sidebarRef = useRef<{ startX: number, startWidth: number } | null>(null);

  // --- Initialization & Markdown Parsing ---
  useEffect(() => {
    if (!isSyncing && project.draftContent) {
      setBlocks(parseMarkdownToBlocks(project.draftContent));
    }
  }, [project.draftContent]);

  const parseMarkdownToBlocks = (md: string): EditorBlock[] => {
    // Simple parser: Split by image regex ![caption](url)
    // This is a naive implementation for demo purposes.
    const regex = /!\[(.*?)\]\((.*?)\)/g;
    const result: EditorBlock[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(md)) !== null) {
      // Add text before image
      if (match.index > lastIndex) {
        const text = md.substring(lastIndex, match.index).trim();
        if (text) {
          result.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', content: text });
        }
      }

      // Add image
      result.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'image',
        content: '',
        src: match[2],
        caption: match[1],
        size: 'medium'
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < md.length) {
      const text = md.substring(lastIndex).trim();
      if (text) {
        result.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', content: text });
      }
    }

    // Default empty block if nothing
    if (result.length === 0) {
      result.push({ id: 'init', type: 'text', content: '' });
    }

    return result;
  };

  const serializeBlocksToMarkdown = (currentBlocks: EditorBlock[]): string => {
    return currentBlocks.map(b => {
      if (b.type === 'text') return b.content + '\n\n';
      if (b.type === 'image') return `![${b.caption || 'image'}](${b.src})\n\n`;
      return '';
    }).join('').trim();
  };

  const updateBlock = (id: string, newContent: string) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, content: newContent } : b);
    setBlocks(newBlocks);
    setIsSyncing(true); // Don't overwrite with incoming props while user typing
  };

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

  // --- Selection Logic (Text Refine) ---
  const handleTextareaMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>, blockId: string) => {
    const target = e.target as HTMLTextAreaElement;
    setTimeout(() => {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start !== end) {
        const text = target.value.substring(start, end);
        if (text.trim().length > 0) {
          setSelectionState({
            start, end, text,
            showToolbar: true,
            toolbarMode: 'icon',
            top: e.clientY - 40,
            left: e.clientX,
            blockId
          });
          return;
        }
      }
      if (selectionState.showToolbar && !isQuickRefining) {
        setSelectionState(prev => ({ ...prev, showToolbar: false }));
      }
    }, 10);
  };

  const handleQuickRefineSubmit = async () => {
    if (!quickRefineInput.trim() || !selectionState.blockId) return;
    setIsQuickRefining(true);
    const refinedText = await refineSection(selectionState.text, quickRefineInput);
    
    // Find block and replace text
    const newBlocks = blocks.map(b => {
      if (b.id === selectionState.blockId) {
        const newContent = b.content.substring(0, selectionState.start) + refinedText + b.content.substring(selectionState.end);
        return { ...b, content: newContent };
      }
      return b;
    });
    
    setBlocks(newBlocks);
    onUpdate({ draftContent: serializeBlocksToMarkdown(newBlocks) });
    
    setIsQuickRefining(false);
    setQuickRefineInput('');
    setSelectionState(prev => ({ ...prev, showToolbar: false }));
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
         const newBlock: EditorBlock = {
           id: Date.now().toString(),
           type: 'image',
           content: '',
           src,
           caption: file.name,
           size: 'medium'
         };
         // Insert at end or find index based on Y position (simplified to end for now)
         setBlocks([...blocks, newBlock]);
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

  // --- Block Actions ---
  const moveBlock = (index: number, direction: -1 | 1) => {
    const newBlocks = [...blocks];
    if (index + direction < 0 || index + direction >= newBlocks.length) return;
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  const deleteBlock = (index: number) => {
    console.log("Deleting block at index", index);
    if (confirm("Delete this block?")) {
      setBlocks(prev => prev.filter((_, i) => i !== index));
      setIsSyncing(true);
    }
  };

  const resizeImage = (index: number, size: 'small'|'medium'|'large') => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, size } : b));
    setIsSyncing(true);
  };

  const updateCaption = (index: number, caption: string) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, caption } : b));
    setIsSyncing(true);
  };

  // --- AI Actions ---
  const handleGenerateDraft = async () => {
    if (!project.outlineContent) return alert("No outline found.");
    setIsGenerating(true);
    const draft = await generateBlogDraft(
      project.selectedTitle || project.title, 
      project.outlineContent, 
      project.clientComments, 
      "Client" 
    );
    if (draft) {
      setBlocks(parseMarkdownToBlocks(draft));
      onUpdate({ draftContent: draft });
    }
    setIsGenerating(false);
  };

  const handleRefine = async () => {
    if (!refineInstruction.trim()) return;
    
    // Multi-modal check
    if (attachedFile && attachedFile.type.startsWith('image/')) {
        setIsRefining(true);
        // Smart Insertion Logic
        const currentMd = serializeBlocksToMarkdown(blocks);
        const suggestion = await suggestImagePlacement(currentMd, attachedFile.data, refineInstruction);
        
        if (suggestion && suggestion.suggestedTextAnchor) {
           setAiSuggestion({
             anchor: suggestion.suggestedTextAnchor,
             reason: suggestion.reason
           });
        } else {
           alert("Could not determine placement. " + suggestion.reason);
        }
        setIsRefining(false);
        return;
    }

    // Standard Text Refinement
    setIsRefining(true);
    const currentMd = serializeBlocksToMarkdown(blocks);
    const refined = await refineBlogContent(currentMd, refineInstruction);
    if (refined) {
      setBlocks(parseMarkdownToBlocks(refined));
      setRefineInstruction('');
    }
    setIsRefining(false);
  };

  const confirmImageInsertion = () => {
    if (!aiSuggestion || !attachedFile) return;
    
    // Find the block containing the anchor text
    const targetBlockIndex = blocks.findIndex(b => b.type === 'text' && b.content.includes(aiSuggestion.anchor));
    
    if (targetBlockIndex !== -1) {
       const newBlock: EditorBlock = {
         id: Date.now().toString(),
         type: 'image',
         content: '',
         src: attachedFile.data,
         caption: 'Inserted by AI',
         size: 'medium'
       };
       
       const newBlocks = [...blocks];
       // Insert after the target block
       newBlocks.splice(targetBlockIndex + 1, 0, newBlock);
       setBlocks(newBlocks);
       
       // Cleanup
       setAiSuggestion(null);
       setAttachedFile(null);
       setRefineInstruction('');
       onUpdate({ draftContent: serializeBlocksToMarkdown(newBlocks) });
    } else {
      alert("Could not locate the anchor text to insert image. Inserting at the end.");
      setBlocks([...blocks, {
         id: Date.now().toString(),
         type: 'image',
         content: '',
         src: attachedFile.data,
         caption: 'Inserted by AI',
         size: 'medium'
      }]);
      setAiSuggestion(null);
      setAttachedFile(null);
    }
  };

  const handleGenerateMetadata = async () => {
    const md = serializeBlocksToMarkdown(blocks);
    if (md.length < 100) return alert("Write some content first.");
    setIsMetaGenerating(true);
    const meta = await generatePostMetadata(md, project.selectedTitle || project.title);
    if (meta) {
      setSlug(meta.slug);
      setCategory(meta.category);
      setSummary(meta.summary);
      setIntro(meta.intro);
    }
    setIsMetaGenerating(false);
  };

  // Convert EditorBlock[] to ContentBlock[] for unified storage
  const convertEditorBlocksToContentBlocks = (editorBlocks: EditorBlock[]): ContentBlock[] => {
    const result: ContentBlock[] = [];
    let blockIndex = 0;
    
    editorBlocks.forEach((block) => {
      if (block.type === 'text') {
        // Split text by paragraphs and headers
        const lines = block.content.split('\n').filter(line => line.trim());
        lines.forEach((line) => {
          blockIndex++;
          const blockId = `block-${blockIndex}`;
          
          if (line.startsWith('# ')) {
            result.push({
              id: blockId,
              type: 'header',
              content: line.replace(/^# /, '')
            });
          } else if (line.startsWith('## ')) {
            result.push({
              id: blockId,
              type: 'header',
              content: line.replace(/^## /, '')
            });
          } else if (line.startsWith('### ')) {
            result.push({
              id: blockId,
              type: 'header',
              content: line.replace(/^### /, '')
            });
          } else if (line.startsWith('> ')) {
            result.push({
              id: blockId,
              type: 'quote',
              content: line.replace(/^> /, '')
            });
          } else {
            result.push({
              id: blockId,
              type: 'paragraph',
              content: line
            });
          }
        });
      } else if (block.type === 'image') {
        blockIndex++;
        result.push({
          id: `block-${blockIndex}`,
          type: 'image',
          content: block.caption || 'Image',
          src: block.src,
          caption: block.caption
        });
      }
    });
    
    return result;
  };

  const handleSaveDraft = () => {
    const md = serializeBlocksToMarkdown(blocks);
    const contentBlocks = convertEditorBlocksToContentBlocks(blocks);
    onUpdate({ 
      draftContent: md,
      draftBlocks: contentBlocks,
      slug,
      category,
      seoSummary: summary,
      seoIntro: intro
    });
    setIsSyncing(false);
  };

  const handleSubmitToClient = () => {
    const md = serializeBlocksToMarkdown(blocks);
    if (md.trim().length < 100) return alert("Draft is too short.");
    handleSaveDraft();
    onUpdate({ status: ARTICLE_STATUS.AWAITING_REVIEW_DRAFT }); // Use new status constant
    
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

  const handlePublishToCMS = () => {
    if (!slug || !category || !summary || !intro) {
      alert("Please ensure all CMS metadata (Slug, Category, Summary, Intro) is filled out.");
      return;
    }
    if(confirm("Are you sure you want to publish this content to the Agency CMS?")) {
      handleSaveDraft();
      onUpdate({ status: ProjectStatus.PUBLISHED });
    }
  };

  // --- Render Helpers ---
  const renderPreview = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) return <h1 key={idx} className="text-3xl font-bold mb-4 mt-6 text-slate-900">{line.replace('# ', '')}</h1>;
      if (line.startsWith('## ')) return <h2 key={idx} className="text-2xl font-bold mb-3 mt-5 text-slate-800">{line.replace('## ', '')}</h2>;
      if (line.startsWith('![')) {
        // Simple preview regex for images
        const match = line.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) return <img key={idx} src={match[2]} alt={match[1]} className="my-6 rounded-lg shadow-sm max-w-full" />;
      }
      return <p key={idx} className="mb-3 text-slate-700 leading-relaxed">{line}</p>;
    });
  };

  const renderVisualStructure = (blocks: EditorBlock[]) => {
    const headers = blocks.filter(b => b.type === 'text' && b.content.startsWith('#')).map(b => {
      const level = b.content.match(/^#+/)?.[0].length || 0;
      return { level, text: b.content.replace(/^#+\s/, '') };
    });

    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto py-8">
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
             <div className={`flex-1 p-3 rounded-lg border ${h.level === 1 ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-200'} shadow-sm`}>
               <p className={`font-medium ${h.level === 1 ? 'text-indigo-900 text-lg' : 'text-slate-700'}`}>{h.text}</p>
             </div>
          </div>
        ))}
      </div>
    );
  };

  const isApproved = project.status === ProjectStatus.DRAFT_APPROVED;
  const isPublished = project.status === ProjectStatus.PUBLISHED;

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
      
      {/* --- FLOATING TOOLBAR (Text Selection) --- */}
      {selectionState.showToolbar && (
        <div 
          className="fixed z-50 animate-in zoom-in-95 duration-200 origin-bottom-center"
          style={{ top: selectionState.top, left: selectionState.left }}
        >
          {selectionState.toolbarMode === 'icon' ? (
            <button 
              onClick={() => setSelectionState(prev => ({ ...prev, toolbarMode: 'input' }))}
              className="bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 hover:scale-110 transition-transform ring-4 ring-indigo-100"
            >
              <Sparkles size={16} fill="currentColor" />
            </button>
          ) : (
            <div className="bg-white p-2 rounded-xl shadow-xl border border-slate-200 flex items-center gap-2 ring-4 ring-indigo-50 min-w-[300px]">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <Wand2 size={16} />
              </div>
              <input 
                  type="text" 
                  autoFocus
                  value={quickRefineInput}
                  onChange={(e) => setQuickRefineInput(e.target.value)}
                  placeholder="How should AI change this selection?"
                  className="flex-1 text-sm bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickRefineSubmit()}
              />
              <button 
                onClick={handleQuickRefineSubmit}
                className="p-1.5 bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              >
                <ArrowRight size={16} />
              </button>
              <button 
                onClick={() => setSelectionState(prev => ({ ...prev, showToolbar: false }))}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 ml-1"
              >
                 <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

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
                      onClick={() => setActiveTab('outline')}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${activeTab === 'outline' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                      <FileText size={16} /> Outline
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
                 <div className="writing-vertical-rl text-slate-400 font-medium tracking-wide uppercase text-xs">Project Context</div>
               </div>
             ) : (
               <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                  {activeTab === 'outline' ? (
                    <div className="prose prose-sm prose-slate max-w-none">
                      <div className="whitespace-pre-wrap text-slate-600 font-mono text-xs leading-relaxed">{project.outlineContent}</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {project.clientComments.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <MessageSquare className="mx-auto mb-2 opacity-50" size={24} />
                            <p className="text-xs italic">No feedback provided yet.</p>
                          </div>
                        ) : (
                          project.clientComments.map(c => (
                            <div key={c.id} className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/60 shadow-sm relative group hover:shadow-md transition">
                              <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-800">
                                        {c.author.charAt(0)}
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">{c.author}</span>
                                  </div>
                              </div>
                              <p className="text-sm text-slate-700 leading-snug">{c.text}</p>
                              <p className="text-[10px] text-slate-400 mt-2 text-right">{c.timestamp.toLocaleDateString()}</p>
                            </div>
                          ))
                        )}
                    </div>
                  )}
               </div>
             )}
          </div>
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
                  {serializeBlocksToMarkdown(blocks).split(/\s+/).length} words
                </span>
             </div>
             
             {isFocusMode && (
                <div className="flex bg-slate-100 p-1 rounded-lg">
                   <button onClick={() => setViewMode('markdown')} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'markdown' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Code size={12} /> Editor</button>
                   <button onClick={() => setViewMode('preview')} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Eye size={12} /> Preview</button>
                   <button onClick={() => setViewMode('visual')} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'visual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><GitGraph size={12} /> Structure</button>
                </div>
             )}
             
             <div className="flex items-center gap-3">
               {!blocks.some(b => b.content.trim()) && !isGenerating && !isFocusMode && (
                 <button onClick={handleGenerateDraft} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm hover:shadow"><Sparkles size={16} /> Auto-Write Draft</button>
               )}
               <button onClick={() => setIsFocusMode(!isFocusMode)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${isFocusMode ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
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

            {/* BLOCK EDITOR VIEW */}
            {viewMode === 'markdown' || !isFocusMode ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
                 {/* FLUID EDITOR: No max-w-4xl constraint anymore, fills fluid middle column */}
                 <div className="mx-auto bg-white shadow-sm min-h-[800px] p-8 md:p-12 rounded-lg border border-slate-100 w-full max-w-none">
                    {blocks.map((block, index) => (
                       <div key={block.id} className="group relative mb-6 hover:ring-2 hover:ring-indigo-50 rounded-lg p-1 -m-1 transition-all">
                          {/* Block Controls (Hover) */}
                          <div className="absolute right-0 top-0 -mt-3 -mr-3 hidden group-hover:flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-1 z-10">
                             <button type="button" onClick={(e) => { e.stopPropagation(); moveBlock(index, -1); }} className="p-1 hover:bg-slate-100 rounded" disabled={index === 0}><ArrowUp size={14} /></button>
                             <button type="button" onClick={(e) => { e.stopPropagation(); moveBlock(index, 1); }} className="p-1 hover:bg-slate-100 rounded" disabled={index === blocks.length - 1}><ArrowDown size={14} /></button>
                             {block.type === 'image' && (
                               <>
                                 <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                 <button type="button" onClick={(e) => { e.stopPropagation(); resizeImage(index, 'small'); }} className={`text-[10px] px-1 rounded ${block.size === 'small' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100'}`}>S</button>
                                 <button type="button" onClick={(e) => { e.stopPropagation(); resizeImage(index, 'medium'); }} className={`text-[10px] px-1 rounded ${block.size === 'medium' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100'}`}>M</button>
                                 <button type="button" onClick={(e) => { e.stopPropagation(); resizeImage(index, 'large'); }} className={`text-[10px] px-1 rounded ${block.size === 'large' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100'}`}>L</button>
                               </>
                             )}
                             <div className="w-px h-3 bg-slate-200 mx-1"></div>
                             <button type="button" onClick={(e) => { e.stopPropagation(); deleteBlock(index); }} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                          </div>

                          {/* Content Render */}
                          {block.type === 'text' ? (
                             <textarea 
                               value={block.content}
                               onChange={(e) => updateBlock(block.id, e.target.value)}
                               onMouseUp={(e) => handleTextareaMouseUp(e, block.id)}
                               className="w-full resize-none outline-none bg-transparent text-base md:text-lg leading-relaxed text-slate-800 font-serif overflow-hidden"
                               rows={Math.max(1, block.content.split('\n').length)}
                               placeholder="Type / for blocks..."
                               style={{ minHeight: '1.5em' }}
                             />
                          ) : (
                             <div className={`relative ${block.size === 'small' ? 'max-w-xs' : block.size === 'medium' ? 'max-w-2xl' : 'max-w-full'} mx-auto`}>
                                <img src={block.src} alt={block.caption} className="rounded-lg shadow-sm border border-slate-100 w-full" />
                                <input 
                                  type="text" 
                                  value={block.caption || ''} 
                                  onChange={(e) => updateCaption(index, e.target.value)}
                                  className="w-full text-center text-xs text-slate-400 mt-2 bg-transparent outline-none italic"
                                  placeholder="Add a caption..." 
                                />
                             </div>
                          )}
                       </div>
                    ))}
                    
                    {/* Add New Block Hint */}
                    <div className="h-20 flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-lg hover:border-indigo-200 hover:text-indigo-400 transition cursor-text" onClick={() => setBlocks([...blocks, { id: Date.now().toString(), type: 'text', content: '' }])}>
                       Click to add text or Drop images here
                    </div>
                 </div>
              </div>
            ) : viewMode === 'preview' ? (
              /* Client-style preview - matches Client Portal's ContentReview display */
              <div className="flex-1 w-full p-8 md:p-12 overflow-y-auto bg-white mx-auto max-w-5xl shadow-sm my-4 rounded-lg border border-slate-100">
                <div className="space-y-6 font-serif text-lg leading-relaxed text-slate-800">
                  {convertEditorBlocksToContentBlocks(blocks).map((block) => (
                    <div key={block.id} className="p-4 -mx-4 rounded-lg border border-transparent">
                      {/* Header rendering */}
                      {block.type === 'header' && (
                        <h2 className="text-2xl md:text-3xl font-bold font-sans text-slate-900 mb-2 mt-4">{block.content}</h2>
                      )}
                      {/* Paragraph rendering */}
                      {block.type === 'paragraph' && (
                        <p>{block.content}</p>
                      )}
                      {/* Quote rendering */}
                      {block.type === 'quote' && (
                        <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-600 my-4 bg-slate-50/50 py-2 rounded-r">
                          "{block.content}"
                        </blockquote>
                      )}
                      {/* Image rendering */}
                      {block.type === 'image' && (
                        <div className="my-4 bg-slate-100 h-48 flex items-center justify-center rounded-lg text-slate-400 text-sm border border-slate-200 border-dashed">
                          {block.src ? (
                            <img src={block.src} alt={block.caption || 'Image'} className="max-h-full max-w-full object-contain rounded-lg" />
                          ) : (
                            `[Image: ${block.caption || block.content}]`
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 w-full p-8 overflow-y-auto bg-slate-50/50">
                {renderVisualStructure(blocks)}
              </div>
            )}
            
            {/* --- AI REFINE BAR (Multi-Modal) --- */}
            {!isApproved && (
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-xl px-4 z-20">
                {/* AI Suggestion Card */}
                {aiSuggestion && (
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

                <div className="bg-white p-2 rounded-xl shadow-xl border border-slate-200 ring-1 ring-black/5 transition-all focus-within:ring-indigo-500/20 focus-within:border-indigo-500 relative">
                   {/* Attached File Preview */}
                   {attachedFile && (
                     <div className="absolute -top-10 left-0 bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm flex items-center gap-2 text-xs text-slate-700 animate-in slide-in-from-bottom-2">
                        <ImageIcon size={12} className="text-indigo-600" />
                        <span className="max-w-[150px] truncate">{attachedFile.name}</span>
                        <button onClick={() => setAttachedFile(null)} className="hover:text-red-500"><X size={12} /></button>
                     </div>
                   )}

                   <div className="flex items-center gap-2">
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
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${attachedFile ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Attach File"
                         >
                            <Paperclip size={16} />
                         </button>
                      </div>
                      
                      <input 
                         type="text" 
                         value={refineInstruction}
                         onChange={(e) => setRefineInstruction(e.target.value)}
                         placeholder={attachedFile ? "Ask AI what to do with this file..." : "Ask AI to refine text..."}
                         className="flex-1 text-sm bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-400"
                         onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                      />
                      <button 
                        onClick={handleRefine}
                        disabled={isRefining || (!refineInstruction && !attachedFile)}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isRefining ? 'Refining...' : 'Refine'}
                      </button>
                   </div>
                </div>
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
                      {!isApproved && (
                        <button 
                          onClick={handleGenerateMetadata}
                          disabled={isMetaGenerating || !blocks.some(b => b.content)}
                          title="Auto-generate metadata"
                          className="p-1.5 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition disabled:opacity-50"
                        >
                          {isMetaGenerating ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14} />}
                        </button>
                      )}
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
                    <div className="writing-vertical-rl text-slate-400 font-medium tracking-wide uppercase text-xs">CMS Settings</div>
                  </div>
               ) : (
                 <div className="p-5 overflow-y-auto h-full flex flex-col custom-scrollbar">
                   <div className="space-y-5 flex-1">
                     <div className="group">
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 group-focus-within:text-indigo-600 transition">URL Slug</label>
                       <input 
                         type="text" 
                         value={slug}
                         onChange={(e) => setSlug(e.target.value)}
                         disabled={isApproved}
                         placeholder="post-url-slug"
                         className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-slate-600 transition shadow-sm"
                       />
                     </div>

                     <div className="group">
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 group-focus-within:text-indigo-600 transition">Category</label>
                       <input 
                         type="text" 
                         value={category}
                         onChange={(e) => setCategory(e.target.value)}
                         disabled={isApproved}
                         placeholder="e.g. Tax Compliance"
                         className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-600 transition shadow-sm"
                       />
                     </div>

                     <div className="group">
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 group-focus-within:text-indigo-600 transition">Meta Summary</label>
                       <textarea 
                         rows={3}
                         value={summary}
                         onChange={(e) => setSummary(e.target.value)}
                         disabled={isApproved}
                         placeholder="Brief description for search engines..."
                         className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition shadow-sm"
                       />
                       <p className={`text-[10px] text-right mt-1 transition ${summary.length > 160 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{summary.length}/160</p>
                     </div>

                     <div className="group">
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 group-focus-within:text-indigo-600 transition">Intro / Excerpt</label>
                       <textarea 
                         rows={5}
                         value={intro}
                         onChange={(e) => setIntro(e.target.value)}
                         disabled={isApproved}
                         placeholder="Engaging teaser for the blog card..."
                         className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition shadow-sm"
                       />
                     </div>
                   </div>

                   <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                      {!isApproved ? (
                        <>
                          <button 
                            onClick={handleSaveDraft}
                            className="w-full py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-lg border border-slate-200 transition text-sm hover:text-slate-900"
                          >
                            Save Progress
                          </button>
                          {/* Review Link Display */}
                          {reviewLink && (
                            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-indigo-900 mb-1">Client Review Link:</p>
                                  <p className="text-[10px] text-indigo-700 break-all">{reviewLink}</p>
                                </div>
                                <button
                                  onClick={handleCopyLink}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex-shrink-0 text-xs"
                                >
                                  {linkCopied ? (
                                    <>
                                      <Check size={12} />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                          <button 
                            onClick={handleSubmitToClient}
                            className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 text-sm group"
                          >
                            <Send size={16} className="group-hover:translate-x-0.5 transition" />
                            Submit to Client
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={handlePublishToCMS}
                          className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 group"
                        >
                          <Globe size={18} className="group-hover:rotate-12 transition" />
                          Publish to CMS
                        </button>
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
