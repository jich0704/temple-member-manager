import { X, Save, Clock, MessageSquare, AlertCircle, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from './button';

export interface AutoSmsRule {
  type: '1month' | '2weeks' | '1week';
  enabled: boolean;
  template: string;
}

export interface AutoSmsConfig {
  enabled: boolean;
  time: string; // "HH:MM"
  rules: AutoSmsRule[];
}

interface AutoSmsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AutoSmsSettingsModal({ isOpen, onClose }: AutoSmsSettingsModalProps) {
  const [config, setConfig] = useState<AutoSmsConfig>({
    enabled: false,
    time: '10:00',
    rules: [
      { type: '1month', enabled: false, template: '[만료 1개월 전 안내]\n{대주}님, 사찰회원 만료가 한 달 남았습니다.' },
      { type: '2weeks', enabled: false, template: '[만료 2주 전 안내]\n{대주}님, 사찰회원 만료가 2주 남았습니다.' },
      { type: '1week', enabled: false, template: '[만료 1주 전 안내]\n{대주}님, 사찰회원 만료가 1주 남았습니다.' }
    ]
  });

  const [isSaving, setIsSaving] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (window.api && window.api.getAutoSmsConfig) {
        window.api.getAutoSmsConfig().then(data => {
          if (data) setConfig(data);
        });
      }
      if (window.api && window.api.loadMembers) {
        window.api.loadMembers().then(members => {
          if (members && members.length > 0) {
            // 회원 데이터의 첫 번째 객체에서 키 추출 (불필요한 내부 속성 제외)
            const keys = Object.keys(members[0]).filter(k => k !== 'index' && k !== 'status' && k !== 'name' && k !== 'phone');
            setAvailableKeys(keys);
          }
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    if (window.api && window.api.saveAutoSmsConfig) {
      await window.api.saveAutoSmsConfig(config);
    }
    setIsSaving(false);
    onClose();
  };

  const updateRule = (index: number, updates: Partial<AutoSmsRule>) => {
    const newRules = [...config.rules];
    newRules[index] = { ...newRules[index], ...updates };
    setConfig({ ...config, rules: newRules });
  };

  const getLabel = (type: string) => {
    switch (type) {
      case '1month': return '1개월 전 (약 30일)';
      case '2weeks': return '2주 전 (약 14일)';
      case '1week': return '1주 전 (약 7일)';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">문자 자동 발송 설정</h2>
              <p className="text-sm text-slate-500">매일 지정된 시간에 조건에 맞는 회원에게 문자를 자동 전송합니다.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200">
            <X className="w-5 h-5 text-slate-500" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/30">
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 leading-relaxed">
              <strong>주의사항:</strong> 이 프로그램이 실행되어 있을 때만 자동 발송이 작동합니다.<br/>
              지정된 시간에 프로그램이 꺼져 있었다면, <strong>당일 프로그램 실행 시 즉시 밀린 문자가 발송</strong>됩니다.
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800">자동 발송 활성화</h3>
              <p className="text-sm text-slate-500">이 기능을 켜면 매일 정해진 시간에 문자가 자동으로 나갑니다.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={config.enabled}
                onChange={(e) => setConfig({...config, enabled: e.target.checked})}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {config.enabled && (
            <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
              
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" /> 발송 시간 설정
                </h3>
                <input 
                  type="time" 
                  value={config.time}
                  onChange={(e) => setConfig({...config, time: e.target.value})}
                  className="px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <span className="ml-3 text-sm text-slate-500">해당 시간에 매일 한 번 체크하여 발송합니다.</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-400" /> 조건별 발송 메시지 설정
                  </h3>
                  <button 
                    onClick={() => setShowKeys(!showKeys)} 
                    className={`p-1 rounded-full transition-colors ${showKeys ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                    title="치환 가능한 변수 보기"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>

                {showKeys && (
                  <div className="text-sm text-slate-600 bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-3 leading-relaxed animate-in slide-in-from-top-2 duration-200">
                    <div className="font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                      <Info className="w-4 h-4" /> 사용 가능한 치환 변수 목록
                    </div>
                    <div className="mb-2">
                      {availableKeys.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {availableKeys.map(k => (
                            <code key={k} className="bg-white px-2 py-1 rounded-md text-xs font-mono text-indigo-700 border border-blue-200 shadow-sm cursor-pointer hover:bg-indigo-50" onClick={() => {
                              // Optional: 클릭하면 클립보드 복사 등 추가 가능
                            }}>
                              {`{${k}}`}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">엑셀 회원 데이터를 먼저 업로드하시면 사용 가능한 항목이 여기에 표시됩니다.</span>
                      )}
                    </div>
                    <div className="text-xs text-blue-700">
                      위 변수들을 메시지 내용에 입력하면, 문자가 발송될 때 각 회원의 실제 정보로 자동 변환되어 발송됩니다.
                    </div>
                  </div>
                )}
                
                {config.rules.map((rule, idx) => (
                  <div key={rule.type} className={`p-4 border rounded-xl transition-all ${rule.enabled ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-slate-700">{getLabel(rule.type)}</div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={rule.enabled}
                          onChange={(e) => updateRule(idx, { enabled: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    
                    {rule.enabled && (
                      <textarea
                        value={rule.template}
                        onChange={(e) => updateRule(idx, { template: e.target.value })}
                        rows={3}
                        className="w-full text-sm p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                        placeholder="전송할 메시지 내용을 입력하세요..."
                      />
                    )}
                  </div>
                ))}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 w-24">
            {isSaving ? '저장 중...' : <><Save className="w-4 h-4 mr-1.5" /> 저장</>}
          </Button>
        </div>

      </div>
    </div>
  );
}
