import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Settings2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { ConfirmModal } from './ui/confirmModal';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { Member, Settings } from '../types/member';

interface Props {
  members: Member[];
  onDeleteMembers: (ids: string[]) => void;
  settings: Settings;
}

export default function MemberTable({ members, onDeleteMembers, settings }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: '인등번호', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  // 컬럼 설정 (기본적으로 모든 키를 표시하되 관리에 필요한 이름, 전화번호 우선)
  // 실제 엑셀 데이터의 키 값들을 동적으로 추출
  const dynamicHeaders = useMemo(() => {
    if (!members || members.length === 0) return [];
    // 모든 멤버의 키를 합쳐서 중복 제거 (엑셀 데이터의 원래 순서가 유지됨)
    const allKeys = new Set<string>();
    members.forEach((m) => {
      Object.keys(m).forEach((k) => {
        if (!['index', 'status', 'name', 'phone'].includes(k)) {
          allKeys.add(k);
        }
      });
    });
    
    return Array.from(allKeys);
  }, [members]);

  const [activeColumns, setActiveColumns] = useState<string[]>([
    '위치명', '등록일', '신도번호', '대주', 
    '영가여부', '동참자', '생일', '휴대폰', 'DM', '가족순서', '최종납부월'
  ]);

  // 필터링 (activeFilter는 대시보드에서 이미 처리되어 내려오지만 추가적인 검색 등이 있다면 여기서 처리 가능)
  const filteredMembers = members || []; 

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null; // 3번째 클릭 시 정렬 해제 (기본 상태)
      }
      return { key, direction: 'asc' }; // 처음 클릭 시 오름차순
    });
  };

  // 필터링된 데이터를 기준으로 정렬 수행
  const sortedMembers = useMemo(() => {
    const sortableItems = [...filteredMembers];

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = String(a[sortConfig.key] ?? '');
        const bValue = String(b[sortConfig.key] ?? '');

        const compareResult = aValue.localeCompare(bValue, 'ko', { numeric: true });

        // 오름차순(asc)이면 그대로, 내림차순(desc)이면 결과를 뒤집어줍니다(-).
        return sortConfig.direction === 'asc' ? compareResult : -compareResult;
      });
    }
    return sortableItems;
  }, [filteredMembers, sortConfig]);

  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage);
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedMembers.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedMembers, currentPage, itemsPerPage]);

  const isAllSelected = paginatedMembers.length > 0 && paginatedMembers.every((m) => selectedIds.has(String(m.index)));

  const handleSelectAll = () => {
    const newSelected = new Set(selectedIds);
    if (isAllSelected) paginatedMembers.forEach((m) => newSelected.delete(String(m.index)));
    else paginatedMembers.forEach((m) => newSelected.add(String(m.index)));
    setSelectedIds(newSelected);
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setModalState({
      isOpen: true,
      title: '회원 단체 삭제',
      message: `선택한 ${selectedIds.size}명의 회원을 삭제하시겠습니까?`,
      onConfirm: () => {
        onDeleteMembers(Array.from(selectedIds));
        setSelectedIds(new Set());
        setModalState(null);
      }
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (val: string) => {
    setItemsPerPage(Number(val));
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* --- 테이블 상단 툴바 --- */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
            <span className="text-sm font-medium text-gray-500">전체 선택</span>
          </div>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
              <Trash2 className="h-4 w-4" /> 선택 삭제
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Settings2 className="h-4 w-4" />
                컬럼 선택
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px] max-h-[300px] overflow-y-auto">
              {dynamicHeaders.map((header) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={header}
                    checked={activeColumns.includes(header)}
                    onCheckedChange={(value) => {
                      if (value) {
                        // dynamicHeaders 순서대로 정렬을 유지하며 추가
                        setActiveColumns(prev => {
                          const next = new Set(prev);
                          next.add(header);
                          return dynamicHeaders.filter(h => next.has(h));
                        });
                      } else {
                        setActiveColumns(prev => prev.filter(h => h !== header));
                      }
                    }}
                  >
                    {header}
                  </DropdownMenuCheckboxItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- 테이블 리스트 --- */}
      <div className="flex-1 overflow-auto relative">
        <div className="min-w-[1600px] w-full">
          {/* --- 동적 테이블 헤더 (Sticky) --- */}
          <div className="sticky top-0 z-10 flex h-12 items-center border-b bg-gray-50 px-6 font-semibold shadow-sm">
            <div className="w-12 shrink-0"></div>
            {dynamicHeaders
              .filter((header) => activeColumns.includes(header))
              .map((header) => {
                const isNameOrPhone = ['이름', '전화번호', '대주', '동참자', '휴대폰', 'phone', 'name'].includes(header);
                return (
                  <div
                    key={header}
                    onClick={() => handleSort(header)}
                    className={`flex-1 flex cursor-pointer items-center gap-2 px-2 text-gray-700 hover:text-blue-600 select-none group relative ${isNameOrPhone ? 'justify-start' : 'justify-center'}`}
                  >
                    <span className="truncate">{header}</span>
                  </div>
                );
              })}
            <div className="w-32 shrink-0 flex justify-center text-gray-700">상태</div>
            <div className="w-20 shrink-0 flex justify-center text-gray-700">SMS</div>
            <div className="w-20 shrink-0 flex justify-center text-gray-700">삭제</div>
          </div>

          {(!members || members.length === 0) ? (
          <div className="flex h-[calc(100%-48px)] flex-col items-center justify-center text-muted-foreground bg-white">
            <p className="mt-20">등록된 회원이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white">
            {paginatedMembers.map((m) => {
              const isSelected = selectedIds.has(String(m.index));
              return (
                <div key={String(m.index)} className={`group flex h-14 cursor-pointer items-center border-b border-gray-100 px-6 transition-all duration-200 hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                  <div className="flex w-12 shrink-0 items-center">
                    <Checkbox checked={isSelected} onCheckedChange={() => handleSelectOne(String(m.index))} />
                  </div>

                  {/* 동적 컬럼 데이터 렌더링 */}
                  {dynamicHeaders
                    .filter((header) => activeColumns.includes(header))
                    .map((header) => {
                      const isNameOrPhone = ['이름', '전화번호', '대주', '동참자', '휴대폰', 'phone', 'name'].includes(header);
                      return (
                        <div key={header} className={`flex-1 truncate px-2 text-sm text-gray-700 ${isNameOrPhone ? 'text-left' : 'text-center'}`}>
                          {m[header] || '-'}
                        </div>
                      );
                    })}

                  {/* 상태 선택 및 디데이 뱃지 */}
                  <div className="flex w-32 shrink-0 justify-center">
                    <StatusDisplay 
                        status={String(m.status)} 
                        lastPaymentMonth={m['최종납부월'] ? String(m['최종납부월']) : undefined} 
                        settings={settings}
                    />
                  </div>

                  {/* 삭제 버튼 등 */}
                  <div className="flex w-20 shrink-0 justify-center gap-2">
                     <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:bg-blue-50">
                        💬
                     </Button>
                  </div>
                  <div className="flex w-20 shrink-0 justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalState({
                          isOpen: true,
                          title: '회원 삭제',
                          message: '이 회원을 삭제하시겠습니까?',
                          onConfirm: () => {
                            onDeleteMembers([String(m.index)]);
                            setModalState(null);
                          }
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* --- 페이지네이션 --- */}
      {totalPages > 0 && (
        <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            총 <span className="font-semibold text-gray-700">{sortedMembers.length}</span>명 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, sortedMembers.length)} 표시
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-8 h-8">
                      {page}
                    </Button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-2">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={modalState?.isOpen || false}
        title={modalState?.title || ''}
        message={modalState?.message || ''}
        onConfirm={modalState?.onConfirm || (() => {})}
        onCancel={() => setModalState(null)}
      />
    </div>
  );
}

// ----------------------------------------------------
// 상태 및 날짜 표시 컴포넌트
// ----------------------------------------------------
const StatusDisplay = ({ status, lastPaymentMonth, settings }: { status: string; lastPaymentMonth?: string; settings: Settings }) => {
  if (!lastPaymentMonth || lastPaymentMonth === '-' || lastPaymentMonth.trim() === '') {
    return <StatusBadge text={status} colorClass={status === '비활동' ? 'from-gray-400 to-gray-500' : settings.safeColor} />;
  }

  const [yearStr, monthStr] = lastPaymentMonth.split('-');
  if (!yearStr || !monthStr) {
    return <StatusBadge text={status} colorClass="from-gray-400 to-gray-500" />;
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const targetDate = new Date(year, month, 0); // 월말
  targetDate.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let resultText = '활동';
  let colorClass = '';

  if (daysLeft < 0) {
    resultText = '비활동';
    colorClass = 'from-gray-400 to-gray-500';
  } else if (daysLeft <= settings.criticalDays) {
    resultText = '활동';
    colorClass = settings.criticalColor;
  } else if (daysLeft <= settings.warningDays) {
    resultText = '활동';
    colorClass = settings.warningColor;
  } else {
    resultText = '활동';
    colorClass = settings.safeColor;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <StatusBadge text={resultText} colorClass={colorClass} />
      {daysLeft >= 0 && <span className="text-[10px] text-gray-400 font-mono">D-{daysLeft}</span>}
    </div>
  );
};

const StatusBadge = ({ text, colorClass }: { text: string; colorClass: string }) => {
  return <Badge className={`border-0 bg-gradient-to-r ${colorClass} text-white hover:opacity-90`}>{text}</Badge>;
};
