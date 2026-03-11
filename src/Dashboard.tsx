import { useState } from 'react';
import Header from './components/header';
import MemberTable from './components/memberTable';
import StatsSection from './components/statsSection';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';

type FilterType = '전체' | '활동' | '비활동' | '만료임박';

const Dashboard = () => {
  const { members, stats, handleUpload, handleDeleteMembers } = useMembers();
  const { sendSMS, isSending } = useSMS();
  const [activeFilter, setActiveFilter] = useState<FilterType>('전체');

  const handleSend = () => {
    sendSMS(members, '테스트 메시지');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="flex flex-col h-screen">
        {/* 상단 헤더 영역 */}
        <div className="px-10 pt-8 pb-6">
          <Header onUpload={handleUpload} onSend={handleSend} isSending={isSending} />
        </div>

        {/* 통계 카드 영역 */}
        <div className="px-10 pb-6">
          <StatsSection stats={stats} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        </div>

        {/* 테이블 영역 */}
        <div className="flex-1 min-h-0 px-10 pb-10">
          <MemberTable members={members} onDeleteMembers={handleDeleteMembers} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
