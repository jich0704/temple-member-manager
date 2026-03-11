import { AlertTriangle, Award, ChevronDown, ChevronUp, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import StatsCard from './statsCard';
import { Button } from './ui/button';

type FilterType = '전체' | '활동' | '비활동' | '만료임박';

interface StatsSectionProps {
  stats: { total: number; active: number; inactive: number; expiringSoon: number };
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export default function StatsSection({ stats, activeFilter, onFilterChange }: StatsSectionProps) {
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  const handleCardClick = (filter: FilterType) => {
    // 이미 선택된 카드 클릭 시 전체 해제
    if (activeFilter === filter) {
      onFilterChange('전체');
    } else {
      onFilterChange(filter);
    }
  };

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
        <div className="grid grid-cols-4 gap-6">
          <StatsCard
            title="전체 회원"
            value={stats.total}
            icon={Users}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            iconColor="text-white"
            onClick={() => handleCardClick('전체')}
            isActive={activeFilter === '전체'}
          />
          <StatsCard
            title="활동 회원"
            value={stats.active}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            iconColor="text-white"
            onClick={() => handleCardClick('활동')}
            isActive={activeFilter === '활동'}
          />
          <StatsCard
            title="비활동 회원"
            value={stats.inactive}
            icon={Award}
            gradient="bg-gradient-to-br from-gray-400 to-gray-500"
            iconColor="text-white"
            onClick={() => handleCardClick('비활동')}
            isActive={activeFilter === '비활동'}
          />
          <StatsCard
            title="만료 임박"
            value={stats.expiringSoon}
            icon={AlertTriangle}
            gradient="bg-gradient-to-br from-orange-400 to-red-500"
            iconColor="text-white"
            onClick={() => handleCardClick('만료임박')}
            isActive={activeFilter === '만료임박'}
          />
        </div>
      )}
    </>
  );
}
