

"use client";

import * as React from 'react';
import { format, getMonth, isWithinInterval, startOfDay, startOfHour, endOfHour, addDays, differenceInMilliseconds, endOfDay, compareAsc, isSameDay, isSameHour } from 'date-fns';
import type { Order, ScheduledProcess } from '@/lib/types';
import type { DraggedItemData } from '@/app/page';
import { cn } from '@/lib/utils';
import ScheduledProcessBar from './scheduled-process';

type Row = {
  id: string;
  name: string;
};

type ViewMode = 'day' | 'hour';

type GanttChartProps = {
  rows: Row[];
  dates: Date[];
  scheduledProcesses: ScheduledProcess[];
  allProcesses: ScheduledProcess[]; // All processes for calculating valid ranges
  orders: Order[];
  onDrop: (rowId: string, startDateTime: Date, draggedItemJSON: string) => void;
  onUndoSchedule: (scheduledProcessId: string) => void;
  onProcessDragStart: (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => void;
  onSplitProcess: (process: ScheduledProcess) => void;
  viewMode: ViewMode;
  draggedItem: DraggedItemData | null;
  latestStartDatesMap: Map<string, Date>;
  latestSewingStartDateMap: Map<string, Date>;
  draggedItemLatestStartDate: Date | null;
  predecessorEndDate: Date | null;
  predecessorEndDateMap: Map<string, Date>;
};

const ROW_HEIGHT_PX = 32;
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const WORKING_HOURS = Array.from({ length: WORKING_HOURS_END - WORKING_HOURS_START }, (_, i) => i + WORKING_HOURS_START);
const DAY_CELL_WIDTH = '2.5rem';
const HOUR_CELL_WIDTH = '3.5rem';


const TopLeftCorner = () => (
  <div className="sticky top-0 left-0 z-40 bg-muted/30 border-r border-b border-border/60">
    <div className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-end border-b border-border/60 p-2">
        <span className="text-sm font-semibold text-foreground">Month</span>
      </div>
      <div className="flex h-7 flex-1 items-center justify-end p-2">
        <span className="text-xs font-normal text-muted-foreground leading-tight">Day</span>
      </div>
    </div>
  </div>
);

const Header = React.forwardRef<
  HTMLDivElement,
  { timeColumns: { date: Date; type: 'day' | 'hour' }[]; viewMode: ViewMode, draggedItemLatestStartDate: Date | null; predecessorEndDate: Date | null }
>(({ timeColumns, viewMode, draggedItemLatestStartDate, predecessorEndDate }, ref) => {
  const monthHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (timeColumns.length === 0 || viewMode !== 'day') return headers;
    
    let currentMonth = -1;
    let span = 0;
    timeColumns.forEach((col, index) => {
      const month = getMonth(col.date);
      if (month !== currentMonth) {
        if (currentMonth !== -1) {
          headers.push({ name: format(addDays(col.date, -span), "MMM ''yy"), span });
        }
        currentMonth = month;
        span = 1;
      } else {
        span++;
      }
      if (index === timeColumns.length - 1) {
         headers.push({ name: format(col.date, "MMM ''yy"), span });
      }
    });
    return headers;
  }, [timeColumns, viewMode]);
  
  const dayHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (timeColumns.length === 0 || viewMode !== 'hour') return headers;

    let currentDay = -1;
    let span = 0;
    timeColumns.forEach((col, index) => {
        const day = col.date.getDate();
        if (day !== currentDay) {
            if (currentDay !== -1) {
                headers.push({ name: format(addDays(col.date, -1), 'MMM d'), span });
            }
            currentDay = day;
            span = WORKING_HOURS.length;
        }
        if (index === timeColumns.length - 1) {
            headers.push({ name: format(col.date, 'MMM d'), span });
        }
    });

    return headers;
  }, [timeColumns, viewMode]);

  const topHeaders = viewMode === 'day' ? monthHeaders : dayHeaders;
  const cellWidth = viewMode === 'day' ? DAY_CELL_WIDTH : HOUR_CELL_WIDTH;
  const gridTemplateColumns = `repeat(${timeColumns.length}, ${cellWidth})`;

  return (
    <div ref={ref} className="sticky top-0 z-30 overflow-hidden bg-muted/30 border-b border-border/60">
      <div className="grid" style={{ gridTemplateColumns }}>
        {topHeaders.map(({ name, span }, i) => (
          <div key={`top-header-${i}`} className="border-r border-b border-border/60 text-center h-7 flex items-center justify-center" style={{ gridColumn: `span ${span}` }}>
            <span className="text-sm font-semibold text-foreground">{name}</span>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns }}>
        {timeColumns.map((col, i) => {
           const isLatestStartDate = draggedItemLatestStartDate && (viewMode === 'day' ? isSameDay(col.date, draggedItemLatestStartDate) : isSameHour(col.date, draggedItemLatestStartDate));
           const isPredecessorEnd = predecessorEndDate && (viewMode === 'day' ? isSameDay(col.date, predecessorEndDate) : isSameHour(col.date, predecessorEndDate));
           
           return (
              <div key={`bottom-header-${i}`} className="border-r border-border/60 text-center h-7 flex items-center justify-center relative">
                {isLatestStartDate ? (
                   <div className="absolute inset-0 flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold z-10">
                     START BY
                   </div>
                ) : isPredecessorEnd ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold">
                    PRED. END
                  </div>
                ) : (
                  <div className="text-xs font-normal text-muted-foreground leading-tight">
                    {viewMode === 'day' ? format(col.date, 'd') : format(col.date, 'ha').toLowerCase()}
                  </div>
                )}
              </div>
           );
        })}
      </div>
    </div>
  );
});
Header.displayName = 'Header';


export default function GanttChart({
  rows,
  dates,
  scheduledProcesses,
  allProcesses,
  orders,
  onDrop,
  onUndoSchedule,
  onProcessDragStart,
  onSplitProcess,
  viewMode,
  draggedItem,
  latestStartDatesMap,
  latestSewingStartDateMap,
  draggedItemLatestStartDate,
  predecessorEndDate,
  predecessorEndDateMap,
}: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = React.useState<{ rowId: string; date: Date } | null>(null);
  const isDragging = !!draggedItem;
  
  const headerRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const sidebarWidthRef = React.useRef<HTMLDivElement>(null);

  const [sidebarWidth, setSidebarWidth] = React.useState(150);

  const timeColumns = React.useMemo(() => {
    if (viewMode === 'day') {
      return dates.map(date => ({ date, type: 'day' as const }));
    }
    const columns: { date: Date; type: 'hour' }[] = [];
    dates.forEach(day => {
      WORKING_HOURS.forEach(hour => {
        columns.push({ date: startOfHour(new Date(day).setHours(hour)), type: 'hour' });
      });
    });
    return columns;
  }, [dates, viewMode]);

  const handleBodyScroll = () => {
    if (headerRef.current && bodyRef.current) {
        headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    if (sidebarRef.current && bodyRef.current) {
        sidebarRef.current.scrollTop = bodyRef.current.scrollTop;
    }
  };

  React.useLayoutEffect(() => {
    if (sidebarWidthRef.current) {
      const newWidth = sidebarWidthRef.current.offsetWidth;
      if(newWidth > sidebarWidth) setSidebarWidth(newWidth);
    }
  }, [rows, sidebarWidth]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, rowId: string, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverCell || dragOverCell.rowId !== rowId || dragOverCell.date.getTime() !== date.getTime()) {
      setDragOverCell({ rowId, date });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, rowId: string, date: Date) => {
    e.preventDefault();
    const draggedItemJSON = e.dataTransfer.getData('application/json');
    onDrop(rowId, date, draggedItemJSON);
    setDragOverCell(null);
  };
  
  const cellWidth = viewMode === 'day' ? DAY_CELL_WIDTH : HOUR_CELL_WIDTH;
  const gridTemplateColumns = `repeat(${timeColumns.length}, ${cellWidth})`;
  const totalGridWidth = `calc(${timeColumns.length} * ${cellWidth})`;

  const validDateRanges = React.useMemo(() => {
    if (!draggedItem || draggedItem.type !== 'existing' || !draggedItem.process.isAutoScheduled) {
      return null;
    }

    const { process: draggedProcess } = draggedItem;
    const order = orders.find(o => o.id === draggedProcess.orderId);
    if (!order) return null;

    const processSequence = order.processIds;
    const currentIndex = processSequence.indexOf(draggedProcess.processId);

    // Find predecessor
    let predecessorEnd: Date | null = null;
    if (currentIndex > 0) {
      const predecessorId = processSequence[currentIndex - 1];
      const predecessorProcesses = allProcesses.filter(
        p => p.orderId === draggedProcess.orderId && p.processId === predecessorId && p.batchNumber === draggedProcess.batchNumber
      );
      if (predecessorProcesses.length > 0) {
        predecessorEnd = predecessorProcesses.reduce((latest, p) => compareAsc(p.endDateTime, latest) > 0 ? p.endDateTime : latest, predecessorProcesses[0].endDateTime);
      }
    }

    // Find successor
    let successorStart: Date | null = null;
    if (currentIndex < processSequence.length - 1) {
      const successorId = processSequence[currentIndex + 1];
      const successorProcesses = allProcesses.filter(
        p => p.orderId === draggedProcess.orderId && p.processId === successorId && p.batchNumber === draggedProcess.batchNumber
      );
      if (successorProcesses.length > 0) {
         successorStart = successorProcesses.reduce((earliest, p) => compareAsc(p.startDateTime, earliest) < 0 ? p.startDateTime : earliest, successorProcesses[0].startDateTime);
      }
    }

    return {
      start: predecessorEnd,
      end: successorStart
    };
  }, [draggedItem, orders, allProcesses]);

  return (
    <div 
      className={cn("h-full w-full overflow-hidden relative grid", isDragging && 'is-dragging')}
      style={{
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        gridTemplateRows: `auto 1fr`,
      }}
    >
      <TopLeftCorner />

      <Header 
        ref={headerRef} 
        timeColumns={timeColumns} 
        viewMode={viewMode} 
        draggedItemLatestStartDate={draggedItemLatestStartDate}
        predecessorEndDate={predecessorEndDate}
      />

      {/* Bottom-Left Sidebar (Machine Names) */}
      <div ref={sidebarRef} className="row-start-2 overflow-hidden bg-muted/30 border-r border-border/60">
        {/* Render twice: one for measuring, one for display */}
        <div ref={sidebarWidthRef} className="absolute pointer-events-none opacity-0 -z-10">
          {rows.map(row => (
            <div key={row.id} className="p-2 whitespace-nowrap font-semibold text-foreground text-sm">{row.name}</div>
          ))}
        </div>
        <div>
          {rows.map((row, rowIndex) => (
            <div
              key={row.id}
              className="p-2 border-b border-border/60 whitespace-nowrap justify-start flex items-center"
              style={{ height: `${ROW_HEIGHT_PX}px` }}
            >
              <span className="font-semibold text-foreground text-sm">{row.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom-Right Body (Timeline) */}
      <div ref={bodyRef} className="row-start-2 col-start-2 overflow-auto relative" onScroll={handleBodyScroll}>
        <div className="relative" style={{ width: totalGridWidth, height: `${rows.length * ROW_HEIGHT_PX}px`}}>
          {/* Main Timeline Grid Background */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns, gridTemplateRows: `repeat(${rows.length}, ${ROW_HEIGHT_PX}px)` }}>
            {rows.map((row, rowIndex) => (
              <React.Fragment key={row.id}>
                {timeColumns.map((col, dateIndex) => {
                  const isDragOver = dragOverCell?.rowId === row.id && dragOverCell.date.getTime() === col.date.getTime();
                  let isInTnaRange = false;
                  
                  if (draggedItem?.type === 'new-order' && draggedItem.tna) {
                      const tnaStartDate = new Date(draggedItem.tna.startDate);
                      const tnaEndDate = new Date(draggedItem.tna.endDate);

                      const interval = viewMode === 'day' 
                        ? { start: startOfDay(tnaStartDate), end: endOfDay(tnaEndDate) }
                        : { start: startOfHour(tnaStartDate), end: endOfHour(tnaEndDate) };
                      isInTnaRange = isWithinInterval(col.date, interval);
                  }

                  let isInValidRange = false;
                  if (validDateRanges) {
                      const range = {
                          start: validDateRanges.start ? startOfDay(validDateRanges.start) : new Date(0),
                          end: validDateRanges.end ? endOfDay(validDateRanges.end) : addDays(new Date(), 1000)
                      };
                      isInValidRange = isWithinInterval(col.date, range);
                  }
                  
                  const isLatestStartDateColumn = draggedItemLatestStartDate && (viewMode === 'day' ? isSameDay(col.date, draggedItemLatestStartDate) : isSameHour(col.date, draggedItemLatestStartDate));
                  const isPredecessorEndDateColumn = predecessorEndDate && (viewMode === 'day' ? isSameDay(col.date, predecessorEndDate) : isSameHour(col.date, predecessorEndDate));

                  return (
                      <div
                          key={`${row.id}-${dateIndex}`}
                          onDragOver={(e) => handleDragOver(e, row.id, col.date)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, row.id, col.date)}
                          className={cn('relative border-b border-r border-border/60',
                              isDragOver ? 'bg-primary/20' : (rowIndex % 2 !== 0 ? 'bg-card' : 'bg-muted/20'),
                              isPredecessorEndDateColumn && 'bg-blue-200/50',
                              isLatestStartDateColumn && !isDragOver && 'bg-amber-200/50',
                              isInTnaRange && !isDragOver && 'bg-green-500/10',
                              validDateRanges && 'bg-blue-500/5',
                              isInValidRange && !isDragOver && 'bg-blue-500/10',
                              'transition-colors duration-200'
                          )}
                      >
                      </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Scheduled Process Bars */}
          {scheduledProcesses.map((item) => {
              const rowIndex = rows.findIndex(r => r.id === item.machineId);
              if (rowIndex === -1) return null;

              const getColumnIndex = (date: Date) => {
                if (viewMode === 'day') {
                  const startOfTargetDay = startOfDay(date);
                  return timeColumns.findIndex(col => col.date.getTime() === startOfTargetDay.getTime());
                }
                const startOfTargetHour = startOfHour(date);
                return timeColumns.findIndex(col => col.date.getTime() === startOfTargetHour.getTime());
              };

              const startIndex = getColumnIndex(item.startDateTime);
              const endOfProcess = item.endDateTime;
              const effectiveEndDate = endOfProcess.getHours() === 0 && endOfProcess.getMinutes() === 0
                ? addDays(endOfProcess, -1)
                : endOfProcess;
              const endIndex = getColumnIndex(effectiveEndDate);

              if (startIndex === -1 || endIndex === -1) return null;
              
              const span = endIndex - startIndex + 1;
              
              return (
                  <div 
                    key={item.id}
                    className="absolute z-10"
                    style={{
                      top: `${rowIndex * ROW_HEIGHT_PX}px`,
                      left: `calc(${startIndex} * ${cellWidth})`,
                      width: `calc(${span} * ${cellWidth})`,
                      height: `${ROW_HEIGHT_PX}px`,
                    }}
                  >
                    <ScheduledProcessBar 
                        item={item} 
                        orders={orders}
                        onUndo={onUndoSchedule}
                        onDragStart={onProcessDragStart}
                        onSplit={onSplitProcess}
                        latestStartDatesMap={latestStartDatesMap}
                        predecessorEndDateMap={predecessorEndDateMap}
                    />
                  </div>
              );
          })}
        </div>
      </div>
    </div>
  );
}
