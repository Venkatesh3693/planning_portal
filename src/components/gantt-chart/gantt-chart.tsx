
"use client";

import * as React from 'react';
import { format, isSameDay, getWeek, getMonth, getYear, addMinutes, startOfDay, eachDayOfInterval, setHours } from 'date-fns';
import type { ScheduledProcess } from '@/lib/types';
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
  onDrop: (orderId: string, processId: string, machineId: string, startDateTime: Date) => void;
  onUndoSchedule: (scheduledProcessId: string) => void;
  onScheduledProcessDragStart: (e: React.DragEvent<HTMLDivElement>, process: ScheduledProcess) => void;
  onScheduledProcessDragEnd: () => void;
  isOrderLevelView?: boolean;
  viewMode: ViewMode;
  draggedProcess: ScheduledProcess | null;
};

const ROW_HEIGHT = 32; // Corresponds to h-8
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const WORKING_HOURS = Array.from({ length: WORKING_HOURS_END - WORKING_HOURS_START }, (_, i) => i + WORKING_HOURS_START);


const assignLanes = (processes: ScheduledProcess[]): { process: ScheduledProcess; lane: number }[] => {
    if (!processes || processes.length === 0) return [];

    const sortedProcesses = [...processes].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());

    const lanes: { process: ScheduledProcess; lane: number }[] = [];
    const laneEndTimes: Date[] = [];

    for (const process of sortedProcesses) {
        let foundLane = false;
        const processEndDate = addMinutes(process.startDateTime, process.durationMinutes);

        for (let i = 0; i < laneEndTimes.length; i++) {
            if (process.startDateTime.getTime() >= laneEndTimes[i].getTime()) {
                lanes.push({ process, lane: i });
                laneEndTimes[i] = processEndDate;
                foundLane = true;
                break;
            }
        }

        if (!foundLane) {
            const newLaneIndex = laneEndTimes.length;
            lanes.push({ process, lane: newLaneIndex });
            laneEndTimes.push(processEndDate);
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
  onScheduledProcessDragStart,
  onScheduledProcessDragEnd,
  isOrderLevelView = false,
  viewMode,
  draggedProcess
}: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = React.useState<{ rowId: string; date: Date } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(0);
  
  const handleInternalDragStart = (e: React.DragEvent<HTMLDivElement>, process: ScheduledProcess) => {
    onScheduledProcessDragStart(e, process);
  };
  
  const handleInternalDragEnd = () => {
    onScheduledProcessDragEnd();
  };

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
    // Hour view
    const columns: { date: Date; type: 'hour' }[] = [];
    dates.forEach(day => {
      WORKING_HOURS.forEach(hour => {
        columns.push({ date: setHours(startOfDay(day), hour), type: 'hour' });
      });
    });
    return columns;
  }, [dates, viewMode]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, rowId: string, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (isOrderLevelView) return;
    setDragOverCell({ rowId, date });
  };

  const handleDragLeave = () => {
    if(isOrderLevelView) return;
    setDragOverCell(null);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, rowId: string, date: Date) => {
    e.preventDefault();
    setDragOverCell(null);
    if(isOrderLevelView) return;

    const orderId = e.dataTransfer.getData('orderId');
    const processId = e.dataTransfer.getData('processId');
    
    if (orderId && processId) {
      onDrop(orderId, processId, rowId, date);
    }
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
      const hasProcesses = assignments.length > 0;
      if (hasProcesses) {
        const neededLanes = Math.max(...assignments.map(a => a.lane), 0) + 1;
        maxLanes.set(row.id, neededLanes);
      } else {
        // If there are no processes, use 1 row.
        maxLanes.set(row.id, 1);
      }
    }
    return maxLanes;
  }, [isOrderLevelView, rows, laneAssignments]);
  
  const rowPositions = React.useMemo(() => {
    const positions = new Map<string, { start: number, span: number }>();
    let counter = 1; // Start at 1 for grid rows
    rows.forEach(row => {
        const span = isOrderLevelView ? (maxLanesPerRow.get(row.id) || 1) : 1;
        positions.set(row.id, { start: counter, span });
        counter += span;
    });
    return positions;
  }, [rows, isOrderLevelView, maxLanesPerRow]);

  const totalOccupiedRows = Array.from(rowPositions.values()).reduce((sum, pos) => sum + pos.span, 0);

  const headerHeight = 44 * 2; // Approximate height of 2 header rows
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

    if (viewMode === 'day') {
      let currentMonth = getMonth(timeColumns[0].date);
      let currentYear = getYear(timeColumns[0].date);
      let span = 0;
      let start = 2;
      timeColumns.forEach((col, index) => {
        if (getMonth(col.date) === currentMonth && getYear(col.date) === currentYear) {
          span++;
        } else {
          headers.push({ name: format(new Date(currentYear, currentMonth), "MMM ''yy"), start, span });
          currentMonth = getMonth(col.date);
          currentYear = getYear(col.date);
          start = index + 2;
          span = 1;
        }
      });
      headers.push({ name: format(new Date(currentYear, currentMonth), "MMM ''yy"), start, span });
    } else { // hour view
      let currentWeek = getWeek(timeColumns[0].date);
      let span = 0;
      let start = 2;
      timeColumns.forEach((col, index) => {
        if (getWeek(col.date) === currentWeek) {
          span++;
        } else {
          headers.push({ name: `W${currentWeek}`, start, span });
          currentWeek = getWeek(col.date);
          start = index + 2;
          span = 1;
        }
      });
      headers.push({ name: `W${currentWeek}`, start, span });
    }
    return headers;
  }, [timeColumns, viewMode]);
  
  const midHeaders = React.useMemo(() => {
    const headers: { name: string; start: number; span: number }[] = [];
      if (timeColumns.length === 0) return headers;

      if (viewMode === 'day') {
        let currentWeek = getWeek(timeColumns[0].date);
        let span = 0;
        let start = 2;
        timeColumns.forEach((col, index) => {
            if (getWeek(col.date) === currentWeek) {
                span++;
            } else {
                headers.push({ name: `W${currentWeek}`, start, span });
                currentWeek = getWeek(col.date);
                start = index + 2;
                span = 1;
            }
        });
        headers.push({ name: `W${currentWeek}`, start, span });
      } else { // hour view
        let currentDay = format(timeColumns[0].date, 'MMM d');
        let span = 0;
        let start = 2;
        timeColumns.forEach((col, index) => {
          if (format(col.date, 'MMM d') === currentDay) {
            span++;
          } else {
            headers.push({ name: currentDay, start, span });
            currentDay = format(col.date, 'MMM d');
            start = index + 2;
            span = 1;
          }
        });
        headers.push({ name: currentDay, start, span });
      }
      return headers;
  }, [timeColumns, viewMode]);


  return (
    <div className="h-full w-full overflow-auto" ref={containerRef}>
        <div className="relative grid min-h-full" style={timelineGridStyle}>
            {/* Sticky Row Headers column background */}
            <div className="sticky left-0 z-30 col-start-1 row-start-1 row-end-[-1] bg-card"></div>

            {/* Empty Corner */}
            <div className="sticky left-0 top-0 z-50 border-b border-r bg-card" style={{gridRowEnd: 'span 3'}}></div>
                    
            {/* Top headers */}
            {topHeaders.map(({name, start, span}) => (
                <div key={`${name}-${start}`} className="sticky top-0 z-20 border-b border-r bg-card/95 py-0 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 1 }}>
                    <span className="text-xs font-semibold text-foreground">{name}</span>
                </div>
            ))}
            
            {/* Mid headers */}
            {midHeaders.map(({name, start, span}) => (
                <div key={`${name}-${start}`} className="sticky top-[1.2rem] z-20 border-b border-r-2 bg-card/95 py-0 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 2}}>
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                </div>
            ))}

            {/* Bottom headers */}
            {timeColumns.map((col, i) => (
                <div key={i} className="sticky top-[2.4rem] z-20 border-b border-r bg-card/95 py-0 text-center backdrop-blur-sm" style={{gridColumn: i + 2, gridRow: 3}}>
                    <div className="text-[10px] font-medium text-muted-foreground">
                      {viewMode === 'day' ? format(col.date, 'd') : format(col.date, 'ha')}
                    </div>
                </div>
            ))}
            
            {/* Grid cells and row headers */}
            {rows.map((row, rowIndex) => {
                const position = rowPositions.get(row.id);
                if (!position) return null;
                
                const rowHeader = (
                    <div 
                        key={`${row.id}-header`}
                        className={cn(
                            "sticky left-0 z-40 flex items-center justify-start p-2 border-b border-r whitespace-nowrap",
                            rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                        )}
                        style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: 1 }}
                    >
                        <span className="font-semibold text-foreground text-sm">{row.name}</span>
                    </div>
                );

                const rowCells = timeColumns.map((col, dateIndex) => (
                    <div
                        key={`${row.id}-${dateIndex}`}
                        onDragOver={(e) => handleDragOver(e, row.id, col.date)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, row.id, col.date)}
                        className={cn(
                            'border-b border-r',
                            dragOverCell && dragOverCell.rowId === row.id && isSameDay(dragOverCell.date, col.date) 
                            ? 'bg-primary/20' 
                            : (rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50'),
                            !isOrderLevelView && 'hover:bg-primary/10',
                            'transition-colors duration-200'
                        )}
                        style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: dateIndex + 2 }}
                    ></div>
                ));
                return [rowHeader, ...rowCells];
            })}

            {/* Empty rows to fill space */}
            {Array.from({ length: numEmptyRows }).map((_, i) => {
              const gridRowStart = totalOccupiedRows + i + 4;
              return timeColumns.map((col, dateIndex) => (
                <div
                  key={`empty-${i}-${dateIndex}`}
                  className={cn(
                    "border-b border-r",
                    (totalOccupiedRows + i) % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                  )}
                  style={{ gridRow: gridRowStart, gridColumn: dateIndex + 2 }}
                ></div>
              ));
            })}
            {/* Empty row headers for filler */}
            {Array.from({ length: numEmptyRows }).map((_, i) => {
              return (
                <div
                  key={`empty-header-${i}`}
                  className={cn(
                    "sticky left-0 z-10 border-b border-r",
                    (totalOccupiedRows + i) % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                  )}
                  style={{
                    gridRow: totalOccupiedRows + i + 4,
                    gridColumn: 1,
                  }}
                ></div>
              );
            })}


            {/* Scheduled processes */}
            {scheduledProcesses.map((item) => {
                const isBeingDragged = draggedProcess?.id === item.id;
                if (isOrderLevelView) {
                    const rowId = item.orderId;
                    const assignments = laneAssignments.get(rowId);
                    const assignment = assignments?.find(a => a.process.id === item.id);
                    if (!assignment) return null;

                    const rowPosition = rowPositions.get(rowId);
                    if (!rowPosition) return null;

                    const dateIndex = timeColumns.findIndex(d => isSameDay(d.date, item.startDateTime));
                    if (dateIndex === -1) return null;

                    const gridRow = rowPosition.start + assignment.lane + 3;
                    const durationInColumns = viewMode === 'day' ? Math.ceil(item.durationMinutes / (60 * 8)) : Math.ceil(item.durationMinutes / 60);
                    const gridColStart = dateIndex + 2; 

                    return (
                        <ScheduledProcessBar 
                            key={item.id} 
                            item={item} 
                            gridRow={gridRow} 
                            gridColStart={gridColStart}
                            durationInColumns={durationInColumns}
                            onUndo={onUndoSchedule}
                            onDragStart={handleInternalDragStart}
                            onDragEnd={handleInternalDragEnd}
                            isOrderLevelView={isOrderLevelView}
                            isBeingDragged={isBeingDragged}
                        />
                    );
                } else { // Machine level view
                    const rowId = item.machineId;
                    const rowPosition = rowPositions.get(rowId);
                    if (!rowPosition) return null;
                    
                    const dateIndex = timeColumns.findIndex(d => {
                      if (viewMode === 'day') return isSameDay(d.date, item.startDateTime);
                      return d.date.getTime() === setHours(startOfDay(item.startDateTime), item.startDateTime.getHours()).getTime();
                    });
                    if (dateIndex === -1) return null;
                    
                    const gridRow = rowPosition.start + 3;
                    const gridColStart = dateIndex + 2;
                    
                    const durationInColumns = viewMode === 'day' 
                        ? Math.ceil(item.durationMinutes / (8 * 60))
                        : Math.ceil(item.durationMinutes / 60);


                    return (
                        <ScheduledProcessBar 
                            key={item.id} 
                            item={item} 
                            gridRow={gridRow} 
                            gridColStart={gridColStart}
                            durationInColumns={durationInColumns}
                            onUndo={onUndoSchedule}
                            onDragStart={handleInternalDragStart}
                            onDragEnd={handleInternalDragEnd}
                            isOrderLevelView={isOrderLevelView}
                            isBeingDragged={isBeingDragged}
                        />
                    );
                }
            })}
        </div>
    </div>
  );
}
