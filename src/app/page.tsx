
"use client";

import { useState } from 'react';
import { addDays, startOfToday } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import { MACHINES, ORDERS, PROCESSES } from '@/lib/data';
import type { Order, ScheduledProcess } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WORK_DAY_MINUTES } from '@/lib/data';

const ORDER_LEVEL_VIEW = 'order-level';

export default function Home() {
  const [unplannedOrders, setUnplannedOrders] = useState<Order[]>(ORDERS);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string>('sewing');

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
  };
  
  const handleUndoSchedule = (scheduledProcessId: string) => {
    const processToUndo = scheduledProcesses.find(p => p.id === scheduledProcessId);
    if (!processToUndo) return;
    
    // Add the order back to unplannedOrders if it's not already there
    const orderExistsInUnplanned = unplannedOrders.some(o => o.id === processToUndo.orderId);
    if (!orderExistsInUnplanned) {
      const orderToAddBack = ORDERS.find(o => o.id === processToUndo.orderId);
      if (orderToAddBack) {
        setUnplannedOrders(prev => [...prev, orderToAddBack]);
      }
    }

    // Remove the process from scheduledProcesses
    setScheduledProcesses(prev => prev.filter(p => p.id !== scheduledProcessId));
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

  const filteredUnplannedOrders = isOrderLevelView ? [] : unplannedOrders.filter(order => {
    const unscheduled = getUnscheduledProcessesForOrder(order);
    return unscheduled.some(p => p.id === selectedProcessId);
  });

  return (
    <div className="flex h-screen flex-col">
      <Header 
        processes={selectableProcesses} 
        selectedProcessId={selectedProcessId}
        onProcessChange={setSelectedProcessId}
      />
      <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
        <div className="grid h-full flex-1 grid-cols-1 gap-6 lg:grid-cols-4 overflow-hidden">
          <Card className={`lg:col-span-1 flex flex-col ${isOrderLevelView ? 'hidden' : ''}`}>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-2">
                  {filteredUnplannedOrders.map((order) => {
                    const canDrag = getUnscheduledProcessesForOrder(order).some(p => p.id === selectedProcessId);
                    if (!canDrag) return null;
                    
                    return (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, order.id, selectedProcessId)}
                        className="cursor-grab active:cursor-grabbing p-2 text-sm font-medium text-card-foreground hover:bg-secondary rounded-md"
                        title={order.id}
                      >
                        {order.id}
                      </div>
                    )
                  })}
                  {filteredUnplannedOrders.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-muted-foreground">No orders for this process.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className={`h-full overflow-auto rounded-lg border bg-card p-4 ${isOrderLevelView ? 'lg:col-span-4' : 'lg:col-span-3'}`}>
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
