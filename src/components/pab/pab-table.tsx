
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PabData } from '@/hooks/use-pab-data';
import { format, getMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight } from 'lucide-react';


type PabTableProps = {
  pabData: PabData;
  dates: Date[];
};

export default function PabTable({ pabData, dates }: PabTableProps) {
  const [openOrders, setOpenOrders] = React.useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    Object.keys(pabData.data).forEach(orderId => {
      initialState[orderId] = true; // Default to open
    });
    return initialState;
  });

  const toggleOrder = (orderId: string) => {
    setOpenOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const monthHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (dates.length === 0) return headers;

    let currentMonth = -1;
    let span = 0;
    dates.forEach((date, index) => {
      const month = getMonth(date);
      if (month !== currentMonth) {
        if (currentMonth !== -1) {
          headers.push({ name: format(dates[index-1], "MMM ''yy"), span });
        }
        currentMonth = month;
        span = 1;
      } else {
        span++;
      }
      if (index === dates.length - 1) {
        headers.push({ name: format(date, "MMM ''yy"), span });
      }
    });
    return headers;
  }, [dates]);

  if (Object.keys(pabData.data).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No processes scheduled. Schedule items on the Gantt chart to see PAB data.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="sticky left-0 bg-muted/30 z-20 min-w-[250px] font-semibold text-foreground border-b">Order / Process</TableHead>
            {monthHeaders.map(({ name, span }, i) => (
              <TableHead key={`month-header-${i}`} colSpan={span} className="text-center font-semibold text-foreground border-b">
                {name}
              </TableHead>
            ))}
          </TableRow>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="sticky left-0 bg-muted/30 z-20 min-w-[250px]"></TableHead>
            {dates.map((date) => (
              <TableHead key={date.toISOString()} className="text-center min-w-[50px] p-2">
                {format(date, 'd')}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(pabData.data).map(([orderId, processData]) => (
            <Collapsible asChild key={orderId} open={openOrders[orderId]}>
                <>
                <TableRow className="bg-card hover:bg-muted/50 border-b-2 border-border font-medium">
                    <TableCell className="sticky left-0 bg-card z-10 min-w-[250px] p-0">
                        <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 cursor-pointer h-full p-4 w-full text-left" onClick={() => toggleOrder(orderId)}>
                                <ChevronRight className={cn("h-4 w-4 transition-transform", openOrders[orderId] && "rotate-90")} />
                                <span className="font-semibold text-primary">{orderId}</span>
                            </button>
                        </CollapsibleTrigger>
                    </TableCell>
                    <TableCell colSpan={dates.length}></TableCell>
                </TableRow>
                
                <CollapsibleContent asChild>
                    <>
                    {pabData.processSequences[orderId]?.map((processId) => {
                        const processName = pabData.processDetails[processId]?.name || processId;
                        const dailyPabs = processData[processId] || {};
                        return (
                        <TableRow key={`${orderId}-${processId}`} className="hover:bg-muted/30 even:bg-muted/20">
                            <TableCell className="sticky left-0 bg-inherit z-10 min-w-[250px]">
                            <div className="pl-10">{processName}</div>
                            </TableCell>
                            {dates.map((date) => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const pab = dailyPabs[dateKey];
                                let cellContent: React.ReactNode = <span className="text-muted-foreground/30">-</span>;
                                if (pab !== undefined) {
                                    const isNegative = pab < 0;
                                    cellContent = (
                                        <div className={cn(
                                            "w-full h-full p-2 text-center rounded text-xs font-semibold",
                                            isNegative ? 'bg-destructive/20 text-destructive-foreground' : 'bg-green-500/20 text-green-900',
                                            'dark:text-foreground'
                                        )}>
                                            {Math.round(pab).toLocaleString()}
                                        </div>
                                    )
                                }
                                return (
                                    <TableCell key={date.toISOString()} className="p-1">
                                        {cellContent}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                        );
                    })}
                    </>
                </CollapsibleContent>
                </>
            </Collapsible>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
