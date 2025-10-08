
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import type { ScheduledProcess } from '@/lib/types';

const STORE_KEY = 'stitchplan_schedule';

type ScheduleContextType = {
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
  isScheduleLoaded: boolean;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);

  useEffect(() => {
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      if (serializedState) {
        const loadedProcesses = JSON.parse(serializedState).map((p: any) => ({
          ...p,
          startDateTime: new Date(p.startDateTime),
          endDateTime: new Date(p.endDateTime),
        }));
        setScheduledProcesses(loadedProcesses);
      }
    } catch (err) {
      console.error("Could not load schedule from localStorage", err);
    } finally {
      setIsScheduleLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isScheduleLoaded) return;
    try {
      const serializedState = JSON.stringify(scheduledProcesses);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [scheduledProcesses, isScheduleLoaded]);

  const value = { scheduledProcesses, setScheduledProcesses, isScheduleLoaded };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule(): ScheduleContextType {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
