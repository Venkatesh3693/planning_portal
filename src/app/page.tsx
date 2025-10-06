

'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
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
import ScheduledProcessBar from '@/components/gantt-chart/scheduled-process';


const ORDER_LEVEL_VIEW = 'order-level';
const SEWING_PROCESS_ID = 'sewing';
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;


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
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [isOrdersPanelVisibleState, setIsOrdersPanelVisibleState] = useState(true);
  const ordersListRef = useRef<HTMLDivElement>(null);
  const [filterOcn, setFilterOcn] = useState('');
  const [filterBuyer, setFilterBuyer] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<DateRange | undefined>(undefined);
  const [draggedProcess, setDraggedProcess] = useState<ScheduledProcess | null>(null);
  const [draggedProcessTna, setDraggedProcessTna] = useState<TnaProcess | null>(null);
  const [dragPreview, setDragPreview] = useState<React.ReactNode | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState({ x: 0, y: 0 });


  const buyerOptions = useMemo(() => [...new Set(ORDERS.map(o => o.buyer))], []);

  const handleDropOnChart = (orderId: string, processId: string, machineId: string, startDateTime: Date) => {
    if (draggedProcess) {
      // Logic for moving an existing process
      let finalStartDateTime = startDateTime;
      if (viewMode === 'day') {
          const originalDate = draggedProcess.startDateTime;
          finalStartDateTime = setHours(setMinutes(startDateTime, originalDate.getMinutes()), originalDate.getHours());
      }
      
      const proposedEndDateTime = calculateEndDateTime(finalStartDateTime, draggedProcess.durationMinutes);

      setScheduledProcesses(currentProcesses => {
        const otherProcesses = currentProcesses.filter(p => p.id !== draggedProcess.id);

        const hasCollision = otherProcesses.some(p => {
          if (p.machineId !== machineId) return false;
          
          const existingEndDateTime = p.endDateTime;
          
          const startsDuring = isAfter(finalStartDateTime, p.startDateTime) && isBefore(finalStartDateTime, existingEndDateTime);
          const endsDuring = isAfter(proposedEndDateTime, p.startDateTime) && isBefore(proposedEndDateTime, existingEndDateTime);
          const spansOver = isBefore(finalStartDateTime, p.startDateTime) && isAfter(proposedEndDateTime, existingEndDateTime);
          const isSameStart = finalStartDateTime.getTime() === p.startDateTime.getTime();
          return startsDuring || endsDuring || spansOver || isSameStart;
        });

        if (!hasCollision) {
          const updatedProcess = {
              ...draggedProcess,
              machineId: machineId,
              startDateTime: finalStartDateTime,
              endDateTime: proposedEndDateTime,
          };
          return [...otherProcesses, updatedProcess];
        }
        
        return currentProcesses;
      });

    } else {
      // Logic for scheduling a new process from the side panel
      let finalStartDateTime = startDateTime;
      if (viewMode === 'day') {
        finalStartDateTime = set(startDateTime, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
      }

      const order = ORDERS.find((o) => o.id === orderId);
      const process = PROCESSES.find((p) => p.id === processId);
      if (!order || !process) return;

      const durationMinutes = process.sam * order.quantity;
      const endDateTime = calculateEndDateTime(finalStartDateTime, durationMinutes);
      
      const hasCollision = scheduledProcesses.some(p => {
        if (p.machineId !== machineId) return false;

        const existingEndDateTime = p.endDateTime;

        const startsDuring = isAfter(finalStartDateTime, p.startDateTime) && isBefore(finalStartDateTime, existingEndDateTime);
        const endsDuring = isAfter(endDateTime, p.startDateTime) && isBefore(endDateTime, existingEndDateTime);
        const spansOver = isBefore(finalStartDateTime, p.startDateTime) && isAfter(endDateTime, existingEndDateTime);
        const isSameStart = finalStartDateTime.getTime() === p.startDateTime.getTime();

        return startsDuring || endsDuring || spansOver || isSameStart;
      });
      
      if(!hasCollision) {
        const newScheduledProcess: ScheduledProcess = {
          id: `${processId}-${orderId}-${new Date().getTime()}`,
          orderId,
          processId,
          machineId,
          startDateTime: finalStartDateTime,
          endDateTime,
          durationMinutes,
        };

        setScheduledProcesses(prev => [...prev, newScheduledProcess]);
      }
    }
    setDraggedProcessTna(null);
    setDraggedProcess(null); // Clear dragged process after drop
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, orderId: string, processId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.setData('processId', processId);
    setDraggedProcess(null);
    setHoveredOrderId(null);

    const order = ORDERS.find(o => o.id === orderId);
    const tnaProcess = order?.tna?.processes.find(p => p.processId === processId);
    if(tnaProcess) {
      setDraggedProcessTna({
        ...tnaProcess,
        startDate: new Date(tnaProcess.startDate),
        endDate: new Date(tnaProcess.endDate)
      });
    }
  };
  
  const handleUndoSchedule = (scheduledProcessId: string) => {
    setScheduledProcesses(prev => prev.filter(p => p.id !== scheduledProcessId));
  };
  
  const handleScheduledProcessDragStart = (e: React.DragEvent<HTMLDivElement>, process: ScheduledProcess) => {
    e.dataTransfer.setData('processId', process.processId);
    e.dataTransfer.setData('orderId', process.orderId);
    e.dataTransfer.setData('scheduledProcessId', process.id);
    
    // Set native drag image to an empty one
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);

    // Set preview for custom drag layer
    setDragPreview(
      <div className="w-32">
        <ScheduledProcessBar
          item={process}
          isOrderLevelView={isOrderLevelView}
          isPreview
        />
      </div>
    );
    setDragPreviewPosition({ x: e.clientX, y: e.clientY });
    
    setDraggedProcess({
      ...process,
      startDateTime: new Date(process.startDateTime),
      endDateTime: new Date(process.endDateTime)
    });
  };
  
  const handleGanttDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if(dragPreview) {
      setDragPreviewPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDragEnd = () => {
    setDraggedProcess(null);
    setDraggedProcessTna(null);
    setDragPreview(null);
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

  const isOrderLevelView = selectedProcessId === ORDER_LEVEL_VIEW;
  const isOrdersPanelVisible = isOrdersPanelVisibleState && !isOrderLevelView;

  const unplannedOrders = useMemo(() => {
    const scheduledProcessIds = new Set(scheduledProcesses.map(sp => sp.processId));
    
    // In order level view, all orders that have at least one process NOT scheduled are "unplanned"
    if (isOrderLevelView) {
      return ORDERS.filter(order => {
        const unscheduledProcesses = getUnscheduledProcessesForOrder(order);
        return unscheduledProcesses.length > 0;
      });
    }
    
    // In process level view, an order is "unplanned" for THIS process if this process is not scheduled
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
        ? unplannedOrders.filter(order => {
            const unscheduled = getUnscheduledProcessesForOrder(order);
            return unscheduled.some(p => p.id === selectedProcessId);
          })
        : unplannedOrders.filter(order => {
            const isSewingScheduled = sewingScheduledOrderIds.has(order.id);
            if (!isSewingScheduled) return false;
            const unscheduled = getUnscheduledProcessesForOrder(order);
            return unscheduled.some(p => p.id === selectedProcessId);
          });
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

  }, [unplannedOrders, selectedProcessId, isOrderLevelView, sewingScheduledOrderIds, getUnscheduledProcessesForOrder, filterOcn, filterBuyer, filterDueDate]);


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
      <Header 
        isOrdersPanelVisible={isOrdersPanelVisible}
        setIsOrdersPanelVisible={setIsOrdersPanelVisibleState}
      />
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
              isOrdersPanelVisible ? "grid-cols-[20rem_1fr]" : "grid-cols-[1fr]"
            )}>
            
            {isOrdersPanelVisible && (
                <Card className="h-full">
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
                  <CardContent className="h-[calc(100%-4.5rem)]">
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-2 p-2 pt-0" ref={ordersListRef}>
                        {filteredUnplannedOrders.map((order) => {
                          const unscheduled = getUnscheduledProcessesForOrder(order);
                          const canDrag = unscheduled.some(p => p.id === selectedProcessId);

                          if (!canDrag && !isOrderLevelView) return null;

                          return (
                            <div
                              key={order.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, order.id, selectedProcessId)}
                              onDragEnd={handleDragEnd}
                              onMouseEnter={() => setHoveredOrderId(order.id)}
                              onMouseLeave={() => setHoveredOrderId(null)}
                              className={cn(
                                "cursor-grab active:cursor-grabbing p-2 text-sm font-medium text-card-foreground rounded-md",
                                "hover:bg-primary/10"
                              )}
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
            
            <div className={cn(
              "h-full flex-1 overflow-auto rounded-lg border bg-card",
              !isOrdersPanelVisible && "col-span-1"
              )}>
                <GanttChart 
                    rows={chartRows} 
                    dates={dates}
                    scheduledProcesses={chartProcesses}
                    onDrop={handleDropOnChart}
                    onUndoSchedule={handleUndoSchedule}
                    onScheduledProcessDragStart={handleScheduledProcessDragStart}
                    onScheduledProcessDragEnd={handleDragEnd}
                    onGanttDragOver={handleGanttDragOver}
                    isOrderLevelView={isOrderLevelView}
                    viewMode={viewMode}
                    draggedProcess={draggedProcess}
                    draggedProcessTna={draggedProcessTna}
                  />
              </div>
          </div>
        </div>
      </main>
      {dragPreview && (
        <div
            className="pointer-events-none fixed z-50"
            style={{
                transform: `translate(${dragPreviewPosition.x}px, ${dragPreviewPosition.y}px)`,
            }}
        >
            {dragPreview}
        </div>
      )}
    </div>
  );
}
