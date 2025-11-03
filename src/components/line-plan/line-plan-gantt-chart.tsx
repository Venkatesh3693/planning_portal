
'use client';

import * as React from 'react';
import type { LinePlanRow } from '@/app/line-plan/page';
import type { Order } from '@/lib/types';
import { format, getMonth, getWeek, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type GanttChartProps = {
  rows: LinePlanRow[];
  dates: Date[];
  orders: Order[];
};

const ROW_HEIGHT_PX = 40;
const CELL_WIDTH_PX = 60;
const SIDEBAR_WIDTH_PX = 200;

const calculatePlanItems = (rows: LinePlanRow[], dates: Date[], orders: Order[]) => {
    const items: React.ReactNode[] = [];

    const dateToColumnIndex = new Map<string, number>();
    dates.forEach((date, index) => {
        dateToColumnIndex.set(format(date, 'yyyy-MM-dd'), index);
    });

    rows.forEach((row, rowIndex) => {
        let weeklyLeftOffset = 0;
        let lastProcessedWeek = -1;

        Object.keys(row.planData).sort((a,b) => parseInt(a.slice(1)) - parseInt(b.slice(1))).forEach(weekStr => {
            const weekNum = parseInt(weekStr.slice(1));
            const weekData = row.planData[weekStr];
            if (!weekData || weekData.totalPlan <= 0) return;
            
            // Find first day of this week in our dates array
            const firstDayOfWeek = dates.find(d => getWeek(d, { weekStartsOn: 1 }) === weekNum);
            if (!firstDayOfWeek) return;

            const weekStartIndex = dateToColumnIndex.get(format(firstDayOfWeek, 'yyyy-MM-dd')) ?? -1;
            if (weekStartIndex === -1) return;

            if (lastProcessedWeek !== weekNum) {
                weeklyLeftOffset = 0;
                lastProcessedWeek = weekNum;
            }

            weekData.models.forEach((model, modelIndex) => {
                if(model.planQty <= 0) return;

                const daysForModel = (model.planQty / weekData.totalPlan) * 6; // 6 working days
                const itemWidth = daysForModel * CELL_WIDTH_PX;
                
                const order = orders.find(o => o.id === model.orderId);
                const itemColor = order?.displayColor || '#A1A1AA';

                const leftPosition = (weekStartIndex * CELL_WIDTH_PX) + weeklyLeftOffset;

                items.push(
                    <TooltipProvider key={`${row.id}-${weekStr}-${model.color}`}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className="absolute rounded-md text-white text-xs font-semibold overflow-hidden flex items-center justify-center shadow"
                                    style={{
                                        top: `${rowIndex * ROW_HEIGHT_PX + 4}px`,
                                        left: `${leftPosition}px`,
                                        width: `${itemWidth}px`,
                                        height: `${ROW_HEIGHT_PX - 8}px`,
                                        backgroundColor: itemColor
                                    }}
                                >
                                  <span className="truncate px-2">{model.color}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p><strong>{row.name} / {row.ccNo}</strong></p>
                                <p>Model: {model.color}</p>
                                <p>Plan Qty: {Math.round(model.planQty).toLocaleString()}</p>
                                <p>Duration: {daysForModel.toFixed(1)} days</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );

                weeklyLeftOffset += itemWidth;
            });
        });
    });
    return items;
};


export default function LinePlanGanttChart({ rows, dates, orders }: GanttChartProps) {
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

  const planItems = React.useMemo(() => calculatePlanItems(rows, dates, orders), [rows, dates, orders]);


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
            <div key={row.id} style={{height: ROW_HEIGHT_PX}} className="flex flex-col justify-center px-4 border-b bg-muted/30">
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.ccNo}</p>
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
                  <div key={`${row.id}-${dateIndex}`} className={cn("border-b border-r", (rowIndex + dateIndex) % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
          {planItems}
        </div>
      </div>
    </div>
  );
}
