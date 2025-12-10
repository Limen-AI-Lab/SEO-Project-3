
import React, { useState } from 'react';
import { Article, ProjectStatus, ARTICLE_STATUS } from '../types';
import { Send, AlignLeft, Sparkles, MessageSquare, Wand2 } from 'lucide-react';
import { generateBlogOutline, refineBlogOutline } from '../services/geminiService';

interface Props {
  project: Article;
  onUpdate: (updates: Partial<Article>) => void;
}

const StageOutline: React.FC<Props> = ({ project, onUpdate }) => {
  const [outline, setOutline] = useState(project.outlineContent || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const handleSubmit = () => {
    if (outline.trim().length < 10) return alert("Please provide a more detailed outline.");
    onUpdate({ 
      outlineContent: outline,
      status: ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE // Use new status constant
    });
  };

  const handleSaveDraft = () => {
    onUpdate({ outlineContent: outline });
  };

  const handleAiGenerate = async () => {
    if (outline.trim().length > 10) {
      if (!confirm("This will overwrite the current outline. Continue?")) return;
    }
    
    setIsGenerating(true);
    // Note: Assuming 'Client' as fallback name if not passed, or ideally fetch from campaign, 
    // but outline generation mostly depends on title.
    const generated = await generateBlogOutline(project.selectedTitle || project.title, "Client");
    if (generated) {
      setOutline(generated);
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
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[650px]">
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

            {/* AI Refinement Bar */}
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

            <textarea 
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition resize-none font-mono text-sm leading-relaxed"
              placeholder="# Introduction&#10;- Hook&#10;- Thesis statement&#10;&#10;# Section 1: ..."
            />
          </div>

          <div className="flex justify-end gap-4">
            <button 
              onClick={handleSaveDraft}
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition"
            >
              Save Draft
            </button>
            <button onClick={handleSubmit} className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition flex items-center gap-2 shadow-lg shadow-slate-900/20">
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
        </div>
      </div>
    </div>
  );
};

export default StageOutline;
