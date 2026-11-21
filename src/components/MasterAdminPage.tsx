import { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import type { TempleAccount } from '../service/firebaseSyncService';
import { Button } from './ui/button';
import { MasterAdminModal } from './ui/masterAdminModal';

interface Props {
  account: TempleAccount;
  onLogout: () => void;
}

export const MasterAdminPage = ({ account, onLogout }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2 text-violet-700"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-400">TEMPLE MEMBER MANAGER</p>
            <h1 className="font-bold text-slate-900">마스터 관리자</h1>
          </div>
        </div>
        <Button variant="ghost" className="gap-1 text-slate-500 hover:text-red-600" onClick={onLogout}>
          <LogOut className="h-4 w-4" /> 로그아웃
        </Button>
      </header>
      <main className="mx-auto mt-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">로그인 계정: {account.loginId}</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">사찰 계정 관리</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">새 사찰의 Firebase 로그인 계정과 승인 프로필을 함께 만들 수 있습니다. 사찰별 회원 데이터에는 접근하지 않습니다.</p>
        <Button className="mt-6 bg-violet-700 text-white hover:bg-violet-800" onClick={() => setIsModalOpen(true)}>
          사찰 계정 만들기
        </Button>
      </main>
      <MasterAdminModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
