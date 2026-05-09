import { AlertTriangle, ChevronDown, ChevronUp, Users, Clock, AlertCircle, CalendarX } from 'lucide-react';
import { useState } from 'react';
import StatsCard from './statsCard';
import { Button } from './ui/button';

type FilterType = '전체' | '한달전' | '2주전' | '종료';

interface StatsSectionProps {
  stats: { total: number; oneMonth: number; twoWeeks: number; expired: number };
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
            title="한 달 전"
            value={stats.oneMonth}
            icon={Clock}
            gradient="bg-gradient-to-br from-orange-400 to-orange-500"
            iconColor="text-white"
            onClick={() => handleCardClick('한달전')}
            isActive={activeFilter === '한달전'}
          />
          <StatsCard
            title="2주 전"
            value={stats.twoWeeks}
            icon={AlertCircle}
            gradient="bg-gradient-to-br from-red-500 to-red-600"
            iconColor="text-white"
            onClick={() => handleCardClick('2주전')}
            isActive={activeFilter === '2주전'}
          />
          <StatsCard
            title="종료"
            value={stats.expired}
            icon={CalendarX}
            gradient="bg-gradient-to-br from-gray-500 to-gray-600"
            iconColor="text-white"
            onClick={() => handleCardClick('종료')}
            isActive={activeFilter === '종료'}
          />
        </div>
      )}
    </>
  );
}
