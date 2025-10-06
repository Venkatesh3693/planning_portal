
"use client";

import * as React from 'react';
import { format, getMonth, getYear, setHours, startOfDay, isWithinInterval, startOfHour, endOfHour, addDays, addMinutes, getDaysInMonth } from 'date-fns';
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
  viewMode: ViewMode;
  draggedItem: DraggedItemData | null;
};

const ROW_HEIGHT_PX = 32;
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const WORKING_HOURS = Array.from({ length: WORKING_HOURS_END - WORKING_HOURS_START }, (_, i) => i + WORKING_HOURS_START);


export default function GanttChart({
  rows,
  dates,
  scheduledProcesses,
  onDrop,
  onUndoSchedule,
  onProcessDragStart,
  viewMode,
  draggedItem,
}: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = React.useState<{ rowId: string; date: Date } | null>(null);
  const isDragging = !!draggedItem;
  
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
  
  const topHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (timeColumns.length === 0) return headers;
    
    if (viewMode === 'day') {
      let currentMonth = -1;
      let span = 0;
      timeColumns.forEach((col) => {
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
      });
      headers.push({ name: format(timeColumns[timeColumns.length - 1].date, "MMM ''yy"), span });
    } else { // hour view
      let currentDay = -1;
      let span = 0;
      timeColumns.forEach((col) => {
        const day = col.date.getDate();
        if (day !== currentDay) {
          if (currentDay !== -1) {
             headers.push({ name: format(addDays(col.date, -1), 'MMM d'), span });
          }
          currentDay = day;
          span = 1;
        } else {
          span++;
        }
      });
      headers.push({ name: format(timeColumns[timeColumns.length - 1].date, 'MMM d'), span });
    }

    return headers;
  }, [timeColumns, viewMode]);

  const gridTemplateColumns = `[row-header] max-content repeat(${timeColumns.length}, minmax(2.5rem, 1fr))`;
  const gridTemplateRows = `auto auto repeat(${rows.length}, ${ROW_HEIGHT_PX}px)`;

  return (
    <div 
        className={cn("h-full w-full overflow-auto relative", isDragging && 'is-dragging')}
    >
      <div 
        className="grid relative"
        style={{
          gridTemplateColumns,
          gridTemplateRows,
        }}
      >
        {/* Sticky Top-Left Corner */}
        <div className="sticky top-0 left-0 z-40 bg-card border-r border-b" style={{ gridRow: '1 / 3', gridColumn: 'row-header' }}>
           <div className="flex h-full items-center justify-end border-b bg-card pr-2 py-1">
            <span className="text-sm font-semibold text-foreground">{viewMode === 'day' ? 'Month' : 'Day'}</span>
          </div>
          <div className="flex h-full items-center justify-end bg-card pr-2">
            <span className="text-[10px] font-medium text-muted-foreground leading-tight py-1">{viewMode === 'day' ? 'Day' : 'Hour'}</span>
          </div>
        </div>

        {/* Sticky Date Headers */}
        <div className="sticky top-0 z-30 col-start-2 col-span-full flex flex-col bg-card">
          {/* Top Header (Month or Day) */}
          <div className="grid" style={{ gridTemplateColumns: `subgrid` }}>
              {topHeaders.map(({ name, span }, i) => (
                  <div key={`top-header-${i}`} className="border-r border-b text-center py-1" style={{ gridColumn: `span ${span}` }}>
                      <span className="text-sm font-semibold text-foreground">{name}</span>
                  </div>
              ))}
          </div>
          {/* Bottom Header (Day or Hour) */}
          <div className="grid" style={{ gridTemplateColumns: `subgrid` }}>
              {timeColumns.map((col, i) => (
                  <div key={`bottom-header-${i}`} className="border-r border-b text-center">
                    <div className="text-[10px] font-medium text-muted-foreground leading-tight py-1">
                        {viewMode === 'day' ? format(col.date, 'd') : format(col.date, 'ha').toLowerCase()}
                    </div>
                  </div>
              ))}
          </div>
        </div>

        {/* Sticky Machine Name Headers */}
        {rows.map((row, rowIndex) => (
            <div
                key={row.id}
                className={cn(
                  "sticky left-0 z-20 p-2 border-b border-r whitespace-nowrap justify-start flex items-center", 
                  rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted'
                )}
                style={{ gridRowStart: rowIndex + 3, gridColumn: 'row-header' }}
            >
                <span className="font-semibold text-foreground text-sm">{row.name}</span>
            </div>
        ))}

        {/* Main Timeline Grid */}
        {rows.map((row, rowIndex) => (
          <React.Fragment key={row.id}>
            {timeColumns.map((col, dateIndex) => {
              const isDragOver = dragOverCell?.rowId === row.id && dragOverCell.date.getTime() === col.date.getTime();
              let isInTnaRange = false;
              if (draggedItem?.type === 'new' && draggedItem.tna) {
                  const interval = viewMode === 'day' 
                    ? { start: startOfDay(draggedItem.tna.startDate), end: startOfDay(draggedItem.tna.endDate) }
                    : { start: startOfHour(draggedItem.tna.startDate), end: endOfHour(draggedItem.tna.endDate) };
                  isInTnaRange = isWithinInterval(col.date, interval);
              }
              return (
                  <div
                      key={`${row.id}-${dateIndex}`}
                      onDragOver={(e) => handleDragOver(e, row.id, col.date)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, row.id, col.date)}
                      className={cn('border-b border-r z-0',
                          isDragOver ? 'bg-primary/20' : (rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50'),
                          isInTnaRange && !isDragOver && 'bg-green-500/10',
                          'transition-colors duration-200'
                      )}
                      style={{ gridRowStart: rowIndex + 3, gridColumnStart: dateIndex + 2 }}
                  />
              )
            })}
          </React.Fragment>
        ))}

        {/* Scheduled Process Bars */}
        {scheduledProcesses.map((item) => {
            const rowIndex = rows.findIndex(r => r.id === item.machineId);
            if (rowIndex === -1) return null;

            const startColDate = viewMode === 'day' ? startOfDay(item.startDateTime) : startOfHour(item.startDateTime);
            const dateIndex = timeColumns.findIndex(d => d.date.getTime() === startColDate.getTime());
            if (dateIndex === -1) return null;

            const endColDate = viewMode === 'day' ? startOfDay(item.endDateTime) : startOfHour(item.endDateTime);
            let endDateIndex = timeColumns.findIndex(d => d.date.getTime() === endColDate.getTime());
            
            if (item.endDateTime.getTime() === endColDate.getTime() && item.endDateTime.getTime() > item.startDateTime.getTime()) {
                const prevDate = viewMode === 'day' ? startOfDay(addDays(item.endDateTime, -1)) : startOfHour(addMinutes(item.endDateTime, -60));
                endDateIndex = timeColumns.findIndex(d => d.date.getTime() === prevDate.getTime());
            }

            if (endDateIndex === -1) {
              endDateIndex = timeColumns.length -1;
            }

            const durationInColumns = endDateIndex - dateIndex + 1;
            
            return (
                <ScheduledProcessBar 
                    key={item.id} 
                    item={item} 
                    gridRow={rowIndex + 3} 
                    gridColStart={dateIndex + 2}
                    durationInColumns={durationInColumns}
                    onUndo={onUndoSchedule}
                    onDragStart={onProcessDragStart}
                />
            );
        })}
      </div>
    </div>
  );
}

    