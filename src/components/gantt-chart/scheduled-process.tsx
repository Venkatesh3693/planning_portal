
import { ORDERS, PROCESSES } from '@/lib/data';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type ScheduledProcessProps = {
  item: ScheduledProcess;
  gridRow: number;
  gridColStart: number;
  durationInColumns: number;
  onUndo: (scheduledProcessId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, process: ScheduledProcess) => void;
  onDragEnd: () => void;
  isOrderLevelView?: boolean;
  isBeingDragged?: boolean;
};

export default function ScheduledProcessBar({ 
  item, 
  gridRow, 
  gridColStart, 
  durationInColumns, 
  onUndo,
  onDragStart,
  onDragEnd,
  isOrderLevelView = false,
  isBeingDragged = false,
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
    onUndo(item.id);
    setIsMenuOpen(false);
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isOrderLevelView) return;
    e.preventDefault();
    setIsMenuOpen(true);
  };
  
  const handleInternalDragStart = (e: React.DragEvent<HTMLDivElement>, process: ScheduledProcess) => {
    // Stop propagation to prevent any parent handlers from interfering.
    e.stopPropagation();
    onDragStart(e, process);
  };

  const backgroundColor = processDetails.color ? processDetails.color : 'hsl(var(--accent))';

  return (
    <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <PopoverAnchor asChild>
        <div
          draggable={!isOrderLevelView}
          onDragStart={(e) => handleInternalDragStart(e, item)}
          onDragEnd={onDragEnd}
          onContextMenu={handleContextMenu}
          data-scheduled-process-id={item.id}
          className={cn(
            "relative z-10 flex items-center overflow-hidden rounded-md m-px h-[calc(100%-0.125rem)] text-white shadow-lg transition-opacity duration-150",
            !isOrderLevelView && "cursor-grab active:cursor-grabbing",
            isBeingDragged && "opacity-0 pointer-events-none"
          )}
          style={{
            gridRowStart: gridRow,
            gridColumn: `${gridColStart} / span ${durationInColumns}`,
            backgroundColor: backgroundColor,
          }}
          title={`${orderDetails.id}: ${processDetails.name} (${durationText})`}
        >
          <div 
            className="flex items-center gap-2 px-2 pointer-events-none w-full"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate text-xs font-medium">{isOrderLevelView ? processDetails.name : orderDetails.id}</span>
          </div>
        </div>
      </PopoverAnchor>
      
      {!isOrderLevelView && (
          <PopoverContent className="w-80" side="right" align="start">
            <div className="grid gap-2 p-2">
              <div className="space-y-1">
                <h4 className="font-medium leading-none">{orderDetails.ocn} - {orderDetails.style}</h4>
                <p className="text-sm text-muted-foreground">
                  {processDetails.name}
                </p>
              </div>
              <p className="text-sm">
                <strong>Start:</strong> {format(item.startDateTime, 'MMM d, yyyy @ h:mm a')}
              </p>
              <p className="text-sm">
                <strong>End:</strong> {format(item.endDateTime, 'MMM d, yyyy @ h:mm a')}
              </p>
              <p className="text-sm">
                <strong>Duration:</strong> {durationText}
              </p>
              <p className="text-sm">
                <strong>Order ID:</strong> {orderDetails.id}
              </p>
            </div>
            <div className="p-1">
              <Button variant="ghost" className="w-full justify-start" onClick={handleUndo}>
                <Undo2 className="mr-2 h-4 w-4" />
                <span>Return to Unplanned</span>
              </Button>
            </div>
          </PopoverContent>
      )}
    </Popover>
  );
}

