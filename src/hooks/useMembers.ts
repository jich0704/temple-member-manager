import { useEffect, useState } from 'react';
import type { Member } from '../types/member';

/*
 * 멤버 상태 및 저장
 */
export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (window.api?.loadMembers) {
      window.api.loadMembers().then((data) => {
        if (data) setMembers(data);
      });
    }
  }, []);

  return { members, setMembers };
}
