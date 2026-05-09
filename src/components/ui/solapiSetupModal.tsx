import { ExternalLink, Loader2, ShieldAlert, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSMS } from '../../hooks/useSms';
import type { Settings } from '../../types/member';
import { Button } from './button';
import { Input } from './input';
import { SolapiGuideModal } from './solapiGuideModal';

interface SolapiSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
  onSuccess?: () => void;
}

export function SolapiSetupModal({ isOpen, onClose, settings, onSaveSettings, onSuccess }: SolapiSetupModalProps) {
  const [apiKey, setApiKey] = useState(settings.solapiApiKey || '');
  const [apiSecret, setApiSecret] = useState(settings.solapiApiSecret || '');
  const [senderNumber, setSenderNumber] = useState(settings.solapiSenderNumber || '');
  
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
  const { checkSolapiBalance } = useSMS();

  useEffect(() => {
    if (isOpen) {
      setApiKey(settings.solapiApiKey || '');
      setApiSecret(settings.solapiApiSecret || '');
      setSenderNumber(settings.solapiSenderNumber || '');
      setErrorMsg('');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleOpenSolapi = () => {
    window.api.openExternal('https://solapi.com/');
  };

  const handleSave = async () => {
    if (!apiKey.trim() || !apiSecret.trim() || !senderNumber.trim()) {
      setErrorMsg('모든 항목을 입력해주세요.');
      return;
    }

    setIsChecking(true);
    setErrorMsg('');

    // 실제 API 연동 검증 (잔액 조회 테스트)
    const result = await checkSolapiBalance(apiKey.trim(), apiSecret.trim());
    setIsChecking(false);

    if (result.success) {
      onSaveSettings({
        ...settings,
        solapiApiKey: apiKey.trim(),
        solapiApiSecret: apiSecret.trim(),
        solapiSenderNumber: senderNumber.trim()
      });
      if (onSuccess) onSuccess();
      onClose();
    } else {
      setErrorMsg(result.error || 'API 키 혹은 시크릿 키가 올바르지 않습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3 bg-slate-50">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">문자 서비스 연동</h2>
            <p className="text-sm text-gray-500">안전한 발송을 위해 API 키 연동이 필요합니다.</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          <div className="bg-blue-50/50 rounded-lg p-4 text-sm text-blue-800 leading-relaxed border border-blue-100 flex flex-col gap-3">
            <div className="break-keep">
              <strong>솔라피(SOLAPI)</strong> 계정 연동이 필요합니다.<br/>
              처음이시라면 아래의 가이드를 확인해 주세요.
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 w-full"
              onClick={() => setIsGuideOpen(true)}
            >
              <HelpCircle className="w-4 h-4 mr-1.5" /> 연동 가이드 보기
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">API Key</label>
              <Input 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                placeholder="NCS..." 
                className="bg-gray-50 font-mono text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">API Secret Key</label>
              <Input 
                value={apiSecret} 
                onChange={e => setApiSecret(e.target.value)} 
                type="password"
                placeholder="입력해주세요" 
                className="bg-gray-50 font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">발신 번호</label>
              <Input 
                value={senderNumber} 
                onChange={e => setSenderNumber(e.target.value)} 
                placeholder="010-0000-0000 (솔라피에 등록된 번호)" 
                className="bg-gray-50"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-sm text-red-500 font-medium">{errorMsg}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isChecking}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isChecking} className="bg-blue-600 hover:bg-blue-700 w-28">
            {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : '연동 및 저장'}
          </Button>
        </div>

      </div>
      
      <SolapiGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
