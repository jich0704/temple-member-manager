import { useState, useMemo, useEffect, useRef } from 'react';
import Header from './components/header';
import MemberTable from './components/memberTable';
import { ConfirmModal } from './components/ui/confirmModal';
import { SolapiSetupModal } from './components/ui/solapiSetupModal';
import { SmsSendModal } from './components/ui/smsSendModal';
import { SmsHistoryModal } from './components/ui/smsHistoryModal';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';
import type { Member } from './types/member';
import { Button } from './components/ui/button';

// 필터 타입 정의
type FilterType = '전체' | '사용중' | '한달전' | '2주전' | '종료';

const Dashboard = () => {
  const [activeLocation, setActiveLocation] = useState<string>('전체');
  const [activeFilter, setActiveFilter] = useState<FilterType>('전체');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortKey, setSortKey] = useState('인등번호');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const { members, totalCount, totalPages, isLoading, stats, locationStats, handleUpload, handleDeleteMembers, reloadMembers, settings, handleUpdateSettings, handleExportExcel } = useMembers(
    activeLocation, activeFilter, page, limit, sortKey, sortDir, searchQuery
  );
  
  const { sendSMS, checkSolapiBalance, isSending } = useSMS();
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
  const [isCardsExpanded, setIsCardsExpanded] = useState(false);

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

  // 위치 목록 추출 (locationStats가 변경될 때만 계산)
  const locations = useMemo(() => {
    const locSet = new Set(Object.keys(locationStats || {}));
    return ['전체', ...Array.from(locSet).filter(l => l !== '전체').sort()];
  }, [locationStats]);

  // '전체' 카드 제거에 따른 기본 위치 자동 설정 (locations가 처음 로드될 때 1회만)
  const locationInitialized = useRef(false);
  useEffect(() => {
    if (locationInitialized.current) return; // 이미 설정됐으면 무시
    if (activeLocation === '전체') {
      const availableLocs = locations.filter(l => l !== '전체');
      if (availableLocs.length > 0) {
        locationInitialized.current = true;
        setActiveLocation(availableLocs[0]);
      }
    }
  }, [locations]); // activeLocation 제거 → 카드 선택 시 재발동 방지

  return (
    <div className="min-h-screen bg-slate-50/50 w-full overflow-x-hidden">
      <div className="flex flex-col h-screen w-full min-w-0">
        {/* 상단 헤더 영역 */}
        <div className="px-10 pt-8 pb-4">
          <Header

            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            hasMembers={members.length > 0}
            onOpenSolapiSetup={() => setIsSetupModalOpen(true)}
            onOpenSmsHistory={() => setIsHistoryModalOpen(true)}
            solapiBalance={solapiBalance}
            onMdbSynced={reloadMembers}
            locations={locations}
          />
        </div>

        {/* 종합 관제탑 Grid UI (컴팩트 버전) */}
        <div className="px-10 flex justify-end mb-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-500 hover:text-slate-800" onClick={() => setIsCardsExpanded(!isCardsExpanded)}>
            {isCardsExpanded ? '카드 접기' : '카드 펼치기'}
          </Button>
        </div>
        <div className={`px-10 mb-4 pb-2 overflow-y-auto custom-scrollbar transition-all duration-300 ${isCardsExpanded ? 'max-h-[40vh]' : 'max-h-[115px]'}`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {locations.filter(l => l !== '전체').map(loc => {
              const stat = locationStats[loc] || { total: 0, active: 0, twoWeeks: 0, oneMonth: 0, expired: 0 };
              const isSelected = activeLocation === loc;

              // 뱃지 색상 - 선택 여부 무관하게 항상 동일
              const BADGE_COLORS: Record<string, string> = {
                '전체':  'bg-slate-100 text-slate-700 hover:bg-slate-200',
                '사용중': 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                '한달전': 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                '2주전': 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                '종료':  'bg-red-100 text-red-700 hover:bg-red-200',
              };
              const getBadgeClass = (filter: string) => {
                const base = 'flex gap-1 items-center px-1.5 py-0.5 rounded transition-all';
                const color = BADGE_COLORS[filter] || 'bg-slate-100 text-slate-700';
                const active = isSelected && activeFilter === filter
                  ? 'ring-2 ring-current ring-offset-1 font-bold shadow'
                  : '';
                return `${base} ${color} ${active}`.trim();
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
                    className="font-bold text-[15px] mb-2 whitespace-normal break-words border-b border-slate-200/20 pb-1.5 cursor-pointer hover:opacity-80"
                    onClick={() => { setActiveLocation(loc); setActiveFilter('전체'); setSearchQuery(''); setPage(1); }}
                  >
                    {loc}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <button className={getBadgeClass('전체')} onClick={() => { setActiveLocation(loc); setActiveFilter('전체'); setSearchQuery(''); setPage(1); }}>
                      <span className="font-medium opacity-80">총인원</span>
                      <span className="font-bold text-[12px]">{stat.total.toLocaleString()}</span>
                    </button>
                    <button className={getBadgeClass('사용중')} onClick={() => { setActiveLocation(loc); setActiveFilter('사용중'); setSearchQuery(''); setPage(1); }}>
                      <span className="font-medium opacity-80">사용중</span>
                      <span className="font-bold text-[12px]">{stat.active.toLocaleString()}</span>
                    </button>
                    <button className={getBadgeClass('한달전')} onClick={() => { setActiveLocation(loc); setActiveFilter('한달전'); setSearchQuery(''); setPage(1); }}>
                      <span className="font-medium opacity-80">1달전</span>
                      <span className="font-bold text-[12px]">{stat.oneMonth.toLocaleString()}</span>
                    </button>
                    <button className={getBadgeClass('2주전')} onClick={() => { setActiveLocation(loc); setActiveFilter('2주전'); setSearchQuery(''); setPage(1); }}>
                      <span className="font-medium opacity-80">2주전</span>
                      <span className="font-bold text-[12px]">{stat.twoWeeks.toLocaleString()}</span>
                    </button>
                    <button className={getBadgeClass('종료')} onClick={() => { setActiveLocation(loc); setActiveFilter('종료'); setSearchQuery(''); setPage(1); }}>
                      <span className="font-medium opacity-80">만료</span>
                      <span className="font-bold text-[12px]">{stat.expired.toLocaleString()}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 메인 테이블 영역 */}
        <div className="flex-1 px-10 pb-10 overflow-hidden w-full min-w-0">
          <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col w-full min-w-0">
            <MemberTable
              members={members}
              totalCount={totalCount}
              totalPages={totalPages}
              currentPage={page}
              itemsPerPage={limit}
              isLoading={isLoading}
              sortConfig={{ key: sortKey, direction: sortDir }}
              onPageChange={(p) => { setPage(p); setSearchQuery(''); }}
              onItemsPerPageChange={(l) => { setLimit(l); setPage(1); }}
              onSortChange={(k, d) => {
                if (d === null) {
                  setSortKey('인등번호');
                  setSortDir('desc');
                } else {
                  setSortKey(k);
                  setSortDir(d);
                }
              }}
              onSearchChange={(q) => { setSearchQuery(q); setPage(1); }}
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
