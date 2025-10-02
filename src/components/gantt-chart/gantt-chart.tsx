"use client";

import React, { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import type { Machine, ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import ScheduledProcessBar from './scheduled-process';

type GanttChartProps = {
  machines: Machine[];
  dates: Date[];
  scheduledProcesses: ScheduledProcess[];
  onDrop: (processId: string, machineId: string, date: Date) => void;
};

export default function GanttChart({ machines, dates, scheduledProcesses, onDrop }: GanttChartProps) {
  const [dragOverCell, setDragOverCell] = useState<{ machineId: string; date: Date } | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, machineId: string, date: Date) => {
    e.preventDefault();
    setDragOverCell({ machineId, date });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, machineId: string, date: Date) => {
    e.preventDefault();
    const processId = e.dataTransfer.getData('processId');
    if (processId) {
      onDrop(processId, machineId, date);
    }
    setDragOverCell(null);
  };

  const gridStyle = {
    gridTemplateColumns: `12rem repeat(${dates.length}, minmax(4.5rem, 1fr))`,
    gridTemplateRows: `auto repeat(${machines.length}, minmax(4.5rem, 1fr))`,
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
        {machines.map((machine, machineIndex) => (
          <React.Fragment key={machine.id}>
            {/* Machine name header */}
            <div 
              className="sticky left-0 z-10 flex items-center justify-start border-b border-r bg-card/95 p-3 backdrop-blur-sm"
              style={{ gridRow: machineIndex + 2, gridColumn: 1 }}
            >
              <span className="font-semibold text-foreground">{machine.name}</span>
            </div>
            
            {/* Grid cells for dropping */}
            {dates.map((date, dateIndex) => (
              <div
                key={`${machine.id}-${dateIndex}`}
                onDragOver={(e) => handleDragOver(e, machine.id, date)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, machine.id, date)}
                className={cn(
                  'border-b border-r',
                  dragOverCell && dragOverCell.machineId === machine.id && isSameDay(dragOverCell.date, date) 
                    ? 'bg-accent/30' 
                    : 'bg-background/50 hover:bg-secondary/50',
                  'transition-colors duration-200'
                )}
                style={{ gridRow: machineIndex + 2, gridColumn: dateIndex + 2 }}
              ></div>
            ))}
          </React.Fragment>
        ))}

        {/* Scheduled processes */}
        {scheduledProcesses.map((item) => {
          const machineIndex = machines.findIndex(m => m.id === item.machineId);
          const dateIndex = dates.findIndex(d => isSameDay(d, item.startDate));
          
          if (machineIndex === -1 || dateIndex === -1) {
            return null;
          }

          const gridRow = machineIndex + 2;
          const gridColStart = dateIndex + 2;

          return (
            <ScheduledProcessBar 
              key={item.id} 
              item={item} 
              gridRow={gridRow} 
              gridColStart={gridColStart}
            />
          );
        })}
      </div>
    </div>
  );
}
