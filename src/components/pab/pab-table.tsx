
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PabData } from '@/hooks/use-pab-data';
import { format, getMonth, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
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
            <React.Fragment key={orderId}>
                <TableRow 
                    className="bg-card hover:bg-muted/50 border-b-2 border-border font-medium"
                    onClick={() => toggleOrder(orderId)}
                >
                    <TableCell className="sticky left-0 bg-background z-10 min-w-[250px]">
                        <div className="flex items-center gap-2 cursor-pointer w-full text-left">
                            <ChevronRight className={cn("h-4 w-4 transition-transform", openOrders[orderId] && "rotate-90")} />
                            <span className="font-semibold text-primary">{orderId}</span>
                        </div>
                    </TableCell>
                    <TableCell colSpan={dates.length}></TableCell>
                </TableRow>
                
                {openOrders[orderId] && pabData.processSequences[orderId]?.map((processId) => {
                    const processName = pabData.processDetails[processId]?.name || processId;
                    const dailyPabs = processData[processId] || {};
                    const dailyInputs = pabData.dailyInputs[orderId]?.[processId] || {};
                    const dailyOutputs = pabData.dailyOutputs[orderId]?.[processId] || {};
                    const processStartDate = pabData.processStartDates[orderId]?.[processId];

                    return (
                      <React.Fragment key={`${orderId}-${processId}`}>
                        <TableRow className="hover:bg-muted/30 even:bg-muted/20 bg-muted/10">
                            <TableCell className="sticky left-0 bg-background z-10 min-w-[250px]">
                                <div className="pl-10 font-medium">{processName}</div>
                            </TableCell>
                            {dates.map((date) => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const pab = dailyPabs[dateKey];
                                
                                const isDateBeforeProcessStart = processStartDate ? isBefore(startOfDay(date), startOfDay(processStartDate)) : true;
                                
                                let shouldDisplay = false;
                                if (!isDateBeforeProcessStart) {
                                  const hasActivity = (dailyInputs[dateKey] || 0) > 0 || (dailyOutputs[dateKey] || 0) > 0;
                                  shouldDisplay = (pab !== undefined && Math.round(pab) !== 0) || hasActivity;
                                }
                                
                                let cellContent: React.ReactNode = null;
                                
                                if (pab !== undefined && shouldDisplay) {
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
                                    <TableCell key={date.toISOString()} className="p-1 h-12">
                                        {cellContent}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                         <TableRow className="hover:bg-muted/30 even:bg-muted/20 text-xs text-muted-foreground">
                            <TableCell className="sticky left-0 bg-background z-10 min-w-[250px]">
                                <div className="pl-12">Input</div>
                            </TableCell>
                            {dates.map(date => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const inputValue = dailyInputs[dateKey] || 0;
                                const isDateBeforeProcessStart = processStartDate ? isBefore(startOfDay(date), startOfDay(processStartDate)) : true;
                                return (
                                    <TableCell key={`input-${dateKey}`} className="text-center p-1">
                                        {inputValue > 0 && !isDateBeforeProcessStart ? Math.round(inputValue).toLocaleString() : null}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                        <TableRow className="hover:bg-muted/30 even:bg-muted/20 text-xs text-muted-foreground border-b-2">
                            <TableCell className="sticky left-0 bg-background z-10 min-w-[250px]">
                                <div className="pl-12">Output</div>
                            </TableCell>
                            {dates.map(date => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const outputValue = dailyOutputs[dateKey] || 0;
                                 const isDateBeforeProcessStart = processStartDate ? isBefore(startOfDay(date), startOfDay(processStartDate)) : true;
                                return (
                                    <TableCell key={`output-${dateKey}`} className="text-center p-1">
                                       {outputValue > 0 && !isDateBeforeProcessStart ? Math.round(outputValue).toLocaleString() : null}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                      </React.Fragment>
                    );
                })}
            </React.Fragment>
          ))}
          </TableBody>
      </Table>
    </div>
  );
}
