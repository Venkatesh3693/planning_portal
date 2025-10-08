
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on initial mount
  useEffect(() => {
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      let loadedProcesses: ScheduledProcess[] = [];
      let ordersToLoad: Order[] = initialOrders; // Default to initial orders

      if (serializedState) {
        const store: StoreData = JSON.parse(serializedState);
        
        // "Hydrate or Re-initialize" logic for orders
        if (store.orders && store.orders.length > 0) {
          ordersToLoad = store.orders;
        }
        
        if (store.scheduledProcesses) {
          loadedProcesses = store.scheduledProcesses.map(p => ({
            ...p,
            startDateTime: new Date(p.startDateTime),
            endDateTime: new Date(p.endDateTime),
          }));
        }
      }

      // "Recover and Migrate" logic
      // This runs whether we loaded from localStorage or are using initial data
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

      setScheduledProcesses(loadedProcesses);
      setOrders(finalOrders);

    } catch (err) {
      console.error("Could not load state from localStorage, falling back to initial data.", err);
      // If anything fails, we default to the initial state completely
      setOrders(initialOrders);
      setScheduledProcesses([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    // Don't save until the initial state has been loaded
    if (!isLoaded) return;
    
    try {
      // Don't save an empty order list if it was just transiently empty during loading
      if(orders.length === 0) return;

      const store: StoreData = { scheduledProcesses, orders };
      const serializedState = JSON.stringify(store);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save state to localStorage", err);
    }
  }, [scheduledProcesses, orders, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading your schedule...</p>
      </div>
    );
  }

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
