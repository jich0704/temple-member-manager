import { Award, ChevronDown, ChevronUp, TrendingUp, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Header from './components/header';
import MemberTable from './components/memberTable';
import StatsCard from './components/statsCard';
import { Button } from './components/ui/button';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';
import { parseExcel } from './service/excelService';
import type { MemberStatus } from './types/member';

function App() {
  const { members, setMembers } = useMembers();
  const { sendSMS, isSending } = useSMS();
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const saved = await window.api!.loadMembers();
      setMembers(saved);
    };

    load();
  }, [setMembers]);

  const handleUpload = async (file: File) => {
    const parsed = await parseExcel(file);

    await window.api!.saveMembers(parsed);

    setMembers((prev) => [...prev, ...parsed]);
  };

  const handleSend = () => {
    sendSMS(members, '테스트 메시지');
  };

  // 회원 삭제
  const handleDeleteMembers = async (ids: string[]) => {
    const newMembers = members.filter((m) => !ids.includes(String(m.index)));
    setMembers(newMembers);
    await window.api!.saveMembers(newMembers);
  };

  // 회원 상태 변경
  const handleUpdateMemberStatus = async (id: string, status: MemberStatus) => {
    const newMembers = members.map((m) => (String(m.index) === id ? { ...m, status } : m));
    setMembers(newMembers);
    await window.api!.saveMembers(newMembers);
  };

  // 통계 계산
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.status === '활동').length;
    const inactive = members.filter((m) => m.status === '비활동').length;

    return { total, active, inactive };
  }, [members]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="h-screen flex flex-col">
        {/* 상단 영역 */}
        <div className="px-10 pt-8 pb-6">
          <Header onUpload={handleUpload} onSend={handleSend} isSending={isSending} />
        </div>

        {/* 통계 카드 영역 */}
        <div className="px-10 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">회원 통계</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsStatsCollapsed(!isStatsCollapsed)} className="gap-2">
              {isStatsCollapsed ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  펼치기
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" />
                  접기
                </>
              )}
            </Button>
          </div>

          {!isStatsCollapsed && (
            <div className="grid grid-cols-3 gap-6">
              <StatsCard title="전체 회원" value={stats.total} icon={Users} gradient="bg-gradient-to-br from-blue-500 to-blue-600" iconColor="text-white" />
              <StatsCard title="활동 회원" value={stats.active} icon={TrendingUp} gradient="bg-gradient-to-br from-green-500 to-emerald-600" iconColor="text-white" />
              <StatsCard title="비활동 회원" value={stats.inactive} icon={Award} gradient="bg-gradient-to-br from-gray-400 to-gray-500" iconColor="text-white" />
            </div>
          )}
        </div>

        {/* 테이블 영역 */}
        <div className="flex-1 px-10 pb-10 min-h-0">
          <MemberTable members={members} onDeleteMembers={handleDeleteMembers} onUpdateMemberStatus={handleUpdateMemberStatus} />
        </div>
      </div>
    </div>
  );
}

export default App;
