import { useState, useEffect } from 'react';
import { Button } from './button';
import { RefreshCcw, FileText, ChevronLeft, ChevronRight, ArrowRight, X, ChevronDown, ChevronUp } from 'lucide-react';

interface SyncLog {
  id: number;
  timestamp: string;
  type: 'new' | 'update' | 'delete';
  source_key: string;
  name: string;
  details: any;
}

type TabType = 'all' | 'new' | 'update' | 'delete';

// 날짜 포맷 (로컬 시간 기준)
const formatTime = (raw: string) => {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch { return raw; }
};

// 값 포맷 (mdbUpdatedAt 같은 긴 날짜 문자열 정리)
const formatValue = (v: any): string => {
  if (v === null || v === undefined) return '-';
  const s = String(v);
  // ISO 날짜 형식이면 포맷
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(s)) {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toLocaleString('ko-KR', { hour12: false });
    } catch { /* ignore */ }
  }
  return s;
};

// source_key에서 'mdb:receive-member:' 같은 prefix 제거
const formatSourceKey = (raw: string) => {
  if (!raw) return '-';
  // 콜론이 있으면 마지막 부분만
  const parts = raw.split(':');
  return parts[parts.length - 1];
};

// 테이블에서 보여지는 주요 컬럼 목록 (신규 이력 펼침 시 사용)
const NEW_VISIBLE_KEYS = [
  '이름', '휴대폰', '위치명', '신도번호', '대주', '동참자',
  '영가여부', '생일', 'DM', '가족순서', '최종납부월', '등록일', '성별', '법명',
];

const TypeBadge = ({ type }: { type: SyncLog['type'] }) => {
  if (type === 'new') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
      신규 등록
    </span>
  );
  if (type === 'update') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
      정보 수정
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
      삭제 감지
    </span>
  );
};

const LogRow = ({ log }: { log: SyncLog }) => {
  const [expanded, setExpanded] = useState(false);
  const details = log.details || {};
  const allDetailEntries = Object.entries(details).filter(([k]) =>
    !['source', 'sourceKey', 'mdbReceiveMemberId', 'index'].includes(k)
  );
  // 신규: 테이블에서 보이는 컬럼만, 수정: 전체
  const detailEntries = log.type === 'new'
    ? allDetailEntries.filter(([k]) => NEW_VISIBLE_KEYS.includes(k))
    : allDetailEntries;
  const displayKey = formatSourceKey(log.source_key);

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* 한줄 요약 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <TypeBadge type={log.type} />
        <span className="font-semibold text-slate-800 min-w-[80px]">{log.name || '이름없음'}</span>
        <span className="text-xs text-slate-400 truncate">신도번호: {displayKey}</span>
        {log.type === 'update' && (
          <span className="text-xs text-slate-400 truncate">
            변경항목 {detailEntries.length}개
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400 whitespace-nowrap font-mono shrink-0">
          {formatTime(log.timestamp)}
        </span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        }
      </button>

      {/* 상세 펼침 */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
          {log.type === 'new' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
              {detailEntries.map(([k, v]) => (
                <div key={k} className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide truncate">{k}</span>
                  <span className="text-xs text-slate-700 truncate" title={formatValue(v)}>{formatValue(v)}</span>
                </div>
              ))}
            </div>
          )}
          {log.type === 'update' && (
            <div className="space-y-1.5">
              {detailEntries.map(([k, changes]: [string, any]) => (
                <div key={k} className="flex items-center gap-2 text-xs min-w-0">
                  <span className="font-semibold text-slate-500 w-28 shrink-0 truncate text-right" title={k}>{k}:</span>
                  <span className="text-red-400 line-through truncate max-w-[160px]" title={formatValue(changes?.old)}>
                    {formatValue(changes?.old)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-emerald-600 font-semibold truncate max-w-[160px]" title={formatValue(changes?.new)}>
                    {formatValue(changes?.new)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {log.type === 'delete' && (
            <p className="text-xs text-red-500">해당 회원이 MDB에서 삭제된 것으로 감지되어 동기화에서 제외되었습니다.</p>
          )}
        </div>
      )}
    </div>
  );
};

const TABS: { key: TabType; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'new', label: '신규' },
  { key: 'update', label: '수정' },
  { key: 'delete', label: '삭제' },
];

export const MdbSyncLogsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const fetchLogs = async (pageNum: number, tab: TabType = activeTab) => {
    if (!window.api?.getMdbSyncLogs) return;
    setLoading(true);
    try {
      const res = await window.api.getMdbSyncLogs({
        page: pageNum,
        limit: 20,
        type: tab === 'all' ? undefined : tab,
      });
      setLogs(res.logs);
      setTotalPages(res.totalPages);
      setTotalCount(res.totalCount);
      setPage(res.currentPage);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab('all');   // 열릴 때 항상 전체 탭으로 초기화
      fetchLogs(1, 'all');
    }
  }, [isOpen]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    fetchLogs(1, tab);
  };

  const clearLogs = async () => {
    if (!window.confirm('모든 동기화 이력을 삭제하시겠습니까?')) return;
    if (window.api?.clearMdbSyncLogs) {
      await window.api.clearMdbSyncLogs();
      fetchLogs(1, activeTab);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-blue-600" />
            MDB 동기화 이력
            <span className="text-sm font-normal text-slate-400">(최근 30일)</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">총 {totalCount}건</span>
            <Button variant="outline" size="sm" onClick={() => fetchLogs(page, activeTab)} disabled={loading}>
              새로고침
            </Button>
            <Button variant="destructive" size="sm" onClick={clearLogs} disabled={loading || totalCount === 0}>
              이력 비우기
            </Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-1 p-1 rounded-full hover:bg-slate-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-slate-100 bg-white shrink-0 px-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-slate-50">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-48 text-slate-400">
              <FileText className="w-12 h-12 mb-2 opacity-20" />
              <p>해당 이력이 없습니다.</p>
            </div>
          ) : (
            logs.map(log => <LogRow key={log.id} log={log} />)
          )}
        </div>

        {/* 페이징 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 px-6 py-3 border-t bg-white shrink-0">
            <Button variant="outline" size="sm" onClick={() => fetchLogs(page - 1)} disabled={page <= 1 || loading}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = page <= 4 ? i + 1 : page - 3 + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => fetchLogs(p)}
                  className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                    p === page
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => fetchLogs(page + 1)} disabled={page >= totalPages || loading}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
