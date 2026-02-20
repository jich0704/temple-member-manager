import { Award, ChevronDown, ChevronUp, TrendingUp, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Header from './components/header';
import MemberTable from './components/memberTable';
import StatsCard from './components/statsCard';
import { Button } from './components/ui/button';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';
import { parseExcel } from './service/excelService';

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

  const handleSend = () => {
    sendSMS(members, '테스트 메시지');
  };

  // 1. 회원 업로드 (이어 붙이기)
  const handleUpload = async (file: File) => {
    const parsed = await parseExcel(file);

    // 백엔드에 '추가'를 요청하고, 합쳐진 전체 데이터를 받아옵니다.
    await window.api!.addMembers(parsed);

    // 화면에도 합쳐진 전체 데이터를 반영합니다.
    setMembers((prev) => [...prev, ...parsed]);
  };

  // 2. 회원 삭제 (덮어쓰기)
  const handleDeleteMembers = async (ids: string[]) => {
    const newMembers = members.filter((m) => !ids.includes(String(m.index)));

    setMembers(newMembers);

    await window.api!.overwriteMembers(newMembers);
  };

  // // 회원 상태 변경
  // const handleUpdateMemberStatus = async (id: string, status: MemberStatus) => {
  //   // 1. 특정 회원의 상태만 변경된 '새로운 전체 배열' 생성
  //   const newMembers = members.map((m) => (String(m.index) === id ? { ...m, status } : m));

  //   // 2. 화면 업데이트
  //   setMembers(newMembers);

  //   // 3. 백엔드(store)에 통째로 덮어쓰기 요청
  //   await window.api!.overwriteMembers(newMembers);
  // };

  // 통계 계산
  const stats = useMemo(() => {
    const total = members.length;

    // 오늘 날짜 자정 기준 생성
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // reduce를 사용하면 순회 한 번으로 active와 inactive를 동시에 계산할 수 있어 효율적입니다.
    const { active, inactive } = members.reduce(
      (acc, m) => {
        // m['종료일']의 타입이 string | number | boolean | Date | undefined 이므로
        // 안전하게 판단하기 위해 변수에 담습니다.
        const endDateValue = m['종료일'];

        let isActive = true; // 기본값은 활동

        if (endDateValue) {
          // 값을 Date 객체로 변환 시도
          const targetDate = new Date(String(endDateValue));

          // 유효한 날짜이고, 오늘보다 과거라면 비활동 처리
          if (!isNaN(targetDate.getTime())) {
            targetDate.setHours(0, 0, 0, 0);
            if (targetDate.getTime() < today.getTime()) {
              isActive = false;
            }
          }
        }

        if (isActive) {
          acc.active += 1;
        } else {
          acc.inactive += 1;
        }

        return acc;
      },
      { active: 0, inactive: 0 },
    );

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
          <MemberTable members={members} onDeleteMembers={handleDeleteMembers} />
        </div>
      </div>
    </div>
  );
}

export default App;
