
"use client";

import { useState } from 'react';
import { addDays, startOfToday } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import OrderCard from '@/components/gantt-chart/order-card';
import { MACHINES, ORDERS, PROCESSES } from '@/lib/data';
import type { Order, ScheduledProcess, Process, Machine } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WORK_DAY_MINUTES } from '@/lib/data';

export default function Home() {
  const [unplannedOrders, setUnplannedOrders] = useState<Order[]>(ORDERS);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string>('sewing');

  const handleDropOnChart = (orderId: string, processId: string, machineId: string, date: Date) => {
    const order = unplannedOrders.find((o) => o.id === orderId);
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
    
    const orderProcesses = PROCESSES.filter(p => order.processIds.includes(p.id));
    const scheduledForThisOrder = scheduledProcesses.filter(sp => sp.orderId === orderId).length + 1;

    if (scheduledForThisOrder >= orderProcesses.length) {
      setUnplannedOrders((prev) => prev.filter((o) => o.id !== orderId));
    }
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, orderId: string, processId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.setData('processId', processId);
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

  const filteredMachines = MACHINES.filter(m => m.processIds.includes(selectedProcessId));

  const filteredProcesses = PROCESSES.filter(p => p.id === selectedProcessId);

  const filteredUnplannedOrders = unplannedOrders.filter(order => {
    const unscheduled = getUnscheduledProcessesForOrder(order);
    return unscheduled.some(p => p.id === selectedProcessId);
  });
  
  const selectableProcesses = PROCESSES.filter(p => p.id !== 'outsourcing');

  return (
    <div className="flex h-screen flex-col">
      <Header 
        processes={selectableProcesses} 
        selectedProcessId={selectedProcessId}
        onProcessChange={setSelectedProcessId}
      />
      <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
        <div className="grid h-full flex-1 grid-cols-1 gap-6 lg:grid-cols-4 overflow-hidden">
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader>
              <CardTitle>Unplanned Orders</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {filteredUnplannedOrders.map((order) => {
                    const unscheduled = getUnscheduledProcessesForOrder(order).filter(p => p.id === selectedProcessId);
                    if (unscheduled.length === 0) return null;
                    return (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        processes={unscheduled}
                        onDragStart={handleDragStart} 
                      />
                    )
                  })}
                  {filteredUnplannedOrders.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-muted-foreground">No unplanned orders for this process.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="lg:col-span-3 h-full overflow-auto rounded-lg border bg-card p-4">
             <GanttChart 
                machines={filteredMachines} 
                dates={dates}
                scheduledProcesses={scheduledProcesses.filter(sp => sp.processId === selectedProcessId)}
                onDrop={handleDropOnChart}
              />
          </div>
        </div>
      </main>
    </div>
  );
}
