"use client";

import { useState } from 'react';
import { addDays, startOfToday } from 'date-fns';
import { Header } from '@/components/layout/header';
import GanttChart from '@/components/gantt-chart/gantt-chart';
import ProcessCard from '@/components/gantt-chart/process-card';
import { MACHINES, PROCESSES, WORK_DAY_MINUTES } from '@/lib/data';
import type { Process, ScheduledProcess } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Home() {
  const [unscheduledProcesses, setUnscheduledProcesses] = useState<Process[]>(PROCESSES);
  const [scheduledProcesses, setScheduledProcesses] = useState<ScheduledProcess[]>([]);

  const handleDropOnChart = (processId: string, machineId: string, date: Date) => {
    const process = unscheduledProcesses.find((p) => p.id === processId);
    if (!process) return;

    const durationDays = Math.ceil((process.sam * process.orderQuantity) / WORK_DAY_MINUTES);

    const newScheduledProcess: ScheduledProcess = {
      id: `${processId}-${new Date().getTime()}`,
      processId,
      machineId,
      startDate: date,
      durationDays,
    };
    
    setScheduledProcesses((prev) => [...prev, newScheduledProcess]);
    setUnscheduledProcesses((prev) => prev.filter((p) => p.id !== processId));
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, processId: string) => {
    e.dataTransfer.setData('processId', processId);
  };

  const today = startOfToday();
  const dates = Array.from({ length: 30 }, (_, i) => addDays(today, i));

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
        <div className="grid h-full flex-1 grid-cols-1 gap-6 lg:grid-cols-4 overflow-hidden">
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader>
              <CardTitle>Unscheduled Processes</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {unscheduledProcesses.map((process) => (
                    <ProcessCard key={process.id} process={process} onDragStart={handleDragStart} />
                  ))}
                  {unscheduledProcesses.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-muted-foreground">All processes scheduled!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="lg:col-span-3 h-full overflow-auto rounded-lg border bg-card p-4">
             <GanttChart 
                machines={MACHINES} 
                dates={dates}
                scheduledProcesses={scheduledProcesses}
                onDrop={handleDropOnChart}
              />
          </div>
        </div>
      </main>
    </div>
  );
}
