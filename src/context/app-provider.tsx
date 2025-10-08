
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
  isLoaded: boolean;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on initial client mount
  useEffect(() => {
    // This effect now only runs on the client
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      let loadedProcesses: ScheduledProcess[] = [];
      let ordersToLoad: Order[] = initialOrders;

      if (serializedState) {
        const store: StoreData = JSON.parse(serializedState);
        
        // "Recover" logic: If localStorage has empty/invalid orders, use initialOrders
        if (store.orders && Array.isArray(store.orders) && store.orders.length > 0) {
          ordersToLoad = store.orders;
        }
      }
      
      const finalOrders = ordersToLoad.map(loadedOrder => {
          const initialOrder = initialOrders.find(o => o.id === loadedOrder.id);
          
          // Merge initial data with loaded data to add new fields
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

      if (serializedState) {
        const store: StoreData = JSON.parse(serializedState);
        if (store.scheduledProcesses) {
          loadedProcesses = store.scheduledProcesses.map(p => ({
            ...p,
            startDateTime: new Date(p.startDateTime),
            endDateTime: new Date(p.endDateTime),
          }));
        }
      }

      setScheduledProcesses(loadedProcesses);
      setOrders(finalOrders);

    } catch (err) {
      console.error("Could not load state from localStorage, falling back to initial data.", err);
      // On error, fall back to initial data.
      setOrders(initialOrders.map(o => ({ ...o, dueDate: new Date(o.dueDate) })));
      setScheduledProcesses([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      if(orders.length === 0 && scheduledProcesses.length === 0) {
         // Avoid wiping data on initial load if local storage is just empty
         const hasStoredData = !!localStorage.getItem(STORE_KEY);
         if (!hasStoredData) return;
      }

      const store: StoreData = { scheduledProcesses, orders };
      const serializedState = JSON.stringify(store);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save state to localStorage", err);
    }
  }, [scheduledProcesses, orders, isLoaded]);

  const value = { scheduledProcesses, setScheduledProcesses, orders, setOrders, isLoaded };

  return (
    <AppContext.Provider value={value}>
      {!isLoaded ? (
        <div className="flex h-screen w-full items-center justify-center">
          <p>Loading your schedule...</p>
        </div>
      ) : (
        children
      )}
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
