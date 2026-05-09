import { AlertCircle, Check, X } from 'lucide-react';
import { Button } from './button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  isAlert?: boolean;
}

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, isAlert = false }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300">
        <div className="px-6 py-4 border-b flex items-center gap-2 bg-slate-50/50">
          <AlertCircle className={`w-5 h-5 ${isAlert ? 'text-red-500' : 'text-blue-500'}`} />
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        </div>
        
        <div className="p-6 text-sm text-slate-600 whitespace-pre-line">
          {message}
        </div>

        <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
          {!isAlert && onCancel && (
            <Button variant="outline" onClick={onCancel}>
              취소
            </Button>
          )}
          <Button 
            onClick={onConfirm} 
            className={`gap-2 ${isAlert ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
          >
            <Check className="w-4 h-4" />
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}
