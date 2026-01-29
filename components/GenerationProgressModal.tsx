import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';

export type StepStatus = 'pending' | 'loading' | 'completed';

export interface GenerationStep {
  id: number;
  text: string;
  status: StepStatus;
}

interface GenerationProgressModalProps {
  isOpen: boolean;
  steps: GenerationStep[];
}

const GenerationProgressModal: React.FC<GenerationProgressModalProps> = ({
  isOpen,
  steps,
}) => {
  const { t } = useTranslation(['article', 'common']);
  
  if (!isOpen) return null;

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        );
      case 'loading':
        return (
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          </div>
        );
      case 'pending':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <Circle className="w-5 h-5 text-slate-300" />
          </div>
        );
    }
  };

  const getStepTextStyle = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return 'text-green-700';
      case 'loading':
        return 'text-slate-900 font-medium';
      case 'pending':
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h3 className="text-xl font-bold text-slate-900 text-center">
            {t('generationModal.title')}
          </h3>
          <p className="text-sm text-slate-500 text-center mt-2">
            {t('generationModal.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="px-8 py-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 relative">
                  {getStepIcon(step.status)}
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div 
                      className={`absolute left-1/2 top-8 w-0.5 h-6 -translate-x-1/2 transition-colors duration-300 ${
                        step.status === 'completed' ? 'bg-green-200' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
                
                {/* Text */}
                <div className="flex-1 pt-1">
                  <p className={`text-sm leading-relaxed transition-colors duration-300 ${getStepTextStyle(step.status)}`}>
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs text-slate-500 text-center">
              {t('generationModal.footerNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerationProgressModal;
