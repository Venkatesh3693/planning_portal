
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import type { ScheduledProcess, RampUpEntry } from '@/lib/types';

const STORE_KEY = 'stitchplan_schedule_v2'; // Renamed to avoid conflicts with old structure

type SewingRampUpSchemes = Record<string, RampUpEntry[]>;

type ScheduleContextType = {
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
  sewingRampUpSchemes: SewingRampUpSchemes;
  updateSewingRampUpScheme: (orderId: string, scheme: RampUpEntry[]) => void;
  isScheduleLoaded: boolean;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [sewingRampUpSchemes, setSewingRampUpSchemes] = useState<SewingRampUpSchemes>({});
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render.
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      if (serializedState) {
        const storedData = JSON.parse(serializedState);
        
        const loadedProcesses = (storedData.scheduledProcesses || []).map((p: any) => ({
          ...p,
          startDateTime: new Date(p.startDateTime),
          endDateTime: new Date(p.endDateTime),
        }));
        
        setScheduledProcesses(loadedProcesses);
        setSewingRampUpSchemes(storedData.sewingRampUpSchemes || {});
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
      const stateToSave = {
        scheduledProcesses,
        sewingRampUpSchemes,
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [scheduledProcesses, sewingRampUpSchemes, isScheduleLoaded]);

  const updateSewingRampUpScheme = (orderId: string, scheme: RampUpEntry[]) => {
    setSewingRampUpSchemes(prev => ({ ...prev, [orderId]: scheme }));
  };

  const value = { 
    scheduledProcesses, 
    setScheduledProcesses, 
    sewingRampUpSchemes,
    updateSewingRampUpScheme,
    isScheduleLoaded 
  };

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
