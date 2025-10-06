
"use client";

import * as React from 'react';
import { format, getWeek, getMonth, getYear, setHours, startOfDay, isWithinInterval } from 'date-fns';
import type { ScheduledProcess } from '@/lib/types';
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
  onDrop: (rowId: string, startDateTime: Date, draggedItemJSON: string) => void;
  onUndoSchedule: (scheduledProcessId: string) => void;
  onProcessDragStart: (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => void;
  isOrderLevelView?: boolean;
  viewMode: ViewMode;
  draggedItem: DraggedItemData | null;
};

const ROW_HEIGHT = 32; // Corresponds to h-8
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const WORKING_HOURS = Array.from({ length: WORKING_HOURS_END - WORKING_HOURS_START }, (_, i) => i + WORKING_HOURS_START);

const assignLanes = (processes: ScheduledProcess[]): { process: ScheduledProcess; lane: number }[] => {
    if (!processes || processes.length === 0) return [];

    const sortedProcesses = [...processes].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    
    const lanes: { process: ScheduledProcess, lane: number }[] = [];
    const laneEndTimes: Date[] = [];

    for (const process of sortedProcesses) {
        let foundLane = false;
        for (let i = 0; i < laneEndTimes.length; i++) {
            if (process.startDateTime.getTime() >= laneEndTimes[i].getTime()) {
                lanes.push({ process, lane: i });
                laneEndTimes[i] = process.endDateTime;
                foundLane = true;
                break;
            }
        }
        if (!foundLane) {
            lanes.push({ process, lane: laneEndTimes.length });
            laneEndTimes.push(process.endDateTime);
        }
    }
    return lanes;
};

export default function GanttChart({
  rows,
  dates,
  scheduledProcesses,
  onDrop,
  onUndoSchedule,
  onProcessDragStart,
  isOrderLevelView = false,
  viewMode,
  draggedItem,
}: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = React.useState<{ rowId: string; date: Date } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(0);
  const [draggedItemTna, setDraggedItemTna] = React.useState<{startDate: Date, endDate: Date} | null>(null);
  
  React.useEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };
    measureContainer();
    window.addEventListener('resize', measureContainer);
    return () => window.removeEventListener('resize', measureContainer);
  }, []);

  const timeColumns = React.useMemo(() => {
    if (viewMode === 'day') {
      return dates.map(date => ({ date, type: 'day' as const }));
    }
    const columns: { date: Date; type: 'hour' }[] = [];
    dates.forEach(day => {
      WORKING_HOURS.forEach(hour => {
        columns.push({ date: setHours(startOfDay(day), hour), type: 'hour' });
      });
    });
    return columns;
  }, [dates, viewMode]);

  const handleInternalDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const draggedItemJSON = e.dataTransfer.getData('application/json');
    if (!draggedItemJSON) return;
    try {
        const item: DraggedItemData = JSON.parse(draggedItemJSON);
        if (item.type === 'new' && item.tna) {
          setDraggedItemTna({startDate: new Date(item.tna.startDate), endDate: new Date(item.tna.endDate)});
        }
        // This is needed to propagate the drag start to the main page
        onProcessDragStart(e, item);
    } catch(e) {
      // ignore if parsing fails
    }
  };

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
    setDraggedItemTna(null);
  };

  const handleDragEnd = () => {
    setDragOverCell(null);
    setDraggedItemTna(null);
  };

  const laneAssignments = React.useMemo(() => {
    if (!isOrderLevelView) return new Map();

    const assignmentsByRow = new Map<string, { process: ScheduledProcess; lane: number }[]>();
    for (const row of rows) {
      const processesForRow = scheduledProcesses.filter(p => p.orderId === row.id);
      assignmentsByRow.set(row.id, assignLanes(processesForRow));
    }
    return assignmentsByRow;
  }, [isOrderLevelView, rows, scheduledProcesses]);

  const maxLanesPerRow = React.useMemo(() => {
    if (!isOrderLevelView) return new Map<string, number>();
  
    const maxLanes = new Map<string, number>();
    for (const row of rows) {
      const assignments = laneAssignments.get(row.id) || [];
      maxLanes.set(row.id, Math.max(1, assignments.length > 0 ? Math.max(...assignments.map(a => a.lane)) + 1 : 1));
    }
    return maxLanes;
  }, [isOrderLevelView, rows, laneAssignments]);
  
  const rowPositions = React.useMemo(() => {
    const positions = new Map<string, { start: number, span: number }>();
    let counter = 1;
    rows.forEach(row => {
        const span = isOrderLevelView ? (maxLanesPerRow.get(row.id) || 1) : 1;
        positions.set(row.id, { start: counter, span });
        counter += span;
    });
    return positions;
  }, [rows, isOrderLevelView, maxLanesPerRow]);

  const totalOccupiedRows = Array.from(rowPositions.values()).reduce((sum, pos) => sum + pos.span, 0);
  const headerHeight = 44 * 2;
  const remainingHeight = containerHeight > 0 ? containerHeight - headerHeight - (totalOccupiedRows * ROW_HEIGHT) : 0;
  const numEmptyRows = Math.max(0, Math.floor(remainingHeight / ROW_HEIGHT));
  const totalGridRows = totalOccupiedRows + numEmptyRows;
  
  const timelineGridStyle = {
    gridTemplateColumns: `min-content repeat(${timeColumns.length}, minmax(3rem, 1fr))`,
    gridTemplateRows: `auto auto auto repeat(${totalGridRows || 1}, ${ROW_HEIGHT}px)`,
  };

  const topHeaders = React.useMemo(() => {
    const headers: { name: string; start: number; span: number }[] = [];
    if (timeColumns.length === 0) return headers;
    let currentGroup: string | number, span = 0, start = 2;

    if (viewMode === 'day') {
      currentGroup = `${getMonth(timeColumns[0].date)}-${getYear(timeColumns[0].date)}`;
      timeColumns.forEach((col, index) => {
        const group = `${getMonth(col.date)}-${getYear(col.date)}`;
        if (group === currentGroup) {
          span++;
        } else {
          headers.push({ name: format(new Date(getYear(timeColumns[index - 1].date), getMonth(timeColumns[index - 1].date)), "MMM ''yy"), start, span });
          currentGroup = group;
          start = index + 2;
          span = 1;
        }
      });
      headers.push({ name: format(new Date(getYear(timeColumns[timeColumns.length - 1].date), getMonth(timeColumns[timeColumns.length - 1].date)), "MMM ''yy"), start, span });
    } else { // hour view
      currentGroup = getWeek(timeColumns[0].date);
      timeColumns.forEach((col, index) => {
        if (getWeek(col.date) === currentGroup) {
          span++;
        } else {
          headers.push({ name: `W${currentGroup}`, start, span });
          currentGroup = getWeek(col.date);
          start = index + 2;
          span = 1;
        }
      });
      headers.push({ name: `W${currentGroup}`, start, span });
    }
    return headers;
  }, [timeColumns, viewMode]);
  
  const midHeaders = React.useMemo(() => {
    const headers: { name: string; start: number; span: number }[] = [];
    if (timeColumns.length === 0) return headers;
    let currentGroup: string | number, span = 0, start = 2;

    if (viewMode === 'day') {
      currentGroup = getWeek(timeColumns[0].date);
      timeColumns.forEach((col, index) => {
        if (getWeek(col.date) === currentGroup) {
            span++;
        } else {
            headers.push({ name: `W${currentGroup}`, start, span });
            currentGroup = getWeek(col.date);
            start = index + 2;
            span = 1;
        }
      });
      headers.push({ name: `W${currentGroup}`, start, span });
    } else { // hour view
      currentGroup = format(timeColumns[0].date, 'yyyy-MM-dd');
      timeColumns.forEach((col, index) => {
        const group = format(col.date, 'yyyy-MM-dd');
        if (group === currentGroup) {
          span++;
        } else {
          headers.push({ name: format(col.date, 'MMM d'), start, span });
          currentGroup = group;
          start = index + 2;
          span = 1;
        }
      });
      headers.push({ name: format(timeColumns[timeColumns.length - 1].date, 'MMM d'), start, span });
    }
    return headers;
  }, [timeColumns, viewMode]);

  return (
    <div className="h-full w-full overflow-auto" ref={containerRef} onDragStart={handleInternalDragStart} onDragEnd={handleDragEnd}>
        <div className="relative grid min-h-full" style={timelineGridStyle}>
            <div className="sticky left-0 z-10 col-start-1 row-start-1 row-end-[-1] bg-card"></div>
            <div className="sticky left-0 top-0 z-50 border-b border-r bg-card" style={{gridRowEnd: 'span 3'}}></div>
            
            {topHeaders.map(({name, start, span}) => (
                <div key={`top-${name}-${start}`} className="sticky top-0 z-20 border-b border-r bg-card/95 py-0 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 1 }}>
                    <span className="text-xs font-semibold text-foreground">{name}</span>
                </div>
            ))}
            
            {midHeaders.map(({name, start, span}) => (
                <div key={`mid-${name}-${start}`} className="sticky top-[1.2rem] z-20 border-b border-r-2 bg-card/95 py-0 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 2}}>
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                </div>
            ))}

            {timeColumns.map((col, i) => (
                <div key={`bottom-header-${i}`} className="sticky top-[2.4rem] z-20 border-b border-r bg-card/95 py-0 text-center backdrop-blur-sm" style={{gridColumn: i + 2, gridRow: 3}}>
                    <div className="text-[10px] font-medium text-muted-foreground">
                      {viewMode === 'day' ? format(col.date, 'd') : format(col.date, 'ha')}
                    </div>
                </div>
            ))}
            
            {rows.map((row, rowIndex) => {
                const position = rowPositions.get(row.id);
                if (!position) return null;
                
                const rowHeader = (
                    <div 
                        key={`${row.id}-header`}
                        className={cn( "sticky left-0 z-20 flex items-center justify-start p-2 border-b border-r whitespace-nowrap", rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50' )}
                        style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: 1 }}
                    >
                        <span className="font-semibold text-foreground text-sm">{row.name}</span>
                    </div>
                );

                const rowCells = timeColumns.map((col, dateIndex) => {
                  const isDragOver = dragOverCell?.rowId === row.id && dragOverCell.date.getTime() === col.date.getTime();
                  let isInTnaRange = false;
                  if (draggedItemTna) {
                      const interval = { start: startOfDay(draggedItemTna.startDate), end: startOfDay(draggedItemTna.endDate) };
                      if (viewMode === 'day') {
                          isInTnaRange = isWithinInterval(col.date, interval);
                      } else {
                          isInTnaRange = isWithinInterval(col.date, { start: draggedItemTna.startDate, end: draggedItemTna.endDate });
                      }
                  }

                  return (
                    <div
                        key={`${row.id}-${dateIndex}`}
                        onDragOver={(e) => handleDragOver(e, row.id, col.date)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, row.id, col.date)}
                        className={cn('border-b border-r',
                            isDragOver ? 'bg-primary/20' : (rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50'),
                            isInTnaRange && !isDragOver && 'bg-green-500/10',
                            'transition-colors duration-200'
                        )}
                        style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: dateIndex + 2 }}
                    ></div>
                )});
                return [rowHeader, ...rowCells];
            })}

            {/* Empty rows and headers to fill vertical space */}
            {Array.from({ length: numEmptyRows }).map((_, i) => [
              <div key={`empty-header-${i}`} className={cn("sticky left-0 z-10 border-b border-r", (totalOccupiedRows + i) % 2 === 0 ? 'bg-card' : 'bg-muted/50')} style={{ gridRow: totalOccupiedRows + i + 4, gridColumn: 1 }}></div>,
              ...timeColumns.map((col, dateIndex) => (
                <div key={`empty-${i}-${dateIndex}`} className={cn("border-b border-r", (totalOccupiedRows + i) % 2 === 0 ? 'bg-card' : 'bg-muted/50')} style={{ gridRow: totalOccupiedRows + i + 4, gridColumn: dateIndex + 2 }}></div>
              ))
            ])}

            {scheduledProcesses.map((item) => {
                const rowId = isOrderLevelView ? item.orderId : item.machineId;
                const rowPosition = rowPositions.get(rowId);
                if (!rowPosition) return null;

                const startColDate = viewMode === 'day' ? startOfDay(item.startDateTime) : setHours(startOfDay(item.startDateTime), item.startDateTime.getHours());
                const dateIndex = timeColumns.findIndex(d => d.date.getTime() === startColDate.getTime());
                if (dateIndex === -1) return null;

                const durationInColumns = viewMode === 'day'
                    ? Math.ceil(item.durationMinutes / (8 * 60))
                    : Math.ceil(item.durationMinutes / 60);
                
                let lane = 0;
                if (isOrderLevelView) {
                    const assignments = laneAssignments.get(rowId);
                    const assignment = assignments?.find(a => a.process.id === item.id);
                    if (!assignment) return null;
                    lane = assignment.lane;
                }
                
                const isBeingDragged = draggedItem?.type === 'existing' && draggedItem.process.id === item.id;

                return (
                    <ScheduledProcessBar 
                        key={item.id} 
                        item={item} 
                        gridRow={rowPosition.start + lane + 3} 
                        gridColStart={dateIndex + 2}
                        durationInColumns={durationInColumns}
                        onUndo={onUndoSchedule}
                        onDragStart={onProcessDragStart}
                        isOrderLevelView={isOrderLevelView}
                        isBeingDragged={isBeingDragged}
                        isAnyDragging={!!draggedItem}
                    />
                );
            })}
        </div>
    </div>
  );
}

    
