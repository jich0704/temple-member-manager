import { useState, useMemo } from 'react';
import Header from './components/header';
import StatsSection from './components/statsSection';
import MemberTable from './components/memberTable';
import { ConfirmModal } from './components/ui/confirmModal';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';

// 필터 타입 정의
type FilterType = '전체' | '한달전' | '2주전' | '종료';

const Dashboard = () => {
  const { members, stats, handleUpload, handleDeleteMembers, handleExportExcel, settings, handleUpdateSettings } = useMembers();
  const { sendSMS, isSending } = useSMS();
  const [activeFilter, setActiveFilter] = useState<FilterType>('전체');
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; isAlert: boolean; onConfirm: () => void } | null>(null);

  // 실제 SMS 발송 로직 (useSMS 훅과 연동)
  const handleSend = () => {
    if (filteredMembers.length === 0) {
      setModalState({
        isOpen: true,
        title: '알림',
        message: '발송할 대상이 없습니다.',
        isAlert: true,
        onConfirm: () => setModalState(null),
      });
      return;
    }

    setModalState({
      isOpen: true,
      title: 'SMS 단체 발송',
      message: `${filteredMembers.length}명의 회원에게 문자를 발송하시겠습니까?`,
      isAlert: false,
      onConfirm: () => {
        sendSMS({
          targets: filteredMembers,
          message: '안녕하세요, 사찰에서 안내드립니다.',
        });
        setModalState(null);
      },
    });
  };

  // 필터링 로직
  const filteredMembers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return members.filter((m) => {
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
  }, [members, activeFilter, settings.warningDays, settings.criticalDays]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="flex flex-col h-screen">
        {/* 상단 헤더 영역 */}
        <div className="px-10 pt-8 pb-6">
          <Header
            onUpload={handleUpload}
            onSend={handleSend}
            isSending={isSending}
            onExportExcel={handleExportExcel}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            hasMembers={members.length > 0}
          />
        </div>

        {/* 통계 카드 영역 */}
        <div className="px-10 mb-6">
          <StatsSection stats={stats} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        </div>

        {/* 메인 테이블 영역 */}
        <div className="flex-1 px-10 pb-10 overflow-hidden">
          <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <MemberTable
              members={filteredMembers}
              onDeleteMembers={handleDeleteMembers}
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
    </div>
  );
};

export default Dashboard;
