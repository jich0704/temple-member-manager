import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react';
import Header from './components/header';
import MemberTable from './components/memberTable';
import { ConfirmModal } from './components/ui/confirmModal';
import { SolapiSetupModal } from './components/ui/solapiSetupModal';
import { SmsSendModal } from './components/ui/smsSendModal';
import { SmsHistoryModal } from './components/ui/smsHistoryModal';
import { MasterAdminModal } from './components/ui/masterAdminModal';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';
import type { Member, Settings } from './types/member';
import { Button } from './components/ui/button';
import {
  loadCloudSettings,
  saveCloudSettings,
  syncTempleSummary,
  logTempleError,
  type TempleAccount,
} from './service/firebaseSyncService';

// 필터 타입 정의
type FilterType = '전체' | '사용중' | '한달전' | '2주전' | '종료';

interface DashboardProps {
  account?: TempleAccount | null;
  onLogout?: () => void;
}

const Dashboard = ({ account, onLogout }: DashboardProps) => {
  const [activeLocation, setActiveLocation] = useState<string>('전체');
  const [activeFilter, setActiveFilter] = useState<FilterType>('전체');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortKey, setSortKey] = useState('신도번호');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const { members, totalCount, totalPages, isLoading, locationStats, handleUpload, handleDeleteMembers, refreshAll, settings, handleUpdateSettings, handleExportExcel } = useMembers(
    activeLocation, activeFilter, page, limit, sortKey, sortDir, searchQuery
  );
  
  const { sendSMS, checkSolapiBalance, isSending } = useSMS();
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; isAlert: boolean; onConfirm: () => void } | null>(null);
  const [solapiBalance, setSolapiBalance] = useState<number | null>(null);
  const [isMasterAdminModalOpen, setIsMasterAdminModalOpen] = useState(false);

  // 로그인 시 클라우드 설정 로드하여 로컬 설정과 병합
  useEffect(() => {
    if (!account?.uid || account.isLocalMode || account.isMasterAdmin) return;
    loadCloudSettings(account.uid).then((cloudData) => {
      if (cloudData?.settings) {
        handleUpdateSettings({ ...settings, ...cloudData.settings });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.uid]);

  // 설정 변경 시 로컬 + 클라우드 동시 저장
  const handleSaveAndSyncSettings = async (newSettings: Settings) => {
    await handleUpdateSettings(newSettings);
    if (account?.uid && !account.isLocalMode && !account.isMasterAdmin) {
      await saveCloudSettings(account.uid, { settings: newSettings });
    }
  };

  // 위치별 요약 통계, 솔라피 잔액 및 현재 앱 버전 클라우드 동기화
  useEffect(() => {
    if (!account?.uid || account.isLocalMode || account.isMasterAdmin) return;
    if (Object.keys(locationStats || {}).length === 0 && solapiBalance === null) return;
    window.api
      ?.getAppVersion?.()
      .catch(() => '1.0.0')
      .then((ver) => {
        syncTempleSummary(account.uid, {
          appVersion: ver || '1.0.0',
          solapiBalance,
          locationStats,
        });
      });
  }, [account?.uid, account?.isLocalMode, locationStats, solapiBalance]);


  // MDB 동기화 상태 및 오류 이력 클라우드 기록
  useEffect(() => {
    if (!account?.uid || account.isLocalMode || account.isMasterAdmin || !window.api?.onMdbSyncStatus) return;
    const unsubscribe = window.api.onMdbSyncStatus((status) => {
      syncTempleSummary(account.uid, {
        mdbStatus: {
          state: status.state,
          lastSyncAt: status.syncedAt,
          rowCount: status.rowCount,
          lastError: status.error || '',
        },
      });
      if (status.state === 'error' && status.message) {
        logTempleError(account.uid, 'MDB_SYNC', status.message, {
          error: status.error,
        });
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [account?.uid, account?.isLocalMode]);

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
  const cardsGridRef = useRef<HTMLDivElement>(null);
  const [cardRowHeights, setCardRowHeights] = useState<{ collapsed: number; expanded: number }>({
    collapsed: 120,
    expanded: 320,
  });

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
      message,
      imageBase64,
    });
    
    if (result.success) {
      setIsSendModalOpen(false);
      await refreshAll();
      const failedCount = result.failedCount || 0;
      const successCount = result.successCount ?? smsTargets.length;
      setModalState({
        isOpen: true,
        title: result.partial ? '일부 발송 실패' : '발송 완료',
        message: result.partial
          ? `${smsTargets.length}명 중 ${successCount}명은 접수되었고 ${failedCount}명은 실패했습니다. 발송 이력에서 실패 사유를 확인해 주세요.`
          : `${successCount}명에게 문자를 성공적으로 접수했습니다.`,
        isAlert: true,
        onConfirm: () => setModalState(null),
      });
    } else {
      let errorMsg = result.error || '';
      logTempleError(account?.uid, 'SMS_SEND', errorMsg || '문자 발송 실패', {
        targetCount: smsTargets.length,
        hasImage: Boolean(imageBase64),
      });
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

  // '전체' 카드 제거에 따른 기본 위치 자동 설정 및 초기화 대응
  const locationInitialized = useRef(false);
  useEffect(() => {
    const availableLocs = locations.filter(l => l !== '전체');
    if (availableLocs.length === 0) {
      locationInitialized.current = false;
      if (activeLocation !== '전체') {
        setActiveLocation('전체');
      }
      return;
    }
    if (!locationInitialized.current || activeLocation === '전체' || !availableLocs.includes(activeLocation)) {
      locationInitialized.current = true;
      setActiveLocation(availableLocs[0]);
    }
  }, [locations, activeLocation]);

  // 카드 높이에 맞춰 접기(1줄 높이) / 펼치기(전체 카드 높이) 동적 계산
  useEffect(() => {
    const el = cardsGridRef.current;
    if (!el) return;

    const measure = () => {
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length === 0) {
        setCardRowHeights({ collapsed: 0, expanded: 0 });
        return;
      }
      const firstTop = children[0].offsetTop;
      let firstRowMaxHeight = 0;
      for (const child of children) {
        if (Math.abs(child.offsetTop - firstTop) <= 4) {
          firstRowMaxHeight = Math.max(firstRowMaxHeight, child.offsetHeight);
        }
      }
      const totalHeight = el.scrollHeight;
      const maxViewportAllowance = Math.round(window.innerHeight * 0.42);
      setCardRowHeights({
        collapsed: firstRowMaxHeight + 12,
        expanded: Math.min(Math.max(totalHeight + 12, firstRowMaxHeight + 12), maxViewportAllowance),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [locations, settings.menuFontSize]);

  const menuFontStyle = {
    '--menu-font-size': `${settings.menuFontSize ?? 14}px`,
  } as CSSProperties;

  const visibleLocations = locations.filter(l => l !== '전체');

  return (
    <div className="min-h-screen bg-slate-50/50 w-full overflow-x-hidden">
      <div className="flex flex-col h-screen w-full min-w-0">
        {/* 상단 헤더 영역 */}
        <div className="px-10 pt-8 pb-4">
          <Header
            settings={settings}
            onUpdateSettings={handleSaveAndSyncSettings}
            hasMembers={visibleLocations.length > 0 || members.length > 0}
            onOpenSolapiSetup={() => setIsSetupModalOpen(true)}
            onOpenSmsHistory={() => setIsHistoryModalOpen(true)}
            solapiBalance={solapiBalance}
            onMdbSynced={refreshAll}
            onUploadExcel={handleUpload}
            onExportExcel={handleExportExcel}
            locations={locations}
            account={account}
            onLogout={onLogout}
            onOpenMasterAdmin={account?.isMasterAdmin ? () => setIsMasterAdminModalOpen(true) : undefined}
          />
        </div>

        {/* 종합 관제탑 Grid UI (컴팩트 버전) */}
        {visibleLocations.length > 0 && (
          <>
            <div className="menu-font-scope px-10 flex justify-end mb-1" style={menuFontStyle}>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-500 hover:text-slate-800" onClick={() => setIsCardsExpanded(!isCardsExpanded)}>
                {isCardsExpanded ? '카드 접기' : '카드 펼치기'}
              </Button>
            </div>
            <div
              className={`menu-font-scope px-10 mb-4 pb-2 custom-scrollbar transition-all duration-300 ${isCardsExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
              style={{
                ...menuFontStyle,
                maxHeight: isCardsExpanded ? `${cardRowHeights.expanded}px` : `${cardRowHeights.collapsed}px`,
              }}
            >
              <div ref={cardsGridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-0.5">
                {visibleLocations.map(loc => {
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
                          ? 'bg-blue-50/90 text-blue-950 border-blue-500 shadow-md ring-2 ring-blue-500/20' 
                          : 'bg-white text-slate-700 border-slate-200 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <h3 
                        className={`font-bold text-[15px] mb-2 whitespace-normal break-words border-b pb-1.5 cursor-pointer hover:opacity-80 ${
                          isSelected ? 'border-blue-200 text-blue-900' : 'border-slate-100 text-slate-800'
                        }`}
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
          </>
        )}

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
              onPageChange={(p) => { setPage(p); }}
              onItemsPerPageChange={(l) => { setLimit(l); setPage(1); }}
              onSortChange={(k, d) => {
                if (d === null) {
                  setSortKey('신도번호');
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

      <div className="menu-font-scope" style={menuFontStyle}>
        <MasterAdminModal
          isOpen={Boolean(account?.isMasterAdmin && isMasterAdminModalOpen)}
          onClose={() => setIsMasterAdminModalOpen(false)}
        />
        <ConfirmModal
          isOpen={modalState?.isOpen || false}
          title={modalState?.title || ''}
          message={modalState?.message || ''}
          isAlert={modalState?.isAlert}
          onConfirm={modalState?.onConfirm || (() => {})}
          onCancel={() => setModalState(null)}
        />
      </div>

      <div className="menu-font-scope" style={menuFontStyle}>
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
      </div>

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

      <div className="menu-font-scope" style={menuFontStyle}>
        <SmsHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default Dashboard;
