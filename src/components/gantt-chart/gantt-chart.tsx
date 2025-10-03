
"use client";

import * as React from 'react';
import { format, isSameDay, getWeek, getMonth, getYear } from 'date-fns';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import ScheduledProcessBar from './scheduled-process';

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

const ROW_HEIGHT = 32; // Corresponds to h-8, assuming 1rem = 16px

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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(0);
  const [rowHeaderWidth, setRowHeaderWidth] = React.useState(144); // 9rem default

  React.useEffect(() => {
    if (rows.length > 0) {
        let maxWidth = 0;
        const tempSpan = document.createElement('span');
        // Apply styles that affect width
        tempSpan.style.fontFamily = 'Inter, sans-serif';
        tempSpan.style.fontSize = '0.875rem'; // text-sm
        tempSpan.style.fontWeight = '600'; // font-semibold
        tempSpan.style.position = 'absolute';
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.whiteSpace = 'nowrap';

        document.body.appendChild(tempSpan);

        rows.forEach(row => {
            tempSpan.textContent = row.name;
            const width = tempSpan.offsetWidth;
            if (width > maxWidth) {
                maxWidth = width;
            }
        });
        document.body.removeChild(tempSpan);
        setRowHeaderWidth(maxWidth + 32); // Add 32px for padding
    } else {
        setRowHeaderWidth(144); // Fallback to default if no rows
    }
  }, [rows]);

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

  const totalOccupiedRows = Array.from(rowPositions.values()).reduce((sum, pos) => sum + pos.span, 0);

  const headerHeight = 44 * 2; // Approximate height of 2 header rows
  const remainingHeight = containerHeight > 0 ? containerHeight - headerHeight - (totalOccupiedRows * ROW_HEIGHT) : 0;
  const numEmptyRows = Math.max(0, Math.floor(remainingHeight / ROW_HEIGHT));

  const totalGridRows = totalOccupiedRows + numEmptyRows;
  
  const timelineGridStyle = {
    gridTemplateColumns: `${rowHeaderWidth}px repeat(${dates.length}, minmax(3rem, 1fr))`,
    gridTemplateRows: `auto auto auto repeat(${totalGridRows || 1}, ${ROW_HEIGHT}px)`,
  };

  const months = React.useMemo(() => {
    const monthSpans: { name: string; start: number; span: number }[] = [];
    if (dates.length === 0) return monthSpans;

    let currentMonth = getMonth(dates[0]);
    let currentYear = getYear(dates[0]);
    let span = 0;
    let start = 2; // Start after row header column

    dates.forEach((date, index) => {
      if (getMonth(date) === currentMonth && getYear(date) === currentYear) {
        span++;
      } else {
        monthSpans.push({ name: format(new Date(currentYear, currentMonth), "MMM ''yy"), start, span });
        currentMonth = getMonth(date);
        currentYear = getYear(date);
        start = index + 2;
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
      let start = 2; // Start after row header column

      dates.forEach((date, index) => {
          if (getWeek(date) === currentWeek) {
              span++;
          } else {
              weekSpans.push({ name: `W${currentWeek}`, start, span });
              currentWeek = getWeek(date);
              start = index + 2;
              span = 1;
          }
      });
      weekSpans.push({ name: `W${currentWeek}`, start, span });
      return weekSpans;
  }, [dates]);


  return (
    <div className="h-full w-full overflow-auto" ref={containerRef}>
        <div className="relative grid min-h-full" style={timelineGridStyle}>
            {/* Sticky Row Headers column background */}
            <div className="sticky left-0 z-30 col-start-1 row-start-1 row-end-[-1] bg-blue-100"></div>

            {/* Empty Corner */}
            <div className="sticky left-0 top-0 z-40 border-b border-r bg-card" style={{gridRowEnd: 'span 3'}}></div>
            
            {/* Row name headers */}
            {rows.map((row) => {
                const position = rowPositions.get(row.id);
                if (!position) return null;
                return (
                    <div 
                        key={row.id}
                        className="sticky left-0 z-30 flex items-center justify-center p-2"
                        style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: 1 }}
                    >
                        <span className="font-semibold text-blue-900 text-sm">{row.name}</span>
                    </div>
                );
            })}
        
            {/* Month headers */}
            {months.map(({name, start, span}) => (
                <div key={name} className="sticky top-0 z-20 border-b border-r bg-card/95 py-0 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 1 }}>
                    <span className="text-xs font-semibold text-foreground">{name}</span>
                </div>
            ))}
            
            {/* Week headers */}
            {weeks.map(({name, start, span}) => (
                <div key={name} className="sticky top-[1.2rem] z-20 border-b border-r-2 bg-card/95 py-0 text-center backdrop-blur-sm" style={{ gridColumn: `${start} / span ${span}`, gridRow: 2}}>
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                </div>
            ))}

            {/* Day headers */}
            {dates.map((date, i) => (
                <div key={i} className="sticky top-[2.4rem] z-20 border-b border-r bg-card/95 py-0 text-center backdrop-blur-sm" style={{gridColumn: i + 2, gridRow: 3}}>
                    <div className="text-[10px] font-medium text-muted-foreground">{format(date, 'd')}</div>
                </div>
            ))}
            
            {/* Grid cells for dropping */}
            {rows.flatMap((row, rowIndex) => {
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
                            dragOverCell && dragOverCell.rowId === row.id && isSameDay(dragOverCell.date, date) 
                            ? 'bg-primary/20' 
                            : 'bg-primary/5',
                            !isOrderLevelView && 'hover:bg-primary/10',
                            'transition-colors duration-200'
                        )}
                        style={{ gridRow: `${position.start + 3} / span ${position.span}`, gridColumn: dateIndex + 2 }}
                    ></div>
                ))
            })}
            
            {/* Empty rows to fill space */}
            {Array.from({ length: numEmptyRows }).map((_, i) => {
              const gridRowStart = totalOccupiedRows + i + 4;
              return dates.map((date, dateIndex) => (
                <div
                  key={`empty-${i}-${dateIndex}`}
                  className={cn(
                    "border-b",
                    "bg-card"
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
                    "sticky left-0 z-10 border-b",
                  )}
                  style={{
                    gridRow: totalOccupiedRows + i + 4,
                    gridColumn: 1,
                  }}
                ></div>
              );
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
                    const gridColStart = dateIndex + 2; // +2 for row header col

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
                const gridColStart = dateIndex + 2; // +2 for row header col

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
  );
}





    

    

    

    

    

    
