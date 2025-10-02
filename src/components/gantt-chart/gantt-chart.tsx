
"use client";

import React, { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import ScheduledProcessBar from './scheduled-process';
import { ORDERS } from '@/lib/data';

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

export default function GanttChart({ rows, dates, scheduledProcesses, onDrop, onUndoSchedule, isOrderLevelView = false }: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = useState<{ rowId: string; date: Date } | null>(null);

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

  const gridStyle = {
    gridTemplateColumns: `12rem repeat(${dates.length}, minmax(4.5rem, 1fr))`,
    gridTemplateRows: `auto repeat(${rows.length}, minmax(4.5rem, 1fr))`,
  };

  return (
    <div className="relative h-full w-full">
      <div className="grid" style={gridStyle}>
        {/* Empty corner */}
        <div className="sticky left-0 top-0 z-20 border-b border-r bg-card"></div>
        
        {/* Date headers */}
        {dates.map((date, i) => (
          <div key={i} className="sticky top-0 z-10 border-b border-r bg-card/95 p-2 text-center backdrop-blur-sm">
            <div className="text-xs font-medium text-muted-foreground">{format(date, 'E')}</div>
            <div className="text-lg font-semibold text-foreground">{format(date, 'd')}</div>
          </div>
        ))}

        {/* Grid rows */}
        {rows.map((row, rowIndex) => (
          <React.Fragment key={row.id}>
            {/* Row name header */}
            <div 
              className="sticky left-0 z-10 flex items-center justify-start border-b border-r bg-card/95 p-3 backdrop-blur-sm"
              style={{ gridRow: rowIndex + 2, gridColumn: 1 }}
            >
              <span className="font-semibold text-foreground">{row.name}</span>
            </div>
            
            {/* Grid cells for dropping */}
            {dates.map((date, dateIndex) => (
              <div
                key={`${row.id}-${dateIndex}`}
                onDragOver={(e) => handleDragOver(e, row.id, date)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, row.id, date)}
                className={cn(
                  'border-b border-r',
                  !isOrderLevelView && dragOverCell && dragOverCell.rowId === row.id && isSameDay(dragOverCell.date, date) 
                    ? 'bg-accent/30' 
                    : 'bg-background/50',
                  !isOrderLevelView && 'hover:bg-secondary/50',
                  'transition-colors duration-200'
                )}
                style={{ gridRow: rowIndex + 2, gridColumn: dateIndex + 2 }}
              ></div>
            ))}
          </React.Fragment>
        ))}

        {/* Scheduled processes */}
        {scheduledProcesses.map((item) => {
          const rowId = isOrderLevelView ? item.orderId : item.machineId;
          const rowIndex = rows.findIndex(r => r.id === rowId);
          const dateIndex = dates.findIndex(d => isSameDay(d, item.startDate));
          
          if (rowIndex === -1 || dateIndex === -1) {
            return null;
          }

          const gridRow = rowIndex + 2;
          const gridColStart = dateIndex + 2;

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
