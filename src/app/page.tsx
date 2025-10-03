
'use client';

import { useState, useRef, useMemo } from 'react';
import { addDays, startOfToday, format, isSameDay } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import { MACHINES, ORDERS, PROCESSES } from '@/lib/data';
import type { Order, ScheduledProcess } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WORK_DAY_MINUTES } from '@/lib/data';
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
import { Filter, FilterX, ChevronDown } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


const ORDER_LEVEL_VIEW = 'order-level';
const SEWING_PROCESS_ID = 'sewing';

export default function Home() {
  const [unplannedOrders, setUnplannedOrders] = useState<Order[]>(ORDERS);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string>(ORDER_LEVEL_VIEW);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [isOrdersPanelVisible, setIsOrdersPanelVisible] = useState(true);
  const ordersListRef = useRef<HTMLDivElement>(null);
  const [filterOcn, setFilterOcn] = useState('');
  const [filterBuyer, setFilterBuyer] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<DateRange | undefined>();

  const buyerOptions = useMemo(() => [...new Set(ORDERS.map(o => o.buyer))], []);


  const handleDropOnChart = (orderId: string, processId: string, machineId: string, date: Date) => {
    const order = ORDERS.find((o) => o.id === orderId);
    const process = PROCESSES.find((p) => p.id === processId);

    if (!order || !process) return;

    const durationDays = Math.ceil((process.sam * order.quantity) / WORK_DAY_MINUTES);

    const newScheduledProcess: ScheduledProcess = {
      id: `${processId}-${orderId}-${new Date().getTime()}`,
      orderId,
      processId,
      machineId,
      startDate: date,
      durationDays,
    };
    
    setScheduledProcesses((prev) => [...prev, newScheduledProcess]);
    
    const orderInUnplanned = unplannedOrders.find(o => o.id === orderId);
    if(orderInUnplanned){
      const orderProcesses = PROCESSES.filter(p => orderInUnplanned.processIds.includes(p.id));
      const scheduledForThisOrder = scheduledProcesses.filter(sp => sp.orderId === orderId).length + 1;
      if (scheduledForThisOrder >= orderProcesses.length) {
        setUnplannedOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    }
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, orderId: string, processId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.setData('processId', processId);
    setHoveredOrderId(null);
  };
  
  const handleUndoSchedule = (scheduledProcessId: string) => {
    const processToUndo = scheduledProcesses.find(p => p.id === scheduledProcessId);
    if (!processToUndo) return;
    
    // Add the order back to unplannedOrders if it's not already there
    const orderExistsInUnplanned = unplannedOrders.some(o => o.id === processToUndo.orderId);
    if (!orderExistsInUnplanned) {
      const orderToAddBack = ORDERS.find(o => o.id === processToUndo.orderId);
      if (orderToAddBack) {
        setUnplannedOrders(prev => [orderToAddBack, ...prev]);
      }
    }

    // Remove the process from scheduledProcesses
    setScheduledProcesses(prev => prev.filter(p => p.id !== scheduledProcessId));
  };

  const handleDragEnd = () => {
    // This is a workaround to force the browser to re-evaluate hover states.
    if (ordersListRef.current) {
      ordersListRef.current.style.pointerEvents = 'none';
      setTimeout(() => {
        if (ordersListRef.current) {
          ordersListRef.current.style.pointerEvents = 'auto';
        }
      }, 0);
    }
  };

  const today = startOfToday();
  const dates = Array.from({ length: 30 }, (_, i) => addDays(today, i));

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

  const chartRows = isOrderLevelView 
    ? ORDERS.map(o => ({ id: o.id, name: o.ocn, processIds: o.processIds })) 
    : MACHINES.filter(m => m.processIds.includes(selectedProcessId));

  const chartProcesses = isOrderLevelView
    ? scheduledProcesses
    : scheduledProcesses.filter(sp => sp.processId === selectedProcessId);
  
  const sewingScheduledOrderIds = scheduledProcesses
    .filter(p => p.processId === SEWING_PROCESS_ID)
    .map(p => p.orderId);

  const clearFilters = () => {
    setFilterOcn('');
    setFilterBuyer([]);
    setFilterDueDate(undefined);
  };

  const filteredUnplannedOrders = useMemo(() => {
    let baseOrders = isOrderLevelView
      ? []
      : selectedProcessId === SEWING_PROCESS_ID
        ? unplannedOrders.filter(order => {
            const unscheduled = getUnscheduledProcessesForOrder(order);
            return unscheduled.some(p => p.id === selectedProcessId);
          })
        : unplannedOrders.filter(order => {
            const isSewingScheduled = sewingScheduledOrderIds.includes(order.id);
            if (!isSewingScheduled) return false;
            const unscheduled = getUnscheduledProcessesForOrder(order);
            return unscheduled.some(p => p.id === selectedProcessId);
          });
    
    return baseOrders.filter(order => {
      const ocnMatch = filterOcn ? order.ocn.toLowerCase().includes(filterOcn.toLowerCase()) : true;
      const buyerMatch = filterBuyer.length > 0 ? filterBuyer.includes(order.buyer) : true;
      const dueDateMatch = (() => {
        if (!filterDueDate || !filterDueDate.from) return true;
        if (!filterDueDate.to) return isSameDay(order.dueDate, filterDueDate.from);
        return order.dueDate >= filterDueDate.from && order.dueDate <= filterDueDate.to;
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

  return (
    <div className="flex h-screen flex-col">
      <Header 
        isOrdersPanelVisible={isOrdersPanelVisible}
        setIsOrdersPanelVisible={setIsOrdersPanelVisible}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b p-4">
          <Tabs value={selectedProcessId} onValueChange={setSelectedProcessId}>
            <TabsList>
              {selectableProcesses.map(process => (
                <TabsTrigger key={process.id} value={process.id}>
                  {process.name}
                </TabsTrigger>
              ))}
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
                  </CardHeader>
                  <CardContent className="h-[calc(100%-4.5rem)]">
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-2 p-2 pt-0" ref={ordersListRef}>
                        {filteredUnplannedOrders.map((order) => {
                          const unscheduled = getUnscheduledProcessesForOrder(order);
                          const canDrag = unscheduled.some(p => p.id === selectedProcessId);

                          if (!canDrag) return null;

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
                                  <span>Ship: {format(order.dueDate, 'MMM dd')}</span>
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
                                : selectedProcessId === SEWING_PROCESS_ID
                                  ? "No orders to schedule for sewing."
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
                    isOrderLevelView={isOrderLevelView}
                  />
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}

    