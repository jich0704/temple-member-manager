import { useState, useEffect, useMemo } from 'react';
import { X, Clock, CheckCircle2, XCircle, Trash2, Users, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import type { SmsHistoryItem } from '../../types/member';

interface SmsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterTab = 'all' | 'success' | 'fail';

const ITEMS_PER_PAGE = 10;

export const SmsHistoryModal = ({ isOpen, onClose }: SmsHistoryModalProps) => {
  const [history, setHistory] = useState<SmsHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setActiveTab('all');
      setPage(1);
      setExpandedIds(new Set());
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
      setPage(1);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const filteredHistory = useMemo(() => {
    if (activeTab === 'success') return history.filter((item) => item.success);
    if (activeTab === 'fail') return history.filter((item) => !item.success);
    return history;
  }, [history, activeTab]);

  const totalCount = filteredHistory.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, page]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">문자 발송 이력</h2>
              <p className="text-xs text-gray-500">최근 발송한 내역을 확인합니다. (최대 100건 보관)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 mr-1">총 {totalCount}건</span>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={isLoading}>
              새로고침
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isLoading || history.length === 0}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-1" /> 전체 삭제
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200">
              <X className="w-5 h-5 text-slate-500" />
            </Button>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="flex border-b border-slate-100 bg-white shrink-0 px-6">
          {[
            { key: 'all' as FilterTab, label: '전체' },
            { key: 'success' as FilterTab, label: '성공' },
            { key: 'fail' as FilterTab, label: '실패' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 리스트 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-10 text-slate-400">
              <span className="animate-pulse flex items-center gap-2"><Clock className="w-5 h-5 animate-spin" /> 불러오는 중...</span>
            </div>
          ) : paginatedHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock className="w-12 h-12 mb-3 text-slate-200" />
              <p>기록된 문자 발송 이력이 없습니다.</p>
            </div>
          ) : (
            paginatedHistory.map((item) => {
              const isExpanded = expandedIds.has(item.id);
              const singleLinePreview = (item.template || '').replace(/\s+/g, ' ').trim();
              return (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      {item.success ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />성공
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                          <XCircle className="w-3 h-3 mr-1" />실패
                        </Badge>
                      )}
                      {item.hasImage && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                          <ImageIcon className="w-3 h-3 mr-1" />MMS
                        </Badge>
                      )}
                      {item.success && getCostString(item.result) && (
                        <Badge variant="outline" className="text-slate-600 border-slate-200 bg-white">
                          차감: {getCostString(item.result)}
                        </Badge>
                      )}
                    </div>

                    <span className="text-sm text-slate-700 truncate flex-1 min-w-0">
                      {singleLinePreview || '(내용 없음)'}
                    </span>

                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        수신자 {item.targets?.length || 0}명
                      </span>
                      <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                        {new Date(item.date).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/70 space-y-3">
                      <div className="bg-white rounded-lg p-3.5 text-sm text-slate-700 whitespace-pre-wrap font-mono border border-slate-200 leading-relaxed max-h-44 overflow-y-auto custom-scrollbar">
                        {item.template}
                      </div>

                      {item.imageBase64 && (
                        <div>
                          <img
                            src={`data:image/jpeg;base64,${item.imageBase64}`}
                            alt="첨부 이미지"
                            className="h-32 w-auto object-contain rounded-lg border border-slate-200 shadow-sm bg-white"
                          />
                        </div>
                      )}

                      {!item.success && item.errorMsg && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-2">
                          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold block mb-0.5">오류 원인</span>
                            {item.errorMsg}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-slate-500 max-h-28 overflow-y-auto custom-scrollbar p-3 bg-white rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700 block mb-1.5">
                          발송 대상자 목록 ({item.targets?.length || 0}명):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {item.targets?.map((t, idx) => (
                            <span key={idx} className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                              {t.name}({t.phone || '번호없음'})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 페이지네이션 */}
        {totalCount > 0 && (
          <div className="px-6 py-3 border-t bg-white flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              총 <span className="font-semibold text-slate-700">{totalCount}</span>건 중 {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, totalCount)} 표시
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                } else if (p === page - 2 || p === page + 2) {
                  return (
                    <span key={p} className="px-1 text-slate-400">
                      ...
                    </span>
                  );
                }
                return null;
              })}
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

