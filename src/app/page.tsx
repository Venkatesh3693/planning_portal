
'use client';

import { useSchedule } from '@/context/schedule-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { appMode, isScheduleLoaded } = useSchedule();
  const router = useRouter();

  useEffect(() => {
    if (isScheduleLoaded) {
      if (appMode === 'gup') {
        router.replace('/gup');
      } else if (appMode === 'gut') {
        router.replace('/orders');
      } else if (appMode === 'gut-new') {
        router.replace('/gut-new');
      }
    }
  }, [appMode, isScheduleLoaded, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <p>Loading and redirecting...</p>
    </div>
  );
}
