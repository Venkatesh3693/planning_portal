

"use client";

import { PROCESSES } from '@/lib/data';
import type { ScheduledProcess, Order } from '@/lib/types';
import type { DraggedItemData } from '@/app/page';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Undo2, GripVertical, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type ScheduledProcessProps = {
  item: ScheduledProcess;
  orders: Order[];
  onUndo?: (scheduledProcessId: string) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => void;
  onClick?: (processId: string) => void;
  onSplit?: (process: ScheduledProcess) => void;
  latestStartDatesMap: Map<string, Date>;
  predecessorEndDateMap: Map<string, Date>;
};

export default function ScheduledProcessBar({ 
  item,
  orders,
  onUndo,
  onDragStart,
  onClick,
  onSplit,
  latestStartDatesMap,
  predecessorEndDateMap,
}: ScheduledProcessProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const processDetails = PROCESSES.find(p => p.id === item.processId);
  const orderDetails = orders.find(o => o.id === item.orderId);

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
  
  const handleSplit = () => {
    if (onSplit) onSplit(item);
    setIsMenuOpen(false);
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(true);
  };

  const handleClick = () => {
    if (onClick) {
      onClick(item.id);
    }
  }

  const dateMapKey = `${item.orderId}-${item.processId}-${item.batchNumber || 0}`;
  const liveLatestStartDate = latestStartDatesMap.get(dateMapKey);
  const livePredecessorEndDate = predecessorEndDateMap.get(dateMapKey);
  
  const handleInternalDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Prevent the parent from trying to handle the drag as well
    e.stopPropagation();
    if (onDragStart) {
      const freshProcessData: ScheduledProcess = {
        ...item,
        latestStartDate: liveLatestStartDate,
      };
      const draggedItem: DraggedItemData = { type: 'existing', process: freshProcessData };
      e.dataTransfer.effectAllowed = "move";
      onDragStart(e, draggedItem);
    }
  };
  
  const baseColor = orderDetails.displayColor || processDetails.color || 'hsl(var(--accent))';


  return (
    <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <PopoverAnchor asChild>
        <div
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          draggable={!!onDragStart}
          onDragStart={handleInternalDragStart}
          className={cn(
            "relative z-10 flex items-center overflow-hidden rounded-md m-px h-[calc(100%-0.125rem)] text-white shadow-lg group/gantt-chart-bar",
            "group-[.is-dragging]/gantt:pointer-events-none", // Make other bars un-interactive during drag
            onDragStart && 'cursor-grab active:cursor-grabbing',
            onClick && 'cursor-pointer'
          )}
          style={{
            backgroundColor: baseColor,
          }}
          title={`${orderDetails.id}: ${processDetails.name} (${durationText})`}
        >
          <div className="flex h-full w-full items-center">
              <div className="flex items-center justify-center h-full w-6 bg-black/10">
                <GripVertical className="h-4 w-4 text-white/50" />
              </div>
            <div className="flex items-center gap-2 px-2 pointer-events-none w-full">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-xs font-semibold">{orderDetails.ocn ? `${orderDetails.ocn}-${orderDetails.color}` : orderDetails.id}</span>
              {item.isSplit && <span className="text-xs opacity-80">({item.quantity})</span>}
            </div>
          </div>
        </div>
      </PopoverAnchor>
      
      <PopoverContent className="w-80" side="right" align="start">
        <div className="grid gap-2 p-2">
          <div className="space-y-1">
            <h4 className="font-medium leading-none">{orderDetails.id}</h4>
            <p className="text-sm text-muted-foreground">{processDetails.name}</p>
          </div>
          
          {item.isSplit && (
            <div className="border-t pt-2 mt-2 space-y-1">
              <p className="text-sm font-semibold">
                Batch {item.batchNumber} / {item.totalBatches}
              </p>
              <p className="text-sm">
                <strong>Batch Quantity:</strong> {item.quantity.toLocaleString()}
              </p>
            </div>
          )}

          <div className={cn("border-t mt-2 pt-2", !item.isSplit && "border-none pt-0")}>
            <p className="text-sm"><strong>Total Order Quantity:</strong> {orderDetails.quantity.toLocaleString()}</p>
             {livePredecessorEndDate && (
                <p className="text-sm">
                  <strong>Predecessor End:</strong> {format(livePredecessorEndDate, 'MMM d, h:mm a')}
                </p>
              )}
             {liveLatestStartDate && (
                <p className="text-sm">
                  <strong>Latest Start:</strong> {format(liveLatestStartDate, 'MMM d, yyyy')}
                </p>
              )}
          </div>
        </div>
        <div className="p-1 border-t">
          {onSplit && (
            <Button variant="ghost" className="w-full justify-start" onClick={handleSplit}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <span>Split Process...</span>
            </Button>
          )}
          {onUndo && (
            <Button variant="ghost" className="w-full justify-start" onClick={handleUndo}>
              <Undo2 className="mr-2 h-4 w-4" />
              <span>Return to Unplanned</span>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
