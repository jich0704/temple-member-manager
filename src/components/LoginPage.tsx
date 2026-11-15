import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { loginTempleAccount, type TempleAccount } from '../service/firebaseSyncService';

interface LoginPageProps {
  onLoginSuccess: (account: TempleAccount) => void;
  errorMessage?: string;
}

export const LoginPage = ({ onLoginSuccess, errorMessage: initialErrorMessage }: LoginPageProps) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage || '');
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    window.api?.getAppVersion?.().then((v) => {
      if (v) setAppVersion(v);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setErrorMessage(initialErrorMessage || '');
  }, [initialErrorMessage]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const result = await loginTempleAccount(loginId, password, rememberMe);
      if (result.ok && result.account) {
        onLoginSuccess(result.account);
      } else {
        setErrorMessage(result.error || '로그인에 실패했습니다.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-[380px] bg-white rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-8 py-10">
        {/* 타이틀 영역 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              TEMPLE MEMBER MANAGER
            </p>
            <span className="text-[11px] font-medium text-slate-400">
              v{appVersion}
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">
            신도 관리 시스템
          </h1>
        </div>

        {/* 폼 영역 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700 block">
              아이디
            </label>
            <Input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="사찰 아이디를 입력하세요"
              className="h-10 text-sm rounded-lg border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700 block">
              비밀번호
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="pr-9 h-10 text-sm rounded-lg border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs font-medium text-red-600 pt-0.5">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center pt-1 pb-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-[13px] text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <span>로그인 상태 유지</span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '로그인'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

