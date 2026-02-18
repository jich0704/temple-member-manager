import { Button } from '@/components/ui/button';
import { Send, Upload } from 'lucide-react';

interface Props {
  onUpload: (file: File) => void;
  onSend: () => void;
  isSending: boolean;
}

export default function Header({ onUpload, onSend, isSending }: Props) {
  return (
    <div className="flex items-center justify-between mb-6">
      {/* 제목 */}
      <h1 className="text-2xl font-bold tracking-tight">사찰 회원관리 시스템</h1>

      {/* 버튼 영역 */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" asChild>
          <a href="/temple_member_sample.xlsx" download>
            샘플 엑셀 다운로드
          </a>
        </Button>
        {/* 엑셀 업로드 */}
        <label>
          <input
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
          <Button variant="outline" className="gap-2" asChild>
            <span>
              <Upload className="w-4 h-4" />
              엑셀 업로드
            </span>
          </Button>
        </label>

        {/* SMS 발송 */}
        <Button onClick={onSend} disabled={isSending} className="gap-2">
          <Send className="w-4 h-4" />
          {isSending ? '발송중...' : 'SMS 발송'}
        </Button>
      </div>
    </div>
  );
}
