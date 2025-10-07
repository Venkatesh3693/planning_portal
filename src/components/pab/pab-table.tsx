
'use client';

import * as React from 'react';
import type { PabData } from '@/hooks/use-pab-data';
import { format, getMonth, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

type PabTableProps = {
  pabData: PabData;
  dates: Date[];
};

const ROW_HEIGHT_PX = 32;
const CELL_WIDTH_PX = 60;
const SIDEBAR_WIDTH_PX = 250;

export default function PabTable({ pabData, dates }: PabTableProps) {
  const [openOrders, setOpenOrders] = React.useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    Object.keys(pabData.data).forEach(orderId => {
      initialState[orderId] = true; // Default to open
    });
    return initialState;
  });

  const headerRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

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
          headers.push({ name: format(dates[index - 1], "MMM ''yy"), span });
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
  
  const flattenedRows = React.useMemo(() => {
    const rows: {type: string, id: string, content: any}[] = [];
    Object.entries(pabData.data).forEach(([orderId, processData]) => {
      rows.push({ type: 'order', id: orderId, content: { orderId } });
      if (openOrders[orderId]) {
        pabData.processSequences[orderId]?.forEach(processId => {
          rows.push({ type: 'process', id: `${orderId}-${processId}`, content: { orderId, processId } });
          rows.push({ type: 'input', id: `${orderId}-${processId}-input`, content: { orderId, processId } });
          rows.push({ type: 'output', id: `${orderId}-${processId}-output`, content: { orderId, processId } });
        });
      }
    });
    return rows;
  }, [pabData, openOrders]);

  const handleBodyScroll = () => {
    if (headerRef.current && bodyRef.current) {
        headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    if (sidebarRef.current && bodyRef.current) {
        sidebarRef.current.scrollTop = bodyRef.current.scrollTop;
    }
  };

  if (Object.keys(pabData.data).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No processes scheduled. Schedule items on the Gantt chart to see PAB data.
      </div>
    );
  }
  
  const gridTemplateColumns = `repeat(${dates.length}, ${CELL_WIDTH_PX}px)`;
  const totalGridWidth = dates.length * CELL_WIDTH_PX;
  const totalGridHeight = flattenedRows.length * ROW_HEIGHT_PX;


  return (
    <div className="border rounded-lg overflow-hidden h-full">
        <div 
          className="grid h-full w-full relative"
          style={{
            gridTemplateColumns: `${SIDEBAR_WIDTH_PX}px 1fr`,
            gridTemplateRows: `auto auto 1fr`,
          }}
        >
            {/* Top-Left Corner */}
            <div className="sticky top-0 left-0 z-30 bg-muted border-r border-b">
                <div className="h-8 border-b flex items-center px-4 font-semibold text-foreground">Order / Process</div>
                <div className="h-8 flex items-center px-4"></div>
            </div>

            {/* Header */}
            <div ref={headerRef} className="sticky top-0 z-20 bg-muted border-b overflow-hidden">
                <div className="grid" style={{ gridTemplateColumns, width: totalGridWidth }}>
                  {monthHeaders.map(({ name, span }, i) => (
                    <div key={`month-header-${i}`} style={{ gridColumn: `span ${span}` }} className="h-8 flex items-center justify-center border-r border-b font-semibold text-foreground">
                      {name}
                    </div>
                  ))}
                </div>
                <div className="grid" style={{ gridTemplateColumns, width: totalGridWidth }}>
                  {dates.map((date) => (
                      <div key={date.toISOString()} className="h-8 flex items-center justify-center border-r text-muted-foreground">
                        {format(date, 'd')}
                      </div>
                  ))}
                </div>
            </div>

            {/* Sidebar */}
            <div ref={sidebarRef} className="row-start-3 overflow-hidden bg-background border-r z-20">
                <div style={{ height: totalGridHeight }}>
                  {flattenedRows.map((row, index) => {
                      let content: React.ReactNode;
                      let rowClasses = "flex items-center px-4 border-b";

                      if (row.type === 'order') {
                        content = (
                          <div onClick={() => toggleOrder(row.content.orderId)} className="flex items-center gap-2 cursor-pointer w-full font-semibold text-primary">
                              <ChevronRight className={cn("h-4 w-4 transition-transform", openOrders[row.content.orderId] && "rotate-90")} />
                              {row.content.orderId}
                          </div>
                        );
                        rowClasses += " bg-muted/50"
                      } else if (row.type === 'process') {
                        content = <div className="pl-8 font-medium">{pabData.processDetails[row.content.processId]?.name || row.content.processId}</div>;
                        rowClasses += " bg-background";
                      } else if (row.type === 'input') {
                        content = <div className="pl-10 text-sm text-muted-foreground">Input</div>;
                        rowClasses += " bg-background";
                      } else if (row.type === 'output') {
                        content = <div className="pl-10 text-sm text-muted-foreground">Output</div>;
                        rowClasses += " bg-background";
                      }
                      return (
                        <div key={row.id} style={{height: ROW_HEIGHT_PX}} className={cn(rowClasses, index % 2 !== 0 && row.type !== 'order' && 'bg-muted/30')}>
                           {content}
                        </div>
                      )
                  })}
                </div>
            </div>

            {/* Body */}
            <div ref={bodyRef} className="row-start-3 col-start-2 overflow-auto" onScroll={handleBodyScroll}>
                <div className="relative" style={{ width: totalGridWidth, height: totalGridHeight }}>
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns, gridTemplateRows: `repeat(${flattenedRows.length}, ${ROW_HEIGHT_PX}px)` }}>
                    {flattenedRows.map((row, rowIndex) => (
                       <React.Fragment key={row.id}>
                          {dates.map((date, dateIndex) => {
                            let cellContent: React.ReactNode = null;
                            const dateKey = format(date, 'yyyy-MM-dd');

                            if (row.type === 'process') {
                                const pab = pabData.data[row.content.orderId]?.[row.content.processId]?.[dateKey];
                                const processStartDate = pabData.processStartDates[row.content.orderId]?.[row.content.processId];
                                const isDateBeforeProcessStart = processStartDate ? isBefore(startOfDay(date), startOfDay(processStartDate)) : true;
                                
                                const hasActivity = (pabData.dailyInputs[row.content.orderId]?.[row.content.processId]?.[dateKey] || 0) > 0 || (pabData.dailyOutputs[row.content.orderId]?.[row.content.processId]?.[dateKey] || 0) > 0;
                                const shouldDisplay = !isDateBeforeProcessStart && ((pab !== undefined && Math.round(pab) !== 0) || hasActivity);

                                if (pab !== undefined && shouldDisplay) {
                                    const isNegative = pab < 0;
                                    cellContent = (
                                        <div className={cn(
                                            "w-full h-full flex items-center justify-center text-xs font-semibold rounded",
                                            isNegative ? 'bg-destructive/20 text-destructive-foreground' : 'bg-green-500/20 text-green-900',
                                            'dark:text-foreground'
                                        )}>
                                            {Math.round(pab).toLocaleString()}
                                        </div>
                                    );
                                }
                            } else if (row.type === 'input') {
                                const inputValue = pabData.dailyInputs[row.content.orderId]?.[row.content.processId]?.[dateKey] || 0;
                                if (inputValue > 0) {
                                  cellContent = <span className="text-xs text-muted-foreground">{Math.round(inputValue).toLocaleString()}</span>;
                                }
                            } else if (row.type === 'output') {
                                const outputValue = pabData.dailyOutputs[row.content.orderId]?.[row.content.processId]?.[dateKey] || 0;
                                if (outputValue > 0) {
                                  cellContent = <span className="text-xs text-muted-foreground">{Math.round(outputValue).toLocaleString()}</span>;
                                }
                            }

                            return (
                              <div key={`${row.id}-${dateIndex}`} className={cn("border-b border-r flex items-center justify-center p-1", rowIndex % 2 !== 0 && row.type !== 'order' ? 'bg-muted/30' : 'bg-background')}>
                                {cellContent}
                              </div>
                            )
                          })}
                       </React.Fragment>
                    ))}
                  </div>
                </div>
            </div>
        </div>
    </div>
  );
}
