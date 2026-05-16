import { useCallback, useEffect, useMemo, useState } from 'react';
import { exportToExcel, parseExcel } from '../service/excelService';
import type { Member, Settings, SmsHistoryItem } from '../types/member';

/*
 * 멤버 상태, 통계 계산 및 API 통신 (업로드, 삭제 등)
 */
export function useMembers(activeLocation: string = '전체') {
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
    const loadData = async () => {
      if (window.api?.loadSettings) {
        const data = await window.api.loadSettings();
        if (data) setSettings(data);
      }

      if (window.api?.loadMembers) {
        const membersData = await window.api.loadMembers();
        if (membersData) {
          let latestDates = new Map<string, string>();
          if (window.api?.getSmsHistory) {
            try {
              const historyData: SmsHistoryItem[] = await window.api.getSmsHistory();
              if (historyData && historyData.length > 0) {
                historyData.forEach((item) => {
                  if (item.success) {
                    item.targets.forEach((t) => {
                      const currentLatest = latestDates.get(t.phone);
                      if (!currentLatest || new Date(item.date) > new Date(currentLatest)) {
                        latestDates.set(t.phone, item.date);
                      }
                    });
                  }
                });
              }
            } catch (error) {
              console.error('SMS 이력 로드 실패:', error);
            }
          }

          const mappedMembers = membersData.map((m: Member) => {
            let formattedDate = '';
            if (m.phone && latestDates.has(m.phone)) {
              const rawDate = new Date(latestDates.get(m.phone)!);
              formattedDate = `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`;
            }
            return { ...m, '최근발송일': formattedDate || '-' };
          });
          
          setMembers(mappedMembers);
        }
      }
    };
    
    loadData();
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

  // 위치명으로 필터링된 멤버
  const locationFilteredMembers = useMemo(() => {
    if (activeLocation === '전체') return members;
    return members.filter(m => String(m['위치명'] || '미지정').trim() === activeLocation);
  }, [members, activeLocation]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = locationFilteredMembers.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts = locationFilteredMembers.reduce(
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
  }, [locationFilteredMembers, settings.warningDays, settings.criticalDays]);


  // 엑셀 내보내기 처리
  const handleExportExcel = useCallback(() => {
    exportToExcel(members);
  }, [members]);

  // 모든 지점별 통계 일괄 계산
  const locationStats = useMemo(() => {
    const statsMap: Record<string, { total: number; expired: number; twoWeeks: number; oneMonth: number; active: number }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    statsMap['전체'] = { total: 0, expired: 0, twoWeeks: 0, oneMonth: 0, active: 0 };

    members.forEach((m) => {
      const loc = String(m['위치명'] || '미지정').trim();
      if (!statsMap[loc]) {
        statsMap[loc] = { total: 0, expired: 0, twoWeeks: 0, oneMonth: 0, active: 0 };
      }

      const lastPaymentMonth = m['최종납부월'];
      let targetDate: Date | null = null;
      let diffDays = 0;

      if (lastPaymentMonth && lastPaymentMonth !== '-') {
        const [yearStr, monthStr] = String(lastPaymentMonth).split('-');
        if (yearStr && monthStr) {
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);
          targetDate = new Date(year, month, 0);
          targetDate.setHours(23, 59, 59, 999);
          diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const updateStats = (target: { total: number; expired: number; twoWeeks: number; oneMonth: number; active: number }) => {
        target.total += 1;
        if (!targetDate) {
          target.active += 1;
        } else if (diffDays < 0) {
          target.expired += 1;
        } else if (diffDays <= settings.criticalDays) {
          target.twoWeeks += 1;
          target.active += 1; // 2주전도 일단 활동중
        } else if (diffDays <= settings.warningDays) {
          target.oneMonth += 1;
          target.active += 1; // 1달전도 활동중
        } else {
          target.active += 1;
        }
      };

      updateStats(statsMap[loc]);
      updateStats(statsMap['전체']);
    });

    return statsMap;
  }, [members, settings.warningDays, settings.criticalDays]);

  return {
    members,
    setMembers,
    stats,
    locationStats,
    handleUpload,
    handleDeleteMembers,
    handleExportExcel,
    settings,
    handleUpdateSettings,
  };
}
