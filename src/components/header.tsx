import { Download, Send, Upload } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  onUpload: (file: File) => void;
  onSend: () => void;
  isSending: boolean;
}

export default function Header({ onUpload, onSend, isSending }: Props) {
  return (
    <div className="flex items-center justify-between">
      {/* 제목 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">사찰 회원관리 시스템</h1>
      </div>

      {/* 버튼 영역 */}
      <div className="flex items-center gap-3">
        <Button variant="outline" className="gap-2" asChild>
          <a href="/temple_member_sample.xlsx" download>
            <Download className="w-4 h-4" />
            샘플 다운로드
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
          <Button variant="outline" className="gap-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300" asChild>
            <span>
              <Upload className="w-4 h-4 text-blue-600" />
              엑셀 업로드
            </span>
          </Button>
        </label>

        {/* SMS 발송 */}
        <Button onClick={onSend} disabled={isSending} className="gap-2 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black">
          <Send className="w-4 h-4" />
          {isSending ? '발송중...' : 'SMS 발송'}
        </Button>
      </div>
    </div>
  );
}
