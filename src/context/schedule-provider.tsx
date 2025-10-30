

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useMemo, useCallback } from 'react';
import type { ScheduledProcess, RampUpEntry, Order, Tna, TnaProcess, BomItem, Size, FcComposition, FcSnapshot, SyntheticPoRecord, CutOrderRecord, SizeBreakdown, ProjectionRow } from '@/lib/types';
import { ORDERS as staticOrders, PROCESSES, ORDER_COLORS, SIZES } from '@/lib/data';
import { addDays, startOfToday, isAfter, getWeek } from 'date-fns';
import { getProcessBatchSize, getPackingBatchSize } from '@/lib/tna-calculator';

const STORE_KEY = 'stitchplan_schedule_v4';
const FIRM_PO_WINDOW = 3;

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
  addCutOrderRecord: (record: CutOrderRecord) => void;
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

        const firstPoWeeks = new Map<string, number>(); // key: demandWeek-destination, value: snapshotWeek

        sortedSnapshots.forEach(snapshot => {
            const snapshotWeekNum = snapshot.snapshotWeek;

            Object.keys(snapshot.forecasts).forEach(demandWeek => {
                const demandWeekNum = parseInt(demandWeek.slice(1));
                const weekData = snapshot.forecasts[demandWeek];

                if (weekData && demandWeekNum >= snapshotWeekNum + FIRM_PO_WINDOW) {
                    order.demandDetails?.forEach(destDetail => {
                        const destProportion = destDetail.selectionQty > 0 ? destDetail.selectionQty / order.quantity : 0;
                        if (destProportion <= 0) return;

                        const totalPoForWeek = weekData?.total?.po || 0;
                        const poQtyForDest = Math.round(totalPoForWeek * destProportion);
                        
                        if (poQtyForDest > 0) {
                            const poKey = `${demandWeek}-${destDetail.destination}`;
                            if (!firstPoWeeks.has(poKey)) {
                                firstPoWeeks.set(poKey, snapshotWeekNum);
                            }
                        }
                    });
                }
            });
        });

        firstPoWeeks.forEach((issueWeekNum, key) => {
            const [demandWeek, destination] = key.split('-');

            const issueSnapshot = sortedSnapshots.find(s => s.snapshotWeek === issueWeekNum);
            if (!issueSnapshot) return;

            const weekData = issueSnapshot.forecasts[demandWeek];
            const totalPoForWeek = weekData?.total?.po || 0;
            const destDetail = order.demandDetails?.find(d => d.destination === destination);
            const destProportion = destDetail && order.quantity > 0 ? destDetail.selectionQty / order.quantity : 0;

            const poQtyForDest = Math.round(totalPoForWeek * destProportion);

            if (poQtyForDest > 0) {
                const quantities: Partial<SizeBreakdown> = {};
                let currentPoTotal = 0;
                SIZES.forEach(size => {
                    const sizeQty = Math.round((weekData?.[size]?.po || 0) * destProportion);
                    quantities[size] = sizeQty;
                    currentPoTotal += sizeQty;
                });
                quantities.total = currentPoTotal;

                if (quantities.total > 0) {
                     allPos.push({
                        orderId: order.id,
                        poNumber: `PO-${order.ocn}-${issueWeekNum}-${demandWeek.replace('W','')}-${destination.substring(0, 2).toUpperCase()}`,
                        issueWeek: `W${issueWeekNum}`,
                        originalEhdWeek: demandWeek,
                        actualEhdWeek: demandWeek,
                        destination: destination,
                        quantities: quantities as SizeBreakdown,
                    });
                }
            }
        });
    });

    return allPos.sort((a,b) => {
        const weekA = parseInt(a.originalEhdWeek.replace('W',''));
        const weekB = parseInt(b.originalEhdWeek.replace('W',''));
        if (weekA !== weekB) return weekA - weekB;
        return a.poNumber.localeCompare(b.poNumber);
    });
};

const calculateProjectionTotalsForOrder = (order: Order): { totalProjectionQty: number; totalFrcQty: number } => {
    if (!order || order.orderType !== 'Forecasted' || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0) {
        return { totalProjectionQty: 0, totalFrcQty: 0 };
    }
    // This function's logic is removed as requested by the user.
    // It will be replaced with a more advanced planner later.
    return { totalProjectionQty: 0, totalFrcQty: 0 };
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
  const [cutOrderRecords, setCutOrderRecords] = useState<CutOrderRecord[]>([]);

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
        setCutOrderRecords((storedData.cutOrderRecords || []).map((co: any) => ({...co, poNumbers: co.poNumbers || []})));
        
        if (storedData.timelineEndDate) {
            const storedEndDate = new Date(storedData.timelineEndDate);
            if (isAfter(storedEndDate, maxEndDate)) maxEndDate = storedEndDate;
        }
      }

      setTimelineEndDate(addDays(maxEndDate, 3));

      // Initial hydration of orders from static data + overrides
      const initialOrdersWithOverrides = staticOrders.map((baseOrder, index) => {
        const override = loadedOverrides[baseOrder.id] || {};
        return {
          ...baseOrder,
          displayColor: override.displayColor || ORDER_COLORS[index % ORDER_COLORS.length],
          sewingRampUpScheme: override.sewingRampUpScheme || [{ day: 1, efficiency: baseOrder.budgetedEfficiency || 85 }],
          tna: override.tna || baseOrder.tna,
          bom: override.bom || baseOrder.bom,
          fcVsFcDetails: override.fcVsFcDetails || baseOrder.fcVsFcDetails,
        };
      });

      // Generate synthetic POs from the initially hydrated orders
      const newPos = generateSyntheticPos(initialOrdersWithOverrides);
      setSyntheticPoRecords(newPos);
      
      const poTotalsByOrder = newPos.reduce((acc, po) => {
          acc[po.orderId] = (acc[po.orderId] || 0) + po.quantities.total;
          return acc;
      }, {} as Record<string, number>);

      // Final order state with all dynamic data calculated
      const finalOrders = initialOrdersWithOverrides.map(order => {
          if (order.orderType === 'Forecasted') {
              const { totalProjectionQty, totalFrcQty } = calculateProjectionTotalsForOrder(order);
              return {
                  ...order,
                  totalProjectionQty,
                  totalFrcQty,
                  confirmedPoQty: poTotalsByOrder[order.id] || 0,
              };
          }
          return order;
      });

      setOrders(finalOrders);
      
    } catch (err) {
      console.error("Could not load schedule from localStorage", err);
      setOrders(staticOrders);
    } finally {
      setIsScheduleLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isScheduleLoaded) return;

    // This effect now correctly handles all dynamic data updates for orders.
    const cutOrderTotalsByOrder = cutOrderRecords.reduce((acc, co) => {
        if (!acc[co.orderId]) {
            acc[co.orderId] = { total: 0 };
            SIZES.forEach(size => acc[co.orderId][size] = 0);
        }
        (Object.keys(co.quantities) as (keyof SizeBreakdown)[]).forEach(key => {
            acc[co.orderId][key] = (acc[co.orderId][key] || 0) + (co.quantities[key] || 0);
        });
        return acc;
    }, {} as Record<string, SizeBreakdown>);

    const poTotalsByOrder = syntheticPoRecords.reduce((acc, po) => {
      acc[po.orderId] = (acc[po.orderId] || 0) + po.quantities.total;
      return acc;
    }, {} as Record<string, number>);

    const newOrders = staticOrders.map((baseOrder) => {
      const override = orderOverrides[baseOrder.id] || {};
      const hydratedTna: Tna = { ...(baseOrder.tna as Tna) };

      if(override.tna) {
          if (override.tna.processes) {
              const storedProcessMap = new Map(override.tna.processes.map(p => [p.processId, p]));
              hydratedTna.processes = (baseOrder.tna?.processes || []).map(baseProcess => {
                  const storedProcess = storedProcessMap.get(baseProcess.processId);
                  return storedProcess ? { ...baseProcess, ...storedProcess, earliestStartDate: storedProcess.earliestStartDate ? new Date(storedProcess.earliestStartDate) : undefined, latestStartDate: storedProcess.latestStartDate ? new Date(storedProcess.latestStartDate) : undefined } : baseProcess;
              });
          }
           if(override.tna.minRunDays) hydratedTna.minRunDays = override.tna.minRunDays;
      }
        
      const intermediateOrder: Order = {
          ...baseOrder,
          displayColor: override.displayColor || baseOrder.displayColor,
          sewingRampUpScheme: override.sewingRampUpScheme || baseOrder.sewingRampUpScheme,
          tna: hydratedTna,
          bom: override.bom || baseOrder.bom,
          fcVsFcDetails: override.fcVsFcDetails || baseOrder.fcVsFcDetails,
      };

      if (intermediateOrder.orderType === 'Forecasted') {
        const { totalProjectionQty, totalFrcQty } = calculateProjectionTotalsForOrder(intermediateOrder);
        intermediateOrder.totalProjectionQty = totalProjectionQty;
        intermediateOrder.totalFrcQty = totalFrcQty;
        intermediateOrder.confirmedPoQty = poTotalsByOrder[intermediateOrder.id] || 0;
        intermediateOrder.cutOrder = cutOrderTotalsByOrder[intermediateOrder.id] || { total: 0 };
      }
      return intermediateOrder;
    });

    setOrders(newOrders);

  }, [orderOverrides, isScheduleLoaded, cutOrderRecords, syntheticPoRecords]);


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
        cutOrderRecords,
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(STORE_KEY, serializedState);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [appMode, scheduledProcesses, sewingLines, orderOverrides, productionPlans, timelineEndDate, splitOrderProcesses, cutOrderRecords, isScheduleLoaded]);

  const setAppMode = useCallback((mode: AppMode) => {
    setAppModeState(mode);
  }, []);

  const updateOrderTna = useCallback((orderId: string, newTnaProcesses: TnaProcess[]) => {
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
  }, []);
  
  const updateSewingRampUpScheme = useCallback((orderId: string, scheme: RampUpEntry[]) => {
    setOrderOverrides(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], sewingRampUpScheme: scheme }
    }));
  }, []);

  const updateOrderColor = useCallback((orderId: string, color: string) => {
    setOrderOverrides(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], displayColor: color }
    }));
  }, []);

  const updateOrderMinRunDays = useCallback((orderId: string, minRunDays: Record<string, number>) => {
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
  }, []);

  const updateOrderBom = useCallback((orderId: string, componentName: string, field: keyof BomItem, value: any) => {
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
  }, [orders]);
  
  const updatePoEhd = useCallback((orderId: string, poNumber: string, newWeek: string) => {
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
  }, [syntheticPoRecords, orders]);


  const setSewingLines = useCallback((orderId: string, lines: number) => {
    setSewingLinesState(prev => ({ ...prev, [orderId]: lines }));
  }, []);

  const updateProductionPlan = useCallback((orderId: string, plan: Record<string, number>) => {
    setProductionPlans(prev => ({ ...prev, [orderId]: plan }));
  }, []);

  const toggleSplitProcess = useCallback((orderId: string, processId: string) => {
    const key = `${orderId}_${processId}`;
    setSplitOrderProcesses(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);
  

  const addCutOrderRecord = useCallback((record: CutOrderRecord) => {
    setCutOrderRecords(prev => [...prev, record]);
  }, []);

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
    cutOrderRecords,
    addCutOrderRecord,
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
