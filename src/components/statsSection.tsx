import { Award, ChevronDown, ChevronUp, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import StatsCard from './statsCard';
import { Button } from './ui/button';

export default function StatsSection({ stats }: { stats: { total: number; active: number; inactive: number } }) {
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">회원 통계</h2>
        <Button variant="ghost" size="sm" onClick={() => setIsStatsCollapsed(!isStatsCollapsed)} className="gap-2">
          {isStatsCollapsed ? (
            <>
              <ChevronDown className="w-4 h-4" /> 펼치기
            </>
          ) : (
            <>
              <ChevronUp className="w-4 h-4" /> 접기
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
    </>
  );
}
