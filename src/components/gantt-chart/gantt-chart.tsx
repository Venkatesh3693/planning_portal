
"use client";

import * as React from 'react';
import { format, getMonth, isWithinInterval, startOfDay, startOfHour, endOfHour, addDays, differenceInMilliseconds, endOfDay, compareAsc, isSameDay, isSameHour, getWeek } from 'date-fns';
import type { Order, ScheduledProcess, SewingLineGroup } from '@/lib/types';
import type { DraggedItemData } from '@/app/gut-new/page';
import { cn } from '@/lib/utils';
import ScheduledProcessBar from './scheduled-process';
import { Input } from '../ui/input';

type Row = {
  id: string;
  name: string;
  ccNo?: string;
};

type ViewMode = 'day' | 'hour' | 'week';

type GanttChartProps = {
  rows: Row[];
  dates: Date[];
  scheduledProcesses: ScheduledProcess[];
  allProcesses: ScheduledProcess[]; // All processes for calculating valid ranges
  orders: Order[];
  onDrop: (rowId: string, startDateTime: Date, draggedItemJSON: string) => void;
  onUndoSchedule: (scheduledProcessId: string) => void;
  onProcessDragStart: (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => void;
  onProcessClick?: (processId: string) => void;
  onSplitProcess: (process: ScheduledProcess) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  draggedItem: DraggedItemData | null;
  latestStartDatesMap: Map<string, Date>;
  latestSewingStartDateMap: Map<string, Date>;
  draggedItemLatestStartDate: Date | null;
  predecessorEndDate: Date | null;
  predecessorEndDateMap: Map<string, Date>;
  draggedItemLatestEndDate: Date | null;
  draggedItemCkDate: Date | null;
  activePlanQtyProcessId?: string | null;
  dailyPlanQty?: Record<string, number> | null;
  dailyPoFcQty?: Record<string, number> | null;
  dailyFgOi?: Record<string, number> | null;
  dailyEfficiencies?: Record<string, number> | null;
  onDailyEfficiencyChange?: (newEffs: Record<string, number>) => void;
};

const ROW_HEIGHT_PX = 40;
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const WORKING_HOURS = Array.from({ length: WORKING_HOURS_END - WORKING_HOURS_START }, (_, i) => i + WORKING_HOURS_START);
const DAY_CELL_WIDTH_INITIAL = 40;
const HOUR_CELL_WIDTH_INITIAL = 56;
const WEEK_CELL_WIDTH_INITIAL = 120;
const DAY_VIEW_COLLAPSE_THRESHOLD = 40;


const TopLeftCorner = ({ isDayViewCollapsed }: { isDayViewCollapsed: boolean }) => (
  <div className="sticky top-0 left-0 z-40 bg-muted/30 border-r border-b border-border/60">
    <div className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-end border-b border-border/60 p-2">
        <span className="text-sm font-semibold text-foreground">Month</span>
      </div>
       <div className="flex h-7 items-center justify-end border-b border-border/60 p-2">
        <span className="text-xs font-normal text-muted-foreground leading-tight">Week</span>
      </div>
      { !isDayViewCollapsed && (
        <div className="flex h-7 flex-1 items-center justify-end p-2">
            <span className="text-xs font-normal text-muted-foreground leading-tight">Day</span>
        </div>
      )}
    </div>
  </div>
);

const Header = React.forwardRef<
  HTMLDivElement,
  { 
    timeColumns: { date: Date; type: 'day' | 'hour' | 'week' }[]; 
    viewMode: ViewMode; 
    draggedItemLatestStartDate: Date | null; 
    predecessorEndDate: Date | null; 
    draggedItemLatestEndDate: Date | null; 
    draggedItemCkDate: Date | null;
    cellWidth: number;
    onResizeStart: (index: number, startX: number) => void;
    isDayViewCollapsed: boolean;
  }
>(({ timeColumns, viewMode, draggedItemLatestStartDate, predecessorEndDate, draggedItemLatestEndDate, draggedItemCkDate, cellWidth, onResizeStart, isDayViewCollapsed }, ref) => {
  const monthHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (timeColumns.length === 0) return headers;
    
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
  }, [timeColumns]);

  const weekHeaders = React.useMemo(() => {
    if (timeColumns.length === 0) return [];
    
    if (viewMode === 'week') {
        return timeColumns.map(col => ({ name: `W${getWeek(col.date, { weekStartsOn: 1 })}`, span: 1 }));
    }

    const headers: { name: string; span: number }[] = [];
    let currentWeek = -1;
    let span = 0;
    timeColumns.forEach((col, index) => {
        const week = getWeek(col.date, { weekStartsOn: 1 });
        if (week !== currentWeek) {
            if (currentWeek !== -1) {
                headers.push({ name: `W${currentWeek}`, span });
            }
            currentWeek = week;
            span = 1;
        } else {
            span++;
        }
        if (index === timeColumns.length - 1) {
            headers.push({ name: `W${week}`, span });
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

  const topHeaders = viewMode === 'day' || viewMode === 'week' ? monthHeaders : dayHeaders;
  
  const gridTemplateColumns = `repeat(${timeColumns.length}, ${cellWidth}px)`;

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
        {weekHeaders.map(({ name, span }, i) => (
            <div key={`week-header-${i}`} className="border-r border-b border-border/60 text-center h-7 flex items-center justify-center relative group" style={{ gridColumn: `span ${span}` }}>
            <span className="text-xs font-semibold text-muted-foreground">{name}</span>
                <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
                onMouseDown={(e) => onResizeStart(i, e.clientX)}
                />
            </div>
        ))}
      </div>
      { !isDayViewCollapsed && (
        <div className="grid" style={{ gridTemplateColumns }}>
            {timeColumns.map((col, i) => {
            const isLatestStartDate = draggedItemLatestStartDate && (viewMode === 'day' ? isSameDay(col.date, draggedItemLatestStartDate) : isSameHour(col.date, draggedItemLatestStartDate));
            const isPredecessorEnd = predecessorEndDate && (viewMode === 'day' ? isSameDay(col.date, predecessorEndDate) : isSameHour(col.date, predecessorEndDate));
            const isLatestEndDate = draggedItemLatestEndDate && (viewMode === 'day' ? isSameDay(col.date, draggedItemLatestEndDate) : isSameHour(col.date, draggedItemLatestEndDate));
            const isCkDate = draggedItemCkDate && (viewMode === 'day' ? isSameDay(col.date, draggedItemCkDate) : isSameHour(col.date, draggedItemCkDate));

            return (
                <div key={`bottom-header-${i}`} className="border-r border-border/60 text-center h-7 flex items-center justify-center relative group">
                    {isLatestEndDate ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold z-10">
                            FINISH BY
                        </div>
                    ) : isLatestStartDate ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold z-10">
                        START BY
                    </div>
                    ) : isPredecessorEnd ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold">
                        PRED. END
                    </div>
                    ) : isCkDate ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-green-500 text-white text-[10px] font-bold">
                        CK DATE
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
      )}
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
  onProcessClick,
  onSplitProcess,
  viewMode,
  setViewMode,
  draggedItem,
  latestStartDatesMap,
  latestSewingStartDateMap,
  draggedItemLatestStartDate,
  predecessorEndDate,
  predecessorEndDateMap,
  draggedItemLatestEndDate,
  draggedItemCkDate,
  activePlanQtyProcessId,
  dailyPlanQty,
  dailyPoFcQty,
  dailyFgOi,
  dailyEfficiencies,
  onDailyEfficiencyChange,
}: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = React.useState<{ rowId: string; date: Date } | null>(null);
  const isDragging = !!draggedItem;
  
  const headerRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const sidebarWidthRef = React.useRef<HTMLDivElement>(null);

  const [sidebarWidth, setSidebarWidth] = React.useState(150);
  const [isDayViewCollapsed, setIsDayViewCollapsed] = React.useState(false);
  
  const [cellWidth, setCellWidth] = React.useState(() => {
    switch (viewMode) {
      case 'hour': return HOUR_CELL_WIDTH_INITIAL;
      case 'week': return WEEK_CELL_WIDTH_INITIAL;
      default: return DAY_CELL_WIDTH_INITIAL;
    }
  });

  const resizeData = React.useRef<{ startIndex: number, startX: number, startWidth: number } | null>(null);

  React.useEffect(() => {
    switch (viewMode) {
      case 'hour':
        setCellWidth(HOUR_CELL_WIDTH_INITIAL);
        setIsDayViewCollapsed(false);
        break;
      case 'week':
        setCellWidth(WEEK_CELL_WIDTH_INITIAL);
        setIsDayViewCollapsed(true);
        break;
      default:
        setCellWidth(DAY_CELL_WIDTH_INITIAL);
        setIsDayViewCollapsed(false);
    }
  }, [viewMode]);
  
  const handleResizeStart = (index: number, startX: number) => {
    resizeData.current = { startIndex: index, startX, startWidth: cellWidth };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeData.current) return;
    const dx = e.clientX - resizeData.current.startX;
    const newWidth = resizeData.current.startWidth + dx;
    
    setCellWidth(newWidth);
    
    if (viewMode === 'day' && newWidth < DAY_VIEW_COLLAPSE_THRESHOLD) {
      setIsDayViewCollapsed(true);
    } else if (viewMode === 'day') {
      setIsDayViewCollapsed(false);
    }
  };

  const handleResizeEnd = () => {
    if (resizeData.current === null) return;
    
    if (viewMode === 'day' && cellWidth < DAY_VIEW_COLLAPSE_THRESHOLD) {
        setViewMode('week');
    } else if (viewMode === 'week' && cellWidth >= DAY_VIEW_COLLAPSE_THRESHOLD) {
        setViewMode('day');
    }

    resizeData.current = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
  };

  const activeProcess = React.useMemo(() => {
      if (!activePlanQtyProcessId) return null;
      return scheduledProcesses.find(p => p.id === activePlanQtyProcessId);
  }, [activePlanQtyProcessId, scheduledProcesses]);

  const timeColumns = React.useMemo(() => {
    if (viewMode === 'day') {
      return dates.map(date => ({ date, type: 'day' as const }));
    }
    if (viewMode === 'week') {
        const weekSet = new Set<string>();
        dates.forEach(d => {
            weekSet.add(`W${getWeek(d, { weekStartsOn: 1 })}`);
        });
        return Array.from(weekSet).map(w => ({ date: dates.find(d => `W${getWeek(d, {weekStartsOn: 1})}` === w)!, type: 'week' as const }));
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
  
  const flattenedRows = React.useMemo(() => {
    const finalRows: (Row & { rowType?: 'main' | 'plan' | 'po_fc' | 'fg_oi' | 'efficiency' })[] = [];
    rows.forEach(row => {
      finalRows.push({ ...row, rowType: 'main' });
      if (activeProcess && row.id === activeProcess.machineId) {
        finalRows.push({ id: `${row.id}-po-fc`, name: 'PO + FC', rowType: 'po_fc' });
        finalRows.push({ id: `${row.id}-efficiency`, name: 'Efficiency', rowType: 'efficiency' });
        finalRows.push({ id: `${row.id}-plan`, name: 'Plan Qty', rowType: 'plan' });
        finalRows.push({ id: `${row.id}-fg-oi`, name: 'FG OI', rowType: 'fg_oi' });
      }
    });
    return finalRows;
  }, [rows, activeProcess]);

  const gridTemplateColumns = `repeat(${timeColumns.length}, ${cellWidth}px)`;
  const totalGridWidth = timeColumns.length * cellWidth;

  const handleEfficiencyChange = (dateKey: string, value: string) => {
    if (onDailyEfficiencyChange && dailyEfficiencies) {
      const newEffs = { ...dailyEfficiencies, [dateKey]: Number(value) };
      onDailyEfficiencyChange(newEffs);
    }
  }
  
  const headerHeight = isDayViewCollapsed ? 'calc(2*1.75rem + 2px)' : 'calc(3*1.75rem + 3px)';

  return (
    <div 
      className={cn("h-full w-full overflow-hidden relative grid", isDragging && 'is-dragging')}
      style={{
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        gridTemplateRows: `${headerHeight} 1fr`,
      }}
    >
      <TopLeftCorner isDayViewCollapsed={isDayViewCollapsed} />

      <Header 
        ref={headerRef} 
        timeColumns={timeColumns} 
        viewMode={viewMode} 
        draggedItemLatestStartDate={draggedItemLatestStartDate}
        predecessorEndDate={predecessorEndDate}
        draggedItemLatestEndDate={draggedItemLatestEndDate}
        draggedItemCkDate={draggedItemCkDate}
        cellWidth={cellWidth}
        onResizeStart={handleResizeStart}
        isDayViewCollapsed={isDayViewCollapsed}
      />

      {/* Bottom-Left Sidebar (Machine Names) */}
      <div ref={sidebarRef} className="row-start-2 overflow-hidden bg-muted/30 border-r border-border/60">
        {/* Render twice: one for measuring, one for display */}
        <div ref={sidebarWidthRef} className="absolute pointer-events-none opacity-0 -z-10">
          {flattenedRows.map(row => (
             <div key={row.id} className="p-2 whitespace-nowrap">
              <div className="font-semibold text-foreground text-sm">{row.name}</div>
              {row.ccNo && <div className="text-xs text-muted-foreground">{row.ccNo}</div>}
            </div>
          ))}
        </div>
        <div>
          {flattenedRows.map((row) => (
            <div
              key={row.id}
              className="p-2 border-b border-border/60 whitespace-nowrap flex flex-col justify-center"
              style={{ height: `${ROW_HEIGHT_PX}px` }}
            >
              <div className={cn(
                "font-semibold text-sm", 
                row.rowType === 'plan' ? 'text-blue-600'
                : row.rowType === 'po_fc' ? 'text-cyan-600'
                : row.rowType === 'fg_oi' ? 'text-purple-600'
                : row.rowType === 'efficiency' ? 'text-orange-600'
                : 'text-foreground'
              )}>{row.name}</div>
              {row.ccNo && <div className="text-xs text-muted-foreground">{row.ccNo}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom-Right Body (Timeline) */}
      <div ref={bodyRef} className="row-start-2 col-start-2 overflow-auto relative" onScroll={handleBodyScroll}>
        <div className="relative" style={{ width: totalGridWidth, height: `${flattenedRows.length * ROW_HEIGHT_PX}px`}}>
          {/* Main Timeline Grid Background */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns, gridTemplateRows: `repeat(${flattenedRows.length}, ${ROW_HEIGHT_PX}px)` }}>
            {flattenedRows.map((row, rowIndex) => (
              <React.Fragment key={row.id}>
                {timeColumns.map((col, dateIndex) => {
                  let cellContent: React.ReactNode = null;
                  const dateKey = format(startOfDay(col.date), 'yyyy-MM-dd');

                  if (row.rowType) {
                    if (row.rowType === 'plan') {
                      const qty = dailyPlanQty?.[dateKey];
                      if (qty && qty > 0) cellContent = <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{Math.round(qty).toLocaleString()}</span>;
                    } else if (row.rowType === 'po_fc') {
                      const qty = dailyPoFcQty?.[dateKey];
                      if (qty && qty > 0) cellContent = <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{Math.round(qty).toLocaleString()}</span>;
                    } else if (row.rowType === 'fg_oi') {
                       const qty = dailyFgOi?.[dateKey];
                       if (qty !== undefined) cellContent = <span className={cn("text-xs font-semibold", qty < 0 ? "text-red-700 dark:text-red-400" : "text-purple-700 dark:text-purple-300")}>{Math.round(qty).toLocaleString()}</span>;
                    } else if (row.rowType === 'efficiency') {
                        if (dailyEfficiencies && dailyPlanQty?.[dateKey]) {
                          cellContent = (
                            <Input
                              type="number"
                              value={dailyEfficiencies[dateKey] || ''}
                              onChange={(e) => handleEfficiencyChange(dateKey, e.target.value)}
                              className="w-16 h-7 text-center text-xs p-1 bg-transparent border-0 hover:border focus:ring-1 focus:ring-orange-500"
                            />
                          );
                        }
                    }
                  }

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
                  const isLatestEndDateColumn = draggedItemLatestEndDate && (viewMode === 'day' ? isSameDay(col.date, draggedItemLatestEndDate) : isSameHour(col.date, draggedItemLatestEndDate));
                  const isCkDateColumn = draggedItemCkDate && (viewMode === 'day' ? isSameDay(col.date, draggedItemCkDate) : isSameHour(col.date, draggedItemCkDate));

                  return (
                      <div
                          key={`${row.id}-${dateIndex}`}
                          onDragOver={(e) => handleDragOver(e, row.id, col.date)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, row.id, col.date)}
                          className={cn('relative border-b border-r border-border/60 flex items-center justify-center',
                              isDragOver ? 'bg-primary/20' : '',
                              row.rowType === 'plan' ? 'bg-blue-50 dark:bg-blue-900/10'
                              : row.rowType === 'efficiency' ? 'bg-orange-50 dark:bg-orange-900/10'
                              : row.rowType === 'po_fc' ? 'bg-cyan-50 dark:bg-cyan-900/10'
                              : row.rowType === 'fg_oi' ? 'bg-purple-50 dark:bg-purple-900/10'
                              : (rowIndex % 2 !== 0 ? 'bg-card' : 'bg-muted/20'),
                              isLatestEndDateColumn && !isDragOver && 'bg-red-200/50',
                              isCkDateColumn && !isDragOver && 'bg-green-200/50',
                              isPredecessorEndDateColumn && 'bg-blue-200/50',
                              isLatestStartDateColumn && !isDragOver && 'bg-amber-200/50',
                              isInTnaRange && !isDragOver && 'bg-green-500/10',
                              validDateRanges && 'bg-blue-500/5',
                              isInValidRange && !isDragOver && 'bg-blue-500/10',
                              'transition-colors duration-200'
                          )}
                      >
                       {cellContent}
                      </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Scheduled Process Bars */}
          {scheduledProcesses.map((item) => {
              const rowIndex = flattenedRows.findIndex(r => r.id === item.machineId);
              if (rowIndex === -1) return null;

              const getColumnIndex = (date: Date) => {
                if (viewMode === 'day') {
                  const startOfTargetDay = startOfDay(date);
                  return timeColumns.findIndex(col => col.date.getTime() === startOfTargetDay.getTime());
                }
                if (viewMode === 'week') {
                    const weekOfDate = getWeek(date, { weekStartsOn: 1 });
                    return timeColumns.findIndex(col => getWeek(col.date, { weekStartsOn: 1 }) === weekOfDate);
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
                      left: `${startIndex * cellWidth}px`,
                      width: `${span * cellWidth}px`,
                      height: `${ROW_HEIGHT_PX}px`,
                    }}
                  >
                    <ScheduledProcessBar 
                        item={item} 
                        orders={orders}
                        onUndo={onUndoSchedule}
                        onDragStart={onProcessDragStart}
                        onClick={onProcessClick}
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


    