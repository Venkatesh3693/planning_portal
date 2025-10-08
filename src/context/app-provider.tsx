
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import type { ScheduledProcess, Order } from '@/lib/types';
import { ORDERS as initialOrders } from '@/lib/data';

const STORE_KEY = 'stitchplan_store';

type StoreData = {
  scheduledProcesses: ScheduledProcess[];
  orders: Order[];
}

type AppContextType = {
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
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
        
        const loadedOrders = store.orders || [];

        const ordersWithDates = loadedOrders.map(loadedOrder => {
            const initialOrder = initialOrders.find(o => o.id === loadedOrder.id);
            
            // Merge initial data with loaded data to add new fields like leadTime
            const mergedOrderData = {
                ...(initialOrder || {}),
                ...loadedOrder,
            };

            return {
                ...mergedOrderData,
                dueDate: new Date(mergedOrderData.dueDate),
                tna: mergedOrderData.tna ? {
                    ...mergedOrderData.tna,
                    ckDate: new Date(mergedOrderData.tna.ckDate),
                    processes: mergedOrderData.tna.processes.map(p => ({
                        ...p,
                        startDate: new Date(p.startDate),
                        endDate: new Date(p.endDate),
                    }))
                } : undefined
            };
        });

        setScheduledProcesses(processesWithDates);
        setOrders(ordersWithDates);
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
      const store: StoreData = { scheduledProcesses, orders };
      const serializedState = JSON.stringify(store);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save state to localStorage", err);
    }
  }, [scheduledProcesses, orders, isLoaded]);

  return (
    <AppContext.Provider value={{ scheduledProcesses, setScheduledProcesses, orders, setOrders }}>
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
