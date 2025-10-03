
"use client";

import React, { useState, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
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

const assignLanes = (processes: ScheduledProcess[]): { process: ScheduledProcess; lane: number }[] => {
  if (!processes.length) return [];
  
  const sortedProcesses = [...processes].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  
  return sortedProcesses.map((process, index) => ({
    process,
    lane: index,
  }));
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

  const laneAssignments = useMemo(() => {
    if (!isOrderLevelView) return new Map();

    const assignmentsByRow = new Map<string, { process: ScheduledProcess; lane: number }[]>();
    for (const row of rows) {
      const processesForRow = scheduledProcesses.filter(p => p.orderId === row.id);
      assignmentsByRow.set(row.id, assignLanes(processesForRow));
    }
    return assignmentsByRow;
  }, [isOrderLevelView, rows, scheduledProcesses]);

  const maxLanesPerRow = useMemo(() => {
    if (!isOrderLevelView) return new Map<string, number>();

    const maxLanes = new Map<string, number>();
    for (const row of rows) {
      const assignments = laneAssignments.get(row.id) || [];
      const numLanes = assignments.length > 0 ? assignments.length : 1;
      maxLanes.set(row.id, numLanes);
    }
    return maxLanes;
  }, [isOrderLevelView, rows, laneAssignments]);
  
  const rowPositions = useMemo(() => {
    const positions = new Map<string, { start: number, span: number }>();
    let counter = 2;
    rows.forEach(row => {
        const span = isOrderLevelView ? (maxLanesPerRow.get(row.id) || 1) : 1;
        positions.set(row.id, { start: counter, span });
        counter += span;
    });
    return positions;
  }, [rows, isOrderLevelView, maxLanesPerRow]);

  const totalGridRows = Array.from(rowPositions.values()).reduce((sum, pos) => sum + pos.span, 0);

  const gridStyle = {
    gridTemplateColumns: `12rem repeat(${dates.length}, minmax(4.5rem, 1fr))`,
    gridTemplateRows: `auto repeat(${totalGridRows}, minmax(2.5rem, auto))`,
  };

  return (
    <div className="relative h-full w-full">
      <div className="grid" style={gridStyle}>
        {/* Empty corner */}
        <div className="sticky left-0 top-0 z-20 border-b border-r border-border/50 bg-card"></div>
        
        {/* Date headers */}
        {dates.map((date, i) => (
          <div key={i} className="sticky top-0 z-10 border-b border-border/50 bg-card/95 p-2 text-center backdrop-blur-sm">
            <div className="text-xs font-medium text-muted-foreground">{format(date, 'E')}</div>
            <div className="text-lg font-semibold text-foreground">{format(date, 'd')}</div>
          </div>
        ))}

        {/* Grid rows */}
        {rows.map((row) => {
          const position = rowPositions.get(row.id);
          if (!position) return null;

          return (
            <React.Fragment key={row.id}>
              {/* Row name header */}
              <div 
                className="sticky left-0 z-10 flex items-center justify-start border-b border-r border-border/50 bg-card/95 p-2 backdrop-blur-sm"
                style={{ gridRow: `${position.start} / span ${position.span}`, gridColumn: 1 }}
              >
                <span className="font-semibold text-foreground text-sm">{row.name}</span>
              </div>
              
              {/* Grid cells for dropping */}
              {dates.map((date, dateIndex) => (
                <div
                  key={`${row.id}-${dateIndex}`}
                  onDragOver={(e) => handleDragOver(e, row.id, date)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, row.id, date)}
                  className={cn(
                    'border-b border-border/50',
                    !isOrderLevelView && dragOverCell && dragOverCell.rowId === row.id && isSameDay(dragOverCell.date, date) 
                      ? 'bg-accent/30' 
                      : 'bg-transparent',
                    !isOrderLevelView && 'hover:bg-secondary/50',
                    'transition-colors duration-200'
                  )}
                  style={{ gridRow: `${position.start} / span ${position.span}`, gridColumn: dateIndex + 2 }}
                ></div>
              ))}
            </React.Fragment>
          )
        })}

        {/* Scheduled processes */}
        {isOrderLevelView
          ? Array.from(laneAssignments.entries()).flatMap(([rowId, assignments]) => {
              const rowPosition = rowPositions.get(rowId);
              if (!rowPosition) return [];
              
              return assignments.map(({ process, lane }) => {
                const dateIndex = dates.findIndex(d => isSameDay(d, process.startDate));
                if (dateIndex === -1) return null;

                const gridRow = rowPosition.start + lane;
                const gridColStart = dateIndex + 2;

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
              
              const gridRow = rowPosition.start;
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
