
import React, { useState, useEffect, useRef } from 'react';
import { Article, ProjectStatus, ARTICLE_STATUS, ContentBlock, RevisionHistoryEntry, Comment, ClientEdit } from '../types';
import { generateBlogDraft, refineBlogContent, generatePostMetadata, refineSection, suggestImagePlacement } from '../services/geminiService';
import { 
  Send, CheckCircle, Wand2, Sparkles, Globe, FileText, MessageSquare, 
  RefreshCw, LayoutTemplate, PenTool, PanelLeftClose, PanelLeftOpen, 
  PanelRightClose, PanelRightOpen, Maximize2, Minimize2, Eye, GitGraph, Code, ArrowRight, X,
  Paperclip, Image as ImageIcon, Trash2, ArrowUp, ArrowDown,
  History, ChevronDown, ChevronUp, Edit3, Plus, Minus, Undo2, RotateCcw, Save,
  Copy, Download, Settings, BookOpen, Bold, Italic, Underline, Strikethrough,
  Link2, Type, Eraser, List, Quote
} from 'lucide-react';
import { publishToCMS } from '../services/cmsService';
import supabase from '../services/supabaseClient.js';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

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
  onUpdate: (updates: Partial<Article>) => void;
  cmsId?: string;
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



// Helper to render inline markdown (bold, italic, underline, strikethrough, links)
const renderFormattedText = (text: string): React.ReactNode => {
  if (!text) return null;
  
  // Process markdown patterns in order of specificity
  const processText = (input: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let remaining = input;
    let keyCounter = 0;
    
    // Combined regex for all inline formats
    const patterns = [
      { regex: /\*\*(.+?)\*\*/g, render: (match: string, content: string) => <strong key={`bold-${keyCounter++}`} className="font-bold">{content}</strong> },
      { regex: /\*(.+?)\*/g, render: (match: string, content: string) => <em key={`italic-${keyCounter++}`} className="italic">{content}</em> },
      { regex: /~~(.+?)~~/g, render: (match: string, content: string) => <span key={`strike-${keyCounter++}`} className="line-through text-slate-500">{content}</span> },
      { regex: /<u>(.+?)<\/u>/g, render: (match: string, content: string) => <span key={`underline-${keyCounter++}`} className="underline">{content}</span> },
      { regex: /\[(.+?)\]\((.+?)\)/g, render: (match: string, text: string, url: string) => <a key={`link-${keyCounter++}`} href={url} className="text-indigo-600 hover:text-indigo-800 underline" target="_blank" rel="noopener noreferrer">{text}</a> },
    ];
    
    // Find all matches and their positions
    type MatchInfo = { start: number; end: number; element: React.ReactNode };
    const matches: MatchInfo[] = [];
    
    // Bold **text**
    let match;
    const boldRegex = /\*\*(.+?)\*\*/g;
    while ((match = boldRegex.exec(remaining)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        element: <strong key={`bold-${keyCounter++}`} className="font-bold">{match[1]}</strong>
      });
    }
    
    // Italic *text* (but not bold)
    const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
    while ((match = italicRegex.exec(remaining)) !== null) {
      // Skip if overlaps with bold
      const overlaps = matches.some(m => 
        (match!.index >= m.start && match!.index < m.end) ||
        (match!.index + match![0].length > m.start && match!.index + match![0].length <= m.end)
      );
      if (!overlaps) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          element: <em key={`italic-${keyCounter++}`} className="italic">{match[1]}</em>
        });
      }
    }
    
    // Strikethrough ~~text~~
    const strikeRegex = /~~(.+?)~~/g;
    while ((match = strikeRegex.exec(remaining)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        element: <span key={`strike-${keyCounter++}`} className="line-through text-slate-500">{match[1]}</span>
      });
    }
    
    // Underline <u>text</u>
    const underlineRegex = /<u>(.+?)<\/u>/g;
    while ((match = underlineRegex.exec(remaining)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        element: <span key={`underline-${keyCounter++}`} className="underline decoration-2">{match[1]}</span>
      });
    }
    
    // Links [text](url)
    const linkRegex = /\[(.+?)\]\((.+?)\)/g;
    while ((match = linkRegex.exec(remaining)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        element: <a key={`link-${keyCounter++}`} href={match[2]} className="text-indigo-600 hover:text-indigo-800 underline transition" target="_blank" rel="noopener noreferrer">{match[1]}</a>
      });
    }
    
    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);
    
    // Remove overlapping matches (keep earlier ones)
    const filteredMatches: MatchInfo[] = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        filteredMatches.push(m);
        lastEnd = m.end;
      }
    }
    
    // Build result
    let pos = 0;
    for (const m of filteredMatches) {
      if (m.start > pos) {
        result.push(remaining.substring(pos, m.start));
      }
      result.push(m.element);
      pos = m.end;
    }
    if (pos < remaining.length) {
      result.push(remaining.substring(pos));
    }
    
    return result.length > 0 ? result : [remaining];
  };
  
  return processText(text);
};

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
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  // We maintain 'blocks' as internal state, sync to 'content' (markdown) on save
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
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

  // --- Block Editing State ---
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  
  // --- Rich Text Toolbar State ---
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // --- Comment Navigation State ---
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);

  const sidebarRef = useRef<{ startX: number, startWidth: number } | null>(null);
  
  // --- Sync editableOutline when project.outlineContent changes externally ---
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

  // --- Scroll to Block and Highlight ---
  const scrollToBlockAndHighlight = (targetBlockId: string) => {
    // Find the target element in the editor
    const targetElement = document.querySelector(`[data-content-block-id="${targetBlockId}"]`);
    
    if (targetElement) {
      // Scroll into view smoothly
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Set highlighted state to trigger animation
      setHighlightedBlockId(targetBlockId);
      
      // Clear highlight after animation completes
      setTimeout(() => {
        setHighlightedBlockId(null);
      }, 1000);
    } else {
      console.log('Target block not found:', targetBlockId);
    }
  };

  // --- Initialization & Markdown Parsing ---
  useEffect(() => {
    if (isSyncing) return;
    
    // Priority: Use draftBlocks if available (especially after applying client edits)
    // Otherwise fall back to draftContent (markdown)
    if (project.draftBlocks && project.draftBlocks.length > 0) {
      const editorBlocks = convertContentBlocksToEditorBlocks(project.draftBlocks);
      setBlocks(editorBlocks);
    } else if (project.draftContent) {
      setBlocks(parseMarkdownToBlocks(project.draftContent));
    }
  }, [project.draftContent, project.draftBlocks, isSyncing]);

  // Auto-resize all textareas when blocks change or component mounts
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated after render
    const timer = setTimeout(() => {
      const textareas = document.querySelectorAll('textarea[data-block-editor]');
      textareas.forEach((textarea) => {
        const el = textarea as HTMLTextAreaElement;
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [blocks, isFocusMode, viewMode]);
  
  // Convert ContentBlock[] to EditorBlock[] for the visual editor
  const convertContentBlocksToEditorBlocks = (contentBlocks: ContentBlock[]): EditorBlock[] => {
    const editorBlocks: EditorBlock[] = [];
    
    contentBlocks.forEach((block) => {
      if (block.type === 'image') {
        editorBlocks.push({
          id: block.id,
          type: 'image',
          content: '',
          src: block.src,
          caption: block.caption,
          size: 'medium'
        });
      } else {
        // For text blocks (header, paragraph, quote), convert to text type
        let textContent = block.content;
        
        // Add markdown formatting based on type
        if (block.type === 'header') {
          // Determine header level from block.level, default to 1
          const level = block.level || 1;
          const prefix = '#'.repeat(level);
          textContent = `${prefix} ${block.content}`;
        } else if (block.type === 'quote') {
          textContent = `> ${block.content}`;
        }
        
        editorBlocks.push({
          id: block.id,
          type: 'text',
          content: textContent
        });
      }
    });
    
    return editorBlocks;
  };

  const parseMarkdownToBlocks = (md: string): EditorBlock[] => {
    // Improved parser: Split by paragraphs/headers (double newlines) to create granular blocks
    const chunks = md.split(/\n\s*\n/);
    const result: EditorBlock[] = [];
    
    chunks.forEach(chunk => {
      const trimmed = chunk.trim();
      if (!trimmed) return;
      
      // Check for images within the chunk
      const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
      let lastIndex = 0;
      let match;
      
      // If chunk contains images, we might need to split further
      while ((match = imageRegex.exec(trimmed)) !== null) {
        // Add text before image
        if (match.index > lastIndex) {
          const text = trimmed.substring(lastIndex, match.index).trim();
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

        lastIndex = imageRegex.lastIndex;
      }

      // Add remaining text after last image (or if no image found)
      if (lastIndex < trimmed.length) {
        const text = trimmed.substring(lastIndex).trim();
        if (text) {
          result.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', content: text });
        }
      }
    });

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

  const handleHeadingChange = (level: number) => {
    const textarea = activeTextareaRef.current;
    if (!textarea || !editingBlockId) return;

    setCurrentHeading(level);
    
    // Get the current line
    const content = textarea.value;
    const cursorPos = textarea.selectionStart;
    
    // Find the start of the current line
    let lineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
    let lineEnd = content.indexOf('\n', cursorPos);
    if (lineEnd === -1) lineEnd = content.length;
    
    const currentLine = content.substring(lineStart, lineEnd);
    
    // Remove existing heading markers
    const cleanLine = currentLine.replace(/^#{1,6}\s*/, '');
    
    // Add new heading marker
    const newLine = level === 0 ? cleanLine : `${'#'.repeat(level)} ${cleanLine}`;
    
    const newContent = content.substring(0, lineStart) + newLine + content.substring(lineEnd);
    updateBlock(editingBlockId, newContent);
  };

  // --- Floating Toolbar Format Handlers (for selected text) ---
  const handleFloatingFormat = (type: string) => {
    if (!selectionState.blockId || !selectionState.text) return;
    
    const block = blocks.find(b => b.id === selectionState.blockId);
    if (!block) return;
    
    let newText = '';
    const selectedText = selectionState.text;
    
    switch (type) {
      case 'bold':
        newText = `**${selectedText}**`;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        break;
      case 'underline':
        newText = `<u>${selectedText}</u>`;
        break;
      case 'strikethrough':
        newText = `~~${selectedText}~~`;
        break;
      case 'link':
        const url = prompt('Enter link URL:', 'https://');
        if (url) {
          newText = `[${selectedText}](${url})`;
        } else {
          return;
        }
        break;
      case 'quote':
        newText = selectedText.split('\n').map(line => `> ${line}`).join('\n');
        break;
      case 'bulletList':
        newText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
        break;
      case 'clear':
        newText = selectedText
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/~~(.+?)~~/g, '$1')
          .replace(/<u>(.+?)<\/u>/g, '$1')
          .replace(/\[(.+?)\]\(.+?\)/g, '$1')
          .replace(/^#+\s/gm, '')
          .replace(/^>\s/gm, '')
          .replace(/^[-*]\s/gm, '')
          .replace(/^\d+\.\s/gm, '');
        break;
      default:
        return;
    }
    
    const newContent = block.content.substring(0, selectionState.start) + newText + block.content.substring(selectionState.end);
    updateBlock(selectionState.blockId, newContent);
    setSelectionState(prev => ({ ...prev, showToolbar: false }));
  };

  const handleFloatingHeadingChange = (level: number) => {
    if (!selectionState.blockId) return;
    
    const block = blocks.find(b => b.id === selectionState.blockId);
    if (!block) return;
    
    setCurrentHeading(level);
    
    // Get the line containing the selection
    const content = block.content;
    let lineStart = content.lastIndexOf('\n', selectionState.start - 1) + 1;
    let lineEnd = content.indexOf('\n', selectionState.end);
    if (lineEnd === -1) lineEnd = content.length;
    
    const currentLine = content.substring(lineStart, lineEnd);
    const cleanLine = currentLine.replace(/^#{1,6}\s*/, '');
    const newLine = level === 0 ? cleanLine : `${'#'.repeat(level)} ${cleanLine}`;
    
    const newContent = content.substring(0, lineStart) + newLine + content.substring(lineEnd);
    updateBlock(selectionState.blockId, newContent);
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

  const deleteBlock = async (index: number) => {
    console.log("Deleting block at index", index);
    const isConfirmed = await confirm({
      title: 'Delete Block',
      message: 'Are you sure you want to delete this block?',
      type: 'warning',
      confirmText: 'Delete'
    });

    if (isConfirmed) {
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
           showToast("Could not determine placement. " + suggestion.reason, 'error');
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
      showToast("Could not locate the anchor text to insert image. Inserting at the end.", 'warning');
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
              content: line.replace(/^## /, ''),
              level: 2
            });
          } else if (line.startsWith('### ')) {
            result.push({
              id: blockId,  
              type: 'header',
              content: line.replace(/^### /, ''),
              level: 3
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

  const handleCopyContent = async () => {
    const md = serializeBlocksToMarkdown(blocks);
    try {
      await navigator.clipboard.writeText(md);
      showToast("Content copied to clipboard (Markdown format)", 'success');
    } catch (err) {
      console.error('Failed to copy: ', err);
      showToast("Copy failed", 'error');
    }
  };

  const handleDownloadContent = () => {
    const md = serializeBlocksToMarkdown(blocks);
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

  const handleSaveDraft = () => {
    const md = serializeBlocksToMarkdown(blocks);
    const contentBlocks = convertEditorBlocksToContentBlocks(blocks);
    onUpdate({ 
      draftContent: md,
      draftBlocks: contentBlocks,
      category: cmsId || '',
      seoSummary: summary,
      coverImage
    });
    setIsSyncing(false);
  };

  const handleSubmitToClient = () => {
    const md = serializeBlocksToMarkdown(blocks);
    if (md.trim().length < 100) {
      showToast("Draft is too short.", 'warning');
      return;
    }
    handleSaveDraft();
    onUpdate({ status: ARTICLE_STATUS.AWAITING_REVIEW_DRAFT }); // Use new status constant
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishToCMS = async () => {
    // Validate required fields
    if (!summary) {
      showToast("Please fill in the Short Text summary before publishing.", 'warning');
      return;
    }

    // Get the markdown content
    const markdownContent = serializeBlocksToMarkdown(blocks);
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

  // --- Render Helpers ---
  const renderPreview = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) return <h3 key={idx} className="text-xl font-bold mb-3 mt-5 text-slate-800">{renderFormattedText(line.replace('### ', ''))}</h3>;
      if (line.startsWith('## ')) return <h2 key={idx} className="text-2xl font-bold mb-3 mt-5 text-slate-800">{renderFormattedText(line.replace('## ', ''))}</h2>;
      if (line.startsWith('# ')) return <h1 key={idx} className="text-3xl font-bold mb-4 mt-6 text-slate-900">{renderFormattedText(line.replace('# ', ''))}</h1>;
      
      // Images
      if (line.startsWith('![')) {
        const match = line.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) return (
          <figure key={idx} className="my-6">
            <img src={match[2]} alt={match[1]} className="rounded-xl shadow-md max-w-full border border-slate-200" />
            {match[1] && <figcaption className="text-center text-sm text-slate-500 mt-2 italic">{match[1]}</figcaption>}
          </figure>
        );
      }
      
      // Blockquotes
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-slate-50 rounded-r-lg italic text-slate-600">
            {renderFormattedText(line.replace('> ', ''))}
          </blockquote>
        );
      }
      
      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-6 mb-1 text-slate-700 leading-relaxed list-disc">
            {renderFormattedText(line.replace(/^[-*]\s/, ''))}
          </li>
        );
      }
      
      // Ordered list
      const orderedMatch = line.match(/^(\d+)\.\s(.+)/);
      if (orderedMatch) {
        return (
          <li key={idx} className="ml-6 mb-1 text-slate-700 leading-relaxed list-decimal">
            {renderFormattedText(orderedMatch[2])}
          </li>
        );
      }
      
      // Empty line
      if (line.trim() === '') {
        return <div key={idx} className="h-4" />;
      }
      
      // Regular paragraph with inline formatting
      return <p key={idx} className="mb-3 text-slate-700 leading-relaxed">{renderFormattedText(line)}</p>;
    });
  };

  const renderVisualStructure = (blocks: EditorBlock[]) => {
    const headers = blocks.filter(b => b.type === 'text' && b.content.startsWith('#')).map(b => {
      const level = b.content.match(/^#+/)?.[0].length || 0;
      return { level, text: b.content.replace(/^#+\s/, '') };
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

  const isApproved = project.status === ProjectStatus.DRAFT_APPROVED;
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
      
      {/* --- FLOATING TOOLBAR (Text Selection) - Rich Text + AI Refine --- */}
      {selectionState.showToolbar && (
        <div 
          className="fixed z-50 animate-in zoom-in-95 fade-in duration-200 origin-bottom-center"
          style={{ top: Math.max(10, selectionState.top - 100), left: Math.max(20, selectionState.left - 200) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden ring-1 ring-black/5">
            {/* Rich Text Formatting Row */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-100">
              {/* Heading Selector */}
              <div className="relative group">
                <button
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-indigo-600 rounded-lg transition"
                  onClick={() => {
                    const newLevel = (currentHeading + 1) % 4;
                    handleFloatingHeadingChange(newLevel);
                  }}
                  title="Toggle heading level"
                >
                  <Type size={14} />
                  <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{currentHeading === 0 ? 'P' : `H${currentHeading}`}</span>
                </button>
              </div>
              
              <div className="w-px h-5 bg-slate-200 mx-0.5" />
              
              {/* Text Formatting Buttons */}
              <button
                onClick={() => handleFloatingFormat('bold')}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="Bold **text**"
              >
                <Bold size={14} />
              </button>
              <button
                onClick={() => handleFloatingFormat('italic')}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="Italic *text*"
              >
                <Italic size={14} />
              </button>
              <button
                onClick={() => handleFloatingFormat('underline')}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="Underline"
              >
                <Underline size={14} />
              </button>
              <button
                onClick={() => handleFloatingFormat('strikethrough')}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="Strikethrough ~~text~~"
              >
                <Strikethrough size={14} />
              </button>
              
              <div className="w-px h-5 bg-slate-200 mx-0.5" />
              
              <button
                onClick={() => handleFloatingFormat('link')}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="Link"
              >
                <Link2 size={14} />
              </button>
              <button
                onClick={() => handleFloatingFormat('quote')}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="Quote"
              >
                <Quote size={14} />
              </button>
              <button
                onClick={() => handleFloatingFormat('bulletList')}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="Unordered list"
              >
                <List size={14} />
              </button>
              
              <div className="w-px h-5 bg-slate-200 mx-0.5" />
              
              <button
                onClick={() => handleFloatingFormat('clear')}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Clear formatting"
              >
                <Eraser size={14} />
              </button>
              
              <button 
                onClick={() => setSelectionState(prev => ({ ...prev, showToolbar: false }))}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 ml-1"
              >
                <X size={14} />
              </button>
            </div>
            
            {/* AI Refine Row */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Sparkles size={14} />
              </div>
              <input 
                type="text" 
                value={quickRefineInput}
                onChange={(e) => setQuickRefineInput(e.target.value)}
                placeholder="Ask AI to refine this selection..."
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-400 min-w-[200px]"
                onKeyDown={(e) => e.key === 'Enter' && handleQuickRefineSubmit()}
              />
              <button 
                onClick={handleQuickRefineSubmit}
                disabled={isQuickRefining || !quickRefineInput.trim()}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isQuickRefining ? '...' : 'Refine'}
              </button>
            </div>
          </div>
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
                        className="flex-1 w-full resize-none outline-none bg-white border border-slate-200 rounded-xl p-4 text-slate-700 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition custom-scrollbar shadow-sm hover:border-slate-300"
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
                                className={`${bgColor} p-3 rounded-lg border ${borderColor} shadow-sm relative group hover:shadow-md transition ${
                                  c.targetBlockId ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300' : ''
                                }`}
                                onClick={() => c.targetBlockId && scrollToBlockAndHighlight(c.targetBlockId)}
                                title={c.targetBlockId ? 'Click to jump to corresponding paragraph' : undefined}
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
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-95"
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
             
             <div className="flex items-center gap-2">
               
               <button 
                 onClick={handleCopyContent} 
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition"
                 title="Copy Markdown"
               >
                  <Copy size={14} /> Copy
               </button>
               
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

          {/* Reference Toolbar */}
          <div className="h-10 border-b border-slate-100 flex items-center px-4 bg-slate-50/50 shrink-0 relative z-30">
             <div className="relative">
               <button
                  onClick={() => blocks.some(b => b.content) && setShowReferencePopup(!showReferencePopup)}
                  disabled={!blocks.some(b => b.content)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    blocks.some(b => b.content) 
                      ? 'bg-indigo-700 text-white hover:bg-indigo-800 shadow-sm' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
              <div ref={editorScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                 {/* FLUID EDITOR: No max-w-4xl constraint anymore, fills fluid middle column */}
                 <div className="mx-auto bg-white shadow-lg min-h-[800px] rounded-xl border border-slate-200 w-full max-w-none overflow-hidden">
                    {/* Editor Header with hint */}
                    <div className="px-6 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <Type size={12} />
                        Select text to use formatting tools
                      </span>
                      <span className="text-xs text-slate-300">Markdown Editor</span>
                    </div>
                    
                    {/* Editor Content Area - Larger blocks */}
                    <div className="p-6 md:p-10">
                      {blocks.map((block, index) => (
                         <div 
                           key={block.id} 
                           data-content-block-id={block.id}
                           className={`group relative mb-8 rounded-xl p-4 transition-all border-2 ${
                             editingBlockId === block.id 
                               ? 'border-indigo-300 bg-indigo-50/20 shadow-sm' 
                               : highlightedBlockId === block.id 
                                 ? 'border-amber-300 animate-pulse-highlight bg-amber-50/30' 
                                 : 'border-transparent hover:border-slate-200 hover:bg-slate-50/30'
                           }`}
                         >
                            {/* Block Controls (Only show when editing this block) */}
                            {editingBlockId === block.id && (
                            <div className="absolute right-2 top-2 flex items-center gap-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-10">
                               <button type="button" onClick={(e) => { e.stopPropagation(); moveBlock(index, -1); }} className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-slate-700" disabled={index === 0}><ArrowUp size={16} /></button>
                               <button type="button" onClick={(e) => { e.stopPropagation(); moveBlock(index, 1); }} className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-slate-700" disabled={index === blocks.length - 1}><ArrowDown size={16} /></button>
                               {block.type === 'image' && (
                                 <>
                                   <div className="w-px h-5 bg-slate-200 mx-1"></div>
                                   <button type="button" onClick={(e) => { e.stopPropagation(); resizeImage(index, 'small'); }} className={`text-xs px-2 py-1.5 rounded-lg font-medium transition ${block.size === 'small' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}>S</button>
                                   <button type="button" onClick={(e) => { e.stopPropagation(); resizeImage(index, 'medium'); }} className={`text-xs px-2 py-1.5 rounded-lg font-medium transition ${block.size === 'medium' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}>M</button>
                                   <button type="button" onClick={(e) => { e.stopPropagation(); resizeImage(index, 'large'); }} className={`text-xs px-2 py-1.5 rounded-lg font-medium transition ${block.size === 'large' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}>L</button>
                                 </>
                               )}
                               <div className="w-px h-5 bg-slate-200 mx-1"></div>
                               <button type="button" onClick={(e) => { e.stopPropagation(); deleteBlock(index); }} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"><Trash2 size={16} /></button>
                            </div>
                            )}

                            {/* Content Render - Larger text */}
                            {block.type === 'text' ? (
                               <textarea 
                                 ref={(el) => {
                                   if (editingBlockId === block.id) {
                                     activeTextareaRef.current = el;
                                   }
                                 }}
                                 data-block-editor
                                 value={block.content}
                                 onChange={(e) => {
                                   updateBlock(block.id, e.target.value);
                                   // Auto-resize on change
                                   const target = e.target as HTMLTextAreaElement;
                                   target.style.height = 'auto';
                                   target.style.height = `${Math.max(target.scrollHeight, 48)}px`;
                                   
                                   // Detect current heading level
                                   const cursorPos = target.selectionStart;
                                   const content = target.value;
                                   let lineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
                                   const currentLine = content.substring(lineStart);
                                   const headingMatch = currentLine.match(/^(#{1,6})\s/);
                                   setCurrentHeading(headingMatch ? headingMatch[1].length : 0);
                                 }}
                                 onFocus={(e) => {
                                   setEditingBlockId(block.id);
                                   activeTextareaRef.current = e.target as HTMLTextAreaElement;
                                   // Detect current heading level on focus
                                   const target = e.target as HTMLTextAreaElement;
                                   const cursorPos = target.selectionStart;
                                   const content = target.value;
                                   let lineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
                                   const currentLine = content.substring(lineStart);
                                   const headingMatch = currentLine.match(/^(#{1,6})\s/);
                                   setCurrentHeading(headingMatch ? headingMatch[1].length : 0);
                                 }}
                                 onBlur={() => {
                                   setEditingBlockId(null);
                                 }}
                                 onMouseUp={(e) => handleTextareaMouseUp(e, block.id)}
                                 className="w-full resize-none outline-none bg-transparent text-lg md:text-xl leading-relaxed text-slate-800 font-serif px-3 py-2 rounded-xl transition"
                                 placeholder="Enter content, formatting tools will appear when text is selected..."
                                 style={{ 
                                   minHeight: '3em',
                                   overflow: 'hidden',
                                   lineHeight: '1.9',
                                   height: 'auto'
                                 }}
                               />
                            ) : (
                               <div className={`relative ${block.size === 'small' ? 'max-w-sm' : block.size === 'medium' ? 'max-w-2xl' : 'max-w-full'} mx-auto`}>
                                  <img src={block.src} alt={block.caption} className="rounded-xl shadow-lg border border-slate-200 w-full" />
                                  <input 
                                    type="text" 
                                    value={block.caption || ''} 
                                    onChange={(e) => updateCaption(index, e.target.value)}
                                    onFocus={() => setEditingBlockId(block.id)}
                                    onBlur={() => setEditingBlockId(null)}
                                    className="w-full text-center text-sm text-slate-500 mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
                                    placeholder="Add image caption..." 
                                  />
                               </div>
                            )}
                         </div>
                      ))}
                      
                      {/* Add New Block Hint - Larger */}
                      <div 
                        className="h-24 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition cursor-pointer mt-6" 
                        onClick={() => setBlocks([...blocks, { id: Date.now().toString(), type: 'text', content: '' }])}
                      >
                         <Plus size={20} className="mr-2" />
                         <span className="text-base">Click to add text or drag images here</span>
                      </div>
                    </div>
                 </div>
              </div>
            ) : viewMode === 'preview' ? (
              /* Client-style preview - matches Client Portal's ContentReview display */
              <div className="flex-1 min-h-0 w-full p-8 md:p-12 overflow-y-auto bg-white mx-auto max-w-5xl shadow-sm my-4 rounded-lg border border-slate-100">
                <div className="space-y-6 font-serif text-lg leading-relaxed text-slate-800">
                  {convertEditorBlocksToContentBlocks(blocks).map((block) => (
                    <div 
                      key={block.id} 
                      data-content-block-id={block.id}
                      className={`p-4 -mx-4 rounded-lg border transition-all ${
                        highlightedBlockId === block.id 
                          ? 'border-amber-300 animate-pulse-highlight' 
                          : 'border-transparent'
                      }`}
                    >
                      {/* Header rendering */}
                      {block.type === 'header' && (
                        block.level === 1 ? (
                          <h1 className="text-3xl md:text-4xl font-bold font-sans text-slate-900 mb-2 mt-4">{block.content}</h1>
                        ) : block.level === 3 ? (
                          <h3 className="text-xl md:text-2xl font-bold font-sans text-slate-800 mb-2 mt-4">{block.content}</h3>
                        ) : (
                          <h2 className="text-2xl md:text-3xl font-bold font-sans text-slate-900 mb-2 mt-4">{block.content}</h2>
                        )
                      )}
                      {/* Paragraph rendering */}
                      {block.type === 'paragraph' && (
                        <div className={block.content.trim().startsWith('* ') ? 'pl-5 relative' : ''}>
                          {block.content.trim().startsWith('* ') && (
                             <span className="absolute left-0">•</span>
                          )}
                          <p>{renderFormattedText(block.content.trim().startsWith('* ') ? block.content.trim().substring(2) : block.content)}</p>
                        </div>
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
              <div className="flex-1 min-h-0 w-full p-8 overflow-y-auto bg-slate-50/50">
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
                         value={refineInstruction}
                         onChange={(e) => setRefineInstruction(e.target.value)}
                         placeholder={attachedFile ? "Ask AI what to do with this file..." : "Ask AI to refine text..."}
                         className="flex-1 text-sm bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-400 px-1"
                         onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                      />
                      <button 
                        onClick={handleRefine}
                        disabled={isRefining || (!refineInstruction && !attachedFile)}
                        className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
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
                        <button 
                          onClick={handleGenerateMetadata}
                          disabled={isMetaGenerating || !blocks.some(b => b.content)}
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
                    <div className="writing-vertical-rl text-slate-400 font-medium tracking-wide uppercase text-xs">CMS Settings</div>
                  </div>
               ) : (
                 <div className="p-5 overflow-y-auto h-full flex flex-col custom-scrollbar">
                   <div className="space-y-5 flex-1">
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
