import { useState, useRef, useEffect } from 'react';
import { Send, Users, Smartphone, FileText, Loader2, Image as ImageIcon, X as XIcon } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import type { Member, SendSMSPayload } from '../../types/member';

interface SmsSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: Member[];
  onSend: (message: string, imageBase64?: string) => Promise<void>;
  isSending: boolean;
  onAlert?: (msg: string) => void;
}

// EUC-KR 기준 바이트 계산 (영어/숫자/기호 1바이트, 한글 2바이트)
const getByteLength = (str: string) => {
  let byteLength = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode <= 0x00007F) byteLength += 1;
    else byteLength += 2;
  }
  return byteLength;
};

export function SmsSendModal({ isOpen, onClose, targets, onSend, isSending, onAlert }: SmsSendModalProps) {
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setImageFile(null);
      setImagePreview(null);
      setIsPreviewMode(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const byteLength = getByteLength(message);
  const isLMS = byteLength > 90;
  const maxBytes = 2000;

  const handleMacroClick = (macro: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const newMessage = message.substring(0, start) + macro + message.substring(end);
    
    if (getByteLength(newMessage) > maxBytes) {
      alert('최대 글자 수를 초과할 수 없습니다.');
      return;
    }
    
    setMessage(newMessage);
    
    // 포커스 복귀 및 커서 이동
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + macro.length, start + macro.length);
    }, 0);
  };

  const handlePreviewClick = () => {
    if (!message.trim()) {
      if (onAlert) onAlert('메시지 내용을 입력해주세요.');
      else alert('메시지 내용을 입력해주세요.');
      return;
    }
    if (byteLength > maxBytes) {
      if (onAlert) onAlert('메시지가 너무 깁니다. (최대 2000바이트)');
      else alert('메시지가 너무 깁니다. (최대 2000바이트)');
      return;
    }
    setIsPreviewMode(true);
  };

  const handleSendClick = async () => {
    let base64Data: string | undefined = undefined;
    if (imageFile) {
      try {
        base64Data = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas not supported'));
              return;
            }
            // 투명 배경이 검정색으로 변하는 것을 방지하기 위해 흰색 배경 채우기
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // 항상 image/jpeg 로 강제 변환 (품질 0.9)
            let dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            let base64 = dataUrl.split(',')[1];

            // 변환된 용량이 300KB를 넘으면 화질을 낮춰서 다시 변환
            if (base64.length * 0.75 > 300 * 1024) {
              dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              base64 = dataUrl.split(',')[1];
            }
            
            resolve(base64);
          };
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = URL.createObjectURL(imageFile);
        });
      } catch (error) {
        if (onAlert) onAlert('이미지 파일 변환에 실패했습니다. 유효한 이미지인지 확인해주세요.');
        else alert('이미지 파일 변환에 실패했습니다.');
        return;
      }
    }
    onSend(message, base64Data);
  };

  // 미리보기용 메시지 생성 (첫 번째 타겟 기준)
  const getPreviewText = () => {
    if (!targets || targets.length === 0) return message;
    let text = message;
    const sample = targets[0];
    Object.keys(sample).forEach((key) => {
      const regex = new RegExp(`{${key}}`, 'g');
      text = text.replace(regex, String(sample[key as keyof Member] || ''));
    });
    return text;
  };

  // 실제 엑셀 데이터(targets)에서 사용 가능한 항목 추출
  const availableMacros = targets.length > 0 
    ? Object.keys(targets[0])
        .filter(k => k !== 'index' && k !== 'status' && k !== 'name' && k !== 'phone')
        .map(k => `{${k}}`)
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">문자 발송</h2>
              <p className="text-sm text-gray-500">작성한 내용을 발송합니다.</p>
            </div>
          </div>
          <div className="bg-white border rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">총 {targets.length}명</span>
          </div>
        </div>

        {/* Content */}
        {!isPreviewMode ? (
          <div className="p-6 flex flex-col gap-6">
            
            {/* 매크로 변수 섹션 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                변수 넣기 <span className="text-xs font-normal text-gray-400">(클릭 시 삽입됩니다)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableMacros.length > 0 ? availableMacros.map((macro) => (
                  <Badge 
                    key={macro} 
                    variant="outline" 
                    className="cursor-pointer text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 transition-colors bg-blue-50/50 font-medium"
                    onClick={() => {
                      if (typeof handleMacroClick === 'function') handleMacroClick(macro);
                      else setMessage(prev => prev + macro);
                    }}
                  >
                    {macro}
                  </Badge>
                )) : (
                  <span className="text-xs text-slate-400 mt-1">엑셀 파일에 사용 가능한 변수가 없습니다.</span>
                )}
              </div>
            </div>

            {/* 텍스트 에어리어 섹션 */}
            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">메시지 내용</label>
                <div className="flex items-center gap-2">
                  {isLMS || imageFile ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
                      <FileText className="w-3 h-3 mr-1" /> {imageFile ? 'MMS (이미지)' : 'LMS (장문)'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                      <Smartphone className="w-3 h-3 mr-1" /> SMS (단문)
                    </Badge>
                  )}
                  <span className={`text-xs font-mono font-medium ${byteLength > maxBytes ? 'text-red-500' : 'text-gray-500'}`}>
                    {byteLength} / {maxBytes} byte
                  </span>
                </div>
              </div>
              
              <div className="w-full flex-1 min-h-[160px] border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all bg-white flex flex-col">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => {
                    if (getByteLength(e.target.value) <= maxBytes) {
                      setMessage(e.target.value);
                    }
                  }}
                  placeholder="여기에 문자를 입력하세요... (예: 안녕하세요 {대주}님!)"
                  className="w-full flex-1 p-4 outline-none resize-none text-sm leading-relaxed"
                />
              </div>

              {/* 이미지 별도 첨부칸 */}
              <div className="flex flex-col gap-2 mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex flex-col items-start gap-2">
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-sm rounded-lg transition-colors border border-slate-200 font-medium shadow-sm whitespace-nowrap">
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    이미지 업로드
                    <input 
                      type="file" 
                      accept="image/jpeg, image/jpg" 
                      hidden 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // 용량 체크 완화: 캔버스 압축이 있으므로 10MB 이하만 통과
                          if (file.size > 10 * 1024 * 1024) {
                            if (onAlert) onAlert('이미지 용량이 너무 큽니다. (최대 10MB)');
                            else alert('이미지 용량이 너무 큽니다. (최대 10MB)');
                            return;
                          }
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                        e.target.value = '';
                      }} 
                    />
                  </label>
                  {!imagePreview && (
                    <span className="text-[11px] text-red-500/80 font-medium whitespace-nowrap">
                      ※ 이미지는 300KB 이하의 JPG 파일 1개만 첨부 가능 (첨부 시 MMS로 자동 전환)
                    </span>
                  )}
                </div>
                
                {imagePreview && (
                  <div className="mt-2 relative inline-block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm self-start">
                    <img src={imagePreview} alt="첨부 미리보기" className="h-28 w-auto object-contain" />
                    <button 
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }} 
                      className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white rounded-full p-1 transition-colors"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          /* Preview Mode UI */
          <div className="p-6 flex flex-col items-center bg-slate-50 gap-4">
            <h3 className="text-sm font-bold text-slate-700 mb-2">실제 발송 화면 미리보기 (예시)</h3>
            <div className="w-[300px] h-[500px] bg-white rounded-[2rem] shadow-xl border-8 border-slate-800 overflow-hidden flex flex-col relative">
              <div className="h-14 bg-slate-100 flex items-center justify-center border-b border-slate-200">
                <span className="font-medium text-slate-700">{targets[0]?.['대주'] || targets[0]?.['이름'] || '수신자'}님</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar flex flex-col gap-3">
                <div className="text-xs text-center text-slate-400 mb-2">오늘</div>
                <div className="bg-blue-500 text-white p-3.5 rounded-2xl rounded-tr-sm self-end max-w-[90%] shadow-sm text-sm whitespace-pre-wrap break-all relative">
                  {imagePreview && (
                    <img src={imagePreview} alt="발송이미지" className="w-full rounded-xl mb-3 object-cover" />
                  )}
                  {getPreviewText()}
                </div>
              </div>
              <div className="h-12 bg-slate-100 border-t border-slate-200" />
            </div>
            <p className="text-xs text-slate-500 text-center mt-2">
              ※ 내용 중 매크로 부분은 실제 수신자의 데이터로 각각 치환되어 발송됩니다.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          {!isPreviewMode ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isSending}>
                취소
              </Button>
              <Button 
                onClick={handlePreviewClick} 
                disabled={!message.trim() || targets.length === 0} 
                className="bg-slate-800 hover:bg-slate-900 w-36 gap-2"
              >
                발송 전 미리보기
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsPreviewMode(false)} disabled={isSending}>
                이전으로
              </Button>
              <Button 
                onClick={handleSendClick} 
                disabled={isSending} 
                className="bg-blue-600 hover:bg-blue-700 w-36 gap-2"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSending ? '발송 중...' : '최종 발송하기'}
              </Button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
