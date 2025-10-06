
'use client';

import { useState, useMemo } from 'react';
import { addDays, startOfToday, format, isSameDay, set, addMinutes, isBefore, isAfter, getDay, setHours, setMinutes, startOfDay } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import { MACHINES, ORDERS, PROCESSES } from '@/lib/data';
import type { Order, ScheduledProcess, TnaProcess } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Filter, FilterX, ChevronDown, Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppContext } from '@/context/app-provider';

const ORDER_LEVEL_VIEW = 'order-level';
const SEWING_PROCESS_ID = 'sewing';
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;

export type DraggedItem = {
    type: 'new';
    orderId: string;
    processId: string;
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

  const [selectedProcessId, setSelectedProcessId] = useState<string>(ORDER_LEVEL_VIEW);
  const [viewMode, setViewMode] = useState<'day' | 'hour'>('day');
  
  const [filterOcn, setFilterOcn] = useState('');
  const [filterBuyer, setFilterBuyer] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<DateRange | undefined>(undefined);
  
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);

  const buyerOptions = useMemo(() => [...new Set(ORDERS.map(o => o.buyer))], []);
  const isOrderLevelView = selectedProcessId === ORDER_LEVEL_VIEW;

  const handleDropOnChart = (rowId: string, startDateTime: Date) => {
    if (!draggedItem) return;

    let droppedProcess: ScheduledProcess;
    let otherProcesses = scheduledProcesses;

    // Define the process being dropped/moved
    if (draggedItem.type === 'new') {
        const order = ORDERS.find(o => o.id === draggedItem.orderId)!;
        const process = PROCESSES.find(p => p.id === draggedItem.processId)!;
        const durationMinutes = process.sam * order.quantity;
        
        const finalStartDateTime = viewMode === 'day' 
            ? set(startDateTime, { hours: WORKING_HOURS_START, minutes: 0 }) 
            : startDateTime;

        droppedProcess = {
            id: `${draggedItem.processId}-${draggedItem.orderId}-${Date.now()}`,
            orderId: draggedItem.orderId,
            processId: draggedItem.processId,
            machineId: isOrderLevelView ? order.id : rowId,
            startDateTime: finalStartDateTime,
            endDateTime: calculateEndDateTime(finalStartDateTime, durationMinutes),
            durationMinutes,
        };
    } else { // 'existing'
        const baseProcess = draggedItem.process;
        otherProcesses = scheduledProcesses.filter(p => p.id !== baseProcess.id);

        const finalStartDateTime = viewMode === 'day'
            ? set(startDateTime, { hours: baseProcess.startDateTime.getHours(), minutes: baseProcess.startDateTime.getMinutes() })
            : startDateTime;
        
        droppedProcess = {
            ...baseProcess,
            machineId: isOrderLevelView ? baseProcess.machineId : rowId,
            startDateTime: finalStartDateTime,
            endDateTime: calculateEndDateTime(finalStartDateTime, baseProcess.durationMinutes),
        };
    }

    const finalProcesses: ScheduledProcess[] = [];
    const processesOnSameMachine = otherProcesses
        .filter(p => p.machineId === droppedProcess.machineId)
        .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    
    // Add all processes from other machines
    finalProcesses.push(...otherProcesses.filter(p => p.machineId !== droppedProcess.machineId));
    finalProcesses.push(droppedProcess);

    let lastEndTime = droppedProcess.endDateTime;

    processesOnSameMachine.forEach(existingProcess => {
        const newStart = lastEndTime;
        
        // Check for collision with the newly dropped/moved item
        if (isAfter(droppedProcess.endDateTime, existingProcess.startDateTime)) {
            // Cascade: shift this process and subsequent ones
            const shiftedProcess: ScheduledProcess = {
                ...existingProcess,
                startDateTime: newStart,
                endDateTime: calculateEndDateTime(newStart, existingProcess.durationMinutes),
            };
            finalProcesses.push(shiftedProcess);
            lastEndTime = shiftedProcess.endDateTime;
        } else {
            // No collision, keep the process as is
            finalProcesses.push(existingProcess);
            // Update lastEndTime to the end of the latest process so far
            if (isAfter(existingProcess.endDateTime, lastEndTime)) {
                lastEndTime = existingProcess.endDateTime;
            }
        }
    });

    setScheduledProcesses(finalProcesses);
    setDraggedItem(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: DraggedItem) => {
    setDraggedItem(item);
  };
  
  const handleUndoSchedule = (scheduledProcessId: string) => {
    setScheduledProcesses(prev => prev.filter(p => p.id !== scheduledProcessId));
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const today = startOfToday();
  const dates = Array.from({ length: 30 }, (_, i) => addDays(today, i))
    .filter(date => getDay(date) !== 0); // Exclude Sundays

  const getUnscheduledProcessesForOrder = (order: Order) => {
    const scheduledProcessIdsForOrder = scheduledProcesses
      .filter(sp => sp.orderId === order.id)
      .map(sp => sp.processId);
    
    return PROCESSES.filter(p => 
      order.processIds.includes(p.id) && !scheduledProcessIdsForOrder.includes(p.id)
    );
  };
  
  const selectableProcesses = [
    { id: ORDER_LEVEL_VIEW, name: 'Order Level' },
    ...PROCESSES.filter(p => p.id !== 'outsourcing')
  ];

  const unplannedOrders = useMemo(() => {
    if (isOrderLevelView) {
      return ORDERS.filter(order => getUnscheduledProcessesForOrder(order).length > 0);
    }
    return ORDERS.filter(order => {
      const isProcessInOrder = order.processIds.includes(selectedProcessId);
      if (!isProcessInOrder) return false;
      const isProcessScheduledForOrder = scheduledProcesses.some(sp => sp.orderId === order.id && sp.processId === selectedProcessId);
      return !isProcessScheduledForOrder;
    });
  }, [scheduledProcesses, isOrderLevelView, selectedProcessId]);

  const chartRows = isOrderLevelView 
    ? ORDERS.map(o => ({ id: o.id, name: o.ocn, processIds: o.processIds })) 
    : MACHINES.filter(m => m.processIds.includes(selectedProcessId));

  const chartProcesses = useMemo(() => {
    return isOrderLevelView
      ? scheduledProcesses
      : scheduledProcesses.filter(sp => sp.processId === selectedProcessId);
  }, [isOrderLevelView, scheduledProcesses, selectedProcessId]);
  
  const sewingScheduledOrderIds = useMemo(() => 
    new Set(scheduledProcesses
      .filter(p => p.processId === SEWING_PROCESS_ID)
      .map(p => p.orderId)
    ), [scheduledProcesses]);

  const clearFilters = () => {
    setFilterOcn('');
    setFilterBuyer([]);
    setFilterDueDate(undefined);
  };

  const filteredUnplannedOrders = useMemo(() => {
    let baseOrders = unplannedOrders;

    if (!isOrderLevelView) {
      baseOrders = selectedProcessId === SEWING_PROCESS_ID
        ? unplannedOrders
        : unplannedOrders.filter(order => sewingScheduledOrderIds.has(order.id));
    }
    
    return baseOrders.filter(order => {
      const ocnMatch = filterOcn ? order.ocn.toLowerCase().includes(filterOcn.toLowerCase()) : true;
      const buyerMatch = filterBuyer.length > 0 ? filterBuyer.includes(order.buyer) : true;
      const dueDateMatch = (() => {
        if (!filterDueDate || !filterDueDate.from) return true;
        if (!filterDueDate.to) return isSameDay(new Date(order.dueDate), filterDueDate.from);
        return new Date(order.dueDate) >= filterDueDate.from && new Date(order.dueDate) <= filterDueDate.to;
      })();
      return ocnMatch && buyerMatch && dueDateMatch;
    });
  }, [unplannedOrders, selectedProcessId, isOrderLevelView, sewingScheduledOrderIds, filterOcn, filterBuyer, filterDueDate]);

  const hasActiveFilters = !!(filterOcn || filterBuyer.length > 0 || filterDueDate);
  
  const handleBuyerFilterChange = (buyer: string) => {
    setFilterBuyer(prev => 
      prev.includes(buyer) 
        ? prev.filter(b => b !== buyer) 
        : [...prev, buyer]
    );
  };

  const handleClearSchedule = () => {
    setScheduledProcesses([]);
  };

  return (
    <div className="flex h-screen flex-col">
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
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'day' | 'hour')}>
            <TabsList>
              <TabsTrigger value="day">Day View</TabsTrigger>
              <TabsTrigger value="hour">Hour View</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <div className={cn(
              "grid h-full items-start gap-4",
              !isOrderLevelView ? "grid-cols-[20rem_1fr]" : "grid-cols-[1fr]"
            )}>
            
            {!isOrderLevelView && (
                <Card className="h-full flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Orders</CardTitle>
                    <div className="flex items-center gap-2">
                      <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative">
                              <Filter className="h-4 w-4" />
                              {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                                </span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <div className="grid gap-4">
                              <div className="space-y-2">
                                <h4 className="font-medium leading-none">Filters</h4>
                                <p className="text-sm text-muted-foreground">
                                  Filter the unplanned orders.
                                </p>
                              </div>
                              <div className="grid gap-2">
                                <div className="space-y-2">
                                  <Label htmlFor="filter-ocn">OCN</Label>
                                  <Input id="filter-ocn" placeholder="e.g. ZAR4531" value={filterOcn} onChange={e => setFilterOcn(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Buyer</Label>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between">
                                          <span>
                                            {filterBuyer.length > 0 ? filterBuyer.join(', ') : 'All Buyers'}
                                          </span>
                                          <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                        <DropdownMenuLabel>Buyers</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {buyerOptions.map(buyer => (
                                          <DropdownMenuCheckboxItem
                                            key={buyer}
                                            checked={filterBuyer.includes(buyer)}
                                            onCheckedChange={() => handleBuyerFilterChange(buyer)}
                                            onSelect={(e) => e.preventDefault()}
                                          >
                                            {buyer}
                                          </DropdownMenuCheckboxItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <DatePicker date={filterDueDate} setDate={setFilterDueDate} />
                                 </div>
                                 {hasActiveFilters && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full justify-start text-destructive hover:text-destructive px-0">
                                      <FilterX className="mr-2 h-4 w-4" />
                                      Clear Filters
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleClearSchedule}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Clear Schedule</span>
                        </Button>
                      </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-2 p-2 pt-0">
                        {filteredUnplannedOrders.map((order) => {
                          const tnaProcess = order?.tna?.processes.find(p => p.processId === selectedProcessId) ?? null;
                          const item: DraggedItem = {
                            type: 'new',
                            orderId: order.id,
                            processId: selectedProcessId,
                            tna: tnaProcess ? { ...tnaProcess, startDate: new Date(tnaProcess.startDate), endDate: new Date(tnaProcess.endDate) } : null,
                          };

                          return (
                            <div
                              key={order.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, item)}
                              onDragEnd={handleDragEnd}
                              className="cursor-grab active:cursor-grabbing p-2 text-sm font-medium text-card-foreground rounded-md hover:bg-primary/10"
                              title={order.id}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold">{order.id}</span>
                                <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                                  <span>Ship: {format(new Date(order.dueDate), 'MMM dd')}</span>
                                  <span>Qty: {order.quantity}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {filteredUnplannedOrders.length === 0 && (
                          <div className="flex h-full items-center justify-center text-center">
                            <p className="text-sm text-muted-foreground">
                              {hasActiveFilters
                                ? "No orders match your filters."
                                : isOrderLevelView
                                ? "All orders have been scheduled."
                                : selectedProcessId === SEWING_PROCESS_ID
                                  ? "All sewing processes are scheduled."
                                  : "Schedule sewing for orders to see them here."
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
            )}
            
            <div className="h-full flex-1 overflow-auto rounded-lg border bg-card">
                <GanttChart 
                    rows={chartRows} 
                    dates={dates}
                    scheduledProcesses={chartProcesses}
                    onDrop={handleDropOnChart}
                    onUndoSchedule={handleUndoSchedule}
                    onProcessDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isOrderLevelView={isOrderLevelView}
                    viewMode={viewMode}
                    draggedItem={draggedItem}
                  />
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}

    