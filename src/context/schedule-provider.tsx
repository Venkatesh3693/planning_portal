

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';
import type { ScheduledProcess, RampUpEntry, Order, Tna, TnaProcess, BomItem, Size, FcComposition, FcSnapshot, SyntheticPoRecord, SizeBreakdown } from '@/lib/types';
import { ORDERS as staticOrders, PROCESSES, ORDER_COLORS, SIZES } from '@/lib/data';
import { addDays, startOfToday, isAfter, getWeek, startOfWeek, addWeeks } from 'date-fns';
import { getProcessBatchSize, getPackingBatchSize } from '@/lib/tna-calculator';

const STORE_KEY = 'stitchplan_schedule_v4';

type AppMode = 'gup' | 'gut';
type SewingRampUpSchemes = Record<string, RampUpEntry[]>;
type SewingLines = Record<string, number>;
type StoredOrderOverrides = Record<string, Partial<Pick<Order, 'displayColor' | 'sewingRampUpScheme' | 'tna' | 'bom' | 'fcVsFcDetails' | 'syntheticPoRecords'>>>;
type ProductionPlans = Record<string, Record<string, number>>;

type ScheduleContextType = {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  orders: Order[];
  scheduledProcesses: ScheduledProcess[];
  setScheduledProcesses: Dispatch<SetStateAction<ScheduledProcess[]>>;
  sewingRampUpSchemes: SewingRampUpSchemes;
  updateSewingRampUpScheme: (orderId: string, scheme: RampUpEntry[]) => void;
  updateOrderTna: (orderId: string, newTnaProcesses: TnaProcess[]) => void;
  updateOrderColor: (orderId: string, color: string) => void;
  updateOrderMinRunDays: (orderId: string, minRunDays: Record<string, number>) => void;
  updateOrderBom: (orderId: string, componentName: string, field: keyof BomItem, value: any) => void;
  updatePoEhd: (orderId: string, poNumber: string, newWeek: string) => void;
  sewingLines: SewingLines;
  setSewingLines: (orderId: string, lines: number) => void;
  productionPlans: ProductionPlans;
  updateProductionPlan: (orderId: string, plan: Record<string, number>) => void;
  timelineEndDate: Date;
  setTimelineEndDate: Dispatch<SetStateAction<Date>>;
  isScheduleLoaded: boolean;
  splitOrderProcesses: Record<string, boolean>;
  toggleSplitProcess: (orderId: string, processId: string) => void;
  processBatchSizes: Record<string, number>;
  packingBatchSizes: Record<string, number>;
  syntheticPoRecords: SyntheticPoRecord[];
  setSyntheticPoRecords: Dispatch<SetStateAction<SyntheticPoRecord[]>>;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// New function to generate synthetic POs
const generateSyntheticPos = (orders: Order[]): SyntheticPoRecord[] => {
    const allPos: SyntheticPoRecord[] = [];
    const currentWeek = getWeek(new Date());

    orders.forEach(order => {
        if (order.orderType !== 'Forecasted' || !order.demandDetails) return;

        const selectionQty = order.quantity;
        const targetTotalPoQty = selectionQty * (0.8 + Math.random() * 0.5); // 80% to 130% of selection
        
        let allocatedQty = 0;
        let poCounter = 1;

        const weeksToGenerate = Array.from({ length: 15 }, (_, i) => currentWeek + i - 5);

        for (const week of weeksToGenerate) {
            if (allocatedQty >= targetTotalPoQty) break;

            for (const destDetail of order.demandDetails) {
                if (allocatedQty >= targetTotalPoQty) break;

                // Randomly decide if a PO is created for this dest/week combination
                if (Math.random() > 0.6) continue;

                const remainingToAllocate = targetTotalPoQty - allocatedQty;
                const poQtyForThisRecord = Math.min(remainingToAllocate, destDetail.selectionQty * (0.1 + Math.random() * 0.3));

                if (poQtyForThisRecord < 100) continue; // Minimum PO size

                const quantities: Partial<SizeBreakdown> = {};
                let currentPoTotal = 0;
                SIZES.forEach(size => {
                    // Distribute quantity across sizes with some randomness
                    const sizeQty = Math.round(poQtyForThisRecord * (Math.random() * 0.2 + 0.05));
                    quantities[size] = sizeQty;
                    currentPoTotal += sizeQty;
                });
                
                // Adjust total to match
                const adjustment = Math.round(poQtyForThisRecord) - currentPoTotal;
                quantities['M'] = (quantities['M'] || 0) + adjustment;
                quantities.total = Math.round(poQtyForThisRecord);

                const ehdWeek = week;
                const issueDateWeek = ehdWeek - 4;
                const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });

                allPos.push({
                    orderId: order.id,
                    poNumber: `PO-${order.ocn}-${destDetail.destination.substring(0,2).toUpperCase()}-${poCounter++}`,
                    issueDate: addWeeks(weekStartDate, issueDateWeek),
                    originalEhdWeek: `W${ehdWeek}`,
                    actualEhdWeek: `W${ehdWeek}`,
                    destination: destDetail.destination,
                    quantities: quantities as SizeBreakdown,
                });

                allocatedQty += quantities.total;
            }
        }
    });

    return allPos;
};


export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [appMode, setAppModeState] = useState<AppMode>('gup');
  const [orders, setOrders] = useState<Order[]>([]);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [sewingLines, setSewingLinesState] = useState<SewingLines>({});
  const [orderOverrides, setOrderOverrides] = useState<StoredOrderOverrides>({});
  const [productionPlans, setProductionPlans] = useState<ProductionPlans>({});
  const [splitOrderProcesses, setSplitOrderProcesses] = useState<Record<string, boolean>>({});
  const [timelineEndDate, setTimelineEndDate] = useState(() => addDays(startOfToday(), 90));
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);
  const [syntheticPoRecords, setSyntheticPoRecords] = useState<SyntheticPoRecord[]>([]);

  useEffect(() => {
    try {
      const serializedState = localStorage.getItem(STORE_KEY);
      let loadedOverrides: StoredOrderOverrides = {};
      let maxEndDate = addDays(startOfToday(), 90);
      let loadedSyntheticPos: SyntheticPoRecord[] | undefined;
      
      if (serializedState) {
        const storedData = JSON.parse(serializedState);
        
        if (storedData.appMode) setAppModeState(storedData.appMode);
        setSewingLinesState(storedData.sewingLines || {});
        setProductionPlans(storedData.productionPlans || {});
        loadedOverrides = storedData.orderOverrides || {};
        setOrderOverrides(loadedOverrides);
        setSplitOrderProcesses(storedData.splitOrderProcesses || {});

        const loadedProcesses = (storedData.scheduledProcesses || []).map((p: any) => {
          const endDateTime = new Date(p.endDateTime);
          if (isAfter(endDateTime, maxEndDate)) maxEndDate = endDateTime;
          return {
            ...p,
            startDateTime: new Date(p.startDateTime),
            endDateTime,
            latestStartDate: p.latestStartDate ? new Date(p.latestStartDate) : undefined,
          };
        });
        setScheduledProcesses(loadedProcesses);
        
        if (storedData.timelineEndDate) {
            const storedEndDate = new Date(storedData.timelineEndDate);
            if (isAfter(storedEndDate, maxEndDate)) maxEndDate = storedEndDate;
        }

        if (storedData.syntheticPoRecords) {
           loadedSyntheticPos = storedData.syntheticPoRecords.map((r: any) => ({
             ...r,
             issueDate: new Date(r.issueDate),
           }));
        }
      }

      setTimelineEndDate(addDays(maxEndDate, 3));

      const hydratedOrders = staticOrders.map((baseOrder, index) => {
        const override = loadedOverrides[baseOrder.id] || {};
        const hydratedTna: Tna = { ...(baseOrder.tna as Tna) };

        if(override.tna) {
          if (override.tna.processes) {
              const storedProcessMap = new Map(override.tna.processes.map(p => [p.processId, p]));
              hydratedTna.processes = hydratedTna.processes.map(baseProcess => {
                  const storedProcess = storedProcessMap.get(baseProcess.processId);
                  return storedProcess ? { ...baseProcess, ...storedProcess, earliestStartDate: storedProcess.earliestStartDate ? new Date(storedProcess.earliestStartDate) : undefined, latestStartDate: storedProcess.latestStartDate ? new Date(storedProcess.latestStartDate) : undefined } : baseProcess;
              });
          }
           if(override.tna.minRunDays) hydratedTna.minRunDays = override.tna.minRunDays;
        }
        
        return {
          ...baseOrder,
          displayColor: override.displayColor || ORDER_COLORS[index % ORDER_COLORS.length],
          sewingRampUpScheme: override.sewingRampUpScheme || [{ day: 1, efficiency: baseOrder.budgetedEfficiency || 85 }],
          tna: hydratedTna,
          bom: override.bom || baseOrder.bom,
          fcVsFcDetails: override.fcVsFcDetails || baseOrder.fcVsFcDetails,
        };
      });
      setOrders(hydratedOrders);
      
      if (loadedSyntheticPos) {
        setSyntheticPoRecords(loadedSyntheticPos);
      } else {
        setSyntheticPoRecords(generateSyntheticPos(hydratedOrders));
      }

    } catch (err) {
      console.error("Could not load schedule from localStorage", err);
      setOrders(staticOrders);
      setSyntheticPoRecords(generateSyntheticPos(staticOrders));
    } finally {
      setIsScheduleLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isScheduleLoaded) return;
    try {
      const stateToSave = {
        appMode,
        scheduledProcesses,
        sewingLines,
        orderOverrides,
        productionPlans,
        timelineEndDate,
        splitOrderProcesses,
        syntheticPoRecords,
      };
      const serializedState = JSON.stringify(stateToSave, (key, value) => {
        // Deep copy quantities to prevent reference issues in storage
        if (key === 'quantities' && typeof value === 'object' && value !== null) {
          return JSON.parse(JSON.stringify(value));
        }
        return value;
      });
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [appMode, scheduledProcesses, sewingLines, orderOverrides, productionPlans, timelineEndDate, splitOrderProcesses, isScheduleLoaded, syntheticPoRecords]);

  const setAppMode = (mode: AppMode) => {
    setAppModeState(mode);
  };

  const updateOrderTna = (orderId: string, newTnaProcesses: TnaProcess[]) => {
      setOrderOverrides(prev => {
        const currentTna = prev[orderId]?.tna || {};
        return {
        ...prev,
        [orderId]: {
          ...prev[orderId],
          tna: {
            ...currentTna,
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

  const updateOrderBom = (orderId: string, componentName: string, field: keyof BomItem, value: any) => {
    setOrderOverrides(prev => {
      const orderToUpdate = orders.find(o => o.id === orderId);
      const currentBom = prev[orderId]?.bom || orderToUpdate?.bom || [];
      const newBom = currentBom.map(item => 
        item.componentName === componentName ? { ...item, [field]: value } : item
      );
      
      return {
        ...prev,
        [orderId]: {
          ...prev[orderId],
          bom: newBom
        }
      };
    });
  };
  
  const updatePoEhd = (orderId: string, poNumber: string, newWeek: string) => {
    // Find the original record to know what to move
    const originalPoRecord = syntheticPoRecords.find(p => p.poNumber === poNumber);
    if (!originalPoRecord) return;
  
    // Update the local, persistent PO record state
    setSyntheticPoRecords(prevRecords =>
      prevRecords.map(p =>
        p.poNumber === poNumber ? { ...p, actualEhdWeek: newWeek } : p
      )
    );
    
    // Update the forecast data for analytics
    setOrderOverrides(prevOverrides => {
        const newOverrides = JSON.parse(JSON.stringify(prevOverrides));
        const orderFcDetails = newOverrides[orderId]?.fcVsFcDetails || orders.find(o => o.id === orderId)?.fcVsFcDetails || [];
        if (orderFcDetails.length === 0) return prevOverrides;
        
        const latestSnapshot = orderFcDetails.reduce((latest: FcSnapshot | null, current: FcSnapshot) => 
            (!latest || current.snapshotWeek > latest.snapshotWeek) ? current : latest, null
        );

        if (!latestSnapshot) return prevOverrides;

        const fromWeek = originalPoRecord.originalEhdWeek;
        const toWeek = newWeek;
        const movedQuantities = originalPoRecord.quantities;

        // Ensure week entries exist
        if (!latestSnapshot.forecasts[fromWeek]) latestSnapshot.forecasts[fromWeek] = {};
        if (!latestSnapshot.forecasts[toWeek]) latestSnapshot.forecasts[toWeek] = {};

        // Subtract from old week and add to new week for each size
        (Object.keys(movedQuantities) as (keyof typeof movedQuantities)[]).forEach(size => {
            if (size === 'total') return;
            const qtyToMove = movedQuantities[size] || 0;
            
            // Subtract
            if (!latestSnapshot.forecasts[fromWeek][size]) latestSnapshot.forecasts[fromWeek][size] = { po: 0, fc: 0 };
            latestSnapshot.forecasts[fromWeek][size]!.po = Math.max(0, (latestSnapshot.forecasts[fromWeek][size]!.po || 0) - qtyToMove);

            // Add
            if (!latestSnapshot.forecasts[toWeek][size]) latestSnapshot.forecasts[toWeek][size] = { po: 0, fc: 0 };
            latestSnapshot.forecasts[toWeek][size]!.po = (latestSnapshot.forecasts[toWeek][size]!.po || 0) + qtyToMove;
        });

        // Recalculate totals for affected weeks
        [fromWeek, toWeek].forEach(weekKey => {
            let totalPo = 0;
            let totalFc = 0;
            SIZES.forEach(size => {
                totalPo += latestSnapshot.forecasts[weekKey]?.[size]?.po || 0;
                totalFc += latestSnapshot.forecasts[weekKey]?.[size]?.fc || 0;
            });
            if (!latestSnapshot.forecasts[weekKey].total) latestSnapshot.forecasts[weekKey].total = { po: 0, fc: 0 };
            latestSnapshot.forecasts[weekKey].total!.po = totalPo;
            latestSnapshot.forecasts[weekKey].total!.fc = totalFc;
        });

        if (!newOverrides[orderId]) newOverrides[orderId] = {};
        newOverrides[orderId].fcVsFcDetails = orderFcDetails;
        
        return newOverrides;
    });
};


  const setSewingLines = (orderId: string, lines: number) => {
    setSewingLinesState(prev => ({ ...prev, [orderId]: lines }));
  };

  const updateProductionPlan = (orderId: string, plan: Record<string, number>) => {
    setProductionPlans(prev => ({ ...prev, [orderId]: plan }));
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
        if (override.bom) updatedOrder.bom = override.bom;
        if (override.fcVsFcDetails) updatedOrder.fcVsFcDetails = override.fcVsFcDetails;
        if (override.syntheticPoRecords) updatedOrder.syntheticPoRecords = override.syntheticPoRecords;
        
        if (override.tna) {
           const newTna = { ...(updatedOrder.tna || { processes: [] }) } as Tna;
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

  const { processBatchSizes, packingBatchSizes } = useMemo(() => {
    const pbs: Record<string, number> = {};
    const qbs: Record<string, number> = {};
    orders.forEach(order => {
        const numLines = sewingLines[order.id] || 1;
        pbs[order.id] = getProcessBatchSize(order, PROCESSES, numLines);
        qbs[order.id] = getPackingBatchSize(order, PROCESSES);
    });
    return { processBatchSizes: pbs, packingBatchSizes: qbs };
  }, [orders, sewingLines]);

  const value = { 
    appMode,
    setAppMode,
    orders,
    scheduledProcesses, 
    setScheduledProcesses, 
    sewingRampUpSchemes,
    updateSewingRampUpScheme,
    updateOrderTna,
    updateOrderColor,
    updateOrderMinRunDays,
    updateOrderBom,
    updatePoEhd,
    sewingLines,
    setSewingLines,
    productionPlans,
    updateProductionPlan,
    timelineEndDate,
    setTimelineEndDate,
    isScheduleLoaded,
    splitOrderProcesses,
    toggleSplitProcess,
    processBatchSizes,
    packingBatchSizes,
    syntheticPoRecords,
    setSyntheticPoRecords,
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
