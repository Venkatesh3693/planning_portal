
"use client";

import * as React from 'react';
import { format, getWeek, getMonth, getYear, setHours, startOfDay, isWithinInterval, startOfHour, endOfHour } from 'date-fns';
import type { ScheduledProcess } from '@/lib/types';
import type { DraggedItemData } from '@/app/page';
import { cn } from '@/lib/utils';
import ScheduledProcessBar from './scheduled-process';
import { PROCESSES } from '@/lib/data';

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

const ROW_HEIGHT = 32; // Corresponds to h-8
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
  const containerRef = React.useRef<HTMLDivElement>(null);

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

  const handleInternalDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const draggedItemJSON = e.dataTransfer.getData('application/json');
    if (!draggedItemJSON) return;
    try {
        const item: DraggedItemData = JSON.parse(draggedItemJSON);
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
  };
  
  const totalGridRows = rows.length;
  
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
          headers.push({ name: format(new Date(group), 'MMM d'), start, span });
          currentGroup = group;
          start = index + 2;
          span = 1;
        }
      });
      headers.push({ name: format(new Date(currentGroup), 'MMM d'), start, span });
    }
    return headers;
  }, [timeColumns, viewMode]);

  const rowElements = React.useMemo(() => {
    return rows.map((row, rowIndex) => ({
      key: row.id,
      rowHeader: (
          <div 
              className={cn( "sticky left-0 z-20 flex items-center justify-start p-2 border-b border-r whitespace-nowrap", rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50' )}
              style={{ gridRow: `${rowIndex + 4}`, gridColumn: 1 }}
          >
              <span className="font-semibold text-foreground text-sm">{row.name}</span>
          </div>
      ),
      cells: timeColumns.map((col, dateIndex) => {
        const isDragOver = dragOverCell?.rowId === row.id && dragOverCell.date.getTime() === col.date.getTime();
        let isInTnaRange = false;
        if (draggedItem?.type === 'new' && draggedItem.tna) {
            const interval = viewMode === 'day' 
              ? { start: startOfDay(draggedItem.tna.startDate), end: startOfDay(draggedItem.tna.endDate) }
              : { start: startOfHour(draggedItem.tna.startDate), end: endOfHour(draggedItem.tna.endDate) };
            isInTnaRange = isWithinInterval(col.date, interval);
        }
        return {
          key: `${row.id}-${dateIndex}`,
          rowId: row.id,
          date: col.date,
          className: cn('border-b border-r',
              isDragOver ? 'bg-primary/20' : (rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50'),
              isInTnaRange && !isDragOver && 'bg-green-500/10',
              'transition-colors duration-200'
          ),
          style: { gridRow: `${rowIndex + 4}`, gridColumn: dateIndex + 2 }
        }
      })
    }));
  }, [rows, timeColumns, dragOverCell, draggedItem, viewMode]);

  return (
    <div className="h-full w-full overflow-auto" ref={containerRef} onDragStart={handleInternalDragStart}>
        <div className={cn("relative grid min-h-full group/gantt", isDragging && 'is-dragging')} style={timelineGridStyle}>
            <div className="sticky left-0 top-0 z-50 col-start-1 row-start-1 row-span-3 border-b border-r bg-card"></div>
            
            {topHeaders.map(({name, start, span}) => (
                <div key={`top-${name}-${start}`} className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-r text-center py-1" style={{ gridRow: 1, gridColumn: `${start} / span ${span}`}}>
                    <span className="text-xs font-semibold text-foreground">{name}</span>
                </div>
            ))}
             {midHeaders.map(({name, start, span}) => (
                <div key={`mid-${name}-${start}`} className="sticky top-[1.8rem] z-40 bg-card/95 backdrop-blur-sm border-b border-r text-center py-1" style={{ gridRow: 2, gridColumn: `${start} / span ${span}`}}>
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                </div>
            ))}
            {timeColumns.map((col, i) => (
                <div key={`bottom-header-${i}`} className="sticky top-[3.8rem] z-40 bg-card/95 backdrop-blur-sm border-b border-r text-center" style={{ gridRow: 3, gridColumn: i + 2}}>
                    <div className="text-[10px] font-medium text-muted-foreground leading-[1]">
                      {viewMode === 'day' ? format(col.date, 'd') : format(col.date, 'ha')}
                    </div>
                </div>
            ))}
            
            {rowElements.map(row => (
              <React.Fragment key={row.key}>
                {row.rowHeader}
                {row.cells?.map(cell => (
                    <div
                        key={cell.key}
                        onDragOver={(e) => handleDragOver(e, cell.rowId, cell.date)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, cell.rowId, cell.date)}
                        className={cell.className}
                        style={cell.style}
                    />
                ))}
              </React.Fragment>
            ))}


            {scheduledProcesses.map((item) => {
                const row = rows.find(r => r.id === item.machineId);
                const position = rows.findIndex(r => r.id === item.machineId);
                if (!row || position === -1) return null;

                const startColDate = viewMode === 'day' ? startOfDay(item.startDateTime) : startOfHour(item.startDateTime);
                const dateIndex = timeColumns.findIndex(d => d.date.getTime() === startColDate.getTime());
                if (dateIndex === -1) return null;

                const endColDate = viewMode === 'day' ? startOfDay(item.endDateTime) : startOfHour(item.endDateTime);
                const endDateIndex = timeColumns.findIndex(d => d.date.getTime() === endColDate.getTime());
                
                const durationInColumns = endDateIndex - dateIndex + 1;
                
                return (
                    <ScheduledProcessBar 
                        key={item.id} 
                        item={item} 
                        gridRow={position + 4} 
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
