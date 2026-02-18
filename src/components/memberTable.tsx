import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
import type { Member } from '../types/member';

interface Props {
  members: Member[];
}

export default function MemberTable({ members }: Props) {
  return (
    <div className="h-full w-full border rounded-lg bg-white shadow-sm flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center font-semibold px-4 h-12 border-b bg-muted/40">
        <div className="w-12">
          <Checkbox />
        </div>
        <div className="flex-1">이름</div>
        <div className="flex-1">전화번호</div>
        <div className="w-24 text-center">상태</div>
      </div>

      {/* 리스트 */}
      <div className="flex-1">
        <AutoSizer>
          {({ height, width }) => (
            <List height={height} width={width} itemCount={members.length} itemSize={56}>
              {({ index, style }) => {
                const m = members[index];

                return (
                  <div style={style} className="flex items-center px-4 border-b hover:bg-muted/30 transition-colors">
                    <div className="w-12">
                      <Checkbox />
                    </div>

                    <div className="flex-1 font-medium">{m.name}</div>

                    <div className="flex-1 text-muted-foreground">{m.phone}</div>

                    <div className="w-24 text-center">
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                );
              }}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

const StatusBadge = ({ status }: { status: string }) => {
  if (status === '활동') {
    return <Badge>활동</Badge>;
  }

  if (status === '비활동') {
    return <Badge variant="secondary">비활동</Badge>;
  }

  return <Badge variant="outline">{status}</Badge>;
};
