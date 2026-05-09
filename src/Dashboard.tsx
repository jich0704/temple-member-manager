import { useState, useMemo } from 'react';
import Header from './components/header';
import StatsSection from './components/statsSection';
import MemberTable from './components/memberTable';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';

// 필터 타입 정의
type FilterType = '전체' | '활동' | '비활동' | '만료임박';

const Dashboard = () => {
  const { members, stats, handleUpload, handleDeleteMembers, handleExportExcel, settings, handleUpdateSettings } = useMembers();
  const { sendSMS, isSending } = useSMS();
  const [activeFilter, setActiveFilter] = useState<FilterType>('전체');

  // 실제 SMS 발송 로직 (useSMS 훅과 연동)
  const handleSend = () => {
    // 1. 현재 필터링된 멤버들만 대상으로 보낼지, 전체를 대상으로 보낼지 등에 대한 정책 필요
    // 일단 여기서는 현재 화면에 보이는(필터링된) 리스트를 대상으로 보낸다고 가정
    if (filteredMembers.length === 0) {
      alert('발송할 대상이 없습니다.');
      return;
    }

    if (confirm(`${filteredMembers.length}명의 회원에게 문자를 발송하시겠습니까?`)) {
      sendSMS({
        targets: filteredMembers,
        message: '안녕하세요, 사찰에서 안내드립니다.',
      });
    }
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

      if (activeFilter === '활동' || activeFilter === '비활동') {
        if (!targetDate) return activeFilter === '활동';

        const isActive = targetDate.getTime() >= today.getTime();
        return activeFilter === '활동' ? isActive : !isActive;
      }
      if (activeFilter === '만료임박') {
        if (!targetDate) return false;

        const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= settings.warningDays;
      }
      return true;
    });
  }, [members, activeFilter, settings.warningDays]);

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
    </div>
  );
};

export default Dashboard;
