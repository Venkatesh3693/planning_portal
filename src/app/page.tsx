
"use client";

import { useState, useRef } from 'react';
import { addDays, startOfToday } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import { MACHINES, ORDERS, PROCESSES } from '@/lib/data';
import type { Order, ScheduledProcess } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WORK_DAY_MINUTES } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';

const ORDER_LEVEL_VIEW = 'order-level';
const SEWING_PROCESS_ID = 'sewing';

export default function Home() {
  const [unplannedOrders, setUnplannedOrders] = useState<Order[]>(ORDERS);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string>(SEWING_PROCESS_ID);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [isOrdersPanelVisible, setIsOrdersPanelVisible] = useState(true);
  const ordersListRef = useRef<HTMLDivElement>(null);


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

  const filteredUnplannedOrders = isOrderLevelView
    ? []
    : selectedProcessId === SEWING_PROCESS_ID
      ? unplannedOrders.filter(order => {
          const unscheduled = getUnscheduledProcessesForOrder(order);
          return unscheduled.some(p => p.id === selectedProcessId);
        })
      : unplannedOrders.filter(order => {
          // For other processes, only show orders if sewing is already scheduled
          const isSewingScheduled = sewingScheduledOrderIds.includes(order.id);
          if (!isSewingScheduled) return false;

          // And the current process is unscheduled for this order
          const unscheduled = getUnscheduledProcessesForOrder(order);
          return unscheduled.some(p => p.id === selectedProcessId);
        });

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className={cn(
            "grid h-full gap-6 p-4 sm:p-6 lg:p-8",
            isOrdersPanelVisible ? "grid-cols-[auto_1fr]" : "grid-cols-[auto_1fr]"
          )}>
          {!isOrderLevelView && (
            <div className={cn("transition-all duration-300", isOrdersPanelVisible ? "w-80" : "w-12")}>
              {isOrdersPanelVisible ? (
                <Card className="w-80">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Orders</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setIsOrdersPanelVisible(false)}>
                      <PanelLeftClose className="h-5 w-5" />
                    </Button>
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
                              {order.id}
                            </div>
                          )
                        })}
                        {filteredUnplannedOrders.length === 0 && (
                          <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                              {selectedProcessId === SEWING_PROCESS_ID
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
              ) : (
                <div className="flex justify-center">
                  <Button variant="ghost" size="icon" onClick={() => setIsOrdersPanelVisible(true)}>
                    <PanelRightClose className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className={cn(
            "h-full overflow-auto rounded-lg border bg-card",
            isOrderLevelView && 'col-span-2'
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
      </main>
    </div>
  );
}
