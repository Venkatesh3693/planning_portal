
'use client';

import * as React from 'react';
import type { SewingLineGroup } from '@/lib/types';
import { format, getMonth } from 'date-fns';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  name: string;
};

type GanttChartProps = {
  rows: Row[];
  dates: Date[];
};

const ROW_HEIGHT_PX = 40;
const CELL_WIDTH_PX = 60;
const SIDEBAR_WIDTH_PX = 200;

export default function LinePlanGanttChart({ rows, dates }: GanttChartProps) {
  const headerRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const monthHeaders = React.useMemo(() => {
    const headers: { name: string; span: number }[] = [];
    if (dates.length === 0) return headers;

    let currentMonth = -1;
    let span = 0;
    dates.forEach((date, index) => {
      const month = getMonth(date);
      if (month !== currentMonth) {
        if (currentMonth !== -1) {
          headers.push({ name: format(dates[index - 1], "MMM ''yy"), span });
        }
        currentMonth = month;
        span = 1;
      } else {
        span++;
      }
      if (index === dates.length - 1) {
        headers.push({ name: format(date, "MMM ''yy"), span });
      }
    });
    return headers;
  }, [dates]);

  const handleBodyScroll = () => {
    if (headerRef.current && bodyRef.current) {
        headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    if (sidebarRef.current && bodyRef.current) {
        sidebarRef.current.scrollTop = bodyRef.current.scrollTop;
    }
  };

  const gridTemplateColumns = `repeat(${dates.length}, ${CELL_WIDTH_PX}px)`;
  const totalGridWidth = dates.length * CELL_WIDTH_PX;
  const totalGridHeight = rows.length * ROW_HEIGHT_PX;

  return (
    <div 
      className="grid h-full w-full relative"
      style={{
        gridTemplateColumns: `${SIDEBAR_WIDTH_PX}px 1fr`,
        gridTemplateRows: `auto auto 1fr`,
      }}
    >
      {/* Top-Left Corner */}
      <div className="sticky top-0 left-0 z-30 bg-muted border-r border-b">
        <div className="h-8 border-b flex items-center px-4 font-semibold text-foreground">SLG</div>
        <div className="h-8 flex items-center px-4"></div>
      </div>

      {/* Header */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-muted border-b overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns, width: totalGridWidth }}>
          {monthHeaders.map(({ name, span }, i) => (
            <div key={`month-header-${i}`} style={{ gridColumn: `span ${span}` }} className="h-8 flex items-center justify-center border-r border-b font-semibold text-foreground">
              {name}
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns, width: totalGridWidth }}>
          {dates.map((date) => (
            <div key={date.toISOString()} className="h-8 flex items-center justify-center border-r text-muted-foreground">
              {format(date, 'd')}
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div ref={sidebarRef} className="row-start-3 overflow-hidden bg-background border-r z-20">
        <div style={{ height: totalGridHeight }}>
          {rows.map((row) => (
            <div key={row.id} style={{height: ROW_HEIGHT_PX}} className="flex items-center px-4 border-b font-medium bg-muted/30">
              {row.name}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} className="row-start-3 col-start-2 overflow-auto" onScroll={handleBodyScroll}>
        <div className="relative" style={{ width: totalGridWidth, height: totalGridHeight }}>
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns, gridTemplateRows: `repeat(${rows.length}, ${ROW_HEIGHT_PX}px)` }}>
            {rows.map((row, rowIndex) => (
              <React.Fragment key={row.id}>
                {dates.map((date, dateIndex) => (
                  <div key={`${row.id}-${dateIndex}`} className={cn("border-b border-r", rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
                    {/* Cell for scheduled items will go here */}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
