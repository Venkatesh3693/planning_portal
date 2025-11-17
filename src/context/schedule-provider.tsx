
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useMemo, useCallback } from 'react';
import type { ScheduledProcess, RampUpEntry, Order, Tna, TnaProcess, BomItem, Size, FcComposition, FcSnapshot, SyntheticPoRecord, CutOrderRecord, SizeBreakdown, ProjectionRow, FrcRow, Remark, SewingLine, Machine as IMachine, SewingLineGroup } from '@/lib/types';
import { ORDERS as staticOrders, PROCESSES, ORDER_COLORS, SIZES, MACHINES as staticMachines, SEWING_LINES as staticSewingLines } from '@/lib/data';
import { addDays, startOfToday, isAfter, getWeek } from 'date-fns';
import { getProcessBatchSize, getPackingBatchSize, PrjGenerator, FrcGenerator } from '@/lib/tna-calculator';

const STORE_KEY_PREFIX = 'stitchplan_schedule_v5_';
const FIRM_PO_WINDOW = 3;

type AppMode = 'gup' | 'gut' | 'gut-new';
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
  updateOrderTna: (orderId: string, newTnaProcesses: TnaProcess[]) => void;
  updateOrderColor: (orderId: string, color: string) => void;
  updateOrderMinRunDays: (orderId: string, minRunDays: Record<string, number>) => void;
  updateOrderBom: (orderId: string, componentName: string, field: keyof BomItem, value: any) => void;
  updatePoEhd: (orderId: string, poNumber: string, newWeek: string) => void;
  sewingLines: SewingLine[];
  setSewingLines: Dispatch<SetStateAction<SewingLine[]>>;
  sewingLineGroups: SewingLineGroup[];
  setSewingLineGroups: Dispatch<SetStateAction<SewingLineGroup[]>>;
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
  projectionData: ProjectionRow[];
  frcData: FrcRow[];
  updateFrcRemarks: (frcNumber: string, action: 'add' | 'delete' | 'reply', remark: Remark, parentId?: string) => void;
  machines: IMachine[];
  setMachines: Dispatch<SetStateAction<IMachine[]>>;
  updateSewingRampUpScheme: (orderId: string, scheme: RampUpEntry[]) => void;
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

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [appMode, setAppModeState] = useState<AppMode>('gup');
  const [orders, setOrders] = useState<Order[]>([]);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [sewingLines, setSewingLines] = useState<SewingLine[]>([]);
  const [sewingLineGroups, setSewingLineGroups] = useState<SewingLineGroup[]>([]);
  const [orderOverrides, setOrderOverrides] = useState<StoredOrderOverrides>({});
  const [productionPlans, setProductionPlans] = useState<ProductionPlans>({});
  const [splitOrderProcesses, setSplitOrderProcesses] = useState<Record<string, boolean>>({});
  const [timelineEndDate, setTimelineEndDate] = useState(() => addDays(startOfToday(), 90));
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);
  const [syntheticPoRecords, setSyntheticPoRecords] = useState<SyntheticPoRecord[]>([]);
  const [cutOrderRecords, setCutOrderRecords] = useState<CutOrderRecord[]>([]);
  const [projectionData, setProjectionData] = useState<ProjectionRow[]>([]);
  const [frcData, setFrcData] = useState<FrcRow[]>([]);
  const [machines, setMachines] = useState<IMachine[]>(staticMachines);


  useEffect(() => {
    try {
      const storedAppMode = localStorage.getItem(`${STORE_KEY_PREFIX}appMode`) as AppMode | null;
      const initialMode = storedAppMode || 'gup';
      setAppModeState(initialMode);
      
      const serializedState = localStorage.getItem(`${STORE_KEY_PREFIX}${initialMode}`);
      let loadedOverrides: StoredOrderOverrides = {};
      let maxEndDate = addDays(startOfToday(), 90);
      
      if (serializedState) {
        const storedData = JSON.parse(serializedState);
        
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

        if(storedData.frcData) {
          setFrcData(storedData.frcData.map((f: FrcRow) => ({...f, remarks: f.remarks || []})));
        }

        if(storedData.machines) {
          setMachines(storedData.machines);
        }
        
        if(storedData.sewingLineGroups) {
          setSewingLineGroups(storedData.sewingLineGroups);
        }
        setSewingLines(storedData.sewingLines || staticSewingLines);

      } else {
        setSewingLines(staticSewingLines);
      }

      setTimelineEndDate(addDays(maxEndDate, 3));

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

      const newPos = generateSyntheticPos(initialOrdersWithOverrides);
      setSyntheticPoRecords(newPos);
      
      const poTotalsByOrder = newPos.reduce((acc, po) => {
          acc[po.orderId] = (acc[po.orderId] || 0) + po.quantities.total;
          return acc;
      }, {} as Record<string, number>);

      const finalOrders = initialOrdersWithOverrides.map(order => {
          if (order.orderType === 'Forecasted') {
              return {
                  ...order,
                  confirmedPoQty: poTotalsByOrder[order.id] || 0,
              };
          }
          return order;
      });

      setOrders(finalOrders);
      
    } catch (err) {
      console.error("Could not load schedule from localStorage", err);
      setOrders(staticOrders);
      setMachines(staticMachines);
      setSewingLines(staticSewingLines);
    } finally {
      setIsScheduleLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isScheduleLoaded) return;
    try {
      const stateToSave = {
        scheduledProcesses,
        orderOverrides,
        productionPlans,
        timelineEndDate,
        splitOrderProcesses,
        cutOrderRecords,
        frcData,
        machines,
        sewingLineGroups,
        sewingLines,
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(`${STORE_KEY_PREFIX}${appMode}`, serializedState);
      localStorage.setItem(`${STORE_KEY_PREFIX}appMode`, appMode);
    } catch (err) {
      console.error("Could not save schedule to localStorage", err);
    }
  }, [appMode, scheduledProcesses, orderOverrides, productionPlans, timelineEndDate, splitOrderProcesses, cutOrderRecords, frcData, machines, sewingLineGroups, sewingLines, isScheduleLoaded]);

  const setAppMode = useCallback((mode: AppMode) => {
    window.location.reload(); // Simplest way to reload state for the new mode
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

    const updateFrcRemarks = useCallback((frcNumber: string, action: 'add' | 'delete' | 'reply', remark: Remark, parentId?: string) => {
        setFrcData(prevData => {
            return prevData.map(frc => {
                if (frc.frcNumber === frcNumber && action === 'add') {
                    return { ...frc, remarks: [...(frc.remarks || []), remark] };
                }
                if (action === 'reply' || action === 'delete') {
                    const updateReplies = (remarks: Remark[]): Remark[] => {
                        return remarks.map(r => {
                            if (r.id === parentId && action === 'reply') {
                                return { ...r, replies: [...(r.replies || []), remark] };
                            }
                            if (action === 'delete' && r.id === parentId) { 
                                return null;
                            }
                            if (r.replies) {
                                return { ...r, replies: updateReplies(r.replies) };
                            }
                            return r;
                        }).filter(Boolean) as Remark[];
                    };
                    
                    if (action === 'delete' && !parentId) { // Top level delete
                        const updatedRemarks = (frc.remarks || []).filter(r => r.id !== remark.id);
                        return { ...frc, remarks: updatedRemarks };
                    }
                    
                    const newRemarks = updateReplies(frc.remarks || []);
                    return { ...frc, remarks: newRemarks };
                }
                return frc;
            });
        });
    }, []);

  const sewingLinesForGantt: SewingLines = useMemo(() =>
    Object.entries(orderOverrides).reduce((acc, [orderId, override]) => {
      // This is a placeholder, actual sewingLines state is now derived from machines
      return acc;
    }, {} as SewingLines),
  [orderOverrides]);

  const { processBatchSizes, packingBatchSizes } = useMemo(() => {
    const pbs: Record<string, number> = {};
    const qbs: Record<string, number> = {};
    const sewingLinesByOrder = orders.reduce((acc, order) => {
      // This is a placeholder as `sewingLines` context is now an array
      // In a real scenario, we might need a map from order ID to number of allocated lines
      acc[order.id] = 1; 
      return acc;
    }, {} as Record<string, number>);

    orders.forEach(order => {
        const numLines = sewingLinesByOrder[order.id] || 1;
        pbs[order.id] = getProcessBatchSize(order, PROCESSES, numLines);
        qbs[order.id] = getPackingBatchSize(order, PROCESSES);
    });
    return { processBatchSizes: pbs, packingBatchSizes: qbs };
  }, [orders]);


  const value: ScheduleContextType = { 
    appMode,
    setAppMode,
    orders,
    scheduledProcesses, 
    setScheduledProcesses, 
    updateOrderTna,
    updateOrderColor,
    updateOrderMinRunDays,
    updateOrderBom,
    updatePoEhd,
    sewingLines, // now the derived array
    setSewingLines, // now the state setter for the array
    sewingLineGroups,
    setSewingLineGroups,
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
    projectionData,
    frcData,
    updateFrcRemarks,
    machines,
    setMachines,
    updateSewingRampUpScheme,
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
