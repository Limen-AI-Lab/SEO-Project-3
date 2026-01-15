import React, { useState } from 'react';
import { X, Key, Share2, FileInput, Zap, List, HelpCircle, ArrowLeftRight, Info, BarChart2, Sparkles, Layers } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onBlogWizard?: (method: string) => void; // Callback for Blog Wizard (Step-by-Step) flow, passes selected method
}

const SelectWritingMethodModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, onBlogWizard }) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  if (!isOpen) return null;

  // Configuration for Featured methods
  const featuredMethods = [
    {
      id: 'keyword-driven',
      title: 'Keyword-Driven Writing',
      description: 'Enter a target keyword and generate SEO-optimized articles centered around it. Rapidly improve site ranking and attract accurate traffic.',
      icon: <Key size={24} className="text-green-500" />,
      iconBg: 'bg-green-100',
      activeBorder: 'border-green-500',
      activeBg: 'bg-green-50'
    },
    {
      id: 'topic-expansion',
      title: 'Topic Expansion Writing',
      description: 'Input any topic or idea in your mind, explore creative possibilities, and automatically generate SEO-optimized content.',
      icon: <Share2 size={24} className="text-purple-500" />,
      iconBg: 'bg-purple-100',
      activeBorder: 'border-purple-500',
      activeBg: 'bg-purple-50'
    },
    {
      id: 'article-integration',
      title: 'Article Integration',
      description: 'Input URLs of several articles to analyze and integrate their ideas, creating a new article with an improved structure.',
      icon: <FileInput size={24} className="text-blue-500" />,
      iconBg: 'bg-blue-100',
      activeBorder: 'border-blue-500',
      activeBg: 'bg-blue-50'
    }
  ];

  // Configuration for Specific Article Types
  const specificTypes = [
    {
      id: 'overview',
      title: 'Overview Article',
      description: 'Create visually engaging list articles with rich keywords. Example titles like "10 Best...", suitable for guides and recommendations.',
      icon: <List size={24} className="text-indigo-500" />,
      iconBg: 'bg-indigo-100'
    },
    {
      id: 'how-to',
      title: 'How-to Guide',
      description: 'Create step-by-step operational instructions. Uses concise language and clear hierarchy, ideal for solving practical problems.',
      icon: <HelpCircle size={24} className="text-teal-500" />,
      iconBg: 'bg-teal-100'
    },
    {
      id: 'comparison',
      title: 'Comparison Article',
      description: 'Analyze similarities and differences between two products or services. Lists pros and cons to help decision making.',
      icon: <ArrowLeftRight size={24} className="text-rose-500" />,
      iconBg: 'bg-rose-100'
    },
    {
      id: 'explanatory',
      title: 'Explanatory Article',
      description: 'Provide detailed explanations of concepts or phenomena.',
      icon: <Info size={24} className="text-blue-500" />,
      iconBg: 'bg-blue-100'
    },
    {
      id: 'analytical',
      title: 'Analytical Article',
      description: 'Deep dive analysis of data or trends.',
      icon: <BarChart2 size={24} className="text-purple-500" />,
      iconBg: 'bg-purple-100'
    }
  ];

  const handleSelect = (id: string) => {
    setSelectedMethod(id);
  };

  // Blog Wizard is enabled for keyword-driven and topic-expansion writing
  const isBlogWizardEnabled = selectedMethod === 'keyword-driven' || selectedMethod === 'topic-expansion';

  const handleBlogWizardClick = () => {
    if (isBlogWizardEnabled && onBlogWizard && selectedMethod) {
      onBlogWizard(selectedMethod);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-900">Select Writing Method</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-50">
          {/* Featured Section */}
          <div className="mb-10">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">Featured</h3>
              <p className="text-sm text-slate-500">Focus on functional writing modes tailored to your selected topics or keywords.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredMethods.map((method) => (
                <div
                  key={method.id}
                  onClick={() => handleSelect(method.id)}
                  className={`
                    relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 bg-white hover:shadow-md
                    ${selectedMethod === method.id 
                      ? `${method.activeBorder} ${method.activeBg} ring-1 ring-offset-0 ${method.activeBorder.replace('border', 'ring')}` 
                      : 'border-slate-100 hover:border-indigo-200'}
                  `}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-lg ${method.iconBg} flex items-center justify-center`}>
                      {method.icon}
                    </div>
                    {selectedMethod === method.id && (
                      <div className={`w-6 h-6 rounded-full ${method.activeBorder.replace('border-', 'bg-')} text-white flex items-center justify-center`}>
                        <CheckIcon size={14} />
                      </div>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">{method.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{method.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Specific Article Types Section */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Specific Article Types</h3>
            <p className="text-sm text-slate-500 mb-4">Structured formats customized for specific writing goals like tutorials, lists, or comparisons.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {specificTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => handleSelect(type.id)}
                  className={`
                    p-6 rounded-xl border border-slate-100 bg-white cursor-pointer transition hover:border-indigo-200 hover:shadow-md
                    ${selectedMethod === type.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}
                  `}
                >
                  <div className={`w-10 h-10 rounded-lg ${type.iconBg} flex items-center justify-center mb-4`}>
                    {type.icon}
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">{type.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-slate-500 font-medium hover:bg-slate-50 rounded-lg transition"
          >
            Cancel
          </button>
          <div className="flex items-center gap-4">
            <button 
              disabled={true}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium border border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50"
            >
              <Zap size={18} />
              One-Click Generate
            </button>
            <button 
              onClick={handleBlogWizardClick}
              disabled={!isBlogWizardEnabled}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition shadow-sm
                ${isBlogWizardEnabled 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
              `}
            >
              <Sparkles size={18} />
              Blog Wizard (Step-by-Step)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for local use
const CheckIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default SelectWritingMethodModal;

