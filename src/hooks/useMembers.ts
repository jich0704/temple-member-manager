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
    criticalDays: 7,
    warningColor: 'from-blue-500 to-blue-600',
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
  const handleUpload = useCallback(async (file: File) => {
    try {
      const parsed = await parseExcel(file);
      await window.api!.addMembers(parsed);

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

    const { active, inactive, expiringSoon } = members.reduce(
      (acc, m) => {
        const endDateValue = m['종료일'];
        let isActive = true;

        if (endDateValue) {
          const targetDate = new Date(String(endDateValue));
          if (!isNaN(targetDate.getTime())) {
            targetDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
              isActive = false;
            } else if (diffDays <= settings.warningDays) {
              // 활동 중이면서 설정된 경고일 이내 만료 예정
              acc.expiringSoon += 1;
            }
          }
        }

        if (isActive) {
          acc.active += 1;
        } else {
          acc.inactive += 1;
        }

        return acc;
      },
      { active: 0, inactive: 0, expiringSoon: 0 },
    );

    return { total, active, inactive, expiringSoon };
  }, [members, settings.warningDays]);


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
