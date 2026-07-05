import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Member, Settings, SmsHistoryItem } from '../types/member';

const ALL_LOCATION = '전체';
const LOCATION_NAME = '위치명';
const RECENT_SMS_DATE = '최근발송일';

const DEFAULT_SETTINGS: Settings = {
  warningDays: 30,
  criticalDays: 14,
  warningColor: 'from-orange-400 to-orange-500',
  criticalColor: 'from-red-500 to-red-600',
  expiredColor: 'from-slate-500 to-slate-600',
  safeColor: 'from-green-500 to-emerald-500',
  memberListFontSize: 14,
  menuFontSize: 14,
};

const formatDate = (dateValue: string) => {
  const d = new Date(dateValue);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useMembers = (
  activeLocation: string = ALL_LOCATION,
  activeFilter: string = '전체',
  page: number = 1,
  limit: number = 50,
  sortKey: string = '인등번호',
  sortDir: 'asc' | 'desc' = 'desc',
  searchQuery: string = ''
) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // 초기값 true → 마운트 직후 "데이터 없음" 깜빡임 방지
  const [isLoading, setIsLoading] = useState(true);
  const [locationStats, setLocationStats] = useState<Record<string, {
    total: number; expired: number; twoWeeks: number; oneMonth: number; active: number
  }>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // ref 관리 → 변경 시 reloadMembers 재생성 방지
  const smsLatestDatesRef = useRef<Map<string, string>>(new Map());
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const isInitialized = useRef(false);       // init 완료 여부
  const suppressEffect = useRef(true);       // init 직후 effect 중복 실행 억제
  const reloadMembersRef = useRef<() => Promise<void>>(async () => {});

  // settings state → ref 동기화
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ─── 회원 데이터 로드 ────────────────────────────────────────────────────
  const reloadMembers = useCallback(async () => {
    if (!window.api?.getMembersPage) return;
    setIsLoading(true);
    try {
      const s = settingsRef.current;
      const pageData = await window.api.getMembersPage({
        page, limit, location: activeLocation,
        statusFilter: activeFilter, search: searchQuery,
        sortKey, sortDir,
        warningDays: s.warningDays, criticalDays: s.criticalDays,
      });
      if (!pageData) return;

      const latestDates = smsLatestDatesRef.current;
      const mappedMembers = pageData.members.map((m: Member) => ({
        ...m,
        [RECENT_SMS_DATE]: m.phone && latestDates.has(m.phone)
          ? formatDate(latestDates.get(m.phone)!)
          : '-',
      }));
      setMembers(mappedMembers);
      setTotalCount(pageData.totalCount);
      setTotalPages(pageData.totalPages);
    } catch (e) {
      console.error('회원 로딩 실패:', e);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, activeLocation, activeFilter, searchQuery, sortKey, sortDir]);

  // reloadMembers ref 항상 최신 유지
  useEffect(() => { reloadMembersRef.current = reloadMembers; }, [reloadMembers]);

  // ─── filter/page/sort 변경 시 재로드 (초기화 + 억제 해제 이후에만) ─────
  useEffect(() => {
    if (!isInitialized.current) return;
    if (suppressEffect.current) {
      suppressEffect.current = false;
      return;
    }
    reloadMembers();
  }, [reloadMembers]);

  // ─── 최초 초기화 (마운트 1회) ────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!window.api) { setIsLoading(false); return; }

      // 1) settings
      let currentSettings = DEFAULT_SETTINGS;
      if (window.api.loadSettings) {
        const data = await window.api.loadSettings();
        if (data && isMounted) {
          currentSettings = { ...DEFAULT_SETTINGS, ...data };
          settingsRef.current = currentSettings;
          setSettings(currentSettings);
        }
      }
      if (!isMounted) return;

      // 2) stats
      const statsData = await window.api.getLocationStats({
        warningDays: currentSettings.warningDays,
        criticalDays: currentSettings.criticalDays,
      });
      if (statsData && isMounted) setLocationStats(statsData);

      // 3) SMS 이력
      if (window.api.getSmsHistory) {
        try {
          const historyData: SmsHistoryItem[] = await window.api.getSmsHistory();
          const latestDates = new Map<string, string>();
          historyData?.forEach(item => {
            if (!item.success) return;
            item.targets.forEach(target => {
              const cur = latestDates.get(target.phone);
              if (!cur || new Date(item.date) > new Date(cur))
                latestDates.set(target.phone, item.date);
            });
          });
          smsLatestDatesRef.current = latestDates;
        } catch { /* ignore */ }
      }

      if (!isMounted) return;

      isInitialized.current = true;

      // Dashboard의 위치 자동 선택(setActiveLocation)이 React 배치 처리된 뒤
      // 최신 reloadMembers(올바른 activeLocation 포함)를 1회만 호출
      setTimeout(() => {
        if (isMounted) {
          suppressEffect.current = false;
          reloadMembersRef.current();
        }
      }, 0);
    };

    init();
    return () => { isMounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── stats + SMS 리프레시 ────────────────────────────────────────────────
  const loadStatsAndHistory = useCallback(async () => {
    if (!window.api) return;
    const s = settingsRef.current;
    const statsData = await window.api.getLocationStats({
      warningDays: s.warningDays, criticalDays: s.criticalDays,
    });
    if (statsData) setLocationStats(statsData);

    if (window.api.getSmsHistory) {
      try {
        const historyData: SmsHistoryItem[] = await window.api.getSmsHistory();
        const latestDates = new Map<string, string>();
        historyData?.forEach(item => {
          if (!item.success) return;
          item.targets.forEach(target => {
            const cur = latestDates.get(target.phone);
            if (!cur || new Date(item.date) > new Date(cur))
              latestDates.set(target.phone, item.date);
          });
        });
        smsLatestDatesRef.current = latestDates;
      } catch { /* ignore */ }
    }
  }, []);

  const handleUpdateSettings = useCallback(async (newSettings: Settings) => {
    settingsRef.current = newSettings;
    setSettings(newSettings);
    if (window.api?.saveSettings) await window.api.saveSettings(newSettings);
  }, []);

  const handleUpload = useCallback(async (file: File, mode: 'append' | 'overwrite' = 'append') => {
    try {
      const { parseExcel } = await import('../service/excelService');
      const parsed = await parseExcel(file);
      await window.api!.addMembers({ data: parsed, mode });
      await loadStatsAndHistory();
      await reloadMembers();
    } catch (error) {
      console.error('엑셀 업로드 실패:', error);
    }
  }, [reloadMembers, loadStatsAndHistory]);

  const handleDeleteMembers = useCallback(async (ids: string[]) => {
    try {
      await window.api!.deleteMembers(ids);
      await loadStatsAndHistory();
      await reloadMembers();
    } catch (error) {
      console.error('회원 삭제 실패:', error);
    }
  }, [reloadMembers, loadStatsAndHistory]);

  const stats = useMemo(() => {
    if (!locationStats) return { total: 0, expired: 0, twoWeeks: 0, oneMonth: 0 };
    const curr = locationStats[activeLocation === ALL_LOCATION ? '전체' : activeLocation]
      || { total: 0, expired: 0, twoWeeks: 0, oneMonth: 0 };
    return { total: curr.total, expired: curr.expired, twoWeeks: curr.twoWeeks, oneMonth: curr.oneMonth };
  }, [locationStats, activeLocation]);

  const handleExportExcel = useCallback(async () => {
    if (!window.api?.getMembersPage) return;
    const { exportToExcel } = await import('../service/excelService');
    const s = settingsRef.current;
    const allData = await window.api.getMembersPage({
      page: 1, limit: 1000000,
      location: activeLocation, statusFilter: activeFilter,
      search: searchQuery, sortKey, sortDir,
      warningDays: s.warningDays, criticalDays: s.criticalDays,
    });
    exportToExcel(allData.members);
  }, [activeLocation, activeFilter, searchQuery, sortKey, sortDir]);

  return {
    members, totalCount, totalPages, isLoading,
    stats, locationStats,
    handleUpload, handleDeleteMembers, handleExportExcel,
    reloadMembers, settings, handleUpdateSettings,
  };
};
