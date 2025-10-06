
'use client';

import { useState, useMemo } from 'react';
import { addDays, startOfToday, getDay, set, isAfter, addMinutes } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import { MACHINES, ORDERS, PROCESSES } from '@/lib/data';
import type { Order, ScheduledProcess, TnaProcess } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { useAppContext } from '@/context/app-provider';
import MachinePanel from '@/components/gantt-chart/machine-panel';
import SplitProcessDialog from '@/components/gantt-chart/split-process-dialog';

const SEWING_PROCESS_ID = 'sewing';
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;

export type DraggedItemData = {
    type: 'new';
    orderId: string;
    processId: string;
    quantity: number;
    tna: TnaProcess | null;
} | {
    type: 'existing';
    process: ScheduledProcess;
};

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


export default function Home() {
  const { scheduledProcesses, setScheduledProcesses } = useAppContext();

  const [selectedProcessId, setSelectedProcessId] = useState<string>(PROCESSES[0].id);
  const [viewMode, setViewMode] = useState<'day' | 'hour'>('day');
  
  const [filterOcn, setFilterOcn] = useState('');
  const [filterBuyer, setFilterBuyer] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<DateRange | undefined>(undefined);
  const [draggedItem, setDraggedItem] = useState<DraggedItemData | null>(null);
  const [processToSplit, setProcessToSplit] = useState<ScheduledProcess | null>(null);


  const buyerOptions = useMemo(() => [...new Set(ORDERS.map(o => o.buyer))], []);

  const handleDropOnChart = (rowId: string, startDateTime: Date, draggedItemJSON: string) => {
    if (!draggedItemJSON) return;
  
    const droppedItem: DraggedItemData = JSON.parse(draggedItemJSON);
  
    // 1. Determine the process being dropped/moved
    let processToPlace: ScheduledProcess;
    let otherProcesses: ScheduledProcess[];
  
    if (droppedItem.type === 'new') {
      const order = ORDERS.find(o => o.id === droppedItem.orderId)!;
      const process = PROCESSES.find(p => p.id === droppedItem.processId)!;
      const durationMinutes = process.sam * droppedItem.quantity;
      const finalStartDateTime = viewMode === 'day'
        ? set(startDateTime, { hours: WORKING_HOURS_START, minutes: 0 })
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
      // Convert date strings back to Date objects
      const originalProcess: ScheduledProcess = {
        ...droppedItem.process,
        startDateTime: new Date(droppedItem.process.startDateTime),
        endDateTime: new Date(droppedItem.process.endDateTime),
      };
  
      const finalStartDateTime = viewMode === 'day'
        ? set(startDateTime, { hours: originalProcess.startDateTime.getHours(), minutes: originalProcess.startDateTime.getMinutes() })
        : startDateTime;
  
      processToPlace = {
        ...originalProcess,
        machineId: rowId,
        startDateTime: finalStartDateTime,
        endDateTime: calculateEndDateTime(finalStartDateTime, originalProcess.durationMinutes),
      };
      // For a "lift and drop", the item is removed from the state when drag starts.
      // So otherProcesses is the current state.
      otherProcesses = scheduledProcesses;
    }
  
    // 2. Identify conflicts and prepare for cascade
    const machineId = processToPlace.machineId;
    const processesOnSameMachine = otherProcesses
      .filter(p => p.machineId === machineId)
      .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  
    const finalProcesses: ScheduledProcess[] = otherProcesses.filter(p => p.machineId !== machineId);
    
    // Find processes that start AFTER the new/moved process begins
    const directConflicts = processesOnSameMachine.filter(p =>
      processToPlace.startDateTime < p.endDateTime && processToPlace.endDateTime > p.startDateTime
    );

    let processesToCascade = directConflicts.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  
    // Add back unaffected processes on the same machine
    const unaffectedOnMachine = processesOnSameMachine.filter(p => 
      !processesToCascade.find(c => c.id === p.id)
    );
    finalProcesses.push(...unaffectedOnMachine);
    finalProcesses.push(processToPlace); // Add the item we just dropped
  
    // 3. Perform the cascade
    let lastProcessEnd = processToPlace.endDateTime;
  
    for (const processToShift of processesToCascade) {
      // The new start is either its original start or the end of the previous process, whichever is later
      const newStart = isAfter(processToShift.startDateTime, lastProcessEnd) ? processToShift.startDateTime : lastProcessEnd;
      const newEnd = calculateEndDateTime(newStart, processToShift.durationMinutes);
  
      finalProcesses.push({
        ...processToShift,
        startDateTime: newStart,
        endDateTime: newEnd,
      });
  
      lastProcessEnd = newEnd;
    }
  
    // 4. Set the final state
    setScheduledProcesses(finalProcesses);
    setDraggedItem(null); // Clear dragged item after drop
  };
  

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => {
    const itemJSON = JSON.stringify(item);
    e.dataTransfer.setData('application/json', itemJSON);
    setDraggedItem(item);
    
    if (item.type === 'existing') {
        // "Lift" the item from the board by removing it from the state
        // It will be re-added on drop
        setTimeout(() => {
            setScheduledProcesses(prev => prev.filter(p => p.id !== item.process.id));
        }, 0);
    }
  };
  
  const handleDragEnd = () => {
    // This part is tricky. A simple solution is to just rely on the onDrop to always re-add it.
    // If a drop doesn't happen on a valid target, the item will be gone.
    // A better approach would be to restore it if the drop was not successful.
    // For now, let's assume drops are always successful on the chart.
    // We check if an item was being dragged and if it's not on the board anymore.
    // This is not a perfect solution.
    if(draggedItem && draggedItem.type === 'existing' && !scheduledProcesses.find(p => p.id === draggedItem.process.id)) {
        setScheduledProcesses(prev => [...prev, draggedItem.process]);
    }
    setDraggedItem(null);
  };

  const handleUndoSchedule = (scheduledProcessId: string) => {
    setScheduledProcesses(prev => {
      const processToUnschedule = prev.find(p => p.id === scheduledProcessId);
      // If it's a split process, unschedule all its siblings too
      if (processToUnschedule?.parentId) {
        return prev.filter(p => p.parentId !== processToUnschedule.parentId);
      }
      return prev.filter(p => p.id !== scheduledProcessId);
    });
  };

  const handleOpenSplitDialog = (process: ScheduledProcess) => {
    setProcessToSplit(process);
  };

  const handleConfirmSplit = (originalProcess: ScheduledProcess, newQuantities: number[]) => {
    const processInfo = PROCESSES.find(p => p.id === originalProcess.processId)!;
    const parentId = originalProcess.parentId || `${originalProcess.id}-split-${Date.now()}`;
    
    const newSplitProcesses: ScheduledProcess[] = newQuantities.map((quantity, index) => {
      const durationMinutes = quantity * processInfo.sam;
      return {
        id: `${parentId}-child-${index}`,
        orderId: originalProcess.orderId,
        processId: originalProcess.processId,
        machineId: originalProcess.machineId,
        quantity: quantity,
        durationMinutes: durationMinutes,
        startDateTime: new Date(), // Temporary, will be updated below
        endDateTime: new Date(),   // Temporary, will be updated below
        isSplit: true,
        parentId: parentId,
      };
    });

    // Cascade the new processes on the same machine
    let lastProcessEnd = originalProcess.startDateTime;
    const cascadedSplitProcesses = newSplitProcesses.map(p => {
      const newStart = lastProcessEnd;
      const newEnd = calculateEndDateTime(newStart, p.durationMinutes);
      lastProcessEnd = newEnd;
      return { ...p, startDateTime: newStart, endDateTime: newEnd };
    });

    setScheduledProcesses(prev => {
      const otherProcesses = prev.filter(p => 
        p.id !== originalProcess.id && p.parentId !== originalProcess.parentId
      );
      return [...otherProcesses, ...cascadedSplitProcesses];
    });

    setProcessToSplit(null);
  };


  const today = startOfToday();
  const dates = Array.from({ length: 90 }, (_, i) => addDays(today, i))
    .filter(date => getDay(date) !== 0); // Exclude Sundays

  
  const selectableProcesses = PROCESSES.filter(p => p.id !== 'outsourcing');

  const unplannedOrders = useMemo(() => {
    const scheduledOrderProcesses = new Map<string, number>();
     scheduledProcesses.forEach(p => {
        const key = `${p.orderId}_${p.processId}`;
        scheduledOrderProcesses.set(key, (scheduledOrderProcesses.get(key) || 0) + p.quantity);
     });
    
    return ORDERS.filter(order => {
      const isProcessInOrder = order.processIds.includes(selectedProcessId);
      if (!isProcessInOrder) return false;
      
      const scheduledQuantity = scheduledOrderProcesses.get(`${order.id}_${selectedProcessId}`) || 0;
      return scheduledQuantity < order.quantity;
    });
  }, [scheduledProcesses, selectedProcessId]);
  

  const chartRows = MACHINES.filter(m => m.processIds.includes(selectedProcessId));

  const chartProcesses = useMemo(() => {
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
  };

  const filteredUnplannedOrders = useMemo(() => {
    let baseOrders = unplannedOrders;

    if (selectedProcessId !== SEWING_PROCESS_ID) {
      baseOrders = unplannedOrders.filter(order => sewingScheduledOrderIds.has(order.id));
    }
    
    return baseOrders.filter(order => {
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
  }, [unplannedOrders, selectedProcessId, sewingScheduledOrderIds, filterOcn, filterBuyer, filterDueDate]);

  const hasActiveFilters = !!(filterOcn || filterBuyer.length > 0 || filterDueDate);
  
  const handleBuyerFilterChange = (buyer: string) => {
    setFilterBuyer(prev => 
      prev.includes(buyer) 
        ? prev.filter(b => b !== buyer) 
        : [...prev, buyer]
    );
  };

  const handleClearSchedule = () => {
    const remainingProcesses = scheduledProcesses.filter(p => p.processId !== selectedProcessId);
    setScheduledProcesses(remainingProcesses);
  };

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
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-4">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'day' | 'hour')}>
              <TabsList>
                <TabsTrigger value="day">Day View</TabsTrigger>
                <TabsTrigger value="hour">Hour View</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleClearSchedule} title={`Clear all scheduled ${PROCESSES.find(p=>p.id === selectedProcessId)?.name} processes`}>
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Clear Schedule for Process</span>
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <div className="grid h-full items-start gap-4 grid-cols-[20rem_1fr]">
            
            <MachinePanel
              selectedProcessId={selectedProcessId}
              filteredUnplannedOrders={filteredUnplannedOrders}
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
              clearFilters={clearFilters}
            />
            
            <div className="h-full flex-1 overflow-auto rounded-lg border bg-card">
                <GanttChart 
                    rows={chartRows} 
                    dates={dates}
                    scheduledProcesses={chartProcesses}
                    onDrop={handleDropOnChart}
                    onUndoSchedule={handleUndoSchedule}
                    onProcessDragStart={handleDragStart}
                    onSplitProcess={handleOpenSplitDialog}
                    viewMode={viewMode}
                    draggedItem={draggedItem}
                  />
              </div>
          </div>
        </div>
      </main>
      
      <SplitProcessDialog
        process={processToSplit}
        isOpen={!!processToSplit}
        onOpenChange={(isOpen) => !isOpen && setProcessToSplit(null)}
        onConfirmSplit={handleConfirmSplit}
      />
    </div>
  );
}
    
