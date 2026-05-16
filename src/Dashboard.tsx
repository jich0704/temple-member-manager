import { useState, useMemo, useEffect } from 'react';
import Header from './components/header';
import MemberTable from './components/memberTable';
import { ConfirmModal } from './components/ui/confirmModal';
import { SolapiSetupModal } from './components/ui/solapiSetupModal';
import { SmsSendModal } from './components/ui/smsSendModal';
import { SmsHistoryModal } from './components/ui/smsHistoryModal';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';
import type { Member } from './types/member';

// 필터 타입 정의
type FilterType = '전체' | '사용중' | '한달전' | '2주전' | '종료';

const Dashboard = () => {
  const [activeLocation, setActiveLocation] = useState<string>('전체');
  const { members, locationStats, handleUpload, handleDeleteMembers, handleExportExcel, settings, handleUpdateSettings } = useMembers(activeLocation);
  const { sendSMS, checkSolapiBalance, isSending } = useSMS();
  const [activeFilter, setActiveFilter] = useState<FilterType>('전체');
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; isAlert: boolean; onConfirm: () => void } | null>(null);
  const [solapiBalance, setSolapiBalance] = useState<number | null>(null);

  useEffect(() => {
    if (settings.solapiApiKey && settings.solapiApiSecret) {
      checkSolapiBalance(settings.solapiApiKey, settings.solapiApiSecret)
        .then(res => {
          if (res.success && res.balance !== undefined) {
            let bal = 0;
            let point = 0;
            const data = res.balance;
            if (typeof data === 'object' && data !== null) {
              bal = Number(data.balance || 0);
              point = Number(data.point || 0);
            } else {
              bal = Number(data || 0);
            }
            setSolapiBalance(bal + point);
          } else {
            setSolapiBalance(null);
          }
        })
        .catch(() => setSolapiBalance(null));
    } else {
      setSolapiBalance(null);
    }
  }, [settings.solapiApiKey, settings.solapiApiSecret]);

  // SMS 관련 상태
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [smsTargets, setSmsTargets] = useState<Member[]>([]);

  // 단체 발송 로직은 삭제됨 (Header 버튼 제거)

  // 선택 발송 (멤버테이블)
  const handleSendSelected = (targets: Member[]) => {
    if (targets.length === 0) return;
    openSmsFlow(targets);
  };

  const openSmsFlow = (targets: Member[]) => {
    if (!settings.solapiApiKey || !settings.solapiApiSecret || !settings.solapiSenderNumber) {
      setIsSetupModalOpen(true);
      return;
    }
    setSmsTargets(targets);
    setIsSendModalOpen(true);
  };

  const handleExecuteSend = async (message: string, imageBase64?: string) => {
    const result = await sendSMS({
      targets: smsTargets,
      messageTemplate: message,
      apiKey: settings.solapiApiKey!,
      apiSecret: settings.solapiApiSecret!,
      senderNumber: settings.solapiSenderNumber!,
      imagePath: imageBase64
    });
    
    if (result.success) {
      setIsSendModalOpen(false);
      setModalState({
        isOpen: true,
        title: '발송 완료',
        message: '성공적으로 문자를 발송했습니다.',
        isAlert: true,
        onConfirm: () => setModalState(null),
      });
    } else {
      let errorMsg = result.error || '';
      if (errorMsg.includes('존재하지 않습니다') || errorMsg.includes('유효한 수신자')) {
        errorMsg += '\n\n💡 팁: 솔라피 홈페이지에 [발신번호]가 등록되어 있지 않거나, 수신자의 휴대폰 번호가 올바르지 않으면 발송이 거부됩니다. 솔라피 사이트에서 발신번호 인증을 꼭 완료해 주세요.';
      }
      
      setModalState({
        isOpen: true,
        title: '발송 실패',
        message: `문자 발송 중 오류가 발생했습니다.\n${errorMsg}`,
        isAlert: true,
        onConfirm: () => setModalState(null),
      });
    }
  };

  // 위치 목록 추출 (members가 변경될 때만 계산)
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    members.forEach(m => {
      const loc = String(m['위치명'] || '미지정').trim();
      locSet.add(loc);
    });
    return ['전체', ...Array.from(locSet).sort()];
  }, [members]);

  // '전체' 카드 제거에 따른 기본 위치 자동 설정
  useEffect(() => {
    if (activeLocation === '전체') {
      const availableLocs = locations.filter(l => l !== '전체');
      if (availableLocs.length > 0) {
        setActiveLocation(availableLocs[0]);
      }
    }
  }, [locations, activeLocation]);

  // 필터링 로직
  const filteredMembers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return members.filter((m) => {
      // 1. 위치 필터
      if (activeLocation !== '전체') {
        const loc = String(m['위치명'] || '미지정').trim();
        if (loc !== activeLocation) return false;
      }

      // 2. 상태 필터
      if (activeFilter === '전체') return true;

      const lastPaymentMonth = m['최종납부월'];
      let targetDate: Date | null = null;
      
      if (lastPaymentMonth) {
        const [yearStr, monthStr] = String(lastPaymentMonth).split('-');
        if (yearStr && monthStr) {
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);
          targetDate = new Date(year, month, 0);
          targetDate.setHours(23, 59, 59, 999);
        }
      }

      if (!targetDate) return false;

      const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (activeFilter === '사용중') {
        return !targetDate || diffDays >= 0;
      }
      if (activeFilter === '종료') {
        return diffDays < 0;
      }
      if (activeFilter === '2주전') {
        return diffDays >= 0 && diffDays <= settings.criticalDays;
      }
      if (activeFilter === '한달전') {
        return diffDays > settings.criticalDays && diffDays <= settings.warningDays;
      }
      return true;
    });
  }, [members, activeFilter, activeLocation, settings.warningDays, settings.criticalDays]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="flex flex-col h-screen">
        {/* 상단 헤더 영역 */}
        <div className="px-10 pt-8 pb-4">
          <Header
            onUpload={handleUpload}
            onExportExcel={handleExportExcel}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            hasMembers={members.length > 0}
            onOpenSolapiSetup={() => setIsSetupModalOpen(true)}
            onOpenSmsHistory={() => setIsHistoryModalOpen(true)}
            solapiBalance={solapiBalance}
          />
        </div>

        {/* 종합 관제탑 Grid UI (컴팩트 버전) */}
        <div className="px-10 mb-4 pb-2 max-h-[30vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {locations.filter(l => l !== '전체').map(loc => {
              const stat = locationStats[loc] || { total: 0, active: 0, twoWeeks: 0, oneMonth: 0, expired: 0 };
              const isSelected = activeLocation === loc;

              const getBadgeClass = (filter: string) => {
                const base = "flex gap-1 items-center px-1.5 py-0.5 rounded transition-colors";
                if (isSelected) {
                  if (activeFilter === filter) return `${base} bg-white/25 text-white font-bold shadow-sm`;
                  return `${base} bg-slate-700/80 text-slate-200 hover:bg-slate-600 hover:text-white`;
                }
                
                if (filter === '전체') return `${base} bg-slate-50 text-slate-600 hover:bg-slate-100`;
                if (filter === '사용중') return `${base} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`;
                if (filter === '한달전') return `${base} bg-amber-50 text-amber-700 hover:bg-amber-100`;
                if (filter === '2주전') return `${base} bg-orange-50 text-orange-700 hover:bg-orange-100`;
                if (filter === '종료') return `${base} bg-red-50 text-red-700 hover:bg-red-100`;
                return base;
              };

              return (
                <div 
                  key={loc}
                  className={`relative p-3 rounded-xl border transition-all duration-200 ease-in-out ${
                    isSelected 
                      ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-800 ring-offset-2' 
                      : 'bg-white text-slate-700 border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  <h3 
                    className="font-bold text-[15px] mb-2 truncate border-b border-slate-200/20 pb-1.5 cursor-pointer hover:opacity-80"
                    onClick={() => { setActiveLocation(loc); setActiveFilter('전체'); }}
                  >
                    {loc}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <button 
                      className={getBadgeClass('전체')}
                      onClick={() => { setActiveLocation(loc); setActiveFilter('전체'); }}
                    >
                      <span className={`font-medium ${isSelected && activeFilter !== '전체' ? 'opacity-70' : 'opacity-80'}`}>총인원</span>
                      <span className="font-bold text-[12px]">{stat.total.toLocaleString()}</span>
                    </button>
                    <button 
                      className={getBadgeClass('사용중')}
                      onClick={() => { setActiveLocation(loc); setActiveFilter('사용중'); }}
                    >
                      <span className={`font-medium ${isSelected && activeFilter !== '사용중' ? 'opacity-70' : 'opacity-80'}`}>사용중</span>
                      <span className="font-bold text-[12px]">{stat.active.toLocaleString()}</span>
                    </button>
                    <button 
                      className={getBadgeClass('한달전')}
                      onClick={() => { setActiveLocation(loc); setActiveFilter('한달전'); }}
                    >
                      <span className={`font-medium ${isSelected && activeFilter !== '한달전' ? 'opacity-70' : 'opacity-80'}`}>1달전</span>
                      <span className="font-bold text-[12px]">{stat.oneMonth.toLocaleString()}</span>
                    </button>
                    <button 
                      className={getBadgeClass('2주전')}
                      onClick={() => { setActiveLocation(loc); setActiveFilter('2주전'); }}
                    >
                      <span className={`font-medium ${isSelected && activeFilter !== '2주전' ? 'opacity-70' : 'opacity-80'}`}>2주전</span>
                      <span className="font-bold text-[12px]">{stat.twoWeeks.toLocaleString()}</span>
                    </button>
                    <button 
                      className={getBadgeClass('종료')}
                      onClick={() => { setActiveLocation(loc); setActiveFilter('종료'); }}
                    >
                      <span className={`font-medium ${isSelected && activeFilter !== '종료' ? 'opacity-70' : 'opacity-80'}`}>만료</span>
                      <span className="font-bold text-[12px]">{stat.expired.toLocaleString()}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 메인 테이블 영역 */}
        <div className="flex-1 px-10 pb-10 overflow-hidden">
          <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <MemberTable
              members={filteredMembers}
              onDeleteMembers={handleDeleteMembers}
              onSendSelected={handleSendSelected}
              settings={settings}
            />
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={modalState?.isOpen || false}
        title={modalState?.title || ''}
        message={modalState?.message || ''}
        isAlert={modalState?.isAlert}
        onConfirm={modalState?.onConfirm || (() => {})}
        onCancel={() => setModalState(null)}
      />

      <SolapiSetupModal 
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        settings={settings}
        onSaveSettings={handleUpdateSettings}
        onSuccess={() => {
          setModalState({
            isOpen: true,
            title: '연동 성공',
            message: '솔라피 계정이 성공적으로 연동되었습니다.\n이제 문자 발송이 가능합니다.',
            isAlert: true,
            onConfirm: () => setModalState(null),
          });
        }}
      />

      <SmsSendModal 
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        targets={smsTargets}
        onSend={handleExecuteSend}
        isSending={isSending}
        onAlert={(msg) => {
          setModalState({
            isOpen: true,
            title: '알림',
            message: msg,
            isAlert: true,
            onConfirm: () => setModalState(null),
          });
        }}
      />

      <SmsHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
