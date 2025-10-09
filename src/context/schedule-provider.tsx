

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import type { ScheduledProcess, RampUpEntry, Order } from '@/lib/types';

const STORE_KEY = 'stitchplan_schedule_v2';

type SewingRampUpSchemes = Record<string, RampUpEntry[]>;
type SewingLines = Record<string, number>;
type StoredOrders = Record<string, Partial<Order>>;

type ScheduleContextType = {
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
  sewingRampUpSchemes: SewingRampUpSchemes;
  updateSewingRampUpScheme: (orderId: string, scheme: RampUpEntry[]) => void;
  sewingLines: SewingLines;
  setSewingLines: (orderId: string, lines: number) => void;
  isScheduleLoaded: boolean;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [sewingRampUpSchemes, setSewingRampUpSchemes] = useState<SewingRampUpSchemes>({});
  const [sewingLines, setSewingLinesState] = useState<SewingLines>({});
  const [storedOrders, setStoredOrders] = useState<StoredOrders>({});
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);

  useEffect(() => {
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
        setSewingLinesState(storedData.sewingLines || {});
        setStoredOrders(storedData.orders || {});
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
        sewingLines,
        orders: storedOrders,
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [scheduledProcesses, sewingRampUpSchemes, sewingLines, storedOrders, isScheduleLoaded]);

  const updateSewingRampUpScheme = (orderId: string, scheme: RampUpEntry[]) => {
    setSewingRampUpSchemes(prev => ({ ...prev, [orderId]: scheme }));
  };

  const setSewingLines = (orderId: string, lines: number) => {
    setSewingLinesState(prev => ({ ...prev, [orderId]: lines }));
  };

  const value = { 
    scheduledProcesses, 
    setScheduledProcesses, 
    sewingRampUpSchemes,
    updateSewingRampUpScheme,
    sewingLines,
    setSewingLines,
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
