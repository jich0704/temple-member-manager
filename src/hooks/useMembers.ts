import { useCallback, useEffect, useMemo, useState } from 'react';
import { exportToExcel, parseExcel } from '../service/excelService';
import type { Member, Settings } from '../types/member';

/*
 * 멤버 상태, 통계 계산 및 API 통신 (업로드, 삭제 등)
 */
export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>({
    warningDays: 30,
    criticalDays: 14,
    warningColor: 'from-orange-400 to-orange-500',
    criticalColor: 'from-red-500 to-red-600',
    safeColor: 'from-green-500 to-emerald-500',
  });

  // 초기 데이터 및 설정 로드
  useEffect(() => {
    if (window.api?.loadMembers) {
      window.api.loadMembers().then((data) => {
        if (data) setMembers(data);
      });
    }
    if (window.api?.loadSettings) {
      window.api.loadSettings().then((data) => {
        if (data) setSettings(data);
      });
    }
  }, []);

  // 설정 저장 처리
  const handleUpdateSettings = useCallback(async (newSettings: Settings) => {
    setSettings(newSettings);
    if (window.api?.saveSettings) {
      await window.api.saveSettings(newSettings);
    }
  }, []);

  // 엑셀 업로드 처리
  const handleUpload = useCallback(async (file: File, mode: 'append' | 'overwrite' = 'append') => {
    try {
      const parsed = await parseExcel(file);
      await window.api!.addMembers({ data: parsed, mode });

      // 최신 데이터를 다시 불러와서 화면에 반영
      const saved = await window.api!.loadMembers();
      setMembers(saved);
    } catch (error) {
      console.error('엑셀 업로드 실패:', error);
    }
  }, []);

  // 회원 삭제 처리
  const handleDeleteMembers = useCallback(
    async (ids: string[]) => {
      // 백엔드로 보낼 삭제 대상 객체들 추출
      const membersToDelete = members.filter((m) => ids.includes(String(m.index)));

      setMembers((prev) => prev.filter((m) => !ids.includes(String(m.index))));

      try {
        // 백엔드 삭제 요청
        await window.api!.deleteMembers(membersToDelete);
      } catch (error) {
        console.error('삭제 중 에러 발생:', error);
      }
    },
    [members],
  );

  // 통계 계산
  const stats = useMemo(() => {
    const total = members.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts = members.reduce(
      (acc, m) => {
        const lastPaymentMonth = m['최종납부월'];

        if (lastPaymentMonth && lastPaymentMonth !== '-') {
          // 'YYYY-MM' 형태의 문자열 파싱
          const [yearStr, monthStr] = String(lastPaymentMonth).split('-');
          if (yearStr && monthStr) {
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            // 해당 월의 말일을 구함 (다음 달의 0번째 날)
            const targetDate = new Date(year, month, 0);
            targetDate.setHours(23, 59, 59, 999);

            const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
              acc.expired += 1;
            } else if (diffDays <= settings.criticalDays) { // 0 ~ 14일
              acc.twoWeeks += 1;
            } else if (diffDays <= settings.warningDays) { // 15 ~ 30일
              acc.oneMonth += 1;
            }
          }
        }

        return acc;
      },
      { expired: 0, twoWeeks: 0, oneMonth: 0 },
    );

    return { total, expired: counts.expired, twoWeeks: counts.twoWeeks, oneMonth: counts.oneMonth };
  }, [members, settings.warningDays, settings.criticalDays]);


  // 엑셀 내보내기 처리
  const handleExportExcel = useCallback(() => {
    exportToExcel(members);
  }, [members]);

  return {
    members,
    setMembers,
    stats,
    handleUpload,
    handleDeleteMembers,
    handleExportExcel,
    settings,
    handleUpdateSettings,
  };
}
