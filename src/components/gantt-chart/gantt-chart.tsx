
"use client";

import * as React from 'react';
import { format, isSameDay, getWeek, getMonth, getYear } from 'date-fns';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import ScheduledProcessBar from './scheduled-process';
import { ScrollArea } from '../ui/scroll-area';

type Row = {
  id: string;
  name: string;
};

type GanttChartProps = {
  rows: Row[];
  dates: Date[];
  scheduledProcesses: ScheduledProcess[];
  onDrop: (orderId: string, processId: string, machineId: string, date: Date) => void;
  onUndoSchedule: (scheduledProcessId: string) => void;
  isOrderLevelView?: boolean;
};

const assignLanes = (processes: ScheduledProcess[]): { process: ScheduledProcess; lane: number }[] => {
  if (!processes.length) return [];
  
  const sortedProcesses = [...processes].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  
  const lanes: { process: ScheduledProcess; lane: number }[] = [];
  const laneEndDates: Date[] = [];

  sortedProcesses.forEach(process => {
    let assigned = false;
    const processEndDate = new Date(process.startDate);
    processEndDate.setDate(processEndDate.getDate() + process.durationDays);

    for (let i = 0; i < laneEndDates.length; i++) {
        if (process.startDate >= laneEndDates[i]) {
            lanes.push({ process, lane: i });
            laneEndDates[i] = processEndDate;
            assigned = true;
            break;
        }
    }

    if (!assigned) {
        lanes.push({ process, lane: laneEndDates.length });
        laneEndDates.push(processEndDate);
    }
  });

  return lanes;
};


export default function GanttChart({ rows, dates, scheduledProcesses, onDrop, onUndoSchedule, isOrderLevelView = false }: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = React.useState<{ rowId: string; date: Date } | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, rowId: string, date: Date) => {
    e.preventDefault();
    if(isOrderLevelView) return;
    setDragOverCell({ rowId, date });
  };

  const handleDragLeave = () => {
    if(isOrderLevelView) return;
    setDragOverCell(null);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, rowId: string, date: Date) => {
    e.preventDefault();
    if(isOrderLevelView) return;
    const orderId = e.dataTransfer.getData('orderId');
    const processId = e.dataTransfer.getData('processId');
    if (orderId && processId) {
      onDrop(orderId, processId, rowId, date);
    }
    setDragOverCell(null);
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
      const numLanes = assignments.length > 0 ? Math.max(...assignments.map(a => a.lane)) + 1 : 1;
      maxLanes.set(row.id, numLanes);
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

  const totalGridRows = Array.from(rowPositions.values()).reduce((sum, pos) => sum + pos.span, 0);

  const timelineGridStyle = {
    gridTemplateColumns: `repeat(${dates.length}, minmax(3rem, 1fr))`,
    gridTemplateRows: `auto auto auto repeat(${totalGridRows}, minmax(2rem, auto))`,
  };
  
  const rowHeadersGridStyle = {
    gridTemplateRows: `auto auto auto repeat(${totalGridRows}, minmax(2rem, auto))`
  };


  const months = React.useMemo(() => {
    const monthSpans: { name: string; start: number; span: number }[] = [];
    if (dates.length === 0) return monthSpans;

    let currentMonth = getMonth(dates[0]);
    let currentYear = getYear(dates[0]);
    let span = 0;
    let start = 1;

    dates.forEach((date, index) => {
      if (getMonth(date) === currentMonth && getYear(date) === currentYear) {
        span++;
      } else {
        monthSpans.push({ name: format(new Date(currentYear, currentMonth), "MMM ''yy"), start, span });
        currentMonth = getMonth(date);
        currentYear = getYear(date);
        start = index + 1;
        span = 1;
      }
    });
    monthSpans.push({ name: format(new Date(currentYear, currentMonth), "MMM ''yy"), start, span });
    return monthSpans;
  }, [dates]);
  
  const weeks = React.useMemo(() => {
      const weekSpans: { name: string; start: number; span: number }[] = [];
      if (dates.length === 0) return weekSpans;

      let currentWeek = getWeek(dates[0]);
      let span = 0;
      let start = 1;

      dates.forEach((date, index) => {
          if (getWeek(date) === currentWeek) {
              span++;
          } else {
              weekSpans.push({ name: `W${currentWeek}`, start, span });
              currentWeek = getWeek(date);
              start = index + 1;
              span = 1;
          }
      });
      weekSpans.push({ name: `W${currentWeek}`, start, span });
      return weekSpans;
  }, [dates]);


  return (
    <div className="flex h-full w-full">
        {/* Sticky Row Headers */}
        <div className="sticky left-0 z-20 w-[12rem] shrink-0 bg-card">
            <div className="grid" style={rowHeadersGridStyle}>
                {/* Empty Corner */}
                <div className="border-b border-r" style={{gridRowEnd: 'span 3'}}></div>
                
                {/* Row name headers */}
                {rows.map((row) => {
                    const position = rowPositions.get(row.id);
                    if (!position) return null;
                    return (
                        <div 
                            key={row.id}
                            className="flex items-center justify-start border-b border-r p-2"
                            style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: 1 }}
                        >
                            <span className="font-semibold text-foreground text-sm">{row.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Scrolling Timeline Area */}
        <div className="flex-1 overflow-x-auto">
            <div className="grid" style={timelineGridStyle}>
                {/* Month headers */}
                {months.map(({name, start, span}) => (
                    <div key={name} className="sticky top-0 z-10 border-b bg-card/95 py-0.5 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 1 }}>
                        <span className="text-xs font-semibold text-foreground">{name}</span>
                    </div>
                ))}
                
                {/* Week headers */}
                {weeks.map(({name, start, span}) => (
                    <div key={name} className="sticky top-[1.35rem] z-10 border-b bg-card/95 py-0.5 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 2}}>
                        <span className="text-xs font-medium text-muted-foreground">{name}</span>
                    </div>
                ))}

                {/* Day headers */}
                {dates.map((date, i) => (
                    <div key={i} className="sticky top-[2.7rem] z-10 border-b border-r bg-card/95 py-0.5 text-center backdrop-blur-sm" style={{gridColumn: i + 1, gridRow: 3}}>
                        <div className="text-xs font-semibold text-foreground">{format(date, 'd')}</div>
                    </div>
                ))}
                
                {/* Grid cells for dropping */}
                {rows.flatMap((row) => {
                    const position = rowPositions.get(row.id);
                    if (!position) return [];
                    
                    return dates.map((date, dateIndex) => (
                        <div
                            key={`${row.id}-${dateIndex}`}
                            onDragOver={(e) => handleDragOver(e, row.id, date)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, row.id, date)}
                            className={cn(
                                'border-b',
                                dateIndex < dates.length -1 ? 'border-r' : '',
                                !isOrderLevelView && dragOverCell && dragOverCell.rowId === row.id && isSameDay(dragOverCell.date, date) 
                                ? 'bg-primary/20' 
                                : 'bg-transparent',
                                !isOrderLevelView && 'hover:bg-primary/10',
                                'transition-colors duration-200'
                            )}
                            style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: dateIndex + 1 }}
                        ></div>
                    ))
                })}


                {/* Scheduled processes */}
                {isOrderLevelView
                ? Array.from(laneAssignments.entries()).flatMap(([rowId, assignments]) => {
                    const rowPosition = rowPositions.get(rowId);
                    if (!rowPosition) return [];
                    
                    return assignments.map(({ process, lane }) => {
                        const dateIndex = dates.findIndex(d => isSameDay(d, process.startDate));
                        if (dateIndex === -1) return null;

                        const gridRow = rowPosition.start + lane + 3;
                        const gridColStart = dateIndex + 1;

                        return (
                        <ScheduledProcessBar 
                            key={process.id} 
                            item={process} 
                            gridRow={gridRow} 
                            gridColStart={gridColStart}
                            onUndo={onUndoSchedule}
                            isOrderLevelView={isOrderLevelView}
                        />
                        );
                    });
                    })
                : scheduledProcesses.map((item) => {
                    const rowId = item.machineId;
                    const rowPosition = rowPositions.get(rowId);
                    if (!rowPosition) return null;
                    
                    const dateIndex = dates.findIndex(d => isSameDay(d, item.startDate));
                    if (dateIndex === -1) return null;
                    
                    const gridRow = rowPosition.start + 3;
                    const gridColStart = dateIndex + 1;

                    return (
                        <ScheduledProcessBar 
                        key={item.id} 
                        item={item} 
                        gridRow={gridRow} 
                        gridColStart={gridColStart}
                        onUndo={onUndoSchedule}
                        isOrderLevelView={isOrderLevelView}
                        />
                    );
                    })}
            </div>
        </div>
    </div>
  );
}

