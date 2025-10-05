'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import type { ScheduledProcess } from '@/lib/types';

const STORE_KEY = 'stitchplan_store';

type StoreData = {
  scheduledProcesses: ScheduledProcess[];
}

type AppContextType = {
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on initial mount
  useEffect(() => {
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      if (serializedState) {
        const store: StoreData = JSON.parse(serializedState);
        // Important: Convert date strings back to Date objects
        const processesWithDates = store.scheduledProcesses.map(p => ({
          ...p,
          startDateTime: new Date(p.startDateTime),
          endDateTime: new Date(p.endDateTime),
        }));
        setScheduledProcesses(processesWithDates);
      }
    } catch (err) {
      console.error("Could not load state from localStorage", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    // Don't save until the initial state has been loaded
    if (!isLoaded) return;
    
    try {
      const store: StoreData = { scheduledProcesses };
      const serializedState = JSON.stringify(store);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save state to localStorage", err);
    }
  }, [scheduledProcesses, isLoaded]);

  return (
    <AppContext.Provider value={{ scheduledProcesses, setScheduledProcesses }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
