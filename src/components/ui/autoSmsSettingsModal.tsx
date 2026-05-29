import { X, Save, Clock, MessageSquare, AlertCircle, Info, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from './button';

export interface AutoSmsRule {
  type: '1month' | '2weeks' | '1week';
  enabled: boolean;
  template: string;
}

export interface AutoSmsConfig {
  enabled: boolean;
  time: string;
  rules: AutoSmsRule[];
  // 위치별 활성화 여부 (key: 위치명, value: true=발송, false=제외)
  locationEnabled?: Record<string, boolean>;
}

interface AutoSmsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations?: string[];
}

const DEFAULT_CONFIG: AutoSmsConfig = {
  enabled: false,
  time: '10:00',
  rules: [
    { type: '1month', enabled: false, template: '[만료 1개월 전 안내]\n{대주}님, 인등 만료가 한 달 남았습니다.' },
    { type: '2weeks', enabled: false, template: '[만료 2주 전 안내]\n{대주}님, 인등 만료가 2주 남았습니다.' },
    { type: '1week',  enabled: false, template: '[만료 1주 전 안내]\n{대주}님, 인등 만료가 1주 남았습니다.' },
  ],
  locationEnabled: {},
};

const getLabel = (type: string) => {
  switch (type) {
    case '1month': return '1개월 전 (약 30일)';
    case '2weeks': return '2주 전 (약 14일)';
    case '1week':  return '1주 전 (약 7일)';
    default: return '';
  }
};

export const AutoSmsSettingsModal = ({ isOpen, onClose, locations = [] }: AutoSmsSettingsModalProps) => {
  const [config, setConfig] = useState<AutoSmsConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'location'>('global');

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setActiveTab('global');
    if (window.api?.getAutoSmsConfig) {
      window.api.getAutoSmsConfig().then(data => {
        if (data) setConfig({ ...DEFAULT_CONFIG, ...data, locationEnabled: data.locationEnabled || {} });
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    if (window.api?.saveAutoSmsConfig) {
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

  const toggleLocation = (loc: string, val: boolean) => {
    setConfig(prev => ({
      ...prev,
      locationEnabled: { ...(prev.locationEnabled || {}), [loc]: val },
    }));
  };

  // 기본값: 설정 없는 위치는 false(미발송)
  const isLocEnabled = (loc: string) =>
    config.locationEnabled?.[loc] === true;

  const MACRO_KEYS = ['{대주}', '{위치명}', '{신도번호}', '{휴대폰}', '{최종납부월}', '{생일}'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

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

        {/* 탭 */}
        <div className="flex border-b border-slate-100 bg-white shrink-0 px-4">
          {([['global', '발송 설정'], ['location', '위치별 설정']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar bg-slate-50/30">

            {/* ── 발송 설정 탭 ── */}
            {activeTab === 'global' && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 leading-relaxed">
                    <strong>주의사항:</strong> 이 프로그램이 실행되어 있을 때만 자동 발송이 작동합니다.<br/>
                    지정된 시간에 프로그램이 꺼져 있었다면, <strong>당일 프로그램 실행 시 즉시 밀린 문자가 발송</strong>됩니다.
                  </div>
                </div>

                {/* 자동 발송 활성화 토글 */}
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
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {config.enabled && (
                  <div className="space-y-5 animate-in slide-in-from-top-4 duration-300">
                    {/* 발송 시간 */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" /> 발송 시간 설정
                      </h3>
                      <input
                        type="time"
                        value={config.time}
                        onChange={(e) => setConfig({ ...config, time: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                      <span className="ml-3 text-sm text-slate-500">해당 시간에 매일 한 번 체크하여 발송합니다.</span>
                    </div>

                    {/* 조건별 메시지 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-slate-400" /> 조건별 발송 메시지
                        </h3>
                        <button
                          onClick={() => setShowKeys(!showKeys)}
                          className={`p-1 rounded-full transition-colors ${showKeys ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-200'}`}
                          title="치환 변수 보기"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>

                      {showKeys && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="font-bold text-blue-800 mb-2 text-sm flex items-center gap-1.5">
                            <Info className="w-4 h-4" /> 사용 가능한 치환 변수
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {MACRO_KEYS.map(k => (
                              <code key={k} className="bg-white px-2 py-1 rounded-md text-xs font-mono text-indigo-700 border border-blue-200 shadow-sm">{k}</code>
                            ))}
                          </div>
                          <p className="text-xs text-blue-700 mt-2">변수를 메시지에 입력하면 발송 시 각 회원 정보로 자동 변환됩니다.</p>
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
              </>
            )}

            {/* ── 위치별 설정 탭 ── */}
            {activeTab === 'location' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 px-1">위치명별로 자동 발송 대상을 설정합니다. 기본값은 <strong>미발송</strong>이며, 발송할 위치만 직접 켜주세요.</p>
                {locations.length === 0 ? (
                  <div className="text-center text-slate-400 py-10">위치 정보가 없습니다.</div>
                ) : (
                  locations.map(loc => (
                    <div key={loc} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div>
                        <span className="font-semibold text-slate-800">{loc}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${isLocEnabled(loc) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {isLocEnabled(loc) ? '발송 포함' : '발송 제외'}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isLocEnabled(loc)}
                          onChange={(e) => toggleLocation(loc, e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isSaving || isLoading}>취소</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="bg-indigo-600 hover:bg-indigo-700 w-24">
            {isSaving
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> 저장 중</>
              : <><Save className="w-4 h-4 mr-1.5" /> 저장</>
            }
          </Button>
        </div>

      </div>
    </div>
  );
};
