import { X } from 'lucide-react';

interface ConfirmNavigationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  primaryActionText: string;
  secondaryActionText: string;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onDismiss: () => void;
}

export function ConfirmNavigationDialog({
   isOpen, title, description, primaryActionText, secondaryActionText, onPrimaryAction, onSecondaryAction, onDismiss
}: ConfirmNavigationDialogProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
       <div className="bg-[#0c0d12] border border-buildops-border rounded w-full max-w-[290px] p-4 relative animate-in zoom-in-[0.98] duration-100 font-sans shadow-lg text-left">
          <div className="flex justify-between items-start mb-3 gap-2">
             <div>
                <h3 className="text-sm font-semibold text-buildops-text leading-tight">{title}</h3>
                <p className="text-xs text-buildops-text-secondary mt-1 leading-normal">{description}</p>
             </div>
             <button 
                onClick={onDismiss} 
                className="p-1 -mr-1 -mt-1 text-buildops-text-secondary/60 hover:text-buildops-text rounded hover:bg-buildops-card transition-colors shrink-0"
             >
                <X className="w-3.5 h-3.5" />
             </button>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
             <button
                onClick={onSecondaryAction}
                className="px-3 py-1.5 border border-buildops-border hover:bg-buildops-card text-buildops-text-secondary hover:text-buildops-text font-medium rounded text-xs transition-colors cursor-pointer"
             >
                {secondaryActionText}
             </button>
             <button
                onClick={onPrimaryAction}
                className="px-3 py-1.5 bg-buildops-blue hover:bg-buildops-blue/90 text-white font-semibold rounded text-xs transition-colors shadow-sm cursor-pointer"
             >
                {primaryActionText}
             </button>
          </div>
       </div>
    </div>
  );
}
