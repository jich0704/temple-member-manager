import { AlertTriangle, CheckCircle2, Database, FolderOpen, RefreshCcw, X, Loader2, Trash2, Eye, EyeOff, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './button';
import { Input } from './input';

interface MdbSyncConfig {
  filePath?: string;
  password?: string;
  enabled?: boolean;
  pollIntervalSeconds?: number;
  updateScanIntervalSeconds?: number;
  hasPassword?: boolean;
}

interface MdbSyncStatus {
  state: 'idle' | 'syncing' | 'error';
  message: string;
  syncedAt?: string;
  rowCount?: number;
  elapsedMs?: number;
  error?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSynced: () => void;
  hasMembers: boolean;
}

const defaultStatus: MdbSyncStatus = {
  state: 'idle',
  message: 'MDB 동기화 대기 중',
};

export const MdbSyncModal = ({ isOpen, onClose, onSynced, hasMembers }: Props) => {
  const [config, setConfig] = useState<MdbSyncConfig>({
    filePath: '',
    password: '',
    enabled: false,
    pollIntervalSeconds: 10,
    updateScanIntervalSeconds: 300,
  });
  const [status, setStatus] = useState<MdbSyncStatus>(defaultStatus);
  const [isBusy, setIsBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [showSyncInfo, setShowSyncInfo] = useState(false);
  const hasMdbApi = Boolean(window.api?.getMdbConfig);

  useEffect(() => {
    if (!isOpen) return;
    if (!hasMdbApi) {
      setStatus({
        state: 'error',
        message: 'MDB 연동은 데스크탑 앱 실행 환경에서 사용할 수 있습니다.',
      });
      return;
    }

    let unsubscribe: (() => void) | undefined;
    const load = async () => {
      const saved = await window.api.getMdbConfig();
      setConfig({
        ...saved,
        password: '',
        pollIntervalSeconds: saved.pollIntervalSeconds || 10,
        updateScanIntervalSeconds: saved.updateScanIntervalSeconds || 300,
      });
      const currentStatus = await window.api.getMdbSyncStatus();
      if (currentStatus && currentStatus.state === 'error') {
        setStatus({ ...currentStatus, state: 'idle', message: '', error: '' });
      } else {
        setStatus(currentStatus || defaultStatus);
      }
      unsubscribe = window.api.onMdbSyncStatus((nextStatus) => {
        setStatus(nextStatus);
        if (nextStatus.state === 'idle' && nextStatus.rowCount !== undefined) {
          onSynced();
        }
      });
    };

    load();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [hasMdbApi, isOpen, onSynced]);

  if (!isOpen) return null;

  const handleSelectFile = async () => {
    if (!hasMdbApi) return;
    const selected = await window.api.selectMdbFile();
    if (!selected) return;
    setConfig((prev) => ({ ...prev, ...selected, password: prev.password || '' }));
  };

  const handleSave = async () => {
    if (!hasMdbApi) return;
    setIsBusy(true);
    try {
      const saved = await window.api.saveMdbConfig(config);
      setConfig((prev) => ({ ...prev, ...saved }));
      setMessage('설정을 저장했습니다.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleInitialSync = async () => {
    if (!hasMdbApi) return;
    setIsBusy(true);
    setMessage('');
    try {
      const saved = await window.api.saveMdbConfig(config);
      setConfig((prev) => ({ ...prev, ...saved }));
      const result = await window.api.syncMdbNow(config);
      if (result.ok) {
        setMessage(`동기화 완료: ${result.rowCount?.toLocaleString() || 0}건`);
        await onSynced();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleClearData = async () => {
    if (!hasMdbApi || !window.api.clearMdbData) return;
    if (!confirm('정말 MDB 동기화 데이터를 모두 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) return;
    
    setIsBusy(true);
    try {
      const result = await window.api.clearMdbData();
      if (result.ok) {
        setMessage('데이터가 초기화되었습니다.');
        setConfig((prev) => ({ ...prev, filePath: '', password: '', hasPassword: false, enabled: false }));
        await window.api.saveMdbConfig({ filePath: '', password: '', enabled: false });
        await onSynced();
      } else {
        setMessage(result.error || '데이터 초기화에 실패했습니다.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const statusTone = status.state === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : status.state === 'syncing'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const isInitialSetup = !hasMembers || !config.filePath;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800">
              {isInitialSetup ? 'MDB 초기 연동 설정' : 'MDB 실시간 스케줄러 설정'}
            </h2>
            {!isInitialSetup && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSyncInfo(v => !v)}
                  className="w-5 h-5 rounded-full bg-slate-300 hover:bg-blue-100 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
                {showSyncInfo && (
                  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[400] w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-blue-500" />
                        자동 동기화 안내
                      </span>
                      <button onClick={() => setShowSyncInfo(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="font-semibold text-blue-700 mb-1 text-xs">☑️ MDB 변경 자동 감지</div>
                        <div className="text-slate-600 text-xs leading-relaxed">체크하면 MDB 파일을 주기적으로 확인하여 변경된 데이터를 자동 반영합니다.</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="font-semibold text-slate-700 mb-1 text-xs">⏱️ 감지 주기(초)</div>
                        <div className="text-slate-600 text-xs leading-relaxed"><strong>신규 항목</strong> 추가 감지 주기. 작을수록 빠르게 감지 (3초 이상 권장)</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="font-semibold text-slate-700 mb-1 text-xs">🔄 수정 보정 주기(초)</div>
                        <div className="text-slate-600 text-xs leading-relaxed"><strong>기존 항목 수정</strong>(납부월 변경 등) 감지 주기. 길게 설정일수록 성능에 유리 (30초 이상 권장)</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-5">
          {/* 상태 알림창 */}
          {status.state !== 'idle' && (
            <div className={`border rounded-lg px-4 py-3 flex items-start gap-3 ${statusTone}`}>
              {status.state === 'error' ? <AlertTriangle className="w-5 h-5 mt-0.5" /> : <Loader2 className="w-5 h-5 mt-0.5 animate-spin" />}
              <div className="text-sm">
                <div className="font-semibold">{status.message}</div>
              </div>
            </div>
          )}

          {isBusy && isInitialSetup ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 text-slate-800 animate-spin" />
              <div className="text-lg font-bold text-slate-700">{status.message || 'MDB 전체 데이터 동기화 중...'}</div>
              <div className="text-sm text-slate-500">데이터 양에 따라 시간이 다소 소요될 수 있습니다.</div>
            </div>
          ) : (
            <>
              {/* 파일 선택 영역 (공통) */}
              <div className="space-y-4 border-b pb-6 border-slate-100">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">MDB 파일 위치</label>
                  <div className="flex gap-2">
                    <Input value={config.filePath || ''} readOnly placeholder="각 PC에서 사용하는 MDB 파일을 선택해 주세요." />
                    <Button type="button" variant="outline" className="gap-2 shrink-0" onClick={handleSelectFile} disabled={!hasMdbApi || (!isInitialSetup && isBusy)}>
                      <FolderOpen className="w-4 h-4" />
                      선택
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">MDB 비밀번호</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={config.password || ''}
                      placeholder={config.hasPassword ? '저장된 비밀번호 사용' : 'MDB 파일의 비밀번호 (없는 경우 비워둠)'}
                      onChange={(event) => setConfig((prev) => ({ ...prev, password: event.target.value }))}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 스케줄러 설정 영역 (초기화 후 화면에서만 보임) */}
              {!isInitialSetup && (
                <div className="space-y-4 pt-2">
                  <h3 className="font-semibold text-slate-800">자동 동기화 설정</h3>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_180px] gap-4 items-end">
                    <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(config.enabled)}
                        onChange={(event) => setConfig((prev) => ({ ...prev, enabled: event.target.checked }))}
                        className="h-4 w-4"
                      />
                      <span className="font-medium">MDB 변경 자동 감지</span>
                    </label>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">감지 주기(초)</label>
                      <Input
                        type="number"
                        min={3}
                        value={config.pollIntervalSeconds || 10}
                        onChange={(event) => setConfig((prev) => ({ ...prev, pollIntervalSeconds: Number(event.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">수정 보정 주기(초)</label>
                      <Input
                        type="number"
                        min={30}
                        value={config.updateScanIntervalSeconds || 300}
                        onChange={(event) => setConfig((prev) => ({ ...prev, updateScanIntervalSeconds: Number(event.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
                  {message}
                </div>
              )}
            </>
          )}
        </div>

        {(!isBusy || !isInitialSetup) && (
          <div className="px-6 py-4 bg-slate-50 border-t flex flex-wrap justify-between items-center gap-2">
            {!isInitialSetup ? (
              <Button variant="ghost" onClick={handleClearData} disabled={isBusy || !hasMdbApi} className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2 font-medium">
                <Trash2 className="w-4 h-4" />
                데이터 초기화
              </Button>
            ) : <div />}
            
            <div className="flex gap-2">
              {!isInitialSetup ? (
                <Button className="bg-slate-900" onClick={handleSave} disabled={isBusy || !hasMdbApi}>
                  설정 저장
                </Button>
              ) : (
                <Button className="gap-2 bg-slate-900 font-medium" onClick={handleInitialSync} disabled={isBusy || !hasMdbApi || !config.filePath}>
                  <RefreshCcw className="w-4 h-4" />
                  초기 동기화 시작
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
