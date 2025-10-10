

'use client';

import { useState, useMemo, useEffect } from 'react';
import { addDays, startOfToday, getDay, set, isAfter, addMinutes, compareAsc, compareDesc, subMinutes } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import { MACHINES, PROCESSES, WORK_DAY_MINUTES, ORDER_COLORS } from '@/lib/data';
import type { Order, ScheduledProcess, TnaProcess } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { useSchedule } from '@/context/schedule-provider';
import MachinePanel from '@/components/gantt-chart/machine-panel';
import SplitProcessDialog from '@/components/gantt-chart/split-process-dialog';
import PabView from '@/components/pab/pab-view';
import { useToast } from '@/hooks/use-toast';
import { calculateProcessBatchSize, calculateSewingDurationDays } from '@/lib/tna-calculator';


const SEWING_PROCESS_ID = 'sewing';
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;

export type DraggedItemData = {
    type: 'new';
    orderId: string;
    processId: string;
    quantity: number;
    tna: {
        startDate: Date;
        endDate: Date;
    } | null;
} | {
    type: 'existing';
    process: ScheduledProcess;
};

type ProcessToSplitState = {
  processes: ScheduledProcess[];
  order: Order;
  numLines: number;
} | null;


// Helper function to calculate end time considering only working hours
const calculateEndDateTime = (startDateTime: Date, totalDurationMinutes: number): Date => {
  let remainingMinutes = totalDurationMinutes;
  let currentDateTime = new Date(startDateTime);

  // If starting after working hours, move to the start of the next working day
  if (currentDateTime.getHours() >= WORKING_HOURS_END) {
    currentDateTime = set(addDays(currentDateTime, 1), { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 });
  }
  
  // If starting before working hours, move to the start of the working day
  if (currentDateTime.getHours() < WORKING_HOURS_START) {
     currentDateTime = set(currentDateTime, { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 });
  }

  while (remainingMinutes > 0) {
    // Skip Sundays (Sunday=0)
    const dayOfWeek = getDay(currentDateTime);
    if (dayOfWeek === 0) { // Sunday
      currentDateTime = set(addDays(currentDateTime, 1), { hours: WORKING_HOURS_START, minutes: 0 });
      continue;
    }

    const endOfWorkDay = set(currentDateTime, { hours: WORKING_HOURS_END, minutes: 0, seconds: 0, milliseconds: 0 });
    const minutesLeftInDay = (endOfWorkDay.getTime() - currentDateTime.getTime()) / (1000 * 60);

    if (remainingMinutes <= minutesLeftInDay) {
      currentDateTime = addMinutes(currentDateTime, remainingMinutes);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= minutesLeftInDay;
      currentDateTime = set(addDays(currentDateTime, 1), { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }
  }

  return currentDateTime;
};

// Helper function to calculate start time by retro-planning
const calculateStartDateTime = (endDateTime: Date, totalDurationMinutes: number): Date => {
  let remainingMinutes = totalDurationMinutes;
  let currentDateTime = new Date(endDateTime);

  while (remainingMinutes > 0) {
    // Skip Sundays
    const dayOfWeek = getDay(currentDateTime);
    if (dayOfWeek === 0) {
      currentDateTime = set(addDays(currentDateTime, -1), { hours: WORKING_HOURS_END, minutes: 0 });
      continue;
    }

    const startOfWorkDay = set(currentDateTime, { hours: WORKING_HOURS_START, minutes: 0 });
    const minutesIntoDay = (currentDateTime.getTime() - startOfWorkDay.getTime()) / (1000 * 60);
    
    if (remainingMinutes <= minutesIntoDay) {
      currentDateTime = subMinutes(currentDateTime, remainingMinutes);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= minutesIntoDay;
      currentDateTime = set(addDays(currentDateTime, -1), { hours: WORKING_HOURS_END, minutes: 0 });
    }
  }

  return currentDateTime;
};

const calculateSewingDuration = (order: Order, quantity: number): number => {
    const process = PROCESSES.find(p => p.id === SEWING_PROCESS_ID);
    if (!process || quantity <= 0 || process.sam <= 0) return 0;
    
    const rampUpScheme = order.sewingRampUpScheme || [{ day: 1, efficiency: order.budgetedEfficiency || 100 }];
    let remainingQty = quantity;
    let totalMinutes = 0;
    
    while (remainingQty > 0) {
        const currentProductionDay = Math.floor(totalMinutes / WORK_DAY_MINUTES) + 1;
        
        let efficiency = rampUpScheme[rampUpScheme.length - 1]?.efficiency; // Default to peak
        for (const entry of rampUpScheme) {
          if(currentProductionDay >= entry.day) {
            efficiency = entry.efficiency;
          }
        }
        
        if (!efficiency || efficiency <= 0) {
            return Infinity; // Avoid infinite loops
        }

        const effectiveSam = process.sam / (efficiency / 100);
        const outputPerMinute = 1 / effectiveSam;
        
        const minutesLeftInWorkDay = WORK_DAY_MINUTES - (totalMinutes % WORK_DAY_MINUTES);
        const maxOutputForRestOfDay = minutesLeftInWorkDay * outputPerMinute;

        if (remainingQty <= maxOutputForRestOfDay) {
            totalMinutes += remainingQty / outputPerMinute;
            remainingQty = 0;
        } else {
            totalMinutes += minutesLeftInWorkDay;
            remainingQty -= maxOutputForRestOfDay;
        }
    }
    return totalMinutes;
};

const handleAutoSchedule = (
    order: Order,
    processId: string,
    machineId: string,
    allProcesses: ScheduledProcess[],
    numLines: number
): { processesToAdd: ScheduledProcess[], processIdsToRemove: string[] } | null => {
    
    const sewingProcessesForOrder = allProcesses
        .filter(p => p.orderId === order.id && p.processId === SEWING_PROCESS_ID)
        .sort((a, b) => compareAsc(a.startDateTime, b.startDateTime));
    
    if (sewingProcessesForOrder.length === 0) {
        return null;
    }

    const processBatchSize = calculateProcessBatchSize(order, numLines);
    if(processBatchSize <= 0) return null;

    const numBatches = Math.ceil(order.quantity / processBatchSize);
    
    const batches: {quantity: number; batchNumber: number}[] = [];
    let remainingQty = order.quantity;
    for(let i=0; i<numBatches; i++){
        const batchQty = Math.min(processBatchSize, remainingQty);
        batches.push({ quantity: batchQty, batchNumber: i+1 });
        remainingQty -= batchQty;
    }

    const parentId = `${order.id}-${processId}-${crypto.randomUUID()}`;
    const processesToAdd: ScheduledProcess[] = [];
    
    const baseSewingStartTime = sewingProcessesForOrder[0].startDateTime;
    const sewingPitchDurationMinutes = calculateSewingDuration(order, processBatchSize) / numLines;

    for (const batch of batches) {
        const pitchOffsetMinutes = (batch.batchNumber - 1) * sewingPitchDurationMinutes;
        let anchorDate = calculateEndDateTime(baseSewingStartTime, pitchOffsetMinutes);

        const processSequence = [...order.processIds];
        const sewingIndex = processSequence.indexOf(SEWING_PROCESS_ID);
        const currentIndex = processSequence.indexOf(processId);

        if (currentIndex >= sewingIndex) continue;

        const processesToPlan = processSequence.slice(currentIndex, sewingIndex).reverse();

        for (const pId of processesToPlan) {
            const processInfo = PROCESSES.find(p => p.id === pId)!;
            const durationMinutes = batch.quantity * processInfo.sam;
            const startDate = calculateStartDateTime(anchorDate, durationMinutes);
            const endDate = anchorDate;
            
            processesToAdd.push({
                id: `${parentId}-child-${crypto.randomUUID()}`,
                orderId: order.id,
                processId: pId,
                machineId: machineId, // Initially place on the dropped machine
                quantity: batch.quantity,
                durationMinutes: durationMinutes,
                startDateTime: startDate,
                endDateTime: endDate,
                isSplit: true,
                isAutoScheduled: true,
                parentId: parentId,
                batchNumber: batch.batchNumber,
            });
            anchorDate = startDate;
        }
    }
    
    return { processesToAdd, processIdsToRemove: [] };
};


function GanttPageContent() {
  const { orders, scheduledProcesses, setScheduledProcesses, isScheduleLoaded, sewingLines, timelineEndDate, setTimelineEndDate } = useSchedule();
  const { toast } = useToast();

  const [selectedProcessId, setSelectedProcessId] = useState<string>('sewing');
  const [viewMode, setViewMode] = useState<'day' | 'hour'>('day');
  
  const [filterOcn, setFilterOcn] = useState('');
  const [filterBuyer, setFilterBuyer] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<DateRange | undefined>(undefined);
  const [dueDateSort, setDueDateSort] = useState<'asc' | 'desc' | null>(null);
  const [draggedItem, setDraggedItem] = useState<DraggedItemData | null>(null);
  const [processToSplit, setProcessToSplit] = useState<ProcessToSplitState>(null);

  const dates = useMemo(() => {
    const today = startOfToday();
    const dateArray: Date[] = [];
    let currentDate = today;
    
    // Ensure the timeline always extends at least to the timelineEndDate
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
      } : undefined
    };

    const order = orders.find(o => o.id === (droppedItem.type === 'new' ? droppedItem.orderId : droppedItem.process.orderId))!;
    const processId = droppedItem.type === 'new' ? droppedItem.processId : droppedItem.process.processId;
    const processIndex = order.processIds.indexOf(processId);
    const sewingIndex = order.processIds.indexOf(SEWING_PROCESS_ID);

    if (droppedItem.type === 'new' && processIndex < sewingIndex) {
        const autoScheduleResult = handleAutoSchedule(order, processId, rowId, scheduledProcesses, sewingLines[order.id] || 1);
        
        if (!autoScheduleResult) {
            toast({
                variant: "destructive",
                title: "Scheduling Error",
                description: `Please schedule the Sewing process for order ${order.id} first to enable automatic planning.`
            });
            return;
        }

        const { processesToAdd } = autoScheduleResult;
        
        setScheduledProcesses(prev => [
            ...prev.filter(p => !(p.orderId === order.id && p.processId === processId)), // Remove any existing placeholders for this order-process
            ...processesToAdd
        ]);
        
        // Extend timeline if needed for the new processes
        let latestEndDate = timelineEndDate;
        processesToAdd.forEach(p => {
            if (isAfter(p.endDateTime, latestEndDate)) {
                latestEndDate = p.endDateTime;
            }
        });
        if (isAfter(latestEndDate, timelineEndDate)) {
            setTimelineEndDate(addDays(latestEndDate, 3));
        }

        return;
    }
  
    let processToPlace: ScheduledProcess;
    let otherProcesses: ScheduledProcess[];
  
    if (droppedItem.type === 'new') {
      const order = orders.find(o => o.id === droppedItem.orderId)!;
      const process = PROCESSES.find(p => p.id === droppedItem.processId)!;
      
      let durationMinutes;
      if (process.id === SEWING_PROCESS_ID) {
        const singleLineDuration = calculateSewingDuration(order, droppedItem.quantity);
        durationMinutes = singleLineDuration;
      } else {
        durationMinutes = process.sam * droppedItem.quantity;
      }

      const finalStartDateTime = viewMode === 'day' 
        ? set(startDateTime, { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 })
        : startDateTime;
  
      processToPlace = {
        id: `${droppedItem.processId}-${droppedItem.orderId}-${Date.now()}`,
        orderId: droppedItem.orderId,
        processId: droppedItem.processId,
        machineId: rowId,
        startDateTime: finalStartDateTime,
        endDateTime: calculateEndDateTime(finalStartDateTime, durationMinutes),
        durationMinutes,
        quantity: droppedItem.quantity,
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
      // Important: Filter out the process being moved from the list of other processes.
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
    
    // Extend timeline if needed
    let latestEndDate = lastProcessEnd;
    finalProcesses.forEach(p => {
        if (isAfter(p.endDateTime, latestEndDate)) {
            latestEndDate = p.endDateTime;
        }
    });

    if (isAfter(latestEndDate, timelineEndDate)) {
        setTimelineEndDate(addDays(latestEndDate, 3)); // Add 3-day buffer
    }

    setScheduledProcesses(finalProcesses);
    setDraggedItem(null);
  };
  

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => {
    // Serialize the item with dates converted to ISO strings
    const serializedItem = {
      ...item,
      tna: item.tna ? {
          startDate: item.tna.startDate.toISOString(),
          endDate: item.tna.endDate.toISOString(),
      } : null,
      process: item.type === 'existing' ? {
        ...item.process,
        startDateTime: item.process.startDateTime.toISOString(),
        endDateTime: item.process.endDateTime.toISOString(),
      } : undefined
    };
    const itemJSON = JSON.stringify(serializedItem);
    e.dataTransfer.setData('application/json', itemJSON);
    setDraggedItem(item);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleUndoSchedule = (scheduledProcessId: string) => {
    setScheduledProcesses(prev => {
      const processToUnschedule = prev.find(p => p.id === scheduledProcessId);
      // If it's an auto-scheduled batch, remove all sibling batches for that process
      if (processToUnschedule?.parentId && processToUnschedule?.isAutoScheduled) {
         return prev.filter(p => p.parentId !== processToUnschedule.parentId);
      }
      return prev.filter(p => p.id !== scheduledProcessId);
    });
  };

  const handleOpenSplitDialog = (process: ScheduledProcess) => {
    const order = orders.find(o => o.id === process.orderId)!;
    const numLines = sewingLines[process.orderId] || 1;
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
  
    // Use existing parentId if re-splitting, otherwise create a new one.
    const parentId = primaryProcess.parentId || `${primaryProcess.id}-split-${crypto.randomUUID()}`;
    const originalIds = new Set(originalProcesses.map(p => p.id));
  
    // Determine the anchor point for cascading. Use the earliest start time from the original set.
    const anchor = originalProcesses.reduce((earliest, p) => {
      return compareAsc(p.startDateTime, earliest.startDateTime) < 0 ? p : earliest;
    }, originalProcesses[0]);
  
    const newSplitProcesses: ScheduledProcess[] = newQuantities.map((quantity, index) => {
      let durationMinutes;
      if (primaryProcess.processId === SEWING_PROCESS_ID) {
        durationMinutes = calculateSewingDuration(orderInfo, quantity);
      } else {
        const processInfo = PROCESSES.find(p => p.id === primaryProcess.processId)!;
        durationMinutes = quantity * processInfo.sam;
      }
      return {
        id: `${parentId}-child-${crypto.randomUUID()}`,
        orderId: primaryProcess.orderId,
        processId: primaryProcess.processId,
        machineId: anchor.machineId, // Start all on the same machine
        quantity: quantity,
        durationMinutes: durationMinutes,
        startDateTime: new Date(), // Placeholder, will be replaced
        endDateTime: new Date(),   // Placeholder, will be replaced
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
      // Filter out the old processes being replaced
      const otherProcesses = currentProcesses.filter(p => !originalIds.has(p.id));
      return [...otherProcesses, ...cascadedSplitProcesses];
    });
  
    setProcessToSplit(null);
  };


  const selectableProcesses = PROCESSES.filter(p => p.id !== 'outsourcing');

  const unplannedOrders = useMemo(() => {
    if (selectedProcessId === 'pab' || !isScheduleLoaded) return [];

    const scheduledOrderProcesses = new Map<string, number>();
     scheduledProcesses.forEach(p => {
        const key = `${p.orderId}_${p.processId}`;
        const currentQty = scheduledOrderProcesses.get(key) || 0;
        scheduledOrderProcesses.set(key, currentQty + p.quantity);
     });
    
    return orders.filter(order => {
      const isProcessInOrder = order.processIds.includes(selectedProcessId);
      if (!isProcessInOrder) return false;
      
      const scheduledQuantity = scheduledOrderProcesses.get(`${order.id}_${selectedProcessId}`) || 0;
      return scheduledQuantity < order.quantity;
    });
  }, [scheduledProcesses, selectedProcessId, orders, isScheduleLoaded]);
  

  const chartRows = MACHINES.filter(m => m.processIds.includes(selectedProcessId));

  const chartProcesses = useMemo(() => {
    if (selectedProcessId === 'pab') return [];
    return scheduledProcesses.filter(sp => sp.processId === selectedProcessId);
  }, [scheduledProcesses, selectedProcessId]);
  
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
    let baseOrders = unplannedOrders;

    const filtered = baseOrders.filter(order => {
      const ocnMatch = filterOcn ? order.ocn.toLowerCase().includes(filterOcn.toLowerCase()) : true;
      const buyerMatch = filterBuyer.length > 0 ? filterBuyer.includes(order.buyer) : true;
      const dueDateMatch = (() => {
        if (!filterDueDate || !filterDueDate.from) return true;
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
        const dateA = new Date(a.dueDate);
        const dateB = new Date(b.dueDate);
        return dueDateSort === 'asc' ? compareAsc(dateA, dateB) : compareDesc(dateA, dateB);
      });
    }

    return filtered;
  }, [unplannedOrders, selectedProcessId, filterOcn, filterBuyer, filterDueDate, dueDateSort]);

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
    setScheduledProcesses(prev => prev.filter(p => p.processId !== selectedProcessId));
  };

  if (dates.length === 0 || !isScheduleLoaded) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Loading your schedule...</p>
        </div>
    );
  }
  
  const isPabView = selectedProcessId === 'pab';

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
                filteredUnplannedOrders={filteredUnplannedOrders}
                handleDragStart={handleDragStart}
                sewingScheduledOrderIds={sewingScheduledOrderIds}
                sewingLines={sewingLines}
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
              />
              
              <div className="h-full flex-1 overflow-auto rounded-lg border bg-card">
                  <GanttChart 
                      rows={chartRows} 
                      dates={dates}
                      scheduledProcesses={chartProcesses}
                      allProcesses={scheduledProcesses}
                      onDrop={handleDropOnChart}
                      onUndoSchedule={handleUndoSchedule}
                      onProcessDragStart={handleDragStart}
                      onSplitProcess={handleOpenSplitDialog}
                      viewMode={viewMode}
                      draggedItem={draggedItem}
                      orders={orders}
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

