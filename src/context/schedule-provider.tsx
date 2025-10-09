
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';
import type { ScheduledProcess, RampUpEntry, Order, Tna, TnaProcess } from '@/lib/types';
import { ORDERS as staticOrders, ORDER_COLORS } from '@/lib/data';

const STORE_KEY = 'stitchplan_schedule_v2';

type SewingRampUpSchemes = Record<string, RampUpEntry[]>;
type SewingLines = Record<string, number>;
type StoredOrderOverrides = Record<string, Partial<Pick<Order, 'displayColor' | 'sewingRampUpScheme' | 'tna'>>>;


type ScheduleContextType = {
  orders: Order[];
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
  sewingRampUpSchemes: SewingRampUpSchemes;
  updateSewingRampUpScheme: (orderId: string, scheme: RampUpEntry[]) => void;
  updateOrderTna: (orderId: string, newTnaProcesses: TnaProcess[]) => void;
  updateOrderColor: (orderId: string, color: string) => void;
  sewingLines: SewingLines;
  setSewingLines: (orderId: string, lines: number) => void;
  isScheduleLoaded: boolean;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [sewingLines, setSewingLinesState] = useState<SewingLines>({});
  const [orderOverrides, setOrderOverrides] = useState<StoredOrderOverrides>({});
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);

  // Load from localStorage on initial mount
  useEffect(() => {
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      let loadedOverrides: StoredOrderOverrides = {};
      
      if (serializedState) {
        const storedData = JSON.parse(serializedState);
        
        const loadedProcesses = (storedData.scheduledProcesses || []).map((p: any) => ({
          ...p,
          startDateTime: new Date(p.startDateTime),
          endDateTime: new Date(p.endDateTime),
        }));
        
        setScheduledProcesses(loadedProcesses);
        setSewingLinesState(storedData.sewingLines || {});
        loadedOverrides = storedData.orderOverrides || {};
        setOrderOverrides(loadedOverrides);
      }

      // Hydrate orders: Start with static, then apply overrides
      const hydratedOrders = staticOrders.map((baseOrder, index) => {
        const override = loadedOverrides[baseOrder.id];
        const hydratedTna: Tna = { ...(baseOrder.tna as Tna) };
        
        if (override?.tna?.processes) {
            const storedProcessMap = new Map(override.tna.processes.map(p => [p.processId, p]));
            hydratedTna.processes = hydratedTna.processes.map(baseProcess => {
                const storedProcess = storedProcessMap.get(baseProcess.processId);
                if (storedProcess) {
                    return {
                        ...baseProcess,
                        plannedStartDate: storedProcess.plannedStartDate ? new Date(storedProcess.plannedStartDate) : undefined,
                        plannedEndDate: storedProcess.plannedEndDate ? new Date(storedProcess.plannedEndDate) : undefined,
                        latestStartDate: storedProcess.latestStartDate ? new Date(storedProcess.latestStartDate) : undefined,
                    };
                }
                return baseProcess;
            });
        }
        
        return {
          ...baseOrder,
          displayColor: override?.displayColor || ORDER_COLORS[index % ORDER_COLORS.length],
          sewingRampUpScheme: override?.sewingRampUpScheme || [{ day: 1, efficiency: baseOrder.budgetedEfficiency || 85 }],
          tna: hydratedTna,
        };
      });
      setOrders(hydratedOrders);

    } catch (err) {
      console.error("Could not load schedule from localStorage", err);
      // Fallback to static orders if loading fails
      setOrders(staticOrders);
    } finally {
      setIsScheduleLoaded(true);
    }
  }, []);

  // Save to localStorage whenever a tracked state changes
  useEffect(() => {
    if (!isScheduleLoaded) return;
    try {
      const stateToSave = {
        scheduledProcesses,
        sewingLines,
        orderOverrides,
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [scheduledProcesses, sewingLines, orderOverrides, isScheduleLoaded]);

  const updateOrderTna = (orderId: string, newTnaProcesses: TnaProcess[]) => {
      setOrderOverrides(prev => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          tna: {
            // This assumes the rest of the TNA structure is static and doesn't need to be stored
            ...(prev[orderId]?.tna || {}),
            processes: newTnaProcesses.map(p => ({
              processId: p.processId,
              startDate: p.startDate,
              endDate: p.endDate,
              setupTime: p.setupTime,
              plannedStartDate: p.plannedStartDate,
              plannedEndDate: p.plannedEndDate,
              latestStartDate: p.latestStartDate,
            }))
          }
        }
      }));
  };
  
  const updateSewingRampUpScheme = (orderId: string, scheme: RampUpEntry[]) => {
    setOrderOverrides(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], sewingRampUpScheme: scheme }
    }));
  };

  const updateOrderColor = (orderId: string, color: string) => {
    setOrderOverrides(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], displayColor: color }
    }));
  };

  const setSewingLines = (orderId: string, lines: number) => {
    setSewingLinesState(prev => ({ ...prev, [orderId]: lines }));
  };
  
  // Re-hydrate orders when overrides change
  useEffect(() => {
    if (!isScheduleLoaded) return;
    setOrders(currentOrders => currentOrders.map(order => {
        const override = orderOverrides[order.id];
        if (!override) return order; // No changes for this order
        
        const updatedOrder = { ...order };
        if (override.displayColor) updatedOrder.displayColor = override.displayColor;
        if (override.sewingRampUpScheme) updatedOrder.sewingRampUpScheme = override.sewingRampUpScheme;
        if (override.tna && override.tna.processes) {
           const storedProcessMap = new Map(override.tna.processes.map(p => [p.processId, p]));
           const newTnaProcesses = (updatedOrder.tna?.processes || []).map(baseProcess => {
               const storedProcess = storedProcessMap.get(baseProcess.processId);
               if (storedProcess) {
                   return {
                       ...baseProcess,
                       plannedStartDate: storedProcess.plannedStartDate ? new Date(storedProcess.plannedStartDate) : undefined,
                       plannedEndDate: storedProcess.plannedEndDate ? new Date(storedProcess.plannedEndDate) : undefined,
                       latestStartDate: storedProcess.latestStartDate ? new Date(storedProcess.latestStartDate) : undefined,
                   };
               }
               return baseProcess;
           });
           updatedOrder.tna = { ...updatedOrder.tna as Tna, processes: newTnaProcesses };
        }
        return updatedOrder;
    }));
  }, [orderOverrides, isScheduleLoaded]);

  const sewingRampUpSchemes = useMemo(() => 
    Object.entries(orderOverrides).reduce((acc, [orderId, override]) => {
      if (override.sewingRampUpScheme) {
        acc[orderId] = override.sewingRampUpScheme;
      }
      return acc;
    }, {} as SewingRampUpSchemes),
  [orderOverrides]);

  const value = { 
    orders,
    scheduledProcesses, 
    setScheduledProcesses, 
    sewingRampUpSchemes,
    updateSewingRampUpScheme,
    updateOrderTna,
    updateOrderColor,
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
