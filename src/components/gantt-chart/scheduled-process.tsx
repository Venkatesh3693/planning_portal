
"use client";

import { ORDERS, PROCESSES } from '@/lib/data';
import type { ScheduledProcess } from '@/lib/types';
import type { DraggedItem } from '@/app/page';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Undo2, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type ScheduledProcessProps = {
  item: ScheduledProcess;
  gridRow?: number;
  gridColStart?: number;
  durationInColumns?: number;
  onUndo?: (scheduledProcessId: string) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, item: DraggedItem) => void;
  isOrderLevelView?: boolean;
};

export default function ScheduledProcessBar({ 
  item, 
  gridRow, 
  gridColStart, 
  durationInColumns, 
  onUndo,
  onDragStart,
  isOrderLevelView = false,
}: ScheduledProcessProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const processDetails = PROCESSES.find(p => p.id === item.processId);
  const orderDetails = ORDERS.find(o => o.id === item.orderId);

  if (!processDetails || !orderDetails) return null;

  const Icon = processDetails.icon;

  const durationDays = Math.floor(item.durationMinutes / (8 * 60));
  const remainingMinutes = item.durationMinutes % (8 * 60);
  const durationHours = Math.floor(remainingMinutes / 60);
  const finalMinutes = remainingMinutes % 60;
  
  let durationText = '';
  if (durationDays > 0) durationText += `${durationDays}d `;
  if (durationHours > 0) durationText += `${durationHours}h `;
  if (finalMinutes > 0) durationText += `${finalMinutes}m`;
  durationText = durationText.trim();

  const handleUndo = () => {
    if (onUndo) onUndo(item.id);
    setIsMenuOpen(false);
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(true);
  };
  
  const backgroundColor = processDetails.color || 'hsl(var(--accent))';

  const handleInternalDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (onDragStart) {
      const draggedItem: DraggedItem = { type: 'existing', process: item };
      onDragStart(e, draggedItem);
    }
  };

  return (
    <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <PopoverAnchor asChild>
        <div
          onContextMenu={handleContextMenu}
          draggable={!!onDragStart}
          onDragStart={handleInternalDragStart}
          className={cn(
            "relative z-10 flex items-center overflow-hidden rounded-md m-px h-[calc(100%-0.125rem)] text-white shadow-lg",
            "cursor-grab active:cursor-grabbing"
          )}
          style={{
            gridRowStart: gridRow,
            gridColumn: `${gridColStart} / span ${durationInColumns}`,
            backgroundColor: backgroundColor,
          }}
          title={`${orderDetails.id}: ${processDetails.name} (${durationText})`}
        >
          <div className="flex h-full w-full items-center">
            {!isOrderLevelView && (
              <div className="flex items-center justify-center h-full w-6">
                <GripVertical className="h-4 w-4 text-white/50" />
              </div>
            )}
            <div className="flex items-center gap-2 px-2 pointer-events-none w-full">
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate text-xs font-medium">{isOrderLevelView ? processDetails.name : orderDetails.id}</span>
            </div>
          </div>
        </div>
      </PopoverAnchor>
      
      <PopoverContent className="w-80" side="right" align="start">
        <div className="grid gap-2 p-2">
          <div className="space-y-1">
            <h4 className="font-medium leading-none">{orderDetails.ocn} - {orderDetails.style}</h4>
            <p className="text-sm text-muted-foreground">{processDetails.name}</p>
          </div>
          <p className="text-sm"><strong>Start:</strong> {format(item.startDateTime, 'MMM d, yyyy @ h:mm a')}</p>
          <p className="text-sm"><strong>End:</strong> {format(item.endDateTime, 'MMM d, yyyy @ h:mm a')}</p>
          <p className="text-sm"><strong>Duration:</strong> {durationText}</p>
          <p className="text-sm"><strong>Order ID:</strong> {orderDetails.id}</p>
        </div>
        {onUndo && (
          <div className="p-1">
            <Button variant="ghost" className="w-full justify-start" onClick={handleUndo}>
              <Undo2 className="mr-2 h-4 w-4" />
              <span>Return to Unplanned</span>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

    