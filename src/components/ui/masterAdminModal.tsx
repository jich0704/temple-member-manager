import { useState, type FormEvent } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { createTempleAccount } from '../../service/firebaseSyncService';
import { Button } from './button';
import { Input } from './input';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MasterAdminModal = ({ isOpen, onClose }: Props) => {
  const [loginId, setLoginId] = useState('');
  const [templeName, setTempleName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedId = loginId.trim();
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(normalizedId)) {
      setMessage({ type: 'error', text: '아이디는 영문, 숫자, 점, 밑줄, 하이픈으로 3~64자여야 합니다.' });
      return;
    }
    if (!templeName.trim()) {
      setMessage({ type: 'error', text: '사찰명을 입력해 주세요.' });
      return;
    }
    if (password.length < 10) {
      setMessage({ type: 'error', text: '초기 비밀번호는 10자 이상이어야 합니다.' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: '비밀번호 확인이 일치하지 않습니다.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const created = await createTempleAccount({ loginId: normalizedId, templeName: templeName.trim(), password });
      setMessage({ type: 'success', text: `${created.templeName} 계정을 만들었습니다. (${created.loginId})` });
      setLoginId('');
      setTempleName('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '사찰 계정을 만들지 못했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="font-bold text-slate-800">마스터 관리자</h2>
              <p className="mt-0.5 text-xs text-slate-500">새 사찰 로그인 계정 만들기</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-4 p-6">
          <p className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-800">
            생성 즉시 사찰 계정은 활성화됩니다. 입력한 초기 비밀번호는 저장하거나 화면에 다시 표시하지 않습니다.
          </p>
          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            <span>사찰명</span>
            <Input value={templeName} onChange={(event) => setTempleName(event.target.value)} disabled={isSubmitting} placeholder="예: 조계사" maxLength={100} />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            <span>로그인 아이디</span>
            <Input value={loginId} onChange={(event) => setLoginId(event.target.value)} disabled={isSubmitting} placeholder="예: jogyesa" autoComplete="off" maxLength={64} />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            <span>초기 비밀번호</span>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} autoComplete="new-password" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            <span>초기 비밀번호 확인</span>
            <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isSubmitting} autoComplete="new-password" />
          </label>
          {message && <p className={`rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>닫기</Button>
          <Button type="submit" className="bg-violet-700 text-white hover:bg-violet-800" disabled={isSubmitting}>
            {isSubmitting ? '계정 만드는 중...' : '사찰 계정 만들기'}
          </Button>
        </div>
      </form>
    </div>
  );
};
