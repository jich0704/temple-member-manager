import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Member, Settings, SmsHistoryItem } from '../types/member';

const ALL_LOCATION = '전체';
const LOCATION_NAME = '위치명';
const RECENT_SMS_DATE = '최근발송일';

type RefreshOptions = {
  clear?: boolean;
};

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

const normalizePhone = (value: unknown) => String(value || '').replace(/[^0-9]/g, '');
const getMemberPhone = (member: Member) =>
  normalizePhone(member.phone || member['휴대폰'] || member['전화번호'] || member['연락처']);

const getLatestSmsDates = (historyData: SmsHistoryItem[]) => {
  const latestDates = new Map<string, string>();
  historyData?.forEach((item) => {
    const deliveryStatus = item.deliveryStatus || (item.success ? 'success' : 'failed');
    if (deliveryStatus === 'failed') return;

    const failedPhones = new Set(
      (item.failedTargets || []).map((target) => normalizePhone(target.phone)),
    );
    item.targets.forEach((target) => {
      const phone = normalizePhone(target.phone);
      if (!phone || failedPhones.has(phone)) return;
      const cur = latestDates.get(phone);
      if (!cur || new Date(item.date) > new Date(cur)) latestDates.set(phone, item.date);
    });
  });
  return latestDates;
};

export const useMembers = (
  activeLocation: string = ALL_LOCATION,
  activeFilter: string = '전체',
  page: number = 1,
  limit: number = 50,
  sortKey: string = '신도번호',
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
  // 최신 요청만 화면 상태를 바꾸도록 보장한다. 대용량 목록 조회가 겹쳐도
  // 먼저 시작된 요청의 오래된 응답이 최신 목록을 덮어쓰지 않는다.
  const memberRequestIdRef = useRef(0);
  const statsRequestIdRef = useRef(0);

  // settings state → ref 동기화
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ─── 회원 데이터 로드 ────────────────────────────────────────────────────
  const reloadMembers = useCallback(async () => {
    if (!window.api?.getMembersPage) {
      setIsLoading(false);
      return;
    }
    const requestId = ++memberRequestIdRef.current;
    setIsLoading(true);
    try {
      const s = settingsRef.current;
      const pageData = await window.api.getMembersPage({
        page, limit, location: activeLocation,
        statusFilter: activeFilter, search: searchQuery,
        sortKey, sortDir,
        warningDays: s.warningDays, criticalDays: s.criticalDays,
      });
      if (!pageData || requestId !== memberRequestIdRef.current) return;

      const latestDates = smsLatestDatesRef.current;
      const mappedMembers = pageData.members.map((m: Member) => {
        const phone = getMemberPhone(m);
        return {
          ...m,
          [RECENT_SMS_DATE]: phone && latestDates.has(phone)
            ? formatDate(latestDates.get(phone)!)
            : '-',
        };
      });
      setMembers(mappedMembers);
      setTotalCount(pageData.totalCount);
      setTotalPages(pageData.totalPages);
    } catch (e) {
      if (requestId === memberRequestIdRef.current) {
        console.error('회원 로딩 실패:', e);
      }
    } finally {
      if (requestId === memberRequestIdRef.current) {
        setIsLoading(false);
      }
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
          smsLatestDatesRef.current = getLatestSmsDates(historyData);
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
    const requestId = ++statsRequestIdRef.current;
    const s = settingsRef.current;
    const statsData = await window.api.getLocationStats({
      warningDays: s.warningDays, criticalDays: s.criticalDays,
    });
    if (statsData && requestId === statsRequestIdRef.current) setLocationStats(statsData);

    if (window.api.getSmsHistory) {
      try {
        const historyData: SmsHistoryItem[] = await window.api.getSmsHistory();
        if (requestId !== statsRequestIdRef.current) return;
        smsLatestDatesRef.current = getLatestSmsDates(historyData);
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

  const refreshAll = useCallback(async ({ clear = false }: RefreshOptions = {}) => {
    if (clear) {
      // DB 초기화가 성공한 직후에는 재조회 완료를 기다리지 않고 기존 행을 즉시 숨긴다.
      // 동시에 진행 중이던 이전 조회 결과도 무효화한다.
      memberRequestIdRef.current += 1;
      statsRequestIdRef.current += 1;
      setMembers([]);
      setTotalCount(0);
      setTotalPages(0);
      setLocationStats({
        [ALL_LOCATION]: { total: 0, active: 0, expired: 0, oneMonth: 0, twoWeeks: 0 },
      });
      setIsLoading(false);
    }
    await loadStatsAndHistory();
    await reloadMembersRef.current();
  }, [loadStatsAndHistory]);

  return {
    members, totalCount, totalPages, isLoading,
    stats, locationStats,
    handleUpload, handleDeleteMembers, handleExportExcel,
    reloadMembers, refreshAll, settings, handleUpdateSettings,
  };
};
