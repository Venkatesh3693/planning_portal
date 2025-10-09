
'use client';

import { usePabData } from '@/hooks/use-pab-data';
import PabTable from '@/components/pab/pab-table';
import type { ScheduledProcess, Order, Process } from '@/lib/types';

type PabViewProps = {
  scheduledProcesses: ScheduledProcess[];
  orders: Order[];
  processes: Process[];
  dates: Date[];
};

export default function PabView({ scheduledProcesses, orders, processes, dates }: PabViewProps) {
  const pabData = usePabData(scheduledProcesses, orders, processes, dates);

  if (Object.keys(pabData.data).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No processes scheduled. Schedule items on the Gantt chart to see PAB data.
      </div>
    );
  }

  return <PabTable pabData={pabData} dates={dates} />;
}
