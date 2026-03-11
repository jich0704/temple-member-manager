import { useDebounce } from '@/hooks/useDebounce';
import type { Member } from '@/types/member';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MessageSquare, Settings2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type FilterType = '전체' | '활동' | '비활동' | '만료임박';

interface Props {
  members: Member[]; // 동적 객체 배열
  onDeleteMembers: (ids: string[]) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export default function MemberTable({ members, onDeleteMembers, activeFilter, onFilterChange }: Props) {
  const [searchKeyword, setSearchKeyword] = useState(''); // 이름/전화번호 대신 통합 검색으로 변경

  // searchStatus는 activeFilter와 동기화 (만료임박은 Select에서 '전체'로 표시)
  const searchStatus = activeFilter === '만료임박' ? '만료임박' : activeFilter;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const debouncedKeyword = useDebounce(searchKeyword, 300);

  // 1. 동적 컬럼 추출 (members 배열의 첫 번째 객체에서 key를 뽑아냄)
  const dynamicHeaders = useMemo(() => {
    if (members.length === 0) return [];
    // 시스템에서 강제로 쓰는 필드나 화면에 별도로 빼는 필드는 테이블 동적 렌더링에서 제외
    const excludeKeys = ['index', 'status', '상태'];
    return Object.keys(members[0]).filter((key) => !excludeKeys.includes(key));
  }, [members]);

  // 2. 검색 필터링 로직 (통합 검색)
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // 키워드가 어떤 컬럼의 값에라도 포함되어 있으면 통과
      const matchKeyword =
        debouncedKeyword === '' ||
        dynamicHeaders.some((header) =>
          String(m[header] || '')
            .toLowerCase()
            .includes(debouncedKeyword.toLowerCase()),
        );

      const endDate = m['종료일'] ? String(m['종료일']) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let diffDays: number | null = null;
      let calculatedStatus = '활동';

      if (endDate) {
        const targetDate = new Date(endDate);
        if (!isNaN(targetDate.getTime())) {
          targetDate.setHours(0, 0, 0, 0);
          diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) calculatedStatus = '비활동';
        }
      }

      let matchStatus = true;
      if (searchStatus === '활동') matchStatus = calculatedStatus === '활동';
      else if (searchStatus === '비활동') matchStatus = calculatedStatus === '비활동';
      else if (searchStatus === '만료임박') matchStatus = diffDays !== null && diffDays >= 0 && diffDays <= 30;
      // '전체'면 matchStatus = true

      return matchKeyword && matchStatus;
    });
  }, [members, debouncedKeyword, searchStatus, dynamicHeaders]);

  // 실제 화면에 그릴 컬럼 (null이면 기본 3개, 아니면 사용자가 고른 것)
  const activeColumns = visibleColumns ?? dynamicHeaders.slice(0, 3);

  // 컬럼 토글 함수
  const toggleColumn = (header: string) => {
    setVisibleColumns((prev) => {
      const current = prev ?? dynamicHeaders.slice(0, 3);

      // 이미 체크되어 있어서 '해제(끄기)'를 시도하는 경우
      if (current.includes(header)) {
        // 현재 켜진 컬럼이 3개 이하라면 끄지 못하게 막습니다.
        if (current.length <= 3) {
          alert('최소 3개의 컬럼은 표시되어야 합니다.');
          return current; // 변경 없이 기존 상태 그대로 반환
        }
        return current.filter((col) => col !== header);
      }

      // 체크되어 있지 않아서 '추가(켜기)'를 시도하는 경우
      return [...current, header];
    });
  };

  // 정렬 토글 함수
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

  // (페이지네이션 계산 로직은 기존과 완전히 동일하므로 생략하지 않고 유지)
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
    if (confirm(`선택한 ${selectedIds.size}명의 회원을 삭제하시겠습니까?`)) {
      onDeleteMembers(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 페이지당 아이템 수 변경
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
      {/* --- 검색 영역 --- */}
      <div className="flex items-center gap-3 border-b bg-white px-6 py-3">
        <input
          type="text"
          placeholder="통합 검색 (이름, 전화번호 등)"
          value={searchKeyword}
          onChange={(e) => {
            setSearchKeyword(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 w-64 rounded-md border px-3 text-sm"
        />

        <Select
          value={searchStatus === '만료임박' ? '만료임박' : searchStatus}
          onValueChange={(value) => {
            onFilterChange(value as FilterType);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="전체">전체 상태</SelectItem>
            <SelectItem value="활동">활동</SelectItem>
            <SelectItem value="비활동">비활동</SelectItem>
            <SelectItem value="만료임박">만료임박</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchKeyword('');
            onFilterChange('전체');
            setCurrentPage(1);
          }}
        >
          초기화
        </Button>

        {/* 컬럼 설정 드롭다운 */}
        <div className="relative ml-auto">
          <Button variant="outline" size="sm" onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            컬럼 설정
          </Button>

          {isColumnMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
              <div className="mb-2 border-b pb-2 px-2 text-xs font-semibold text-gray-500">표시할 항목 선택</div>
              <div className="flex max-h-60 flex-col overflow-y-auto">
                {dynamicHeaders.map((header) => (
                  <label key={header} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-100">
                    <Checkbox checked={activeColumns.includes(header)} onCheckedChange={() => toggleColumn(header)} />
                    <span className="text-sm text-gray-700">{header}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- 액션 헤더 (삭제 등) --- */}
      <div className="flex items-center justify-between border-b bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
            <span className="text-sm text-gray-600">{selectedIds.size > 0 ? `${selectedIds.size}명 선택됨` : '전체 선택'}</span>
          </div>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
              <Trash2 className="h-4 w-4" /> 선택 삭제
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      {/* --- 동적 테이블 헤더 --- */}
      <div className="flex h-12 items-center border-b bg-gray-50 px-6 font-semibold">
        <div className="w-12"></div> {/* 체크박스용 여백 */}
        {/* 엑셀에서 뽑아낸 컬럼들을 가로로 뿌려줌 */}
        {dynamicHeaders
          .filter((header) => activeColumns.includes(header))
          .map((header) => (
            <div key={header} onClick={() => handleSort(header)} className="flex-1 flex cursor-pointer items-center gap-2 px-2 text-gray-700 hover:text-blue-600 select-none group">
              <span className="truncate">{header}</span>

              {/* 현재 정렬 상태에 따라 화살표 표시 */}
              <div className="flex items-center text-gray-400">
                {sortConfig?.key === header ? sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-600" /> : <ArrowDown className="h-4 w-4 text-blue-600" /> : <ArrowUpDown className="h-4 w-4 opacity-0 group-hover:opacity-50" />}
              </div>
            </div>
          ))}
        <div className="w-32 text-center text-gray-700">상태</div>
        <div className="w-20 text-center text-gray-700">SMS</div>
        <div className="w-20 text-center text-gray-700">삭제</div>
      </div>

      {/* --- 테이블 리스트 --- */}
      <div className="flex-1 overflow-y-auto">
        {members.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p>등록된 회원이 없습니다.</p>
          </div>
        ) : (
          <div>
            {paginatedMembers.map((m) => {
              const isSelected = selectedIds.has(String(m.index));
              return (
                <div key={String(m.index)} className={`group flex h-16 cursor-pointer items-center border-b border-gray-100 px-6 transition-all duration-200 hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                  <div className="flex w-12 items-center">
                    <Checkbox checked={isSelected} onCheckedChange={() => handleSelectOne(String(m.index))} />
                  </div>

                  {/* 동적 컬럼 데이터 렌더링 */}
                  {dynamicHeaders
                    .filter((header) => activeColumns.includes(header))
                    .map((header) => (
                      <div key={header} className="flex-1 truncate px-2 text-sm text-gray-700">
                        {m[header] || '-'}
                      </div>
                    ))}

                  {/* 상태 선택 및 종료일 디데이 뱃지 */}
                  <div className="flex w-32 justify-center">
                    <StatusDisplay status={String(m.status)} endDate={m['종료일'] ? String(m['종료일']) : undefined} />
                  </div>

                  {/* 개별회원에게 SMS 발송을 한다. */}
                  <div className="flex w-20 justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                      onClick={() => {
                        const phoneNumber = String(m['전화번호'] || m.phone || '');
                        if (!phoneNumber) {
                          alert('등록된 전화번호가 없습니다.');
                          return;
                        }

                        // window.location.href = `sms:${phoneNumber}`;
                      }}
                      title="SMS 발송"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 삭제 버튼 */}
                  <div className="flex w-20 justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`해당 회원을 삭제하시겠습니까?`)) onDeleteMembers([String(m.index)]);
                      }}
                      className="transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            전체 {filteredMembers.length}명 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredMembers.length)}명 표시
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // 현재 페이지 주변만 표시
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
    </div>
  );
}

// ----------------------------------------------------
// 상태 및 날짜 표시 컴포넌트
// ----------------------------------------------------
const StatusDisplay = ({ status, endDate }: { status: string; endDate?: string }) => {
  // 1. 엑셀에 '종료일' 컬럼이 아예 없거나 값이 없으면 기본 상태를 표시
  if (!endDate || endDate === '-' || endDate.trim() === '') {
    return <StatusBadge text={status} colorClass={status === '비활동' ? 'from-gray-400 to-gray-500' : 'from-green-500 to-emerald-500'} />;
  }

  // 2. '종료일'이 있을 경우 날짜 계산 로직
  const targetDate = new Date(endDate);
  if (isNaN(targetDate.getTime())) {
    return <StatusBadge text={status} colorClass="from-gray-400 to-gray-500" />;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 디데이 계산

  // 3. 요구사항에 맞춘 자동 상태 분기 (글자와 색상 결정)
  let resultText = '활동';
  let colorClass = '';

  if (daysLeft < 0) {
    resultText = '비활동'; // 오늘 지났으면 비활동
    colorClass = 'from-gray-400 to-gray-500'; // 회색
  } else if (daysLeft <= 7) {
    resultText = '활동';
    colorClass = 'from-red-500 to-red-600'; // 1주일 이하: 빨간색
  } else if (daysLeft <= 30) {
    resultText = '활동';
    colorClass = 'from-blue-500 to-blue-600'; // 한달 이하: 파란색
  } else {
    resultText = '활동';
    colorClass = 'from-green-500 to-emerald-500'; // 한달 이상 여유: 초록색
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <StatusBadge text={resultText} colorClass={colorClass} />
      {/* (선택) 며칠 남았는지 작게 보여주면 관리하기 엄청 편합니다! */}
      {daysLeft >= 0 && <span className="text-[10px] text-gray-400 font-mono">D-{daysLeft}</span>}
    </div>
  );
};
const StatusBadge = ({ text, colorClass }: { text: string; colorClass: string }) => {
  return <Badge className={`border-0 bg-gradient-to-r ${colorClass} text-white hover:${colorClass}`}>{text}</Badge>;
};
