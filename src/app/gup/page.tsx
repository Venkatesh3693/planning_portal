

'use client';

import { useState, useMemo, useEffect } from 'react';
import { addDays, startOfToday, getDay, set, isAfter, isBefore, addMinutes, compareAsc, compareDesc, subDays } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import { MACHINES, PROCESSES, WORK_DAY_MINUTES, SEWING_LINES } from '@/lib/data';
import type { Order, ScheduledProcess, UnplannedBatch, SewingLine, SewingLineGroup } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingCart } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { useSchedule } from '@/context/schedule-provider';
import MachinePanel from '@/components/gantt-chart/machine-panel';
import SplitProcessDialog from '@/components/gantt-chart/split-process-dialog';
import PabView from '@/components/pab/pab-view';
import { getSewingDaysForQuantity, calculateDailySewingOutput, calculateLatestSewingStartDate, getPackingBatchSize } from '@/lib/tna-calculator';
import { subBusinessDays, addBusinessDays, calculateEndDateTime, calculateStartDateTime } from '@/lib/utils';
import Link from 'next/link';


const SEWING_PROCESS_ID = 'sewing';
const PACKING_PROCESS_ID = 'packing';
const CUTTING_PROCESS_ID = 'cutting';
const WORKING_HOURS_START = 9;

export type DraggedItemData = {
    type: 'new-order';
    orderId: string;
    processId: string;
    quantity: number;
    tna: {
        startDate: Date;
        endDate: Date;
    } | null;
} | {
    type: 'new-batch';
    batch: UnplannedBatch;
} | {
    type: 'existing';
    process: ScheduledProcess;
};

type ProcessToSplitState = {
  processes: ScheduledProcess[];
  order: Order;
  numLines: number;
} | null;

const calculateSewingDuration = (order: Order, quantity: number): number => {
    const process = PROCESSES.find(p => p.id === SEWING_PROCESS_ID);
    if (!process || quantity <= 0 || process.sam <= 0) return 0;
    const budgetedEfficiency = order.budgetedEfficiency || 100;
    const effectiveSam = process.sam / (budgetedEfficiency / 100);
    return quantity * effectiveSam;
};


function GanttPageContent() {
  const { 
    appMode,
    orders, 
    scheduledProcesses, 
    setScheduledProcesses, 
    isScheduleLoaded, 
    sewingLines, 
    timelineEndDate, 
    setTimelineEndDate, 
    splitOrderProcesses, 
    toggleSplitProcess,
    processBatchSizes,
    packingBatchSizes,
  } = useSchedule();

  const [selectedProcessId, setSelectedProcessId] = useState<string>('sewing');
  const [viewMode, setViewMode] = useState<'day' | 'hour'>('day');
  
  const [filterOcn, setFilterOcn] = useState('');
  const [filterBuyer, setFilterBuyer] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<DateRange | undefined>(undefined);
  const [dueDateSort, setDueDateSort] = useState<'asc' | 'desc' | null>(null);
  const [draggedItem, setDraggedItem] = useState<DraggedItemData | null>(null);
  const [processToSplit, setProcessToSplit] = useState<ProcessToSplitState | null>(null);
  const [draggingProcessId, setDraggingProcessId] = useState<string | null>(null);

  const dates = useMemo(() => {
    const today = startOfToday();
    const dateArray: Date[] = [];
    let currentDate = today;
    
    const finalEndDate = timelineEndDate;

    while (currentDate <= finalEndDate) {
        if (getDay(currentDate) !== 0) { // Exclude Sundays
            dateArray.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
    }
    return dateArray;
  }, [timelineEndDate]);

  
  const buyerOptions = useMemo(() => [...new Set(orders.map(o => o.buyer))], [orders]);

  const latestStartDatesMap = useMemo(() => {
    const newMap = new Map<string, Date>();
    if (!isScheduleLoaded) return newMap;
  
    if (selectedProcessId !== 'pab' && selectedProcessId !== SEWING_PROCESS_ID) {
      for (const order of orders) {
        if (order.orderType === 'Forecasted') continue;
        const sewingProcessesForOrder = scheduledProcesses.filter(sp => sp.orderId === order.id && sp.processId === SEWING_PROCESS_ID);
        if (sewingProcessesForOrder.length === 0) continue;
  
        const isProcessInOrder = order.processIds.includes(selectedProcessId);
        if (!isProcessInOrder) continue;
  
        const sewingAnchorDate = sewingProcessesForOrder.reduce(
          (earliest, p) => (isBefore(p.startDateTime, earliest) ? p.startDateTime : earliest),
          sewingProcessesForOrder[0].startDateTime
        );
        const sewingProcessInfo = PROCESSES.find(p => p.id === SEWING_PROCESS_ID)!;
        const dailySewingOutput = calculateDailySewingOutput(order, sewingProcessesForOrder, sewingProcessInfo);
  
        const batchSize = selectedProcessId === PACKING_PROCESS_ID ? packingBatchSizes[order.id] : processBatchSizes[order.id];
        if (!batchSize || batchSize <= 0) continue;
  
        const totalBatches = Math.ceil(order.quantity / batchSize);
        const batchQuantities: number[] = Array.from({ length: totalBatches }, (_, i) =>
          (i < totalBatches - 1) ? batchSize : order.quantity - (i * batchSize)
        );
        const cumulativeQuantities = batchQuantities.reduce((acc, qty) => [...acc, (acc.length > 0 ? acc[acc.length - 1] : 0) + qty], [] as number[]);
  
        for (let i = 0; i < totalBatches; i++) {
          const batchNumber = i + 1;
          const key = `${order.id}-${selectedProcessId}-${batchNumber}`;
          let batchStartDate: Date;
  
          if (selectedProcessId === PACKING_PROCESS_ID) {
            const requiredSewingQty = cumulativeQuantities[i];
            const timeToSew = getSewingDaysForQuantity(requiredSewingQty, dailySewingOutput, sewingAnchorDate);
            batchStartDate = addBusinessDays(sewingAnchorDate, timeToSew);
          } else { // Pre-sewing activities
            const prerequisiteSewingQty = i > 0 ? cumulativeQuantities[i - 1] : 0;
            const timeToSewPrerequisites = getSewingDaysForQuantity(prerequisiteSewingQty, dailySewingOutput, sewingAnchorDate);
            const sewingStartDateForThisBatch = addBusinessDays(sewingAnchorDate, timeToSewPrerequisites);
  
            let predecessorChainStartDate = sewingStartDateForThisBatch;
            const predecessorChain = order.processIds.slice(
              order.processIds.indexOf(selectedProcessId),
              order.processIds.indexOf(SEWING_PROCESS_ID)
            ).reverse();
  
            for (const predId of predecessorChain) {
              const processInfo = PROCESSES.find(p => p.id === predId)!;
              const durationMinutes = batchQuantities[i] * processInfo.sam;
              const durationDays = Math.ceil(durationMinutes / WORK_DAY_MINUTES);
              predecessorChainStartDate = subBusinessDays(predecessorChainStartDate, durationDays);
            }
            batchStartDate = predecessorChainStartDate;
          }
          newMap.set(key, batchStartDate);
        }
      }
    }
    return newMap;
  }, [scheduledProcesses, selectedProcessId, orders, isScheduleLoaded, processBatchSizes, packingBatchSizes]);
  
  const latestSewingStartDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    if (!isScheduleLoaded) return map;

    orders.forEach(order => {
        if (order.orderType === 'Forecasted') return;
        const numLines = (sewingLines || []).filter((line: SewingLine) => (line.machineCounts['Single Needle Lock Stitch'] || 0) > 0).length;
        const latestDate = calculateLatestSewingStartDate(order, PROCESSES, numLines);
        if (latestDate) {
            map.set(order.id, latestDate);
        }
    });

    return map;
  }, [orders, sewingLines, isScheduleLoaded]);
  

  const { unplannedOrderItems, unplannedBatches } = useMemo(() => {
    if (selectedProcessId === 'pab' || !isScheduleLoaded) {
        return { unplannedOrderItems: [], unplannedBatches: [] };
    }

    const scheduledQuantities = new Map<string, number>();
    scheduledProcesses.forEach(p => {
        const key = `${p.orderId}_${p.processId}`;
        const currentQty = scheduledQuantities.get(key) || 0;
        scheduledQuantities.set(key, currentQty + p.quantity);
    });

    const orderItems: Order[] = [];
    const batches: UnplannedBatch[] = [];
    
    for (const order of orders) {
        if (order.orderType === 'Forecasted') continue; // Exclude forecasted orders

        const isProcessInOrder = order.processIds.includes(selectedProcessId);
        if (!isProcessInOrder) continue;

        const scheduledQty = scheduledQuantities.get(`${order.id}_${selectedProcessId}`) || 0;
        if (scheduledQty >= order.quantity) continue;
        
        const sewingProcessesForOrder = scheduledProcesses.filter(sp => sp.orderId === order.id && sp.processId === SEWING_PROCESS_ID);
        const isSewingScheduled = sewingProcessesForOrder.length > 0;
        
        const splitKey = `${order.id}_${selectedProcessId}`;
        const isSplit = splitOrderProcesses[splitKey];

        const batchSize = selectedProcessId === PACKING_PROCESS_ID 
          ? (packingBatchSizes[order.id] || 0) 
          : (processBatchSizes[order.id] || 0);

        if (isSplit && batchSize > 0 && (isSewingScheduled || selectedProcessId === SEWING_PROCESS_ID)) {
            const totalBatches = Math.ceil(order.quantity / batchSize);
            for (let i = 0; i < totalBatches; i++) {
                const batchNumber = i + 1;
                const scheduledBatches = new Set(scheduledProcesses
                    .filter(p => p.orderId === order.id && p.processId === selectedProcessId && p.batchNumber)
                    .map(p => p.batchNumber!)
                );
                if (scheduledBatches.has(batchNumber)) continue;
                
                const currentBatchQty = Math.min(batchSize, order.quantity - (i * batchSize));
                if (currentBatchQty <= 0) continue;

                const dateMapKey = `${order.id}-${selectedProcessId}-${batchNumber}`;
                const latestStartDate = latestStartDatesMap.get(dateMapKey);

                if(latestStartDate || selectedProcessId === SEWING_PROCESS_ID) { // For sewing, we'll get the date from the other map
                    batches.push({
                        orderId: order.id,
                        processId: selectedProcessId,
                        quantity: currentBatchQty,
                        batchNumber: batchNumber,
                        totalBatches: totalBatches,
                        latestStartDate: latestStartDate!, // We rely on latestSewingStartDateMap for sewing
                    });
                }
            }
        } else if (!isSplit) {
           orderItems.push(order);
        }
    }

    return { unplannedOrderItems: orderItems.sort((a,b) => (a.dueDate && b.dueDate) ? compareAsc(a.dueDate, b.dueDate) : 0), unplannedBatches: batches };
  }, [scheduledProcesses, selectedProcessId, orders, isScheduleLoaded, splitOrderProcesses, latestStartDatesMap, processBatchSizes, packingBatchSizes]);
  
  const predecessorEndDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    if (!isScheduleLoaded) return map;

    const scheduledProcessMap = new Map<string, ScheduledProcess[]>();
    for (const p of scheduledProcesses) {
        const key = `${p.orderId}-${p.processId}`;
        if (!scheduledProcessMap.has(key)) {
            scheduledProcessMap.set(key, []);
        }
        scheduledProcessMap.get(key)!.push(p);
    }
    
    const sewingAnchorDates: Record<string, Date> = {};
    const dailySewingOutputs: Record<string, Record<string, number>> = {};
    orders.forEach(order => {
        if (order.orderType === 'Forecasted') return;
        const sewingProcessesForOrder = scheduledProcesses.filter(sp => sp.orderId === order.id && sp.processId === SEWING_PROCESS_ID);
        if (sewingProcessesForOrder.length > 0) {
            sewingAnchorDates[order.id] = sewingProcessesForOrder.reduce(
                (earliest, p) => (isBefore(p.startDateTime, earliest) ? p.startDateTime : earliest),
                sewingProcessesForOrder[0].startDateTime
            );
            const sewingProcessInfo = PROCESSES.find(p => p.id === SEWING_PROCESS_ID)!;
            dailySewingOutputs[order.id] = calculateDailySewingOutput(order, sewingProcessesForOrder, sewingProcessInfo);
        }
    });

    for (const process of scheduledProcesses) {
        const order = orders.find(o => o.id === process.orderId);
        if (!order || order.orderType === 'Forecasted') continue;

        const processSequence = order.processIds;
        const currentIndex = processSequence.indexOf(process.processId);
        const key = `${process.orderId}-${process.processId}-${process.batchNumber || 0}`;

        if (currentIndex <= 0) continue; 

        const predecessorId = processSequence[currentIndex - 1];

        if (process.processId === SEWING_PROCESS_ID) {
            const predecessorProcesses = scheduledProcessMap.get(`${order.id}-${predecessorId}`) || [];
            const firstBatchOfPredecessor = predecessorProcesses.find(p => p.batchNumber === 1);
            if (firstBatchOfPredecessor) {
                map.set(key, firstBatchOfPredecessor.endDateTime);
            }
        }
        else if (currentIndex > processSequence.indexOf(SEWING_PROCESS_ID) && processSequence.includes(SEWING_PROCESS_ID)) {
             const sewingAnchorDate = sewingAnchorDates[order.id];
             const dailyOutput = dailySewingOutputs[order.id];
             
             if (sewingAnchorDate && dailyOutput) {
               const batchSize = packingBatchSizes[order.id] || 0;
               if (batchSize > 0) {
                 const cumulativeQtyNeeded = (process.batchNumber || 1) * batchSize;
                 const qtyToProduce = Math.min(cumulativeQtyNeeded, order.quantity);
                 const daysToProduce = getSewingDaysForQuantity(qtyToProduce, dailyOutput, sewingAnchorDate);
     
                 if (daysToProduce !== Infinity) {
                   const predecessorEndDate = addBusinessDays(sewingAnchorDate, daysToProduce - 1);
                   map.set(key, predecessorEndDate);
                 }
               }
             }
        }
        else { // Pre-sewing
            const predecessorProcesses = scheduledProcessMap.get(`${order.id}-${predecessorId}`) || [];
            const correspondingPredecessor = predecessorProcesses.find(p => p.batchNumber === process.batchNumber);
            if (correspondingPredecessor) {
                map.set(key, correspondingPredecessor.endDateTime);
            }
        }
    }
    return map;
}, [scheduledProcesses, orders, isScheduleLoaded, packingBatchSizes]);

  const predecessorEndDate = useMemo(() => {
    if (!draggedItem) return null;
    let key: string | null = null;
  
    if (draggedItem.type === 'existing') {
      const { process } = draggedItem;
      key = `${process.orderId}-${process.processId}-${process.batchNumber || 0}`;
    } else if (draggedItem.type === 'new-batch') {
      const { batch } = draggedItem;
      key = `${batch.orderId}-${batch.processId}-${batch.batchNumber || 0}`;
    } else if (draggedItem.type === 'new-order') {
        const order = orders.find(o => o.id === draggedItem.orderId);
        if (!order || order.orderType === 'Forecasted') return null;
        const processIndex = order.processIds.indexOf(draggedItem.processId);
        if (processIndex > 0) {
            const predecessorId = order.processIds[processIndex - 1];
            // For a new, unsplit order, it's effectively batch 0. We'll check if the predecessor is split.
            const predecessorProcesses = scheduledProcesses.filter(p => p.orderId === order.id && p.processId === predecessorId);
            if(draggedItem.processId === SEWING_PROCESS_ID) {
                 const firstPredecessorBatch = predecessorProcesses.find(p => p.batchNumber === 1);
                 if (firstPredecessorBatch) {
                     return predecessorEndDateMap.get(`${order.id}-${predecessorId}-1`);
                 }
            } else {
                 return predecessorEndDateMap.get(`${order.id}-${predecessorId}-0`);
            }
        }
    }
  
    return key ? predecessorEndDateMap.get(key) || null : null;
  }, [draggedItem, predecessorEndDateMap, orders, scheduledProcesses]);
  
  const draggedItemLatestStartDate = useMemo(() => {
    if (!draggedItem) return null;
  
    if (draggedItem.type === 'existing') {
      const { process } = draggedItem;
       if (process.processId === SEWING_PROCESS_ID) {
        return latestSewingStartDateMap.get(process.orderId);
      }
      const key = `${process.orderId}-${process.processId}-${process.batchNumber || 0}`;
      return latestStartDatesMap.get(key) || process.latestStartDate || null;
    }
  
    if (draggedItem.type === 'new-batch') {
      const { batch } = draggedItem;
      if (batch.processId === SEWING_PROCESS_ID) {
        return latestSewingStartDateMap.get(batch.orderId);
      }
       const key = `${batch.orderId}-${batch.processId}-${batch.batchNumber || 0}`;
       return latestStartDatesMap.get(key) || batch.latestStartDate || null;
    }
    
    if (draggedItem.type === 'new-order' && draggedItem.processId === SEWING_PROCESS_ID) {
      return latestSewingStartDateMap.get(draggedItem.orderId);
    }
  
    return null;
  }, [draggedItem, latestStartDatesMap, latestSewingStartDateMap]);

  const latestEndDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    if (!isScheduleLoaded) return map;

    const packingProcessInfo = PROCESSES.find(p => p.id === PACKING_PROCESS_ID);
    if (!packingProcessInfo) return map;

    orders.forEach(order => {
        if (order.orderType === 'Forecasted' || !order.dueDate) return;
        const packingKey = `${order.id}-${PACKING_PROCESS_ID}`;
        map.set(packingKey, order.dueDate);

        const packingBatchSizeForOrder = packingBatchSizes[order.id];
        if (packingBatchSizeForOrder > 0) {
            const finalBatchQty = order.quantity % packingBatchSizeForOrder;
            const lastBatchQuantity = finalBatchQty === 0 ? (order.quantity > 0 ? packingBatchSizeForOrder : 0) : finalBatchQty;
            
            if (lastBatchQuantity > 0) {
                const finalPackingDurationMinutes = lastBatchQuantity * packingProcessInfo.sam;
                const sewingFinishDeadline = calculateStartDateTime(order.dueDate, finalPackingDurationMinutes);

                const sewingKey = `${order.id}-${SEWING_PROCESS_ID}`;
                map.set(sewingKey, sewingFinishDeadline);
            }
        }
    });

    return map;
  }, [orders, isScheduleLoaded, packingBatchSizes]);

  const draggedItemLatestEndDate = useMemo(() => {
      if (!draggedItem) return null;
      let key: string | null = null;
      
      if (draggedItem.type === 'existing') {
        key = `${draggedItem.process.orderId}-${draggedItem.process.processId}`;
      } else if (draggedItem.type === 'new-order' || draggedItem.type === 'new-batch') {
        const processId = draggedItem.type === 'new-order' ? draggedItem.processId : draggedItem.batch.processId;
        const orderId = draggedItem.type === 'new-order' ? draggedItem.orderId : draggedItem.batch.orderId;
        key = `${orderId}-${processId}`;
      }

      return key ? latestEndDateMap.get(key) : null;
  }, [draggedItem, latestEndDateMap]);
  
  const ckDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    if (!isScheduleLoaded) return map;

    orders.forEach(order => {
        if (order.orderType === 'Forecasted') return;
        if(order.processIds.length > 0) {
            const firstProcessId = order.processIds[0];
            const key = `${order.id}-${firstProcessId}-1`;
            const firstProcessLatestStart = latestStartDatesMap.get(key);
            if (firstProcessLatestStart) {
                map.set(order.id, subDays(firstProcessLatestStart, 7));
            }
        }
    });
    return map;
  }, [isScheduleLoaded, orders, latestStartDatesMap]);

  const draggedItemCkDate = useMemo(() => {
    if (!draggedItem) return null;
    let orderId: string | undefined;

    if (draggedItem.type === 'new-order') orderId = draggedItem.orderId;
    if (draggedItem.type === 'new-batch') orderId = draggedItem.batch.orderId;
    if (draggedItem.type === 'existing') orderId = draggedItem.process.orderId;
    
    const processId = draggedItem.type === 'existing' ? draggedItem.process.processId : 
                      draggedItem.type === 'new-batch' ? draggedItem.batch.processId :
                      draggedItem.processId;
    
    if (orderId && processId === CUTTING_PROCESS_ID) {
      return ckDateMap.get(orderId);
    }
    return null;
  }, [draggedItem, ckDateMap]);


  const handleDropOnChart = (rowId: string, startDateTime: Date, draggedItemJSON: string) => {
    if (!draggedItemJSON) return;
  
    const droppedItem: DraggedItemData = {
      ...JSON.parse(draggedItemJSON),
      tna: JSON.parse(draggedItemJSON).tna ? {
        startDate: new Date(JSON.parse(draggedItemJSON).tna.startDate),
        endDate: new Date(JSON.parse(draggedItemJSON).tna.endDate),
      } : null,
      process: JSON.parse(draggedItemJSON).process ? {
        ...JSON.parse(draggedItemJSON).process,
        startDateTime: new Date(JSON.parse(draggedItemJSON).process.startDateTime),
        endDateTime: new Date(JSON.parse(draggedItemJSON).process.endDateTime),
        latestStartDate: JSON.parse(draggedItemJSON).process.latestStartDate ? new Date(JSON.parse(draggedItemJSON).process.latestStartDate) : undefined,
      } : undefined,
      batch: JSON.parse(draggedItemJSON).batch ? {
        ...JSON.parse(draggedItemJSON).batch,
        latestStartDate: new Date(JSON.parse(draggedItemJSON).batch.latestStartDate),
      } : undefined
    };
    
  
    let processToPlace: ScheduledProcess;
    let otherProcesses: ScheduledProcess[];
  
    if (droppedItem.type === 'new-order') {
      const order = orders.find(o => o.id === droppedItem.orderId)!;
      const process = PROCESSES.find(p => p.id === droppedItem.processId)!;
      
      let durationMinutes;
      if (process.id === SEWING_PROCESS_ID) {
        const qtyLeft = order.quantity - (order.produced?.total || 0);
        durationMinutes = calculateSewingDuration(order, qtyLeft);
      } else {
        durationMinutes = process.sam * droppedItem.quantity;
      }

      const finalStartDateTime = viewMode === 'day' 
        ? set(startDateTime, { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 })
        : startDateTime;
      
      const latestStartDate = droppedItem.processId === SEWING_PROCESS_ID 
        ? latestSewingStartDateMap.get(droppedItem.orderId)
        : undefined;
  
      processToPlace = {
        id: `${droppedItem.processId}-${droppedItem.orderId}-${crypto.randomUUID()}`,
        orderId: droppedItem.orderId,
        processId: droppedItem.processId,
        machineId: rowId,
        startDateTime: finalStartDateTime,
        endDateTime: calculateEndDateTime(finalStartDateTime, durationMinutes),
        durationMinutes,
        quantity: droppedItem.quantity,
        latestStartDate: latestStartDate,
      };
      otherProcesses = [...scheduledProcesses];
    } else if (droppedItem.type === 'new-batch') {
      const { batch } = droppedItem;
      const order = orders.find(o => o.id === batch.orderId)!;
      const process = PROCESSES.find(p => p.id === batch.processId)!;

      const durationMinutes = process.sam * batch.quantity;

      const finalStartDateTime = viewMode === 'day' 
        ? set(startDateTime, { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 })
        : startDateTime;

      processToPlace = {
        id: `${batch.processId}-${batch.orderId}-batch-${batch.batchNumber}-${crypto.randomUUID()}`,
        orderId: batch.orderId,
        processId: batch.processId,
        machineId: rowId,
        startDateTime: finalStartDateTime,
        endDateTime: calculateEndDateTime(finalStartDateTime, durationMinutes),
        durationMinutes,
        quantity: batch.quantity,
        isSplit: true,
        batchNumber: batch.batchNumber,
        totalBatches: batch.totalBatches,
        latestStartDate: batch.latestStartDate,
      };
      
      otherProcesses = [...scheduledProcesses];

    } else { // 'existing'
      const originalProcess: ScheduledProcess = droppedItem.process;
  
      const finalStartDateTime = viewMode === 'day'
        ? set(startDateTime, { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 })
        : startDateTime;
  
      processToPlace = {
        ...originalProcess,
        machineId: rowId,
        startDateTime: finalStartDateTime,
        endDateTime: calculateEndDateTime(finalStartDateTime, originalProcess.durationMinutes),
        isAutoScheduled: false, // Manually replanned
      };
      otherProcesses = scheduledProcesses.filter(p => p.id !== originalProcess.id);
    }
  
    const machineId = processToPlace.machineId;
    const processesOnSameMachine = otherProcesses
      .filter(p => p.machineId === machineId)
      .sort((a, b) => compareAsc(a.startDateTime, b.startDateTime));
  
    const finalProcesses: ScheduledProcess[] = otherProcesses.filter(p => p.machineId !== machineId);
    
    const directConflicts = processesOnSameMachine.filter(p =>
      processToPlace.startDateTime < p.endDateTime && processToPlace.endDateTime > p.startDateTime
    );

    let processesToCascade = directConflicts.sort((a, b) => compareAsc(a.startDateTime, b.startDateTime));
  
    const unaffectedOnMachine = processesOnSameMachine.filter(p => 
      !processesToCascade.find(c => c.id === p.id)
    );
    finalProcesses.push(...unaffectedOnMachine);
    finalProcesses.push(processToPlace);
  
    let lastProcessEnd = processToPlace.endDateTime;
  
    for (const processToShift of processesToCascade) {
      const newStart = isAfter(processToShift.startDateTime, lastProcessEnd) ? processToShift.startDateTime : lastProcessEnd;
      const newEnd = calculateEndDateTime(newStart, processToShift.durationMinutes);
  
      finalProcesses.push({
        ...processToShift,
        startDateTime: newStart,
        endDateTime: newEnd,
      });
  
      lastProcessEnd = newEnd;
    }
    
    let latestEndDate = lastProcessEnd;
    finalProcesses.forEach(p => {
        if (isAfter(p.endDateTime, latestEndDate)) {
            latestEndDate = p.endDateTime;
        }
    });

    if (isAfter(latestEndDate, timelineEndDate)) {
        setTimelineEndDate(addDays(latestEndDate, 3));
    }

    setScheduledProcesses(finalProcesses);
    setDraggedItem(null);
    setDraggingProcessId(null);
  };
  

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => {
    if (item.type === 'existing') {
        requestAnimationFrame(() => {
            setDraggingProcessId(item.process.id);
        });
    }
    const serializedItem = {
      ...item,
      process: item.type === 'existing' ? {
        ...item.process,
        startDateTime: item.process.startDateTime.toISOString(),
        endDateTime: item.process.endDateTime.toISOString(),
        latestStartDate: item.process.latestStartDate ? item.process.latestStartDate.toISOString() : undefined,
      } : undefined,
      batch: item.type === 'new-batch' ? {
        ...item.batch,
        latestStartDate: item.batch.latestStartDate.toISOString(),
      } : undefined,
    };
    const itemJSON = JSON.stringify(serializedItem);
    e.dataTransfer.setData('application/json', itemJSON);
    setDraggedItem(item);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggingProcessId(null);
  };

  const handleUndoSchedule = (scheduledProcessId: string) => {
    setScheduledProcesses(prev => {
      const processToUnschedule = prev.find(p => p.id === scheduledProcessId);
      if (processToUnschedule?.parentId && processToUnschedule?.isAutoScheduled) {
         return prev.filter(p => p.parentId !== processToUnschedule.parentId);
      }
      return prev.filter(p => p.id !== scheduledProcessId);
    });
  };

  const handleOpenSplitDialog = (process: ScheduledProcess) => {
    const order = orders.find(o => o.id === process.orderId)!;
    const numLines = (sewingLines || []).filter((line: SewingLine) => (line.machineCounts['Single Needle Lock Stitch'] || 0) > 0).length;
    if (process.parentId) {
      const siblings = scheduledProcesses.filter(p => p.parentId === process.parentId);
      setProcessToSplit({ processes: siblings, order, numLines });
    } else {
      setProcessToSplit({ processes: [process], order, numLines });
    }
  };
  
  const handleConfirmSplit = (originalProcesses: ScheduledProcess[], newQuantities: number[]) => {
    const primaryProcess = originalProcesses[0];
    const orderInfo = orders.find(o => o.id === primaryProcess.orderId)!;
    const numLines = 1;
  
    const parentId = primaryProcess.parentId || `${primaryProcess.id}-split-${crypto.randomUUID()}`;
    const originalIds = new Set(originalProcesses.map(p => p.id));
  
    const anchor = originalProcesses.reduce((earliest, p) => {
      return compareAsc(p.startDateTime, earliest.startDateTime) < 0 ? p : earliest;
    }, originalProcesses[0]);
  
    const newSplitProcesses: ScheduledProcess[] = newQuantities.map((quantity, index) => {
      let durationMinutes;
      if (primaryProcess.processId === SEWING_PROCESS_ID) {
        const qtyLeft = quantity;
        durationMinutes = calculateSewingDuration(orderInfo, qtyLeft);
      } else {
        const processInfo = PROCESSES.find(p => p.id === primaryProcess.processId)!;
        durationMinutes = quantity * processInfo.sam;
      }
      return {
        id: `${parentId}-child-${crypto.randomUUID()}`,
        orderId: primaryProcess.orderId,
        processId: primaryProcess.processId,
        machineId: anchor.machineId,
        quantity: quantity,
        durationMinutes: durationMinutes,
        startDateTime: new Date(), 
        endDateTime: new Date(),
        isSplit: true,
        parentId: parentId,
        batchNumber: index + 1,
      };
    });
  
    let lastProcessEnd = anchor.startDateTime;
    const cascadedSplitProcesses = newSplitProcesses.map(p => {
      const newStart = lastProcessEnd;
      const newEnd = calculateEndDateTime(newStart, p.durationMinutes);
      lastProcessEnd = newEnd;
      return { ...p, startDateTime: newStart, endDateTime: newEnd };
    });
    
    setScheduledProcesses(currentProcesses => {
      const otherProcesses = currentProcesses.filter(p => !originalIds.has(p.id));
      return [...otherProcesses, ...cascadedSplitProcesses];
    });
  
    setProcessToSplit(null);
  };


  const selectableProcesses = PROCESSES.filter(p => p.id !== 'outsourcing');

  const chartRows = useMemo(() => {
    if (selectedProcessId === 'sewing') {
      return SEWING_LINES || [];
    }
    return MACHINES.filter(m => m.processIds.includes(selectedProcessId));
  }, [selectedProcessId, sewingLines]);


  const chartProcesses = useMemo(() => {
    if (selectedProcessId === 'pab') return [];
    
    if (selectedProcessId === 'sewing') {
      return scheduledProcesses.filter(sp => sp.processId === 'sewing');
    }
    
    return scheduledProcesses.filter(sp => sp.processId === selectedProcessId);
  }, [scheduledProcesses, selectedProcessId]);
  
  const processesForGantt = chartProcesses.filter(p => p.id !== draggingProcessId);
  
  const sewingScheduledOrderIds = useMemo(() => {
    const orderIds = new Set<string>();
    scheduledProcesses.forEach(p => {
      if (p.processId === SEWING_PROCESS_ID) {
        orderIds.add(p.orderId);
      }
    });
    return orderIds;
  }, [scheduledProcesses]);

  const clearFilters = () => {
    setFilterOcn('');
    setFilterBuyer([]);
    setFilterDueDate(undefined);
    setDueDateSort(null);
  };

  const filteredUnplannedOrders = useMemo(() => {
    if (selectedProcessId === 'pab') return [];
    
    let baseOrders = unplannedOrderItems;

    const filtered = baseOrders.filter(order => {
      const ocnMatch = filterOcn ? order.ocn.toLowerCase().includes(filterOcn.toLowerCase()) : true;
      const buyerMatch = filterBuyer.length > 0 ? filterBuyer.includes(order.buyer) : true;
      const dueDateMatch = (() => {
        if (!filterDueDate || !filterDueDate.from || !order.dueDate) return true;
        const orderDueDate = new Date(order.dueDate);
        const fromDate = filterDueDate.from;
        if (!filterDueDate.to) return orderDueDate.getFullYear() === fromDate.getFullYear() &&
                                     orderDueDate.getMonth() === fromDate.getMonth() &&
                                     orderDueDate.getDate() === fromDate.getDate();

        return orderDueDate >= fromDate && orderDueDate <= filterDueDate.to;
      })();
      return ocnMatch && buyerMatch && dueDateMatch;
    });

    if (dueDateSort) {
      return filtered.sort((a, b) => {
        const dateA = new Date(a.dueDate!);
        const dateB = new Date(b.dueDate!);
        return dueDateSort === 'asc' ? compareAsc(dateA, dateB) : compareDesc(dateA, dateB);
      });
    }

    return filtered;
  }, [unplannedOrderItems, selectedProcessId, filterOcn, filterBuyer, filterDueDate, dueDateSort]);

  const hasActiveFilters = !!(filterOcn || filterBuyer.length > 0 || filterDueDate || dueDateSort);
  
  const handleBuyerFilterChange = (buyer: string) => {
    setFilterBuyer(prev => 
      prev.includes(buyer) 
        ? prev.filter(b => b !== buyer) 
        : [...prev, buyer]
    );
  };

  const handleClearSchedule = () => {
    if (selectedProcessId === 'pab') return;
    if (selectedProcessId === 'sewing') {
      setScheduledProcesses(prev => prev.filter(p => p.processId !== 'sewing'));
    } else {
      setScheduledProcesses(prev => prev.filter(p => p.processId !== selectedProcessId));
    }
  };

  const isPabView = selectedProcessId === 'pab';

  if (appMode === 'gut' || appMode === 'gut-new') {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Gantt Chart Not Available for GUT Mode</h2>
              <p className="mt-2 text-muted-foreground">
                  The planning and scheduling view is only applicable to GUP.
              </p>
              <Button asChild className="mt-6">
                <Link href="/orders">View GUT Orders</Link>
              </Button>
          </div>
        </main>
      </div>
    )
  }
  
  if (!isScheduleLoaded) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Loading your schedule...</p>
        </div>
    );
  }

  if (dates.length === 0 && isScheduleLoaded) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Initializing schedule dates...</p>
        </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" onDragEnd={handleDragEnd}>
      <Header />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b p-4 flex justify-between items-center">
          <Tabs value={selectedProcessId} onValueChange={setSelectedProcessId}>
            <TabsList>
              {selectableProcesses.map(process => (
                <TabsTrigger key={process.id} value={process.id}>
                  {process.name}
                </TabsTrigger>
              ))}
              <TabsTrigger value="pab">PAB Mode</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-4">
            {!isPabView && (
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'day' | 'hour')}>
                <TabsList>
                  <TabsTrigger value="day">Day View</TabsTrigger>
                  <TabsTrigger value="hour">Hour View</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-destructive hover:text-destructive" 
              onClick={handleClearSchedule} 
              title={`Clear all scheduled ${PROCESSES.find(p=>p.id === selectedProcessId)?.name} processes`}
              disabled={isPabView}
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Clear Schedule for Process</span>
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isPabView ? (
             <div className="h-full flex-1 overflow-auto rounded-lg border bg-card">
              <PabView 
                scheduledProcesses={scheduledProcesses}
                orders={orders}
                processes={PROCESSES}
                dates={dates}
              />
            </div>
          ) : (
            <div className="grid h-full items-start gap-4 grid-cols-[20rem_1fr]">
              <MachinePanel
                selectedProcessId={selectedProcessId}
                unplannedOrders={filteredUnplannedOrders}
                unplannedBatches={unplannedBatches}
                handleDragStart={handleDragStart}
                sewingScheduledOrderIds={sewingScheduledOrderIds}
                hasActiveFilters={hasActiveFilters}
                filterOcn={filterOcn}
                setFilterOcn={setFilterOcn}
                filterBuyer={filterBuyer}
                buyerOptions={buyerOptions}
                handleBuyerFilterChange={handleBuyerFilterChange}
                filterDueDate={filterDueDate}
                setFilterDueDate={setFilterDueDate}
                dueDateSort={dueDateSort}
                setDueDateSort={setDueDateSort}
                clearFilters={clearFilters}
                splitOrderProcesses={splitOrderProcesses}
                toggleSplitProcess={toggleSplitProcess}
                latestStartDatesMap={latestStartDatesMap}
                latestSewingStartDateMap={latestSewingStartDateMap}
              />
              
              <div className="h-full flex-1 overflow-auto rounded-lg border bg-card">
                  <GanttChart
                      rows={chartRows} 
                      dates={dates}
                      scheduledProcesses={processesForGantt}
                      allProcesses={scheduledProcesses}
                      orders={orders}
                      onDrop={handleDropOnChart}
                      onUndoSchedule={handleUndoSchedule}
                      onProcessDragStart={handleDragStart}
                      onSplitProcess={handleOpenSplitDialog}
                      viewMode={viewMode}
                      draggedItem={draggedItem}
                      latestStartDatesMap={latestStartDatesMap}
                      latestSewingStartDateMap={latestSewingStartDateMap}
                      draggedItemLatestStartDate={draggedItemLatestStartDate}
                      predecessorEndDate={predecessorEndDate}
                      predecessorEndDateMap={predecessorEndDateMap}
                      draggedItemLatestEndDate={draggedItemLatestEndDate}
                      draggedItemCkDate={draggedItemCkDate}
                    />
                </div>
            </div>
          )}
        </div>
      </main>
      
      <SplitProcessDialog
        processes={processToSplit?.processes ?? null}
        order={processToSplit?.order ?? null}
        numLines={processToSplit?.numLines ?? 0}
        isOpen={!!processToSplit}
        onOpenChange={(isOpen) => !isOpen && setProcessToSplit(null)}
        onConfirmSplit={handleConfirmSplit}
      />
    </div>
  );
}

export default function Home() {
  return (
    <GanttPageContent />
  );
}
