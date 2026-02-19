import { useDebounce } from '@/hooks/useDebounce';
import { ChevronLeft, ChevronRight, Phone, Trash2, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Member, MemberStatus } from '../types/member';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Props {
  members: Member[];
  onDeleteMembers: (ids: string[]) => void;
  onUpdateMemberStatus: (id: string, status: MemberStatus) => void;
}

export default function MemberTable({ members, onDeleteMembers, onUpdateMemberStatus }: Props) {
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchStatus, setSearchStatus] = useState<MemberStatus | '전체'>('전체');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const debouncedName = useDebounce(searchName, 300);
  const debouncedPhone = useDebounce(searchPhone, 300);

  const normalizePhone = (phone: string) => phone.replace(/-/g, '');

  const normalizeText = (text: string) => text.toLowerCase();

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchName = normalizeText(m.name).includes(normalizeText(debouncedName));

      const matchPhone = normalizePhone(m.phone).includes(normalizePhone(debouncedPhone));

      const matchStatus = searchStatus === '전체' ? true : m.status === searchStatus;

      return matchName && matchPhone && matchStatus;
    });
  }, [members, debouncedName, debouncedPhone, searchStatus]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, currentPage, itemsPerPage]);

  // 전체 선택 체크
  const isAllSelected = paginatedMembers.length > 0 && paginatedMembers.every((m) => selectedIds.has(String(m.index)));
  //const isSomeSelected = paginatedMembers.some((m) => selectedIds.has(String(m.index)));

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (isAllSelected) {
      // 현재 페이지의 모든 항목 선택 해제
      const newSelected = new Set(selectedIds);
      paginatedMembers.forEach((m) => newSelected.delete(String(m.index)));
      setSelectedIds(newSelected);
    } else {
      // 현재 페이지의 모든 항목 선택
      const newSelected = new Set(selectedIds);
      paginatedMembers.forEach((m) => newSelected.add(String(m.index)));
      setSelectedIds(newSelected);
    }
  };

  // 개별 선택/해제
  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 선택 삭제
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
    <div className="h-full w-full rounded-xl border border-gray-200 bg-white shadow-lg flex flex-col overflow-hidden">
      {/* 검색 영역 */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-white">
        <input
          type="text"
          placeholder="이름 검색"
          value={searchName}
          onChange={(e) => {
            setSearchName(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 px-3 border rounded-md text-sm"
        />

        <input
          type="text"
          placeholder="전화번호 검색"
          value={searchPhone}
          onChange={(e) => {
            setSearchPhone(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 px-3 border rounded-md text-sm"
        />

        <Select
          value={searchStatus}
          onValueChange={(value) => {
            setSearchStatus(value as MemberStatus | '전체');
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="전체">전체</SelectItem>
            <SelectItem value="활동">활동</SelectItem>
            <SelectItem value="비활동">비활동</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchName('');
            setSearchPhone('');
            setSearchStatus('전체');
            setCurrentPage(1);
          }}
        >
          초기화
        </Button>
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="전체 선택" />
            <span className="text-sm text-gray-600">{selectedIds.size > 0 ? `${selectedIds.size}명 선택됨` : '전체 선택'}</span>
          </div>

          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
              <Trash2 className="w-4 h-4" />
              선택 삭제
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

      {/* 테이블 헤더 */}
      <div className="flex items-center font-semibold px-6 h-12 border-b bg-gray-50">
        <div className="w-12"></div>
        <div className="flex-1 flex items-center gap-2 text-gray-700">
          <User className="w-4 h-4" />
          <span>이름</span>
        </div>
        <div className="flex-1 flex items-center gap-2 text-gray-700">
          <Phone className="w-4 h-4" />
          <span>전화번호</span>
        </div>
        <div className="w-32 text-center text-gray-700">상태</div>
        <div className="w-24 text-center text-gray-700">작업</div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <User className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">등록된 회원이 없습니다</p>
            <p className="text-xs mt-1">엑셀 파일을 업로드하여 회원을 추가하세요</p>
          </div>
        ) : paginatedMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">이 페이지에 표시할 회원이 없습니다</p>
          </div>
        ) : (
          <div>
            {paginatedMembers.map((m, index) => {
              const isEven = index % 2 === 0;
              const isSelected = selectedIds.has(String(m.index));

              return (
                <div key={String(m.index)} className={`flex items-center px-6 h-16 border-b border-gray-100 transition-all duration-200 hover:bg-blue-50 cursor-pointer group ${isSelected ? 'bg-blue-50' : isEven ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <div className="w-12 flex items-center">
                    <Checkbox checked={isSelected} onCheckedChange={() => handleSelectOne(String(m.index))} />
                  </div>

                  <div className="flex-1 font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{m.name}</div>

                  <div className="flex-1 text-gray-600 font-mono text-sm">{m.phone}</div>

                  <div className="w-32 flex justify-center">
                    <StatusSelect status={m.status} onChange={(newStatus) => onUpdateMemberStatus(String(m.index), newStatus as MemberStatus)} />
                  </div>

                  <div className="w-24 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`${m.name}님을 삭제하시겠습니까?`)) {
                          onDeleteMembers([String(m.index)]);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
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

// 상태 선택 컴포넌트
const StatusSelect = ({ status, onChange }: { status: string; onChange: (status: string) => void }) => {
  return (
    <Select value={status} onValueChange={onChange}>
      <SelectTrigger className="w-25 h-7 border-0 bg-transparent">
        <SelectValue>
          <StatusBadge status={status} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="활동">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            활동
          </div>
        </SelectItem>
        <SelectItem value="비활동">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            비활동
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === '활동') {
    return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-0">활동</Badge>;
  }

  if (status === '비활동') {
    return <Badge className="bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 border-0">비활동</Badge>;
  }

  return <Badge variant="outline">{status}</Badge>;
};
