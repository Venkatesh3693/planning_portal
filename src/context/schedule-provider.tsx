

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';
import type { ScheduledProcess, RampUpEntry, Order, Tna, TnaProcess } from '@/lib/types';
import { ORDERS as staticOrders, ORDER_COLORS } from '@/lib/data';
import { addDays, startOfToday, isAfter } from 'date-fns';

const STORE_KEY = 'stitchplan_schedule_v3';

type SewingRampUpSchemes = Record<string, RampUpEntry[]>;
type SewingLines = Record<string, number>;
type StoredOrderOverrides = Record<string, Partial<Pick<Order, 'displayColor' | 'sewingRampUpScheme' | 'tna'>>>;

type ScheduleContextType = {
  orders: Order[];
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
  sewingRampUpSchemes: SewingRampUpSchemes;
  updateSewingRampUpScheme: (orderId: string, scheme: RampUpEntry[]) => void;
  updateOrderTna: (orderId: string, newTnaProcesses: TnaProcess[], newCkDate: Date) => void;
  updateOrderColor: (orderId: string, color: string) => void;
  updateOrderMinRunDays: (orderId: string, minRunDays: Record<string, number>) => void;
  sewingLines: SewingLines;
  setSewingLines: (orderId: string, lines: number) => void;
  timelineEndDate: Date;
  setTimelineEndDate: Dispatch<SetStateAction<Date>>;
  isScheduleLoaded: boolean;
  splitOrderProcesses: Record<string, boolean>;
  toggleSplitProcess: (orderId: string, processId: string) => void;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [sewingLines, setSewingLinesState] = useState<SewingLines>({});
  const [orderOverrides, setOrderOverrides] = useState<StoredOrderOverrides>({});
  const [splitOrderProcesses, setSplitOrderProcesses] = useState<Record<string, boolean>>({});
  const [timelineEndDate, setTimelineEndDate] = useState(() => addDays(startOfToday(), 90));
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);

  useEffect(() => {
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      let loadedOverrides: StoredOrderOverrides = {};
      let maxEndDate = addDays(startOfToday(), 90);
      
      if (serializedState) {
        const storedData = JSON.parse(serializedState);
        
        const loadedProcesses = (storedData.scheduledProcesses || []).map((p: any) => {
          const endDateTime = new Date(p.endDateTime);
          if (isAfter(endDateTime, maxEndDate)) {
              maxEndDate = endDateTime;
          }
          return {
            ...p,
            startDateTime: new Date(p.startDateTime),
            endDateTime: endDateTime,
          };
        });
        
        setScheduledProcesses(loadedProcesses);
        setSewingLinesState(storedData.sewingLines || {});
        loadedOverrides = storedData.orderOverrides || {};
        setOrderOverrides(loadedOverrides);
        setSplitOrderProcesses(storedData.splitOrderProcesses || {});

        if (storedData.timelineEndDate) {
            const storedEndDate = new Date(storedData.timelineEndDate);
            if (isAfter(storedEndDate, maxEndDate)) {
                maxEndDate = storedEndDate;
            }
        }
      }

      setTimelineEndDate(addDays(maxEndDate, 3));

      const hydratedOrders = staticOrders.map((baseOrder, index) => {
        const override = loadedOverrides[baseOrder.id];
        const hydratedTna: Tna = { ...(baseOrder.tna as Tna) };

        if(override?.tna) {
          if(override.tna.ckDate) {
            hydratedTna.ckDate = new Date(override.tna.ckDate);
          }
          if(override.tna.minRunDays) {
            hydratedTna.minRunDays = override.tna.minRunDays;
          }
          if (override.tna.processes) {
              const storedProcessMap = new Map(override.tna.processes.map(p => [p.processId, p]));
              hydratedTna.processes = hydratedTna.processes.map(baseProcess => {
                  const storedProcess = storedProcessMap.get(baseProcess.processId);
                  if (storedProcess) {
                      return {
                          ...baseProcess,
                          durationDays: storedProcess.durationDays,
                          earliestStartDate: storedProcess.earliestStartDate ? new Date(storedProcess.earliestStartDate) : undefined,
                          latestStartDate: storedProcess.latestStartDate ? new Date(storedProcess.latestStartDate) : undefined,
                      };
                  }
                  return baseProcess;
              });
          }
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
      setOrders(staticOrders);
    } finally {
      setIsScheduleLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isScheduleLoaded) return;
    try {
      const stateToSave = {
        scheduledProcesses,
        sewingLines,
        orderOverrides,
        timelineEndDate,
        splitOrderProcesses,
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [scheduledProcesses, sewingLines, orderOverrides, timelineEndDate, splitOrderProcesses, isScheduleLoaded]);

  const updateOrderTna = (orderId: string, newTnaProcesses: TnaProcess[], newCkDate: Date) => {
      setOrderOverrides(prev => {
        const currentTna = prev[orderId]?.tna || {};
        return {
        ...prev,
        [orderId]: {
          ...prev[orderId],
          tna: {
            ...currentTna,
            ckDate: newCkDate,
            processes: newTnaProcesses.map(p => ({
              processId: p.processId,
              setupTime: p.setupTime,
              durationDays: p.durationDays,
              earliestStartDate: p.earliestStartDate,
              latestStartDate: p.latestStartDate,
            }))
          }
        }
      }});
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

  const updateOrderMinRunDays = (orderId: string, minRunDays: Record<string, number>) => {
    setOrderOverrides(prev => {
      const currentTna = prev[orderId]?.tna || {};
      return {
        ...prev,
        [orderId]: {
          ...prev[orderId],
          tna: {
            ...currentTna,
            minRunDays: minRunDays,
          }
        }
      }
    });
  };

  const setSewingLines = (orderId: string, lines: number) => {
    setSewingLinesState(prev => ({ ...prev, [orderId]: lines }));
  };

  const toggleSplitProcess = (orderId: string, processId: string) => {
    const key = `${orderId}_${processId}`;
    setSplitOrderProcesses(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  useEffect(() => {
    if (!isScheduleLoaded) return;
    setOrders(currentOrders => currentOrders.map(order => {
        const override = orderOverrides[order.id];
        if (!override) return order;
        
        const updatedOrder = { ...order };
        if (override.displayColor) updatedOrder.displayColor = override.displayColor;
        if (override.sewingRampUpScheme) updatedOrder.sewingRampUpScheme = override.sewingRampUpScheme;
        
        if (override.tna) {
           const newTna = { ...(updatedOrder.tna || { processes: [] }) } as Tna;
           if(override.tna.ckDate) newTna.ckDate = new Date(override.tna.ckDate);
           if(override.tna.minRunDays) newTna.minRunDays = override.tna.minRunDays;
           
           if(override.tna.processes){
              const storedProcessMap = new Map(override.tna.processes.map(p => [p.processId, p]));
              newTna.processes = (updatedOrder.tna?.processes || []).map(baseProcess => {
                  const storedProcess = storedProcessMap.get(baseProcess.processId);
                  if (storedProcess) {
                      return {
                          ...baseProcess,
                          durationDays: storedProcess.durationDays,
                          earliestStartDate: storedProcess.earliestStartDate ? new Date(storedProcess.earliestStartDate) : undefined,
                          latestStartDate: storedProcess.latestStartDate ? new Date(storedProcess.latestStartDate) : undefined,
                      };
                  }
                  return baseProcess;
              });
           }
           updatedOrder.tna = newTna;
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
    updateOrderMinRunDays,
    sewingLines,
    setSewingLines,
    timelineEndDate,
    setTimelineEndDate,
    isScheduleLoaded,
    splitOrderProcesses,
    toggleSplitProcess,
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
