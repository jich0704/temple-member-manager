import { Phone, User } from 'lucide-react';
import type { Member } from '../types/member';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';

interface Props {
  members: Member[];
}

export default function MemberTable({ members }: Props) {
  return (
    <div className="h-full w-full rounded-xl border border-gray-200 bg-white shadow-lg flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center font-semibold px-6 h-14 border-b bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="w-12 flex items-center">
          <Checkbox />
        </div>
        <div className="flex-1 flex items-center gap-2 text-gray-700">
          <User className="w-4 h-4" />
          <span>이름</span>
        </div>
        <div className="flex-1 flex items-center gap-2 text-gray-700">
          <Phone className="w-4 h-4" />
          <span>전화번호</span>
        </div>
        <div className="w-32 text-center text-gray-700">상태</div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <User className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">등록된 회원이 없습니다</p>
            <p className="text-xs mt-1">엑셀 파일을 업로드하여 회원을 추가하세요</p>
          </div>
        ) : (
          <div>
            {members.map((m, index) => {
              const isEven = index % 2 === 0;

              return (
                <div key={m.phone} className={`flex items-center px-6 h-16 border-b border-gray-100 transition-all duration-200 hover:bg-blue-50 hover:shadow-md cursor-pointer group ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <div className="w-12 flex items-center">
                    <Checkbox />
                  </div>

                  <div className="flex-1 font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{m.name}</div>

                  <div className="flex-1 text-gray-600 font-mono text-sm">{m.phone}</div>

                  <div className="w-32 flex justify-center">
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const StatusBadge = ({ status }: { status: string }) => {
  if (status === '활동') {
    return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-0">활동</Badge>;
  }

  if (status === '비활동') {
    return <Badge className="bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 border-0">비활동</Badge>;
  }

  return <Badge variant="outline">{status}</Badge>;
};
