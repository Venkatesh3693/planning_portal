
"use client";

import * as React from 'react';
import { format, getWeek, getMonth, getYear, setHours, startOfDay, isWithinInterval, startOfHour, endOfHour, addDays, addMinutes } from 'date-fns';
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

const ROW_HEIGHT_PX = 32;
const ROW_HEADER_WIDTH_PX = 160;
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
  
  const gridTemplateColumns = `${ROW_HEADER_WIDTH_PX}px repeat(${timeColumns.length}, minmax(3rem, 1fr))`;

  const topHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (timeColumns.length === 0) return headers;
    let currentGroup: string | number, span = 0;

    if (viewMode === 'day') {
      currentGroup = `${getMonth(timeColumns[0].date)}-${getYear(timeColumns[0].date)}`;
      timeColumns.forEach((col, index) => {
          const group = `${getMonth(col.date)}-${getYear(col.date)}`;
          if (group === currentGroup) {
              span++;
          } else {
              headers.push({ name: format(timeColumns[index-1].date, "MMM ''yy"), span });
              currentGroup = group;
              span = 1;
          }
      });
      headers.push({ name: format(timeColumns[timeColumns.length - 1].date, "MMM ''yy"), span });
    } else { // hour view
      currentGroup = getWeek(timeColumns[0].date);
      timeColumns.forEach((col, index) => {
        if (getWeek(col.date) === currentGroup) {
          span++;
        } else {
          headers.push({ name: `W${currentGroup}`, span });
          currentGroup = getWeek(col.date);
          span = 1;
        }
      });
      headers.push({ name: `W${currentGroup}`, span });
    }
    return headers;
  }, [timeColumns, viewMode]);
  
  const midHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (timeColumns.length === 0) return headers;
    let currentGroup: string | number, span = 0;

    if (viewMode === 'day') {
      currentGroup = getWeek(timeColumns[0].date);
      timeColumns.forEach((col, index) => {
        if (getWeek(col.date) === currentGroup) {
            span++;
        } else {
            headers.push({ name: `W${currentGroup}`, span });
            currentGroup = getWeek(col.date);
            span = 1;
        }
      });
      headers.push({ name: `W${currentGroup}`, span });
    } else { // hour view
      currentGroup = format(timeColumns[0].date, 'yyyy-MM-dd');
      timeColumns.forEach((col, index) => {
        const group = format(col.date, 'yyyy-MM-dd');
        if (group === currentGroup) {
          span++;
        } else {
          headers.push({ name: format(new Date(group), 'MMM d'), span });
          currentGroup = group;
          span = 1;
        }
      });
      headers.push({ name: format(new Date(currentGroup), 'MMM d'), span });
    }
    return headers;
  }, [timeColumns, viewMode]);

  return (
    <div 
      className={cn("h-full w-full overflow-auto relative grid", isDragging && 'is-dragging')}
      style={{
        gridTemplateColumns,
        gridTemplateRows: `auto auto auto repeat(${rows.length}, ${ROW_HEIGHT_PX}px)`
      }}
    >
        {/* === HEADER === */}
        <div className="sticky top-0 z-20 contents">
          {/* Top-left empty cell */}
          <div className="sticky left-0 top-0 z-10 border-b border-r bg-card" style={{gridRow: '1 / span 3'}}/>

          {/* Top Header */}
          <div className="col-start-2 border-b bg-card" style={{ gridColumn: `2 / span ${timeColumns.length}` }}>
              <div className="grid grid-flow-col auto-cols-fr">
                  {topHeaders.map(({ name, span }, i) => (
                  <div key={`top-header-${i}`} className="border-r text-center" style={{ gridColumn: `span ${span}` }}>
                      <span className="text-xs font-semibold text-foreground py-1">{name}</span>
                  </div>
                  ))}
              </div>
          </div>

          {/* Mid Header */}
          <div className="col-start-2 border-b bg-card" style={{ gridColumn: `2 / span ${timeColumns.length}` }}>
              <div className="grid grid-flow-col auto-cols-fr">
                  {midHeaders.map(({ name, span }, i) => (
                  <div key={`mid-header-${i}`} className="border-r text-center" style={{ gridColumn: `span ${span}` }}>
                      <span className="text-sm font-semibold text-foreground py-1">{name}</span>
                  </div>
                  ))}
              </div>
          </div>
          
          {/* Bottom Header */}
          <div className="col-start-2 border-b bg-card" style={{ gridColumn: `2 / span ${timeColumns.length}` }}>
              <div className="grid grid-flow-col auto-cols-fr">
                  {timeColumns.map((col, i) => (
                      <div key={`bottom-header-${i}`} className="border-r text-center">
                          <div className="text-[10px] font-medium text-muted-foreground leading-none py-1">
                          {viewMode === 'day' ? format(col.date, 'd') : format(col.date, 'ha')}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        </div>

        {/* === BODY === */}
        {/* Sticky Row Headers Column */}
        {rows.map((row, rowIndex) => (
          <div 
            key={row.id}
            className={cn( "sticky left-0 z-10 flex items-center justify-start p-2 border-b border-r whitespace-nowrap", rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50' )}
            style={{ gridRow: `${rowIndex + 4}` }}
          >
            <span className="font-semibold text-foreground text-sm">{row.name}</span>
          </div>
        ))}

        {/* Grid Cells */}
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
                      className={cn('border-b border-r',
                          isDragOver ? 'bg-primary/20' : (rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50'),
                          isInTnaRange && !isDragOver && 'bg-green-500/10',
                          'transition-colors duration-200'
                      )}
                      style={{ gridRow: `${rowIndex + 4}`, gridColumn: dateIndex + 2 }}
                  />
              )
            })}
          </React.Fragment>
        ))}

        {/* Scheduled Process Bars */}
        <div 
          className="col-start-2 contents"
          style={{ 
            gridRow: `4 / span ${rows.length}`,
            gridColumn: `2 / span ${timeColumns.length}`
          }}
        >
          {scheduledProcesses.map((item) => {
              const position = rows.findIndex(r => r.id === item.machineId);
              if (position === -1) return null;

              const startColDate = viewMode === 'day' ? startOfDay(item.startDateTime) : startOfHour(item.startDateTime);
              const dateIndex = timeColumns.findIndex(d => d.date.getTime() === startColDate.getTime());
              if (dateIndex === -1) return null;

              const endColDate = viewMode === 'day' ? startOfDay(item.endDateTime) : startOfHour(item.endDateTime);
              let endDateIndex = timeColumns.findIndex(d => d.date.getTime() === endColDate.getTime());
              
              if (item.endDateTime.getTime() === endColDate.getTime() && item.endDateTime.getTime() > item.startDateTime.getTime()) {
                  const prevDate = viewMode === 'day' ? startOfDay(addDays(item.endDateTime, -1)) : startOfHour(addMinutes(item.endDateTime, -60));
                  endDateIndex = timeColumns.findIndex(d => d.date.getTime() === prevDate.getTime());
              }

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
