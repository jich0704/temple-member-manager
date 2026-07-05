import { CalendarClock, Check, Clock, Database, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import type { Settings } from '../types/member';
import { AutoSmsSettingsModal } from './ui/autoSmsSettingsModal';
import { Button } from './ui/button';
import { ConfirmModal } from './ui/confirmModal';
import { MdbSyncModal } from './ui/mdbSyncModal';
import { MdbSyncLogsModal } from './ui/mdbSyncLogsModal';

interface Props {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  hasMembers: boolean;
  onOpenSolapiSetup: () => void;
  onOpenSmsHistory: () => void;
  solapiBalance?: number | null;
  onMdbSynced: () => void;
  locations?: string[];
}

const colorOptions = [
  { name: '파랑', value: 'from-blue-500 to-blue-600' },
  { name: '빨강', value: 'from-red-500 to-red-600' },
  { name: '초록', value: 'from-green-500 to-emerald-500' },
  { name: '노랑', value: 'from-amber-400 to-amber-500' },
  { name: '보라', value: 'from-purple-500 to-purple-600' },
  { name: '오렌지', value: 'from-orange-500 to-orange-600' },
  { name: '분홍', value: 'from-pink-500 to-pink-600' },
  { name: '그레이', value: 'from-slate-500 to-slate-600' },
];

const fontSizeOptions = [
  { label: '작게', value: 14 },
  { label: '보통', value: 16 },
  { label: '크게', value: 18 },
  { label: '아주크게', value: 20 },
];

const Header = ({ settings, onUpdateSettings, hasMembers, onOpenSolapiSetup, onOpenSmsHistory, solapiBalance, onMdbSynced, locations = [] }: Props) => {
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);
  const [isAutoSmsModalOpen, setIsAutoSmsModalOpen] = useState(false);
  const [isMdbModalOpen, setIsMdbModalOpen] = useState(false);
  const [isMdbLogsModalOpen, setIsMdbLogsModalOpen] = useState(false);

  const [editSettings, setEditSettings] = useState<Settings>(settings);
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; isAlert?: boolean; onConfirm: () => void } | null>(null);

  // 현재 설정값을 편집용 상태에 동기화
  useEffect(() => {
    setEditSettings(settings);
  }, [settings]);

  const handleSaveSettings = () => {
    onUpdateSettings(editSettings);
    setIsColorModalOpen(false);
    setIsFontModalOpen(false);
  };

  const openColorModal = () => {
    setEditSettings(settings);
    setIsColorModalOpen(true);
  };

  const openFontModal = () => {
    setEditSettings(settings);
    setIsFontModalOpen(true);
  };

  const handleCancelSettings = () => {
    setEditSettings(settings);
    setIsColorModalOpen(false);
    setIsFontModalOpen(false);
  };

  const menuFontStyle = {
    '--menu-font-size': `${settings.menuFontSize ?? 14}px`,
  } as CSSProperties;

  const editMenuFontStyle = {
    '--menu-font-size': `${editSettings.menuFontSize ?? 14}px`,
  } as CSSProperties;

  const renderFontSizeOptions = (key: 'memberListFontSize' | 'menuFontSize') => {
    const selectedValue = editSettings[key] ?? 14;
    return (
      <div className="grid grid-cols-4 gap-2">
        {fontSizeOptions.map((option) => {
          const isSelected = selectedValue === option.value;
          return (
            <button
              key={`${key}-${option.value}`}
              onClick={() => setEditSettings({ ...editSettings, [key]: option.value })}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm scale-[1.02]'
                  : 'border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-slate-50'
              }`}
            >
              <span className="font-bold" style={{ fontSize: option.value }}>
                가
              </span>
              <span className="text-xs font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="menu-font-scope relative" style={menuFontStyle}>
      {/* 우측 상단 솔라피 잔액 고정 표시 */}
      {solapiBalance !== undefined && solapiBalance !== null && (
        <div className="absolute -top-4 right-0 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 shadow-sm">
          <span className="text-sm font-extrabold text-blue-700 tracking-tight">문자 잔액: {solapiBalance.toLocaleString()}원</span>
        </div>
      )}

      {/* 헤더 메뉴바 영역 */}
      <div className="flex flex-wrap items-center justify-start w-full gap-4 pb-2 mb-2 border-b border-slate-100">
        
        {/* 데이터 관리 박스 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-500 px-1">데이터 관리</span>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors group"
              onClick={() => setIsMdbModalOpen(true)}
            >
              <Database className="w-3.5 h-3.5 text-slate-500 group-hover:scale-110 transition-transform" />
              <span>MDB 연동</span>
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors group"
              onClick={() => setIsMdbLogsModalOpen(true)}
            >
              <Clock className="w-3.5 h-3.5 text-slate-500 group-hover:scale-110 transition-transform" />
              <span>동기화 이력</span>
            </button>
          </div>
        </div>

        {/* 문자 관리 박스 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-500 px-1 flex items-center gap-2">
            문자 관리
          </span>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors group"
              onClick={() => setIsAutoSmsModalOpen(true)}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>자동 발송 설정</span>
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors group"
              onClick={onOpenSolapiSetup}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>문자 연동 설정</span>
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors group"
              onClick={onOpenSmsHistory}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>발송 이력</span>
            </button>
          </div>
        </div>

        {/* 시스템 설정 박스 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-500 px-1">시스템 설정</span>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors group"
              onClick={openColorModal}
            >
              <CalendarClock className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
              <span>색상 설정</span>
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors group"
              onClick={openFontModal}
            >
              <CalendarClock className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
              <span>폰트 설정</span>
            </button>
          </div>
        </div>

      </div>

      {isColorModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-blue-500" />
                상태 표시 색상 설정
              </h2>
              <button onClick={handleCancelSettings} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {[
                { key: 'safeColor', label: '사용중 (안전)', desc: '만료가 한 달 이상 남은 상태' },
                { key: 'warningColor', label: '1달 전 (주의)', desc: '만료가 1개월 이내로 남은 상태' },
                { key: 'criticalColor', label: '2주 전 (위험)', desc: '만료가 2주 이내로 임박한 상태' },
                { key: 'expiredColor', label: '종료 (만료)', desc: '이미 기간이 만료된 상태' }
              ].map((setting) => (
                <div key={setting.key} className="space-y-3">
                  <div>
                    <div className="font-semibold text-slate-800">{setting.label}</div>
                    <div className="text-xs text-slate-500">{setting.desc}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {colorOptions.map(color => (
                      <button
                        key={color.value}
                        onClick={() => setEditSettings({ ...editSettings, [setting.key]: color.value })}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                          (editSettings as any)[setting.key] === color.value 
                            ? 'border-blue-500 bg-blue-50 shadow-sm scale-[1.02]' 
                            : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${color.value} shadow-sm flex items-center justify-center`}>
                          {(editSettings as any)[setting.key] === color.value && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-[10px] font-semibold ${(editSettings as any)[setting.key] === color.value ? 'text-blue-700' : 'text-slate-600'}`}>
                          {color.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleCancelSettings}>
                취소
              </Button>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={handleSaveSettings}>
                저장하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {isFontModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-blue-500" />
                폰트 설정
              </h2>
              <button onClick={handleCancelSettings} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar" style={editMenuFontStyle}>
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-slate-800">리스트 폰트 크기</div>
                  <div className="text-xs text-slate-500">회원 리스트의 글자 크기를 조정합니다.</div>
                </div>
                {renderFontSizeOptions('memberListFontSize')}
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-6">
                <div>
                  <div className="font-semibold text-slate-800">메뉴 폰트 크기</div>
                  <div className="text-xs text-slate-500">상단 메뉴, 설정 모달, 카드 섹션의 글자 크기를 조정합니다.</div>
                </div>
                {renderFontSizeOptions('menuFontSize')}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleCancelSettings}>
                취소
              </Button>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={handleSaveSettings}>
                저장하기
              </Button>
            </div>
          </div>
        </div>
      )}

      <AutoSmsSettingsModal 
        isOpen={isAutoSmsModalOpen} 
        onClose={() => setIsAutoSmsModalOpen(false)}
        locations={locations.filter(l => l !== '전체')}
      />

      <MdbSyncModal
        isOpen={isMdbModalOpen}
        onClose={() => setIsMdbModalOpen(false)}
        onSynced={onMdbSynced}
        hasMembers={hasMembers}
      />
      <MdbSyncLogsModal
        isOpen={isMdbLogsModalOpen}
        onClose={() => setIsMdbLogsModalOpen(false)}
      />
      <ConfirmModal
        isOpen={modalState?.isOpen || false}
        title={modalState?.title || ''}
        message={modalState?.message || ''}
        onConfirm={modalState?.onConfirm || (() => {})}
        onCancel={() => setModalState(null)}
        isAlert={modalState?.isAlert}
      />
    </div>
  );
}


export default Header;
