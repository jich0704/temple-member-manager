import { CalendarClock, Check, Clock, Settings as SettingsIcon, ShieldCheck, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../types/member';
import { Button } from './ui/button';
import { ConfirmModal } from './ui/confirmModal';
import { Input } from './ui/input';
import { AutoSmsSettingsModal } from './ui/autoSmsSettingsModal';

interface Props {
  onUpload: (file: File, mode: 'append' | 'overwrite') => void;
  onExportExcel: () => void;
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  hasMembers: boolean;
  onOpenSolapiSetup: () => void;
  onOpenSmsHistory: () => void;
  solapiBalance?: number | null;
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

export default function Header({ onUpload, onExportExcel, settings, onUpdateSettings, hasMembers, onOpenSolapiSetup, onOpenSmsHistory, solapiBalance }: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoSmsModalOpen, setIsAutoSmsModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editSettings, setEditSettings] = useState<Settings>(settings);
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; isAlert?: boolean; onConfirm: () => void } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // 현재 설정값을 편집용 상태에 동기화
  useEffect(() => {
    setEditSettings(settings);
  }, [settings]);

  // 외부 클릭 시 팝오버 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBackupClick = () => {
    setIsSettingsOpen(false);
    if (!hasMembers) {
      setModalState({
        isOpen: true,
        title: '알림',
        message: '내보낼 데이터가 없습니다.',
        isAlert: true,
        onConfirm: () => setModalState(null)
      });
      return;
    }
    setModalState({
      isOpen: true,
      title: '회원 백업',
      message: '현재 회원목록을 엑셀 파일로 다운로드 하시겠습니까?',
      onConfirm: () => {
        onExportExcel();
        setModalState(null);
      }
    });
  };

  const handleSaveSettings = () => {
    onUpdateSettings(editSettings);
    setIsModalOpen(false);
  };

  return (
    <div className="relative flex items-center justify-between">
      {/* 제목 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">사찰 회원관리 시스템</h1>
      </div>



      {/* 설정 아이콘 및 팝오버 */}
      <div className="absolute -top-5 -right-1" ref={settingsRef}>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100/50 rounded-full h-12 w-12"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        >
          <SettingsIcon className={`w-8 h-8 transition-transform duration-500 ${isSettingsOpen ? 'rotate-90 text-slate-800' : ''}`} />
        </Button>

        {/* 솔라피 잔액 표시 */}
        {solapiBalance !== undefined && solapiBalance !== null && (
          <div className="absolute top-2 right-16 flex items-center justify-center bg-blue-50 border border-blue-100 rounded-full px-3 py-1 shadow-sm whitespace-nowrap">
            <span className="text-xs font-medium text-blue-700">문자발송 잔액: {solapiBalance.toLocaleString()}원</span>
          </div>
        )}

        {isSettingsOpen && (
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">시스템 설정</div>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors group"
              onClick={() => {
                setIsSettingsOpen(false);
                setIsModalOpen(true);
              }}
            >
              <CalendarClock className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
              <span>만료 알림 및 색상 설정</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors group"
              onClick={() => {
                setIsSettingsOpen(false);
                setIsAutoSmsModalOpen(true);
              }}
            >
              <Clock className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>자동 발송 설정</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors group border-t border-slate-50 mt-1"
              onClick={() => {
                setIsSettingsOpen(false);
                onOpenSolapiSetup();
              }}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>문자 연동 설정</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors group border-t border-slate-50 mt-1"
              onClick={() => {
                setIsSettingsOpen(false);
                onOpenSmsHistory();
              }}
            >
              <Clock className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>문자 발송 이력</span>
            </button>
            <label className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors group border-t border-slate-50 mt-1 cursor-pointer">
              <input
                type="file"
                accept=".xlsx"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPendingFile(file);
                  e.target.value = ''; 
                  setIsSettingsOpen(false);
                }}
              />
              <Upload className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>엑셀 업로드</span>
            </label>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors group border-t border-slate-50 mt-1"
              onClick={handleBackupClick}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span>회원 백업</span>
            </button>
          </div>
        )}
      </div>

      <AutoSmsSettingsModal 
        isOpen={isAutoSmsModalOpen} 
        onClose={() => setIsAutoSmsModalOpen(false)} 
      />

      {/* 설정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">만료 알림 및 색상 설정</h2>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setIsModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-8">
              {/* 경고 알림 (Warning) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">⚠️ 만료 예정 알림 (D-Day)</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-16 h-8 text-center"
                      value={editSettings.warningDays}
                      onChange={(e) => setEditSettings({ ...editSettings, warningDays: Number(e.target.value) })}
                    />
                    <span className="text-sm text-slate-500">일 전</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={`h-8 rounded-lg bg-gradient-to-r ${opt.value} border-2 transition-all ${
                        editSettings.warningColor === opt.value ? 'border-slate-800 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => setEditSettings({ ...editSettings, warningColor: opt.value })}
                      title={opt.name}
                    />
                  ))}
                </div>
              </div>

              {/* 위험 알림 (Critical) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">🚨 긴급 만료 알림 (D-Day)</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-16 h-8 text-center"
                      value={editSettings.criticalDays}
                      onChange={(e) => setEditSettings({ ...editSettings, criticalDays: Number(e.target.value) })}
                    />
                    <span className="text-sm text-slate-500">일 전</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={`h-8 rounded-lg bg-gradient-to-r ${opt.value} border-2 transition-all ${
                        editSettings.criticalColor === opt.value ? 'border-slate-800 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => setEditSettings({ ...editSettings, criticalColor: opt.value })}
                      title={opt.name}
                    />
                  ))}
                </div>
              </div>

              {/* 정상 (Safe) */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-slate-700 text-left block">✅ 정상 상태 색상</label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={`h-8 rounded-lg bg-gradient-to-r ${opt.value} border-2 transition-all ${
                        editSettings.safeColor === opt.value ? 'border-slate-800 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => setEditSettings({ ...editSettings, safeColor: opt.value })}
                      title={opt.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>취소</Button>
              <Button onClick={handleSaveSettings} className="gap-2 bg-slate-900 group">
                <Check className="w-4 h-4 group-hover:scale-110 transition-transform" />
                설정 저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 업로드 방식 선택 모달 */}
      {pendingFile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">엑셀 업로드 방식 선택</h2>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setPendingFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 text-sm text-slate-600">
              선택한 파일: <span className="font-semibold text-slate-800">{pendingFile.name}</span>
              <br /><br />
              이 파일의 데이터를 기존 목록에 <strong>이어서 누적</strong>하시겠습니까, 아니면 기존 데이터를 모두 <strong>초기화하고 새로 구성</strong>하시겠습니까?
            </div>
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" 
                onClick={() => { onUpload(pendingFile, 'overwrite'); setPendingFile(null); }}
              >
                초기화 후 새로 올리기
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => { onUpload(pendingFile, 'append'); setPendingFile(null); }}
              >
                기존 목록에 누적하기
              </Button>
            </div>
          </div>
        </div>
      )}

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
