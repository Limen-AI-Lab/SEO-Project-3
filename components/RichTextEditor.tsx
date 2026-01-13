import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
// @ts-ignore
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { DragHandle } from '@tiptap/extension-drag-handle';
import { 
  Bold, Italic, List, ListOrdered, Quote, Heading1, Heading2, Heading3, 
  Image as ImageIcon, Table as TableIcon, Copy, FileText, Type, Check,
  Link2, Trash2, Plus, CornerDownLeft, ChevronDown, GripVertical, MoreHorizontal
} from 'lucide-react';

interface RichTextEditorProps {
  content: string; // Initial Markdown content
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  hideCopy?: boolean;
  fullWidth?: boolean;
  editable?: boolean;
}

export interface RichTextEditorRef {
  getMarkdown: () => string;
  getPlainText: () => string;
}

const RichTextEditor = React.forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ content, onChange, placeholder, className, hideCopy = false, fullWidth = false, editable = true }, ref) => {
  const BubbleMenuAny = BubbleMenu as any;
  const editorScrollRef = React.useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number, bottom?: number, left: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Markdown,
      DragHandle.configure({
        render: () => {
          const element = document.createElement('div');
          element.className = 'drag-handle-notion flex items-center bg-white/50 backdrop-blur-sm border border-slate-200/50 shadow-sm rounded-lg p-0.5 animate-in fade-in slide-in-from-left-2 ring-1 ring-black/5 transition-opacity duration-200';
          
          // Plus Button
          const plusBtn = document.createElement('button');
          plusBtn.className = 'p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition plus-btn-trigger';
          plusBtn.title = 'Click to add';
          plusBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
          
          // Divider
          const divider = document.createElement('div');
          divider.className = 'w-px h-3 bg-slate-200 mx-0.5';
          
          // Drag Handle
          const handle = document.createElement('div');
          handle.className = 'p-1 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-600 transition';
          handle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip-vertical"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
          
          element.appendChild(plusBtn);
          element.appendChild(divider);
          element.appendChild(handle);
          
          plusBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = plusBtn.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const threshold = 400; // Increased threshold
            
            if (spaceBelow < threshold) {
              // Position above the button if space below is limited
              setMenuPosition({ 
                bottom: window.innerHeight - rect.top + 8, 
                left: rect.left,
              });
            } else {
              // Position below the button normally
              setMenuPosition({ 
                top: rect.bottom + 8, 
                left: rect.left,
              });
            }
            setIsMenuExpanded(true);
          });

          return element;
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-xl shadow-lg border border-slate-200 max-w-full my-6 mx-auto block',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-6 border border-slate-200',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-slate-200 p-2 bg-slate-100 font-bold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-slate-200 p-2',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 underline underline-offset-4 cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your masterpiece...',
      }),
    ],
    content: content,
    editable: editable,
    onUpdate: ({ editor }) => {
      onChange((editor.storage as any).markdown.getMarkdown());
    },
    onSelectionUpdate: () => {
      setIsMenuExpanded(false);
    },
    editorProps: {
      attributes: {
        class: `prose prose-slate max-w-none focus:outline-none min-h-[500px] p-8 font-serif text-lg leading-relaxed text-slate-800 ${!editable ? 'readonly-editor' : ''}`,
      },
    },
  });

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    getMarkdown: () => editor ? (editor.storage as any).markdown.getMarkdown() : '',
    getPlainText: () => editor ? editor.getText() : ''
  }));

  // Update editor content when prop changes (e.g., after AI generation)
  useEffect(() => {
    if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Hide drag handle on scroll
  useEffect(() => {
    const scrollContainer = editorScrollRef.current;
    if (!scrollContainer) return;

    let timeout: NodeJS.Timeout;
    const onScroll = () => {
      const handle = document.querySelector('.drag-handle-notion');
      if (handle) {
        (handle as HTMLElement).style.opacity = '0';
        (handle as HTMLElement).style.pointerEvents = 'none';
      }
      
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const handle = document.querySelector('.drag-handle-notion');
        if (handle) {
          (handle as HTMLElement).style.opacity = '';
          (handle as HTMLElement).style.pointerEvents = '';
        }
      }, 150);
    };

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', onScroll);
      clearTimeout(timeout);
    };
  }, [editor]);

  const addTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const addImage = () => {
    const url = window.prompt('Enter Image URL:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };

  if (!editor) return null;

  return (
    <div className={`flex flex-col bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden group/editor ${className || 'h-full'}`}>
      <style>{`
        .readonly-editor + .drag-handle-notion,
        .readonly-editor ~ .drag-handle-notion,
        [contenteditable="false"] + .drag-handle-notion {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>

      {/* Floating Insertion Menu (from + button) */}
      {isMenuExpanded && menuPosition && (
        <div 
          className="fixed z-[10000] w-48 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5"
          style={{ 
            top: menuPosition.top, 
            bottom: menuPosition.bottom,
            left: menuPosition.left 
          }}
        >
          <div className="flex flex-col">
            <button 
              onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setIsMenuExpanded(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded text-slate-500"><Heading1 size={14} /></div>
              <span className="font-medium">Heading 1</span>
            </button>
            <button 
              onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setIsMenuExpanded(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded text-slate-500"><Heading3 size={14} /></div>
              <span className="font-medium">Heading 3</span>
            </button>
            <button 
              onClick={() => { editor.chain().focus().setParagraph().run(); setIsMenuExpanded(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded text-slate-500"><Type size={14} /></div>
              <span className="font-medium">Text</span>
            </button>
            <button 
              onClick={() => { editor.chain().focus().toggleBulletList().run(); setIsMenuExpanded(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded text-slate-500"><List size={14} /></div>
              <span className="font-medium">Bullet List</span>
            </button>
            <button 
              onClick={() => { editor.chain().focus().toggleOrderedList().run(); setIsMenuExpanded(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded text-slate-500"><ListOrdered size={14} /></div>
              <span className="font-medium">Numbered List</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button 
              onClick={() => { addTable(); setIsMenuExpanded(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded text-slate-500"><TableIcon size={14} /></div>
              <span className="font-medium">Table</span>
            </button>
            <button 
              onClick={() => { addImage(); setIsMenuExpanded(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded text-slate-500"><ImageIcon size={14} /></div>
              <span className="font-medium">Image</span>
            </button>
          </div>
        </div>
      )}

      {/* Backdrop for closing menu */}
      {isMenuExpanded && (
        <div 
          className="fixed inset-0 z-[9999]" 
          onClick={() => setIsMenuExpanded(false)}
        />
      )}

      {/* Bubble Menu (appears on selection) */}
      <BubbleMenuAny editor={editor} tippyOptions={{ duration: 150 }}>
        <div className="flex items-center gap-0.5 bg-slate-900 text-white rounded-xl shadow-2xl p-1.5 border border-slate-700/50 backdrop-blur-md ring-1 ring-white/10">
          <button 
            onClick={() => editor.chain().focus().toggleBold().run()} 
            className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Bold size={14} />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleItalic().run()} 
            className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Italic size={14} />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button 
            onClick={() => editor.chain().focus().toggleBulletList().run()} 
            className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <List size={14} />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleOrderedList().run()} 
            className={`p-1.5 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <ListOrdered size={14} />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleBlockquote().run()} 
            className={`p-1.5 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Quote size={14} />
          </button>
        </div>
      </BubbleMenuAny>

      {/* Table Action Trigger (appears near focused cell) */}
      <BubbleMenuAny 
        pluginKey="tableMoreMenu"
        editor={editor} 
        tippyOptions={{ 
          duration: 150,
          placement: 'bottom-start',
          offset: [0, 8],
          zIndex: 9999,
          interactive: true,
          appendTo: () => document.body,
          onHidden: () => setIsTableMenuOpen(false)
        }} 
        shouldShow={({ editor }: any) => editor.isActive('table')}
      >
        <div className="flex flex-col items-start">
          <button 
            onClick={() => setIsTableMenuOpen(!isTableMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white rounded-lg shadow-2xl border border-slate-700 hover:bg-slate-800 transition-all group pointer-events-auto"
          >
            <TableIcon size={14} className="text-slate-400 group-hover:text-white transition-colors" />
            <MoreHorizontal size={14} />
          </button>

          {isTableMenuOpen && (
            <div className="mt-1.5 w-52 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 overflow-hidden pointer-events-auto">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 mb-1">
                Column Actions
              </div>
              <button 
                onClick={() => { editor.chain().focus().addColumnBefore().run(); setIsTableMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Plus size={14} className="text-slate-400" />
                <span>Insert Before</span>
              </button>
              <button 
                onClick={() => { editor.chain().focus().addColumnAfter().run(); setIsTableMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Plus size={14} className="text-slate-400 rotate-45" />
                <span>Insert After</span>
              </button>
              <button 
                onClick={() => { editor.chain().focus().deleteColumn().run(); setIsTableMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} className="text-red-400" />
                <span>Delete Column</span>
              </button>

              <div className="my-1 border-t border-slate-100" />
              
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 mb-1">
                Row Actions
              </div>
              <button 
                onClick={() => { editor.chain().focus().addRowBefore().run(); setIsTableMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Plus size={14} className="text-slate-400" />
                <span>Insert Above</span>
              </button>
              <button 
                onClick={() => { editor.chain().focus().addRowAfter().run(); setIsTableMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Plus size={14} className="text-slate-400 rotate-45" />
                <span>Insert Below</span>
              </button>
              <button 
                onClick={() => { editor.chain().focus().deleteRow().run(); setIsTableMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} className="text-red-400" />
                <span>Delete Row</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button 
                onClick={() => { editor.chain().focus().toggleHeaderRow().run(); setIsTableMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${editor.isActive('table', { headerRow: true }) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span>Header Row</span>
                {editor.isActive('table', { headerRow: true }) && <Check size={14} />}
              </button>
              <button 
                onClick={() => { editor.chain().focus().toggleHeaderColumn().run(); setIsTableMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${editor.isActive('table', { headerColumn: true }) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span>Header Column</span>
                {editor.isActive('table', { headerColumn: true }) && <Check size={14} />}
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button 
                onClick={() => { editor.chain().focus().deleteTable().run(); setIsTableMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors mt-1"
              >
                <Trash2 size={14} />
                <span>Delete Entire Table</span>
              </button>
            </div>
          )}
        </div>
      </BubbleMenuAny>

      {/* Editable Area */}
      <div ref={editorScrollRef} className="flex-1 overflow-y-auto bg-white scroll-smooth custom-scrollbar">
        <div className={`${fullWidth ? 'max-w-7xl' : 'max-w-5xl'} mx-auto min-h-full transition-all duration-300`}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
});

export default RichTextEditor;
