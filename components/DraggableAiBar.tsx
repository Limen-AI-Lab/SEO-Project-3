import React, { useState, useEffect } from 'react';
import { Sparkles, Image as ImageIcon, X, Paperclip, ChevronDown } from 'lucide-react';

interface DraggableAiBarProps {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  onRefine: () => void;
  isRefining: boolean;
  instruction: string;
  setInstruction: (instruction: string) => void;
  attachedFile: any;
  setAttachedFile: (file: any) => void;
  aiSuggestion: any;
  setAiSuggestion: (suggestion: any) => void;
  confirmImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAiAttachment: (e: React.ChangeEvent<HTMLInputElement>) => void;
  boundaryRef: React.RefObject<HTMLElement>;
}

const DraggableAiBar: React.FC<DraggableAiBarProps> = ({ 
  expanded, 
  setExpanded, 
  onRefine, 
  isRefining, 
  instruction, 
  setInstruction, 
  attachedFile, 
  setAttachedFile,
  aiSuggestion,
  setAiSuggestion,
  confirmImage,
  fileInputRef,
  handleAiAttachment,
  boundaryRef
}) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const startPos = React.useRef({ x: 0, y: 0 });
  const startTime = React.useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || expanded) return;
    setDragging(true);
    startPos.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    startTime.current = Date.now();
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging || !boundaryRef.current) return;
    
    const onMouseMove = (e: MouseEvent) => {
      const bounds = boundaryRef.current!.getBoundingClientRect();
      
      // The icon is centered in the viewport when pos.x = 0 because of 'left-1/2' and 'translateX(-50%)'
      const initialAbsX = window.innerWidth / 2;
      // The icon is at the bottom of the viewport when pos.y = 0 because of 'bottom-6'
      const initialAbsY = window.innerHeight - 24 - 24; 

      let targetX = e.clientX - startPos.current.x;
      let targetY = e.clientY - startPos.current.y;

      const currentAbsX = initialAbsX + targetX;
      const currentAbsY = initialAbsY + targetY;

      const margin = 24; 
      
      if (currentAbsX < bounds.left + margin) targetX = bounds.left + margin - initialAbsX;
      if (currentAbsX > bounds.right - margin) targetX = bounds.right - margin - initialAbsX;
      if (currentAbsY < bounds.top + margin) targetY = bounds.top + margin - initialAbsY;
      if (currentAbsY > bounds.bottom - margin) targetY = bounds.bottom - margin - initialAbsY;

      setPos({ x: targetX, y: targetY });
    };
    
    const onMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, boundaryRef]);

  const onClick = (e: React.MouseEvent) => {
    const dist = Math.sqrt(Math.pow(e.clientX - (startPos.current.x + pos.x), 2) + Math.pow(e.clientY - (startPos.current.y + pos.y), 2));
    if (Date.now() - startTime.current < 200 && dist < 5) {
      setExpanded(true);
    }
  };

  return (
    <div 
      className={`fixed z-[100] transition-[width,max-width,opacity] ${expanded ? 'w-full max-w-xl px-4 left-1/2 bottom-6 -translate-x-1/2 duration-300' : 'w-12 left-1/2 bottom-6 duration-200'}`}
      style={{
        transform: expanded 
          ? 'translateX(-50%)' 
          : `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`,
        transition: dragging ? 'none' : undefined,
        cursor: !expanded ? (dragging ? 'grabbing' : 'grab') : undefined,
        willChange: 'transform, width'
      }}
      onMouseDown={onMouseDown}
    >
      {aiSuggestion && expanded && (
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
             <button onClick={confirmImage} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 shadow-sm font-medium">Yes, Insert Image</button>
          </div>
        </div>
      )}

      {!expanded ? (
        <button 
          onClick={onClick}
          className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-indigo-600 hover:scale-110 transition-all group relative pointer-events-auto"
          title="Ask AI to refine (Drag to move)"
        >
          <Sparkles size={20} className="group-hover:animate-pulse" />
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Ask AI
          </div>
        </button>
      ) : (
        <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 ring-1 ring-black/5 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 relative">
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
                 value={instruction}
                 onChange={(e) => setInstruction(e.target.value)}
                 placeholder={attachedFile ? "Ask AI what to do with this file..." : "Ask AI to refine text..."}
                 className="flex-1 text-sm bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-400 px-1"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') onRefine();
                   if (e.key === 'Escape') setExpanded(false);
                 }}
              />
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={onRefine}
                  disabled={isRefining || (!instruction && !attachedFile)}
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                >
                  {isRefining ? 'Refining...' : 'Refine'}
                </button>
                <button 
                  onClick={() => setExpanded(false)}
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
  );
};

export default DraggableAiBar;
