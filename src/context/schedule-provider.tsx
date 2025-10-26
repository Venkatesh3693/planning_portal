

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';
import type { ScheduledProcess, RampUpEntry, Order, Tna, TnaProcess, BomItem, Size, FcComposition, FcSnapshot, SyntheticPoRecord, SizeBreakdown, CutOrderRecord } from '@/lib/types';
import { ORDERS as staticOrders, PROCESSES, ORDER_COLORS, SIZES } from '@/lib/data';
import { addDays, startOfToday, isAfter, getWeek, startOfWeek, addWeeks } from 'date-fns';
import { getProcessBatchSize, getPackingBatchSize, runTentativePlanForHorizon } from '@/lib/tna-calculator';

const STORE_KEY = 'stitchplan_schedule_v4';

type AppMode = 'gup' | 'gut';
type SewingRampUpSchemes = Record<string, RampUpEntry[]>;
type SewingLines = Record<string, number>;
type StoredOrderOverrides = Record<string, Partial<Pick<Order, 'displayColor' | 'sewingRampUpScheme' | 'tna' | 'bom' | 'fcVsFcDetails'>>>;
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
  cutOrderRecords: CutOrderRecord[];
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// New function to generate synthetic POs based on the X+3 rule
const generateSyntheticPos = (orders: Order[]): SyntheticPoRecord[] => {
    const allPos: SyntheticPoRecord[] = [];

    orders.forEach(order => {
        if (order.orderType !== 'Forecasted' || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0) {
            return;
        }

        const sortedSnapshots = [...order.fcVsFcDetails].sort((a, b) => a.snapshotWeek - b.snapshotWeek);

        sortedSnapshots.forEach(snapshot => {
            const snapshotWeekNum = snapshot.snapshotWeek;

            Object.keys(snapshot.forecasts).forEach(demandWeek => {
                const demandWeekNum = parseInt(demandWeek.slice(1));

                // The core logic: EHD week must be >= snapshot week + 3
                if (demandWeekNum >= snapshotWeekNum + 3) {
                    const weekData = snapshot.forecasts[demandWeek];
                    const totalPoForWeek = weekData?.total?.po || 0;

                    if (totalPoForWeek > 0) {
                        const sizeBreakdown = SIZES.reduce((acc, size) => {
                            acc[size] = weekData?.[size]?.po || 0;
                            return acc;
                        }, {} as Record<Size, number>);

                        // Distribute this week's total PO across destinations
                        order.demandDetails?.forEach(destDetail => {
                            const destProportion = destDetail.selectionQty / order.quantity;
                            if (isNaN(destProportion) || destProportion <= 0) return;

                            const poQtyForDest = Math.round(totalPoForWeek * destProportion);
                            if (poQtyForDest <= 0) return;

                            const quantities: Partial<SizeBreakdown> = {};
                            let currentPoTotal = 0;
                            SIZES.forEach(size => {
                                const sizeQty = Math.round((sizeBreakdown[size] || 0) * destProportion);
                                quantities[size] = sizeQty;
                                currentPoTotal += sizeQty;
                            });
                            quantities.total = currentPoTotal;

                            if (quantities.total > 0) {
                                allPos.push({
                                    orderId: order.id,
                                    poNumber: `PO-${order.ocn}-${snapshotWeekNum}-${demandWeekNum}-${destDetail.destination.substring(0, 2).toUpperCase()}`,
                                    issueWeek: `W${snapshotWeekNum}`, // This is the snapshot week
                                    originalEhdWeek: demandWeek, // This is the delivery week
                                    actualEhdWeek: demandWeek,
                                    destination: destDetail.destination,
                                    quantities: quantities as SizeBreakdown,
                                });
                            }
                        });
                    }
                }
            });
        });
    });

    return allPos.sort((a,b) => {
        const weekA = parseInt(a.originalEhdWeek.replace('W',''));
        const weekB = parseInt(b.originalEhdWeek.replace('W',''));
        if (weekA !== weekB) return weekA - weekB;
        return a.poNumber.localeCompare(b.poNumber);
    });
};


const generateCutOrders = (orders: Order[], allPoRecords: SyntheticPoRecord[]): CutOrderRecord[] => {
    const allCutOrders: CutOrderRecord[] = [];
    const currentWeek = getWeek(new Date());

    orders.forEach(order => {
        if (order.orderType !== 'Forecasted' || !order.fcVsFcDetails) return;

        const latestSnapshot = order.fcVsFcDetails.reduce((latest, s) => s.snapshotWeek > latest.snapshotWeek ? s : latest, order.fcVsFcDetails[0]);
        if (!latestSnapshot) return;

        const weeklyTotals: Record<string, number> = {};
        const snapshotWeeks = Object.keys(latestSnapshot.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        snapshotWeeks.forEach(week => {
            const total = latestSnapshot.forecasts[week]?.total;
            weeklyTotals[week] = (total?.po || 0) + (total?.fc || 0);
        });

        const { plan } = runTentativePlanForHorizon(latestSnapshot.snapshotWeek, null, weeklyTotals, order, 0);
        const planWeeks = Object.keys(plan).map(w => parseInt(w.slice(1))).sort((a, b) => a - b);
        
        const firstProdWeek = planWeeks.find(w => plan[`W${w}`] > 0);
        if (!firstProdWeek) return;
        
        let availablePOs = allPoRecords
          .filter(po => po.orderId === order.id)
          .sort((a, b) => parseInt(a.originalEhdWeek.slice(1)) - parseInt(b.originalEhdWeek.slice(1)));
        
        let coRemainderQty = 0;
        let coCounter = 1;

        for (let week = firstProdWeek; week < 53; week += 2) {
            if (week > currentWeek) break;

            const week1 = week;
            const week2 = week + 1;
            const week1Key = `W${week1}`;
            const week2Key = `W${week2}`;

            const planQtyW1 = plan[week1Key] || 0;
            const planQtyW2 = plan[week2Key] || 0;
            const targetQty = planQtyW1 + planQtyW2 + coRemainderQty;
            
            if (targetQty <= 0) continue;

            const posForThisCO: SyntheticPoRecord[] = [];
            let accumulatedQty = 0;
            
            while(accumulatedQty < targetQty && availablePOs.length > 0) {
                const po = availablePOs.shift()!;
                posForThisCO.push(po);
                accumulatedQty += po.quantities.total;
            }
            
            coRemainderQty = accumulatedQty - targetQty;

            const coQuantities = SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), {} as Record<Size, number>);
            let totalCoQty = 0;

            posForThisCO.forEach(po => {
                SIZES.forEach(size => {
                    coQuantities[size] = (coQuantities[size] || 0) + (po.quantities[size] || 0);
                });
                totalCoQty += po.quantities.total;
            });
            
            allCutOrders.push({
                coNumber: `CO-${order.ocn}-${String(coCounter++).padStart(2, '0')}`,
                orderId: order.id,
                coWeekCoverage: `${week1Key}-${week2Key}`,
                quantities: { ...coQuantities, total: totalCoQty }
            });
        }
    });

    return allCutOrders;
}


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
      setSyntheticPoRecords(generateSyntheticPos(hydratedOrders));

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
      // Regenerate POs whenever overrides change to keep data fresh
      const newSyntheticPOs = generateSyntheticPos(orders);
      setSyntheticPoRecords(newSyntheticPOs);

      const stateToSave = {
        appMode,
        scheduledProcesses,
        sewingLines,
        orderOverrides,
        productionPlans,
        timelineEndDate,
        splitOrderProcesses,
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [appMode, scheduledProcesses, sewingLines, orderOverrides, productionPlans, timelineEndDate, splitOrderProcesses, isScheduleLoaded, orders]);


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
    // This function will now be simpler as we regenerate POs on any data change.
    // We just need to modify the underlying forecast data.
    const originalPoRecord = syntheticPoRecords.find(p => p.poNumber === poNumber);
    if (!originalPoRecord) return;
  
    setOrderOverrides(prevOverrides => {
        const newOverrides = JSON.parse(JSON.stringify(prevOverrides));
        const orderFcDetails = newOverrides[orderId]?.fcVsFcDetails || orders.find(o => o.id === orderId)?.fcVsFcDetails || [];
        if (orderFcDetails.length === 0) return prevOverrides;
        
        const snapshotWeekToUpdate = parseInt(originalPoRecord.issueWeek.replace('W',''));
        const snapshotToUpdate = orderFcDetails.find((s: FcSnapshot) => s.snapshotWeek === snapshotWeekToUpdate);

        if (!snapshotToUpdate) return prevOverrides;

        const fromWeek = originalPoRecord.originalEhdWeek;
        const toWeek = newWeek;
        const movedQuantities = originalPoRecord.quantities;

        if (!snapshotToUpdate.forecasts[fromWeek]) snapshotToUpdate.forecasts[fromWeek] = {};
        if (!snapshotToUpdate.forecasts[toWeek]) snapshotToUpdate.forecasts[toWeek] = {};

        (Object.keys(movedQuantities) as (keyof typeof movedQuantities)[]).forEach(size => {
            if (size === 'total') return;
            const qtyToMove = movedQuantities[size] || 0;
            
            if (!snapshotToUpdate.forecasts[fromWeek][size]) snapshotToUpdate.forecasts[fromWeek][size] = { po: 0, fc: 0 };
            snapshotToUpdate.forecasts[fromWeek][size]!.po = Math.max(0, (snapshotToUpdate.forecasts[fromWeek][size]!.po || 0) - qtyToMove);

            if (!snapshotToUpdate.forecasts[toWeek][size]) snapshotToUpdate.forecasts[toWeek][size] = { po: 0, fc: 0 };
            snapshotToUpdate.forecasts[toWeek][size]!.po = (snapshotToUpdate.forecasts[toWeek][size]!.po || 0) + qtyToMove;
        });

        [fromWeek, toWeek].forEach(weekKey => {
            let totalPo = 0;
            let totalFc = 0;
            SIZES.forEach(size => {
                totalPo += snapshotToUpdate.forecasts[weekKey]?.[size]?.po || 0;
                totalFc += snapshotToUpdate.forecasts[weekKey]?.[size]?.fc || 0;
            });
            if (!snapshotToUpdate.forecasts[weekKey].total) snapshotToUpdate.forecasts[weekKey].total = { po: 0, fc: 0 };
            snapshotToUpdate.forecasts[weekKey].total!.po = totalPo;
            snapshotToUpdate.forecasts[weekKey].total!.fc = totalFc;
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

  const cutOrderRecords = useMemo(() => {
    if (!isScheduleLoaded) return [];
    return generateCutOrders(orders, syntheticPoRecords);
  }, [isScheduleLoaded, orders, syntheticPoRecords]);

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
    cutOrderRecords,
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
