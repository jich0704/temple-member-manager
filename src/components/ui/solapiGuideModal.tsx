import { X, ExternalLink, HelpCircle } from 'lucide-react';
import { Button } from './button';

interface SolapiGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SolapiGuideModal({ isOpen, onClose }: SolapiGuideModalProps) {
  if (!isOpen) return null;

  const handleOpenLink = (url: string) => {
    if (window.api && window.api.openExternal) {
      window.api.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">솔라피(SOLAPI) 연동 가이드</h2>
              <p className="text-sm text-slate-500">안정적인 문자 발송을 위한 계정 설정 안내</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200">
            <X className="w-5 h-5 text-slate-500" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 bg-white custom-scrollbar">
          
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">1</div>
              <div className="w-0.5 bg-blue-100 h-full mt-2"></div>
            </div>
            <div className="pb-6">
              <h3 className="text-lg font-bold text-slate-800 mb-2">솔라피 회원가입</h3>
              <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                먼저 솔라피 홈페이지에 접속하여 회원가입 및 로그인을 진행해 주세요.<br/>
                가입 후 약간의 무료 충전금이 지급되어 테스트해 볼 수 있습니다.
              </p>
              <Button variant="outline" size="sm" onClick={() => handleOpenLink('https://solapi.com/')} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                솔라피 홈페이지 열기 <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">2</div>
              <div className="w-0.5 bg-blue-100 h-full mt-2"></div>
            </div>
            <div className="pb-6 w-full">
              <h3 className="text-lg font-bold text-slate-800 mb-2">발신번호 등록 (필수)</h3>
              <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                전기통신사업법에 따라 <strong>사전에 인증된 발신번호</strong>로만 문자를 보낼 수 있습니다.<br/>
                솔라피 대시보드 좌측 메뉴에서 <strong>[발신번호 관리]</strong>로 들어가 번호를 인증해 주세요.
              </p>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-sm text-slate-700">
                💡 여기에 등록한 번호를 이 프로그램의 <strong>'발신 번호'</strong> 칸에 똑같이 적어주셔야 합니다.
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">3</div>
            </div>
            <div className="w-full">
              <h3 className="text-lg font-bold text-slate-800 mb-2">API Key 발급</h3>
              <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                프로그램이 솔라피와 통신하기 위한 열쇠가 필요합니다.<br/>
                솔라피 <strong>[개발자 센터] &gt; [API 관리]</strong> 메뉴에서 새 API 키를 생성합니다.
              </p>
              <div className="bg-slate-800 rounded-lg p-4 text-slate-200 text-sm flex flex-col gap-2 shadow-inner">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <span className="font-semibold text-slate-400">API Key</span>
                  <span className="font-mono text-emerald-400">NCS*************</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-semibold text-slate-400">API Secret</span>
                  <span className="font-mono text-emerald-400">ABCD1234EFGH5678IJKL9012MNOP3456</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-3">
                생성된 두 개의 키를 복사하여 프로그램 설정 창에 붙여넣고 [연동 및 저장]을 누르면 끝입니다!
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 w-24">
            확인
          </Button>
        </div>

      </div>
    </div>
  );
}
