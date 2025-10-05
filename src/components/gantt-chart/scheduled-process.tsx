
import { ORDERS, PROCESSES } from '@/lib/data';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRef, useState } from 'react';

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

const DRAG_THRESHOLD = 5; // pixels

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
  const ref = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pointerDownPosition = useRef<{ x: number, y: number } | null>(null);

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
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isDragging) {
      setIsMenuOpen(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only listen for primary button to initiate drag detection
    if (e.button !== 0) return;
    pointerDownPosition.current = { x: e.clientX, y: e.clientY };
    setIsDragging(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerDownPosition.current) {
      const dx = e.clientX - pointerDownPosition.current.x;
      const dy = e.clientY - pointerDownPosition.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        setIsDragging(true);
        // Once dragging, we can clear the start position
        pointerDownPosition.current = null; 
      }
    }
  };
  
  const handlePointerUp = () => {
     pointerDownPosition.current = null;
     // The isDragging state will be reset by the browser's onDragEnd event if a drag occurred.
     // If no drag occurred, we can reset it here, but it's safer to let onDragEnd handle it.
  };

  const handleInternalDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    onDragEnd();
  };
  
  const backgroundColor = processDetails.color ? processDetails.color : 'hsl(var(--accent))';

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <div
        ref={ref}
        draggable={!isOrderLevelView}
        onDragStart={(e) => onDragStart(e, item)}
        onDragEnd={handleInternalDragEnd}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
        <div className="flex items-center gap-2 px-2 pointer-events-none">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate text-xs font-medium">{isOrderLevelView ? processDetails.name : orderDetails.id}</span>
        </div>
      </div>
      <DropdownMenuContent className="w-80">
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
        <DropdownMenuSeparator />
        {!isOrderLevelView && (
          <DropdownMenuItem onClick={handleUndo}>
            <Undo2 className="mr-2 h-4 w-4" />
            <span>Return to Unplanned</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
