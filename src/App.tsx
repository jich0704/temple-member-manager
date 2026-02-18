import { Card } from '@/components/ui/card';
import { useEffect } from 'react';
import Header from './components/header';
import MemberTable from './components/memberTable';
import { useMembers } from './hooks/useMembers';
import { useSMS } from './hooks/useSms';
import { parseExcel } from './service/excelService';

function App() {
  const { members, setMembers } = useMembers();
  const { sendSMS, isSending } = useSMS();

  useEffect(() => {
    const load = async () => {
      const saved = await window.api.loadMembers();
      setMembers(saved);
    };

    load();
  }, []);

  const handleUpload = async (file: File) => {
    const parsed = await parseExcel(file);
    setMembers(parsed);

    await window.api.saveMembers(parsed);
  };

  const handleSend = () => {
    sendSMS(members, '테스트 메시지');
  };

  return (
    <div className="h-screen bg-muted/30 flex flex-col">
      {/* 상단 영역 */}
      <div className="px-10 pt-8 pb-4">
        <Header onUpload={handleUpload} onSend={handleSend} isSending={isSending} />
      </div>

      {/* 테이블 영역 */}
      <div className="flex-1 px-10 pb-10 min-h-0">
        <Card className="h-full">
          <div className="h-full p-6">
            <MemberTable members={members} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default App;
