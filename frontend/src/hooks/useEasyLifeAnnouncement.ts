import { useEffect, useState } from 'react';
import {
  DEFAULT_EASY_LIFE_LAUNCH_AT,
  getEasyLifeAnnouncementWindow,
  isEasyLifeAnnouncementActive,
} from '@shared/easyLifeAnnouncement';

export default function useEasyLifeAnnouncement() {
  const launchAt = import.meta.env.VITE_EASY_LIFE_LAUNCH_AT ?? DEFAULT_EASY_LIFE_LAUNCH_AT;
  const [active, setActive] = useState(() => isEasyLifeAnnouncementActive(launchAt));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      const now = Date.now();
      setActive(isEasyLifeAnnouncementActive(launchAt, now));
      const { startsAt, endsAt } = getEasyLifeAnnouncementWindow(launchAt);
      const nextBoundary = now < startsAt ? startsAt : endsAt;
      if (Number.isFinite(nextBoundary) && nextBoundary > now) {
        timer = setTimeout(update, Math.min(nextBoundary - now, 2_147_483_647));
      }
    };
    update();
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pageshow', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [launchAt]);

  return active;
}
