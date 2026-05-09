import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, XCircle, Trash2, Users, Image as ImageIcon } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import type { SmsHistoryItem } from '../../types/member';

interface SmsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmsHistoryModal({ isOpen, onClose }: SmsHistoryModalProps) {
  const [history, setHistory] = useState<SmsHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await window.api.getSmsHistory();
      setHistory(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (confirm('발송 이력을 모두 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
      await window.api.clearSmsHistory();
      setHistory([]);
    }
  };

  const getCostString = (result?: any) => {
    if (!result) return null;
    let cost = 0;
    if (result.groupInfo?.cost) {
      cost = Number(result.groupInfo.cost.balance || 0) + Number(result.groupInfo.cost.point || 0);
    } else if (result.cost) {
      cost = Number(result.cost.balance || 0) + Number(result.cost.point || 0);
    }
    return cost > 0 ? `${cost.toLocaleString()}원` : null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">문자 발송 이력</h2>
              <p className="text-sm text-gray-500">최근 발송한 내역을 확인합니다. (최대 100건 보관)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClear} className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200">
              <Trash2 className="w-4 h-4 mr-1" /> 전체 삭제
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200">
              <X className="w-5 h-5 text-slate-500" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {isLoading ? (
            <div className="flex justify-center py-10 text-slate-400">
              <span className="animate-pulse flex items-center gap-2"><Clock className="w-5 h-5 animate-spin" /> 불러오는 중...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock className="w-12 h-12 mb-3 text-slate-200" />
              <p>기록된 문자 발송 이력이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      {item.success ? (
                        <>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />성공</Badge>
                          {getCostString(item.result) && (
                            <Badge variant="outline" className="text-slate-600 border-slate-200 bg-white">
                              차감: {getCostString(item.result)}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200"><XCircle className="w-3 h-3 mr-1" />실패</Badge>
                      )}
                      <span className="text-sm font-medium text-slate-600">{new Date(item.date).toLocaleString('ko-KR')}</span>
                      {item.hasImage && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50"><ImageIcon className="w-3 h-3 mr-1" />MMS</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      <Users className="w-4 h-4 text-slate-500" />
                      수신자 {item.targets.length}명
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono mb-3 border border-slate-100 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                    {item.template}
                  </div>
                  
                  {item.imageBase64 && (
                    <div className="mb-3">
                      <img src={`data:image/jpeg;base64,${item.imageBase64}`} alt="첨부 이미지" className="h-32 w-auto object-contain rounded-lg border border-slate-200 shadow-sm" />
                    </div>
                  )}
                  
                  {!item.success && item.errorMsg && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 mb-3 flex items-start gap-2">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold block mb-0.5">오류 원인</span>
                        {item.errorMsg}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 max-h-24 overflow-y-auto mt-2 custom-scrollbar p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700 block mb-1">발송 대상자 목록:</span>
                    <div className="flex flex-wrap gap-1">
                      {item.targets.map((t, idx) => (
                        <span key={idx} className="bg-white px-2 py-0.5 rounded border border-slate-200">
                          {t.name}({t.phone})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
